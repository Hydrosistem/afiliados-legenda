const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGs } = require('./helpers/load-gs');
const { makeStubs } = require('./helpers/gas-stubs');

const fx = (n) => fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8');

function ambiente(opts) {
  const stubs = makeStubs(opts);
  const ctx = loadGs(['src/parse.gs', 'src/Code.gs'], stubs);
  const chamar = (p) => JSON.parse(ctx.doGet({ parameter: p }).getContent());
  return { stubs, chamar };
}
const info = (url) => ({ token: 'tok', action: 'info', url });

test('token errado devolve erro token', () => {
  const { chamar } = ambiente();
  assert.deepEqual(chamar({ token: 'x', action: 'info', url: 'https://meli.la/a' }), { ok: false, erro: 'token' });
});

test('ação desconhecida devolve erro acao', () => {
  const { chamar } = ambiente();
  assert.deepEqual(chamar({ token: 'tok', action: 'zzz' }), { ok: false, erro: 'acao' });
});

test('host fora da lista devolve erro host sem chamar fetch', () => {
  const { chamar, stubs } = ambiente();
  assert.deepEqual(chamar(info('https://evil.com/x')), { ok: false, erro: 'host' });
  assert.equal(stubs.chamadas.fetch, 0);
});

test('info feliz devolve campos e urlFinal', () => {
  const { chamar } = ambiente({
    respostas: [
      { code: 302, headers: { Location: 'https://www.mercadolivre.com.br/p/MLB1' } },
      { code: 200, body: fx('com-desconto.html') },
    ],
  });
  assert.deepEqual(chamar(info('https://meli.la/abc')), {
    ok: true,
    titulo: 'Fone Bluetooth X',
    preco: 149.9,
    precoAntigo: 199.9,
    imagem: 'https://http2.mlstatic.com/D_NQ_NP_123-F.webp',
    urlFinal: 'https://www.mercadolivre.com.br/p/MLB1',
  });
});

test('segue redirect relativo no mesmo host', () => {
  const { chamar, stubs } = ambiente({
    respostas: [
      { code: 301, headers: { location: '/p/MLB2' } },
      { code: 200, body: fx('sem-desconto.html') },
    ],
  });
  const r = chamar(info('https://www.mercadolivre.com.br/x'));
  assert.equal(r.ok, true);
  assert.equal(r.urlFinal, 'https://www.mercadolivre.com.br/p/MLB2');
  assert.equal(stubs.chamadas.urls[1], 'https://www.mercadolivre.com.br/p/MLB2');
});

test('redirect para host fora da lista devolve erro host', () => {
  const { chamar } = ambiente({ respostas: [{ code: 302, headers: { location: 'https://evil.com/' } }] });
  assert.deepEqual(chamar(info('https://meli.la/abc')), { ok: false, erro: 'host' });
});

test('mais de 5 redirecionamentos devolve erro rede', () => {
  const salto = { code: 302, headers: { Location: 'https://meli.la/x' } };
  const { chamar } = ambiente({ respostas: Array(8).fill(salto) });
  assert.deepEqual(chamar(info('https://meli.la/abc')), { ok: false, erro: 'rede' });
});

test('página sem título e sem preço devolve erro link_curto', () => {
  const { chamar } = ambiente({ respostas: [{ code: 200, body: '<html></html>' }] });
  assert.deepEqual(chamar(info('https://meli.la/abc')), { ok: false, erro: 'link_curto' });
});

test('resposta 403 devolve erro rede', () => {
  const { chamar } = ambiente({ respostas: [{ code: 403, body: 'blocked' }] });
  assert.deepEqual(chamar(info('https://meli.la/abc')), { ok: false, erro: 'rede' });
});

test('fetch que lança exceção devolve erro rede', () => {
  const { chamar } = ambiente({ respostas: [{ throw: 'boom' }] });
  assert.deepEqual(chamar(info('https://meli.la/abc')), { ok: false, erro: 'rede' });
});

test('segunda chamada igual usa cache de 3600 s', () => {
  const { chamar, stubs } = ambiente({
    respostas: [{ code: 200, body: fx('com-desconto.html') }],
  });
  const a = chamar(info('https://www.mercadolivre.com.br/p/MLB1'));
  const b = chamar(info('https://www.mercadolivre.com.br/p/MLB1'));
  assert.deepEqual(b, a);
  assert.equal(stubs.chamadas.fetch, 1);
  assert.equal(stubs.chamadas.cachePut[0].ttl, 3600);
});

test('img feliz devolve base64 e mime', () => {
  const { chamar } = ambiente({
    respostas: [{ code: 200, headers: { 'Content-Type': 'image/jpeg; charset=x' }, body: Buffer.from([1, 2, 3]) }],
  });
  assert.deepEqual(
    chamar({ token: 'tok', action: 'img', url: 'https://http2.mlstatic.com/a.jpg' }),
    { ok: true, base64: 'AQID', mime: 'image/jpeg' },
  );
});

test('img com host fora da lista devolve erro host', () => {
  const { chamar, stubs } = ambiente();
  assert.deepEqual(chamar({ token: 'tok', action: 'img', url: 'https://evil.com/a.jpg' }), { ok: false, erro: 'host' });
  assert.equal(stubs.chamadas.fetch, 0);
});
