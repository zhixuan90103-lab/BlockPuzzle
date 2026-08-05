# 投影换格规格（实现摘要）

> **代码**：`src/game/feel/ghost-policy.js`  
> **常量**：`src/game/defaults.js` 的 `FEEL_GHOST_*`  
> 旧设计长文 `GHOST-DESIGN.md` 已移除；以本文 + 代码为准。

---

## 1. 流水线

1. **engage**：形状底排与棋盘重叠才出影。  
2. **free**：拖块底排中心 → 浮点格坐标 `freeColF/freeRowF`。  
3. **sticky**：当前合法钉格；首次 `firstPin` 找近邻可放格。  
4. **soft-follow**（2026-08）：free 比 sticky **更靠近**某合法邻格（裕量 `FEEL_GHOST_SOFT_FOLLOW_MARGIN`）→ **提前换影**，不必等满 leave。  
5. **8 向 leave**：按方向与 leave 种类决定离开距离，够则步进一格。  
6. **MAX_LAG**：free 离 sticky 过远 → 灭影。

---

## 2. 离开距离 L（+ 小 H）

| 种类 | 含义 | 默认量级（以 defaults 为准） |
|------|------|------------------------------|
| open | 目标格能放下 | `L_open≈0.42` + `H_open≈0.09` |
| block | 盘内被块挡住 | `L_block≈0.72` |
| board | 一步会出界 | `L_board≈1.3` |

---

## 3. 产品意图（近期）

- 半卡住但**向空侧仍有合法格**时，投影应**更快**跟上手指。  
- soft-follow + 降低 open/block 阈值；防闪靠 soft 裕量与 H_open。  
- 调参入口：设置面板 `FEEL_GHOST_*` 或直接改 defaults。

---

## 4. 改投影时

1. 先改 defaults / 本文意图  
2. 再改 `ghost-policy.js`  
3. CHANGELOG 记一笔  
