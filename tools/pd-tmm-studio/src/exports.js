import { CHART_COLORS, RESPONSIVITY_AXIS_MAX, layerTone, heatColor } from './ui-config.js';
import { clamp, formatNumber, escapeHtml } from './ui-utils.js';

// 数据与图形导出
// 用临时对象地址触发下载，点击完成后再释放地址
function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 每个波长输出一行，列名和列值顺序需要一起修改
export function exportCsv(result) {
  if (!result) return;
  const lines = [
    [
      'wavelength_nm',
      'target_n',
      'target_k',
      'target_alpha_cm-1',
      'target_absorption',
      'responsivity_A_W',
      'reflectance',
      'transmittance',
      'parasitic_absorption',
    ].join(','),
    ...result.spectrum.map((p) =>
      [
        p.wavelength,
        p.targetN,
        p.targetK,
        p.targetAlphaCm,
        p.absorption,
        p.responsivity,
        p.reflectance,
        p.transmittance,
        p.parasitic,
      ].join(','),
    ),
  ];
  download('pd-tmm-spectrum.csv', lines.join('\n'), 'text/csv;charset=utf-8');
}

// 交换文件按显示顺序保存层名、材料和厚度，模型设置不在此格式中
export function exportJson(layers) {
  download(
    'pd-tmm-structure.json',
    JSON.stringify(
      {
        version: 1,
        stackOrder: 'top-to-bottom',
        layers: [...layers]
          .reverse()
          .map(({ name, material, thickness }) => ({ name, material, thickness })),
      },
      null,
      2,
    ),
    'application/json',
  );
}

// 把计算点转成 SVG 路径，坐标保留两位小数以控制文件大小
function svgPolyline(points, xMap, yMap, valueOf) {
  return points
    .map((point, index) => {
      const x = xMap(point.wavelength).toFixed(2);
      const y = yMap(valueOf(point)).toFixed(2);
      return `${index ? 'L' : 'M'} ${x} ${y}`;
    })
    .join(' ');
}

// 导出使用本次仿真的层快照，标题和曲线始终对应同一份结构
// 单轴和双轴共用曲线数据及波长刻度
export function exportSpectrumSvg(result, settings, simulatedLayers, responsivityOnly = false) {
  if (!result) return;
  const points = result.spectrum;
  const xMin = points[0].wavelength;
  const xMax = points.at(-1).wavelength;
  const width = 1200;
  const height = 760;
  const margin = {
    left: 112,
    right: responsivityOnly ? 60 : 112,
    top: 126,
    bottom: 94,
  };
  const plot = {
    x: margin.left,
    y: margin.top,
    w: width - margin.left - margin.right,
    h: height - margin.top - margin.bottom,
  };
  const xMap = (value) => plot.x + ((value - xMin) / Math.max(1e-12, xMax - xMin)) * plot.w;
  const absorptionMap = (value) => plot.y + plot.h - (clamp(value, 0, 100) / 100) * plot.h;
  const responsivityMap = (value) =>
    plot.y + plot.h - (clamp(value, 0, RESPONSIVITY_AXIS_MAX) / RESPONSIVITY_AXIS_MAX) * plot.h;
  const targetInRange = settings.targetWavelength >= xMin && settings.targetWavelength <= xMax;
  const xTicks = Array.from({ length: 6 }, (_, index) => xMin + ((xMax - xMin) * index) / 5);
  const title = responsivityOnly
    ? 'Photodetector responsivity spectrum'
    : 'Target-layer absorption and responsivity';
  let svg = /* HTML */ `
    <rect width="${width}" height="${height}" fill="#ffffff" />
  `;
  svg += /* HTML */ `
    <text
      x="${plot.x}"
      y="48"
      fill="#111827"
      font-family="Arial,Helvetica,sans-serif"
      font-size="30"
      font-weight="700"
    >
      ${title}
    </text>
  `;
  svg += /* HTML */ `
    <text
      x="${plot.x}"
      y="79"
      fill="#4b5563"
      font-family="Arial,Helvetica,sans-serif"
      font-size="16"
    >
      ${escapeHtml(simulatedLayers.find((layer) => layer.target)?.name || 'Target layer')} ·
      ${formatNumber(xMin, 0)}–${formatNumber(xMax, 0)} nm · fixed scientific axes
    </text>
  `;
  // 横轴包含主刻度和半格辅助线，导出尺寸独立于浏览器窗口
  xTicks.forEach((value, index) => {
    const x = xMap(value);
    if (index < 5) {
      const minor = xMap((value + xTicks[index + 1]) / 2);
      svg += /* HTML */ `
        <line
          x1="${minor}"
          y1="${plot.y}"
          x2="${minor}"
          y2="${plot.y + plot.h}"
          stroke="#edf0f2"
          stroke-width="1"
        />
      `;
    }
    svg += /* HTML */ `
      <line
        x1="${x}"
        y1="${plot.y}"
        x2="${x}"
        y2="${plot.y + plot.h}"
        stroke="#d9dee3"
        stroke-width="1"
      />
      <line
        x1="${x}"
        y1="${plot.y + plot.h}"
        x2="${x}"
        y2="${plot.y + plot.h + 8}"
        stroke="#111827"
        stroke-width="2"
      />
      <text
        x="${x}"
        y="${plot.y + plot.h + 31}"
        text-anchor="middle"
        fill="#111827"
        font-family="Arial,Helvetica,sans-serif"
        font-size="16"
      >
        ${formatNumber(value, Math.abs(value - Math.round(value)) > 0.001 ? 1 : 0)}
      </text>
    `;
  });
  // 单轴画响应度刻度，双轴分别标出吸收率和响应度
  if (responsivityOnly) {
    for (let index = 0; index <= 6; index++) {
      const value = index * 0.2;
      const y = responsivityMap(value);
      svg += /* HTML */ `
        <line
          x1="${plot.x}"
          y1="${y}"
          x2="${plot.x + plot.w}"
          y2="${y}"
          stroke="#d9dee3"
          stroke-width="1"
        />
        <line
          x1="${plot.x - 8}"
          y1="${y}"
          x2="${plot.x}"
          y2="${y}"
          stroke="#111827"
          stroke-width="2"
        />
        <text
          x="${plot.x - 15}"
          y="${y + 5}"
          text-anchor="end"
          fill="#111827"
          font-family="Arial,Helvetica,sans-serif"
          font-size="16"
        >
          ${value.toFixed(1)}
        </text>
      `;
    }
  } else {
    for (let index = 0; index <= 5; index++) {
      const value = index * 20;
      const y = absorptionMap(value);
      svg += /* HTML */ `
        <line
          x1="${plot.x}"
          y1="${y}"
          x2="${plot.x + plot.w}"
          y2="${y}"
          stroke="#d9dee3"
          stroke-width="1"
        />
        <line
          x1="${plot.x - 8}"
          y1="${y}"
          x2="${plot.x}"
          y2="${y}"
          stroke="#111827"
          stroke-width="2"
        />
        <text
          x="${plot.x - 15}"
          y="${y + 5}"
          text-anchor="end"
          fill="#111827"
          font-family="Arial,Helvetica,sans-serif"
          font-size="16"
        >
          ${value}%
        </text>
      `;
    }
    for (let index = 0; index <= 6; index++) {
      const value = index * 0.2;
      const y = responsivityMap(value);
      svg += /* HTML */ `
        <line
          x1="${plot.x + plot.w}"
          y1="${y}"
          x2="${plot.x + plot.w + 8}"
          y2="${y}"
          stroke="#111827"
          stroke-width="2"
        />
        <text
          x="${plot.x + plot.w + 15}"
          y="${y + 5}"
          fill="#111827"
          font-family="Arial,Helvetica,sans-serif"
          font-size="16"
        >
          ${value.toFixed(1)}
        </text>
      `;
    }
  }
  // 坐标框与轴标题
  svg += /* HTML */ `
    <rect
      x="${plot.x}"
      y="${plot.y}"
      width="${plot.w}"
      height="${plot.h}"
      fill="none"
      stroke="#111827"
      stroke-width="2"
    />
  `;
  svg += /* HTML */ `
    <text
      x="${plot.x + plot.w / 2}"
      y="${height - 28}"
      text-anchor="middle"
      fill="#111827"
      font-family="Arial,Helvetica,sans-serif"
      font-size="18"
    >
      Wavelength (nm)
    </text>
  `;
  svg += /* HTML */ `
    <text
      x="34"
      y="${plot.y + plot.h / 2}"
      transform="rotate(-90 34 ${plot.y + plot.h / 2})"
      text-anchor="middle"
      fill="#111827"
      font-family="Arial,Helvetica,sans-serif"
      font-size="18"
    >
      ${responsivityOnly ? 'Responsivity (A/W)' : 'Absorption efficiency (%)'}
    </text>
  `;
  // 先输出吸收曲线，再输出响应曲线
  if (!responsivityOnly)
    svg += /* HTML */ `
      <text
        x="${width - 24}"
        y="${plot.y + plot.h / 2}"
        transform="rotate(90 ${width - 24} ${plot.y + plot.h / 2})"
        text-anchor="middle"
        fill="#111827"
        font-family="Arial,Helvetica,sans-serif"
        font-size="18"
      >
        Responsivity (A/W)
      </text>
    `;
  if (!responsivityOnly)
    svg += /* HTML */ `
      <path
        d="${svgPolyline(points, xMap, absorptionMap, (point) => point.absorption * 100)}"
        fill="none"
        stroke="${CHART_COLORS.absorption}"
        stroke-width="4"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
    `;
  svg += /* HTML */ `
    <path
      d="${svgPolyline(points, xMap, responsivityMap, (point) => point.responsivity)}"
      fill="none"
      stroke="${CHART_COLORS.responsivity}"
      stroke-width="4"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
  `;
  if (!responsivityOnly)
    svg += /* HTML */ `
      <line
        x1="${plot.x + 18}"
        y1="103"
        x2="${plot.x + 56}"
        y2="103"
        stroke="${CHART_COLORS.absorption}"
        stroke-width="4"
      />
      <text
        x="${plot.x + 66}"
        y="109"
        fill="#111827"
        font-family="Arial,Helvetica,sans-serif"
        font-size="16"
      >
        Absorption
      </text>
      <line
        x1="${plot.x + 190}"
        y1="103"
        x2="${plot.x + 228}"
        y2="103"
        stroke="${CHART_COLORS.responsivity}"
        stroke-width="4"
      />
      <text
        x="${plot.x + 238}"
        y="109"
        fill="#111827"
        font-family="Arial,Helvetica,sans-serif"
        font-size="16"
      >
        Responsivity
      </text>
    `;
  // 目标波长标签限制在绘图区内，避免导出时被边缘裁掉
  if (targetInRange) {
    const tx = xMap(settings.targetWavelength);
    const target = result.target;
    const annotation = responsivityOnly
      ? `${formatNumber(settings.targetWavelength, 0)} nm · ${formatNumber(target.responsivity, 4)} A/W`
      : [
          `${formatNumber(settings.targetWavelength, 0)} nm`,
          `A ${formatNumber(target.absorption * 100, 2)}%`,
          `R ${formatNumber(target.responsivity, 4)} A/W`,
        ].join(' · ');
    svg += /* HTML */ `
      <line
        x1="${tx}"
        y1="${plot.y}"
        x2="${tx}"
        y2="${plot.y + plot.h}"
        stroke="#6b7280"
        stroke-width="2"
        stroke-dasharray="8 7"
      />
    `;
    if (!responsivityOnly)
      svg += /* HTML */ `
        <circle
          cx="${tx}"
          cy="${absorptionMap(target.absorption * 100)}"
          r="6"
          fill="${CHART_COLORS.absorption}"
          stroke="#fff"
          stroke-width="2"
        />
      `;
    svg += /* HTML */ `
      <circle
        cx="${tx}"
        cy="${responsivityMap(target.responsivity)}"
        r="6"
        fill="${CHART_COLORS.responsivity}"
        stroke="#fff"
        stroke-width="2"
      />
      <rect
        x="${clamp(tx - 150, plot.x + 8, plot.x + plot.w - 308)}"
        y="${plot.y + 15}"
        width="300"
        height="36"
        rx="3"
        fill="#fff"
        stroke="#6b7280"
      />
      <text
        x="${clamp(tx, plot.x + 158, plot.x + plot.w - 158)}"
        y="${plot.y + 39}"
        text-anchor="middle"
        fill="#111827"
        font-family="Arial,Helvetica,sans-serif"
        font-size="15"
        font-weight="700"
      >
        ${annotation}
      </text>
    `;
  }
  const name = responsivityOnly ? 'pd-tmm-responsivity.svg' : 'pd-tmm-spectrum-dual-axis.svg';
  download(
    name,
    /* HTML */ `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="${width}"
        height="${height}"
        viewBox="0 0 ${width} ${height}"
      >
        ${svg}
      </svg>
    `,
    'image/svg+xml',
  );
}

// 导出单层扫描曲线，并在图内标出层名、波长和采样最优值
export function exportSingleScanSvg(singleScanResult) {
  if (!singleScanResult) return;
  const { points, optimum, layerName, wavelength } = singleScanResult;
  const width = 1100;
  const height = 700;
  const plot = { x: 105, y: 112, w: 925, h: 500 };
  const xMin = points[0].thickness;
  const xMax = points.at(-1).thickness;
  const xMap = (value) => plot.x + ((value - xMin) / Math.max(1e-12, xMax - xMin)) * plot.w;
  const yMap = (value) =>
    plot.y + plot.h - (clamp(value, 0, RESPONSIVITY_AXIS_MAX) / RESPONSIVITY_AXIS_MAX) * plot.h;
  let svg = /* HTML */ `
    <rect width="${width}" height="${height}" fill="#ffffff" />
    <text
      x="${plot.x}"
      y="46"
      fill="#111827"
      font-family="Arial,Helvetica,sans-serif"
      font-size="29"
      font-weight="700"
    >
      Single-layer thickness sweep
    </text>
    <text
      x="${plot.x}"
      y="78"
      fill="#4b5563"
      font-family="Arial,Helvetica,sans-serif"
      font-size="16"
    >
      ${escapeHtml(layerName)} · ${formatNumber(wavelength, 0)} nm · responsivity
    </text>
  `;
  // 厚度刻度按扫描范围均分，较小范围保留一位小数
  for (let i = 0; i <= 5; i++) {
    const value = xMin + ((xMax - xMin) * i) / 5;
    const x = xMap(value);
    svg += /* HTML */ `
      <line x1="${x}" y1="${plot.y}" x2="${x}" y2="${plot.y + plot.h}" stroke="#d9dee3" />
      <line
        x1="${x}"
        y1="${plot.y + plot.h}"
        x2="${x}"
        y2="${plot.y + plot.h + 8}"
        stroke="#111827"
        stroke-width="2"
      />
      <text
        x="${x}"
        y="${plot.y + plot.h + 31}"
        text-anchor="middle"
        fill="#111827"
        font-family="Arial,Helvetica,sans-serif"
        font-size="16"
      >
        ${formatNumber(value, Math.abs(xMax - xMin) < 20 ? 1 : 0)}
      </text>
    `;
  }
  // 响应度刻度与页面使用相同的上限
  for (let i = 0; i <= 6; i++) {
    const value = i * 0.2;
    const y = yMap(value);
    svg += /* HTML */ `
      <line x1="${plot.x}" y1="${y}" x2="${plot.x + plot.w}" y2="${y}" stroke="#d9dee3" />
      <line
        x1="${plot.x - 8}"
        y1="${y}"
        x2="${plot.x}"
        y2="${y}"
        stroke="#111827"
        stroke-width="2"
      />
      <text
        x="${plot.x - 15}"
        y="${y + 5}"
        text-anchor="end"
        fill="#111827"
        font-family="Arial,Helvetica,sans-serif"
        font-size="16"
      >
        ${value.toFixed(1)}
      </text>
    `;
  }
  // 曲线路径和最优点共用坐标映射
  const path = points
    .map((point, index) => {
      const x = xMap(point.thickness).toFixed(2);
      const y = yMap(point.responsivity).toFixed(2);
      return `${index ? 'L' : 'M'} ${x} ${y}`;
    })
    .join(' ');
  const ox = xMap(optimum.thickness);
  const oy = yMap(optimum.responsivity);
  svg += /* HTML */ `
    <rect
      x="${plot.x}"
      y="${plot.y}"
      width="${plot.w}"
      height="${plot.h}"
      fill="none"
      stroke="#111827"
      stroke-width="2"
    />
    <path
      d="${path}"
      fill="none"
      stroke="${CHART_COLORS.responsivity}"
      stroke-width="4"
      stroke-linejoin="round"
    />
    <circle
      cx="${ox}"
      cy="${oy}"
      r="7"
      fill="${CHART_COLORS.responsivity}"
      stroke="#fff"
      stroke-width="2"
    />
    <text
      x="${plot.x + plot.w / 2}"
      y="${height - 25}"
      text-anchor="middle"
      fill="#111827"
      font-family="Arial,Helvetica,sans-serif"
      font-size="18"
    >
      Thickness (nm)
    </text>
    <text
      x="30"
      y="${plot.y + plot.h / 2}"
      transform="rotate(-90 30 ${plot.y + plot.h / 2})"
      text-anchor="middle"
      fill="#111827"
      font-family="Arial,Helvetica,sans-serif"
      font-size="18"
    >
      Responsivity (A/W)
    </text>
    <text
      x="${clamp(ox, plot.x + 135, plot.x + plot.w - 135)}"
      y="${Math.max(plot.y + 25, oy - 18)}"
      text-anchor="middle"
      fill="#111827"
      font-family="Arial,Helvetica,sans-serif"
      font-size="15"
      font-weight="700"
    >
      Peak ${formatNumber(optimum.thickness, 2)} nm · ${formatNumber(optimum.responsivity, 4)} A/W
    </text>
  `;
  download(
    'pd-tmm-single-thickness-scan.svg',
    /* HTML */ `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="${width}"
        height="${height}"
        viewBox="0 0 ${width} ${height}"
      >
        ${svg}
      </svg>
    `,
    'image/svg+xml',
  );
}

// 使用与页面相同的层序和灰阶，导出行高固定以便排版
export function exportStructureSvg(layers) {
  const ordered = [...layers].reverse();
  const width = 440;
  const rowHeight = 36;
  const top = 76;
  const height = top + ordered.length * rowHeight + 48;
  let body = /* HTML */ `
    <rect width="${width}" height="${height}" fill="#fff" />
    <text x="20" y="32" font-size="18">结构剖面</text>
    <text x="420" y="32" text-anchor="end" fill="#757575">
      ${formatNumber(
        layers.reduce((sum, layer) => sum + layer.thickness, 0),
        1,
      )}
      nm
    </text>
  `;
  ordered.forEach((layer, index) => {
    const y = top + index * rowHeight;
    const tone = layerTone(layer.thickness, layers);
    body += /* HTML */ `
      <rect x="20" y="${y}" width="400" height="32" fill="${tone.background}" />
      <text x="28" y="${y + 21}" fill="${tone.text}">${escapeHtml(layer.name)}</text>
      <text x="412" y="${y + 21}" text-anchor="end" fill="${tone.text}">${layer.thickness} nm</text>
    `;
  });
  body += /* HTML */ `
    <text x="20" y="${height - 16}" fill="#757575">↑ 衬底入射</text>
  `;
  download(
    'pd-tmm-structure.svg',
    /* HTML */ `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="${width}"
        height="${height}"
        viewBox="0 0 ${width} ${height}"
        font-family="Arial,Microsoft YaHei,sans-serif"
        font-size="14"
      >
        ${body}
      </svg>
    `,
    'image/svg+xml',
  );
}

// 每个采样点输出一个矩形，色标和最优点取自同一份扫描结果
export function exportHeatmapSvg(scanResult) {
  if (!scanResult) return;
  const width = 1100;
  const height = 660;
  const plot = { x: 80, y: 56, w: 900, h: 520 };
  const { xValues, yValues, values, min, max, optimum } = scanResult;
  const cw = plot.w / xValues.length;
  const ch = plot.h / yValues.length;
  let body = /* HTML */ `
    <rect width="${width}" height="${height}" fill="#fff" />
  `;
  values.forEach((row, yi) =>
    row.forEach((value, xi) => {
      body += /* HTML */ `
        <rect
          x="${plot.x + xi * cw}"
          y="${plot.y + (yValues.length - 1 - yi) * ch}"
          width="${cw + 0.1}"
          height="${ch + 0.1}"
          fill="${heatColor(value, min, max)}"
        />
      `;
    }),
  );
  for (let i = 0; i <= 4; i++) {
    const xi = Math.round(((xValues.length - 1) * i) / 4);
    const yi = Math.round(((yValues.length - 1) * i) / 4);
    body += /* HTML */ `
      <text x="${plot.x + (xi + 0.5) * cw}" y="${plot.y + plot.h + 28}" text-anchor="middle">
        ${formatNumber(xValues[xi], 1)}
      </text>
      <text x="${plot.x - 12}" y="${plot.y + plot.h - (yi + 0.5) * ch + 5}" text-anchor="end">
        ${formatNumber(yValues[yi], 1)}
      </text>
    `;
  }
  // 用细矩形拼出色标，缩放时仍保持矢量形状
  for (let i = 0; i < 100; i++)
    body += /* HTML */ `
      <rect
        x="1004"
        y="${plot.y + (i * plot.h) / 100}"
        width="12"
        height="${plot.h / 100 + 0.2}"
        fill="${heatColor(max - ((max - min) * i) / 99, min, max)}"
      />
    `;
  body += /* HTML */ `
    <text x="1004" y="38">A/W</text>
    <text x="1026" y="${plot.y + 12}">${formatNumber(max, 3)}</text>
    <text x="1026" y="${plot.y + plot.h}">${formatNumber(min, 3)}</text>
  `;
  const ox = plot.x + (xValues.indexOf(optimum.x) + 0.5) * cw;
  const oy = plot.y + plot.h - (yValues.indexOf(optimum.y) + 0.5) * ch;
  body += /* HTML */ `
    <path
      d="M${ox - 10},${oy}H${ox + 10} M${ox},${oy - 10}V${oy + 10}"
      stroke="#fff"
      stroke-width="2"
    />
    <circle cx="${ox}" cy="${oy}" r="7" fill="none" stroke="#fff" />
    <text x="${plot.x + plot.w / 2}" y="640" text-anchor="middle">X 厚度 (nm)</text>
    <text transform="translate(24 316) rotate(-90)" text-anchor="middle">Y 厚度 (nm)</text>
  `;
  download(
    'pd-tmm-thickness-heatmap.svg',
    /* HTML */ `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="${width}"
        height="${height}"
        viewBox="0 0 ${width} ${height}"
        font-family="Arial,Microsoft YaHei,sans-serif"
        font-size="14"
        fill="#757575"
      >
        ${body}
      </svg>
    `,
    'image/svg+xml',
  );
}
