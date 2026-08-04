# Super Blocks 基础块

本文件记录解密消除模式使用的 4 色 16 个基础块。  
矩阵中 `#` 表示占格，`.` 表示空格；方向按基础展示方向记录。  
代码真源：`src/game/puzzle/generator.js` → `SUPER_BLOCK_GROUPS`。

## 颜色

| 组 | 颜色 | 代码色值 |
|---|---|---|
| 0 | 黄 | `0xf3c739` |
| 1 | 红 | `0xee443b` |
| 2 | 蓝 | `0x2296df` |
| 3 | 绿 | `0x28b965` |

## 黄色

### `yellow_step6`

```text
###.
.###
```

### `yellow_i4`

```text
####
```

### `yellow_u6`

```text
#.#
###
.#.
```

### `yellow_plus`

```text
.#.
###
.#.
```

## 红色

### `red_u`

```text
#.#
###
```

### `red_l5`

```text
#...
####
```

### `red_stair`

```text
..#
.##
###
```

### `red_plus6`

```text
.##
###
.#.
```

## 蓝色

### `blue_bridge6`

```text
.##.
####
```

### `blue_long_t6`

```text
.#..
####
.#..
```

### `blue_l5`

```text
..#
..#
###
```

### `blue_z`

```text
.##
##.
```

## 绿色

### `green_p5`

```text
##.
###
```

### `green_u6` 已确认

```text
#..#
####
```

### `green_stair`

```text
..#
.##
##.
```

### `green_t5`

```text
.#.
.#.
###
```
