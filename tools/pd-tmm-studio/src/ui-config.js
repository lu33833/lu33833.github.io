import { clamp } from './ui-utils.js';
import { DEFAULT_LAYERS, DEFAULT_SETTINGS } from './tmm-core.js';

// 页面初始值与“恢复默认”共用此配置，改完后刷新页面
// 例如 { ...DEFAULT_SETTINGS, targetWavelength: 1327 }
export const MODEL_DEFAULTS = { ...DEFAULT_SETTINGS };

// 按层 id 修改初始名称、厚度或 n/k；留空则使用原模型
// 例如：'spacer-x': { thickness: 72 }, absorber: { thickness: 680 }
export const LAYER_OVERRIDES = {};
// 每次创建新对象，让编辑和恢复默认不会改写模型预设
export const createInitialLayers = () =>
  DEFAULT_LAYERS.map((layer) => ({
    ...layer,
    ...LAYER_OVERRIDES[layer.id],
  }));

// 扫描范围单位为 nm，scanResolution 是热图每个方向的采样数
export const SCAN_DEFAULTS = {
  singleMin: 20,
  singleMax: 260,
  singlePoints: 81,
  xMin: 20,
  xMax: 260,
  yMin: 20,
  yMax: 260,
  scanResolution: 25,
};

// 曲线与图例共用此配置，热图色阶在 HEAT_STOPS 中单独调整
export const CHART_COLORS = {
  absorption: '#c66a3d',
  responsivity: '#3569a6',
  ink: '#757575',
  grid: '#e8e8e8',
  axis: '#d9d9d9',
  marker: '#757575',
  markerText: '#444444',
  layerBorder: '#e3e3e3',
  fieldFillTop: '#c66a3d66',
  fieldFillBottom: '#c66a3d08',
};
// ColorBrewer Blues，按响应度从低到高排列
export const HEAT_STOPS = [
  [239, 243, 255],
  [189, 215, 231],
  [107, 174, 214],
  [49, 130, 189],
  [8, 81, 156],
];

// 灰阶端点：薄层浅、厚层深，层条等高，保证薄层名称可读
export const PROFILE_GRAY = { light: 242, dark: 80 };
// 以当前结构最薄和最厚的层为端点，同厚度始终得到同一灰阶
export function layerTone(thickness, allLayers) {
  const values = allLayers.map((layer) => layer.thickness);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const ratio = max === min ? 0.5 : Math.min(1, Math.max(0, (thickness - min) / (max - min)));
  const gray = Math.round(PROFILE_GRAY.light + (PROFILE_GRAY.dark - PROFILE_GRAY.light) * ratio);
  return { background: `rgb(${gray}, ${gray}, ${gray})`, text: gray < 128 ? '#ffffff' : '#1e1e1e' };
}

// 光谱双轴预留相同宽度，避免左右刻度挤到绘图区
export const SPECTRUM_PADDING = { left: 64, right: 64, top: 20, bottom: 46 };
export const RESPONSIVITY_AXIS_MAX = 1.2;
export const CHART_FONT = '11px "Noto Sans SC", "Microsoft YaHei", sans-serif';

// 在相邻蓝色色阶之间插值，让接近的响应度也有连续的颜色变化
export function heatColor(value, min, max) {
  const stops = HEAT_STOPS;
  const position = clamp((value - min) / Math.max(1e-12, max - min), 0, 1) * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(position));
  const fraction = position - index;
  const channels = stops[index].map((channel, channelIndex) => {
    const nextChannel = stops[index + 1][channelIndex];
    return Math.round(channel + (nextChannel - channel) * fraction);
  });
  return `rgb(${channels.join(',')})`;
}
