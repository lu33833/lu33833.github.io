(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.InGaAsPModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const HC_EV_UM = 1.2398;

  function compositionAt(y) {
    const x = (0.1896 * y) / (0.4176 - 0.0125 * y);
    const bandgap = 1.35 + x * (0.642 + 0.758 * x)
      + (0.101 * y - 1.101) * y
      - (0.28 * x - 0.109 * y + 0.159) * x * y;
    return { x, y, bandgap };
  }

  const upperBandgap = compositionAt(0).bandgap;
  const lowerBandgap = compositionAt(1).bandgap;
  const limits = Object.freeze({
    minQ: HC_EV_UM / upperBandgap,
    maxQ: HC_EV_UM / lowerBandgap,
    minBandgap: lowerBandgap,
    maxBandgap: upperBandgap
  });

  function calculate(qWavelength, baseAffinity = 4.4) {
    const q = Number(qWavelength);
    const chiInP = Number(baseAffinity);
    if (!Number.isFinite(q) || q <= 0) throw new RangeError('请输入有效的 Q 波长。');
    if (!Number.isFinite(chiInP) || chiInP <= 0) throw new RangeError('请输入有效的 InP 基准电子亲和势。');

    const targetBandgap = HC_EV_UM / q;
    if (targetBandgap < lowerBandgap || targetBandgap > upperBandgap) {
      throw new RangeError(`此模型支持 Q${limits.minQ.toFixed(3)}–Q${limits.maxQ.toFixed(3)} µm。`);
    }

    let low = 0;
    let high = 1;
    let alloy = compositionAt(0.5);
    for (let iteration = 0; iteration < 100; iteration += 1) {
      const y = (low + high) / 2;
      alloy = compositionAt(y);
      if (Math.abs(alloy.bandgap - targetBandgap) < 1e-10) break;
      if (alloy.bandgap > targetBandgap) low = y;
      else high = y;
    }

    const dEc = 0.268 * alloy.y + 0.003 * alloy.y ** 2;
    return Object.freeze({
      qWavelength: q,
      targetBandgap,
      xGa: alloy.x,
      yAs: alloy.y,
      calculatedBandgap: alloy.bandgap,
      dEc,
      baseAffinity: chiInP,
      affinity: chiInP + dEc
    });
  }

  return Object.freeze({ calculate, compositionAt, limits, HC_EV_UM });
});
