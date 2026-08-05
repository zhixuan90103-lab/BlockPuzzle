# 项目文档索引

> **规范**：以代码为准；行为文档描述决策，**数值以 `src/game/defaults.js` 为真源**。  
> 工程根：`three-webgpu-cap-shell/` · 远程：`zhixuan90103-lab/BlockPuzzle`  
> 文档整理：**2026-08-05**（候选区 SPEC · 投影摘要 · CHANGELOG 收束）

## 阅读顺序（建议）

| 角色 | 路径 |
|------|------|
| **AI / 新窗口** | [../AGENTS.md](../AGENTS.md) → 本索引 → 按任务下钻 |
| **人类上手** | [../README.md](../README.md) → ENTRYPOINTS |
| **改解密关卡** | **[PUZZLE-LEVEL-DESIGN.md](./PUZZLE-LEVEL-DESIGN.md)** |
| **改候选区 / 拖放 / 滚动** | **[TRAY-INTERACTION-SPEC.md](./TRAY-INTERACTION-SPEC.md)** |
| **改投影换格** | **[GHOST-POLICY.md](./GHOST-POLICY.md)** |
| **底座 / Capacitor / 触控** | [ENGINEERING.md](./ENGINEERING.md) · [ENTRYPOINTS.md](./ENTRYPOINTS.md) |
| **查改了什么** | [CHANGELOG.md](./CHANGELOG.md) |

新窗口最少三份：

1. [../AGENTS.md](../AGENTS.md)  
2. [PUZZLE-LEVEL-DESIGN.md](./PUZZLE-LEVEL-DESIGN.md) 或 [TRAY-INTERACTION-SPEC.md](./TRAY-INTERACTION-SPEC.md)（按任务）  
3. [ENTRYPOINTS.md](./ENTRYPOINTS.md)  

---

## 文档地图

| 文档 | 内容 | 何时更新 |
|------|------|----------|
| [ENTRYPOINTS.md](./ENTRYPOINTS.md) | 命令、DOM、Web/iOS 启动链 | 入口、UI 壳变更 |
| [ENGINEERING.md](./ENGINEERING.md) | WebGPU、Capacitor、Safe Area、插件 | 底座约定变更 |
| [PUZZLE-LEVEL-DESIGN.md](./PUZZLE-LEVEL-DESIGN.md) | 解密关卡：难度、颜色、生成、动画 | 关卡/生成器变更 |
| **[TRAY-INTERACTION-SPEC.md](./TRAY-INTERACTION-SPEC.md)** | **候选区实现 SSOT**：手势、scroll、占位洞、盘上摘块 | **改 tray 必更** |
| **[GHOST-POLICY.md](./GHOST-POLICY.md)** | **投影换格摘要**：leave / soft-follow / 常量 | **改投影必更** |
| [CHANGELOG.md](./CHANGELOG.md) | 产品/架构变更摘要 | 大迭代后追加 |
| [SUPER-BLOCKS.md](./SUPER-BLOCKS.md) | 基础块形状池 | 形状变更 |
| [TRAY-INTERACTION-RESEARCH-PLAN.md](./TRAY-INTERACTION-RESEARCH-PLAN.md) | 检索计划（**档案**） | 一般不再改 |
| [TRAY-INTERACTION-RESEARCH-FINDINGS.md](./TRAY-INTERACTION-RESEARCH-FINDINGS.md) | 检索结论（**档案**） | 一般不再改 |

---

## 代码真源

| 领域 | 路径 |
|------|------|
| 常量 | `src/game/defaults.js` |
| 候选区几何 / rubber | `src/game/tray-layout.js` |
| 编排（关卡 · tray · 盘上摘块） | `src/game/game.js` |
| 拖拽跟手 | `src/game/feel/drag-session.js` |
| 投影 | `src/game/feel/ghost-policy.js` |
| 绘制 | `src/game/view.js` · `block-mesh.js` |
| 关卡生成 | `src/game/puzzle/generator.js` |
| 触控卫生 | `src/touch-hygiene.js` · `plugins/native-haptics/BridgeViewController.swift` |
| 调参 UI | `tune.js` · `feel-panel.js` · `feel-presets.js` |
| 震动 | `feel/haptics-ghost.js` · `native-haptics.js` |

---

## 文档约定

1. **SSOT 分层**：玩法规格文档 → 代码；禁止多处复制大段默认数值。  
2. 改候选区 → **TRAY-INTERACTION-SPEC** + defaults/tray-layout/game。  
3. 改投影 → **GHOST-POLICY** + `feel/ghost-policy.js` + `FEEL_GHOST_*`。  
4. 改关卡生成 → **PUZZLE-LEVEL-DESIGN** + `puzzle/generator.js`。  
5. 口语「打包」= `npm run cap:sync` → `xcodebuild` 真机 → `devicectl install/launch`。  
6. Web 与 iOS 同构 `src/`；仅原生震动与 WKWebView 硬化在 iOS。  
7. 大迭代后 **CHANGELOG** 追加一节；检索 PLAN/FINDINGS 为档案，避免与 SPEC 双真源。  

---

## 近期主题速查

| 主题 | 文档 | 代码 |
|------|------|------|
| 候选区手势 / 滚动 / 占位洞 | **TRAY-INTERACTION-SPEC** | `tray-layout.js` · `game.js` · `view.js` |
| 盘上摘块 · 回 tray 原位 | SPEC §4–§5 | `game.js` |
| 投影换格 / soft-follow | **GHOST-POLICY** | `feel/ghost-policy.js` |
| 旋转震动 · 影格震动 | CHANGELOG · defaults | `feel/haptics-ghost.js` |
| 分数 HUD | CHANGELOG · defaults · style.css | `game.js` applyScoreUi |
| 触控 / 放大镜 | SPEC · ENGINEERING | `touch-hygiene.js` · BridgeViewController |
| 解密关卡 | PUZZLE-LEVEL-DESIGN | `puzzle/generator.js` · `game.js` |
| 变更总表 | **CHANGELOG** | — |
