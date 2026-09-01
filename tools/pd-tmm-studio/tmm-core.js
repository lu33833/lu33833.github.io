// ../pd-tmm-studio/lib/tmm.ts
var MATERIALS = {
  InP: { n: 3.22, k: 0, color: "#50837a" },
  InGaAs: { n: 3.65, k: 0.12, color: "#df744c" },
  "InGaAsP Q1.03": { n: 3.3006, k: 0, color: "#b99b51" },
  "InGaAsP Q1.2": { n: 3.4194, k: 1224e-6, color: "#c9aa5e" },
  "InGaAsP Q1.4": { n: 3.5392, k: 0.099118, color: "#d1b46d" },
  Ti: { n: 3.72, k: 3.58, color: "#777b80" },
  Au: { n: 0.419, k: 8.42, color: "#d5aa39" },
  Air: { n: 1, k: 0, color: "#dbe8e5" },
  "SiO\u2082": { n: 1.45, k: 0, color: "#a9d5ce" },
  SiN: { n: 2.02, k: 0, color: "#679eaf" },
  Custom: { n: 2, k: 0, color: "#8a8f98" }
};
var DEFAULT_SETTINGS = {
  incidentN: 3.22,
  incidentK: 0,
  exitN: 1,
  exitK: 0,
  wavelengthStart: 1260,
  wavelengthEnd: 1360,
  points: 101,
  targetWavelength: 1310,
  waistUm: 3,
  angularSamples: 18,
  gaussian: true,
  wavelengthDependent: false,
  collectionEfficiency: 1
};
var DEFAULT_LAYERS = [
  { id: "uid", name: "InP UID", material: "InP", thickness: 100, n: 3.22, k: 0, target: false, color: "#50837a" },
  { id: "p-bottom", name: "InP p+ bottom", material: "InP", thickness: 500, n: 3.22, k: 0, target: false, color: "#5d9287" },
  { id: "p-contact", name: "InGaAs p+ contact", material: "InGaAs", thickness: 100, n: 3.65, k: 0.12, target: false, color: "#c76948" },
  { id: "spacer-x", name: "InP p+ spacer X", material: "InP", thickness: 64.5, n: 3.22, k: 0, target: false, color: "#79aa9d" },
  { id: "q103-a", name: "Q1.03 lower", material: "InGaAsP Q1.03", thickness: 10, n: 3.3006, k: 0, target: false, color: "#b99b51" },
  { id: "q14-a", name: "Q1.4 lower", material: "InGaAsP Q1.4", thickness: 10, n: 3.5392, k: 0.099118, target: false, color: "#d1b46d" },
  { id: "absorber", name: "InGaAs absorber", material: "InGaAs", thickness: 750, n: 3.65, k: 0.12, target: true, color: "#e67c52" },
  { id: "q14-b", name: "Q1.4 upper", material: "InGaAsP Q1.4", thickness: 10, n: 3.5392, k: 0.099118, target: false, color: "#d1b46d" },
  { id: "q12", name: "Q1.2 upper", material: "InGaAsP Q1.2", thickness: 10, n: 3.4194, k: 1224e-6, target: false, color: "#c9aa5e" },
  { id: "q103-b", name: "Q1.03 upper", material: "InGaAsP Q1.03", thickness: 10, n: 3.3006, k: 0, target: false, color: "#b99b51" },
  { id: "n-plus", name: "InP n+", material: "InP", thickness: 20, n: 3.22, k: 0, target: false, color: "#47786f" },
  { id: "n-minus", name: "InP n\u2212", material: "InP", thickness: 300, n: 3.22, k: 0, target: false, color: "#568a80" },
  { id: "spacer-y", name: "InP n+ spacer Y", material: "InP", thickness: 90.5, n: 3.22, k: 0, target: false, color: "#6ba093" },
  { id: "ti", name: "Ti adhesion", material: "Ti", thickness: 5, n: 3.72, k: 3.58, target: false, color: "#777b80" },
  { id: "au", name: "Au mirror", material: "Au", thickness: 100, n: 0.419, k: 8.42, target: false, color: "#d5aa39" }
];
var C = (re, im = 0) => ({ re, im });
var add = (a, b) => C(a.re + b.re, a.im + b.im);
var sub = (a, b) => C(a.re - b.re, a.im - b.im);
var mul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
var scale = (a, x) => C(a.re * x, a.im * x);
var div = (a, b) => {
  const d = b.re * b.re + b.im * b.im;
  return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
};
var neg = (a) => C(-a.re, -a.im);
var abs2 = (a) => a.re * a.re + a.im * a.im;
var exp = (z) => {
  const e = Math.exp(z.re);
  return C(e * Math.cos(z.im), e * Math.sin(z.im));
};
var sin = (z) => C(Math.sin(z.re) * Math.cosh(z.im), Math.cos(z.re) * Math.sinh(z.im));
var cos = (z) => C(Math.cos(z.re) * Math.cosh(z.im), -Math.sin(z.re) * Math.sinh(z.im));
var log = (z) => C(Math.log(Math.hypot(z.re, z.im)), Math.atan2(z.im, z.re));
var sqrt = (z) => {
  const radius = Math.hypot(z.re, z.im);
  const re = Math.sqrt(Math.max(0, (radius + z.re) / 2));
  const im = (z.im < 0 ? -1 : 1) * Math.sqrt(Math.max(0, (radius - z.re) / 2));
  return C(re, im);
};
var cexpI = (z, sign = 1) => exp(C(-sign * z.im, sign * z.re));
var clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));

// Adachi, J. Appl. Phys. 66, 6030 (1989), In(1-x)Ga(x)As with x = 0.48.
// The full complex dielectric function is evaluated at every wavelength.
function inGaAsAdachiIndex(wavelengthNm) {
  const energy = 1239.841984 / wavelengthNm;
  const E0 = 0.75, delta0 = 0.29, E1 = 2.57, delta1 = 0.26, E2 = 4.41, Eg = 1.20;
  const A = 1.20, B1 = 3.84, B2 = 1.48, B11 = 7.57, B21 = 2.96;
  const gamma1 = 0.14, oscillatorC = 2.90, gamma2 = 0.225, D = 20.7, epsilonInf = 2.8;
  const H = (x) => x > 0 ? 1 : x < 0 ? 0 : 0.5;
  const x0 = energy / E0, xSo = energy / (E0 + delta0);
  const f0 = x0 ** -2 * (2 - Math.sqrt(1 + x0) - Math.sqrt(Math.max(0, (1 - x0) * H(1 - x0))));
  const fSo = xSo ** -2 * (2 - Math.sqrt(1 + xSo) - Math.sqrt(Math.max(0, (1 - xSo) * H(1 - xSo))));
  const epsilonA1 = A * E0 ** -1.5 * (f0 + 0.5 * (E0 / (E0 + delta0)) ** 1.5 * fSo);
  const epsilonA2 = A / energy ** 2 * (
    Math.sqrt(Math.max(0, (energy - E0) * H(x0 - 1))) +
    0.5 * Math.sqrt(Math.max(0, (energy - E0 - delta0) * H(xSo - 1)))
  );
  const x1 = energy / E1, x1So = energy / (E1 + delta1);
  let epsilonB2 = Math.PI * x1 ** -2 * (B1 - B11 * Math.sqrt(Math.max(0, (E1 - energy) * H(1 - x1)))) +
    Math.PI * x1So ** -2 * (B2 - B21 * Math.sqrt(Math.max(0, (E1 + delta1 - energy) * H(1 - x1So))));
  epsilonB2 *= H(epsilonB2);
  const z1 = C(energy / E1, gamma1 / E1);
  const z1So = C(energy / (E1 + delta1), gamma1 / (E1 + delta1));
  const epsilonB = add(
    mul(scale(div(C(1), mul(z1, z1)), -B1), log(sub(C(1), mul(z1, z1)))),
    mul(scale(div(C(1), mul(z1So, z1So)), -B2), log(sub(C(1), mul(z1So, z1So))))
  );
  const x2 = energy / E2;
  const oscillatorDenominator = (1 - x2 ** 2) ** 2 + (x2 * gamma2) ** 2;
  const epsilonC1 = oscillatorC * (1 - x2 ** 2) / oscillatorDenominator;
  const epsilonC2 = oscillatorC * x2 * gamma2 / oscillatorDenominator;
  const epsilonD2 = D / energy ** 2 * (energy - Eg) ** 2 * H(1 - Eg / energy) * H(1 - energy / E1);
  return sqrt(C(
    epsilonInf + epsilonA1 + epsilonB.re + epsilonC1,
    epsilonA2 + epsilonB2 + epsilonC2 + epsilonD2
  ));
}

// Pettit & Turner, J. Appl. Phys. 36, 2081 (1965); wavelength is in micrometres.
function inPIndex(wavelengthNm) {
  const wavelengthUm = wavelengthNm / 1e3;
  const wavelength2 = wavelengthUm * wavelengthUm;
  const n2 = 1 + 6.255 + 2.316 * wavelength2 / (wavelength2 - 0.6263 ** 2) +
    2.765 * wavelength2 / (wavelength2 - 32.935 ** 2);
  return C(Math.sqrt(Math.max(0, n2)), 0);
}

function opticalIndexForLayer(layer, settings, wavelength) {
  if (!settings.wavelengthDependent) return C(layer.n, layer.k);
  if (layer.material === "InP") return inPIndex(wavelength);
  if (layer.material === "InGaAs" && layer.target) return inGaAsAdachiIndex(wavelength);
  return C(layer.n, layer.k);
}

function incidentOpticalIndex(settings, wavelength) {
  const usesDefaultInPBoundary = settings.wavelengthDependent &&
    Math.abs(settings.incidentN - MATERIALS.InP.n) < 1e-9 && Math.abs(settings.incidentK) < 1e-12;
  return usesDefaultInPBoundary ? inPIndex(wavelength) : C(settings.incidentN, settings.incidentK);
}

function solveAngle(layers, settings, wavelength, thetaDeg, pol, keepAmplitudes = false) {
  const n0 = incidentOpticalIndex(settings, wavelength);
  const ns = C(settings.exitN, settings.exitK);
  const theta0 = thetaDeg * Math.PI / 180;
  const sin0 = Math.sin(theta0);
  const cos0 = Math.cos(theta0);
  const eta0Complex = pol === 0 ? scale(n0, cos0) : div(n0, C(cos0));
  const eta0Flux = eta0Complex.re;
  const eta0 = C(eta0Flux);
  const k0 = 2 * Math.PI / wavelength;
  let m11 = C(1), m12 = C(0), m21 = C(0), m22 = C(1);
  const cosines = [];
  const etas = [];
  const deltas = [];
  for (const layer of layers) {
    const nj = opticalIndexForLayer(layer, settings, wavelength);
    const sinJ = div(scale(n0, sin0), nj);
    let cosJ = sqrt(sub(C(1), mul(sinJ, sinJ)));
    if (cosJ.re < 0) cosJ = neg(cosJ);
    const etaJ2 = pol === 0 ? mul(nj, cosJ) : div(nj, cosJ);
    const delta2 = scale(mul(nj, cosJ), k0 * layer.thickness);
    const cosD = cos(delta2);
    const sinD = sin(delta2);
    const a11 = cosD;
    const a12 = mul(C(0, -1), div(sinD, etaJ2));
    const a21 = mul(C(0, -1), mul(etaJ2, sinD));
    const a22 = cosD;
    const nm11 = add(mul(m11, a11), mul(m12, a21));
    const nm12 = add(mul(m11, a12), mul(m12, a22));
    const nm21 = add(mul(m21, a11), mul(m22, a21));
    const nm22 = add(mul(m21, a12), mul(m22, a22));
    [m11, m12, m21, m22] = [nm11, nm12, nm21, nm22];
    cosines.push(cosJ);
    etas.push(etaJ2);
    deltas.push(delta2);
  }
  const sinS = div(scale(n0, sin0), ns);
  let cosS = sqrt(sub(C(1), mul(sinS, sinS)));
  if (cosS.re < 0) cosS = neg(cosS);
  const etaS = pol === 0 ? mul(ns, cosS) : div(ns, cosS);
  const denom = add(add(mul(eta0, m11), mul(mul(eta0, etaS), m12)), add(m21, mul(etaS, m22)));
  const r = div(sub(add(mul(eta0, m11), mul(mul(eta0, etaS), m12)), add(m21, mul(etaS, m22))), denom);
  const t = div(scale(eta0, 2), denom);
  const forward = Array.from({ length: layers.length }, () => C(0));
  const backward = Array.from({ length: layers.length }, () => C(0));
  const eta1 = etas[0];
  forward[0] = scale(add(add(C(1), r), mul(div(eta0, eta1), sub(C(1), r))), 0.5);
  backward[0] = scale(sub(add(C(1), r), mul(div(eta0, eta1), sub(C(1), r))), 0.5);
  for (let j = 0; j < layers.length - 1; j += 1) {
    const ratio = div(etas[j], etas[j + 1]);
    const expPlus = cexpI(deltas[j], 1);
    const expMinus = cexpI(deltas[j], -1);
    forward[j + 1] = scale(add(mul(mul(add(C(1), ratio), forward[j]), expPlus), mul(mul(sub(C(1), ratio), backward[j]), expMinus)), 0.5);
    backward[j + 1] = scale(add(mul(mul(sub(C(1), ratio), forward[j]), expPlus), mul(mul(add(C(1), ratio), backward[j]), expMinus)), 0.5);
  }
  const targetIndex = Math.max(0, layers.findIndex((layer) => layer.target));
  const a = forward[targetIndex];
  const b = backward[targetIndex];
  const etaJ = etas[targetIndex];
  const delta = deltas[targetIndex];
  const e0 = add(a, b);
  const h0 = mul(etaJ, sub(a, b));
  const sIn = 0.5 * (e0.re * h0.re + e0.im * h0.im);
  const ad = mul(a, cexpI(delta, 1));
  const bd = mul(b, cexpI(delta, -1));
  const ed = add(ad, bd);
  const hd = mul(etaJ, sub(ad, bd));
  const sOut = 0.5 * (ed.re * hd.re + ed.im * hd.im);
  const targetAbsorption = 2 * (sIn - sOut) / eta0Flux;
  const reflectance = abs2(r);
  const transmittance = Math.max(0, etaS.re / eta0Flux * abs2(t));
  return {
    targetAbsorption,
    reflectance,
    transmittance,
    amplitudes: keepAmplitudes ? { forward, backward, cosines } : void 0
  };
}
function responseAtWavelength(layers, settings, wavelength) {
  if (!settings.gaussian) {
    const te = solveAngle(layers, settings, wavelength, 0, 0);
    const tm = solveAngle(layers, settings, wavelength, 0, 1);
    return {
      absorption: 0.5 * (te.targetAbsorption + tm.targetAbsorption),
      reflectance: 0.5 * (te.reflectance + tm.reflectance),
      transmittance: 0.5 * (te.transmittance + tm.transmittance)
    };
  }
  const thetaWidth = wavelength / (Math.PI * incidentOpticalIndex(settings, wavelength).re * settings.waistUm * 1e3);
  const thetaMax = 4 * thetaWidth;
  const samples = Math.max(6, Math.round(settings.angularSamples));
  let absorption = 0, reflectance = 0, transmittance = 0, denominator = 0;
  for (let i = 0; i < samples; i += 1) {
    const theta = thetaMax * i / (samples - 1);
    let weight = Math.exp(-2 * (theta / thetaWidth) ** 2) * Math.sin(theta);
    if (i === 0 || i === samples - 1) weight *= 0.5;
    const degrees = theta * 180 / Math.PI;
    const te = solveAngle(layers, settings, wavelength, degrees, 0);
    const tm = solveAngle(layers, settings, wavelength, degrees, 1);
    absorption += weight * 0.5 * (te.targetAbsorption + tm.targetAbsorption);
    reflectance += weight * 0.5 * (te.reflectance + tm.reflectance);
    transmittance += weight * 0.5 * (te.transmittance + tm.transmittance);
    denominator += weight;
  }
  return { absorption: absorption / denominator, reflectance: reflectance / denominator, transmittance: transmittance / denominator };
}
function spectralPoint(layers, settings, wavelength) {
  const response = responseAtWavelength(layers, settings, wavelength);
  const targetLayer = layers.find((layer) => layer.target) || layers[0];
  const targetIndex = opticalIndexForLayer(targetLayer, settings, wavelength);
  const absorption = clamp(response.absorption);
  const reflectance = clamp(response.reflectance);
  const transmittance = clamp(response.transmittance);
  const responsivity = wavelength / 1e3 * absorption * settings.collectionEfficiency / 1.24;
  return {
    wavelength,
    absorption,
    responsivity,
    targetN: targetIndex.re,
    targetK: targetIndex.im,
    targetAlphaCm: 4 * Math.PI * targetIndex.im / (wavelength / 1e7),
    reflectance,
    transmittance,
    parasitic: clamp(1 - reflectance - transmittance - absorption)
  };
}
function simulate(layers, settings) {
  const points = Math.max(2, Math.min(301, Math.round(settings.points)));
  const spectrum = Array.from({ length: points }, (_, index) => {
    const wavelength = settings.wavelengthStart + (settings.wavelengthEnd - settings.wavelengthStart) * index / (points - 1);
    return spectralPoint(layers, settings, wavelength);
  });
  const target = spectralPoint(layers, settings, settings.targetWavelength);
  const peak = spectrum.reduce((best, point) => point.responsivity > best.responsivity ? point : best, spectrum[0]);
  const totalThickness = layers.reduce((sum, layer) => sum + layer.thickness, 0);
  const field = fieldProfile(layers, settings, settings.targetWavelength);
  return { spectrum, target, peak, field, totalThickness };
}
function fieldProfile(layers, settings, wavelength) {
  const solution = solveAngle(layers, settings, wavelength, 0, 0, true);
  const amplitudes = solution.amplitudes;
  const points = [];
  let offset = 0;
  layers.forEach((layer, index) => {
    const samples = Math.max(4, Math.min(24, Math.round(layer.thickness / 25)));
    const nj = opticalIndexForLayer(layer, settings, wavelength);
    const propagation = scale(mul(nj, amplitudes.cosines[index]), 2 * Math.PI / wavelength);
    for (let sample = 0; sample <= samples; sample += 1) {
      const z = layer.thickness * sample / samples;
      const phase = scale(propagation, z);
      const e = add(mul(amplitudes.forward[index], cexpI(phase, 1)), mul(amplitudes.backward[index], cexpI(phase, -1)));
      points.push({ depth: offset + z, intensity: abs2(e), layer: layer.name, color: layer.color });
    }
    offset += layer.thickness;
  });
  const max = Math.max(...points.map((point) => point.intensity), 1e-12);
  return points.map((point) => ({ ...point, intensity: point.intensity / max }));
}
function scan2D(layers, settings, xId, yId, xRange, yRange, resolution) {
  const count = Math.max(8, Math.min(41, Math.round(resolution)));
  const xValues = Array.from({ length: count }, (_, i) => xRange[0] + (xRange[1] - xRange[0]) * i / (count - 1));
  const yValues = Array.from({ length: count }, (_, i) => yRange[0] + (yRange[1] - yRange[0]) * i / (count - 1));
  const fastSettings = { ...settings, angularSamples: Math.min(settings.angularSamples, 10) };
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let optimum = { x: xValues[0], y: yValues[0], responsivity: -Infinity };
  const values = yValues.map((y) => xValues.map((x) => {
    const candidate = layers.map((layer) => layer.id === xId ? { ...layer, thickness: x } : layer.id === yId ? { ...layer, thickness: y } : layer);
    const result = responseAtWavelength(candidate, fastSettings, settings.targetWavelength);
    const responsivity = settings.targetWavelength / 1e3 * clamp(result.absorption) * settings.collectionEfficiency / 1.24;
    min = Math.min(min, responsivity);
    max = Math.max(max, responsivity);
    if (responsivity > optimum.responsivity) optimum = { x, y, responsivity };
    return responsivity;
  }));
  return { xValues, yValues, values, min, max, optimum };
}
export {
  DEFAULT_LAYERS,
  DEFAULT_SETTINGS,
  MATERIALS,
  fieldProfile,
  incidentOpticalIndex,
  opticalIndexForLayer,
  responseAtWavelength,
  scan2D,
  simulate
};
