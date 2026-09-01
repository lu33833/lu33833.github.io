import { DEFAULT_LAYERS, DEFAULT_SETTINGS, MATERIALS, incidentOpticalIndex, opticalIndexForLayer, scan2D, simulate } from './tmm-core.js?v=20260901-3';

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

const SPECTRUM_PAD = {l:66,r:72,t:28,b:52};
const RESPONSIVITY_AXIS_MAX = 1.2;
const SPECTRUM_COLORS = {absorption:'#c24f1a',responsivity:'#0068b7',ink:'#111827',grid:'#d9dee3',minor:'#edf0f2'};

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
    conservativeInGaAs: $('conservativeInGaAs').checked,
    idealAr: $('idealAr').checked,
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
  $('conservativeInGaAs').checked = next.conservativeInGaAs;
  $('idealAr').checked = next.idealAr;
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
    <div class="schematic-boundary">INCIDENT MEDIUM · n = ${fmt(incidentOpticalIndex(currentSettings, currentSettings.targetWavelength).re, 3)}${currentSettings.idealAr ? ' · IDEAL BACKSIDE AR' : ''}</div>`;
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
  const dispersionStatus = settings.wavelengthDependent ? (settings.conservativeInGaAs ? 'ADACHI LOW-k' : 'O-BAND TABLE n(λ)+ik(λ)') : 'CONSTANT n + ik';
  $('modelStatus').textContent = `${dispersionStatus}${settings.idealAr ? ' · IDEAL AR' : ''}`;
  $('modelStatus').classList.toggle('dispersive', settings.wavelengthDependent);
  $('targetMetricLabel').textContent = `${fmt(settings.targetWavelength, 0)} nm 响应度`;
  $('absorptionMetricLabel').textContent = `${fmt(settings.targetWavelength, 0)} nm 吸收效率`;
  $('responsivity').textContent = fmt(target.responsivity, 4);
  $('absorption').textContent = `${fmt(target.absorption * 100, 2)}%`;
  $('targetLayerName').textContent = simulatedLayers.find(layer => layer.target)?.name || 'Target layer';
  $('peakWl').textContent = `${fmt(peak.wavelength, 1)} nm`;
  $('peakResponse').textContent = `${fmt(peak.responsivity, 4)} A/W`;
  $('rtMetric').textContent = `${fmt(target.reflectance * 100, 1)} / ${fmt(target.transmittance * 100, 1)}%`;
  $('parasitic').textContent = settings.idealAr ? `BACKSIDE AR · PARASITIC ${fmt(target.parasitic * 100, 1)}%` : `PARASITIC ABS. ${fmt(target.parasitic * 100, 1)}%`;
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
  const {ctx,width,height} = canvasContext(canvas), pad = {l:options.left || 48,r:options.right || 22,t:options.top || 22,b:options.bottom || 34};
  const plot = {x:pad.l,y:pad.t,w:width-pad.l-pad.r,h:height-pad.t-pad.b};
  const xMap = x => plot.x + (x-xMin) / Math.max(1e-12,xMax-xMin) * plot.w;
  const yMap = y => plot.y + plot.h - (y-yMin) / Math.max(1e-12,yMax-yMin) * plot.h;
  const xTicks=options.xTicks || 5,yTicks=options.yTicks || 5;
  ctx.clearRect(0,0,width,height);
  if(options.paper){ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height)}
  ctx.font=options.paper?'10px Arial, sans-serif':'8px ui-monospace, monospace';ctx.lineWidth=1;
  for(let i=0;i<=xTicks;i++){
    const x=plot.x+plot.w*i/xTicks;
    ctx.strokeStyle=options.paper?SPECTRUM_COLORS.grid:'rgba(86,132,145,.13)';ctx.beginPath();ctx.moveTo(x,plot.y);ctx.lineTo(x,plot.y+plot.h);ctx.stroke();
    if(options.paper){ctx.strokeStyle=SPECTRUM_COLORS.ink;ctx.beginPath();ctx.moveTo(x,plot.y+plot.h);ctx.lineTo(x,plot.y+plot.h+5);ctx.stroke()}
    ctx.fillStyle=options.paper?SPECTRUM_COLORS.ink:'#5d7684';ctx.textAlign='center';ctx.fillText(fmt(xMin+(xMax-xMin)*i/xTicks,options.xDigits || 0),x,plot.y+plot.h+20);
  }
  for(let i=0;i<=yTicks;i++){
    const y=plot.y+plot.h*i/yTicks;
    ctx.strokeStyle=options.paper?SPECTRUM_COLORS.grid:'rgba(86,132,145,.13)';ctx.beginPath();ctx.moveTo(plot.x,y);ctx.lineTo(plot.x+plot.w,y);ctx.stroke();
    if(options.paper){ctx.strokeStyle=SPECTRUM_COLORS.ink;ctx.beginPath();ctx.moveTo(plot.x-5,y);ctx.lineTo(plot.x,y);ctx.stroke()}
    ctx.fillStyle=options.paper?SPECTRUM_COLORS.ink:'#5d7684';ctx.textAlign='right';ctx.fillText(options.percent?`${fmt(yMax-(yMax-yMin)*i/yTicks,0)}%`:fmt(yMax-(yMax-yMin)*i/yTicks,1),plot.x-9,y+3);
  }
  ctx.strokeStyle=options.paper?SPECTRUM_COLORS.ink:'#2b4655';ctx.strokeRect(plot.x,plot.y,plot.w,plot.h);
  return {ctx,width,height,plot,xMap,yMap};
}

function drawSpectrum() {
  if (!result) return;
  const points=result.spectrum, xMin=points[0].wavelength, xMax=points.at(-1).wavelength;
  const base=chartBase($('spectrumChart'),xMin,xMax,0,100,{left:SPECTRUM_PAD.l,right:SPECTRUM_PAD.r,top:SPECTRUM_PAD.t,bottom:SPECTRUM_PAD.b,percent:true,paper:true,xTicks:5,yTicks:5}),{ctx,width,height,plot,xMap,yMap}=base;
  const rMap=y=>plot.y+plot.h-clamp(y,0,RESPONSIVITY_AXIS_MAX)/RESPONSIVITY_AXIS_MAX*plot.h;
  ctx.beginPath();points.forEach((point,i)=>{const x=xMap(point.wavelength),y=yMap(point.absorption*100);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.strokeStyle=SPECTRUM_COLORS.absorption;ctx.lineWidth=2.2;ctx.stroke();
  ctx.beginPath();points.forEach((point,i)=>{const x=xMap(point.wavelength),y=rMap(point.responsivity);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.strokeStyle=SPECTRUM_COLORS.responsivity;ctx.lineWidth=2.4;ctx.stroke();
  ctx.font='10px Arial, sans-serif';ctx.fillStyle=SPECTRUM_COLORS.ink;ctx.textAlign='left';
  for(let i=0;i<=6;i++){const value=RESPONSIVITY_AXIS_MAX*(6-i)/6,y=plot.y+plot.h*i/6;ctx.strokeStyle=SPECTRUM_COLORS.ink;ctx.beginPath();ctx.moveTo(plot.x+plot.w,y);ctx.lineTo(plot.x+plot.w+5,y);ctx.stroke();ctx.fillText(value.toFixed(1),plot.x+plot.w+9,y+3)}
  ctx.font='11px Arial, sans-serif';ctx.textAlign='center';ctx.fillText('Wavelength (nm)',plot.x+plot.w/2,height-10);
  ctx.save();ctx.translate(15,plot.y+plot.h/2);ctx.rotate(-Math.PI/2);ctx.fillText('Absorption efficiency (%)',0,0);ctx.restore();
  ctx.save();ctx.translate(width-13,plot.y+plot.h/2);ctx.rotate(Math.PI/2);ctx.fillText('Responsivity (A/W)',0,0);ctx.restore();
  const targetInRange=settings.targetWavelength>=xMin&&settings.targetWavelength<=xMax,tx=xMap(settings.targetWavelength);
  if(targetInRange){
    ctx.setLineDash([5,5]);ctx.strokeStyle='#6b7280';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(tx,plot.y);ctx.lineTo(tx,plot.y+plot.h);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#374151';ctx.font='9px Arial, sans-serif';ctx.textAlign=tx>plot.x+plot.w*.78?'right':'left';ctx.fillText(`${fmt(settings.targetWavelength,0)} nm`,tx+(ctx.textAlign==='right'?-5:5),plot.y+12);
    const target=result.target,targetAbsY=yMap(target.absorption*100),targetRespY=rMap(target.responsivity);
    [[SPECTRUM_COLORS.absorption,targetAbsY],[SPECTRUM_COLORS.responsivity,targetRespY]].forEach(([color,y])=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(tx,y,4,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke()});
  }
  if(spectrumHoverIndex!==null&&points[spectrumHoverIndex]){
    const point=points[spectrumHoverIndex],hx=xMap(point.wavelength),ha=yMap(point.absorption*100),hr=rMap(point.responsivity);
    ctx.strokeStyle='#4b5563';ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(hx,plot.y);ctx.lineTo(hx,plot.y+plot.h);ctx.stroke();ctx.setLineDash([]);
    [[SPECTRUM_COLORS.absorption,ha],[SPECTRUM_COLORS.responsivity,hr]].forEach(([color,y])=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(hx,y,4,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke()});
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

function showPendingModelStatus() {
  const dispersion = !$('wavelengthDependent').checked ? 'CONSTANT n + ik' : $('conservativeInGaAs').checked ? 'ADACHI LOW-k' : 'O-BAND TABLE';
  $('modelStatus').textContent = `${dispersion}${$('idealAr').checked ? ' · IDEAL AR' : ''} · RUN TO APPLY`;
}

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

function download(name, content, type) { const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000); }
function exportCsv(){if(!result)return;const lines=['wavelength_nm,target_n,target_k,target_alpha_cm-1,target_absorption,responsivity_A_W,reflectance,transmittance,parasitic_absorption',...result.spectrum.map(p=>[p.wavelength,p.targetN,p.targetK,p.targetAlphaCm,p.absorption,p.responsivity,p.reflectance,p.transmittance,p.parasitic].join(','))];download('pd-tmm-spectrum.csv',lines.join('\n'),'text/csv;charset=utf-8')}
function exportJson(){download('pd-tmm-structure.json',JSON.stringify({version:1,stackOrder:'top-to-bottom',layers:[...layers].reverse().map(({name,material,thickness})=>({name,material,thickness}))},null,2),'application/json')}

function svgPolyline(points,xMap,yMap,valueOf){return points.map((point,index)=>`${index?'L':'M'} ${xMap(point.wavelength).toFixed(2)} ${yMap(valueOf(point)).toFixed(2)}`).join(' ')}

function exportSpectrumSvg(responsivityOnly=false){
  if(!result)return;
  const points=result.spectrum,xMin=points[0].wavelength,xMax=points.at(-1).wavelength,width=1200,height=760;
  const margin={left:responsivityOnly?112:112,right:responsivityOnly?60:112,top:126,bottom:94},plot={x:112,y:126,w:width-112-(responsivityOnly?60:112),h:height-126-94};
  const xMap=value=>plot.x+(value-xMin)/Math.max(1e-12,xMax-xMin)*plot.w;
  const absorptionMap=value=>plot.y+plot.h-clamp(value,0,100)/100*plot.h;
  const responsivityMap=value=>plot.y+plot.h-clamp(value,0,RESPONSIVITY_AXIS_MAX)/RESPONSIVITY_AXIS_MAX*plot.h;
  const targetInRange=settings.targetWavelength>=xMin&&settings.targetWavelength<=xMax;
  const xTicks=Array.from({length:6},(_,index)=>xMin+(xMax-xMin)*index/5);
  let svg=`<rect width="${width}" height="${height}" fill="#ffffff"/>`;
  svg+=`<text x="${plot.x}" y="48" fill="#111827" font-family="Arial,Helvetica,sans-serif" font-size="30" font-weight="700">${responsivityOnly?'Photodetector responsivity spectrum':'Target-layer absorption and responsivity'}</text>`;
  svg+=`<text x="${plot.x}" y="79" fill="#4b5563" font-family="Arial,Helvetica,sans-serif" font-size="16">${escapeHtml(simulatedLayers.find(layer=>layer.target)?.name||'Target layer')} · ${fmt(xMin,0)}–${fmt(xMax,0)} nm · fixed scientific axes</text>`;
  xTicks.forEach((value,index)=>{const x=xMap(value);if(index<5){const minor=xMap((value+xTicks[index+1])/2);svg+=`<line x1="${minor}" y1="${plot.y}" x2="${minor}" y2="${plot.y+plot.h}" stroke="#edf0f2" stroke-width="1"/>`}svg+=`<line x1="${x}" y1="${plot.y}" x2="${x}" y2="${plot.y+plot.h}" stroke="#d9dee3" stroke-width="1"/><line x1="${x}" y1="${plot.y+plot.h}" x2="${x}" y2="${plot.y+plot.h+8}" stroke="#111827" stroke-width="2"/><text x="${x}" y="${plot.y+plot.h+31}" text-anchor="middle" fill="#111827" font-family="Arial,Helvetica,sans-serif" font-size="16">${fmt(value,Math.abs(value-Math.round(value))>.001?1:0)}</text>`});
  if(responsivityOnly){
    for(let index=0;index<=6;index++){const value=index*.2,y=responsivityMap(value);svg+=`<line x1="${plot.x}" y1="${y}" x2="${plot.x+plot.w}" y2="${y}" stroke="#d9dee3" stroke-width="1"/><line x1="${plot.x-8}" y1="${y}" x2="${plot.x}" y2="${y}" stroke="#111827" stroke-width="2"/><text x="${plot.x-15}" y="${y+5}" text-anchor="end" fill="#111827" font-family="Arial,Helvetica,sans-serif" font-size="16">${value.toFixed(1)}</text>`}
  }else{
    for(let index=0;index<=5;index++){const value=index*20,y=absorptionMap(value);svg+=`<line x1="${plot.x}" y1="${y}" x2="${plot.x+plot.w}" y2="${y}" stroke="#d9dee3" stroke-width="1"/><line x1="${plot.x-8}" y1="${y}" x2="${plot.x}" y2="${y}" stroke="#111827" stroke-width="2"/><text x="${plot.x-15}" y="${y+5}" text-anchor="end" fill="#111827" font-family="Arial,Helvetica,sans-serif" font-size="16">${value}%</text>`}
    for(let index=0;index<=6;index++){const value=index*.2,y=responsivityMap(value);svg+=`<line x1="${plot.x+plot.w}" y1="${y}" x2="${plot.x+plot.w+8}" y2="${y}" stroke="#111827" stroke-width="2"/><text x="${plot.x+plot.w+15}" y="${y+5}" fill="#111827" font-family="Arial,Helvetica,sans-serif" font-size="16">${value.toFixed(1)}</text>`}
  }
  svg+=`<rect x="${plot.x}" y="${plot.y}" width="${plot.w}" height="${plot.h}" fill="none" stroke="#111827" stroke-width="2"/>`;
  svg+=`<text x="${plot.x+plot.w/2}" y="${height-28}" text-anchor="middle" fill="#111827" font-family="Arial,Helvetica,sans-serif" font-size="18">Wavelength (nm)</text>`;
  svg+=`<text x="34" y="${plot.y+plot.h/2}" transform="rotate(-90 34 ${plot.y+plot.h/2})" text-anchor="middle" fill="#111827" font-family="Arial,Helvetica,sans-serif" font-size="18">${responsivityOnly?'Responsivity (A/W)':'Absorption efficiency (%)'}</text>`;
  if(!responsivityOnly)svg+=`<text x="${width-24}" y="${plot.y+plot.h/2}" transform="rotate(90 ${width-24} ${plot.y+plot.h/2})" text-anchor="middle" fill="#111827" font-family="Arial,Helvetica,sans-serif" font-size="18">Responsivity (A/W)</text>`;
  if(!responsivityOnly)svg+=`<path d="${svgPolyline(points,xMap,absorptionMap,point=>point.absorption*100)}" fill="none" stroke="${SPECTRUM_COLORS.absorption}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`;
  svg+=`<path d="${svgPolyline(points,xMap,responsivityMap,point=>point.responsivity)}" fill="none" stroke="${SPECTRUM_COLORS.responsivity}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`;
  if(!responsivityOnly)svg+=`<line x1="${plot.x+18}" y1="103" x2="${plot.x+56}" y2="103" stroke="${SPECTRUM_COLORS.absorption}" stroke-width="4"/><text x="${plot.x+66}" y="109" fill="#111827" font-family="Arial,Helvetica,sans-serif" font-size="16">Absorption</text><line x1="${plot.x+190}" y1="103" x2="${plot.x+228}" y2="103" stroke="${SPECTRUM_COLORS.responsivity}" stroke-width="4"/><text x="${plot.x+238}" y="109" fill="#111827" font-family="Arial,Helvetica,sans-serif" font-size="16">Responsivity</text>`;
  if(targetInRange){const tx=xMap(settings.targetWavelength),target=result.target,annotation=responsivityOnly?`${fmt(settings.targetWavelength,0)} nm · ${fmt(target.responsivity,4)} A/W`:`${fmt(settings.targetWavelength,0)} nm · A ${fmt(target.absorption*100,2)}% · R ${fmt(target.responsivity,4)} A/W`;svg+=`<line x1="${tx}" y1="${plot.y}" x2="${tx}" y2="${plot.y+plot.h}" stroke="#6b7280" stroke-width="2" stroke-dasharray="8 7"/>`;if(!responsivityOnly)svg+=`<circle cx="${tx}" cy="${absorptionMap(target.absorption*100)}" r="6" fill="${SPECTRUM_COLORS.absorption}" stroke="#fff" stroke-width="2"/>`;svg+=`<circle cx="${tx}" cy="${responsivityMap(target.responsivity)}" r="6" fill="${SPECTRUM_COLORS.responsivity}" stroke="#fff" stroke-width="2"/><rect x="${clamp(tx-150,plot.x+8,plot.x+plot.w-308)}" y="${plot.y+15}" width="300" height="36" rx="3" fill="#fff" stroke="#6b7280"/><text x="${clamp(tx,plot.x+158,plot.x+plot.w-158)}" y="${plot.y+39}" text-anchor="middle" fill="#111827" font-family="Arial,Helvetica,sans-serif" font-size="15" font-weight="700">${annotation}</text>`}
  const name=responsivityOnly?'pd-tmm-responsivity.svg':'pd-tmm-spectrum-dual-axis.svg';
  download(name,`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${svg}</svg>`,'image/svg+xml');
}

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

function printLayerColor(layer){const palette={Au:'#ffd21a',Pt:'#b3b3b3',Ti:'#8f8f8f',InGaAs:'#d79a27',InP:'#4d72d8','InGaAsP Q1.03':'#27ada8','InGaAsP Q1.2':'#43d4ca','InGaAsP Q1.4':'#4bc7c2',Air:'#f3f4f6','SiO₂':'#cfe9ef',SiN:'#80b9c8',Custom:'#c4c7cb'};return palette[layer.material]||layer.color||'#c4c7cb'}

function exportStructureSvg(){
  const s=getSettings(),ordered=[...layers].reverse(),heights=ordered.map(layer=>clamp(Math.round(layerHeight(layer.thickness)*.92),46,84));
  const width=920,stackX=260,stackW=420,top=126,totalH=heights.reduce((sum,value)=>sum+value,0),height=top+totalH+175;
  let y=top,body=`<rect width="${width}" height="${height}" fill="#ffffff"/><text x="34" y="45" fill="#111111" font-family="Arial,Helvetica,sans-serif" font-size="30" font-weight="700">PD epitaxial / metal structure</text><text x="34" y="77" fill="#333333" font-family="Arial,Helvetica,sans-serif" font-size="16">${layers.length} layers · total ${fmt(layers.reduce((sum,layer)=>sum+layer.thickness,0),1)} nm · reference wavelength ${fmt(s.targetWavelength,0)} nm</text><text x="${stackX+stackW/2}" y="${top-16}" text-anchor="middle" fill="#333333" font-family="Arial,Helvetica,sans-serif" font-size="14">Exit medium · n = ${fmt(s.exitN,2)}</text>`;
  ordered.forEach((layer,index)=>{
    const h=heights[index],center=y+h/2,fontSize=layer.name.length>28?12:layer.name.length>21?13:15,opticalIndex=opticalIndexForLayer(layer,s,s.targetWavelength);
    body+=`<rect x="${stackX}" y="${y}" width="${stackW}" height="${h}" fill="${printLayerColor(layer)}" stroke="#111111" stroke-width="${layer.target?3:2}"/><text x="${stackX+stackW/2}" y="${center+5}" text-anchor="middle" fill="#111111" font-family="Arial,Helvetica,sans-serif" font-size="${fontSize}" font-weight="700">${escapeHtml(layer.name)}</text><text x="${stackX+stackW+22}" y="${center+5}" fill="#111111" font-family="Arial,Helvetica,sans-serif" font-size="16">${fmt(layer.thickness,layer.thickness%1?1:0)} nm</text>`;
    if(layer.id===scanXId||layer.id===scanYId){const label=layer.id===scanXId?'X':'Y',period=s.targetWavelength/(2*Math.max(.01,opticalIndex.re)),boxY=center-28;body+=`<path d="M ${stackX-14} ${y+5} H ${stackX-38} V ${y+h-5} H ${stackX-14}" fill="none" stroke="#111111" stroke-width="2"/><rect x="42" y="${boxY}" width="156" height="56" rx="5" fill="#ffffff" stroke="#111111" stroke-width="2"/><text x="120" y="${boxY+21}" text-anchor="middle" fill="#111111" font-family="Arial,Helvetica,sans-serif" font-size="15" font-weight="700">${label} period</text><text x="120" y="${boxY+43}" text-anchor="middle" fill="#111111" font-family="Arial,Helvetica,sans-serif" font-size="15">≈ ${fmt(period,1)} nm</text><line x1="198" y1="${center}" x2="${stackX-38}" y2="${center}" stroke="#111111" stroke-width="2"/>`}
    y+=h;
  });
  body+=`<text x="${stackX+stackW/2}" y="${y+26}" text-anchor="middle" fill="#333333" font-family="Arial,Helvetica,sans-serif" font-size="14">Incident medium · n = ${fmt(s.incidentN,2)}${s.idealAr?' · ideal backside AR':''}</text><path d="M ${stackX+stackW/2} ${y+103} V ${y+50} M ${stackX+stackW/2} ${y+50} l -9 14 M ${stackX+stackW/2} ${y+50} l 9 14" fill="none" stroke="#111111" stroke-width="4" stroke-linecap="round"/><text x="${stackX+stackW/2}" y="${y+132}" text-anchor="middle" fill="#111111" font-family="Arial,Helvetica,sans-serif" font-size="16">LIGHT FROM SUBSTRATE</text>`;
  download('pd-tmm-structure.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="geometricPrecision">${body}</svg>`,'image/svg+xml');
}

function resetAll(){layers=cloneLayers();settings=cloneSettings();scanXId='spacer-x';scanYId='spacer-y';scanResult=null;populateSettings(settings);renderLayerEditor();refreshScanOptions();$('emptyHeatmap').classList.remove('hidden');$('scanResult').innerHTML='<span>REFERENCE</span><b>等待扫描</b><small>默认复现 spacer X / Y 腔共振图</small>';runSimulation()}

document.querySelectorAll('.control-tab').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.control-tab').forEach(x=>x.classList.toggle('active',x===button));document.querySelectorAll('.control-view').forEach(view=>view.classList.toggle('active',view.id===`${button.dataset.control}Control`))}));
document.querySelectorAll('.analysis-tab').forEach(button=>button.addEventListener('click',()=>{activeView=button.dataset.view;spectrumHoverIndex=null;$('spectrumTooltip').classList.remove('visible');document.querySelectorAll('.analysis-tab').forEach(x=>x.classList.toggle('active',x===button));document.querySelectorAll('.analysis-view').forEach(view=>view.classList.toggle('active',view.id===`${activeView}View`));requestAnimationFrame(drawActive)}));
$('addLayer').addEventListener('click',()=>{const preset=MATERIALS.Custom;layers.push({id:`layer-${Date.now()}`,name:'Custom layer',material:'Custom',thickness:100,n:preset.n,k:preset.k,target:false,color:preset.color});renderLayerEditor();refreshScanOptions(false);renderSchematic()});
$('scanX').addEventListener('change',event=>{scanXId=event.target.value;renderSchematic()});$('scanY').addEventListener('change',event=>{scanYId=event.target.value;renderSchematic()});
$('spectrumChart').addEventListener('pointermove',event=>{
  if(!result||activeView!=='spectrum')return;
  const canvas=$('spectrumChart'),rect=canvas.getBoundingClientRect(),left=SPECTRUM_PAD.l,right=SPECTRUM_PAD.r,x=event.clientX-rect.left,y=event.clientY-rect.top;
  if(x<left||x>rect.width-right){spectrumHoverIndex=null;$('spectrumTooltip').classList.remove('visible');drawSpectrum();return}
  const ratio=clamp((x-left)/Math.max(1,rect.width-left-right),0,1),index=clamp(Math.round(ratio*(result.spectrum.length-1)),0,result.spectrum.length-1),point=result.spectrum[index];
  spectrumHoverIndex=index;const tooltip=$('spectrumTooltip');tooltip.innerHTML=`<b>${fmt(point.wavelength,1)} nm</b><span class="abs-value">吸收效率 <strong>${fmt(point.absorption*100,2)}%</strong></span><span class="resp-value">响应度 <strong>${fmt(point.responsivity,4)} A/W</strong></span><span>响应层 n / k <strong>${fmt(point.targetN,4)} / ${fmt(point.targetK,4)}</strong></span><span>响应层 α <strong>${fmt(point.targetAlphaCm,0)} cm⁻¹</strong></span><span>${settings.idealAr?'内部返回反射':'总反射率'} <strong>${fmt(point.reflectance*100,2)}%</strong></span><span>透射率 <strong>${fmt(point.transmittance*100,2)}%</strong></span>`;tooltip.classList.add('visible');
  const tw=tooltip.offsetWidth||178,th=tooltip.offsetHeight||110;tooltip.style.left=`${clamp(x+14,8,rect.width-tw-8)}px`;tooltip.style.top=`${clamp(y-th/2,8,rect.height-th-8)}px`;drawSpectrum();
});
$('spectrumChart').addEventListener('pointerleave',()=>{spectrumHoverIndex=null;$('spectrumTooltip').classList.remove('visible');drawSpectrum()});
$('importJson').addEventListener('click',()=>$('importJsonFile').click());
$('importJsonFile').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;const button=$('importJson');try{button.disabled=true;button.textContent='导入中…';await importJsonFile(file);button.textContent='导入成功';setTimeout(()=>button.textContent='导入 JSON',1200)}catch(error){button.textContent='导入失败';window.alert(`无法导入结构：${error.message}`);setTimeout(()=>button.textContent='导入 JSON',1600)}finally{button.disabled=false;event.target.value=''}});
$('run').addEventListener('click',runSimulation);$('reset').addEventListener('click',resetAll);$('runScan').addEventListener('click',runThicknessScan);$('downloadCsv').addEventListener('click',exportCsv);$('downloadSpectrumSvg').addEventListener('click',()=>exportSpectrumSvg(false));$('downloadResponsivitySvg').addEventListener('click',()=>exportSpectrumSvg(true));$('exportJson').addEventListener('click',exportJson);$('downloadStructure').addEventListener('click',exportStructureSvg);
['targetWl','incidentN','exitN'].forEach(id=>$(id).addEventListener('input',renderSchematic));
$('wavelengthDependent').addEventListener('change',()=>{renderSchematic();showPendingModelStatus()});
$('conservativeInGaAs').addEventListener('change',()=>{renderSchematic();showPendingModelStatus()});
$('idealAr').addEventListener('change',showPendingModelStatus);
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(drawActive,120)});

populateSettings(settings);renderLayerEditor();refreshScanOptions(false);renderSchematic();runSimulation();
