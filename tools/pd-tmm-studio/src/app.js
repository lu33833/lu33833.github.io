import {
  drawSpectrum as renderSpectrum,
  drawField as renderField,
  drawHeatmap as renderHeatmap,
  drawSingleScan as renderSingleScan,
} from './charts.js';
import {
  exportCsv,
  exportJson,
  exportSpectrumSvg,
  exportSingleScanSvg,
  exportStructureSvg,
  exportHeatmapSvg,
} from './exports.js';
import { clamp, formatNumber, escapeHtml } from './ui-utils.js';
import { MATERIALS, responseAtWavelength, scan2D, simulate } from './tmm-core.js';
import {
  MODEL_DEFAULTS,
  SCAN_DEFAULTS,
  CHART_COLORS,
  SPECTRUM_PADDING,
  createInitialLayers,
  layerTone,
} from './ui-config.js';
import { createLayerGrid } from './layer-grid.js';

const $ = (id) => document.getElementById(id);
// 编辑过程可能暂时为空，读取设置时回退到预设值，运行前再统一校验
const numberOrDefault = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;
const cloneSettings = () => ({ ...MODEL_DEFAULTS });

// 编辑中的层和上次计算用的层分开保存，改参数时不会篡改已有结果
let layers = createInitialLayers();
let settings = cloneSettings();
let simulatedLayers = createInitialLayers();
let result = null;
let scanResult = null;
let singleScanResult = null;
let activeView = 'spectrum';
let spectrumHoverIndex = null;
let scanXId = 'spacer-x';
let scanYId = 'spacer-y';
let singleScanId = 'spacer-x';
let currentWorkspace = 'structure';
let currentScan = 'single';
let calculatedSignature = '';

const modelSignature = () => JSON.stringify({ layers, settings: getSettings() });

// 工作区与结果状态
// 切换工作区后重画当前图表，等容器显示出来再读取尺寸
function showWorkspace(name) {
  currentWorkspace = name;
  for (const button of document.querySelectorAll('.workspace-tab')) {
    const selected = button.dataset.workspace === name;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
  for (const view of document.querySelectorAll('.workspace-view'))
    view.hidden = view.id !== `${name}Workspace`;
  $('scanContext').textContent = `λ ${formatNumber(getSettings().targetWavelength, 0)} nm`;
  requestAnimationFrame(drawActive);
}

function showError(message = '') {
  $('appError').textContent = message;
  $('appError').hidden = !message;
}

function clearCanvas(id) {
  const canvas = $(id);
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

// 模型或扫描条件变了就清掉扫描结果，同时收起导出入口
function invalidateScans() {
  scanResult = null;
  singleScanResult = null;
  $('emptySingleScan').classList.remove('hidden');
  $('emptyHeatmap').classList.remove('hidden');
  $('downloadSingleScanSvg').disabled = true;
  $('downloadHeatmapSvg').disabled = true;
  $('heatScale').hidden = true;
  $('singleScanResult').replaceChildren();
  $('scanResult').replaceChildren();
  clearCanvas('singleScanChart');
  clearCanvas('heatmap');
}

// 一起清空指标、画布和悬停提示，避免旧图配上新参数
function clearResultDisplay() {
  for (const id of [
    'responsivity',
    'absorption',
    'peakResponse',
    'energyR',
    'energyA',
    'energyT',
    'parasitic',
  ])
    $(id).textContent = '—';
  $('targetMetricLabel').textContent = '响应度';
  for (const id of ['peakWl', 'targetLayerName', 'fieldWavelength', 'spectrumRange'])
    $(id).textContent = '';
  $('emptySpectrum').hidden = false;
  $('emptyField').hidden = false;
  $('spectrumTooltip').classList.remove('visible');
  spectrumHoverIndex = null;
  clearCanvas('spectrumChart');
  clearCanvas('fieldChart');
}

// 用参数快照判断结果是否仍可用，恢复到原参数时可以重新显示已有光谱
function markDirty() {
  invalidateScans();
  const dirty = !result || modelSignature() !== calculatedSignature;
  $('resultContext').textContent = result && dirty ? '参数已修改，请重新计算' : '';
  document.querySelectorAll('[data-result-export]').forEach((button) => {
    button.disabled = dirty;
  });
  $('scanContext').textContent = `λ ${formatNumber(getSettings().targetWavelength, 0)} nm`;
  if (dirty) clearResultDisplay();
  else updateResults();
}

// 定位到出错字段所在的工作区或弹窗，再交给浏览器显示输入限制
function validateInputs(selector) {
  const invalid = [...document.querySelectorAll(selector)].find((input) => !input.checkValidity());
  if (!invalid) return true;
  if (invalid.closest('#modelInputs')) showWorkspace('structure');
  if (invalid.closest('#modelDialog') && !$('modelDialog').open) $('modelDialog').showModal();
  const label = invalid.closest('label')?.querySelector('span')?.textContent.trim();
  showError(label ? `请检查“${label}”的数值` : '请检查输入的数值');
  invalid.focus();
  invalid.reportValidity();
  return false;
}

// 先提交表格编辑，再检查波长范围，未通过时保留用户正在改的内容
function validateModel() {
  if (!layerGrid.commitEdit()) {
    showWorkspace('structure');
    showError('请先修正正在编辑的数值');
    return false;
  }
  if (!validateInputs('#modelInputs input, #modelDialog input')) return false;
  if (+$('wlStart').value >= +$('wlEnd').value) {
    showWorkspace('structure');
    showError('结束波长必须大于起始波长');
    $('wlEnd').focus();
    return false;
  }
  showError();
  return true;
}

// 从输入框读取模型设置，波长用 nm、束腰用 µm，收集效率转为 0–1
function getSettings() {
  return {
    incidentN: Math.max(0.01, numberOrDefault($('incidentN').value, MODEL_DEFAULTS.incidentN)),
    incidentK: Math.max(0, numberOrDefault($('incidentK').value, MODEL_DEFAULTS.incidentK)),
    exitN: Math.max(0.01, numberOrDefault($('exitN').value, MODEL_DEFAULTS.exitN)),
    exitK: Math.max(0, numberOrDefault($('exitK').value, MODEL_DEFAULTS.exitK)),
    wavelengthStart: numberOrDefault($('wlStart').value, MODEL_DEFAULTS.wavelengthStart),
    wavelengthEnd: numberOrDefault($('wlEnd').value, MODEL_DEFAULTS.wavelengthEnd),
    points: clamp(Math.round(numberOrDefault($('wlPoints').value, MODEL_DEFAULTS.points)), 2, 301),
    targetWavelength: Math.max(
      100,
      numberOrDefault($('targetWl').value, MODEL_DEFAULTS.targetWavelength),
    ),
    waistUm: Math.max(0.1, numberOrDefault($('waist').value, MODEL_DEFAULTS.waistUm)),
    angularSamples: clamp(
      Math.round(numberOrDefault($('angleSamples').value, MODEL_DEFAULTS.angularSamples)),
      6,
      48,
    ),
    gaussian: $('gaussian').checked,
    wavelengthDependent: $('wavelengthDependent').checked,
    conservativeInGaAs: $('conservativeInGaAs').checked,
    idealAr: $('idealAr').checked,
    collectionEfficiency: clamp(
      numberOrDefault($('collection').value, MODEL_DEFAULTS.collectionEfficiency * 100) / 100,
      0,
      1,
    ),
  };
}

// 启动和恢复默认共用这组赋值，与 getSettings 的字段保持对应
function populateSettings(next) {
  $('incidentN').value = next.incidentN;
  $('incidentK').value = next.incidentK;
  $('exitN').value = next.exitN;
  $('exitK').value = next.exitK;
  $('wlStart').value = next.wavelengthStart;
  $('wlEnd').value = next.wavelengthEnd;
  $('wlPoints').value = next.points;
  $('targetWl').value = next.targetWavelength;
  $('waist').value = next.waistUm;
  $('angleSamples').value = next.angularSamples;
  $('gaussian').checked = next.gaussian;
  $('wavelengthDependent').checked = next.wavelengthDependent;
  $('conservativeInGaAs').checked = next.conservativeInGaAs;
  $('idealAr').checked = next.idealAr;
  $('collection').value = next.collectionEfficiency * 100;
}

// 普通单元格编辑后保留当前焦点；材料变更时需要同时刷新 n/k
function updateStructure({ refreshRows = true } = {}) {
  if (refreshRows) layerGrid.setLayers(layers);
  refreshScanOptions();
  renderSchematic();
  markDirty();
}

// 数组按入射方向存放，因此界面上的上移对应数组索引增加
function moveLayer(id, offset) {
  const index = layers.findIndex((layer) => layer.id === id);
  const next = index + offset;
  if (index < 0 || next < 0 || next >= layers.length) return;
  [layers[index], layers[next]] = [layers[next], layers[index]];
  updateStructure();
}

// 删掉响应层或扫描层后，为对应选择补上仍存在的层
function deleteLayer(id) {
  if (layers.length === 1) return;
  const removed = layers.find((layer) => layer.id === id);
  layers = layers.filter((layer) => layer.id !== id);
  if (removed?.target && layers.length) layers[0].target = true;
  if (!layers.some((layer) => layer.id === scanXId)) scanXId = layers[0].id;
  if (!layers.some((layer) => layer.id === scanYId))
    scanYId = layers[Math.min(1, layers.length - 1)].id;
  if (!layers.some((layer) => layer.id === singleScanId)) singleScanId = layers[0].id;
  updateStructure();
}

// 剖面按金属到衬底排列，灰阶表示厚度，文字单独保留实际数值
function renderSchematic() {
  const total = layers.reduce((sum, layer) => sum + layer.thickness, 0);
  $('stackTotal').textContent = `${formatNumber(total, total % 1 ? 1 : 0)} nm`;
  $('schematic').innerHTML = [...layers]
    .reverse()
    .map((layer) => {
      const tone = layerTone(layer.thickness, layers);
      return /* HTML */ `
        <div
          class="schematic-layer"
          style="--layer-color:${tone.background};--layer-text:${tone.text}"
          title="${escapeHtml(layer.name)}"
        >
          <span class="schematic-name">${escapeHtml(layer.name)}</span>
          <span class="schematic-thickness">
            ${formatNumber(layer.thickness, layer.thickness % 1 ? 1 : 0)} nm
          </span>
        </div>
      `;
    })
    .join('');
}

// 层名、层数变化时重建下拉选项，仍用层 id 保留原来的选择
function refreshScanOptions() {
  const optionsFor = (selected) =>
    layers
      .map(
        (layer) => /* HTML */ `
          <option value="${layer.id}" ${layer.id === selected ? 'selected' : ''}>
            ${escapeHtml(layer.name)}
          </option>
        `,
      )
      .join('');
  $('scanX').innerHTML = optionsFor(scanXId);
  $('scanY').innerHTML = optionsFor(scanYId);
  $('singleScanLayer').innerHTML = optionsFor(singleScanId);
}

// 先复制本次输入再计算，图表和导出都使用这份快照
function runSimulation({ reveal = true } = {}) {
  if (!validateModel()) return;
  const nextSettings = getSettings();
  const nextLayers = layers.map((layer) => ({ ...layer }));
  const signature = modelSignature();
  const button = $('run');
  button.disabled = true;
  button.textContent = '计算中…';
  requestAnimationFrame(() => {
    try {
      const nextResult = simulate(nextLayers, nextSettings);
      if (!nextResult.spectrum.every((point) => Object.values(point).every(Number.isFinite)))
        throw new Error('请检查层厚、折射率和波长范围。');
      simulatedLayers = nextLayers;
      settings = nextSettings;
      result = nextResult;
      calculatedSignature = signature;
      markDirty();
      if (reveal) showWorkspace('response');
    } catch (error) {
      showError(`计算未完成：${error.message}`);
    } finally {
      button.disabled = false;
      button.textContent = '运行仿真';
    }
  });
}

// 指标、能量分配和曲线取自同一次计算，显示时才处理小数位
function updateResults() {
  const target = result.target;
  const peak = result.peak;
  $('emptySpectrum').hidden = true;
  $('emptyField').hidden = true;
  $('modelStatus').textContent = modelLabel(settings);
  $('modelStatus').classList.toggle('dispersive', settings.wavelengthDependent);
  $('targetMetricLabel').textContent = `响应度 · ${formatNumber(settings.targetWavelength, 0)} nm`;
  $('absorptionMetricLabel').textContent = '目标吸收率';
  $('responsivity').textContent = formatNumber(target.responsivity, 4);
  $('absorption').textContent = `${formatNumber(target.absorption * 100, 2)}%`;
  $('targetLayerName').textContent =
    simulatedLayers.find((layer) => layer.target)?.name || '响应层';
  $('peakWl').textContent = ` · ${formatNumber(peak.wavelength, peak.wavelength % 1 ? 1 : 0)} nm`;
  $('peakResponse').textContent = formatNumber(peak.responsivity, 4);
  $('parasitic').textContent = `${formatNumber(target.parasitic * 100, 2)}%`;
  $('spectrumRange').textContent =
    `${formatNumber(settings.wavelengthStart, 0)} — ${formatNumber(settings.wavelengthEnd, 0)} nm`;
  $('fieldWavelength').textContent =
    `${formatNumber(settings.targetWavelength, 0)} nm · 法向入射 TE`;
  [
    ['R', target.reflectance],
    ['A', target.absorption],
    ['T', target.transmittance],
  ].forEach(([key, value]) => {
    $(`energy${key}`).textContent = `${formatNumber(value * 100, 2)}%`;
  });
  drawActive();
}

// 页面负责判断结果是否过期，绘图模块只处理数据与坐标
function drawSpectrum() {
  if (result && modelSignature() === calculatedSignature) {
    renderSpectrum($('spectrumChart'), result, settings, spectrumHoverIndex);
  }
}

function drawField() {
  if (result && modelSignature() === calculatedSignature) {
    renderField($('fieldChart'), result, simulatedLayers);
  }
}

function drawHeatmap() {
  renderHeatmap($('heatmap'), scanResult);
}

function drawSingleScan() {
  renderSingleScan($('singleScanChart'), singleScanResult);
}

// 只重画当前可见图表，隐藏容器的宽高不能用于计算坐标
function drawActive() {
  if (currentWorkspace === 'response') {
    if (activeView === 'spectrum') drawSpectrum();
    else drawField();
  } else if (currentWorkspace === 'scan') {
    if (currentScan === 'single') drawSingleScan();
    else drawHeatmap();
  }
}

// 已计算结果和待应用设置使用同一套模型名称
function modelLabel(model) {
  let label = '固定 n / k';
  if (model.wavelengthDependent) {
    label = model.conservativeInGaAs ? 'Adachi 保守模型' : 'O-band 色散模型';
  }
  return model.idealAr ? label + ' · 理想减反膜' : label;
}

// 设置刚修改时保留待应用提示，运行后改为本次计算实际使用的模型
function showPendingModelStatus() {
  $('modelStatus').textContent = modelLabel(getSettings()) + ' · 待应用';
}

// 厚度扫描
// X、Y 必须是不同的层，每个网格点只改变这两层的厚度
function runThicknessScan() {
  if (!validateModel() || !validateInputs('#doubleScanView input')) return;
  if (scanXId === scanYId) {
    showError('X 层和 Y 层不能相同');
    return;
  }
  if (+$('xMax').value <= +$('xMin').value || +$('yMax').value <= +$('yMin').value) {
    showError('X、Y 的结束厚度都必须大于起始厚度');
    return;
  }
  const scanSettings = getSettings();
  const scanLayers = layers.map((layer) => ({ ...layer }));
  const button = $('runScan');
  button.disabled = true;
  button.textContent = '扫描中…';
  requestAnimationFrame(() => {
    try {
      scanResult = scan2D(
        scanLayers,
        scanSettings,
        scanXId,
        scanYId,
        [
          numberOrDefault($('xMin').value, SCAN_DEFAULTS.xMin),
          numberOrDefault($('xMax').value, SCAN_DEFAULTS.xMax),
        ],
        [
          numberOrDefault($('yMin').value, SCAN_DEFAULTS.yMin),
          numberOrDefault($('yMax').value, SCAN_DEFAULTS.yMax),
        ],
        clamp(numberOrDefault($('scanResolution').value, SCAN_DEFAULTS.scanResolution), 8, 41),
      );
      if (!Number.isFinite(scanResult.max)) throw new Error('扫描结果无效，请检查模型参数');
      const xName = layers.find((layer) => layer.id === scanXId)?.name || 'X';
      const yName = layers.find((layer) => layer.id === scanYId)?.name || 'Y';
      $('scanResult').innerHTML = /* HTML */ `
        <span>最大响应度</span>
        <b>${formatNumber(scanResult.optimum.responsivity, 4)} A/W</b>
        <small title="${escapeHtml(xName)} / ${escapeHtml(yName)}">
          X ${formatNumber(scanResult.optimum.x, 1)} nm · Y ${formatNumber(scanResult.optimum.y, 1)}
          nm
        </small>
      `;
      $('heatMin').textContent = formatNumber(scanResult.min, 4);
      $('heatMax').textContent = formatNumber(scanResult.max, 4);
      $('heatScale').hidden = false;
      $('emptyHeatmap').classList.add('hidden');
      $('downloadHeatmapSvg').disabled = false;
      drawHeatmap();
    } catch (error) {
      scanResult = null;
      showError(error.message);
    } finally {
      button.disabled = false;
      button.textContent = '开始扫描';
    }
  });
}

// 固定其他参数逐点扫描一层，保留整条曲线和采样最优点
function runSingleThicknessScan() {
  if (!validateModel() || !validateInputs('#singleScanView input')) return;
  if (+$('singleMax').value <= +$('singleMin').value) {
    showError('结束厚度必须大于起始厚度');
    return;
  }
  const scanSettings = getSettings();
  const scanLayers = layers.map((layer) => ({ ...layer }));
  const button = $('runSingleScan');
  button.disabled = true;
  button.textContent = '扫描中…';
  requestAnimationFrame(() => {
    try {
      const min = Math.max(0.01, numberOrDefault($('singleMin').value, SCAN_DEFAULTS.singleMin));
      const max = Math.max(0.01, numberOrDefault($('singleMax').value, SCAN_DEFAULTS.singleMax));
      const count = clamp(
        Math.round(numberOrDefault($('singlePoints').value, SCAN_DEFAULTS.singlePoints)),
        11,
        301,
      );
      const fastSettings = {
        ...scanSettings,
        angularSamples: Math.min(scanSettings.angularSamples, 18),
      };
      // 每个候选结构使用层副本，扫描过程不改变编辑器里的厚度
      const thicknesses = Array.from(
        { length: count },
        (_, index) => min + ((max - min) * index) / (count - 1),
      );
      const points = thicknesses.map((thickness) => {
        const candidate = scanLayers.map((layer) =>
          layer.id === singleScanId ? { ...layer, thickness } : { ...layer },
        );
        const response = responseAtWavelength(
          candidate,
          fastSettings,
          scanSettings.targetWavelength,
        );
        return {
          thickness,
          responsivity:
            ((scanSettings.targetWavelength / 1e3) *
              clamp(response.absorption, 0, 1) *
              scanSettings.collectionEfficiency) /
            1.24,
        };
      });
      if (!points.every((point) => Number.isFinite(point.responsivity)))
        throw new Error('扫描结果无效，请检查模型参数');
      const optimum = points.reduce(
        (best, point) => (point.responsivity > best.responsivity ? point : best),
        points[0],
      );
      const layerName = layers.find((layer) => layer.id === singleScanId)?.name || '扫描层';
      singleScanResult = { points, optimum, layerName, wavelength: scanSettings.targetWavelength };
      $('singleScanResult').innerHTML = /* HTML */ `
        <span>最大响应度</span>
        <b>${formatNumber(optimum.responsivity, 4)} A/W</b>
        <small>${formatNumber(optimum.thickness, 2)} nm</small>
      `;
      $('emptySingleScan').classList.add('hidden');
      $('downloadSingleScanSvg').disabled = false;
      drawSingleScan();
    } catch (error) {
      singleScanResult = null;
      showError(error.message);
    } finally {
      button.disabled = false;
      button.textContent = '开始扫描';
    }
  });
}

// 先把整份文件校验完再替换层结构，导入失败时保留现有编辑内容
async function importJsonFile(file) {
  const payload = JSON.parse(await file.text());
  const layerRows = Array.isArray(payload) ? payload : payload?.layers;
  if (!Array.isArray(layerRows) || !layerRows.length)
    throw new Error('JSON 中没有有效的 layers 数组');
  const physicalRows =
    payload?.stackOrder === 'incident-to-exit' ? [...layerRows] : [...layerRows].reverse();
  const importedLayers = physicalRows.map((source, index) => {
    if (!source || typeof source !== 'object') throw new Error(`第 ${index + 1} 层格式无效`);
    const material = String(source.material || '');
    if (!MATERIALS[material])
      throw new Error(`第 ${index + 1} 层的材料“${material || '空'}”不在网页材料库中`);
    const preset = MATERIALS[material];
    const thickness = Number(source.thickness);
    if (!Number.isFinite(thickness) || thickness <= 0)
      throw new Error(`第 ${index + 1} 层厚度无效`);
    return {
      id: `import-${Date.now()}-${index}`,
      name: String(source.name || `第 ${index + 1} 层`),
      material,
      thickness,
      n: preset.n,
      k: preset.k,
      target: false,
      color: preset.color,
    };
  });
  // 交换格式没有响应层标记，先按层名识别，再尝试 InGaAs 材料
  let targetIndex = importedLayers.findIndex((layer) =>
    /absorber|absorption|active|吸收|有源/i.test(layer.name),
  );
  if (targetIndex < 0)
    targetIndex = importedLayers.findIndex((layer) => layer.material === 'InGaAs');
  importedLayers[Math.max(0, targetIndex)].target = true;
  layers = importedLayers;
  scanXId = layers[0].id;
  scanYId = layers[Math.min(1, layers.length - 1)].id;
  singleScanId = layers[Math.max(0, targetIndex)].id;
  result = null;
  updateStructure();
  showWorkspace('structure');
}

// 先取消表格编辑，再恢复输入、层结构和空结果状态
function resetAll() {
  layerGrid.cancelEdit();
  layers = createInitialLayers();
  settings = cloneSettings();
  result = null;
  calculatedSignature = '';
  scanXId = 'spacer-x';
  scanYId = 'spacer-y';
  singleScanId = 'spacer-x';
  populateSettings(settings);
  populateScanDefaults();
  updateStructure();
  showError();
  showWorkspace('structure');
}

// 事件绑定
document
  .querySelectorAll('.workspace-tab')
  .forEach((button) =>
    button.addEventListener('click', () => showWorkspace(button.dataset.workspace)),
  );

// 光谱和场强共用结果，切换时清掉悬停状态并切换导出按钮
document.querySelectorAll('.analysis-tab').forEach((button) =>
  button.addEventListener('click', () => {
    activeView = button.dataset.view;
    $('spectrumActions').hidden = activeView !== 'spectrum';
    spectrumHoverIndex = null;
    $('spectrumTooltip').classList.remove('visible');
    document.querySelectorAll('.analysis-tab').forEach((item) => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('.analysis-view').forEach((view) => {
      view.hidden = view.id !== activeView + 'View';
      view.classList.toggle('active', !view.hidden);
    });
    requestAnimationFrame(drawActive);
  }),
);
// 单层与双层扫描各自保留结果，只切换可见区域
document.querySelectorAll('[data-scan]').forEach((button) =>
  button.addEventListener('click', () => {
    currentScan = button.dataset.scan;
    document.querySelectorAll('[data-scan]').forEach((item) => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    $('singleScanView').hidden = currentScan !== 'single';
    $('doubleScanView').hidden = currentScan !== 'double';
    requestAnimationFrame(drawActive);
  }),
);
// 新增层从自定义材料起步，默认放在结构顶部
$('addLayer').addEventListener('click', () => {
  const preset = MATERIALS.Custom;
  layers.push({
    id: crypto.randomUUID(),
    name: '新建层',
    material: 'Custom',
    thickness: 100,
    n: preset.n,
    k: preset.k,
    target: false,
    color: preset.color,
  });
  updateStructure();
});
$('scanX').addEventListener('change', (event) => {
  scanXId = event.target.value;
});
$('scanY').addEventListener('change', (event) => {
  scanYId = event.target.value;
});
$('singleScanLayer').addEventListener('change', (event) => {
  singleScanId = event.target.value;
});
// 模型输入变化后统一让旧结果失效
for (const id of ['modelInputs', 'modelDialog']) {
  $(id).addEventListener('input', markDirty);
  $(id).addEventListener('change', markDirty);
}
// 扫描条件只影响扫描结果，不清除已经算好的光谱
document.querySelectorAll('.scan-controls').forEach((panel) => {
  panel.addEventListener('input', invalidateScans);
  panel.addEventListener('change', invalidateScans);
});
// 鼠标位置换算成最近采样点，提示框限制在画布内
$('spectrumChart').addEventListener('pointermove', (event) => {
  if (!result || modelSignature() !== calculatedSignature || activeView !== 'spectrum') return;
  const canvas = $('spectrumChart');
  const rect = canvas.getBoundingClientRect();
  const left = SPECTRUM_PADDING.left;
  const right = SPECTRUM_PADDING.right;
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  if (x < left || x > rect.width - right) {
    spectrumHoverIndex = null;
    $('spectrumTooltip').classList.remove('visible');
    drawSpectrum();
    return;
  }
  const ratio = clamp((x - left) / Math.max(1, rect.width - left - right), 0, 1);
  const index = clamp(
    Math.round(ratio * (result.spectrum.length - 1)),
    0,
    result.spectrum.length - 1,
  );
  const point = result.spectrum[index];
  spectrumHoverIndex = index;
  const tooltip = $('spectrumTooltip');
  tooltip.innerHTML = /* HTML */ `
    <b>${formatNumber(point.wavelength, 1)} nm</b>
    <span class="abs-value">
      吸收率
      <strong>${formatNumber(point.absorption * 100, 2)}%</strong>
    </span>
    <span class="resp-value">
      响应度
      <strong>${formatNumber(point.responsivity, 4)} A/W</strong>
    </span>
    <span>
      响应层 n / k
      <strong>${formatNumber(point.targetN, 4)} / ${formatNumber(point.targetK, 4)}</strong>
    </span>
    <span>
      响应层 α
      <strong>${formatNumber(point.targetAlphaCm, 0)} cm⁻¹</strong>
    </span>
    <span>
      ${settings.idealAr ? '内部返回反射' : '总反射率'}
      <strong>${formatNumber(point.reflectance * 100, 2)}%</strong>
    </span>
    <span>
      透射率
      <strong>${formatNumber(point.transmittance * 100, 2)}%</strong>
    </span>
  `;
  tooltip.classList.add('visible');
  const tw = tooltip.offsetWidth || 178;
  const th = tooltip.offsetHeight || 110;
  tooltip.style.left = `${clamp(x + 14, 8, rect.width - tw - 8)}px`;
  tooltip.style.top = `${clamp(y - th / 2, 8, rect.height - th - 8)}px`;
  drawSpectrum();
});
$('spectrumChart').addEventListener('pointerleave', () => {
  spectrumHoverIndex = null;
  $('spectrumTooltip').classList.remove('visible');
  drawSpectrum();
});
// 文件读取和解析在浏览器内完成，导入按钮显示短暂的操作反馈
$('importJson').addEventListener('click', () => $('importJsonFile').click());
$('importJsonFile').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const button = $('importJson');
  try {
    button.disabled = true;
    button.textContent = '导入中…';
    await importJsonFile(file);
    button.textContent = '导入成功';
    setTimeout(() => (button.textContent = '导入'), 1200);
  } catch (error) {
    button.textContent = '导入失败';
    showError(`无法导入结构：${error.message}`);
    setTimeout(() => (button.textContent = '导入'), 1600);
  } finally {
    button.disabled = false;
    event.target.value = '';
  }
});
// 工具栏按钮在这里接到计算和导出函数
$('run').addEventListener('click', runSimulation);
$('reset').addEventListener('click', resetAll);
$('runScan').addEventListener('click', runThicknessScan);
$('runSingleScan').addEventListener('click', runSingleThicknessScan);
$('downloadSingleScanSvg').addEventListener('click', () => exportSingleScanSvg(singleScanResult));
$('downloadCsv').addEventListener('click', () => exportCsv(result));
$('downloadSpectrumSvg').addEventListener('click', () =>
  exportSpectrumSvg(result, settings, simulatedLayers, false),
);
$('downloadResponsivitySvg').addEventListener('click', () =>
  exportSpectrumSvg(result, settings, simulatedLayers, true),
);
$('exportJson').addEventListener('click', () => exportJson(layers));
$('downloadStructure').addEventListener('click', () => {
  if (validateModel()) exportStructureSvg(layers);
});
for (const id of ['wavelengthDependent', 'conservativeInGaAs', 'idealAr']) {
  $(id).addEventListener('change', showPendingModelStatus);
}
// 窗口拖动时合并连续的重绘请求
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(drawActive, 120);
});

// AG Grid 提交编辑后再更新模型，取消编辑不影响已有参数
const layerGrid = createLayerGrid($('layerList'), {
  materials: MATERIALS,
  onEdit(id, field, value) {
    const layer = layers.find((item) => item.id === id);
    layer[field] = value;
    if (field === 'material') Object.assign(layer, MATERIALS[value]);
    showError();
    updateStructure({ refreshRows: field === 'material' });
  },
  onTarget(id) {
    layers.forEach((layer) => {
      layer.target = layer.id === id;
    });
    updateStructure();
  },
  onMove: moveLayer,
  onDelete: deleteLayer,
  onError: showError,
});
// 单层与双层扫描的初值都从配置读取
function populateScanDefaults() {
  for (const [id, value] of Object.entries(SCAN_DEFAULTS)) $(id).value = value;
  updateGridDimensions();
}
// 输入一个方向的网格数，旁边同步显示另一个方向的数量
function updateGridDimensions() {
  $('gridDimensions').textContent = '× ' + $('scanResolution').value;
}
$('scanResolution').addEventListener('input', updateGridDimensions);
$('downloadHeatmapSvg').addEventListener('click', () => exportHeatmapSvg(scanResult));
// 桌面和手机共用模型弹窗，完成时检查其中的输入
document.querySelectorAll('[data-open-settings]').forEach((button) => {
  button.addEventListener('click', () => $('modelDialog').showModal());
});
$('closeSettings').addEventListener('click', () => {
  if (validateInputs('#modelDialog input')) $('modelDialog').close();
});
// 图例和曲线取同一组颜色，手动改配色只需改 ui-config.js
document.documentElement.style.setProperty('--curve-absorption', CHART_COLORS.absorption);
document.documentElement.style.setProperty('--curve-response', CHART_COLORS.responsivity);

// 启动顺序：先填输入，再把层结构同步到表格、剖面和扫描选择
populateSettings(settings);
populateScanDefaults();
updateStructure();
