(() => {
  'use strict';
  const model = window.InGaAsPModel;
  const $ = id => document.getElementById(id);
  const q = $('q');
  const qNumber = $('qNumber');
  const affinityBase = $('affinityBase');
  const message = $('message');
  const resultPanel = $('resultPanel');

  function format(value, digits = 4) {
    return Number(value).toFixed(digits);
  }

  function setComposition(x, y) {
    $('xGa').textContent = format(x);
    $('yAs').textContent = format(y);
    $('formula').innerHTML = `In<sub>${format(1 - x, 3)}</sub>Ga<sub>${format(x, 3)}</sub>As<sub>${format(y, 3)}</sub>P<sub>${format(1 - y, 3)}</sub>`;
    $('gaBar').style.width = `${x * 100}%`;
    $('asBar').style.width = `${y * 100}%`;
  }

  function update(source) {
    if (source === q) qNumber.value = q.value;
    if (source === qNumber) q.value = qNumber.value;
    try {
      const out = model.calculate(qNumber.value, affinityBase.value);
      $('bandgap').textContent = format(out.targetBandgap);
      $('affinity').textContent = format(out.affinity);
      $('bandgapCheck').textContent = `${format(out.calculatedBandgap, 6)} eV`;
      $('offset').textContent = `${format(out.dEc)} eV`;
      $('baseReadout').textContent = `${format(out.baseAffinity)} eV`;
      $('qReadout').textContent = `Q${format(out.qWavelength, 3)}`;
      setComposition(out.xGa, out.yAs);
      message.textContent = '模型已收敛 · lattice-matched to InP';
      message.classList.remove('error');
      resultPanel.classList.remove('invalid');
    } catch (error) {
      message.textContent = error.message;
      message.classList.add('error');
      resultPanel.classList.add('invalid');
    }
  }

  document.querySelectorAll('[data-q]').forEach(button => {
    button.addEventListener('click', () => {
      q.value = button.dataset.q;
      qNumber.value = button.dataset.q;
      update(q);
    });
  });
  q.addEventListener('input', () => update(q));
  qNumber.addEventListener('input', () => update(qNumber));
  affinityBase.addEventListener('input', () => update(affinityBase));
  $('reset').addEventListener('click', () => {
    q.value = '1.25';
    qNumber.value = '1.25';
    affinityBase.value = '4.4';
    update(q);
  });
  update(q);
})();
