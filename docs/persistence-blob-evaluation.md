# player_data 大 Blob 拆分评估

> 决策文档（非实施）。Phase 7 批 8 产出。

## 现状

`packages/shared/src/store/middleware/persist.ts` 把 7 个 store 的快照合并到单一 storage entry：

```
storage[player_data] = JSON.stringify({
  bili_videos:       { ids, entities },
  bili_user_videos:  { isLoading: false, infos, space, favFolders },
  playing_list:      { favId, bvIds, current },
  fav_list:          { list },
  ui_profile:        { theme, volume, autoPlay, loopMode },
  lyrics:            { lyricMaps },
  cloud_service:     { session },
})
```

写盘节流 1000ms（`PERSIST_THROTTLE_MS`），写入路径：
1. 任一 store 触发订阅 → `scheduleFlush`（dirty-flag + microtask 合并）
2. microtask 内 `collectPersistableSnapshot()` 遍历 7 个 store
3. `persistState(snapshot)` 走 trailingThrottle → 1000ms 后 `JSON.stringify(data)`、`storage.setItem`

读出路径（启动一次性）：
1. `storage.getItem('player_data')` → `JSON.parse` 整块
2. 逐 store 调 `entry.hydrate(snapshot[entry.key])`

## 风险点

### 1. 写盘 stringify 开销 O(整库)

每次节流窗口尾，`JSON.stringify` 必须重新序列化全部 7 个 store。即使只改动 `playing_list.current`，也会 stringify `bili_videos.entities`（重度用户上千条 BV 详情）。

**实测估算**：
- 单条 `BilibiliVideo` 平均 ~600 字节（aid/bvid/title/pic/created/length/play/comment/author/description）
- 重度 UP 主追投稿用户：3000 条 → ~1.8 MB JSON
- `JSON.stringify` 性能：浏览器原生约 100-200 MB/s → 单次约 10-20ms
- 节流 1000ms 内最多触发 1 次写盘 → CPU 占比 1-2%（可接受）

### 2. 启动 JSON.parse 主线程阻塞

启动时 `JSON.parse(raw)` 同步执行，1.8 MB 数据约 8-15ms。这发生在 `bootstrapPersistence` 内，**早于首屏渲染**，会影响 TTI（Time-to-Interactive）。

### 3. Chrome storage.local 单 entry 上限

Chrome 扩展 `chrome.storage.local` 单 entry 默认无硬上限（受总配额 5MB 限制，可申请 unlimitedStorage 解除）。但**单次 set/get 大对象会序列化到 IPC**，超过几 MB 时性能下降明显。

### 4. 写入失败原子性

当前模式：单 entry 全量写。中途失败（quota exceeded / IO error）→ 整块数据丢失，不能部分回滚。按 key 拆分后失败仅影响单个 key。

## 拆分方案

### 方案 A：按 PERSIST_KEYS 拆分为 7 个独立 entry

```
storage[player_data:bili_videos]      = stringify({ ids, entities })
storage[player_data:playing_list]     = stringify({ favId, bvIds, current })
... 7 个独立 key
```

**优点**：
- `JSON.stringify` 仅对脏 key 执行 → 改 `playing_list` 不再 stringify `bili_videos`
- 启动时按需并行 `Promise.all` 读取 → IPC 并发更友好
- 单 key 失败不影响其他 key

**代价**：
- 7 次 `storage.setItem` 替代 1 次 → IPC 调用增加（Chrome `storage.local.set({...all})` 仍可一次写完）
- 需要维护"哪个 store 脏"的标记位（不再用 `dirty: bool`，改 `dirtyKeys: Set<string>`）
- 数据迁移：旧用户的 `player_data` 单 entry 需要在启动时一次性拆分，再删除旧 entry

### 方案 B：bili_videos.entities 单独拆出

仅把"最大头部"`bili_videos.entities` 单独拆为 `player_data:bili_videos_entities`，其余 6 个仍合并。

**优点**：
- 改动小（只新增 1 个 key）
- 解决 80% 的 stringify 性能问题

**代价**：
- 拆分粒度不彻底（`bili_user_videos.infos` 也可能膨胀，未覆盖）
- 维护两套写入路径（合并 + 分离）

## 触发阈值（建议）

| 指标 | 阈值 | 触发动作 |
|---|---|---|
| 单用户 `bili_videos.entities` 条数 | > 2000 | 启动 JSON.parse > 10ms，启用方案 B |
| 单用户合并 player_data 体积 | > 3 MB | IPC 序列化压力大，启用方案 A |
| 节流窗口内 stringify 平均耗时 | > 30ms | 主线程明显卡顿，启用方案 A |

## 当前决策（v2.0 GA）

**不实施拆分**。理由：
1. 当前 plans 测试覆盖均基于 ~10-20 条 mock 数据，未触发性能阈值
2. 真实重度用户（订阅 30+ UP 主）数据量在 1-2 MB 区间，主线程影响 < 20ms（可接受）
3. 拆分涉及数据迁移、双写过渡、回滚机制，工程量大于当前收益
4. 已通过 dirty-flag + microtask 优化（Phase 7 批 7）消除"每次 setState 都重新收集快照"的重复开销

## 后续监控

待 v2.0 GA 后，加入指标采集（可选）：
- 启动时 `bootstrapPersistence` 总耗时 → 性能埋点
- 单次 `persistState` 内 `JSON.stringify` 耗时 → 性能埋点
- player_data 写入字节数 → 估算用户数据量分布

观察 30 天数据，达到上述阈值的用户占比 > 1% 时再启动方案 A。

---

*本文档作为 plans/tasks.md §7.2 "player_data 大 blob 拆分评估" 的决策依据。*
