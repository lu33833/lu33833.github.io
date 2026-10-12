# 配色说明

[返回首页](../README.md) · [界面设计](design.md) · [参考资料](color-research-sources.md)

当前 v2 使用中性黑白灰，主按钮为深灰，光谱沿用橙色吸收率和蓝色响应度，热图采用蓝色顺序色阶。
下面的色值对应现有代码，调整界面时可按用途查找。

## 界面颜色

定义在 [src/styles.css](../src/styles.css) 顶部的 CSS 变量中。

| 用途 | 变量 | 色值 |
| --- | --- | --- |
| 页面背景、浅底 | `--page`、`--soft` | `#F5F5F5` |
| 面板、输入框、绘图区 | `--surface` | `#FFFFFF` |
| 主文字 | `--ink` | `#1E1E1E` |
| 次文字 | `--muted` | `#757575` |
| 边框、分隔线 | `--line` | `#D9D9D9` |
| 选中背景、次要按钮 | `--selected`、`--button` | `#E3E3E3` |
| 按钮悬停 | `--button-hover` | `#D5D5D5` |
| 控件边界 | `--control-border` | `#9B9B9B` |
| 行操作悬停 | `--row-action-hover` | `#D4D4D4` |
| 错误边界 / 背景 | `--error-border` / `--error-surface` | `#ECC2BC` / `#FFF5F3` |
| 主按钮 | `--accent` | `#2C2C2C` |
| 主按钮悬停 | `--accent-hover` | `#444444` |
| 错误 | `--error` | `#B42318` |
| 提醒 | `--warning` | `#865C16` |

中性灰使用相等的 R、G、B 分量，避免灰底带绿。
选中状态同时保留单选标记或下划线，错误保留文字说明。

## 图表颜色

定义在 [src/ui-config.js](../src/ui-config.js) 中，曲线与图例共用 `CHART_COLORS`。
页面启动时会同步对应的 CSS 变量，因此修改曲线颜色应优先改这个配置。

| 用途 | 配置 | 色值 |
| --- | --- | --- |
| 吸收率 | `CHART_COLORS.absorption` | `#C66A3D` |
| 响应度 | `CHART_COLORS.responsivity` | `#3569A6` |
| 坐标文字 | `CHART_COLORS.ink` | `#757575` |
| 网格线 | `CHART_COLORS.grid` | `#E8E8E8` |
| 坐标轴 | `CHART_COLORS.axis` | `#D9D9D9` |
| 波长标记 / 标记文字 | `CHART_COLORS.marker` / `markerText` | `#757575` / `#444444` |
| 场强层边界 | `CHART_COLORS.layerBorder` | `#E3E3E3` |
| 场强填色 | `CHART_COLORS.fieldFillTop` / `fieldFillBottom` | `#C66A3D66` / `#C66A3D08` |

热图使用 ColorBrewer Blues 的五个停点，在相邻停点间插值。
低值浅、高值深，具体范围由本次结果的色标给出：

```text
#EFF3FF → #BDD7E7 → #6BAED6 → #3182BD → #08519C
```

色阶保存在 `HEAT_STOPS`，与界面按钮色分开维护。
比较两次扫描时，需要同时看色标数值，不能只凭颜色深浅判断响应度大小。

## 厚度灰阶

`PROFILE_GRAY` 默认从 242 映射到 80，即 `#F2F2F2` 至 `#505050`。
`layerTone()` 按当前结构的最小、最大厚度计算灰度，同厚同色，厚层更深。
层条高度固定，真实厚度由标签显示；页面与导出使用同一套规则。

改动端点后要同时检查浅色和深色层上的文字。
当前实现以灰度 128 为界，较深背景用白字，其余用 `#1E1E1E`。

## 早期调研

早期曾比较 Gray + Teal、Slate + Indigo 和 Sand + Bronze，相关色卡保留作参考，当前界面以本文列出的色值为准。

| 资料 | 内容 |
| --- | --- |
| [调研记录](archive/color-research.md) | 候选方案、对比度计算及 Figma 导入过程 |
| [原始来源笔记](archive/color-research-sources.md) | 当时的配色判断与依据 |
| [参考板 SVG](color-reference.svg) / [PNG](color-reference.png) | 早期候选方案的色块与组件示例 |
| [官方色阶数据](color-palettes.json) | 候选色系的原始 HEX |
| [对比度记录](color-contrast.json) | 早期候选组合的计算值，不代表当前全界面的检查结果 |
