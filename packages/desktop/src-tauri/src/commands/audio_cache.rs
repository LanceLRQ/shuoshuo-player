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

use aes::cipher::{block_padding::Pkcs7, BlockDecryptMut, BlockEncryptMut, KeyIvInit};
use lru::LruCache;
use once_cell::sync::Lazy;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager, Runtime};
use tokio::fs;
use uuid::Uuid;

type Aes128CbcEnc = cbc::Encryptor<aes::Aes128>;
type Aes128CbcDec = cbc::Decryptor<aes::Aes128>;

const CACHE_DIR_NAME: &str = "audio";
const CHUNKS_DIR_NAME: &str = "chunks";
const INDEX_FILE_NAME: &str = "index.json";
/// LRU 容量上限：1 GB（约 200 首平均 5 MB 的歌）
pub const DEFAULT_MAX_BYTES: u64 = 1 * 1024 * 1024 * 1024;
/// LRU 条目数硬上限（防内存爆炸；当前 chunk=16MB，可容纳约 64 首 5MB 单 chunk 歌曲）
const LRU_MAX_ENTRIES: usize = 8192;
/// 内存级解混缓存条目数（每条 ~16MB，4 条约 64MB 内存）。
/// 命中后直接切片返回，避免重复 fs::read + 解密整段 → 大幅降低 audio 标签
/// 高频小 Range 的累积 CPU/IO 开销。
const MEM_CACHE_ENTRIES: usize = 4;

/// 文件格式 magic：BPV2 = bilibili player v2（区别旧 XOR 版无 magic）
/// 新文件结构：[4B magic][16B IV][AES-CBC PKCS7 encrypted body]
const FILE_MAGIC: &[u8; 4] = b"BPV2";
const FILE_HEADER_LEN: usize = 4 + 16; // magic + IV
/// 当 machine-uid crate 失败时的兜底 key 源（fallback 后跨机器仍同 key，安全级别约 = XOR）
const FALLBACK_KEY_SEED: &[u8] = b"shuoshuo-player-v2-fallback";

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
    /// 用户可配置的容量上限（默认 DEFAULT_MAX_BYTES，启动时从 plugin-store 加载用户配置）
    pub max_bytes: Mutex<u64>,
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
            max_bytes: Mutex::new(max_bytes),
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

/// 计算 chunk-aligned cache key（去签名参数 + chunk_index + chunk_size 维度）
///
/// 设计要点：audio 标签会发大量碎片 Range（如 8 字节探测 mp4 atom），但都落在
/// chunk_size 边界内。按 chunk_index 缓存而非任意 range，让任何 audio Range 都能
/// 命中已下载的整段 chunk，再切片返回。大幅减少 reqwest 调用次数（千兆带宽下原本
/// RTT 串行成为瓶颈）。
///
/// chunk_size 加入 hash 是为了让"调整 chunk 大小"这种破坏性变更下旧 cache 自动
/// miss（key 不命中）→ 重新下载新格式，避免新读取路径用旧切片越界。
pub fn compute_chunk_cache_key(url: &str, chunk_index: u64, chunk_size: u64) -> String {
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
    let payload = format!("{}:chunk:{}:size{}", normalized, chunk_index, chunk_size);
    let mut hasher = Sha256::new();
    hasher.update(payload.as_bytes());
    let bytes = hasher.finalize();
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// AES-128 key（启动时从 machine-uid 派生一次；跨机器拷贝缓存不可解）
static AES_KEY: Lazy<[u8; 16]> = Lazy::new(|| {
    let seed = match machine_uid::get() {
        Ok(uid) if !uid.is_empty() => uid.into_bytes(),
        Ok(_) | Err(_) => {
            eprintln!("[audio_cache] machine-uid empty/failed, using fallback key");
            FALLBACK_KEY_SEED.to_vec()
        }
    };
    let hash = Sha256::digest(&seed);
    let mut key = [0u8; 16];
    key.copy_from_slice(&hash[..16]);
    key
});

/// 加密 plain bytes → 完整文件字节（含 magic + IV + ciphertext）
pub fn encrypt_with_header(plain: &[u8]) -> Vec<u8> {
    let mut iv = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut iv);
    let cipher = Aes128CbcEnc::new(AES_KEY.as_slice().into(), &iv.into());
    let ciphertext = cipher.encrypt_padded_vec_mut::<Pkcs7>(plain);

    let mut out = Vec::with_capacity(FILE_HEADER_LEN + ciphertext.len());
    out.extend_from_slice(FILE_MAGIC);
    out.extend_from_slice(&iv);
    out.extend_from_slice(&ciphertext);
    out
}

/// 解密文件字节 → plain bytes；header magic 不匹配或解密失败返回 None
pub fn decrypt_with_header(file_bytes: &[u8]) -> Option<Vec<u8>> {
    if file_bytes.len() < FILE_HEADER_LEN {
        return None;
    }
    if &file_bytes[..4] != FILE_MAGIC {
        return None; // 旧 XOR 文件 / 损坏文件
    }
    let mut iv = [0u8; 16];
    iv.copy_from_slice(&file_bytes[4..FILE_HEADER_LEN]);
    let ciphertext = &file_bytes[FILE_HEADER_LEN..];
    let cipher = Aes128CbcDec::new(AES_KEY.as_slice().into(), &iv.into());
    cipher.decrypt_padded_vec_mut::<Pkcs7>(ciphertext).ok()
}

fn unix_now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// 启动期初始化：创建目录 + 加载 index.json → LRU + 加载用户配置的 max_bytes / cache_dir
pub fn init<R: Runtime>(app: &AppHandle<R>) -> Result<AudioCacheState, String> {
    // 优先用用户配置的 cache_dir（plugin-store 持久化），否则用 app_cache_dir/audio
    let root = match load_user_cache_dir(app) {
        Some(custom) => custom,
        None => {
            let app_cache_dir = app
                .path()
                .app_cache_dir()
                .map_err(|e| format!("get app_cache_dir failed: {}", e))?;
            app_cache_dir.join(CACHE_DIR_NAME)
        }
    };
    let max_bytes = load_user_max_bytes(app).unwrap_or(DEFAULT_MAX_BYTES);
    let state = AudioCacheState::new(root.clone(), max_bytes);

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
    let file_bytes = match fs::read(&path).await {
        Ok(b) => b,
        Err(e) => {
            eprintln!(
                "[audio_cache] file read failed (uuid={}): {}",
                entry.uuid, e
            );
            return None;
        }
    };
    let plain = match decrypt_with_header(&file_bytes) {
        Some(p) => p,
        None => {
            // magic 不匹配（旧 XOR 文件）或解密失败 → 视为缓存丢失
            eprintln!(
                "[audio_cache] decrypt failed (uuid={}); marking as miss",
                entry.uuid
            );
            return None;
        }
    };
    let arc = Arc::new(MemHitData {
        bytes: plain,
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

/// 写入新缓存项：AES-128-CBC 加密 + 写文件 + 更新索引 + 必要时驱逐旧项
///
/// total_size / content_type 来自上游 Content-Range / Content-Type 响应头，
/// 用于命中查询时构造正确的 206 响应。文件格式：[4B BPV2][16B IV][AES ciphertext]
pub async fn store(
    state: &AudioCacheState,
    key: &str,
    data: &[u8],
    total_size: u64,
    content_type: &str,
) -> Result<(), String> {
    let uuid = Uuid::new_v4().to_string();
    let path = state.chunks_dir.join(format!("{}.bin", uuid));

    // AES-128-CBC 加密 + magic + IV 写盘
    let encrypted = encrypt_with_header(data);
    fs::write(&path, &encrypted)
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
        let limit = match state.max_bytes.lock() {
            Ok(g) => *g,
            Err(_) => return,
        };
        while *total > limit {
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
    fn aes_encrypt_decrypt_roundtrip() {
        let original = b"Hello, B station audio chunk!".to_vec();
        let encrypted = encrypt_with_header(&original);
        assert_ne!(encrypted, original, "加密后内容必须改变");
        // header 长度
        assert!(encrypted.len() >= FILE_HEADER_LEN);
        assert_eq!(&encrypted[..4], FILE_MAGIC);
        let decrypted = decrypt_with_header(&encrypted).expect("解密成功");
        assert_eq!(decrypted, original, "解密还原原始内容");
    }

    #[test]
    fn aes_encrypt_empty_buffer() {
        let encrypted = encrypt_with_header(&[]);
        // 即使 plain 为空，PKCS7 也会产生一个 padding block
        assert!(encrypted.len() >= FILE_HEADER_LEN + 16);
        let decrypted = decrypt_with_header(&encrypted).expect("空 buffer 也能解");
        assert!(decrypted.is_empty());
    }

    #[test]
    fn aes_decrypt_rejects_legacy_xor_file() {
        // 旧 XOR 文件没有 magic header，应被识别为不可解
        let legacy = b"raw-bytes-no-magic".to_vec();
        assert!(decrypt_with_header(&legacy).is_none());
    }

    #[test]
    fn aes_decrypt_rejects_truncated_file() {
        let too_short = vec![0u8; 10];
        assert!(decrypt_with_header(&too_short).is_none());
    }

    #[test]
    fn aes_iv_is_unique_per_call() {
        // 两次加密同一 plain，IV 不同，密文应不同
        let plain = b"same plaintext bytes".to_vec();
        let e1 = encrypt_with_header(&plain);
        let e2 = encrypt_with_header(&plain);
        assert_ne!(e1, e2, "随机 IV 应让两次加密结果不同");
        // 但都能解回
        assert_eq!(decrypt_with_header(&e1).unwrap(), plain);
        assert_eq!(decrypt_with_header(&e2).unwrap(), plain);
    }

    /// 单测内固定 chunk_size 以保证断言稳定（与生产 MAX_CHUNK_BYTES 解耦）
    const TEST_CHUNK_SIZE: u64 = 16 * 1024 * 1024;

    #[test]
    fn chunk_cache_key_strips_query() {
        let url1 = "https://upos-x.bilivideo.com/path/1234.m4s?e=AAA&upsig=BBB";
        let url2 = "https://upos-x.bilivideo.com/path/1234.m4s?e=CCC&upsig=DDD";
        // 同一文件不同签名 → 同一 key
        assert_eq!(
            compute_chunk_cache_key(url1, 2, TEST_CHUNK_SIZE),
            compute_chunk_cache_key(url2, 2, TEST_CHUNK_SIZE)
        );
    }

    #[test]
    fn chunk_cache_key_distinguishes_chunk_index() {
        let url = "https://upos-x.bilivideo.com/path/1234.m4s?e=AAA";
        assert_ne!(
            compute_chunk_cache_key(url, 0, TEST_CHUNK_SIZE),
            compute_chunk_cache_key(url, 1, TEST_CHUNK_SIZE)
        );
    }

    #[test]
    fn chunk_cache_key_distinguishes_file() {
        let url1 = "https://upos-x.bilivideo.com/a.m4s";
        let url2 = "https://upos-x.bilivideo.com/b.m4s";
        assert_ne!(
            compute_chunk_cache_key(url1, 0, TEST_CHUNK_SIZE),
            compute_chunk_cache_key(url2, 0, TEST_CHUNK_SIZE)
        );
    }

    #[test]
    fn chunk_cache_key_distinguishes_chunk_size() {
        // 同 url + 同 chunk_index，chunk_size 不同必须产生不同 key（旧 cache 失效语义）
        let url = "https://upos-x.bilivideo.com/path/1234.m4s";
        assert_ne!(
            compute_chunk_cache_key(url, 0, 4 * 1024 * 1024),
            compute_chunk_cache_key(url, 0, 16 * 1024 * 1024)
        );
    }

    #[test]
    fn chunk_cache_key_invalid_url_falls_back_to_raw() {
        // 不抛错，给原字符串 hash
        let k1 = compute_chunk_cache_key("not-a-url", 0, TEST_CHUNK_SIZE);
        let k2 = compute_chunk_cache_key("not-a-url", 0, TEST_CHUNK_SIZE);
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

/* ========== Tauri commands（前端通过 invoke 调用） ========== */

#[derive(Debug, Clone, Serialize)]
pub struct CacheStats {
    pub current_bytes: u64,
    pub max_bytes: u64,
    pub entry_count: u64,
}

/// 返回当前缓存统计：current_bytes / max_bytes / entry_count
#[tauri::command]
pub async fn get_cache_stats(
    state: tauri::State<'_, AudioCacheState>,
) -> Result<CacheStats, String> {
    let current = *state
        .current_bytes
        .lock()
        .map_err(|e| format!("current_bytes poisoned: {}", e))?;
    let max = *state
        .max_bytes
        .lock()
        .map_err(|e| format!("max_bytes poisoned: {}", e))?;
    let count = state
        .lru
        .lock()
        .map_err(|e| format!("lru poisoned: {}", e))?
        .len() as u64;
    Ok(CacheStats {
        current_bytes: current,
        max_bytes: max,
        entry_count: count,
    })
}

const MAX_BYTES_STORE_FILE: &str = "audio_cache_settings.json";
const MAX_BYTES_STORE_KEY: &str = "audio_cache_max_bytes";
const CACHE_DIR_STORE_KEY: &str = "audio_cache_dir";
/// 容量配置硬下限（256MB）/ 上限（50GB），防止用户设极端值
const USER_CAP_MIN: u64 = 256 * 1024 * 1024;
const USER_CAP_MAX: u64 = 50 * 1024 * 1024 * 1024;

/// 修改用户容量上限，立即驱逐超量项 + 持久化到 plugin-store
#[tauri::command]
pub async fn set_cache_max_bytes<R: Runtime>(
    bytes: u64,
    state: tauri::State<'_, AudioCacheState>,
    app: AppHandle<R>,
) -> Result<CacheStats, String> {
    let clamped = bytes.clamp(USER_CAP_MIN, USER_CAP_MAX);
    {
        let mut guard = state
            .max_bytes
            .lock()
            .map_err(|e| format!("max_bytes poisoned: {}", e))?;
        *guard = clamped;
    }
    // 持久化（失败仅打日志，不影响内存生效）
    if let Err(e) = persist_max_bytes(&app, clamped).await {
        eprintln!("[audio_cache] persist max_bytes failed: {}", e);
    }
    // 立即驱逐
    evict_if_needed(state.inner()).await;
    eprintln!("[audio_cache] max_bytes updated to {}", clamped);
    get_cache_stats(state).await
}

/// 一键清空缓存：删除所有 chunks 文件 + LRU + mem_cache + 索引文件
#[tauri::command]
pub async fn clear_cache(state: tauri::State<'_, AudioCacheState>) -> Result<(), String> {
    clear_cache_internal(state.inner()).await;
    eprintln!("[audio_cache] cleared all entries");
    Ok(())
}

/// 从 plugin-store 加载用户配置的 max_bytes（启动时调）；不存在时返回 None
pub fn load_user_max_bytes<R: Runtime>(app: &AppHandle<R>) -> Option<u64> {
    use tauri_plugin_store::StoreExt;
    let store = app.store(MAX_BYTES_STORE_FILE).ok()?;
    let val = store.get(MAX_BYTES_STORE_KEY)?;
    val.as_u64()
}

async fn persist_max_bytes<R: Runtime>(app: &AppHandle<R>, bytes: u64) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;
    let store = app.store(MAX_BYTES_STORE_FILE).map_err(|e| e.to_string())?;
    store.set(MAX_BYTES_STORE_KEY.to_string(), serde_json::json!(bytes));
    store.save().map_err(|e| e.to_string())
}

/// 从 plugin-store 加载用户配置的 cache_dir；不存在 / 路径无效时返回 None
pub fn load_user_cache_dir<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    use tauri_plugin_store::StoreExt;
    let store = app.store(MAX_BYTES_STORE_FILE).ok()?;
    let val = store.get(CACHE_DIR_STORE_KEY)?;
    let s = val.as_str()?.trim().to_string();
    if s.is_empty() {
        return None;
    }
    Some(PathBuf::from(s))
}

async fn persist_cache_dir<R: Runtime>(
    app: &AppHandle<R>,
    path: Option<&str>,
) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;
    let store = app.store(MAX_BYTES_STORE_FILE).map_err(|e| e.to_string())?;
    match path {
        Some(p) if !p.trim().is_empty() => {
            store.set(CACHE_DIR_STORE_KEY.to_string(), serde_json::json!(p));
        }
        _ => {
            store.delete(CACHE_DIR_STORE_KEY);
        }
    }
    store.save().map_err(|e| e.to_string())
}

/// 当前生效的缓存目录（启动时确定，运行时不变；改路径需重启后生效）
#[tauri::command]
pub async fn get_cache_dir(state: tauri::State<'_, AudioCacheState>) -> Result<String, String> {
    Ok(state.root.to_string_lossy().to_string())
}

/// 设置自定义缓存目录：清空当前缓存 → 持久化新路径 → 提示前端重启生效
///
/// 传 null/empty 字符串表示恢复默认（删除自定义配置）。
/// 不会立即把 root 切换到新路径（避免运行时迁移复杂逻辑），重启后启动序列读取新路径。
#[tauri::command]
pub async fn set_cache_dir<R: Runtime>(
    path: Option<String>,
    state: tauri::State<'_, AudioCacheState>,
    app: AppHandle<R>,
) -> Result<(), String> {
    // 验证路径：非空时必须可创建（或已存在）；不做格式校验（Rust 跨平台 PathBuf 容错）
    if let Some(ref p) = path {
        if !p.trim().is_empty() {
            let pb = PathBuf::from(p);
            std::fs::create_dir_all(&pb)
                .map_err(|e| format!("路径不可写或无效：{}", e))?;
        }
    }
    // 先清空当前缓存（旧路径下的所有文件 + 索引），避免孤儿文件
    clear_cache_internal(state.inner()).await;
    // 持久化新路径
    persist_cache_dir(&app, path.as_deref()).await?;
    eprintln!(
        "[audio_cache] cache_dir updated (restart to take effect): {:?}",
        path
    );
    Ok(())
}

/// clear_cache 的内部实现（不带 #[tauri::command]，可被其他 command 复用）
async fn clear_cache_internal(state: &AudioCacheState) {
    let to_delete: Vec<String> = {
        let mut lru = match state.lru.lock() {
            Ok(g) => g,
            Err(_) => return,
        };
        let mut total = match state.current_bytes.lock() {
            Ok(g) => g,
            Err(_) => return,
        };
        let names: Vec<String> = lru.iter().map(|(_, e)| e.uuid.clone()).collect();
        lru.clear();
        *total = 0;
        names
    };
    if let Ok(mut g) = state.mem_cache.lock() {
        g.clear();
    }
    for uuid in &to_delete {
        let path = state.chunks_dir.join(format!("{}.bin", uuid));
        let _ = fs::remove_file(path).await;
    }
    persist_index(state).await.ok();
}
