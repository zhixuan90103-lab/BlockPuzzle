# 变更记录

按时间倒序。只记产品/架构向变更。  
细节以代码与对应 SSOT 为准：`defaults.js` · [TRAY-INTERACTION-SPEC](./TRAY-INTERACTION-SPEC.md) · [GHOST-POLICY](./GHOST-POLICY.md) · [PUZZLE-LEVEL-DESIGN](./PUZZLE-LEVEL-DESIGN.md)。

---

## 2026-08-05 · 体验收尾（震动 · 分数 · 投影 · 手势）

### 投影换格

- 空地/贴块 leave 略降：`OPEN_SNAP` 0.42 · `BLOCK_HOLD` 0.72 · `MAX_LAG` 1.35  
- **soft-follow**：free 更靠近合法邻格时提前换影（半卡住向空侧更快）  
- 文档：[GHOST-POLICY.md](./GHOST-POLICY.md)

### 旋转震动

- 点击旋转瞬态 `ghostHaptics.onRotate()`  
- 强度默认同影格移动：`FEEL_HAPTIC_ROTATE_*`（≈ `FEEL_HAPTIC_GHOST_*`）

### 分数 HUD

- 字号 65→48（真机 CSS 更小）、下移 0.06→0.01、顶栏占位 0.11→0.13  
- 避免真机分数压住棋盘

### 候选区手势

- 在块上 **明显上移（朝棋盘）禁止切入横滑**（边缘斜拖误滚）  
- 横滑 slop/轴锁收紧；上滑/斜上拖优先  
- 未落盘取消：原槽 **null 占位** + **scroll 还原**  
- 回 tray 仅手指在候选区；插回 **homeTrayIndex**  
- 已移除过敏的中途 flick 甩回

---

## 2026-08-05 · 候选区交互主迭代

### 玩法 / 操作

- 候选区 **点转 · 横滑 · 长按拖 / 上滑拖**（Q15 保留上滑）  
- 布局：**3.5 可见**、少块居中、`TRAY_SLOT_GAP_FRAC` 间距  
- 滚动：逻辑 + 视觉双轨、`visualScrollX` 永远 rubber/clamp；惯性 px/s；欠阻尼软回弹  
- 盘上摘块：抬起姿势与 tray 一致（`createDragSession` + `FEEL_DRAG_OFFSET_*`）  
- 落盘成功后压实列表  

### 工程

- 新增 `src/game/tray-layout.js`  
- `view` 只消费 `trayDraws`  
- `touch-hygiene.js` + `BridgeViewController`：禁放大镜 / 多指 / 选区  
- 文档：`TRAY-INTERACTION-SPEC.md` 为候选区实现 SSOT；检索 PLAN/FINDINGS 标为档案  

---

## 更早

- 解密消除关卡模式（puzzle fill）、生成器、通关消除与过场 → `PUZZLE-LEVEL-DESIGN.md`  
- Three.js WebGPU + Capacitor iOS + NativeHaptics → `ENGINEERING.md`  
- 工作区 `research/`：Classic 立项检索归档  

---

## 文档 / 代码对照（当前）

| 主题 | SSOT 文档 | 主代码 |
|------|-----------|--------|
| 候选区手势/滚动/占位 | TRAY-INTERACTION-SPEC | `tray-layout.js` · `game.js` · `view.js` |
| 投影换格 | GHOST-POLICY | `feel/ghost-policy.js` |
| 关卡生成 | PUZZLE-LEVEL-DESIGN | `puzzle/generator.js` |
| 启动链 / 打包 | ENTRYPOINTS | `main.js` · Capacitor |
| 常量 | — | `defaults.js` |
