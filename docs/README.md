# 项目文档索引

> **规范**：以代码为准；文档描述行为与决策，常量数值以 `src/game/defaults.js` 为真源。  
> 工程根：`three-webgpu-cap-shell/` · 远程：`zhixuan90103-lab/BlockBlast_New`  
> 文档整理：**2026-07-31**（投影方法收敛 · 连拿/消行 · 对象池 · 笔记 **§16–§17**）

## 阅读顺序（建议）

| 角色 | 路径 |
|------|------|
| **AI / 新窗口** | [../AGENTS.md](../AGENTS.md) → 本索引 → 按需下钻 |
| **人类上手** | [../README.md](../README.md) → ENTRYPOINTS |
| **改手感 / 消行 / 震动 / 死亡** | [FEEL-DESIGN.md](./FEEL-DESIGN.md) |
| **改投影** | **[GHOST-DESIGN.md](./GHOST-DESIGN.md)**（唯一行为 SSOT） |
| **改发块** | **[DEAL-PUSH-COMPLETE.md](./DEAL-PUSH-COMPLETE.md)** |
| **踩坑与迭代史** | [PROJECT-HISTORY.md](./PROJECT-HISTORY.md)（最新 **§17**） |
| **底座 / Capacitor** | [ENGINEERING.md](./ENGINEERING.md) |
| **常量快照** | [RUNTIME-DEFAULTS.md](./RUNTIME-DEFAULTS.md) → **以 defaults.js 为准** |

## 文档地图

| 文档 | 内容 | 何时更新 |
|------|------|----------|
| [ENTRYPOINTS.md](./ENTRYPOINTS.md) | 命令、DOM、Web/iOS 启动链 | 入口、UI 壳变更 |
| [ENGINEERING.md](./ENGINEERING.md) | WebGPU、Capacitor、Safe Area、插件 | 底座约定变更 |
| [FEEL-DESIGN.md](./FEEL-DESIGN.md) | 手感摘要 P1–P24；投影仅摘要 | 手感/布局迭代 |
| [GHOST-DESIGN.md](./GHOST-DESIGN.md) | **投影 SSOT**：Bug→设计、8 向、0.5/1.0/1.3、验收 | **改投影必更** |
| [DEAL-PUSH-COMPLETE.md](./DEAL-PUSH-COMPLETE.md) | 发块完整规格 | 发块变更 |
| [SUPER-BLOCKS.md](./SUPER-BLOCKS.md) | 解密消除基础块（4 色 16 块） | 基础块形状/颜色变更 |
| [DEAL-SPEC.md](./DEAL-SPEC.md) / [DEAL-DESIGN.md](./DEAL-DESIGN.md) | 发块摘要/指针 | 行为变更时同步 |
| [PROJECT-HISTORY.md](./PROJECT-HISTORY.md) | 项目笔记（追加节） | 大迭代后追加 |
| [RUNTIME-DEFAULTS.md](./RUNTIME-DEFAULTS.md) | defaults 摘录 | 改 defaults 后择机同步 |

## 代码真源

| 领域 | 路径 |
|------|------|
| 常量 | `src/game/defaults.js` |
| 调参 | `tune.js` · `feel-panel.js` · `feel-presets.js` |
| 投影决策 | `feel/ghost-policy.js` · [GHOST-DESIGN](./GHOST-DESIGN.md) |
| 拖拽/抬升 | `feel/drag-session.js` |
| 渲染/池/消行 FX | `view.js` · `block-mesh.js` |
| 编排（连拿、消行队列） | `game.js` |
| 发块 | `deal/*`（`pipeline.js`） |
| 震动 | `feel/haptics-ghost.js` · `native-haptics.js` |

## 文档约定

1. 现象 → 原因 → 调整 写入 HISTORY / FEEL，避免只写「改了某某」。  
2. **禁止**多处复制大段默认数值；摘要以 defaults 为准。  
3. 口语「打包」= `cap:sync` → `xcodebuild` 真机 → `devicectl install/launch`。  
4. 改投影：**先 GHOST-DESIGN，再 ghost-policy**。  
5. 改手感/消行/死亡/震动/布局：**FEEL-DESIGN** + HISTORY 追加。  
6. 改发块：**DEAL-PUSH-COMPLETE**。  
7. Web 与 iOS 同构 `src/`；仅原生震动与 WKWebView 硬化在 iOS。  

## 近期主题速查

| 主题 | 文档 | 代码 |
|------|------|------|
| **投影方法（8 向 · 0.5/1.0/1.3 · 斜向中间态）** | GHOST §一–§六 · HISTORY **§16–§17** | `ghost-policy.js` |
| 放下可连拿 · 消行中可摆 · exact clear | HISTORY §17 · RUNTIME 输入锁 | `game.js` · `grid.clearExactCells` |
| 对象池 / 阴影透明 | HISTORY §14 | `view.js` · `block-mesh.js` |
| 设置 UI · 触控 · tray 区高 | FEEL §5/§11 · HISTORY §13 | `feel-panel` · `touch-hygiene` |
| 3 波消震 · 屏震 · debris · 死亡 | FEEL §3–§8 · HISTORY §12 | `haptics-ghost` · `view` · deathFx |
| 发块 Intent | DEAL-PUSH-COMPLETE | `deal/*` |
