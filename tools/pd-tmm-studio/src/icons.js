// 由 scripts/vendor.mjs 从 Lucide 生成，路径数据在生成脚本中维护
// Lucide ISC 许可证见 docs/vendor-licenses.txt
const icons = {
  ArrowUp: [
    [
      'path',
      {
        d: 'm5 12 7-7 7 7',
      },
    ],
    [
      'path',
      {
        d: 'M12 19V5',
      },
    ],
  ],
  ArrowDown: [
    [
      'path',
      {
        d: 'M12 5v14',
      },
    ],
    [
      'path',
      {
        d: 'm19 12-7 7-7-7',
      },
    ],
  ],
  Trash: [
    [
      'path',
      {
        d: 'M10 11v6',
      },
    ],
    [
      'path',
      {
        d: 'M14 11v6',
      },
    ],
    [
      'path',
      {
        d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
      },
    ],
    [
      'path',
      {
        d: 'M3 6h18',
      },
    ],
    [
      'path',
      {
        d: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
      },
    ],
  ],
  EllipsisVertical: [
    [
      'circle',
      {
        cx: '12',
        cy: '12',
        r: '1',
      },
    ],
    [
      'circle',
      {
        cx: '12',
        cy: '5',
        r: '1',
      },
    ],
    [
      'circle',
      {
        cx: '12',
        cy: '19',
        r: '1',
      },
    ],
  ],
};

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
