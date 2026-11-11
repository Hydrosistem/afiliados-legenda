const { test } = require('node:test');
const assert = require('node:assert/strict');
const c = require('../web/caption.js');

test('encurtarTitulo mantém título curto', () => {
  assert.equal(c.encurtarTitulo('Fone X'), 'Fone X');
  assert.equal(c.encurtarTitulo(''), '');
});

test('encurtarTitulo corta no limite de palavra', () => {
  const t = Array(12).fill('palavra').join(' ');
  const r = c.encurtarTitulo(t, 70);
  assert.ok(r.length <= 71, `len ${r.length}`);
  assert.ok(r.endsWith('…'));
  assert.ok(r.slice(0, -1).split(' ').every((p) => p === 'palavra'));
});

test('encurtarTitulo corta sem espaços no limite informado', () => {
  assert.equal(c.encurtarTitulo('a'.repeat(100), 70), 'a'.repeat(70) + '…');
});

test('parseValor entende formatos brasileiros e simples', () => {
  assert.equal(c.parseValor('149,90'), 149.9);
  assert.equal(c.parseValor('1.299,90'), 1299.9);
  assert.equal(c.parseValor('R$ 1.299,90'), 1299.9);
  assert.equal(c.parseValor('1299.9'), 1299.9);
  assert.equal(c.parseValor(''), null);
  assert.equal(c.parseValor('abc'), null);
  assert.equal(c.parseValor(null), null);
});

test('parseValor trata ponto de milhar sem vírgula', () => {
  assert.equal(c.parseValor('1.299'), 1299);
  assert.equal(c.parseValor('12.345.678'), 12345678);
  assert.equal(c.parseValor('1299.9'), 1299.9);
  assert.equal(c.parseValor('149.90'), 149.9);
});

test('precoCurto formata sem espaço e sem ,00', () => {
  assert.equal(c.precoCurto(183.2), 'R$183,20');
  assert.equal(c.precoCurto(300), 'R$300');
  assert.equal(c.precoCurto(1299.9), 'R$1.299,90');
  assert.equal(c.precoCurto(1234567), 'R$1.234.567');
  assert.equal(c.precoCurto(0.5), 'R$0,50');
});

const d = {
  titulo: 'Fone Bluetooth X',
  emoji: '🎧',
  preco: 149.9,
  precoAntigo: 199.9,
  frase: 'Som potente pra animar seu dia!!',
  link: 'https://meli.la/abc',
};

test('legenda completa no formato do canal é exata', () => {
  assert.equal(
    c.montarLegenda(d),
    '*FONE BLUETOOTH X* 🎧\n\nde ~R$199,90~ por 💥 *R$149,90*💥\n\n💗 _Som potente pra animar seu dia!!_\n\n🏠 https://meli.la/abc',
  );
});

test('preço antigo inteiro sai sem centavos (como no canal)', () => {
  const r = c.montarLegenda({ ...d, precoAntigo: 300, preco: 183.2 });
  assert.ok(r.includes('de ~R$300~ por 💥 *R$183,20*💥'), r);
});

test('sem preço antigo usa só "por"', () => {
  const r = c.montarLegenda({ ...d, precoAntigo: null });
  assert.ok(r.includes('\n\npor 💥 *R$149,90*💥\n\n'), r);
  assert.ok(!r.includes('~') && !r.includes('de '), r);
});

test('preço antigo menor ou igual ao atual é ignorado', () => {
  for (const antigo of [149.9, 100]) {
    const r = c.montarLegenda({ ...d, precoAntigo: antigo });
    assert.ok(!r.includes('~'), r);
    assert.ok(r.includes('por 💥 *R$149,90*💥'), r);
  }
});

test('nunca escreve % OFF', () => {
  assert.ok(!/OFF|%/.test(c.montarLegenda(d)));
});

test('sem frase omite a linha do 💗', () => {
  for (const frase of ['', '   ', null, undefined]) {
    const r = c.montarLegenda({ ...d, frase });
    assert.ok(!r.includes('💗') && !r.includes('__'), JSON.stringify(r));
    assert.ok(!r.includes('\n\n\n'), JSON.stringify(r));
  }
});

test('sem emoji não deixa espaço sobrando depois do título', () => {
  const r = c.montarLegenda({ ...d, emoji: '' });
  assert.ok(r.startsWith('*FONE BLUETOOTH X*\n\n'), JSON.stringify(r));
});

test('sem preço não mostra R$ nem null', () => {
  const r = c.montarLegenda({ ...d, preco: null, precoAntigo: null });
  assert.ok(!r.includes('R$') && !r.includes('null') && !r.includes('💥'), r);
  assert.ok(r.includes('FONE BLUETOOTH X') && r.includes(d.link), r);
  assert.ok(!r.includes('\n\n\n'), JSON.stringify(r));
});

test('sem título não mostra asteriscos vazios', () => {
  const r = c.montarLegenda({ ...d, titulo: '' });
  assert.ok(!r.includes('**'), JSON.stringify(r));
  assert.equal(r, r.trim(), JSON.stringify(r));
  assert.ok(r.includes(d.link));
});

test('título é cortado em 100 caracteres', () => {
  const r = c.montarLegenda({ ...d, titulo: 'a'.repeat(200) });
  assert.ok(r.includes('A'.repeat(100) + '…'));
  assert.ok(!r.includes('A'.repeat(101)));
});

test('legenda nunca começa nem termina com espaço ou quebra', () => {
  for (const x of [d, { ...d, frase: '' }, { ...d, preco: null }, { ...d, titulo: '', emoji: '' }]) {
    const r = c.montarLegenda(x);
    assert.equal(r, r.trim(), JSON.stringify(r));
  }
});
