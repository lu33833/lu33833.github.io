# 开发说明

[返回首页](../README.md) · [使用说明](usage.md) · [界面设计](design.md)

## 本地开发

项目使用原生浏览器模块，没有构建步骤，要求 Node.js 20 或更高版本。
安装开发依赖后启动服务：

```sh
npm ci
npm start
```

默认地址为 [http://127.0.0.1:4173/](http://127.0.0.1:4173/)。
修改文件后刷新页面即可，服务不缓存前端资源，也不自动刷新浏览器。

端口被占用时，可在 PowerShell 中设置 `PORT`：

```powershell
$env:PORT = '4174'
npm start
```

## 文件分工

| 文件 | 内容 |
| --- | --- |
| [index.html](../index.html) | 页面区域、字段和按钮文案 |
| [src/app.js](../src/app.js) | 页面状态、输入校验、扫描调度和事件绑定 |
| [src/charts.js](../src/charts.js) | 光谱、场强和厚度扫描的画布绘制 |
| [src/exports.js](../src/exports.js) | JSON、CSV、SVG 文件生成与下载 |
| [src/ui-utils.js](../src/ui-utils.js) | 数值显示、范围限制和模板文本转义 |
| [src/ui-config.js](../src/ui-config.js) | 初始参数、层参数覆盖、图表颜色和剖面灰阶 |
| [src/layer-grid.js](../src/layer-grid.js) | AG Grid 列配置、单元格编辑和行操作 |
| [src/styles.css](../src/styles.css) | 配色、尺寸、组件样式和响应式布局 |
| [src/tmm-core.js](../src/tmm-core.js) | 材料数据与光学计算 |
| [scripts/serve.mjs](../scripts/serve.mjs) | 本地静态服务 |
| [scripts/vendor.mjs](../scripts/vendor.mjs) | 复制 AG Grid、生成 Lucide 图标并保存许可证 |
| [tests/core.test.mjs](../tests/core.test.mjs) | 计算代码和数值结果的回归检查 |

绘图与导出函数显式接收计算结果，页面负责管理当前输入和结果是否过期。
修改图表外观时查看 `charts.js`，修改下载文件时查看 `exports.js`，两者共用配色与格式化函数。

## 调整参数和界面

常用设置集中在 [src/ui-config.js](../src/ui-config.js)：

| 配置 | 修改内容 |
| --- | --- |
| `MODEL_DEFAULTS` | 初始波长、光谱采样数和模型设置 |
| `LAYER_OVERRIDES` | 按层 id 覆盖初始名称、厚度或 n/k |
| `SCAN_DEFAULTS` | 单层、双层扫描的范围和采样数 |
| `CHART_COLORS` | 曲线、图例、坐标、场强填色和网格颜色 |
| `SPECTRUM_PADDING`、`RESPONSIVITY_AXIS_MAX`、`CHART_FONT` | 光谱边距、响应度轴上限和图表字体 |
| `HEAT_STOPS` | 热图从低值到高值的色阶 |
| `PROFILE_GRAY` | 结构剖面的浅灰、深灰端点 |

例如，替换文件中的这两项配置，可以调整初始波长和 spacer-x 层厚度：

```js
export const MODEL_DEFAULTS = {
  ...DEFAULT_SETTINGS,
  targetWavelength: 1327,
};

export const LAYER_OVERRIDES = {
  'spacer-x': { thickness: 103.7 },
};
```

刷新后生效，「恢复默认」也会使用这些值。
结果通过计算生成，修改展示数据时应调整输入参数，再运行仿真。

页面留白、剖面宽度、行高等在 [src/styles.css](../src/styles.css) 开头的变量中。
列宽和手机端列顺序在 [src/layer-grid.js](../src/layer-grid.js)，颜色用途见 [配色说明](color-research.md)。

## 代码格式与注释

使用 2 空格缩进，Prettier 的目标行宽为 100 字符，配置见 [.prettierrc.json](../.prettierrc.json)。

```sh
npm run format
npm run format:check
```

注释用简短中文，末尾不加句号。
较长的逻辑按用途分段说明，重点写清单位、层序、计算步骤、输入约束和结果何时失效。
HTML / SVG 模板前的 `/* HTML */` 注释用于帮助格式化工具展开模板。
`htmlWhitespaceSensitivity` 设为 `ignore`，让起止标签保持完整；修改行内文字后仍需检查实际间距。
多项局部变量各占一条声明，名称说明用途，避免把多步计算挤在一行。

计算核心保留原公式排版，第三方分发文件保留上游格式，两者不参与自动格式化。
Markdown 手工维护，正文按语义换行；标题按层级排列，表格用于字段和配置对照，命令块标明语言，内部链接使用相对路径。

## 更新本地组件

AG Grid Community 和 Lucide 的版本由 [package.json](../package.json) 与锁文件管理。
浏览器使用已生成的 `src/vendor-ag-grid.js` 和 `src/icons.js`，运行时无需访问 CDN。

依赖安装或版本更新后执行：

```sh
npm run vendor
npm run format:check
```

此命令会覆盖本地组件文件并同步 [第三方许可证](vendor-licenses.txt)。
需要更换图标时修改生成脚本中的图标列表，避免直接修改生成文件里的路径数据。

## 计算核心

来源为 `lu33833/lu33833.github.io` 的 `tools/pd-tmm-studio`，基准提交：

```text
6b843782146e81af73adeab6ba6bee16c6e7719e
```

当前计算公式、常量和数值基线沿用原项目，核心文件补充了独立行注释。
回归检查忽略独立行注释与空行，再核对其余代码的 SHA-256；预期值保存在测试文件中。
修改注释无需更新指纹，修改计算代码时需要重新核对模型和数值依据。

```sh
npm test
```

现有测试覆盖计算代码、默认光谱、模型开关、能量预算、收集效率、场强、双层扫描和输入不变性。
界面改动还应在浏览器中检查编辑、移动层、运行仿真、扫描和导出，并确认桌面与手机布局。

## 静态部署

将 `index.html` 与 `src/` 上传到同一静态站点目录，保持相对路径即可。
无需上传 `node_modules/`、测试文件或本地服务脚本，也不需要服务器端计算程序。

## 历史资料

旧设计说明在 [docs/archive](archive/design.md)，Figma 调整过程的 JSON 记录在 [archive/figma](archive/figma/README.md)。
这些记录用于追溯旧方案，当前布局和配色以现行文档与源码为准。
