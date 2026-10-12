# 配色参考资料

[返回配色说明](color-research.md) · [历史调研笔记](archive/color-research-sources.md)

早期调研整理于 2026-10-09，下面按用途保留官方文档与原始研究入口。
当前实现的色值、组件和映射规则见配色说明。

## 界面色阶与组件

| 资料 | 查阅内容 |
| --- | --- |
| [Radix：Understanding the scale](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale) | 12 阶色板中背景、交互、边界和文字的分工 |
| [Radix：Composing a palette](https://www.radix-ui.com/colors/docs/palette-composition/composing-a-palette) | 中性色与强调色的组合 |
| [Carbon：Color](https://www.carbondesignsystem.com/building-blocks/foundations/color/overview) | 中性背景、浅色主题，以及按用途命名颜色的方法 |
| [AG Grid：Theming parameters](https://www.ag-grid.com/javascript-data-grid/theming-parameters/) | 当前表格主题的颜色、边框与尺寸配置 |

## 数据图表

| 资料 | 查阅内容 |
| --- | --- |
| [ColorBrewer](https://colorbrewer2.org/) | 成套色阶与筛选工具，当前热图采用其中的 Blues 停点 |
| [ColorBrewer：Color schemes](https://colorbrewer2.org/learnmore/schemes_full.html) | 顺序色、发散色和类别色分别适合的数据 |
| [Matplotlib：Choosing Colormaps](https://matplotlib.org/stable/users/explain/colors/colormaps.html) | 连续数据的色图选择、明度和感知差异 |
| [Matplotlib：Colormap normalization](https://matplotlib.org/stable/users/explain/colors/colormapnorms.html) | 数据范围如何映射到色阶 |
| [Nuñez 等：cividis 原始研究](https://doi.org/10.1371/journal.pone.0199239) | 针对色觉差异优化科学色图的研究，保留作备选参考 |

## 可读性

| 资料 | 查阅内容 |
| --- | --- |
| [WCAG：Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | 正文、标签和大字的对比度要求 |
| [WCAG：Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) | 必要控件边界、状态和图形的对比度要求 |
| [WCAG：Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) | 用文字、形状等补充颜色表达的信息 |

检查时使用页面实际的前景和背景组合，色板名称本身不能代替可读性验证。
