# PD 外延光学工作台：配色调研来源笔记

> 历史快照，归档于 2026-10-10；其中的方案、实施状态和验证记录只对应当时版本，当前说明见 [设计说明](../design.md) 与 [配色说明](../color-research.md)

调研日期：2026-10-09。范围：浅色科学工作台的成熟配色规则、三种方向、材料分类色与连续热图的职责划分；不修改产品代码，不在此确定最终色值。

用户的设计用途：尽量采用已有成熟配色，准备手动在 Figma 制作前端设计稿。因此优先选取现成官方色阶及其角色映射，不自创 Hex 色值，不做工程改造，不需要安装配色库。

项目前提来自当前任务上下文：原生 HTML/CSS/JavaScript，白色面板、浅灰底，密集参数表、响应度／吸收光谱、材料剖面和厚度扫描热图。现有深青绿操作色及金属金／灰、InP 青绿、InGaAs 橙、InGaAsP 金褐材料语义作为比较基准。以下区分“来源事实”和“应用判断”；后者是针对本项目的建议，并非来源对本软件的评价。

## 1. 可直接借用的规则

| 来源 | 来源事实 | 应用判断 |
| --- | --- | --- |
| Radix Colors | 同一色系的 12 阶按背景、交互状态、边界、实色填充和文字分工。详见 [Understanding the scale](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale)。 | 借用“先定义用途，再填色值”的方法。不要把一个 `accent` 同时承担按钮底色、小字、浅底和焦点边框。 |
| Radix Colors | 官方同时提供纯灰、带色灰和强调色，并说明自然配对方式。[Composing a palette](https://www.radix-ui.com/colors/docs/palette-composition/composing-a-palette)。 | 可将现成色阶用于三个候选方向，但科学图表区域保持白底或接近中性白，避免背景色干扰材料辨识。 |
| IBM Carbon | 默认界面由中性灰主导；蓝色用于主要操作，其他颜色节制使用。浅色主题用白和浅灰交替组织层次。[Color overview](https://www.carbondesignsystem.com/building-blocks/foundations/color/overview)。 | 该工作台的面板、输入区域、表格分组适合靠明度差组织，主要操作才使用强调色，无须给每个分区加不同彩色底。 |
| IBM Carbon | Token 的角色与色值分离；背景、层、字段、边界、文字、状态、焦点分别有职责，主题变化时角色不变。[Tokens](https://www.carbondesignsystem.com/building-blocks/foundations/color/overview#tokens)。 | 用 CSS 自定义属性表达角色即可借用这一方法；不需要迁移到 Carbon 组件或引入主题框架。 |

Radix 的文字阶说明使用 APCA 的 Lc 指标；它不能直接作为本项目通过 WCAG 2.2 对比度要求的证据。其色阶文档也明确指出，Amber、Yellow、Mint 等实色阶应搭深色前景，不应默认每一种强调色都配白字。[Radix 色阶说明](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale)。**应用判断：**最终应逐一计算实际前景／背景组合，而不是仅凭色阶名称确认合格。

## 2. 三个候选方向

下表是基于项目现状与上述规则的应用判断。这里只指定方向和职责，不预设最终 Hex 值。

| 方向 | UI 配色结构 | 对本软件的适配 | 需要解决的冲突 |
| --- | --- | --- | --- |
| A：Radix Sage + Teal | 白／Sage 浅色阶为主，Teal 深阶用于主要操作和强调文字，浅阶用于少量选中背景 | 延续已修改分支的青绿身份，改动范围最小；采用官方自然配对 | InP 也用青绿。操作状态必须有边框、下划线、勾选等额外提示；计算成功应有文字／图标，不能仅显示绿色 |
| B：Radix Slate + Indigo | 白／Slate 浅色阶为主，Indigo 作为操作强调色 | 与现有材料青绿、橙、金褐的色相分工更清楚，适合偏仪器控制台的感觉 | 若光谱本来有蓝色数据系列，不可把“当前选中”与该系列身份混为一谈；选中状态仍需形状或线型 |
| C：Radix Sand + Bronze | 白／Sand 浅色阶为主，Bronze 作为暖赭／铜棕强调方向 | 可形成较温和、有材料实验室气质的界面；适合作为视觉对照备选 | 与金属金、InGaAs 橙、InGaAsP 金褐及警告色接近，语义冲突最多；应限制彩色面积，并把警告明确绑定图标和文案 |

**排序判断：A 为延续方案，B 为差异化备选，C 为审美备选。**这种排序反映现有材料色和改动成本，不意味着某一种色相在科学软件中客观更优。三种方向都可使用同一份材料分类色与同一份热图色带，以便比较的变量仅为界面外观。

上述均可只取官方现成色阶，不改造色值。需要明确的是：Sage + Teal、Slate + Indigo 属于 Radix 文档的自然配对；Sand + Bronze 是本项目组合已有官方色阶的设计判断，并非 Radix 官方指定的成套主题。文档将 Bronze 列为可选强调色，但未将它列入 Sand 的自然配对示例。[Radix 官方配色组合说明](https://www.radix-ui.com/colors/docs/palette-composition/composing-a-palette)。

Carbon White／Gray 10 可以作为第四种“成熟工作台”参考：官方提供白底和浅灰底两种浅色主题，前者先铺灰色组件，后者先铺白色组件，再逐层交替。[Carbon 浅色主题](https://www.carbondesignsystem.com/building-blocks/foundations/color/overview#light-themes)。**应用判断：**Gray 10 的灰底、白面板结构与现有软件最接近；若希望整个设计稿严格靠一套大型企业设计系统，可直接选 Carbon。若希望延续青绿同时轻量整理原生界面，Radix 色阶更方便逐项参照。

## 3. 手工 Figma 设计稿的颜色角色表

以下是设计稿命名建议，并非要求安装库、插件或改变业务代码。先建立官方基础色，再建立用途名称；同一用途在三个方案里保持同名。角色和值分离的依据是 [Carbon Tokens](https://www.carbondesignsystem.com/building-blocks/foundations/color/overview#tokens)；下表具体映射是结合 [Radix 色阶用途](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale) 的应用判断。

| Figma 颜色名称建议 | 官方色阶候选 | 在工作台里的位置 |
| --- | --- | --- |
| `Canvas / Default`、`Surface / Default` | 官方 White；Sage／Slate／Sand 1–2 | 全局底、白面板、绘图区 |
| `Surface / Hover`、`Surface / Selected` | 中性或强调色 3–5 | 列表悬停、选中行、标签状态 |
| `Border / Subtle`、`Border / Control` | 中性 6–8 | 面板分隔、输入框边界；必要边界仍须实测对比度 |
| `Action / Solid`、`Action / Hover` | Teal／Indigo／Bronze 9–10 起选 | 主要按钮；白字是否适合须核验实际颜色组合 |
| `Text / Secondary`、`Text / Primary` | Sage／Slate／Sand 11–12 | 表格字段、单位、说明、正文 |
| `Text / Accent` | 强调色 11–12 | 链接、强调数值，避免直接用按钮底色兼任小字 |
| `Focus / Ring` | 实测后选择满足辨识需要的官方色阶 | 键盘焦点，不机械照搬低对比边界色 |
| `Material / InP` 等 | 既有材料颜色 | 材料层、图例、相关曲线，三个 UI 方案保持一致 |
| `Heatmap / Sequential` | 选定科学色图 | 作为独立色带参考，不归入强调色系列 |

**应用判断：**Figma 首先比较三张完全相同的参数面板与图表布局，仅替换 UI 色阶；可同时放一行小字、一组按钮、一条曲线、材料剖面及色标。这样能判断读数、材料辨识和操作强调是否同时成立，避免只看漂亮色卡。

## 4. UI、材料、连续热图分开定义

ColorBrewer 区分 sequential（有序大小）、diverging（有意义的中间基准）与 qualitative（无大小顺序的类别）；类别色不应暗示数值高低。[ColorBrewer 色图类型](https://colorbrewer2.org/learnmore/schemes_full.html)。

据此，建议采用以下职责分工：

| 层 | 表达的信息 | 本项目的处理建议 |
| --- | --- | --- |
| UI 角色色 | 哪个操作主要、哪个控件被选中、是否发生错误 | `action`、`selected`、`focus`、`status` 分角色；随候选界面方案变化 |
| 材料分类色 | 当前层是什么材料 | 金属金／灰、InP 青绿、InGaAs 橙、InGaAsP 金褐保持跨视图一致；配材料名称、层序号或缩写 |
| 光谱系列色 | 哪条曲线属于哪个物理量、模型或材料 | 同一对象保持一致；用实线／虚线、端点标记和文字图例补充。若曲线对应材料，应复用材料身份，而非重新随机分配 |
| 连续热图 | 响应度、吸收或其他连续数值的大小 | 采用独立 sequential 色带，并明确单位、最小／最大值与刻度；不得用材料类别色拼成渐变 |

Matplotlib 推荐对许多连续数据使用感知均匀、明度单调的色图，并将 `viridis`、`plasma`、`inferno`、`magma`、`cividis` 列为感知均匀 sequential；只有数据围绕有意义的中心值变化时才使用 diverging。[Choosing Colormaps](https://matplotlib.org/stable/users/explain/colors/colormaps.html)。**应用判断：**厚度扫描得到的非负响应度／吸收强度优先比较 `cividis` 与 `viridis`；只有在画“相对基准的正负变化”时另设 diverging 色带。

`cividis` 的原始研究将红绿色觉缺陷纳入优化目标，并报告近似一致的数据感知与线性递增的亮度。[Nuñez 等，2018，原始论文](https://doi.org/10.1371/journal.pone.0199239)。**应用判断：**重视打印和色觉差异时，可把 `cividis` 作为优先候选，但仍应检查实际热图、标注和灰度导出效果；这不是对所有视觉障碍的通用保证。

Matplotlib 将数据到色彩的映射分为归一化与色图查表两步，默认按 `vmin`／`vmax` 线性映射。[Colormap normalization](https://matplotlib.org/stable/users/explain/colors/colormapnorms.html)。**应用判断：**两次扫描并排比较时应固定相同数值范围；若采用自动范围，必须清楚显示每张图的色标范围。需要对数尺度时，图例应明确注明。

ColorBrewer 提供色觉友好、打印友好、复印友好筛选，且可导出 JavaScript 数组和 CSS 类。[ColorBrewer 2.0](https://colorbrewer2.org/)。**应用判断：**它更适合挑选有限类别或分级色；连续热图宜使用经过验证的密集色表，不宜随意取少数颜色插值后声称仍保持原色图的感知均匀性。原生 Canvas／SVG 渲染可以使用色表数据，无需引入 Python 或新的图表框架。

## 5. 小字、细线及色彩之外的信息

WCAG 2.2 的普通文字最低对比度为 4.5:1，大号文字为 3:1；大号文字的界定为 18 pt 常规或 14 pt 粗体及相应等效尺寸。阈值不能四舍五入。官方还提示，细笔画和抗锯齿可能让视觉效果弱于按 CSS 色值计算的结果。[SC 1.4.3 Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)。**应用判断：**本软件的参数标签、单位、轴刻度、辅助说明和 12–14 px 表格文字统一按至少 4.5:1 验证；不要因其叫“次要文字”就降低标准。

必要的控件识别信息、状态提示及用于理解图形的部分，应对相邻颜色至少达到 3:1；这一条并不要求所有装饰边框都达到 3:1，也不要求未相邻显示的 hover 与 normal 色互相达到 3:1。细图线建议保留对比度余量。[SC 1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)。**应用判断：**验证重点是曲线对绘图区、焦点标记对其背景、输入边界在需要它识别控件时的对比。必要曲线不使用极细、极浅笔画。

WCAG 1.4.1 要求不能仅以颜色传达含义；颜色可与文字、形状、图案等共同使用。[SC 1.4.1 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)。**应用判断：**材料色保留名称和层序号，曲线保留线型／点型，错误保留图标与说明，选中行保留标记；连续热图还应提供带单位的色标、可读取的数值及数据表／导出入口。换一套“色盲友好”颜色并不能独自完成这些工作。

以上数值仅是本次配色筛选依据，不构成对软件整体 WCAG 符合性的审计结论。最终色值和实际界面的验证由主调研报告记录。
