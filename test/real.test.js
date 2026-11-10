const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGs } = require('./helpers/load-gs');

// Roda o parser contra páginas reais salvas em test/fixtures/real/ (fora do git).
const pasta = path.join(__dirname, 'fixtures', 'real');
const arquivos = fs.existsSync(pasta) ? fs.readdirSync(pasta).filter((f) => f.endsWith('.html')) : [];
const ctx = loadGs(['src/parse.gs']);
// Opcional: test/fixtures/real/esperado.json = {"arquivo.html": {"preco": 149.9, "precoAntigo": 199.9 | null}}
const esperadoPath = path.join(pasta, 'esperado.json');
const esperado = fs.existsSync(esperadoPath) ? JSON.parse(fs.readFileSync(esperadoPath, 'utf8')) : {};

if (arquivos.length === 0) {
  test('páginas reais do ML', { skip: 'sem arquivos em test/fixtures/real/' }, () => {});
}

for (const arq of arquivos) {
  test(`página real: ${arq}`, () => {
    const r = ctx.parseProduto(fs.readFileSync(path.join(pasta, arq), 'utf8'));
    assert.ok(r.titulo && r.titulo.length > 0, 'título vazio');
    assert.ok(!/R\$/.test(r.titulo), 'título ainda tem preço: ' + r.titulo);
    assert.equal(typeof r.preco, 'number', 'preço não é número');
    assert.ok(r.preco > 0, 'preço <= 0');
    assert.ok(r.imagem && r.imagem.startsWith('https://'), 'imagem ausente');
    assert.ok(r.precoAntigo === null || r.precoAntigo > r.preco, 'preço antigo não é maior que o atual');
    if (esperado[arq]) {
      assert.equal(r.preco, esperado[arq].preco, 'preço diferente do esperado');
      assert.equal(r.precoAntigo, esperado[arq].precoAntigo, 'preço antigo diferente do esperado');
    }
  });
}
