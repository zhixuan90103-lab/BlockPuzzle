# Puzzle Clear（three-webgpu-cap-shell）

**8×8 解密消除原型**：Three.js + **WebGPU** + Vite + **Capacitor iOS** + 自研 **NativeHaptics**。  
当前玩法是有限块拼图：玩家用下方候选块填满盘面空洞，满盘后从最后落块位置扩散消除，并进入下一关。

桌面预览使用 **手机比例框（393×852）**；真机 App 全屏 + 系统 Safe Area。

---

## 文档入口（请按角色阅读）

| 文档 | 给谁 | 内容 |
|------|------|------|
| **[AGENTS.md](./AGENTS.md)** | AI / 新窗口 | 一页纸：入口、约定 |
| **[docs/README.md](./docs/README.md)** | 所有人 | **文档索引与规范** |
| **[docs/PUZZLE-LEVEL-DESIGN.md](./docs/PUZZLE-LEVEL-DESIGN.md)** | 改关卡/生成器 | 解密关卡制作规范 |
| **[docs/TRAY-INTERACTION-SPEC.md](./docs/TRAY-INTERACTION-SPEC.md)** | 改候选区/拖放 | **候选区实现 SSOT** |
| **[docs/GHOST-POLICY.md](./docs/GHOST-POLICY.md)** | 改投影换格 | leave / soft-follow |
| **[docs/CHANGELOG.md](./docs/CHANGELOG.md)** | 查近期改动 | 变更摘要 |
| **[docs/ENTRYPOINTS.md](./docs/ENTRYPOINTS.md)** | 查启动链 | 命令 / DOM / iOS |
| **[docs/ENGINEERING.md](./docs/ENGINEERING.md)** | 维护底座 | Capacitor / WebGPU |
| **本 README** | 人类上手 | 安装、dev、真机 |

> 新会话：**AGENTS.md → docs/README.md**，再按任务下钻。

---

## 本机路径

```text
/Users/wangzhixuan/Documents/Threejs_Work/BlockBlast_2/three-webgpu-cap-shell
```

---

## 30 秒上手

```bash
cd three-webgpu-cap-shell
npm install
npm run dev
# → http://127.0.0.1:5190/
```

应看到：竖屏框内的 8×8 解密盘面、Best HUD、**右上角设置**（齿轮）。
普通入口从第 1 关开始。调试指定关卡可用 `?level=7`，关卡编辑器可用 `?editor=1&level=7`。

---

## 代码入口（最短）

```text
index.html
  └─ src/main.js
       ├─ installTouchHygiene()  ← 禁双指/双击缩放/长按菜单
       ├─ createGame()           ← src/game/game.js
       ├─ createFeelPanel()      ← 右上角设置 + 手感预设 + 滑条
       ├─ viewport / renderer / haptics
```

DOM 约定（勿拆）：

```text
#letterbox > #phone-frame > (#stage | #hud | death-flash | game-over | #feel-panel)
```

- `#stage`：3D canvas  
- `#hud`：分数与安全区 UI  
- `[data-game-over]`：全屏结算  
- `#feel-panel`：右上角设置入口；面板内含手感1/2 与调参  

---

## 功能快照（与文档对齐）

| 域 | 要点 |
|----|------|
| 操作 | **点转 · 横滑 · 长按/上滑拖**；盘上摘块可换位；**松在候选区**回 tray 原槽 |
| 取消拖 | 未落盘：原槽占位洞 + scroll 还原（见 TRAY-INTERACTION-SPEC） |
| 关卡 | 统一块池；颜色只做视觉；块数随关卡递进 |
| 颜色 | 盘面统一主色系；候选块跳脱色 |
| 投影 | 8 向 leave（ghost-policy）；细节以代码为准 |
| 消除 | 满盘后全盘收集；从最后落块中心扩散 |
| 生成 | 新关从四周到中心生成 |
| 候选区 | 约 3.5 可见 + 槽间距；软回弹；`tray-layout.js` |
| 震动 | 业务曲线 + iOS NativeHaptics |
| 调参 | 右上角设置 · 手感1/2（`defaults.js` 真源） |
| 触控 | 禁双指/双击缩放/长按放大镜（Web + WK 桥） |

---

## iOS 真机

```bash
# 首次（或插件/工程损坏时）
npm run ios:bootstrap
npm run cap:open

# 日常（口语「打包」）
npm run cap:sync    # build + sync → ios/App/App/public
# 然后：Xcode 选真机 ⌘R
# 或：xcodebuild（iphoneos）+ xcrun devicectl device install/launch
```

| 配置点 | 位置 |
|--------|------|
| Bundle ID / 名 | `capacitor.config.json` → `appId` / `appName` |
| 相对资源路径 | `vite.config.js` → `base: './'` |
| 无双重 Safe Area | `ios.contentInset: "never"` |
| 震动原生真源 | `plugins/native-haptics/*.swift` |
| App Icon | `assets/icon-1024.png` |

占位 ID：`com.example.webgpushell` —— 长期开发请改成自己的。

---

## npm scripts

| 脚本 | 作用 |
|------|------|
| `dev` | Vite 开发服务器（5190） |
| `build` | 产出 `dist/` |
| `cap:sync` | build + 同步到 ios |
| `cap:open` | 打开 Xcode |
| `ios` | sync + open |
| `ios:bootstrap` | 添加/修复 iOS 工程并注入 NativeHaptics |

---

## 复用到新游戏

1. 复制整个 `three-webgpu-cap-shell` 目录  
2. 改 `appId` / `appName`，必要时重 init git  
3. 在 `src/main.js`（或 `src/game/*`）写玩法  
4. **保留** renderer / viewport / haptics / plugins / `base: './'`  

业务侧震动节奏（连击、反馈强弱等）写在游戏层，用 `createNativeHaptics()` 组合调用。

---

## 硬性约定（摘要）

1. Capacitor 必须用相对路径：`base: './'`  
2. UI 进 `#hud`，安全区用 `--safe-*`；全屏 overlay 挂 `#phone-frame`  
3. 渲染尺寸跟 `#phone-frame`，不要裸用整窗 `innerWidth`  
4. 无 WebGPU 则明确失败，不静默 WebGL  
5. 改 Swift 插件改真源后跑 `ios:bootstrap`  

细节与踩坑见 [docs/ENGINEERING.md](./docs/ENGINEERING.md)。

---

## License / 归属

私有脚手架；Three.js 与 Capacitor 遵循其各自许可证。
