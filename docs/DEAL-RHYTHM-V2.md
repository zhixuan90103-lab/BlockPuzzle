# 发块节奏 v2（2026-08）

## 核心

| 轴 | 定义 | 控制 |
|----|------|------|
| **难度** | tray 上当前可放块数 `instant` | 设置：简单=3 / 中等=2 / 困难=1，随时切换，下盘生效 |
| **形状** | 贴合空格 + 摆后更整齐 | 读当前盘自动采样 |

## 入口

- `deal/pipeline.js` → `generateTray`
- `deal/rhythm.js` → 主采样
- `deal/difficulty.js` → 人控档

## 流程

```
snapshot 盘
  → 读难度档 → targetInstant
  → catalog 全 form：可放? 贴合分/空腔分/整齐Δ
  → 组合 3 块：尽量 instant == target
  → tray 打分：贴合 + 空腔 + 整齐 + 形状多元
  → 失败 soft 贴近目标 / fallback 保底 ≥1 可放
```

## 不再作为主路径

- 分数 early/mid/late 绑 instant
- 助清/清屏续推/payoff 意图链（代码仍保留模块，管线不再调用）

## UI

设置 → **推送难度** → 简单 / 中等 / 困难
