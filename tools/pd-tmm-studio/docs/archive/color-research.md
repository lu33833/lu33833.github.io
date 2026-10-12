# PD 外延光学工作台：成熟配色与 Figma 用色表

> 历史快照，归档于 2026-10-10；其中的方案、实施状态和验证记录只对应当时版本，当前说明见 [设计说明](../design.md) 与 [配色说明](../color-research.md)

2026-10-09 · 调研结论与手工设计参考

## 推荐结论

**优先采用 Radix Colors 的 Gray + Teal。**按本次反馈，将原 Sage 灰阶换成不带色相的 Gray：背景、文字和边界使用中性灰，青绿色用于按钮、选中和焦点等强调位置。希望界面更偏冷色仪器风格时，选 **Slate + Indigo**。**Sand + Bronze** 只作为暖色对照：它与本软件的金属金、吸收层橙和材料金褐比较接近，操作色与材料色较难分开。

Gray 是 Radix 官方的中性灰阶；Gray + Teal 是本项目为去除灰阶绿色倾向选用的组合。Slate + Indigo 是官方列出的自然配对；Sand + Bronze 是暖色对照。以下没有自创 UI HEX；白色作为独立工作面色。色值核对自 [Radix 官方源码](https://github.com/radix-ui/colors/blob/main/src/light.ts)，搭配依据见 [Composing a palette](https://www.radix-ui.com/colors/docs/palette-composition/composing-a-palette)。具体颜色对应哪个组件，是针对本软件的建议，并非官方成套主题。

## 这次依据的实际界面

- 查看的是本地 `pd-tmm-studio` 独立应用最新文件：横向导航、参数条、密集层表、连续材料剖面、响应图和厚度扫描。现有主色为 `#176A60`，背景为 `#F5F7F9`。
- 本地该独立目录没有 Git 元数据，因此以工作区文件为依据，不把它描述为已确认的 Git 分支。原工具站位于另一个目录。
- 已读取[你提供的 Figma 节点](https://www.figma.com/design/VnVWWBCN1UYaG9sWmAkQOA/Untitled?node-id=1-3)：检查时为名为 `Rectangle 1` 的 1920 × 1080 空白矩形，尚无界面组件。初次调研时仅查看；后续已导入配色变量和参考板，见文末记录。
- 配色参考保留现有材料识别方式、信息密度和浅色方向；只交付研究与参考文件，没有修改应用的 HTML、CSS、JavaScript 或计算核心。

## 为什么选这套成熟体系

| 体系 | 可借用内容 | 对本软件的判断 |
| --- | --- | --- |
| **Radix Colors** | 12 阶颜色有背景、交互填充、边界、文字等用途；有自然中性色搭配 | 最适合现在手工画 Figma：颜色数量可控，能延续青绿，也容易对应原生 CSS |
| **IBM Carbon White / Gray 10** | 中性灰分层，操作、文字、边界、状态分别命名 | 若希望整体靠企业级设计系统，可直接沿用 Carbon；本次主要借用它的颜色角色划分，不混搭其零散色值 |
| **Matplotlib 科学色图** | 连续数据使用感知均匀、明度有序的色图 | 用于厚度热图；不负责按钮、表格和材料分类色 |

来源：[Radix 色阶用途](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale)、[Carbon 色彩体系](https://www.carbondesignsystem.com/building-blocks/foundations/color/overview)、[Matplotlib 色图选择](https://matplotlib.org/stable/users/explain/colors/colormaps.html)。最后一列为本项目判断。

## 推荐 A：可直接录入 Figma 的颜色

浅色、sRGB、100% 不透明度。设计稿建议用下表的“用途名”命名，避免每个按钮都单独输入色值。

| Figma 用途名 | 官方色阶 | HEX | 对应位置 |
| --- | --- | --- | --- |
| `Canvas/Default` | Gray 2 | `#F9F9F9` | 页面大背景 |
| `Surface/Default` | White | `#FFFFFF` | 顶栏、面板、绘图区 |
| `Surface/Subtle` | Gray 3 | `#F0F0F0` | 表头、弱分组背景 |
| `Surface/Hover` | Gray 4 | `#E8E8E8` | 中性控件悬停 |
| `Text/Primary` | Gray 12 | `#202020` | 层名、数值、标题 |
| `Text/Secondary` | Gray 11 | `#646464` | 列标题、单位、辅助文字 |
| `Border/Subtle` | Gray 6 | `#D9D9D9` | 普通分隔线、面板边界 |
| `Border/Control` | Gray 9 | `#8D8D8D` | 白底上需要靠边界识别的输入控件 |
| `Action/Primary` | Teal 11 | `#008573` | 运行仿真、开始扫描 |
| `Action/Hover` | Teal 12 | `#0D3D38` | 主要按钮悬停／按下 |
| `Text/OnAction` | White | `#FFFFFF` | 主要按钮文字 |
| `Action/SelectedBg` | Teal 3 | `#E0F8F3` | 响应层行、选中项浅底 |
| `Text/Selected` | Teal 12 | `#0D3D38` | 浅青绿底上的选中项文字 |
| `Focus/Ring` | Teal 11 | `#008573` | 白色或浅灰控件外的焦点线 |
| `Status/ErrorText` | Red 11 | `#CE2C31` | 白底错误信息 |
| `Status/WarningText` | Amber 12 | `#4F3422` | 警告文字 |
| `Status/WarningBg` | Amber 3 | `#FFF7C2` | 必要的警告提示背景 |

这些映射有意与 Radix 的常见用法略有区别：主按钮用 Teal 11，必要控件边界用 Gray 9，以满足这里的普通小字和边界对比度需求；颜色本身仍为官方原值。页面保持中性色为主，强调色集中在主按钮、当前导航、选中项、焦点和少量关键结果，不把所有数值都染成青绿。

## 三套方案快速对照

| 用途 | A · Gray + Teal（推荐） | B · Slate + Indigo | C · Sand + Bronze |
| --- | --- | --- | --- |
| 页面 | Gray 2 `#F9F9F9` | Slate 2 `#F9F9FB` | Sand 2 `#F9F9F8` |
| 面板 | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` |
| 正文 | Gray 12 `#202020` | Slate 12 `#1C2024` | Sand 12 `#21201C` |
| 次文字 | Gray 11 `#646464` | Slate 11 `#60646C` | Sand 11 `#63635E` |
| 普通边界 | Gray 6 `#D9D9D9` | Slate 6 `#D9D9E0` | Sand 6 `#DAD9D6` |
| 主要按钮 | Teal 11 `#008573` | Indigo 9 `#3E63DD` | Bronze 11 `#7D5E54` |
| 按钮悬停 | Teal 12 `#0D3D38` | Indigo 10 `#3358D4` | Bronze 12 `#43302B` |
| 选中填充 | Teal 3 `#E0F8F3` | Indigo 3 `#EDF2FE` | Bronze 3 `#F6EDEA` |
| 选中项文字 | Teal 12 `#0D3D38` | Indigo 11 `#3A5BC7` | Bronze 12 `#43302B` |

完整官方基础色已整理在 [color-palettes.json](../color-palettes.json)。当前 A 方案使用 gray；原始 sage 色阶仅保留为来源参考，不再作为 A 方案灰阶。该文件是色值参考数据，不是宣称可以直接导入 Figma 的变量格式。

## 已核算的对比度

采用 WCAG 的 sRGB 相对亮度公式，本表显示值保留两位，判定使用未四舍五入值。普通文字最低 4.5:1；必要非文字识别信息一般按相邻背景 3:1 核验。仅检查列出的组合，不代表整个软件已经完成无障碍审计。[文字要求](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)、[非文字要求](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)。

| 实际组合 | 比值 | 结论 |
| --- | ---: | --- |
| 白字 / Teal 11 按钮 | 4.56:1 | 普通文字 AA 达标，余量较小 |
| 白字 / Indigo 9 按钮 | 5.21:1 | 普通文字 AA 达标 |
| 白字 / Bronze 11 按钮 | 5.83:1 | 普通文字 AA 达标 |
| Gray 11 / Gray 2 页面 | 5.62:1 | 次文字 AA 达标 |
| Teal 12 / Teal 3 选中背景 | 10.85:1 | 普通文字 AAA 达标 |
| 白字 / Teal 9 | 3.07:1 | 不用于普通小字按钮 |
| Teal 11 / Teal 3 | 4.10:1 | 不用于普通小字选中项 |
| 白字 / Bronze 9 | 3.59:1 | 不用于普通小字按钮 |

成熟色阶仍需检查实际组合。Radix 文档包含 APCA 相关保证，不能直接等同于任意前景背景都满足 WCAG 4.5:1。若希望按钮留出更多余量，可直接用官方 Teal 12 配白字；不要通过降低按钮透明度来获得“柔和”效果。

现有界面并非整体对比度不足：原主色 `#176A60` 配白字约 6.43:1，次文字 `#64737D` 配白底约 4.90:1；层序文字 `#7B8E9A` 配白底约 3.40:1，更值得调整。

## 科研图形的颜色如何处理

**材料剖面保留现有分类色。**Au `#D5AA39`、Ti `#777B80`、InP 基准 `#50837A`、InGaAs 基准 `#DF744C`、Q1.03 `#B99B51`。默认层结构中同族材料还有明度变体，响应层为 `#E67C52`；不要把参考板的五个代表色误当成对所有材料变体的重置。

现有 `src/app.js` 的 `printLayerColor()` 与屏幕材料色映射不同，例如导出 InP 为蓝色。后续设计稿应明确“屏幕／打印”是否允许不同映射，避免把两套颜色混进同一个图例。这是发现的设计一致性问题，本轮未修改导出。

金色和浅橙色材料块上不要机械套白字。以纯色端点计算，Au 金底配白字约 2.18:1、响应层橙底配白字约 2.85:1；实际页面有渐变，需按文字实际覆盖区域检查。手工设计时可保留材料底色，采用深色文字，或给文字加稳定深底标签。名称、厚度、响应层标记继续存在。

**光谱保留蓝／橙分工。**当前响应度 `#3569A6`、吸收率 `#C66A3D` 对白底分别约 5.64:1、3.80:1，作为必要图线均超过 3:1；橙色不适合兼任普通小字。图例文字用中性色，并增加实线／虚线或点型区分。不要把曲线全换为 UI 主色。

**连续热图单独选择科学色图。**先比较现有连续青绿与 Matplotlib 的 `cividis`／`viridis`，不要直接将 Radix 的 12 阶 UI 色板当作感知均匀科学色图。非负响应度适合 sequential；只在比较相对基准的正负变化时使用 diverging。Figma 中用真实热图图片或 SVG 放入绘图区，保留数值色标；不要手画几个渐变停点并称其为原版 cividis。[Matplotlib 色图选择](https://matplotlib.org/stable/users/explain/colors/colormaps.html)。

## 在你的 Figma 文件里手工开始

1. 建立真正的 1920 × 1080 Frame 作为首张桌面稿，将已有空白矩形用作背景或替换为 Frame 的填充。先沿用本地工作台布局，固定表格密度与材料剖面，便于只比较配色。
2. 把 [color-reference.svg](../color-reference.svg) 拖入画布旁边当参考板。SVG 内有色块、HEX 和按钮／选中项示例；导入图形不会自动建立颜色变量。
3. 在颜色变量里先建基础色，例如 `Gray/2`、`Gray/11`、`Teal/11`；再用用途名引用它们，例如 `Canvas/Default → Gray/2`、`Action/Primary → Teal/11`。只录入表中用到的颜色，不必一开始建全库。变量可以使用 alias 引用其他变量，见 [Figma 官方变量指南](https://help.figma.com/hc/en-us/articles/15145852043927-Create-and-manage-variables-and-collections)。
4. 优先画一组真实组件：层表中的普通行与响应层行、运行按钮的常态／悬停、一个有焦点的输入框、一段材料剖面、一个带坐标的响应曲线。选定颜色后再铺开三个工作区。

## 交付文件

- [配色参考板 SVG](../color-reference.svg)：可拖入 Figma。
- [配色参考板 PNG](../color-reference.png)：快速查看。
- [官方颜色数据](../color-palettes.json)：按色系保存的准确 HEX。
- [对比度计算结果](../color-contrast.json)：三套关键组合的原始精度数值。
- [一手来源笔记](color-research-sources.md)：设计系统、科学色图、可读性依据。

参考板已渲染目视检查，应用源文件与计算核心未改动。本报告是配色与手工设计参考，不是已完成的 Figma 前端设计稿。

## 后续：已通过 MCP 导入 Figma

用户随后要求直接通过 MCP 传入。已在原 Figma 文件中建立[可编辑配色参考板](https://www.figma.com/design/VnVWWBCN1UYaG9sWmAkQOA/Untitled?node-id=7-2)，放在现有画布右侧。

- `PD · Radix 基础色`：76 个变量，包含三套方案的六组完整官方色阶及必要状态色。
- `PD · 界面用途色 A`：17 个用途变量，全部引用基础色；手工设计优先从这个集合选色。
- `PD · 科研图色`：10 个现有材料／光谱变量，独立于 UI 主题。
- 参考板为原生可编辑图层，颜色已绑定变量；变量作用范围、CSS 对应名称和 17 个别名已核验，参考板渲染通过目视检查。原有节点和应用源代码保留。
- 导入记录见 `figma-color-import-state.json` 与 `figma-color-board-state.json`。

## 更新：去除灰阶中的绿色倾向

2026-10-09：根据反馈，将推荐 A 从 Sage + Teal 调整为 **Gray + Teal**。12 阶 Gray 全部采用 Radix 官方原值，RGB 三通道相等，不带绿、蓝或暖色倾向。白色工作面继续使用 `#FFFFFF`。

Figma 的 12 个基础变量在原 ID 上重命名为 `Gray/1` 至 `Gray/12` 并更新值，17 个用途变量的别名引用保留；参考板名称和 HEX 标签同步更新。已绑定变量的图层自动跟随，手动填入的固定 HEX 不会自动替换。Teal 操作色、其他两套对照方案及材料／科学图色保持原值。

| 核验组合 | 对比度 | 结果 |
| --- | ---: | --- |
| Gray 12 正文 / Gray 2 页面 | 15.48:1 | 普通文字 AAA |
| Gray 11 次文字 / Gray 2 页面 | 5.62:1 | 普通文字 AA |
| Gray 9 控件边框 / 白色 | 3.32:1 | 必要边界超过 3:1 |

本地 SVG、PNG、颜色数据、对比度和本报告已同步。Figma 变更及验证记录：`figma-neutral-update-state.json`。
