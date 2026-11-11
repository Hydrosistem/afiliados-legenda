const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGs } = require('./helpers/load-gs');
const { makeStubs } = require('./helpers/gas-stubs');

const fx = (n) => fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8');

function ambiente(opts) {
  const stubs = makeStubs(opts);
  const ctx = loadGs(['src/parse.gs', 'src/frase.gs', 'src/Code.gs'], stubs);
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
    frase: '',
    emoji: '',
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

// ---- frase de efeito (Gemini) ----
const gemini = (frase, emoji) => ({
  code: 200,
  body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ frase, emoji }) }] } }] }),
});
const paginaOk = () => [
  { code: 302, headers: { Location: 'https://www.mercadolivre.com.br/p/MLB1' } },
  { code: 200, body: fx('com-desconto.html') },
];

test('com chave: info inclui frase e emoji do Gemini e usa chave no cabeçalho', () => {
  const { chamar, stubs } = ambiente({
    props: { GEMINI_KEY: 'k123' },
    respostas: [...paginaOk(), gemini('Som potente pra animar seu dia!!', '🎧')],
  });
  const r = chamar(info('https://meli.la/abc'));
  assert.equal(r.ok, true);
  assert.equal(r.frase, 'Som potente pra animar seu dia!!');
  assert.equal(r.emoji, '🎧');
  const i = stubs.chamadas.fetch - 1;
  const url = stubs.chamadas.urls[i];
  const op = stubs.chamadas.opcoes[i];
  assert.ok(url.startsWith('https://generativelanguage.googleapis.com/'), url);
  assert.ok(!url.includes('k123'), 'chave não pode ir na URL');
  assert.equal(op.method, 'post');
  assert.equal(op.headers['x-goog-api-key'], 'k123');
  assert.equal(op.muteHttpExceptions, true);
  assert.ok(JSON.parse(op.payload).contents[0].parts[0].text.includes('Fone Bluetooth X'));
});

test('GEMINI_MODEL troca o modelo na URL', () => {
  const { chamar, stubs } = ambiente({
    props: { GEMINI_KEY: 'k', GEMINI_MODEL: 'gemini-x-teste' },
    respostas: [...paginaOk(), gemini('Oi!!', '🔥')],
  });
  chamar(info('https://meli.la/abc'));
  assert.ok(stubs.chamadas.urls.at(-1).includes('/models/gemini-x-teste:generateContent'));
});

test('sem chave: frase e emoji vazios e nenhuma chamada ao Gemini', () => {
  const { chamar, stubs } = ambiente({ respostas: paginaOk() });
  const r = chamar(info('https://meli.la/abc'));
  assert.equal(r.ok, true);
  assert.equal(r.frase, '');
  assert.equal(r.emoji, '');
  assert.equal(stubs.chamadas.fetch, 2);
});

test('Gemini falha (429, exceção, JSON ruim): ok com frase vazia', () => {
  const falhas = [
    { code: 429, body: '{"error":{}}' },
    { code: 200, throw: undefined, body: 'nao json' },
    { code: 200, body: JSON.stringify({ candidates: [] }) },
  ];
  for (const f of falhas) {
    const { chamar } = ambiente({ props: { GEMINI_KEY: 'k' }, respostas: [...paginaOk(), f] });
    const r = chamar(info('https://meli.la/abc'));
    assert.equal(r.ok, true);
    assert.equal(r.frase, '');
    assert.equal(r.emoji, '');
    assert.equal(r.titulo, 'Fone Bluetooth X');
  }
  const { chamar } = ambiente({ props: { GEMINI_KEY: 'k' }, respostas: [...paginaOk(), { throw: 'rede caiu' }] });
  assert.equal(chamar(info('https://meli.la/abc')).frase, '');
});

test('cache: guarda quando há frase; não guarda quando a frase veio vazia', () => {
  const com = ambiente({ props: { GEMINI_KEY: 'k' }, respostas: [...paginaOk(), gemini('Oi!!', '🔥')] });
  com.chamar(info('https://meli.la/abc'));
  assert.equal(com.stubs.chamadas.cachePut.length, 1);
  const sem = ambiente({ props: { GEMINI_KEY: 'k' }, respostas: [...paginaOk(), { code: 429 }] });
  sem.chamar(info('https://meli.la/abc'));
  assert.equal(sem.stubs.chamadas.cachePut.length, 0);
});

test('sem chave o resultado continua sendo guardado em cache', () => {
  const { chamar, stubs } = ambiente({ respostas: paginaOk() });
  chamar(info('https://meli.la/abc'));
  assert.equal(stubs.chamadas.cachePut.length, 1);
});
