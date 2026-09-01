import { DEFAULT_LAYERS, DEFAULT_SETTINGS, MATERIALS, incidentOpticalIndex, opticalIndexForLayer, scan2D, simulate } from './tmm-core.js';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const fmt = (value, digits = 3) => Number.isFinite(value) ? value.toFixed(digits) : '—';
const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const cloneLayers = () => DEFAULT_LAYERS.map(layer => ({...layer}));
const cloneSettings = () => ({...DEFAULT_SETTINGS});

let layers = cloneLayers();
let settings = cloneSettings();
let simulatedLayers = cloneLayers();
let result = null;
let scanResult = null;
let activeView = 'spectrum';
let spectrumHoverIndex = null;
let scanXId = 'spacer-x';
let scanYId = 'spacer-y';

function getSettings() {
  return {
    incidentN: Math.max(.01, finite($('incidentN').value, 3.22)),
    incidentK: Math.max(0, finite($('incidentK').value, 0)),
    exitN: Math.max(.01, finite($('exitN').value, 1)),
    exitK: Math.max(0, finite($('exitK').value, 0)),
    wavelengthStart: finite($('wlStart').value, 1260),
    wavelengthEnd: finite($('wlEnd').value, 1360),
    points: clamp(Math.round(finite($('wlPoints').value, 101)), 2, 301),
    targetWavelength: Math.max(100, finite($('targetWl').value, 1310)),
    waistUm: Math.max(.1, finite($('waist').value, 3)),
    angularSamples: clamp(Math.round(finite($('angleSamples').value, 18)), 6, 48),
    gaussian: $('gaussian').checked,
    wavelengthDependent: $('wavelengthDependent').checked,
    collectionEfficiency: clamp(finite($('collection').value, 100) / 100, 0, 1),
  };
}

function populateSettings(next) {
  $('incidentN').value = next.incidentN; $('incidentK').value = next.incidentK;
  $('exitN').value = next.exitN; $('exitK').value = next.exitK;
  $('wlStart').value = next.wavelengthStart; $('wlEnd').value = next.wavelengthEnd;
  $('wlPoints').value = next.points; $('targetWl').value = next.targetWavelength;
  $('waist').value = next.waistUm; $('angleSamples').value = next.angularSamples;
  $('gaussian').checked = next.gaussian; $('wavelengthDependent').checked = next.wavelengthDependent;
  $('collection').value = next.collectionEfficiency * 100;
}

function materialOptions(selected) {
  return Object.keys(MATERIALS).map(material => `<option value="${escapeHtml(material)}" ${material === selected ? 'selected' : ''}>${escapeHtml(material)}</option>`).join('');
}

function renderLayerEditor() {
  const displayLayers = [...layers].reverse();
  $('layerCount').textContent = `${layers.length} LAYERS`;
  $('layerList').innerHTML = displayLayers.map((layer, index) => `
    <article class="layer-editor-row ${layer.target ? 'target' : ''}" data-id="${layer.id}" style="--layer-color:${layer.color}">
      <div class="layer-main">
        <input class="layer-name" value="${escapeHtml(layer.name)}" aria-label="第 ${index + 1} 层名称">
        <div class="thickness-input"><input class="layer-thickness" type="number" min="0.01" step="0.5" value="${layer.thickness}" aria-label="${escapeHtml(layer.name)} 厚度"><i>nm</i></div>
      </div>
      <div class="layer-optics">
        <select class="layer-material" aria-label="${escapeHtml(layer.name)} 材料">${materialOptions(layer.material)}</select>
        <input class="layer-n" type="number" step="0.001" value="${layer.n}" title="折射率实部 n" aria-label="${escapeHtml(layer.name)} 折射率实部 n">
        <input class="layer-k" type="number" step="0.001" value="${layer.k}" title="消光系数 k" aria-label="${escapeHtml(layer.name)} 消光系数 k">
      </div>
      <div class="layer-actions">
        <button class="target-btn ${layer.target ? 'active' : ''}" type="button">${layer.target ? '◎ 响应层' : '○ 设为响应层'}</button>
        <div class="move-actions"><button class="move-up" type="button" aria-label="上移" ${index === 0 ? 'disabled' : ''}>↑</button><button class="move-down" type="button" aria-label="下移" ${index === displayLayers.length - 1 ? 'disabled' : ''}>↓</button><button class="delete" type="button" aria-label="删除" ${layers.length === 1 ? 'disabled' : ''}>×</button></div>
      </div>
    </article>`).join('');

  $('layerList').querySelectorAll('.layer-editor-row').forEach(row => {
    const id = row.dataset.id;
    const find = () => layers.find(layer => layer.id === id);
    row.querySelector('.layer-name').addEventListener('input', event => { find().name = event.target.value; renderSchematic(); refreshScanOptions(false); });
    row.querySelector('.layer-thickness').addEventListener('input', event => { find().thickness = Math.max(.01, finite(event.target.value, .01)); renderSchematic(); });
    row.querySelector('.layer-n').addEventListener('input', event => { find().n = Math.max(.001, finite(event.target.value, .001)); renderSchematic(); });
    row.querySelector('.layer-k').addEventListener('input', event => { find().k = Math.max(0, finite(event.target.value, 0)); renderSchematic(); });
    row.querySelector('.layer-material').addEventListener('change', event => {
      const preset = MATERIALS[event.target.value]; const layer = find();
      layer.material = event.target.value; layer.n = preset.n; layer.k = preset.k; layer.color = preset.color;
      renderLayerEditor(); renderSchematic();
    });
    row.querySelector('.target-btn').addEventListener('click', () => { layers.forEach(layer => layer.target = layer.id === id); renderLayerEditor(); renderSchematic(); });
    row.querySelector('.move-up').addEventListener('click', () => moveLayer(id, 1));
    row.querySelector('.move-down').addEventListener('click', () => moveLayer(id, -1));
    row.querySelector('.delete').addEventListener('click', () => deleteLayer(id));
  });
}

function moveLayer(id, offset) {
  const index = layers.findIndex(layer => layer.id === id), next = index + offset;
  if (index < 0 || next < 0 || next >= layers.length) return;
  [layers[index], layers[next]] = [layers[next], layers[index]];
  renderLayerEditor(); renderSchematic(); refreshScanOptions(false);
}

function deleteLayer(id) {
  if (layers.length === 1) return;
  const removed = layers.find(layer => layer.id === id);
  layers = layers.filter(layer => layer.id !== id);
  if (removed?.target && layers.length) layers[0].target = true;
  if (!layers.some(layer => layer.id === scanXId)) scanXId = layers[0].id;
  if (!layers.some(layer => layer.id === scanYId)) scanYId = layers[Math.min(1, layers.length - 1)].id;
  renderLayerEditor(); renderSchematic(); refreshScanOptions();
}

function layerHeight(thickness) { return clamp(34 + Math.log10(Math.max(1, thickness) + 1) * 19, 40, 91); }

function renderSchematic() {
  const currentSettings = getSettings();
  const total = layers.reduce((sum, layer) => sum + layer.thickness, 0);
  $('stackTotal').textContent = `TOTAL ${fmt(total, 1)} nm · ${layers.length} LAYERS`;
  const reversed = [...layers].reverse();
  $('schematic').innerHTML = `
    <div class="schematic-boundary">EXIT MEDIUM · n = ${fmt(currentSettings.exitN, 2)}</div>
    ${reversed.map(layer => {
      const opticalIndex = opticalIndexForLayer(layer, currentSettings, currentSettings.targetWavelength);
      const badge = layer.target ? 'PHOTOACTIVE' : layer.id === scanXId ? 'SCAN X' : layer.id === scanYId ? 'SCAN Y' : '';
      const period = (layer.id === scanXId || layer.id === scanYId) ? ` · Λ≈${fmt(currentSettings.targetWavelength / (2 * Math.max(.01, opticalIndex.re)), 1)} nm` : '';
      const dispersionMark = currentSettings.wavelengthDependent && (layer.material === 'InP' || (layer.material === 'InGaAs' && layer.target)) ? ' · λ' : '';
      return `<div class="schematic-layer ${layer.target ? 'target' : ''} ${layer.thickness <= 10 ? 'thin' : ''}" style="--layer-color:${layer.color};height:${layerHeight(layer.thickness)}px"><div class="schematic-name"><b>${escapeHtml(layer.name)}</b><small>${escapeHtml(layer.material)} · n ${fmt(opticalIndex.re, 3)} · k ${fmt(opticalIndex.im, 4)}${dispersionMark}${period}</small></div><span class="schematic-thickness">${fmt(layer.thickness, layer.thickness % 1 ? 1 : 0)} nm</span>${badge ? `<i class="schematic-badge">${badge}</i>` : ''}</div>`;
    }).join('')}
    <div class="schematic-boundary">INCIDENT MEDIUM · n = ${fmt(incidentOpticalIndex(currentSettings, currentSettings.targetWavelength).re, 3)}</div>`;
}

function refreshScanOptions(reset = true) {
  const make = selected => layers.map(layer => `<option value="${layer.id}" ${layer.id === selected ? 'selected' : ''}>${escapeHtml(layer.name)}</option>`).join('');
  $('scanX').innerHTML = make(scanXId); $('scanY').innerHTML = make(scanYId);
  if (reset) scanResult = null;
  renderSchematic();
}

function runSimulation() {
  settings = getSettings();
  if (settings.wavelengthEnd <= settings.wavelengthStart) {
    const swap = settings.wavelengthStart; settings.wavelengthStart = settings.wavelengthEnd; settings.wavelengthEnd = swap;
    populateSettings(settings);
  }
  const button = $('run'); button.disabled = true; button.textContent = '计算中…';
  requestAnimationFrame(() => {
    try { simulatedLayers = layers.map(layer => ({...layer})); result = simulate(simulatedLayers, {...settings}); updateResults(); }
    finally { button.disabled = false; button.textContent = '运行仿真'; }
  });
}

function updateResults() {
  const target = result.target, peak = result.peak;
  $('modelStatus').textContent = settings.wavelengthDependent ? 'DISPERSIVE n(λ) + ik(λ)' : 'CONSTANT n + ik';
  $('modelStatus').classList.toggle('dispersive', settings.wavelengthDependent);
  $('targetMetricLabel').textContent = `${fmt(settings.targetWavelength, 0)} nm 响应度`;
  $('absorptionMetricLabel').textContent = `${fmt(settings.targetWavelength, 0)} nm 吸收效率`;
  $('responsivity').textContent = fmt(target.responsivity, 4);
  $('absorption').textContent = `${fmt(target.absorption * 100, 2)}%`;
  $('targetLayerName').textContent = simulatedLayers.find(layer => layer.target)?.name || 'Target layer';
  $('peakWl').textContent = `${fmt(peak.wavelength, 1)} nm`;
  $('peakResponse').textContent = `${fmt(peak.responsivity, 4)} A/W`;
  $('rtMetric').textContent = `${fmt(target.reflectance * 100, 1)} / ${fmt(target.transmittance * 100, 1)}%`;
  $('parasitic').textContent = `PARASITIC ABS. ${fmt(target.parasitic * 100, 1)}%`;
  $('spectrumRange').textContent = `${fmt(settings.wavelengthStart, 0)} — ${fmt(settings.wavelengthEnd, 0)} nm`;
  $('fieldWavelength').textContent = `${fmt(settings.targetWavelength, 0)} nm · NORMAL INCIDENCE TE`;
  [['R',target.reflectance],['A',target.absorption],['T',target.transmittance]].forEach(([key,value]) => {
    $(`energy${key}`).textContent = `${fmt(value * 100, 2)}%`;
    $(`bar${key}`).style.width = `${clamp(value * 100, 0, 100)}%`;
  });
  drawActive();
}

function canvasContext(canvas) {
  const rect = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(320, Math.round(rect.width)), height = Math.max(220, Math.round(rect.height));
  canvas.width = width * dpr; canvas.height = height * dpr;
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
  return {ctx, width, height};
}

function chartBase(canvas, xMin, xMax, yMin, yMax, options = {}) {
  const {ctx,width,height} = canvasContext(canvas), pad = {l:48,r:options.right || 22,t:22,b:34};
  const plot = {x:pad.l,y:pad.t,w:width-pad.l-pad.r,h:height-pad.t-pad.b};
  const xMap = x => plot.x + (x-xMin) / Math.max(1e-12,xMax-xMin) * plot.w;
  const yMap = y => plot.y + plot.h - (y-yMin) / Math.max(1e-12,yMax-yMin) * plot.h;
  ctx.clearRect(0,0,width,height); ctx.font='8px ui-monospace, monospace'; ctx.lineWidth=1;
  for(let i=0;i<=5;i++){
    const x=plot.x+plot.w*i/5,y=plot.y+plot.h*i/5;
    ctx.strokeStyle='rgba(86,132,145,.13)';ctx.beginPath();ctx.moveTo(x,plot.y);ctx.lineTo(x,plot.y+plot.h);ctx.stroke();ctx.beginPath();ctx.moveTo(plot.x,y);ctx.lineTo(plot.x+plot.w,y);ctx.stroke();
    ctx.fillStyle='#5d7684';ctx.textAlign='center';ctx.fillText(fmt(xMin+(xMax-xMin)*i/5,0),x,plot.y+plot.h+18);
    ctx.textAlign='right';ctx.fillText(options.percent?`${fmt(yMax-(yMax-yMin)*i/5,0)}%`:fmt(yMax-(yMax-yMin)*i/5,1),plot.x-8,y+3);
  }
  ctx.strokeStyle='#2b4655';ctx.strokeRect(plot.x,plot.y,plot.w,plot.h);
  return {ctx,width,height,plot,xMap,yMap};
}

function drawSpectrum() {
  if (!result) return;
  const points=result.spectrum, xMin=points[0].wavelength, xMax=points.at(-1).wavelength;
  const maxR=Math.max(...points.map(point=>point.responsivity),.1)*1.12;
  const base=chartBase($('spectrumChart'),xMin,xMax,0,100,{right:48,percent:true}),{ctx,plot,xMap,yMap}=base;
  const rMap=y=>plot.y+plot.h-y/maxR*plot.h;
  ctx.beginPath(); points.forEach((point,i)=>{const x=xMap(point.wavelength),y=yMap(point.absorption*100);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.lineTo(xMap(xMax),yMap(0));ctx.lineTo(xMap(xMin),yMap(0));ctx.closePath();
  const grad=ctx.createLinearGradient(0,plot.y,0,plot.y+plot.h);grad.addColorStop(0,'rgba(239,134,89,.35)');grad.addColorStop(1,'rgba(239,134,89,.02)');ctx.fillStyle=grad;ctx.fill();
  ctx.beginPath();points.forEach((point,i)=>{const x=xMap(point.wavelength),y=yMap(point.absorption*100);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.strokeStyle='#ef8659';ctx.lineWidth=2;ctx.stroke();
  ctx.beginPath();points.forEach((point,i)=>{const x=xMap(point.wavelength),y=rMap(point.responsivity);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.strokeStyle='#54e0d2';ctx.lineWidth=2.3;ctx.stroke();
  const tx=xMap(settings.targetWavelength);ctx.setLineDash([4,5]);ctx.strokeStyle='rgba(184,242,235,.65)';ctx.beginPath();ctx.moveTo(tx,plot.y);ctx.lineTo(tx,plot.y+plot.h);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#8fc8c2';ctx.textAlign='center';ctx.fillText(`${fmt(settings.targetWavelength,0)} nm`,tx,plot.y+11);
  ctx.fillStyle='#5d7684';ctx.textAlign='left';for(let i=0;i<=4;i++)ctx.fillText(fmt(maxR*(4-i)/4,2),plot.x+plot.w+7,plot.y+plot.h*i/4+3);
  const target=result.target, targetAbsY=yMap(target.absorption*100), targetRespY=rMap(target.responsivity);
  ctx.fillStyle='#ef8659';ctx.beginPath();ctx.arc(tx,targetAbsY,3.5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#071018';ctx.lineWidth=1.5;ctx.stroke();
  ctx.fillStyle='#54e0d2';ctx.beginPath();ctx.arc(tx,targetRespY,3.5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#071018';ctx.stroke();
  if(spectrumHoverIndex!==null&&points[spectrumHoverIndex]){
    const point=points[spectrumHoverIndex],hx=xMap(point.wavelength),ha=yMap(point.absorption*100),hr=rMap(point.responsivity);
    ctx.strokeStyle='rgba(224,246,244,.72)';ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(hx,plot.y);ctx.lineTo(hx,plot.y+plot.h);ctx.stroke();ctx.setLineDash([]);
    [['#ef8659',ha],['#54e0d2',hr]].forEach(([color,y])=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(hx,y,4,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#071018';ctx.lineWidth=1.5;ctx.stroke()});
  }
}

function drawField() {
  if (!result) return;
  const points=result.field,total=result.totalThickness,base=chartBase($('fieldChart'),0,total,0,1,{right:18}),{ctx,plot,xMap,yMap}=base;
  let offset=0;simulatedLayers.forEach(layer=>{const x1=xMap(offset),x2=xMap(offset+layer.thickness);ctx.fillStyle=`${layer.color}16`;ctx.fillRect(x1,plot.y,x2-x1,plot.h);offset+=layer.thickness;ctx.strokeStyle='rgba(121,159,168,.2)';ctx.beginPath();ctx.moveTo(xMap(offset),plot.y);ctx.lineTo(xMap(offset),plot.y+plot.h);ctx.stroke()});
  ctx.beginPath();points.forEach((point,i)=>{const x=xMap(point.depth),y=yMap(point.intensity);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.lineTo(xMap(total),yMap(0));ctx.lineTo(xMap(0),yMap(0));ctx.closePath();const grad=ctx.createLinearGradient(0,plot.y,0,plot.y+plot.h);grad.addColorStop(0,'rgba(239,134,89,.48)');grad.addColorStop(1,'rgba(239,134,89,.03)');ctx.fillStyle=grad;ctx.fill();
  ctx.beginPath();points.forEach((point,i)=>{const x=xMap(point.depth),y=yMap(point.intensity);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.strokeStyle='#ef8659';ctx.lineWidth=2.1;ctx.stroke();
}

function heatColor(value,min,max){const t=(value-min)/Math.max(1e-12,max-min),hue=190-160*t;return `hsl(${hue} ${55+28*t}% ${30+24*t}%)`}
function drawHeatmap() {
  if (!scanResult) return;
  const {ctx,width,height}=canvasContext($('heatmap')),pad={l:52,r:18,t:20,b:45},plot={x:52,y:20,w:width-70,h:height-65};
  ctx.clearRect(0,0,width,height);const cols=scanResult.xValues.length,rows=scanResult.yValues.length,cw=plot.w/cols,ch=plot.h/rows;
  scanResult.values.forEach((row,yi)=>row.forEach((value,xi)=>{ctx.fillStyle=heatColor(value,scanResult.min,scanResult.max);ctx.fillRect(plot.x+xi*cw,plot.y+(rows-1-yi)*ch,cw+.5,ch+.5)}));
  ctx.strokeStyle='#35505e';ctx.strokeRect(plot.x,plot.y,plot.w,plot.h);ctx.fillStyle='#657e8b';ctx.font='8px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(fmt(scanResult.xValues[0],0),plot.x,plot.y+plot.h+17);ctx.fillText(fmt(scanResult.xValues.at(-1),0),plot.x+plot.w,plot.y+plot.h+17);ctx.fillText('X THICKNESS · nm',plot.x+plot.w/2,plot.y+plot.h+34);ctx.textAlign='right';ctx.fillText(fmt(scanResult.yValues[0],0),plot.x-8,plot.y+plot.h);ctx.fillText(fmt(scanResult.yValues.at(-1),0),plot.x-8,plot.y+7);
  const ox=plot.x+(scanResult.optimum.x-scanResult.xValues[0])/(scanResult.xValues.at(-1)-scanResult.xValues[0])*plot.w,oy=plot.y+plot.h-(scanResult.optimum.y-scanResult.yValues[0])/(scanResult.yValues.at(-1)-scanResult.yValues[0])*plot.h;ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(ox-7,oy);ctx.lineTo(ox+7,oy);ctx.moveTo(ox,oy-7);ctx.lineTo(ox,oy+7);ctx.stroke();
}

function drawActive(){if(activeView==='spectrum')drawSpectrum();else if(activeView==='field')drawField();else drawHeatmap()}

function runThicknessScan() {
  if (scanXId === scanYId) { $('scanResult').innerHTML='<span>INPUT ERROR</span><b>请选择不同层</b><small>X 与 Y 不能是同一层。</small>'; return; }
  settings=getSettings();const button=$('runScan');button.disabled=true;button.textContent='扫描中…';
  requestAnimationFrame(()=>{try{
    scanResult=scan2D(layers.map(layer=>({...layer})),settings,scanXId,scanYId,[finite($('xMin').value,20),finite($('xMax').value,260)],[finite($('yMin').value,20),finite($('yMax').value,260)],clamp(finite($('scanResolution').value,25),8,41));
    const xName=layers.find(layer=>layer.id===scanXId)?.name||'X',yName=layers.find(layer=>layer.id===scanYId)?.name||'Y';
    $('scanResult').innerHTML=`<span>GRID OPTIMUM</span><b>${fmt(scanResult.optimum.responsivity,4)} A/W</b><small>${escapeHtml(xName)} · ${fmt(scanResult.optimum.x,1)} nm<br>${escapeHtml(yName)} · ${fmt(scanResult.optimum.y,1)} nm</small>`;
    $('emptyHeatmap').classList.add('hidden');drawHeatmap();renderSchematic();
  }finally{button.disabled=false;button.textContent='开始双参数扫描'}});
}

function download(name, content, type) { const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),200); }
function exportCsv(){if(!result)return;const lines=['wavelength_nm,target_n,target_k,target_alpha_cm-1,target_absorption,responsivity_A_W,reflectance,transmittance,parasitic_absorption',...result.spectrum.map(p=>[p.wavelength,p.targetN,p.targetK,p.targetAlphaCm,p.absorption,p.responsivity,p.reflectance,p.transmittance,p.parasitic].join(','))];download('pd-tmm-spectrum.csv',lines.join('\n'),'text/csv;charset=utf-8')}
function exportJson(){download('pd-tmm-structure.json',JSON.stringify({version:1,stackOrder:'top-to-bottom',layers:[...layers].reverse().map(({name,material,thickness})=>({name,material,thickness}))},null,2),'application/json')}

async function importJsonFile(file) {
  const payload = JSON.parse(await file.text());
  const layerRows = Array.isArray(payload) ? payload : payload?.layers;
  if (!Array.isArray(layerRows) || !layerRows.length) throw new Error('JSON 中没有有效的 layers 数组');
  const physicalRows = payload?.stackOrder === 'incident-to-exit' ? [...layerRows] : [...layerRows].reverse();
  const importedLayers = physicalRows.map((source,index) => {
    if (!source || typeof source !== 'object') throw new Error(`第 ${index + 1} 层格式无效`);
    const material = String(source.material || '');
    if (!MATERIALS[material]) throw new Error(`第 ${index + 1} 层的材料“${material || '空'}”不在网页材料库中`);
    const preset = MATERIALS[material], thickness = Number(source.thickness);
    if (!Number.isFinite(thickness) || thickness <= 0) throw new Error(`第 ${index + 1} 层厚度无效`);
    return {id:`import-${Date.now()}-${index}`,name:String(source.name || `Layer ${index + 1}`),material,thickness,n:preset.n,k:preset.k,target:false,color:preset.color};
  });
  let targetIndex = importedLayers.findIndex(layer => /absorber|absorption|active|吸收|有源/i.test(layer.name));
  if (targetIndex < 0) targetIndex = importedLayers.findIndex(layer => layer.material === 'InGaAs');
  importedLayers[Math.max(0,targetIndex)].target = true;
  layers = importedLayers;
  settings = getSettings();
  scanXId = layers[0].id; scanYId = layers[Math.min(1,layers.length-1)].id;
  scanResult = null; renderLayerEditor(); refreshScanOptions(false); renderSchematic(); $('emptyHeatmap').classList.remove('hidden');
  $('scanResult').innerHTML='<span>REFERENCE</span><b>等待扫描</b><small>已载入新的层结构</small>'; runSimulation();
}

function exportStructureSvg(){
  const s=getSettings(),ordered=[...layers].reverse(),heights=ordered.map(layer=>layerHeight(layer.thickness)),width=700,stackX=120,stackW=460,top=110,totalH=heights.reduce((a,b)=>a+b,0)+76,height=top+totalH+125;let y=top+38;
  const esc=value=>escapeHtml(value);let body=`<rect x="0" y="0" width="${width}" height="${height}" fill="#071018"/><text x="42" y="50" fill="#eef7f8" font-family="Arial,sans-serif" font-size="28" font-weight="700">PD TMM structure schematic</text><text x="42" y="77" fill="#7f98a8" font-family="monospace" font-size="12">${layers.length} layers · ${fmt(layers.reduce((a,l)=>a+l.thickness,0),1)} nm · ${fmt(s.targetWavelength,0)} nm</text><rect x="${stackX}" y="${top}" width="${stackW}" height="38" rx="7" fill="#3f4c54" stroke="#7a8b92"/><text x="${width/2}" y="${top+24}" text-anchor="middle" fill="#fff" font-family="Arial" font-size="13" font-weight="700">EXIT MEDIUM · n=${fmt(s.exitN,2)}</text>`;
  ordered.forEach((layer,index)=>{const h=heights[index];body+=`<rect x="${stackX}" y="${y}" width="${stackW}" height="${h}" fill="${layer.color}" stroke="${layer.target?'#ffbb97':'#d6f3f0'}" stroke-width="${layer.target?4:1}"/><text x="${stackX+stackW/2-18}" y="${y+h/2+4}" text-anchor="middle" fill="#fff" stroke="#071018" stroke-width="3" paint-order="stroke" font-family="Arial" font-size="13" font-weight="700">${esc(layer.name)}</text><text x="${stackX+stackW+16}" y="${y+h/2+4}" fill="#c8d7dc" font-family="monospace" font-size="12">${fmt(layer.thickness,layer.thickness%1?1:0)} nm</text>`;y+=h});
  body+=`<rect x="${stackX}" y="${y}" width="${stackW}" height="38" rx="7" fill="#3f4c54" stroke="#7a8b92"/><text x="${width/2}" y="${y+24}" text-anchor="middle" fill="#fff" font-family="Arial" font-size="13" font-weight="700">INCIDENT MEDIUM · n=${fmt(s.incidentN,2)}</text><path d="M350 ${y+102}V${y+50}M350 ${y+50}l-8 12M350 ${y+50}l8 12" stroke="#54e0d2" stroke-width="4" fill="none" stroke-linecap="round"/><text x="350" y="${y+122}" text-anchor="middle" fill="#7f98a8" font-family="monospace" font-size="11">LIGHT FROM SUBSTRATE</text>`;
  download('pd-tmm-structure.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`,'image/svg+xml');
}

function resetAll(){layers=cloneLayers();settings=cloneSettings();scanXId='spacer-x';scanYId='spacer-y';scanResult=null;populateSettings(settings);renderLayerEditor();refreshScanOptions();$('emptyHeatmap').classList.remove('hidden');$('scanResult').innerHTML='<span>REFERENCE</span><b>等待扫描</b><small>默认复现 spacer X / Y 腔共振图</small>';runSimulation()}

document.querySelectorAll('.control-tab').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.control-tab').forEach(x=>x.classList.toggle('active',x===button));document.querySelectorAll('.control-view').forEach(view=>view.classList.toggle('active',view.id===`${button.dataset.control}Control`))}));
document.querySelectorAll('.analysis-tab').forEach(button=>button.addEventListener('click',()=>{activeView=button.dataset.view;spectrumHoverIndex=null;$('spectrumTooltip').classList.remove('visible');document.querySelectorAll('.analysis-tab').forEach(x=>x.classList.toggle('active',x===button));document.querySelectorAll('.analysis-view').forEach(view=>view.classList.toggle('active',view.id===`${activeView}View`));requestAnimationFrame(drawActive)}));
$('addLayer').addEventListener('click',()=>{const preset=MATERIALS.Custom;layers.push({id:`layer-${Date.now()}`,name:'Custom layer',material:'Custom',thickness:100,n:preset.n,k:preset.k,target:false,color:preset.color});renderLayerEditor();refreshScanOptions(false);renderSchematic()});
$('scanX').addEventListener('change',event=>{scanXId=event.target.value;renderSchematic()});$('scanY').addEventListener('change',event=>{scanYId=event.target.value;renderSchematic()});
$('spectrumChart').addEventListener('pointermove',event=>{
  if(!result||activeView!=='spectrum')return;
  const canvas=$('spectrumChart'),rect=canvas.getBoundingClientRect(),left=48,right=48,x=event.clientX-rect.left,y=event.clientY-rect.top;
  if(x<left||x>rect.width-right){spectrumHoverIndex=null;$('spectrumTooltip').classList.remove('visible');drawSpectrum();return}
  const ratio=clamp((x-left)/Math.max(1,rect.width-left-right),0,1),index=clamp(Math.round(ratio*(result.spectrum.length-1)),0,result.spectrum.length-1),point=result.spectrum[index];
  spectrumHoverIndex=index;const tooltip=$('spectrumTooltip');tooltip.innerHTML=`<b>${fmt(point.wavelength,1)} nm</b><span class="abs-value">吸收效率 <strong>${fmt(point.absorption*100,2)}%</strong></span><span class="resp-value">响应度 <strong>${fmt(point.responsivity,4)} A/W</strong></span><span>响应层 n / k <strong>${fmt(point.targetN,4)} / ${fmt(point.targetK,4)}</strong></span><span>响应层 α <strong>${fmt(point.targetAlphaCm,0)} cm⁻¹</strong></span><span>反射率 <strong>${fmt(point.reflectance*100,2)}%</strong></span><span>透射率 <strong>${fmt(point.transmittance*100,2)}%</strong></span>`;tooltip.classList.add('visible');
  const tw=tooltip.offsetWidth||178,th=tooltip.offsetHeight||110;tooltip.style.left=`${clamp(x+14,8,rect.width-tw-8)}px`;tooltip.style.top=`${clamp(y-th/2,8,rect.height-th-8)}px`;drawSpectrum();
});
$('spectrumChart').addEventListener('pointerleave',()=>{spectrumHoverIndex=null;$('spectrumTooltip').classList.remove('visible');drawSpectrum()});
$('importJson').addEventListener('click',()=>$('importJsonFile').click());
$('importJsonFile').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;const button=$('importJson');try{button.disabled=true;button.textContent='导入中…';await importJsonFile(file);button.textContent='导入成功';setTimeout(()=>button.textContent='导入 JSON',1200)}catch(error){button.textContent='导入失败';window.alert(`无法导入结构：${error.message}`);setTimeout(()=>button.textContent='导入 JSON',1600)}finally{button.disabled=false;event.target.value=''}});
$('run').addEventListener('click',runSimulation);$('reset').addEventListener('click',resetAll);$('runScan').addEventListener('click',runThicknessScan);$('downloadCsv').addEventListener('click',exportCsv);$('exportJson').addEventListener('click',exportJson);$('downloadStructure').addEventListener('click',exportStructureSvg);
['targetWl','incidentN','exitN'].forEach(id=>$(id).addEventListener('input',renderSchematic));
$('wavelengthDependent').addEventListener('change',()=>{renderSchematic();$('modelStatus').textContent=$('wavelengthDependent').checked?'DISPERSIVE · RUN TO APPLY':'CONSTANT n + ik'});
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(drawActive,120)});

populateSettings(settings);renderLayerEditor();refreshScanOptions(false);renderSchematic();runSimulation();
