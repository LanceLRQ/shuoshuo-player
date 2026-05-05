// 音频缓存模块（XOR 混淆 + LRU + 持久化索引）
//
// 数据流：
//   handler 收到 Range 请求 → cache_key = sha256(url_no_query + start-end)
//     ├─ hit: 读 chunks/<UUID>.bin → XOR 解混 → 返回字节
//     └─ miss: reqwest 下载 → respond 客户端 + 异步写盘 + 更新 LRU 索引
//
// 文件布局：
//   $APP_CACHE_DIR/audio/
//     ├─ index.json              # LRU 元数据（key → entry）
//     └─ chunks/<UUID>.bin       # 单段混淆字节流
//
// 安全说明：XOR 仅做"误识别"防护，不是加密。文件名 UUID + 索引隔离，看磁盘
// 文件无法直接识别歌曲；XOR 后字节流不能被 ffmpeg 直接当 m4s 解码。

use std::collections::HashMap;
use std::num::NonZeroUsize;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use lru::LruCache;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager, Runtime};
use tokio::fs;
use uuid::Uuid;

const CACHE_DIR_NAME: &str = "audio";
const CHUNKS_DIR_NAME: &str = "chunks";
const INDEX_FILE_NAME: &str = "index.json";
/// LRU 容量上限：1 GB（约 200 首平均 5 MB 的歌）
pub const DEFAULT_MAX_BYTES: u64 = 1 * 1024 * 1024 * 1024;
/// LRU 条目数硬上限（防内存爆炸；按平均 1MB/段，可容纳约 1024 段 = 几十首）
const LRU_MAX_ENTRIES: usize = 8192;
/// 内存级解混缓存条目数（每条 ~4MB，4 条约 16MB 内存）。
/// 命中后直接切片返回，避免重复 fs::read + XOR 解混 4MB → 大幅降低 audio 标签
/// 高频小 Range 的累积 CPU/IO 开销。
const MEM_CACHE_ENTRIES: usize = 4;
/// XOR 混淆密钥（固定）。只防"误识别"，不抗逆向
const XOR_KEY: &[u8] = b"shuoshuo-player-v2-cache";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheEntry {
    pub uuid: String,
    pub size: u64,
    /// 整个音频文件的总大小（来自上游 Content-Range: bytes N-M/total）。
    /// audio 标签需要此值才能正确建立时间轴；命中缓存时构造 206 响应必填。
    pub total_size: u64,
    /// MIME type（如 audio/mp4），命中缓存时构造 Content-Type 响应头。
    pub content_type: String,
    pub last_access: u64, // unix epoch seconds
}

/// 持久化到 index.json 的 LRU 状态快照
#[derive(Debug, Default, Serialize, Deserialize)]
struct IndexSnapshot {
    entries: HashMap<String, CacheEntry>,
}

pub struct AudioCacheState {
    pub root: PathBuf,
    pub chunks_dir: PathBuf,
    pub index_path: PathBuf,
    pub max_bytes: u64,
    pub lru: Mutex<LruCache<String, CacheEntry>>,
    pub current_bytes: Mutex<u64>,
    /// per-key 异步锁，防止 audio 并发探测同一 chunk 时重复下载（single-flight）。
    /// 第二个请求会等第一个 reqwest 完成 + 写完 cache 后从缓存读，节省带宽。
    pub inflight: Mutex<HashMap<String, Arc<tokio::sync::Mutex<()>>>>,
    /// 内存级"已解混" chunk LRU。命中即零开销返回 Arc<MemHitData>，
    /// 避免 audio 标签高频小 Range 反复 fs::read + XOR 解混 4MB 的累积开销
    pub mem_cache: Mutex<LruCache<String, Arc<MemHitData>>>,
}

/// 内存级缓存条目：已 XOR 解混的字节流 + 元数据，可被多个并发请求共享（Arc）
pub struct MemHitData {
    pub bytes: Vec<u8>,
    pub total_size: u64,
    pub content_type: String,
}

impl AudioCacheState {
    fn new(root: PathBuf, max_bytes: u64) -> Self {
        let chunks_dir = root.join(CHUNKS_DIR_NAME);
        let index_path = root.join(INDEX_FILE_NAME);
        Self {
            root,
            chunks_dir,
            index_path,
            max_bytes,
            lru: Mutex::new(LruCache::new(
                NonZeroUsize::new(LRU_MAX_ENTRIES).expect("LRU_MAX_ENTRIES > 0"),
            )),
            current_bytes: Mutex::new(0),
            inflight: Mutex::new(HashMap::new()),
            mem_cache: Mutex::new(LruCache::new(
                NonZeroUsize::new(MEM_CACHE_ENTRIES).expect("MEM_CACHE_ENTRIES > 0"),
            )),
        }
    }

    /// 获取或创建某 key 的 inflight 异步锁；调用方 `.lock().await` 进入临界区。
    /// 临界区内必须重新检查 cache（double-check 模式）：前一个请求可能已写完。
    pub fn inflight_lock_for(&self, key: &str) -> Arc<tokio::sync::Mutex<()>> {
        let mut map = self.inflight.lock().expect("inflight map poisoned");
        map.entry(key.to_string())
            .or_insert_with(|| Arc::new(tokio::sync::Mutex::new(())))
            .clone()
    }
}

/// 计算 chunk-aligned cache key（去签名参数 + chunk_index）
///
/// 设计要点：audio 标签会发大量碎片 Range（如 8 字节探测 mp4 atom），但都落在
/// 1 MB chunk 边界内。按 chunk_index 缓存而非任意 range，让任何 audio Range 都能
/// 命中已下载的 1 MB 段，再切片返回。大幅减少 reqwest 调用次数（千兆带宽下原本
/// RTT 串行成为瓶颈）。
pub fn compute_chunk_cache_key(url: &str, chunk_index: u64) -> String {
    let parsed = url::Url::parse(url);
    let normalized = match parsed {
        Ok(u) => format!(
            "{}://{}{}",
            u.scheme(),
            u.host_str().unwrap_or(""),
            u.path()
        ),
        Err(_) => url.to_string(),
    };
    let payload = format!("{}:chunk:{}", normalized, chunk_index);
    let mut hasher = Sha256::new();
    hasher.update(payload.as_bytes());
    let bytes = hasher.finalize();
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// XOR 混淆/解混（对称运算）
pub fn xor_inplace(data: &mut [u8]) {
    for (i, b) in data.iter_mut().enumerate() {
        *b ^= XOR_KEY[i % XOR_KEY.len()];
    }
}

fn unix_now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// 启动期初始化：创建目录 + 加载 index.json → LRU
pub fn init<R: Runtime>(app: &AppHandle<R>) -> Result<AudioCacheState, String> {
    let app_cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("get app_cache_dir failed: {}", e))?;
    let root = app_cache_dir.join(CACHE_DIR_NAME);
    let state = AudioCacheState::new(root.clone(), DEFAULT_MAX_BYTES);

    std::fs::create_dir_all(&state.chunks_dir)
        .map_err(|e| format!("create chunks dir failed: {}", e))?;

    // 启动期加载已有索引（同步 IO 可接受，仅一次）
    let mut total_bytes: u64 = 0;
    if state.index_path.exists() {
        match std::fs::read(&state.index_path) {
            Ok(raw) => match serde_json::from_slice::<IndexSnapshot>(&raw) {
                Ok(snap) => {
                    let mut entries: Vec<(String, CacheEntry)> = snap.entries.into_iter().collect();
                    // LRU 顺序按 last_access 升序加载（最旧先 put → 最新最后 put 在头部）
                    entries.sort_by_key(|(_, e)| e.last_access);
                    let mut guard = state.lru.lock().unwrap();
                    for (k, e) in entries {
                        // 校验文件存在；不存在的孤儿索引项跳过
                        let chunk_path = state.chunks_dir.join(format!("{}.bin", e.uuid));
                        if chunk_path.exists() {
                            total_bytes += e.size;
                            guard.put(k, e);
                        } else {
                            eprintln!("[audio_cache] orphan index entry skipped: uuid={}", e.uuid);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("[audio_cache] index parse failed, starting empty: {}", e);
                }
            },
            Err(e) => eprintln!("[audio_cache] index read failed: {}", e),
        }
    }
    *state.current_bytes.lock().unwrap() = total_bytes;
    eprintln!(
        "[audio_cache] initialized: dir={:?} entries_loaded current_bytes={}",
        state.root, total_bytes
    );
    Ok(state)
}

/// 命中查询：返回 Arc<MemHitData>（已 XOR 解混）；不命中返回 None
///
/// 两级缓存策略：
/// 1. 先查 mem_cache（最近 4 个 chunk）：零开销，audio 标签连续小 Range 走这里
/// 2. miss → 查磁盘 LRU + fs::read + XOR 解混 → 写 mem_cache → 返回
pub async fn try_load(state: &AudioCacheState, key: &str) -> Option<Arc<MemHitData>> {
    // L1: 内存解混缓存
    if let Ok(mut g) = state.mem_cache.lock() {
        if let Some(arc) = g.get(key) {
            return Some(arc.clone());
        }
    }

    // L2: 磁盘 LRU
    let entry = {
        let mut guard = state.lru.lock().ok()?;
        let e = guard.get(key)?.clone();
        // get 已自动把 key 移到 LRU 头部
        e
    };
    let path = state.chunks_dir.join(format!("{}.bin", entry.uuid));
    let mut bytes = match fs::read(&path).await {
        Ok(b) => b,
        Err(e) => {
            eprintln!(
                "[audio_cache] file read failed (uuid={}): {}",
                entry.uuid, e
            );
            return None;
        }
    };
    xor_inplace(&mut bytes);
    let arc = Arc::new(MemHitData {
        bytes,
        total_size: entry.total_size,
        content_type: entry.content_type,
    });

    // 写 mem_cache，下次同 chunk 的小 Range 直接零开销
    if let Ok(mut g) = state.mem_cache.lock() {
        g.put(key.to_string(), arc.clone());
    }

    update_access(state, key);
    Some(arc)
}

fn update_access(state: &AudioCacheState, key: &str) {
    if let Ok(mut guard) = state.lru.lock() {
        if let Some(e) = guard.get(key).cloned() {
            let mut updated = e;
            updated.last_access = unix_now();
            guard.put(key.to_string(), updated);
        }
    }
}

/// 写入新缓存项：XOR 混淆 + 写文件 + 更新索引 + 必要时驱逐旧项
///
/// total_size / content_type 来自上游 Content-Range / Content-Type 响应头，
/// 用于命中查询时构造正确的 206 响应。
pub async fn store(
    state: &AudioCacheState,
    key: &str,
    data: &[u8],
    total_size: u64,
    content_type: &str,
) -> Result<(), String> {
    let uuid = Uuid::new_v4().to_string();
    let path = state.chunks_dir.join(format!("{}.bin", uuid));

    // 写盘前先 XOR 混淆（堆 clone 避免修改调用方 buffer）
    let mut obfuscated = data.to_vec();
    xor_inplace(&mut obfuscated);
    fs::write(&path, &obfuscated)
        .await
        .map_err(|e| format!("write chunk failed: {}", e))?;

    let entry = CacheEntry {
        uuid: uuid.clone(),
        size: data.len() as u64,
        total_size,
        content_type: content_type.to_string(),
        last_access: unix_now(),
    };

    // 同步写 mem_cache：避免下游切片再读盘 + XOR 解混
    if let Ok(mut g) = state.mem_cache.lock() {
        g.put(
            key.to_string(),
            Arc::new(MemHitData {
                bytes: data.to_vec(),
                total_size,
                content_type: content_type.to_string(),
            }),
        );
    }

    // 更新 LRU + 容量统计
    {
        let mut lru = state
            .lru
            .lock()
            .map_err(|e| format!("lru lock poisoned: {}", e))?;
        let mut total = state
            .current_bytes
            .lock()
            .map_err(|e| format!("bytes lock poisoned: {}", e))?;
        // 同 key 重复 put：扣减旧 size，删旧文件
        if let Some(old) = lru.peek(key) {
            *total = total.saturating_sub(old.size);
            let old_path = state.chunks_dir.join(format!("{}.bin", old.uuid));
            // 异步删除（fire-and-forget）
            tokio::spawn(async move {
                let _ = fs::remove_file(old_path).await;
            });
        }
        lru.put(key.to_string(), entry);
        *total += data.len() as u64;
    }

    // 持久化索引（节流：每次 store 都刷一次。文件不大，IO 可接受）
    persist_index(state).await.ok();

    // 容量检查 + 驱逐
    evict_if_needed(state).await;

    Ok(())
}

async fn persist_index(state: &AudioCacheState) -> Result<(), String> {
    let snap: IndexSnapshot = {
        let lru = state
            .lru
            .lock()
            .map_err(|e| format!("lru lock poisoned: {}", e))?;
        let mut entries = HashMap::new();
        for (k, v) in lru.iter() {
            entries.insert(k.clone(), v.clone());
        }
        IndexSnapshot { entries }
    };
    let raw = serde_json::to_vec(&snap).map_err(|e| format!("serialize index: {}", e))?;
    fs::write(&state.index_path, raw)
        .await
        .map_err(|e| format!("write index: {}", e))
}

async fn evict_if_needed(state: &AudioCacheState) {
    let mut to_remove: Vec<(String, String, u64)> = Vec::new(); // (key, uuid, size)
    {
        let mut lru = match state.lru.lock() {
            Ok(g) => g,
            Err(_) => return,
        };
        let mut total = match state.current_bytes.lock() {
            Ok(g) => g,
            Err(_) => return,
        };
        while *total > state.max_bytes {
            // pop_lru 取最旧项
            match lru.pop_lru() {
                Some((k, e)) => {
                    *total = total.saturating_sub(e.size);
                    to_remove.push((k, e.uuid, e.size));
                }
                None => break,
            }
        }
    }
    if !to_remove.is_empty() {
        let count = to_remove.len();
        let mut freed: u64 = 0;
        for (_k, uuid, size) in &to_remove {
            let path = state.chunks_dir.join(format!("{}.bin", uuid));
            let _ = fs::remove_file(path).await;
            freed += size;
        }
        eprintln!(
            "[audio_cache] evicted {} entries ({} bytes freed)",
            count, freed
        );
        // 重写索引以剔除被驱逐项
        persist_index(state).await.ok();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn xor_is_symmetric() {
        let original = b"Hello, B station audio chunk!".to_vec();
        let mut buf = original.clone();
        xor_inplace(&mut buf);
        assert_ne!(buf, original, "XOR 后内容必须改变");
        xor_inplace(&mut buf);
        assert_eq!(buf, original, "二次 XOR 还原原始内容");
    }

    #[test]
    fn xor_handles_empty() {
        let mut buf: Vec<u8> = vec![];
        xor_inplace(&mut buf);
        assert!(buf.is_empty());
    }

    #[test]
    fn chunk_cache_key_strips_query() {
        let url1 = "https://upos-x.bilivideo.com/path/1234.m4s?e=AAA&upsig=BBB";
        let url2 = "https://upos-x.bilivideo.com/path/1234.m4s?e=CCC&upsig=DDD";
        // 同一文件不同签名 → 同一 key
        assert_eq!(
            compute_chunk_cache_key(url1, 2),
            compute_chunk_cache_key(url2, 2)
        );
    }

    #[test]
    fn chunk_cache_key_distinguishes_chunk_index() {
        let url = "https://upos-x.bilivideo.com/path/1234.m4s?e=AAA";
        assert_ne!(
            compute_chunk_cache_key(url, 0),
            compute_chunk_cache_key(url, 1)
        );
    }

    #[test]
    fn chunk_cache_key_distinguishes_file() {
        let url1 = "https://upos-x.bilivideo.com/a.m4s";
        let url2 = "https://upos-x.bilivideo.com/b.m4s";
        assert_ne!(
            compute_chunk_cache_key(url1, 0),
            compute_chunk_cache_key(url2, 0)
        );
    }

    #[test]
    fn chunk_cache_key_invalid_url_falls_back_to_raw() {
        // 不抛错，给原字符串 hash
        let k1 = compute_chunk_cache_key("not-a-url", 0);
        let k2 = compute_chunk_cache_key("not-a-url", 0);
        assert_eq!(k1, k2);
    }

    #[test]
    fn lru_evicts_oldest_on_capacity() {
        let mut lru: LruCache<String, u64> =
            LruCache::new(NonZeroUsize::new(2).expect("non-zero"));
        lru.put("a".into(), 1);
        lru.put("b".into(), 2);
        lru.put("c".into(), 3);
        // a 应被驱逐
        assert!(lru.peek("a").is_none());
        assert!(lru.peek("b").is_some());
        assert!(lru.peek("c").is_some());
    }

    // store/try_load 涉及 tokio::fs，需要 #[tokio::test]，这里 lib 未配置 tokio test runtime；
    // 留给 dev 端到端验证（手测播放 → 重播命中）
}
