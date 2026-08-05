# 入口与调用链

打开本文件可快速定位「从哪里启动、谁调用谁」。

---

## 1. 命令入口

| 命令 | 脚本 | 结果 |
|------|------|------|
| `npm run dev` | `vite` | 本地 Web，默认 **http://127.0.0.1:5190/** |
| `npm run build` | `vite build` | 产出 `dist/`（相对路径资源） |
| `npm run preview` | `vite preview` | 预览 dist |
| `npm run cap:sync` | `build` + `cap sync ios` | Web → iOS `App/public`（口语「打包」） |
| `npm run cap:open` | `cap open ios` | 打开 Xcode |
| `npm run ios` | sync + open | 日常上机 |
| `npm run ios:bootstrap` | `scripts/bootstrap-ios.mjs` | 首次/修复 iOS + 插件 |

---

## 2. Web 启动链

```
index.html
  ├─ src/style.css
  └─ src/main.js
        ├─ installTouchHygiene()                       ← touch-hygiene.js
        │     └─ 禁多指/双击缩放/长按放大镜/选区（非 UI 控件 preventDefault）
        ├─ applyNativeClass() / applyShellLayout()     ← viewport.js
        ├─ createRenderer({ container: #stage })       ← create-renderer.js
        │     └─ three/webgpu WebGPURenderer
        ├─ createNativeHaptics()                       ← native-haptics.js
        ├─ createGame({ stage, hud, renderer, haptics })  ← game/game.js
        │     ├─ grid / puzzle generator / score / view / layout
        │     ├─ tray-layout.js（候选区几何 · rubber）
        │     ├─ feel/drag-session · ghost-policy · haptics-ghost
        │     ├─ tray 状态机：点转/横滑/长按·上滑拖；占位洞；盘上摘块
        │     ├─ 仅 isPrimary 指针
        │     ├─ puzzle-fill：填满空洞 → 全盘消除 → 下一关
        │     └─ clearFx / boardRevealFx / game-over
        ├─ createFeelPanel({ onChange → game.applyTune })
        │     ├─ 右上角设置齿轮
        │     └─ 面板内手感1/2 ← feel-presets.js（默认手感1）+ 滑条
        └─ bindShellResize / scheduleStableLayout
```

**改玩法：** `src/game/*`。  
**改解密关卡：** `src/game/puzzle/generator.js` + `docs/PUZZLE-LEVEL-DESIGN.md`。  
**改候选区：** `tray-layout.js` / `game.js` + **`docs/TRAY-INTERACTION-SPEC.md`**。  
**保留：** `create-renderer.js` / `viewport.js` / `native-haptics.js` 契约。

调试入口：

| URL | 用途 |
|-----|------|
| `/` | 从第 1 关开始 |
| `/?level=7` | 直接进入第 7 关 |
| `/?editor=1&level=7` | 关卡编辑模式，编辑第 7 关 mask |

---

## 3. DOM 入口

```html
#letterbox
  #phone-frame          ← getFrameSize() 量这里
    #stage              ← canvas 父节点
    #hud                ← 分数等安全区 UI（不含全屏结算）
    .game-over[data-game-over]       ← 全屏半透结算 + Play Again
    #feel-panel         ← 右上角设置 + 底部 sheet（动态挂载）
```

| 选择器 / data | 谁写入 | 谁读取 |
|---------------|--------|--------|
| `#stage` | `createRenderer` append canvas | 无 |
| `#phone-frame` | CSS / `applyShellLayout` | `getFrameSize` · feel-panel mount · overlay 根 |
| `#hud` | game HUD 分数 | CSS safe padding |
| `[data-game-score]` | `game.js` syncHud | 展示 |
| `[data-best-score]` | `game.js` syncHud | 展示历史最高分 |
| `[data-level-editor]` | `game.js` editor mode | 关卡 mask 编辑器 |
| `[data-death-flash]` | `game.js` setDeathFlash | CSS 动画 `.is-active` |
| `[data-game-over]` | `game.js` setGameOver | 可见性 / 锁输入 |
| `[data-final-score]` | `game.js` startDeathFx | 展示本局分 |
| `[data-restart]` | 用户点击 | `game.js` restart |
| `#feel-panel` | `createFeelPanel` | 设置齿轮 · 手感1/2 · 滑条；指针 stopPropagation |
| `.feel-panel-fab` | 设置入口（右上角） | 展开/收起 sheet |
| `.feel-preset-bar` | 面板内手感1/2 | 点击切换 · 长按存槽 |
| `body.native-app` | `applyNativeClass` | CSS 真机规则 |

**注意：** death-flash / game-over **不要**塞回 `#hud`，否则安全区内边距与「全屏盖住盘面」会冲突。

---

## 4. iOS 原生入口

```
Xcode Run
  → AppDelegate
  → Main.storyboard → BridgeViewController (CAPBridgeViewController)
       → capacitorDidLoad
            → registerPluginInstance(NativeHapticsPlugin)
            → hardenWebViewTouches()   ← 关 pinch / 双击 zoom / 长按 / 滚动弹性
       → viewDidAppear → 再 harden 一次（手势晚挂）
       → 加载 App/public/index.html（= dist 同步结果）
            → 同上 Web 启动链
```

真机 Swift 真源：`plugins/native-haptics/BridgeViewController.swift`（bootstrap 复制进 `ios/`）。

插件方法名（JS ↔ Swift）：

| JS | Swift `@objc` |
|----|----------------|
| `prepare` | `prepare` |
| `playTransient` | `playTransient` |
| `startContinuous` | `startContinuous` |
| `updateContinuous` | `updateContinuous` |
| `stopContinuous` | `stopContinuous` |

---

## 5. 配置入口

| 要改… | 改这个文件 |
|--------|------------|
| 端口 / base / 构建目标 | `vite.config.js` |
| Bundle ID / 应用名 / contentInset | `capacitor.config.json` |
| 设计分辨率 / 桌面 safe 模拟 | `src/viewport.js` **且** `src/style.css` |
| 启动页文案 / HUD / 结算结构 | `index.html` + `style.css` |
| 震动原生实现 | `plugins/native-haptics/NativeHapticsPlugin.swift` 后 bootstrap |
| WKWebView 触控硬化 | `plugins/native-haptics/BridgeViewController.swift` 后 bootstrap |
| 触控卫生（Web） | `src/touch-hygiene.js`（`main.js` 启动时安装） |
| 解密关卡生成 | `src/game/puzzle/generator.js` |
| tray / 棋盘几何 | `src/game/layout.js` + `defaults.js` 布局常量 |
| App Icon | `assets/icon-1024.png` → 同步 iOS `AppIcon` 资源 |
| 忽略规则 | `.gitignore` |

---

## 6. 文档入口（给「每个新窗口」）

| 读者 | 先读 |
|------|------|
| AI Agent / 新 Cursor·Grok 会话 | **[AGENTS.md](../AGENTS.md)** |
| 人类第一次 clone | **[README.md](../README.md)** |
| 文档地图 | **[README.md](./README.md)**（docs 索引） |
| 深挖设计/坑 | **[ENGINEERING.md](./ENGINEERING.md)** |
| 解密关卡制作 | **[PUZZLE-LEVEL-DESIGN.md](./PUZZLE-LEVEL-DESIGN.md)** |
| 只查入口链 | **本文件** |
| 震动插件 alone | [plugins/native-haptics/README.md](../plugins/native-haptics/README.md) |
