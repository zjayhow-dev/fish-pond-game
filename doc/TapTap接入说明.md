# TapTap 适配与联调边界

## 当前证据与状态

2026-10-21 已读取当前环境的 `get_leaderboard_integration_guide` 与 `get_cloud_save_integration_guide`。无需安装 npm SDK，`tap` 由平台运行时提供。此实现没有绑定应用、创建排行榜、上传游戏或提交真实账号数据。

## 原生排行榜

在 `code/index.html` 的 `game.js` 加载前配置 `window.BICHI_TAPTAP_LEADERBOARD_ID` 为选定应用的真实排行榜 ID。`taptap-adapter.js` 会在存在 `tap.getLeaderboardManager` 时生成提供器。

- 提交：`manager.submitScores({ scores: [{ leaderboardId, score }], callback: { onSuccess, onFailure } })`。
- 打开平台榜单：`manager.openLeaderboard({ leaderboardId, collection: 'public', callback: { onSuccess, onFailure } })`。
- 指南没有给出自定义页面拉取榜单记录的客户端 API，因此没有猜测查询方法；已配置时提供“打开 TapTap 官方排行榜”按钮，平台面板自行显示真实线上内容。
- `score` 为各关最佳分数之和。最终上线前须核验平台榜单的排序、刷新周期和更新策略，并补充服务端成绩验证。

接入前应在 MCP 中先检查当前应用信息，确认应用后再查询其排行榜。不要将别的游戏当前选中项或不明 ID 自动用于本项目。

## 内部提供器契约

如果项目有经过联调的服务提供器，可在 `game.js` 前注入 `window.BICHI_TAPTAP_PROVIDER`。所有方法返回 Promise 或等价结果，且可以按能力仅实现部分方法。以下是本项目内部契约，**不是 TapTap 官方方法名**：

| 方法 | 输入 | 成功返回 |
|---|---|---|
| `loadProgress()` | 无 | `{ ok: true, save: 存档对象或null }` |
| `saveProgress(save)` | 独立拷贝的 schemaVersion=1 存档 | `{ ok: true }` |
| `getLeaderboard()` | 无 | `{ ok: true, records: Record[] }` |
| `submitScore(record)` | 单条 Record | `{ ok: true }` |
| `openLeaderboard()` | 无 | `{ ok: true }` |

Record：`{ nickname: string, score: 非负整数, level: 1..12, timestamp: 毫秒整数 }`。异常应拒绝 Promise 或返回 `{ ok: false }`。适配层默认 6 秒超时，远端返回的数据先校验再展示；所有昵称按纯文本转义。平台用户身份由提供器解析，不在存档中保存密钥。

初次启动读取云存档；仅在玩家尚未操作、仍在主菜单且云档较新时采用。解锁关卡和每关最佳分数进行取大合并；设备设置、昵称和本机榜单维持本地值。通关时串行发送云档快照，避免写入乱序。超时仅停止等待，不等于底层请求被取消，真实提供器应使用版本检查和幂等写入。

## 云存档仍需实现的部分

官方指南流程：

1. 用 `tap.getFileSystemManager().writeFile` 写入 `tap.env.USER_DATA_PATH` 下的 JSON。
2. `tap.getCloudSaveManager().createArchive` 创建档案；后续使用 `updateArchive` 更新，避免每次通关新增档案。
3. `getArchiveList` 获取档案，`getArchiveData` 下载，再用 `readFile` 读取并校验 JSON。

指南说明上传频率限制为每分钟一次且不允许并发调用，因此真实云提供器需要合并短时间内多次通关的快照，并处理重试、生命周期与冲突。目前内部队列仅保证调用顺序，**不提供原生云档案实现或每分钟节流**，不能将其直接当作平台云同步已完成。

## 上线前联调

- 使用确认过的应用与排行榜 ID，在实际 TapTap 容器验证登录、排行榜提交和打开。
- 验证回调失败、超时、网络恢复、账号切换、重复提交与服务端分数校验。
- 实现云档案提供器后验证创建／更新、频率限制、冲突合并、损坏存档与晚到响应。
- 在真实横屏设备验证入口、触控、音效解锁、页面隐藏和存储权限。

当前自动化测试使用模拟提供器覆盖成功、失败、超时、异常数据和回调契约；不代表真实平台联调通过。
