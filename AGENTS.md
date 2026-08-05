# AGENTS.md — 给 AI / 新窗口的工程说明

> **本文件是打开本仓库时的第一入口。**  
> 文档索引：[docs/README.md](./docs/README.md) · 人类上手：[README.md](./README.md)

## 一句话

**8×8 解密消除原型**，技术底座为 **Three.js WebGPU + Vite + Capacitor iOS + NativeHaptics**。  
目标是验证「有限候选块填洞」的关卡体验、操作手感与消除/生成表现。**Web 与真机共用同一套 `src/`。**

## 当前玩法快照

- 棋盘固定 8×8；深色空洞为本关目标。
- 下方候选块随关卡递增；**点转 · 横滑 · 长按/上滑拖**；可拖回 tray。
- 空洞填满 → 全盘收集消除 → 下一关。
- 颜色只做视觉；分数/Best 本地累计。

## 文档从哪读

| 优先 | 文档 |
|------|------|
| 1 | 本文件 + [docs/README.md](./docs/README.md) |
| 2 关卡 | [docs/PUZZLE-LEVEL-DESIGN.md](./docs/PUZZLE-LEVEL-DESIGN.md) |
| 2 候选区/拖放 | **[docs/TRAY-INTERACTION-SPEC.md](./docs/TRAY-INTERACTION-SPEC.md)** |
| 2 投影换格 | **[docs/GHOST-POLICY.md](./docs/GHOST-POLICY.md)** |
| 3 底座 | [docs/ENGINEERING.md](./docs/ENGINEERING.md) · [docs/ENTRYPOINTS.md](./docs/ENTRYPOINTS.md) |
| 4 变更 | [docs/CHANGELOG.md](./docs/CHANGELOG.md) |

**常量真源**：`src/game/defaults.js`。  
**候选区几何**：`src/game/tray-layout.js`。

## 入口地图

| 职责 | 文件 |
|------|------|
| Web 启动 | `index.html` → `src/main.js` → `installTouchHygiene` → `createGame` |
| 规则编排 | `src/game/game.js`（关卡 · tray 状态机 · 盘上摘块 · 通关） |
| 候选区几何 | `src/game/tray-layout.js` |
| 关卡生成 | `src/game/puzzle/generator.js` |
| 拖拽跟手 | `src/game/feel/drag-session.js` |
| 投影 | `src/game/feel/ghost-policy.js`（view 只画） |
| 渲染 / FX | `src/game/view.js` · `block-mesh.js` · `layout.js` |
| 常量 / 调参 | `defaults.js` · `tune.js` · `feel-panel.js` |
| 触控卫生 | `src/touch-hygiene.js` · `plugins/native-haptics/BridgeViewController.swift` |
| WebGPU | `src/create-renderer.js` |
| 视口 | `src/viewport.js` · `style.css` |
| 震动 | `native-haptics.js` · `feel/haptics-ghost.js` · `plugins/native-haptics/*.swift` |

## 常用命令

```bash
npm install
npm run dev          # http://127.0.0.1:5190/
npm run build
npm run cap:sync     # 口语「打包」：build + cap sync ios
npm run cap:open
# 真机：xcodebuild -scheme App -destination 'id=<UDID>' build
#       xcrun devicectl device install app --device <UDID> <App.app>
#       xcrun devicectl device process launch --device <UDID> com.example.webgpushell
```

## 硬性约定

1. Vite **`base: './'`**；**`webDir: "dist"`**。  
2. **`ios.contentInset: "never"`**，Safe Area 用 CSS `env(...)`。  
3. UI 在 `#hud`；3D 在 `#stage`；overlay / 设置在 `#phone-frame`。  
4. **仅主指针**；`touch-hygiene` + 原生桥关闭缩放/放大镜/选区。  
5. 候选区：**绘制只认 `trayDraws`**；scroll 绘制用 `visualScrollX`（见 SPEC）。  
6. 拖起未落盘：原槽 **null 占位** + 取消 **restore scroll**（见 SPEC）。  
7. 圆角几何共享模板勿 dispose；filled/ghost/debris 对象池。  
8. 文档：关卡 → PUZZLE-LEVEL-DESIGN；tray → **TRAY-INTERACTION-SPEC**；投影 → **GHOST-POLICY**；入口 → ENTRYPOINTS。  

## DOM

```
#letterbox > #phone-frame
              ├ #stage
              ├ #hud
              ├ [data-game-over]
              └ #feel-panel          ← 右上角设置 · 手感1/2 + 滑条
```

## 新会话建议

1. 读本文件 + `docs/README.md`  
2. 动 tray → **TRAY-INTERACTION-SPEC**；动投影 → **GHOST-POLICY**；动关卡 → PUZZLE-LEVEL-DESIGN  
3. `npm run dev` 或 `cap:sync` 真机  
4. 默认手感槽 = **手感1**（= defaults）  

## 刻意边界

- 不商业化（商店/广告/账号）  
- 候选块可旋转、不可翻转；无重力  
- 无 Android 优先；无 WebGL 静默回退  
