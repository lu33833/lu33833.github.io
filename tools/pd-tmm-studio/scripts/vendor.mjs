import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { ArrowUp, ArrowDown, Trash, EllipsisVertical } from 'lucide';
import { format, resolveConfig } from 'prettier';

// 依赖更新后运行 npm run vendor，把浏览器需要的文件复制到 src
const root = new URL('../', import.meta.url);
await copyFile(
  new URL('node_modules/ag-grid-community/dist/ag-grid-community.min.noStyle.js', root),
  new URL('src/vendor-ag-grid.js', root),
);
const icons = { ArrowUp, ArrowDown, Trash, EllipsisVertical };
// 只导出表格使用的四个图标，沿用 Lucide 的路径数据
const iconSource = `// 由 scripts/vendor.mjs 从 Lucide 生成，路径数据在生成脚本中维护
// Lucide ISC 许可证见 docs/vendor-licenses.txt
const icons = ${JSON.stringify(icons, null, 2)};

// 在 SVG 命名空间内创建图标，颜色跟随所在按钮的文字色
export function createIcon(name) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  const attributes = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 2,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': true,
  };
  for (const [key, value] of Object.entries(attributes)) {
    svg.setAttribute(key, value);
  }
  // 图形元素和属性直接取自 Lucide 数据，避免手工改写路径
  for (const [tag, attrs] of icons[name]) {
    const child = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attrs)) {
      child.setAttribute(key, value);
    }
    svg.appendChild(child);
  }
  return svg;
}
`;
// 输出前使用项目格式配置，重新生成不会把代码压回长行
await writeFile(
  new URL('src/icons.js', root),
  await format(iconSource, {
    ...(await resolveConfig(new URL('../.prettierrc.json', import.meta.url))),
    parser: 'babel',
  }),
);
// 分发文件附带上游许可证
const agLicense = await readFile(
  new URL('node_modules/ag-grid-community/LICENSE.txt', root),
  'utf8',
);
const iconLicense = await readFile(new URL('node_modules/lucide/LICENSE', root), 'utf8');
await writeFile(
  new URL('docs/vendor-licenses.txt', root),
  `AG Grid Community\n${agLicense}\n\nLucide\n${iconLicense}`,
);
console.log('Local AG Grid bundle and four Lucide icons updated.');
