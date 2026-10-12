import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DEFAULT_LAYERS, DEFAULT_SETTINGS, simulate, scan2D } from '../src/tmm-core.js';

// 数值基线来自原工作台提交 6b843782146e81af73adeab6ba6bee16c6e7719e
// 这里只允许 1e-10 内的浮点误差，覆盖默认模型和主要计算分支
const near = (actual, expected, label) =>
  assert.ok(
    Number.isFinite(actual) && Math.abs(actual - expected) < 1e-10,
    `${label}: expected ${expected}, received ${actual}`,
  );
let passed = 0;
function test(name, check) {
  check();
  passed += 1;
  console.log(`PASS ${name}`);
}
const originalInputs = JSON.stringify([DEFAULT_LAYERS, DEFAULT_SETTINGS]);
const baseline = simulate(DEFAULT_LAYERS, DEFAULT_SETTINGS);

// 核心文件允许补充独立行注释，公式、常量和其他代码仍按原版指纹核对
test('numerical core statements match the original source', () => {
  const source = readFileSync(new URL('../src/tmm-core.js', import.meta.url), 'utf8');
  const statements = source
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trimStart().startsWith('//'))
    .join('\n');
  assert.equal(
    createHash('sha256').update(statements).digest('hex'),
    'fd7551a3b57eb9f6986cbd3cf9c6d1f4a9da494d7bece6a295a157f0a5b0c617',
  );
});

// 除了目标响应，还检查整条光谱的能量分配和端点
test('default spectrum and target response match original results', () => {
  assert.equal(baseline.spectrum.length, 101);
  assert.equal(baseline.spectrum[0].wavelength, 1260);
  assert.equal(baseline.spectrum.at(-1).wavelength, 1360);
  assert.equal(baseline.totalThickness, 2080);
  assert.equal(baseline.peak.wavelength, 1314);
  near(baseline.target.absorption, 0.7681941641554233, 'absorption');
  near(baseline.target.responsivity, 0.8115599637448424, 'responsivity');
  near(baseline.target.reflectance, 0.03464839848617922, 'reflectance');
  near(baseline.target.transmittance, 0.00006572918003628892, 'transmittance');
  for (const point of baseline.spectrum) {
    assert.ok(Object.values(point).every(Number.isFinite));
    near(
      point.absorption + point.reflectance + point.transmittance + point.parasitic,
      1,
      'energy budget',
    );
  }
});

// 切换入射、色散和减反选项时，响应度与峰值位置都应对应原结果
test('normal incidence, dispersion and conservative modes match original', () => {
  const cases = [
    [{ gaussian: false }, 0.8115561110912772, 1315],
    [{ wavelengthDependent: true }, 0.8133976694580596, 1310],
    [{ wavelengthDependent: true, conservativeInGaAs: true }, 0.7128628990675187, 1281],
    [{ idealAr: true }, 0.8115599637448424, 1314],
  ];
  for (const [patch, expected, peak] of cases) {
    const result = simulate(DEFAULT_LAYERS, { ...DEFAULT_SETTINGS, ...patch });
    near(result.target.responsivity, expected, JSON.stringify(patch));
    assert.equal(result.peak.wavelength, peak);
  }
});

// 收集效率只影响电流响应，不改变光学吸收
test('collection efficiency scales response without changing absorption', () => {
  const half = simulate(DEFAULT_LAYERS, { ...DEFAULT_SETTINGS, collectionEfficiency: 0.5 });
  for (let index = 0; index < baseline.spectrum.length; index += 1) {
    near(
      half.spectrum[index].responsivity,
      baseline.spectrum[index].responsivity / 2,
      'half response',
    );
    near(half.spectrum[index].absorption, baseline.spectrum[index].absorption, 'same absorption');
  }
});

// 场强深度从入射侧递增，覆盖总厚度，归一化后最大值为 1
test('field profile covers the structure and is normalized', () => {
  assert.equal(baseline.field[0].depth, 0);
  assert.equal(baseline.field.at(-1).depth, baseline.totalThickness);
  assert.equal(Math.max(...baseline.field.map((point) => point.intensity)), 1);
  assert.ok(
    baseline.field.every(
      (point) => Number.isFinite(point.intensity) && point.intensity >= 0 && point.intensity <= 1,
    ),
  );
  for (let i = 1; i < baseline.field.length; i += 1)
    assert.ok(baseline.field[i].depth >= baseline.field[i - 1].depth);
});

// 固定网格角点与最优点，防止 X/Y 方向或矩阵顺序被误改
test('two-layer scan preserves values, orientation and sampled optimum', () => {
  const scan = scan2D(
    DEFAULT_LAYERS,
    DEFAULT_SETTINGS,
    'spacer-x',
    'spacer-y',
    [20, 260],
    [20, 260],
    8,
  );
  assert.equal(scan.values.length, 8);
  assert.ok(scan.values.every((row) => row.length === 8));
  near(scan.values[0][0], 0.6394594640990476, 'first cell');
  near(scan.values[7][7], 0.7302434273845086, 'last cell');
  near(scan.optimum.x, 260, 'optimum x');
  near(scan.optimum.y, 88.57142857142857, 'optimum y');
  near(scan.optimum.responsivity, 0.8081232590143671, 'optimum response');
  near(scan.min, 0.6165250972786143, 'scan minimum');
  near(scan.max, Math.max(...scan.values.flat()), 'scan maximum');
});

// 扫描候选结构不能写回默认模型，否则下一次计算会受到上一次影响
test('simulation and scanning do not mutate the input model', () => {
  assert.equal(JSON.stringify([DEFAULT_LAYERS, DEFAULT_SETTINGS]), originalInputs);
});

console.log(`\n${passed} checks passed.`);
