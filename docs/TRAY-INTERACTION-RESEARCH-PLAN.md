# 候选区交互 · 检索计划（档案）

> **状态**：**检索完成 · 已实现**（2026-08-05）  
> **实现 SSOT（请改这里）**：[TRAY-INTERACTION-SPEC.md](./TRAY-INTERACTION-SPEC.md)  
> **检索结论档案**：[TRAY-INTERACTION-RESEARCH-FINDINGS.md](./TRAY-INTERACTION-RESEARCH-FINDINGS.md)  
> **范围**：解密消除模式 · 底部候选区（tray）  

本文仅保留检索过程与历史决策；**日常改行为以 SPEC + `defaults.js` / `tray-layout.js` 为准**。

---

## 0. 三轮循环记录

| 轮 | 反查补漏（写入计划的缺口） | 检索动作 | 结果 |
|----|---------------------------|----------|------|
| **1** | 缺现状 Gap；上滑≠长按；硬 clamp；sparse null；cancel 漏；无 piece id | WP-A/B/F + 读 `game/layout/view` | Gap 表、手势对照、阈值区间 |
| **2** | 缺状态机/公式/R4 时序/index 语义/迁移策略 | WP-C/D/E + 物理/FLIP | 状态机、布局与 rubber 公式、补位时序 |
| **3** | §5 未关；验收未标现状；PR 切分；Q15 上滑 | WP-G 全关 + 参数表 + 实现简报 | FINDINGS 定稿；可写 SPEC |

**STOP 条件**

- [x] 状态机无未定义转移（见 FINDINGS R2）  
- [x] 布局/scroll/补位公式可指导代码  
- [x] §5 每条有结论（FINDINGS R3）  
- [x] 验收表覆盖 R1–R4 并标现状  
- [x] Open Questions 无技术未知（Q1–Q15 默认采纳）  

---

## 1. 背景与动机

当前工程已切到 **8×8 解密填洞**。候选区需要同时支持：

- 多块时 **横滑浏览**（对照 KittyPick 底部皮带）
- **轻点旋转**、**长按拖动**（现状为上滑拿起，见 Gap）
- 视觉 **居中 + 约 3.5 可见**，尽头 **软回弹**
- **拿走补位 / 放回插入** 的自然列表动画

底座是 **Canvas 自绘**（非原生 `UIScrollView`），行为对齐 iOS 用户预期。  
官方无「三操作同区」单篇 HIG 专文；标准手势 + UIScrollView 仲裁 + WWDC14-235 + rubber 公式可收敛为规格。

---

## 2. 需求冻结（R1–R4）

### R1 · 三操作并存

| 操作 | 手势 | 结果 |
|------|------|------|
| **点击** | 按下 → 位移小 → 抬起 | **旋转 90°** |
| **横滑** | 水平位移为主，未进入拖 | **滚动** |
| **拖动** | **长按**达阈值，**或上滑**超阈值（两者并存，已拍板） | **拿起**；该 touch 不再滚 tray |

单 touch 只落一种 mode。详见 FINDINGS 状态机。

### R2 · 居中 · 3.5 · 可滑暗示

- `slotW = tray.w / 3.5`  
- 少块：内容水平居中  
- 多块：可横滑；边缘半块暗示  

### R3 · 软回弹

- 禁止硬顶死无反馈  
- overscroll + 松手/惯性后弹回  
- rubber 参考 `c≈0.55`  

### R4 · 补位 / 插入

- 拿走：压缩列表，后方及时 FLIP 补上  
- 放回：按松手 x 插入，邻块让开  
- scroll 锚定未动块屏幕位置  

---

## 3. 检索总目标 → 交付映射

| 目标 | 交付位置 |
|------|----------|
| 状态机 | FINDINGS §R2 |
| 布局公式 | FINDINGS §R2 |
| 滚动物理 | FINDINGS §R2 |
| 列表动画 | FINDINGS §R2 R4 时序 |
| §5 结论 | FINDINGS §R3 |
| 验收 | FINDINGS 验收表 |
| 实现改动面 | FINDINGS 文件级 + PR 切分 |
| Open Questions | FINDINGS 终态 Q1–Q15 |

---

## 4. 工作包状态

| WP | 内容 | 状态 |
|----|------|------|
| A 三手势 | HIG / UIScroll / WWDC / Kitty / Pointer | **完成** |
| B 3.5 居中 | 公式、少块、slot | **完成** |
| C 回弹惯性 | rubber、fling、可打断 | **完成** |
| D 补位插入 | FLIP、insert、anchor | **完成** |
| E 棋盘衔接 | ghost、锁输入、editor | **完成** |
| F 工程现状 | Gap 真值 | **完成** |
| G 盲区 §5 | 全关 | **完成** |

---

## 5. 盲区索引（正文结论在 FINDINGS）

计划内保留分类索引；**逐条结论以 FINDINGS §R3 为准**（已全部关闭）。

### 5.1 手势与误触

含：长按 vs 慢滑、slop 分离、竖滑、axis-lock、抬起吸附、回 tray、多指、屏外、cancel、可发现性、对称块、hold 覆盖 tap、惯性中断、双击、120Hz。

### 5.2 布局 · 3.5

含：slot vs bbox、质心、少块 overscroll、3/4 块首屏、压缩列表、半块命中、hit 扩大、band 高度、横屏范围、safe area、scale 解耦。

### 5.3 物理

含：惯性、撞边、overscroll 幅度、打断、haptic、dt、Reduce Motion、与补位合成、auto-scroll backlog。

### 5.4 R4 补位

含：瞬时 remove、取消插入、insert 规则、连拿、失败路径、from-board、n=0、与旋转、scroll 锚定、动画中命中、时长、性能、一次布局、新关入场。

### 5.5 棋盘 / 关卡

含：ghost、clear 锁、新关 scroll、editor、gameOver、debug query。

### 5.6–5.8

含：双端同构、主指针、touch-hygiene、tune、SPEC 文档、deal 遗留、单测、教学心理、失败态与一致性。

### 5.9 轮次反查新增（R1 补入）

| # | 问题 | 结论位置 |
|---|------|----------|
| 5.9.1 | 现状上滑拿起 vs 需求长按 | Q15 + Gap |
| 5.9.2 | sparse `null` vs 压缩列表 | Q3 / R4 |
| 5.9.3 | `placedPieces.trayIndex` 稳定性 | piece **id** |
| 5.9.4 | pointercancel 漏 trayScrollDrag | 必修 bug |
| 5.9.5 | clamp 硬边 vs rubber | R3 |
| 5.9.6 | visible 4 vs 3.5 | R2 |
| 5.9.7 | clearFx lock 与 tray | 5.5.2 通关锁 |

---

## 6. 现状 Gap 摘要（R1 检索）

| 项 | 现状 | 目标 |
|----|------|------|
| 拿起 | 上滑 | 长按为主，上滑可选 |
| scroll 边 | hard clamp | rubber + bounce |
| 可见 | ~4 均分贴左 | 3.5 + 少块居中 |
| 列表 | 定长 + null 洞 | 压缩 + FLIP |
| 放回 | 原 index 坑 | 松手 x 插入 |
| cancel | 不完整 | drag+scroll+float 全清 |

代码锚点：`game.js` `onPointerDown/Move/Up`、`clampTrayScroll`、`hitTrayIndex`；`layout.js` `visibleTraySlots`；`view.js` `trayScrollX` 绘制。

---

## 7. Open Questions（终态 · 默认已采纳）

详见 FINDINGS。摘要：

- Q1–Q14：原表默认均 **采纳**  
- **Q15**：**已拍板** — 上滑拿起与长按 **正式并存**（手感优先；非临时兼容）

---

## 8. 风险（仍有效）

| 风险 | 缓解 |
|------|------|
| 三手势误触发 | 阈值+轴锁+真机 |
| 补位与 scroll 同变 | Q10 锚定 |
| 动画叠三层 | 相位互斥 |
| id/mesh 不同步 | pieces[] 真源 |
| 范围膨胀 | 非目标写死 |

---

## 9. 材料源

- HIG Gestures；UIScrollView bounce/delay  
- WWDC14-235；rubber 公式 c≈0.55（社区还原 iOS）  
- FLIP（First/Last/Invert/Play）  
- KittyPick 横滑 tray  
- 本仓 puzzle tray 路径  

---

## 10. 交付物

| 交付物 | 路径 | 状态 |
|--------|------|------|
| 本计划（勾选完成） | `docs/TRAY-INTERACTION-RESEARCH-PLAN.md` | ✅ |
| 检索结论（3 轮） | `docs/TRAY-INTERACTION-RESEARCH-FINDINGS.md` | ✅ |
| 实现 SPEC | `docs/TRAY-INTERACTION-SPEC.md` | ⏳ 评审 FINDINGS 后写 |
| 实现 | `src/game/*` | ⏳ 按 PR1–5 |

---

## 11. 建议实现顺序（PR）

1. 压缩列表 + 稳定 id + 无洞数据  
2. 3.5 居中布局 + scroll 域  
3. 三态指针（长按 + 可选上滑）+ cancel 修复  
4. rubber + 惯性 + 回弹  
5. FLIP 补位/插入 + scroll 锚定  

---

## 12. 变更记录

| 日期 | 变更 |
|------|------|
| 2026-08-05 | 初版计划 |
| 2026-08-05 | **3 轮循环**：补 §5.9/Gap/状态；检索完成；链到 FINDINGS；STOP 打勾 |
