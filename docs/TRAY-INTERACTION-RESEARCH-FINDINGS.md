# 候选区交互 · 检索结论（3 轮循环 · 档案）

> **状态**：检索完成 · **实现已落地**  
> **日期**：2026-08-05  
> **实现 SSOT**：[TRAY-INTERACTION-SPEC.md](./TRAY-INTERACTION-SPEC.md)（行为以 SPEC 为准，本文可能落后）  
> **计划档案**：[TRAY-INTERACTION-RESEARCH-PLAN.md](./TRAY-INTERACTION-RESEARCH-PLAN.md)  

本文合并三轮检索产出，供追溯设计。**改产品行为请改 SPEC + 代码，勿只改本文。**

---

## 轮次总览

| 轮 | 反查补漏重点 | 检索执行 | 主要产出 |
|----|--------------|----------|----------|
| **R1** | 计划缺「现状 Gap」、缺 index 稳定性、缺拖起手势与现状差异 | WP-A/B/F：HIG/UIKit、Kitty、代码路径 | Gap 表、手势对照、现状真值 |
| **R2** | 缺状态机、缺 rubber 公式、缺 R4 时序、缺 trayIndex 语义 | WP-C/D/E + 状态机/物理 | 状态机、公式、补位时序 |
| **R3** | §5 未关闭、验收未对齐代码 bug、缺实现切分 | WP-G 关闭盲区 + 验收 + 实现简报 | §5 结论、默认拍板、文件清单 |

---

# 第一轮

## R1 · 反查补漏（计划缺什么）

相对初版计划，补入：

1. **现状 Gap 专节**（计划原先只有 WP-F，无「已实现行为真值」）  
2. **tray 数据是 sparse 定长数组**（`tray[i]=null` 留洞）与 R4「压缩列表」冲突——必须单列  
3. **现状拖起是「上滑」不是「长按」**——与 R1 产品目标冲突，实现是换模型不是微调  
4. **`clampTrayScroll` 硬夹死**——与 R3 直接冲突  
5. **visible=4 非 3.5、无居中 content**  
6. **落盘 `tray[i]=null` 不压缩**——无补位动画  
7. **pointercancel 只清 drag，不清 trayScrollDrag**——漏项  
8. **placedPieces.trayIndex 与 null 洞耦合**——压缩列表后 index 语义要重新定义  
9. **缺少「稳定 piece id」**（旋转/补位用 index 不稳）  
10. **缺少测试/调试钩子**（`?trayDebug=1` 等）列入计划  

## R1 · 检索：现状 Gap（代码真值）

路径：`game.js` · `layout.js` · `view.js`

| 能力 | 现状 | vs R1–R4 |
|------|------|----------|
| 点击旋转 | pointerup 且位移 < ~0.22 cell → `rotatePieceCW` | ✅ 有；**无**长按分支 |
| 横滑 | `dx` 主导且 >6 → 改 `trayScrollX` | ✅ 有 |
| 拖起 | **上滑** `dy < -0.22 cell` 进 drag | ❌ 目标是 **长按**；上滑可作辅助/废弃 |
| 硬夹 scroll | `clampTrayScroll` → `[0, max]` | ❌ 无 overscroll/回弹 |
| 惯性 | 无 | ❌ |
| 可见槽 | `visibleTraySlots = min(4, TRAY_SIZE)` | ❌ 要 3.5 |
| 居中 | slot 从左铺满；n 小不居中内容 | ❌ |
| 拿走 | `tray[i]=null`，洞保留 | ❌ 无补位 |
| 放回 | `tray[trayIndex]=piece` 原坑 | ⚠️ 有放回，无插入动画/邻块让位 |
| 主指针 | `isPrimary === false` return | ✅ |
| capture | `setPointerCapture` | ✅ |
| cancel | 仅 `drag`；**漏 trayScrollDrag** | ⚠️ bug |
| 通关锁 | clear 时 `lockInput` | ⚠️ 与「边消边玩」注释不完全一致，需统一 |

**关键代码行为（R1 摘录）：**

```text
down on tray piece → trayScrollDrag { startScrollX, trayIndex }
move:
  |dx| > |dy| && |dx| > 6  → scroll (hard clamp)
  dy < -slop               → start drag (上滑拿起)
up (no drag):
  hypot move < slop        → rotate
place success:
  tray[i] = null           → 留洞
return to tray band:
  tray[originalIndex] = piece
```

## R1 · 检索：外部范式（WP-A 摘要）

| 来源 | 结论 |
|------|------|
| HIG Gestures | Tap=激活；Swipe=滚；Drag=移动；Touch-and-hold=额外能力 → **点转 / 横滑 / 长按拖** 语义合法 |
| UIScrollView | `delaysContentTouches` 区分点与滚；`bounces` 到边回弹；硬 clamp 非 iOS 默认 |
| WWDC14-235 | LongPress 拖 + Scroll pan：拖 Began 后 disable/re-enable pan 清 touch；`cancelsTouchesInView` |
| KittyPick | 底栏横滑 + 拖放；公开文案不强调旋转；半块外露提示可滑 |
| Rubber-band 公式（社区还原 iOS） | `f(x)=d(1-1/(x*c/d+1))`，常用 **c≈0.55**，d=可视宽度 |

## R1 · 推荐默认阈值（区间）

| 参数 | 建议默认 | 备注 |
|------|----------|------|
| tapSlop | `max(10, 0.22*cell)` | 与现码接近 |
| scrollSlop | 6–10 px，且 `\|dx\|>\|dy\|` | 现 6 |
| longPressMs | **300ms**（250–400） | 替换上滑为主路径 |
| axisLock | 首次超 slop 锁 H 或取消竖 | 现隐式横优先 |
| 上滑拿起 | **v1 可保留为加速手势** 或删除 | 产品二选一 → 见 Q15 |

---

# 第二轮

## R2 · 反查补漏（基于 R1）

R1 后仍缺：

1. **完整状态机**（含 R4、cancel、from-board）  
2. **scroll 物理伪代码**（惯性+rubber+回弹可中断）  
3. **布局公式**（3.5、居中、contentW、scroll 域）  
4. **piece 身份**：压缩后 `trayIndex` 不能当稳定 id  
5. **补位时序**与 drag 浮层关系  
6. **from-board 拖回**与 tray 列表插入统一  
7. **稀疏 null 迁移策略**（一步到位压缩 vs 兼容期）  

## R2 · 状态机（定稿草案）

### 指针 mode（单主指针）

```text
                    pointerdown on tray piece
                              │
                              v
                         ┌─────────┐
                         │  ARMED  │  (记录 t0,p0,pieceId,scroll0)
                         └────┬────┘
              ┌───────────────┼───────────────┐
              │               │               │
     |dx|>scrollSlop   t-t0≥longPress    pointerup
     & axis=H          & 未 scroll       & 位移<tapSlop
              │               │               │
              v               v               v
          ┌──────┐       ┌──────┐        ┌──────┐
          │SCROLL│       │ DRAG │        │ TAP  │→ rotate → IDLE
          └──┬───┘       └──┬───┘        └──────┘
             │              │
             │ move/惯性    │ move ghost
             │ up→惯性/弹   │ up→ place | return | reject
             v              v
           IDLE           IDLE
```

**互斥：**

- 进入 SCROLL → 取消 longPress 计时  
- 进入 DRAG → 停止 tray 滚动跟踪；列表 **立刻 remove 该 piece 并补位动画**  
- TAP 与 SCROLL/DRAG 互斥  

**盘上已放块：**

- down on placed → DRAG（`returningFromBoard`），不经 ARMED 的 scroll/tap  
- 可选：盘上 tap 不旋转（旋转仅 tray）——**建议保持仅 tray 点转**，避免误转已放块  

### 列表 layout 状态

```text
pieces: PieceRef[]   // 压缩，无 null
each: { id, piece, displayX, displayY, targetX, targetY, animT }
scroll: { x, v, phase: idle|dragging|gliding|bouncing }

onRemove(id):  // 拖起或落盘
  First positions → splice → Last targets → FLIP Play
  recompute contentW, scrollMin/Max; anchor remaining screen pos

onInsert(id, index): // 放回
  First → splice insert → Last → FLIP
  optional scroll so id visible
```

## R2 · 布局公式

```text
viewW      = layout.tray.w
viewX      = layout.tray.x
VISIBLE    = 3.5
slotW      = viewW / VISIBLE
n          = pieces.length
contentW   = n * slotW

// 内容左缘在 scroll=0 时的位置（居中当 contentW < viewW）
contentLeft0 = viewX + max(0, (viewW - contentW) / 2)

// piece i 中心目标（未加 scroll）
targetCx(i) = contentLeft0 + (i + 0.5) * slotW - scrollX
// 注：实现可用「slot 坐标系 + scroll」等价写法

// 合法 scroll（无 overscroll）
// 约定：scrollX 增大 → 内容左移（与现码 startScrollX - dx 一致）
if contentW <= viewW:
  scrollMin = scrollMax = 0   // 或允许对称 overscroll 见 Q1
else:
  // 内容左对齐可滚到露出右端
  scrollMin = 0
  scrollMax = contentW - viewW

// 若采用「居中为 0」另一套坐标，需统一一处；推荐：
// content 永远从 0 排布，contentW<viewW 时在绘制时加 centerOffset，
// scroll 只在 contentW>viewW 时非零。少块时 Q1 控制 overscroll。
```

**推荐实现简化（写入 SPEC）：**

```text
slotW = tray.w / 3.5
layoutPieces left-to-right at i*slotW
if n*slotW < tray.w:
  originX = tray.x + (tray.w - n*slotW)/2
else:
  originX = tray.x
draw at originX + i*slotW - scrollX
scrollMax = max(0, n*slotW - tray.w)
scrollMin = 0
```

## R2 · 滚动物理

```text
// 跟手（dragging）
if x < scrollMin or x > scrollMax:
  x = edge + rubber(delta, d=tray.w, c=0.55)
// rubber(offset):
//   sign * d * (1 - 1 / (abs(offset)*c/d + 1))

// 松手
v = releaseVelocity (px/ms, 钳制)
phase = gliding
// gliding: x += v*dt; v *= exp(-k*dt)  // 摩擦
// 出界 → phase=bouncing; spring to clamp(x)
// bouncing 可被新 pointerdown 打断 → dragging

// 禁止：clamp 硬切无 rubber（现状）
```

## R2 · R4 补位时序

| 时刻 | 动作 |
|------|------|
| T0 长按成功 / 上滑拿起 | piece 变 float；从 `pieces` **remove**；其余 FLIP 左补；**scroll 锚定**：尽量保持仍在列表中的块的 screenX |
| T0–T1 拖中 | tray 显示 n-1；float 跟手 |
| 落盘成功 | float 吸附盘；列表已无该 id |
| 取消/回 tray | `insertIndex = clamp(round((fx - originX + scrollX)/slotW), 0, n)`；FLIP 让位；float 落 slot |
| 落盘失败且非 return | 同插入回 tray（建议）或回原逻辑位 |

**FLIP：** First（remove 前 screen box）→ 改数据 → Last → Invert transform → Play 150–200ms ease-out。

**scroll 锚定（Q10）：**

```text
before = screenX of piece at anchorIndex (e.g. first still-visible)
remove/insert + recompute layout
scrollX' so that same piece stays at before
then clamp/bounce scrollX'
```

## R2 · trayIndex / id

| 现状 | 问题 | 建议 |
|------|------|------|
| `trayIndex` 定长下标 | null 洞；压缩后下标变 | 每 piece **稳定 `id`**（生成时分配） |
| `placedPieces.trayIndex` | 回 tray 用原坑 | 回 tray 用 **insert 规则**；placed 只存 `pieceId` |
| 旋转 | 原地改 matrix | 按 id 更新 |

---

# 第三轮

## R3 · 反查补漏

1. §5 全表未勾选 → 本轮关闭  
2. 验收用例需标「现状失败项」便于回归  
3. 实现 PR 切分未写  
4. **上滑 vs 长按并存** 未决 → Q15  
5. **clearFx lockInput** 与 tray 操作冲突需结论  
6. 缺 **默认参数表（可进 defaults）**  
7. 缺 **非目标**：不做系统 Drag Session、不做双指  

## R3 · §5 盲区关闭结论

### 5.1 手势

| # | 结论 |
|---|------|
| 5.1.1 | 移动超 scrollSlop → 取消 longPress；longPress 允许 ≤tapSlop 微抖 |
| 5.1.2 | **分离** tapSlop 与 scrollSlop |
| 5.1.3 | **忽略竖向为主的滑动**（不滚页）；不穿透。上滑拿起若保留则用独立阈值 |
| 5.1.4 | **axis-lock**：首次 \|dx\| 或 \|dy\| 超 slop 锁轴；锁 H→scroll，锁 V→若启用上滑则 drag else ignore |
| 5.1.5 | 抬起后 **块心吸到触点**（短动画 50–80ms），避免跳 |
| 5.1.6 | 拖回 tray 带 → R4 插入规则 |
| 5.1.7 | **仅主指针** |
| 5.1.8 | 屏外抬起 → 无效落点 → 回 tray 插入 |
| 5.1.9 | cancel：**清 drag + trayScrollDrag + 惯性**；float 回 tray |
| 5.1.10 | v1 半块暗示；引导 backlog（Q13） |
| 5.1.11 | 仍转角度；可选轻 haptic |
| 5.1.12 | **接受** 长按覆盖点（标准 hold） |
| 5.1.13 | 惯性中 down → **打断 gliding/bounce** 进新 ARMED |
| 5.1.14 | 两次独立 tap = 转两次；无 double-tap 手势 |
| 5.1.15 | 参数真机标定；默认 300ms |

### 5.2 布局

| # | 结论 |
|---|------|
| 5.2.1 | **固定 slotW = viewW/3.5** |
| 5.2.2 | 块在 slot 内 **几何居中**（matrix bbox） |
| 5.2.3 | Q1：允许 **小幅** overscroll（max ~0.35 slot） |
| 5.2.4 | 3 块无半块可接受；靠 overscroll 保持「活」 |
| 5.2.5 | 4+ 初始 scroll=0 且 content 左缘按公式（多块从左可滑）；**少块居中** |
| 5.2.6 | **压缩列表** 无长期 null 洞 |
| 5.2.7 | 命中 **显示位** slot/包围盒 |
| 5.2.8 | 保留现有 hit slop 回退 |
| 5.2.9 | 不改 band 高度语义；只改水平模型 |
| 5.2.10 | v1 **仅竖屏手机框**；iPad backlog |
| 5.2.11 | tray 已有 safe bottom；横滑不抢 edge back |
| 5.2.12 | 3.5 按 tray.w 除，与 FEEL_TRAY_SCALE 独立 |

### 5.3 物理

| # | 结论 |
|---|------|
| 5.3.1 | **做惯性**（简版指数摩擦） |
| 5.3.2 | 出界进 bounce spring，不叠两次肉动画 |
| 5.3.3 | rubber 映射 c=0.55；视觉 overscroll 感 ~0.25–0.5 slot |
| 5.3.4 | **必须可打断** |
| 5.3.5 | 到边 haptic **默认关** |
| 5.3.6 | 时间积分 dt，clamp dt |
| 5.3.7 | Reduce Motion：无惯性，clamp 瞬时，补位 ≤80ms 或瞬移 |
| 5.3.8 | 补位先 anchor scroll 再单次 bounce 修正 |
| 5.3.9 | auto-scroll tray **v1 不做** |

### 5.4 R4

| # | 结论 |
|---|------|
| 5.4.1 | **抬起瞬间** remove+FLIP（无额外 delay） |
| 5.4.2 | 取消 = **插入** 非撕洞 |
| 5.4.3 | **松手 x → index**（Q9） |
| 5.4.4 | 热更新目标位 |
| 5.4.5 | 失败回 tray **同一 insert 路径** |
| 5.4.6 | from-board 回 tray 同规则 |
| 5.4.7 | n=0：空带；无 hit |
| 5.4.8 | 旋转瞬时（或极短）；不与 FLIP 抢 |
| 5.4.9 | **锚定未动块 screenX** |
| 5.4.10 | 命中显示位；动画中可点 |
| 5.4.11 | FLIP **160ms** 默认 |
| 5.4.12 | 每块 offset 插值，避免整表重创建 mesh |
| 5.4.13 | 布局一次结算 + scroll anchor |
| 5.4.14 | 新关 tray：可短 stagger 入场（可选，v1 简单 fade/pop 即可） |

### 5.5 棋盘衔接

| # | 结论 |
|---|------|
| 5.5.1 | 沿用 ghost-policy / drag-session |
| 5.5.2 | **通关 clear 期间锁 tray**（现 lockInput）；普通无死亡 fail |
| 5.5.3 | 新关 scrollX=0 + 少块居中公式 |
| 5.5.4 | 编辑器可不走 tray 手势（现状点格）；非 editor 共用 |
| 5.5.5 | gameOver 时不接 tray |
| 5.5.6 | level query 无关 tray 手势 |

### 5.6–5.8

| # | 结论 |
|---|------|
| 5.6.1 | Web/iOS 同构参数 |
| 5.6.2 | 仅主指针写死 |
| 5.6.3 | touch-hygiene 保留；tray 用 pointer + touch-action none |
| 5.6.4 | v1 defaults 常量；关键项可后挂 tune |
| 5.6.5 | 实现前出 `TRAY-INTERACTION-SPEC.md` |
| 5.6.6 | puzzle tray 为源；deal 遗留不碰 |
| 5.6.7 | unit：scroll 域、insertIndex、rubber 单调 |
| 5.7.1 | 少块小 overscroll 可接受 |
| 5.7.2 | 点转始终可用 |
| 5.7.3 | 引导 backlog |
| 5.7.4 | 补位是 UI 整理非提示解法 |
| 5.7.5 | 抄 tray 滑动+半块，不抄剪影规则 |
| 5.8.1 | 切关 dispose 全部 tween/scroll phase |
| 5.8.2 | pieces[] 唯一真源；paint 只读 |
| 5.8.3 | ARMED 互斥拖转 |
| 5.8.4 | scroll 有限数守卫 |
| 5.8.5 | cancel 同 5.1.9 |

---

## Open Questions 终态

| ID | 决议 | 状态 |
|----|------|------|
| Q1 | 少块允许小幅 overscroll | **默认采纳** |
| Q2 | 固定 slot 3.5 | **采纳** |
| Q3 | 压缩列表 | **采纳** |
| Q4 | longPress 300ms | **采纳** |
| Q5 | 边 haptic 关 | **采纳** |
| Q6 | 无 edge auto-scroll | **采纳** |
| Q7 | 对称仍转 | **采纳** |
| Q8 | 少块居中，多块 scroll0 | **采纳** |
| Q9 | 松手 x 插入 | **采纳** |
| Q10 | scroll 锚定未动块 | **采纳** |
| Q11 | 竖滑忽略（上滑可选） | **采纳** |
| Q12 | 仅主指针 | **采纳** |
| Q13 | 引导 backlog | **采纳** |
| Q14 | 非 editor 共用 | **采纳** |
| **Q15** | 上滑拿起：**正式保留**，与长按并存（手感更好） | **已拍板** |

---

## 默认参数表（建议进 defaults）

| Key | Value |
|-----|-------|
| TRAY_VISIBLE_SLOTS | 3.5 |
| TRAY_TAP_SLOP_PX | 10（或 0.22*cell） |
| TRAY_SCROLL_SLOP_PX | 8 |
| TRAY_LONG_PRESS_MS | 300 |
| TRAY_LIFT_SWIPE_UP_PX | 0.22*cell（与长按并列的拿起路径） |
| TRAY_RUBBER_C | 0.55 |
| TRAY_OVERSCROLL_HINT | 0.35 * slotW（少块） |
| TRAY_FLING_FRICTION | 实测 |
| TRAY_BOUNCE_MS | ~200 |
| TRAY_FLIP_MS | 160 |
| TRAY_LIFT_SNAP_MS | 60 |

---

## 实现改动面（文件级）

| 文件 | 改动 |
|------|------|
| `defaults.js` | 上表常量 |
| `layout.js` | 3.5 slot；slots 随 n 或改为 runtime 布局函数 |
| `game.js` | 状态机；压缩 tray；scroll 物理；FLIP 调度；cancel 修；id |
| `view.js` | 按 pieces+scroll+displayOffset 绘制；无 null 洞依赖 |
| `feel/drag-session.js` | 小改：抬起吸附（若需要） |
| `tune.js` | 可选后挂 |
| docs | SPEC + 本 findings；计划勾选完成 |

**建议 PR 切分：**

1. **PR1** 压缩列表 + 稳定 id + 落盘/回 tray 无洞（可先无动画）  
2. **PR2** 3.5 居中布局 + scroll 域修正  
3. **PR3** 三态指针（长按+保留上滑）+ cancel 修复  
4. **PR4** rubber + 惯性 + 回弹  
5. **PR5** FLIP 补位/插入 + scroll 锚定  

---

## 验收用例（标现状）

| # | 用例 | 现状 |
|---|------|------|
| 1 | 轻点旋转 | 过 |
| 2 | 横滑滚动 | 过（硬边） |
| 3 | 长按拖起 | **败**（现仅上滑；目标=长按+上滑） |
| 3b | 上滑拖起 | 过（目标保留并与长按仲裁） |
| 4 | 慢滑不转 | 基本过 |
| 5 | 到边 soft bounce | **败** |
| 6 | 3.5 半块暗示 | **败**（4 均分） |
| 7 | 少块居中 | **败** |
| 8 | 拿走补位无洞 | **败** |
| 9 | 放回插入让位 | **败**（原坑） |
| 10 | cancel 不吞块 | **部分败** |
| 11 | 连续拿两块 | **败**（洞） |
| 12 | 通关后新 tray | 过（scroll 重置） |

---

## 非目标（写死）

- 系统级 UIDragSession  
- 双指同时滑+拖  
- 拖块至屏缘自动滚 tray（v1）  
- Android 优先  
- 改关卡生成器  

---

## 变更记录

| 日期 | 内容 |
|------|------|
| 2026-08-05 | 三轮检索合并成文；§5 关闭；默认参数与 PR 切分 |
