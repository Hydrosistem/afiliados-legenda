const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGs } = require('./helpers/load-gs');
const { makeStubs } = require('./helpers/gas-stubs');

const fx = (n) => fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8');

const CLIENTES_PADRAO = [
  ['email', 'nome', 'ativo'],
  ['maria@gmail.com', 'Maria', 'sim'],
];

function ambiente(opts) {
  opts = opts || {};
  const stubs = makeStubs({
    props: Object.assign({ GOOGLE_CLIENT_ID: 'cid', PLANILHA_ID: 'pid' }, opts.props),
    clientes: opts.clientes || CLIENTES_PADRAO,
    respostas: opts.respostas || [],
  });
  const ctx = loadGs(['src/parse.gs', 'src/acesso.gs', 'src/Code.gs'], stubs);
  const chamar = (p) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(p) } }).getContent());
  return { stubs, ctx, chamar };
}

// Cria a sessão de maria@gmail.com direto, sem passar pelo fluxo de login.
function logado(amb) {
  return amb.ctx.criarSessao_('maria@gmail.com');
}

const info = (sessao, url) => ({ action: 'info', sessao: sessao, url: url });
const img = (sessao, url) => ({ action: 'img', sessao: sessao, url: url });

function tokenValido(extra) {
  return Object.assign(
    {
      aud: 'cid',
      iss: 'https://accounts.google.com',
      email: 'maria@gmail.com',
      email_verified: 'true',
      exp: String(Math.floor(Date.now() / 1000) + 600),
    },
    extra,
  );
}
function tokeninfoResposta(obj, code) {
  return { code: code === undefined ? 200 : code, body: JSON.stringify(obj) };
}

// ---- login ----

test('login feliz devolve sessão, nome e e-mail', () => {
  const { chamar } = ambiente({ respostas: [tokeninfoResposta(tokenValido())] });
  assert.deepEqual(chamar({ action: 'login', idToken: 'idtok' }), {
    ok: true,
    sessao: 'uuid-1',
    nome: 'Maria',
    email: 'maria@gmail.com',
  });
});

test('login com e-mail fora da planilha ou inativo devolve sem_acesso', () => {
  const { chamar, stubs } = ambiente({
    respostas: [tokeninfoResposta(tokenValido({ email: 'desconhecido@gmail.com' }))],
  });
  assert.deepEqual(chamar({ action: 'login', idToken: 'idtok' }), { ok: false, erro: 'sem_acesso' });
  assert.equal(Object.keys(stubs.propriedades).some((k) => k.indexOf('s:') === 0), false);
});

test('login com token recusado devolve erro login', () => {
  const { chamar } = ambiente({ respostas: [tokeninfoResposta(tokenValido({ aud: 'outro' }))] });
  assert.deepEqual(chamar({ action: 'login', idToken: 'idtok' }), { ok: false, erro: 'login' });
});

// ---- autenticação nas demais ações ----

test('info sem sessão ou com sessão desconhecida devolve erro sessao sem chamar fetch', () => {
  const amb = ambiente();
  assert.deepEqual(amb.chamar(info(undefined, 'https://meli.la/a')), { ok: false, erro: 'sessao' });
  assert.deepEqual(amb.chamar(info('nao-existe', 'https://meli.la/a')), { ok: false, erro: 'sessao' });
  assert.equal(amb.stubs.chamadas.fetch, 0);
});

test('cliente desativado depois do login: info devolve sem_acesso e a sessão some', () => {
  const amb = ambiente({ clientes: CLIENTES_PADRAO.map((l) => l.slice()) });
  const sessao = logado(amb);
  // Desativa a Maria na planilha.
  const linhas = amb.ctx.SpreadsheetApp.openById('pid').getSheetByName('Clientes').getDataRange().getValues();
  linhas[1][2] = 'não';
  assert.deepEqual(amb.chamar(info(sessao, 'https://meli.la/a')), { ok: false, erro: 'sem_acesso' });
  assert.equal(amb.ctx.emailDaSessao_(sessao), null);
});

test('sair encerra a sessão', () => {
  const amb = ambiente();
  const sessao = logado(amb);
  assert.deepEqual(amb.chamar({ action: 'sair', sessao: sessao }), { ok: true });
  assert.deepEqual(amb.chamar(info(sessao, 'https://meli.la/a')), { ok: false, erro: 'sessao' });
});

test('corpo inválido e ação desconhecida devolvem acao', () => {
  const amb = ambiente();
  const semCorpo = JSON.parse(amb.ctx.doPost({ postData: { contents: 'isto não é json' } }).getContent());
  assert.deepEqual(semCorpo, { ok: false, erro: 'acao' });
  assert.deepEqual(amb.chamar({ action: 'zzz' }), { ok: false, erro: 'acao' });
});

test('doGet devolve acao', () => {
  const amb = ambiente();
  assert.deepEqual(JSON.parse(amb.ctx.doGet({}).getContent()), { ok: false, erro: 'acao' });
});

// ---- info/img normais, agora com sessão ----

test('host fora da lista devolve erro host sem chamar fetch', () => {
  const amb = ambiente();
  const sessao = logado(amb);
  assert.deepEqual(amb.chamar(info(sessao, 'https://evil.com/x')), { ok: false, erro: 'host' });
  assert.equal(amb.stubs.chamadas.fetch, 0);
});

test('info feliz devolve campos e urlFinal, sem frase', () => {
  const amb = ambiente({
    respostas: [
      { code: 302, headers: { Location: 'https://www.mercadolivre.com.br/p/MLB1' } },
      { code: 200, body: fx('com-desconto.html') },
    ],
  });
  const sessao = logado(amb);
  assert.deepEqual(amb.chamar(info(sessao, 'https://meli.la/abc')), {
    ok: true,
    titulo: 'Fone Bluetooth X',
    preco: 149.9,
    precoAntigo: 199.9,
    imagem: 'https://http2.mlstatic.com/D_NQ_NP_123-F.webp',
    urlFinal: 'https://www.mercadolivre.com.br/p/MLB1',
  });
});

test('info sempre guarda em cache', () => {
  const amb = ambiente({
    respostas: [
      { code: 302, headers: { Location: 'https://www.mercadolivre.com.br/p/MLB1' } },
      { code: 200, body: fx('com-desconto.html') },
    ],
  });
  const sessao = logado(amb);
  amb.chamar(info(sessao, 'https://meli.la/abc'));
  assert.equal(amb.stubs.chamadas.cachePut.length, 1);
});

test('segue redirect relativo no mesmo host', () => {
  const amb = ambiente({
    respostas: [
      { code: 301, headers: { location: '/p/MLB2' } },
      { code: 200, body: fx('sem-desconto.html') },
    ],
  });
  const sessao = logado(amb);
  const r = amb.chamar(info(sessao, 'https://www.mercadolivre.com.br/x'));
  assert.equal(r.ok, true);
  assert.equal(r.urlFinal, 'https://www.mercadolivre.com.br/p/MLB2');
  assert.equal(amb.stubs.chamadas.urls[1], 'https://www.mercadolivre.com.br/p/MLB2');
});

test('redirect para host fora da lista devolve erro host', () => {
  const amb = ambiente({ respostas: [{ code: 302, headers: { location: 'https://evil.com/' } }] });
  const sessao = logado(amb);
  assert.deepEqual(amb.chamar(info(sessao, 'https://meli.la/abc')), { ok: false, erro: 'host' });
});

test('mais de 5 redirecionamentos devolve erro rede', () => {
  const salto = { code: 302, headers: { Location: 'https://meli.la/x' } };
  const amb = ambiente({ respostas: Array(8).fill(salto) });
  const sessao = logado(amb);
  assert.deepEqual(amb.chamar(info(sessao, 'https://meli.la/abc')), { ok: false, erro: 'rede' });
});

test('página sem título e sem preço devolve erro link_curto', () => {
  const amb = ambiente({ respostas: [{ code: 200, body: '<html></html>' }] });
  const sessao = logado(amb);
  assert.deepEqual(amb.chamar(info(sessao, 'https://meli.la/abc')), { ok: false, erro: 'link_curto' });
});

test('resposta 403 devolve erro rede', () => {
  const amb = ambiente({ respostas: [{ code: 403, body: 'blocked' }] });
  const sessao = logado(amb);
  assert.deepEqual(amb.chamar(info(sessao, 'https://meli.la/abc')), { ok: false, erro: 'rede' });
});

test('fetch que lança exceção devolve erro rede', () => {
  const amb = ambiente({ respostas: [{ throw: 'boom' }] });
  const sessao = logado(amb);
  assert.deepEqual(amb.chamar(info(sessao, 'https://meli.la/abc')), { ok: false, erro: 'rede' });
});

test('segunda chamada igual usa cache de 3600 s', () => {
  const amb = ambiente({
    respostas: [{ code: 200, body: fx('com-desconto.html') }],
  });
  const sessao = logado(amb);
  const a = amb.chamar(info(sessao, 'https://www.mercadolivre.com.br/p/MLB1'));
  const b = amb.chamar(info(sessao, 'https://www.mercadolivre.com.br/p/MLB1'));
  assert.deepEqual(b, a);
  assert.equal(amb.stubs.chamadas.fetch, 1);
  assert.equal(amb.stubs.chamadas.cachePut[0].ttl, 3600);
});

test('img feliz devolve base64 e mime', () => {
  const amb = ambiente({
    respostas: [{ code: 200, headers: { 'Content-Type': 'image/jpeg; charset=x' }, body: Buffer.from([1, 2, 3]) }],
  });
  const sessao = logado(amb);
  assert.deepEqual(
    amb.chamar(img(sessao, 'https://http2.mlstatic.com/a.jpg')),
    { ok: true, base64: 'AQID', mime: 'image/jpeg' },
  );
});

test('img com host fora da lista devolve erro host', () => {
  const amb = ambiente();
  const sessao = logado(amb);
  assert.deepEqual(amb.chamar(img(sessao, 'https://evil.com/a.jpg')), { ok: false, erro: 'host' });
  assert.equal(amb.stubs.chamadas.fetch, 0);
});

// ---- exceção inesperada ----

test('exceção inesperada (planilha indisponível) devolve erro rede', () => {
  const amb = ambiente({ respostas: [tokeninfoResposta(tokenValido())] });
  // Simula a planilha fora do ar: SpreadsheetApp.openById é o mesmo objeto usado dentro do
  // contexto vm (passado por referência pelo loadGs), então sobrescrever o método aqui já
  // afeta buscarCliente_ chamado de dentro de doPost → login_, sem precisar mudar o stub.
  amb.stubs.SpreadsheetApp.openById = () => { throw new Error('planilha fora do ar'); };
  assert.deepEqual(amb.chamar({ action: 'login', idToken: 'idtok' }), { ok: false, erro: 'rede' });
});
