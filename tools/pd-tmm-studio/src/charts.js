import {
  CHART_COLORS,
  SPECTRUM_PADDING,
  RESPONSIVITY_AXIS_MAX,
  CHART_FONT,
  heatColor,
} from './ui-config.js';
import { clamp, formatNumber } from './ui-utils.js';

// 坐标轴与曲线
// 按屏幕像素比放大画布，绘图坐标仍按 CSS 像素计算
function canvasContext(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(220, Math.round(rect.height));
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, width, height };
}

// 绘图区扣掉刻度留白后，返回物理量到画布坐标的映射
function chartBase(canvas, xMin, xMax, yMin, yMax, options = {}) {
  const { ctx, width, height } = canvasContext(canvas);
  const pad = {
    l: options.left || 48,
    r: options.right || 22,
    t: options.top || 22,
    b: options.bottom || 34,
  };
  const plot = { x: pad.l, y: pad.t, w: width - pad.l - pad.r, h: height - pad.t - pad.b };
  const xMap = (x) => plot.x + ((x - xMin) / Math.max(1e-12, xMax - xMin)) * plot.w;
  const yMap = (y) => plot.y + plot.h - ((y - yMin) / Math.max(1e-12, yMax - yMin)) * plot.h;
  const xTicks = options.xTicks || 5;
  const yTicks = options.yTicks || 5;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.font = CHART_FONT;
  ctx.lineWidth = 1;
  for (let i = 0; i <= xTicks; i++) {
    const x = plot.x + (plot.w * i) / xTicks;
    ctx.strokeStyle = CHART_COLORS.grid;
    ctx.beginPath();
    ctx.moveTo(x, plot.y);
    ctx.lineTo(x, plot.y + plot.h);
    ctx.stroke();
    ctx.strokeStyle = CHART_COLORS.ink;
    ctx.beginPath();
    ctx.moveTo(x, plot.y + plot.h);
    ctx.lineTo(x, plot.y + plot.h + 5);
    ctx.stroke();
    ctx.fillStyle = CHART_COLORS.ink;
    ctx.textAlign = 'center';
    ctx.fillText(
      formatNumber(xMin + ((xMax - xMin) * i) / xTicks, options.xDigits || 0),
      x,
      plot.y + plot.h + 20,
    );
  }
  for (let i = 0; i <= yTicks; i++) {
    const y = plot.y + (plot.h * i) / yTicks;
    ctx.strokeStyle = CHART_COLORS.grid;
    ctx.beginPath();
    ctx.moveTo(plot.x, y);
    ctx.lineTo(plot.x + plot.w, y);
    ctx.stroke();
    ctx.strokeStyle = CHART_COLORS.ink;
    ctx.beginPath();
    ctx.moveTo(plot.x - 5, y);
    ctx.lineTo(plot.x, y);
    ctx.stroke();
    ctx.fillStyle = CHART_COLORS.ink;
    ctx.textAlign = 'right';
    ctx.fillText(
      options.percent
        ? `${formatNumber(yMax - ((yMax - yMin) * i) / yTicks, 0)}%`
        : formatNumber(yMax - ((yMax - yMin) * i) / yTicks, 1),
      plot.x - 9,
      y + 3,
    );
  }
  ctx.strokeStyle = CHART_COLORS.axis;
  ctx.beginPath();
  ctx.moveTo(plot.x, plot.y);
  ctx.lineTo(plot.x, plot.y + plot.h);
  ctx.lineTo(plot.x + plot.w, plot.y + plot.h);
  ctx.stroke();
  return { ctx, width, height, plot, xMap, yMap };
}

// 吸收率对应左轴，响应度对应右轴，两条曲线共用波长坐标
export function drawSpectrum(canvas, result, settings, spectrumHoverIndex = null) {
  if (!result) return;
  const points = result.spectrum;
  const xMin = points[0].wavelength;
  const xMax = points.at(-1).wavelength;
  const base = chartBase(canvas, xMin, xMax, 0, 100, {
    left: SPECTRUM_PADDING.left,
    right: SPECTRUM_PADDING.right,
    top: SPECTRUM_PADDING.top,
    bottom: SPECTRUM_PADDING.bottom,
    percent: true,
    xTicks: 5,
    yTicks: 5,
  });
  const { ctx, width, height, plot, xMap, yMap } = base;
  const rMap = (y) =>
    plot.y + plot.h - (clamp(y, 0, RESPONSIVITY_AXIS_MAX) / RESPONSIVITY_AXIS_MAX) * plot.h;
  // 分别使用左右轴映射绘制两条曲线
  ctx.beginPath();
  points.forEach((point, i) => {
    const x = xMap(point.wavelength);
    const y = yMap(point.absorption * 100);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.strokeStyle = CHART_COLORS.absorption;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.beginPath();
  points.forEach((point, i) => {
    const x = xMap(point.wavelength);
    const y = rMap(point.responsivity);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.strokeStyle = CHART_COLORS.responsivity;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.font = '10px Arial, sans-serif';
  ctx.fillStyle = CHART_COLORS.ink;
  ctx.textAlign = 'left';
  for (let i = 0; i <= 6; i++) {
    const value = (RESPONSIVITY_AXIS_MAX * (6 - i)) / 6;
    const y = plot.y + (plot.h * i) / 6;
    ctx.strokeStyle = CHART_COLORS.ink;
    ctx.beginPath();
    ctx.moveTo(plot.x + plot.w, y);
    ctx.lineTo(plot.x + plot.w + 5, y);
    ctx.stroke();
    ctx.fillText(value.toFixed(1), plot.x + plot.w + 9, y + 3);
  }
  ctx.font = CHART_FONT;
  ctx.textAlign = 'center';
  ctx.fillText('波长 (nm)', plot.x + plot.w / 2, height - 8);
  ctx.textAlign = 'left';
  ctx.fillText('吸收率 (%)', plot.x, 14);
  ctx.textAlign = 'right';
  ctx.fillText('响应度 A/W', plot.x + plot.w, 14);
  // 目标波长在扫描范围内时才画参考线，范围外不硬贴到边缘
  const targetInRange = settings.targetWavelength >= xMin && settings.targetWavelength <= xMax;
  const tx = xMap(settings.targetWavelength);
  if (targetInRange) {
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = CHART_COLORS.marker;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tx, plot.y);
    ctx.lineTo(tx, plot.y + plot.h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = CHART_COLORS.markerText;
    ctx.font = '9px Arial, sans-serif';
    ctx.textAlign = tx > plot.x + plot.w * 0.78 ? 'right' : 'left';
    ctx.fillText(
      `${formatNumber(settings.targetWavelength, 0)} nm`,
      tx + (ctx.textAlign === 'right' ? -5 : 5),
      plot.y + 12,
    );
    const target = result.target;
    const targetAbsY = yMap(target.absorption * 100);
    const targetRespY = rMap(target.responsivity);
    [
      [CHART_COLORS.absorption, targetAbsY],
      [CHART_COLORS.responsivity, targetRespY],
    ].forEach(([color, y]) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(tx, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }
  // 悬停标记使用最近的采样点，不把插值结果当成已计算结果
  if (spectrumHoverIndex !== null && points[spectrumHoverIndex]) {
    const point = points[spectrumHoverIndex];
    const hx = xMap(point.wavelength);
    const ha = yMap(point.absorption * 100);
    const hr = rMap(point.responsivity);
    ctx.strokeStyle = CHART_COLORS.marker;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(hx, plot.y);
    ctx.lineTo(hx, plot.y + plot.h);
    ctx.stroke();
    ctx.setLineDash([]);
    [
      [CHART_COLORS.absorption, ha],
      [CHART_COLORS.responsivity, hr],
    ].forEach(([color, y]) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(hx, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }
}

// 沿入射方向叠加层边界和场强曲线，场强已在求解器内归一化
export function drawField(canvas, result, simulatedLayers) {
  if (!result) return;
  const points = result.field;
  const total = result.totalThickness;
  const base = chartBase(canvas, 0, total, 0, 1, { right: 18, bottom: 46 });
  const { ctx, height, plot, xMap, yMap } = base;
  let offset = 0;
  simulatedLayers.forEach((layer) => {
    const x1 = xMap(offset);
    const x2 = xMap(offset + layer.thickness);
    ctx.fillStyle = 'rgba(0,0,0,.035)';
    ctx.fillRect(x1, plot.y, x2 - x1, plot.h);
    offset += layer.thickness;
    ctx.strokeStyle = CHART_COLORS.layerBorder;
    ctx.beginPath();
    ctx.moveTo(xMap(offset), plot.y);
    ctx.lineTo(xMap(offset), plot.y + plot.h);
    ctx.stroke();
  });
  ctx.beginPath();
  points.forEach((point, i) => {
    const x = xMap(point.depth);
    const y = yMap(point.intensity);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  // 先闭合曲线下方的填充区域，再单独描线
  ctx.lineTo(xMap(total), yMap(0));
  ctx.lineTo(xMap(0), yMap(0));
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, plot.y, 0, plot.y + plot.h);
  grad.addColorStop(0, CHART_COLORS.fieldFillTop);
  grad.addColorStop(1, CHART_COLORS.fieldFillBottom);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.beginPath();
  points.forEach((point, i) => {
    const x = xMap(point.depth);
    const y = yMap(point.intensity);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.strokeStyle = CHART_COLORS.absorption;
  ctx.lineWidth = 2.1;
  ctx.stroke();
  ctx.fillStyle = CHART_COLORS.ink;
  ctx.font = CHART_FONT;
  ctx.textAlign = 'center';
  ctx.fillText('入射侧深度 (nm)', plot.x + plot.w / 2, height - 8);
}

// 扫描数组从低 Y 开始存储，画布从顶部开始，所以绘制时要翻转行号
export function drawHeatmap(canvas, scanResult) {
  if (!scanResult) return;
  const { ctx, width, height } = canvasContext(canvas);
  const plot = { x: 50, y: 28, w: width - 118, h: height - 76 };
  ctx.clearRect(0, 0, width, height);
  const cols = scanResult.xValues.length;
  const rows = scanResult.yValues.length;
  const cw = plot.w / cols;
  const ch = plot.h / rows;
  scanResult.values.forEach((row, yi) =>
    row.forEach((value, xi) => {
      ctx.fillStyle = heatColor(value, scanResult.min, scanResult.max);
      ctx.fillRect(plot.x + xi * cw, plot.y + (rows - 1 - yi) * ch, cw + 0.5, ch + 0.5);
    }),
  );
  ctx.fillStyle = CHART_COLORS.ink;
  ctx.font = CHART_FONT;
  const ticks = width < 420 ? 2 : 4;
  for (let i = 0; i <= ticks; i++) {
    const index = Math.round(((cols - 1) * i) / ticks);
    const yi = Math.round(((rows - 1) * i) / ticks);
    ctx.textAlign = 'center';
    ctx.fillText(
      formatNumber(scanResult.xValues[index], 0),
      plot.x + (index + 0.5) * cw,
      plot.y + plot.h + 20,
    );
    ctx.textAlign = 'right';
    ctx.fillText(
      formatNumber(scanResult.yValues[yi], 0),
      plot.x - 8,
      plot.y + plot.h - (yi + 0.5) * ch + 4,
    );
  }
  ctx.textAlign = 'center';
  ctx.fillText('X 厚度 (nm)', plot.x + plot.w / 2, height - 8);
  ctx.save();
  ctx.translate(12, plot.y + plot.h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Y 厚度 (nm)', 0, 0);
  ctx.restore();
  // 右侧色标使用与网格相同的插值函数
  const scaleX = plot.x + plot.w + 18;
  const scale = ctx.createLinearGradient(0, plot.y + plot.h, 0, plot.y);
  for (let i = 0; i <= 4; i++)
    scale.addColorStop(
      i / 4,
      heatColor(
        scanResult.min + ((scanResult.max - scanResult.min) * i) / 4,
        scanResult.min,
        scanResult.max,
      ),
    );
  ctx.fillStyle = scale;
  ctx.fillRect(scaleX, plot.y, 10, plot.h);
  ctx.fillStyle = CHART_COLORS.ink;
  ctx.textAlign = 'left';
  ctx.fillText('A/W', scaleX - 1, 14);
  ctx.font = '10px "Segoe UI",sans-serif';
  ctx.fillText(formatNumber(scanResult.max, 3), scaleX + 14, plot.y + 8);
  ctx.fillText(formatNumber(scanResult.min, 3), scaleX + 14, plot.y + plot.h);
  // 最优点落在对应网格中心，位置用采样索引计算
  const ox = plot.x + (scanResult.xValues.indexOf(scanResult.optimum.x) + 0.5) * cw;
  const oy = plot.y + plot.h - (scanResult.yValues.indexOf(scanResult.optimum.y) + 0.5) * ch;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(ox - 7, oy);
  ctx.lineTo(ox + 7, oy);
  ctx.moveTo(ox, oy - 7);
  ctx.lineTo(ox, oy + 7);
  ctx.stroke();
}

// 厚度作为横轴，圆点标出这次离散采样中响应度最高的位置
export function drawSingleScan(canvas, singleScanResult) {
  if (!singleScanResult) return;
  const points = singleScanResult.points;
  const xMin = points[0].thickness;
  const xMax = points.at(-1).thickness;
  const { ctx, width, height, plot, xMap, yMap } = chartBase(
    canvas,
    xMin,
    xMax,
    0,
    RESPONSIVITY_AXIS_MAX,
    {
      left: 62,
      right: 22,
      top: 24,
      bottom: 48,
      xTicks: 5,
      yTicks: 6,
      xDigits: Math.abs(xMax - xMin) < 20 ? 1 : 0,
    },
  );
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = xMap(point.thickness);
    const y = yMap(point.responsivity);
    index ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.strokeStyle = CHART_COLORS.responsivity;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();
  const optimum = singleScanResult.optimum;
  const ox = xMap(optimum.thickness);
  const oy = yMap(optimum.responsivity);
  ctx.fillStyle = CHART_COLORS.responsivity;
  ctx.beginPath();
  ctx.arc(ox, oy, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = CHART_COLORS.ink;
  ctx.font = CHART_FONT;
  ctx.textAlign = 'center';
  ctx.fillText('厚度 (nm)', plot.x + plot.w / 2, height - 8);
  ctx.textAlign = 'left';
  ctx.fillText('响应度 A/W', plot.x, 14);
}
