# 候选区交互规格（实现 SSOT）

> **状态**：已实现 · 2026-08-05  
> **常量真源**：`src/game/defaults.js`（`TRAY_*` / 部分 `FEEL_*`）  
> **几何真源**：`src/game/tray-layout.js`  
> **编排**：`src/game/game.js`  
> **绘制**：`src/game/view.js`（只消费 `trayDraws`）  
> **检索档案**（设计过程，非实现真源）：[TRAY-INTERACTION-RESEARCH-PLAN.md](./TRAY-INTERACTION-RESEARCH-PLAN.md) · [TRAY-INTERACTION-RESEARCH-FINDINGS.md](./TRAY-INTERACTION-RESEARCH-FINDINGS.md)

改候选区行为：**先改本文 + defaults/tray-layout，再改 game/view**。

---

## 1. 目标行为

| ID | 规则 |
|----|------|
| R1 | 同一手指在候选区：**轻点旋转** · **横滑滚动** · **长按拖 / 上滑拖** |
| R2 | 一屏约 **3.5** 槽可见；内容少则**居中**；多则可滑，边缘露半块 |
| R3 | 左右尽头 **软回弹**（欠阻尼、可过冲），禁止硬顶死无反馈 |
| R4 | 落盘成功后列表压实；**未落盘取消**时原槽留洞 + scroll 还原，看起来像没拖过 |
| R5 | 盘上摘块：**抬起姿势与 tray 一致**；回 tray 须**手指松在候选区**；插回**原槽位** |
| R6 | 横滑阈值收紧，减少「想拖却横滑」 |

---

## 2. 坐标系（必须单一）

```text
视口：tray 带 [viewX, viewX+viewW]，垂直中心 cy
基准宽 base = viewW / TRAY_VISIBLE_SLOTS   （默认 3.5）
中心距 stride = base * (1 + TRAY_SLOT_GAP_FRAC)  （默认 +18% 间距）

内容：n 个槽（含拖起时的 null 占位洞）
  contentW = n * stride
  pad = max(0, (viewW - contentW) / 2)   // 少块居中

屏幕中心：
  cx = viewX + pad + (i + 0.5) * stride - scrollVisual + flipOffset

scroll：
  逻辑 trayScrollX：可短时越界（有限）
  绘制/命中永远 visualScrollX() = rubber(逻辑) 或 idle 时 clamp
```

**禁止**：把绝对屏幕坐标长期写进 `piece.displayCx` 再减 scroll。

---

## 3. 指针状态机（候选区）

```text
pointerdown on piece → ARMED
  ├─ 静止 ≥ LONG_PRESS_MS 且位移 < tapSlop     → DRAG（长按）
  ├─ 上滑超阈值且纵主导                         → DRAG（上滑，Q15 保留）
  ├─ 横移超 scrollSlop 且 absDx ≥ absDy * AXIS → SCROLL
  └─ pointerup 且位移 < tapSlop                → TAP → 旋转 90°

pointerdown 空白带 → 直接 SCROLL（无块时）
```

| 参数（见 defaults） | 作用 |
|---------------------|------|
| `TRAY_LONG_PRESS_MS` | 长按拿起 |
| `TRAY_LIFT_SWIPE_UP_CELLS` | 上滑拿起 |
| `TRAY_SCROLL_SLOP_PX` + cell 比例 | 横滑门槛（偏严） |
| `TRAY_SCROLL_AXIS` | 横滑须更「纯横」（默认 1.25） |
| `TRAY_TAP_SLOP_PX` | 点转最大位移 |

优先级（armed 且点在块上）：

1. **上滑/斜上拖**（纵主导可略松）→ DRAG  
2. **明显朝棋盘上移** → 保持 armed，**禁止横滑**（解决左右边缘斜拖误滚）  
3. **纯横**（`absDx ≥ absDy * AXIS` 且上移不足）→ SCROLL  

空白带 pointerdown 仍可直接 SCROLL。

---

## 4. 拖起 / 落盘 / 取消

### 4.1 从候选区拖起

1. `tray[i] = null`（**占位洞**，其它块 index 与 scroll **不变**）  
2. 记录 `homeTrayIndex`、`savedTrayScrollX`  
3. `createDragSession`（抬起姿势：`FEEL_DRAG_OFFSET_*`）

### 4.2 成功落盘

1. 写入棋盘 + `placedPieces`（带 `homeTrayIndex`）  
2. `compactTrayAfterPlace()`：去掉 null 洞，允许 reflow  

### 4.3 未落盘取消（回候选区 / 非法落点 / cancel）

1. **`restoreLiftedTrayPiece`**：块填回原洞  
2. **`trayScrollX = savedTrayScrollX`**  
3. 不 reflow、不改其它块位置  

### 4.4 回候选区条件

- 手指松在 **`isInTrayBand`** 内  
- **不做**中途「下滑 flick 自动回 tray」（过敏，已移除）  

---

## 5. 盘上摘块

| 项 | 规则 |
|----|------|
| 触发 | **按下即摘**（不改成长按） |
| 抬起姿势 | 与 tray 相同：`createDragSession` + `FEEL_DRAG_OFFSET_Y_MIN` 等，**禁止**用 grabCell 盖掉 base/frame |
| 跟手 | 同一 `samplePointer` / 手感1·2 |
| 换位 | 合法投影松手 → 落子 |
| 回 tray | 手指松在候选区 → 插回 **`homeTrayIndex`** |
| 非法松手 | 回到**原盘格**（`originalPlaced`） |

---

## 6. 滚动物理

| 相位 | 行为 |
|------|------|
| dragging | 逻辑 scroll 跟手，钳在「合法域 ± 有限 overscroll」 |
| gliding | 惯性 px/s，摩擦衰减 |
| bouncing | 欠阻尼弹簧，可过冲再定住；绘制始终 rubber |
| idle | clamp 到合法域；内容放得下时 scroll=0 |

速度单位：**px/s**（勿再用 px/ms 积分）。  
绘制：**永远 `visualScrollX()`**，禁止 gliding 用裸逻辑 scroll 画块（曾导致整排消失）。

相关常量：`TRAY_FLING_*`、`TRAY_BOUNCE_*`、`TRAY_LOGIC_OVERSCROLL_FRAC`、`TRAY_RUBBER_C`。

---

## 7. 绘制契约

`game.trayDrawList()` → `[{ piece, cx, cy, slotW }]`  
`view.render({ trayDraws })` **只按 cx/cy 画**，不再自己减 scroll。

裁剪：按块半宽相对 tray 带扩展判定，勿用错误的 `center+slotW` 公式误裁。

---

## 8. 代码地图

| 文件 | 职责 |
|------|------|
| `defaults.js` | `TRAY_*`、抬起 `FEEL_DRAG_*`、跟手 MODE |
| `tray-layout.js` | metrics / scroll 域 / rubber / 插入下标 / 屏幕槽 |
| `layout.js` | tray 带几何、`slotW` 初值、`visibleSlots` |
| `game.js` | 状态机、洞占位、restore/compact、盘上摘块 |
| `feel/drag-session.js` | 抬起姿势与跟手积分 |
| `view.js` | `trayDraws` 绘制 |
| `touch-hygiene.js` | 禁放大镜/多指/选择（Web） |
| `BridgeViewController.swift` | WK 关文本交互/长按/缩放 |

---

## 9. 验收要点

- [ ] 轻点转、长按拖、上滑拖、横滑互不严重误触  
- [ ] 1～2 块居中可见；多块可滑且间距不贴死  
- [ ] 尽头 soft bounce，块不整排消失  
- [ ] 拖起未落盘再取消：槽位与 scroll 与拖前一致  
- [ ] 落盘成功后列表压实  
- [ ] 盘上摘下抬起姿势与 tray 一致；回 tray 须到候选区且回原槽  
- [ ] 真机长按不出现放大镜  

---

## 10. 变更摘要（实现已落地）

1. 候选区三操作 + 上滑拿起（Q15）  
2. 3.5 可见 + 槽间距 `TRAY_SLOT_GAP_FRAC`  
3. 单一坐标系 + `trayDraws`  
4. 逻辑/视觉双轨 scroll + 惯性/回弹  
5. 拖起占位洞 + 取消还原 scroll  
6. 盘上摘块姿势对齐；回 tray 仅条带内 + 原槽  
7. 横滑收紧；**朝棋盘上移禁止误横滑**  
8. 点击旋转震动（同影格量级）  
9. Web/原生触控卫生（放大镜等）  
10. 分数 HUD 适配（真机不压盘）  

投影换格见 **[GHOST-POLICY.md](./GHOST-POLICY.md)**（soft-follow 等）。

---

## 11. 文档关系

| 文档 | 角色 |
|------|------|
| **本文 SPEC** | **候选区实现与验收 SSOT** |
| [GHOST-POLICY.md](./GHOST-POLICY.md) | 投影换格摘要 |
| [CHANGELOG.md](./CHANGELOG.md) | 迭代摘要 |
| RESEARCH-PLAN / FINDINGS | 检索档案（非日常真源） |
| AGENTS / docs/README | 入口与索引 |
