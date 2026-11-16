const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGs, plain } = require('./helpers/load-gs');
const { makeStubs } = require('./helpers/gas-stubs');

const EMAIL = 'maria@gmail.com';

function ambiente(opts) {
  opts = opts || {};
  const stubs = makeStubs({
    props: Object.assign({ PLANILHA_ID: 'pid', GEMINI_KEY: 'chave-do-vendedor' }, opts.props),
    clientes: [['email', 'nome', 'ativo'], [EMAIL, 'Maria', 'sim']],
    respostas: opts.respostas || [],
  });
  const ctx = loadGs(['src/parse.gs', 'src/acesso.gs', 'src/shopee.gs', 'src/vendas.gs', 'web/frase.js', 'src/ia.gs', 'src/Code.gs'], stubs);
  const chamar = (p) => JSON.parse(ctx.doPost({ parameter: {}, postData: { contents: JSON.stringify(p) } }).getContent());
  const sessao = ctx.criarSessao_(EMAIL);
  return { stubs, ctx, chamar, sessao };
}

const geminiOk = (frase, emoji) => ({
  code: 200,
  body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ frase: frase || 'Som potente pra acompanhar o seu dia todo!!', emoji: emoji || '🎧' }) }] } }] }),
});

test('frase pelo servidor: usa a chave do vendedor no cabeçalho e devolve frase e emoji', () => {
  const a = ambiente({ respostas: [geminiOk()] });
  const r = a.chamar({ action: 'frase', sessao: a.sessao, titulo: 'Fone Bluetooth sem fio' });
  assert.deepEqual(plain(r), { ok: true, frase: 'Som potente pra acompanhar o seu dia todo!!', emoji: '🎧', restantes: 49 });
  assert.match(a.stubs.chamadas.urls[0], /generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.5-flash-lite:generateContent$/);
  const op = a.stubs.chamadas.opcoes[0];
  assert.equal(op.headers['x-goog-api-key'], 'chave-do-vendedor');
  assert.match(JSON.parse(op.payload).contents[0].parts[0].text, /<produto>Fone Bluetooth sem fio<\/produto>/);
  assert.doesNotMatch(op.url || '', /chave-do-vendedor/);
});

test('frase exige sessão válida', () => {
  const a = ambiente();
  assert.deepEqual(a.chamar({ action: 'frase', sessao: 'inventada', titulo: 'X' }), { ok: false, erro: 'sessao' });
  assert.equal(a.stubs.chamadas.fetch, 0);
});

test('cota diária por cliente: padrão 50; ajustável pela propriedade COTA_FRASES_DIA', () => {
  const respostas = [];
  for (let i = 0; i < 3; i++) respostas.push(geminiOk());
  const a = ambiente({ props: { COTA_FRASES_DIA: '2' }, respostas });
  assert.equal(a.chamar({ action: 'frase', sessao: a.sessao, titulo: 'A' }).restantes, 1);
  assert.equal(a.chamar({ action: 'frase', sessao: a.sessao, titulo: 'B' }).restantes, 0);
  assert.deepEqual(a.chamar({ action: 'frase', sessao: a.sessao, titulo: 'C' }), { ok: false, erro: 'cota_frase', limite: 2 });
  assert.equal(a.stubs.chamadas.fetch, 2);
  assert.equal(ambiente().ctx.cotaFrasesDia_(), 50);
});

test('falhas não gastam cota', () => {
  const a = ambiente({ props: { COTA_FRASES_DIA: '1' }, respostas: [{ code: 500, body: 'x' }, geminiOk()] });
  assert.deepEqual(a.chamar({ action: 'frase', sessao: a.sessao, titulo: 'A' }), { ok: false, erro: 'rede' });
  assert.equal(a.chamar({ action: 'frase', sessao: a.sessao, titulo: 'A' }).ok, true);
});

test('erros do Gemini viram mensagens próprias', () => {
  let a = ambiente({ respostas: [{ code: 429, body: '{}' }] });
  assert.deepEqual(a.chamar({ action: 'frase', sessao: a.sessao, titulo: 'A' }), { ok: false, erro: 'limite' });
  a = ambiente({ respostas: [{ code: 403, body: '{}' }] });
  assert.deepEqual(a.chamar({ action: 'frase', sessao: a.sessao, titulo: 'A' }), { ok: false, erro: 'ia_indisponivel' });
  a = ambiente({ respostas: [{ code: 200, body: '{"candidates":[{"content":{"parts":[{"text":"não é json"}]}}]}' }] });
  assert.deepEqual(a.chamar({ action: 'frase', sessao: a.sessao, titulo: 'A' }), { ok: false, erro: 'formato' });
  a = ambiente({ respostas: [{ throw: 'timeout' }] });
  assert.deepEqual(a.chamar({ action: 'frase', sessao: a.sessao, titulo: 'A' }), { ok: false, erro: 'rede' });
});

test('sem GEMINI_KEY no servidor: ia_indisponivel sem chamar o Google', () => {
  const a = ambiente({ props: { GEMINI_KEY: null } });
  assert.deepEqual(a.chamar({ action: 'frase', sessao: a.sessao, titulo: 'A' }), { ok: false, erro: 'ia_indisponivel' });
  assert.equal(a.stubs.chamadas.fetch, 0);
});

test('título vazio não chama o Google', () => {
  const a = ambiente();
  assert.deepEqual(a.chamar({ action: 'frase', sessao: a.sessao, titulo: '   ' }), { ok: false, erro: 'titulo' });
  assert.equal(a.stubs.chamadas.fetch, 0);
});
