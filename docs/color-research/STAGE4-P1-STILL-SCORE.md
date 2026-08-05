# 阶段 4 · P1 静帧评分（初评）

**方案**：P1 开心浅壳 + 中深中性槽（`STAGE3-P1-HEX-DRAFT.md`）  
**静帧**：`mocks/P1-still-{blue,red,green}.png` · 三联 `P1-still-contact.png`  
**源**：`mocks/p1-still.html`（可浏览器再开）  
**纪律**：仍未改 `defaults.js`。

---

## 1. 静帧内容

| 帧 | 预填 | L4 已落 | tray（ban 后） | ghost |
|----|------|---------|----------------|-------|
| Blue | 闷蓝三深浅 | 黄 + 粉 | 绿 / 黄 / 粉 | 粉 alpha≈0.48 |
| Red | 闷红三深浅 | 绿 + 紫 + 黄 | 青 / 黄 / 紫 | 无 |
| Green | 闷绿三深浅 | 橙 + 粉 + 黄 | 粉 / 黄 / 紫 | 无 |

共用：

- L0 `#8B9AE8` · L1 `#3E4558` / `#323848`  
- L3 `#2A303C` 中性井  
- L6 dock 白 @10%  
- L7 白字 BEST/SCORE  

---

## 2. 主观分（单人初评 · 1–5）

| 指标 | Blue | Red | Green | 门槛 | 结果 |
|------|------|-----|-------|------|------|
| cheerful | 4.5 | 4.5 | 4.5 | ≥4 | **过** |
| oppressive（低好） | 1.5 | 1.5 | 1.5 | ≤2 | **过** |
| clarity_L4_on_L3 | 5 | 5 | 5 | ≥4 | **过** |
| clarity_L4_on_L2 | 4.5 | 5 | 5 | ≥4 | **过** |
| L2 vs L3 分离 | 4 | 4.5 | 4.5 | 不糊 | **过** |
| tray 互认 | 5 | 5 | 5 | — | **过** |
| 规则兼容 match | high | high | high | high | **过** |

**相对工程紫井 ours-purple（catalog L4_on_L2≈2）**：P1 静帧 L4_on_L2 **明显抬升**，主因 **L3 去色相**。

---

## 3. 观察

### 有效

1. **中性槽** 让黄/粉/绿/橙在预填旁仍跳。  
2. 壳 `#8B9AE8` 愉快、HUD 白字可读。  
3. 三系预填（蓝/红/绿）气质稳定，无某一系崩盘。  
4. tray 跳色 + ban 后不与预填撞车。

### 残留风险

1. **蓝预填** 与冷壳同冷相：L2 需保持「闷」；若再提亮预填可能黏壳（F6 风险点）。  
2. **Ghost** 在深槽上须足够 alpha；过低会脏紫（已用 ~0.48）。实机 `FEEL_GHOST_ALPHA` 需对齐。  
3. 静帧为 **2D 扁圆角块**，非 WebGPU 真 mesh；体积/bevel 以 piece-tune 另验。  
4. 单人初评 · 建议隔日复评或第二人。

---

## 4. 相对亮度粗算（sRGB 近似 Y）

`Y ≈ 0.2126R + 0.7152G + 0.0722B`（0–255 归一前）

| 色 | hex | Y≈ |
|----|-----|-----|
| shell | #8B9AE8 | 158 |
| empty | #2A303C | 47 |
| prefill blue mid | #5A7A9E | 112 |
| piece yellow | #FFCC22 | 196 |
| piece pink | #FF4DB8 | 122 |

- shell − empty ≈ **111**（槽够深）  
- yellow − empty ≈ **149**（L4_on_L3 极清晰）  
- yellow − blue prefill ≈ **84**（L4_on_L2 可接受）  
- blue prefill − empty ≈ **65**（L2/L3 可分）

---

## 5. 门禁结论（初）

| 项 | 状态 |
|----|------|
| P1 静帧三系 | **已产出** |
| 成功标准 §6 主观 | **初评通过** |
| 合入 defaults | **仍冻结** — 待你确认 / 隔日复评 / 可选真机调参面板试色 |
| 建议 | 确认后用 P1 hex 改 `COLOR` + `BOARD_PALETTES` 闷色；ghost alpha 对齐 |

---

## 6. 文件索引

```
docs/color-research/mocks/p1-still.html
docs/color-research/mocks/P1-still-blue.png
docs/color-research/mocks/P1-still-red.png
docs/color-research/mocks/P1-still-green.png
docs/color-research/mocks/P1-still-contact.png
docs/color-research/refs/P1-still-*-prefill.png
```

---

*STAGE4 初评 · P1 静帧 · 未改代码默认色*
