const { test } = require('node:test');
const assert = require('node:assert/strict');
const c = require('../web/caption.js');

test('formatBRL formata em reais', () => {
  assert.equal(c.formatBRL(1234.5), 'R$ 1.234,50');
  assert.equal(c.formatBRL(149.9), 'R$ 149,90');
  assert.equal(c.formatBRL(10), 'R$ 10,00');
  assert.equal(c.formatBRL(1234567.8), 'R$ 1.234.567,80');
});

test('encurtarTitulo mantém título curto', () => {
  assert.equal(c.encurtarTitulo('Fone X'), 'Fone X');
  assert.equal(c.encurtarTitulo(''), '');
});

test('encurtarTitulo corta no limite de palavra', () => {
  const t = Array(12).fill('palavra').join(' ');
  const r = c.encurtarTitulo(t);
  assert.ok(r.length <= 71, `len ${r.length}`);
  assert.ok(r.endsWith('…'));
  assert.ok(r.slice(0, -1).split(' ').every((p) => p === 'palavra'));
});

test('encurtarTitulo corta sem espaços em 70 caracteres', () => {
  assert.equal(c.encurtarTitulo('a'.repeat(100)), 'a'.repeat(70) + '…');
});

test('calcDesconto', () => {
  assert.equal(c.calcDesconto(199.9, 149.9), 25);
  assert.equal(c.calcDesconto(100, 100), null);
  assert.equal(c.calcDesconto(90, 100), null);
  assert.equal(c.calcDesconto(null, 100), null);
  assert.equal(c.calcDesconto(200, null), null);
  assert.equal(c.calcDesconto(100, 99.7), null);
});

const d = { titulo: 'Fone X', preco: 149.9, precoAntigo: 199.9, link: 'https://meli.la/abc' };

test('legenda com desconto (template 0) é exata', () => {
  assert.equal(
    c.montarLegenda(d, 0),
    '🔥 *Fone X*\n\nDe ~R$ 199,90~ por *R$ 149,90* (25% OFF)\n\n👉 https://meli.la/abc',
  );
});

test('legenda sem preço antigo não tem riscado nem OFF', () => {
  for (let i = 0; i < 4; i++) {
    const r = c.montarLegenda({ ...d, precoAntigo: null }, i);
    assert.ok(!r.includes('~') && !r.includes('OFF'), r);
    assert.ok(r.includes('*R$ 149,90*'), r);
  }
});

test('legenda com preço antigo menor ou igual ao atual não tem OFF', () => {
  for (const antigo of [149.9, 100]) {
    const r = c.montarLegenda({ ...d, precoAntigo: antigo }, 0);
    assert.ok(!r.includes('~') && !r.includes('OFF'), r);
  }
});

test('legenda sem preço não mostra R$ nem null', () => {
  for (let i = 0; i < 4; i++) {
    const r = c.montarLegenda({ ...d, preco: null, precoAntigo: null }, i);
    assert.ok(!r.includes('R$') && !r.includes('null'), r);
    assert.ok(r.includes('Fone X') && r.includes(d.link), r);
  }
});

test('título longo sem espaços é cortado na legenda', () => {
  const r = c.montarLegenda({ ...d, titulo: 'a'.repeat(200) }, 0);
  assert.ok(r.includes('a'.repeat(70) + '…'));
  assert.ok(!r.includes('a'.repeat(71)));
});

test('índice dá a volta e os 4 templates diferem', () => {
  assert.equal(c.montarLegenda(d, 4), c.montarLegenda(d, 0));
  const todos = [0, 1, 2, 3].map((i) => c.montarLegenda(d, i));
  assert.equal(new Set(todos).size, 4);
  for (const r of todos) assert.ok(r.includes('Fone X') && r.includes(d.link), r);
  assert.equal(c.TEMPLATES.length, 4);
});

test('legenda sem preço não deixa quebra de linha sobrando', () => {
  for (let i = 0; i < 4; i++) {
    const r = c.montarLegenda({ ...d, preco: null, precoAntigo: null }, i);
    assert.equal(r, r.trim(), JSON.stringify(r));
    assert.ok(!r.includes('\n\n\n'), JSON.stringify(r));
  }
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

test('legenda sem título não mostra asteriscos vazios', () => {
  for (let i = 0; i < 4; i++) {
    const r = c.montarLegenda({ ...d, titulo: '' }, i);
    assert.ok(!r.includes('**'), JSON.stringify(r));
    assert.ok(r.includes(d.link) && r.includes('*R$ 149,90*') || r.includes('R$ 149,90'), r);
    assert.equal(r, r.trim(), JSON.stringify(r));
  }
});

test('parseValor trata ponto de milhar sem vírgula', () => {
  assert.equal(c.parseValor('1.299'), 1299);
  assert.equal(c.parseValor('12.345.678'), 12345678);
  assert.equal(c.parseValor('1299.9'), 1299.9);
  assert.equal(c.parseValor('149.90'), 149.9);
});
