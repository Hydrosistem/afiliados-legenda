const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGs, plain } = require('./helpers/load-gs');
const { makeStubs } = require('./helpers/gas-stubs');

const PROPS = { GOOGLE_CLIENT_ID: 'cid', PLANILHA_ID: 'pid' };

function tokenValido(extra) {
  return Object.assign(
    {
      aud: 'cid',
      iss: 'https://accounts.google.com',
      email: 'Maria@Gmail.com',
      email_verified: 'true',
      exp: String(Math.floor(Date.now() / 1000) + 600),
    },
    extra,
  );
}

function ambiente(opts) {
  const stubs = makeStubs(Object.assign({ props: PROPS }, opts));
  const ctx = loadGs(['src/acesso.gs'], stubs);
  return { stubs, ctx };
}

function tokeninfoResposta(obj, code) {
  return { code: code === undefined ? 200 : code, body: JSON.stringify(obj) };
}

// ---- verificarIdToken_ ----

test('verificarIdToken_ aceita token válido e devolve e-mail em minúsculas', () => {
  const { stubs, ctx } = ambiente({ respostas: [tokeninfoResposta(tokenValido())] });
  const r = plain(ctx.verificarIdToken_('idtok-123'));
  assert.deepEqual(r, { ok: true, email: 'maria@gmail.com' });
  assert.ok(stubs.chamadas.urls[0].startsWith('https://oauth2.googleapis.com/tokeninfo?id_token='));
  assert.equal(stubs.chamadas.opcoes[0].muteHttpExceptions, true);
});

test('verificarIdToken_ recusa aud errado', () => {
  const { ctx } = ambiente({ respostas: [tokeninfoResposta(tokenValido({ aud: 'outro' }))] });
  assert.deepEqual(plain(ctx.verificarIdToken_('idtok')), { ok: false });
});

test('verificarIdToken_ recusa e-mail não verificado', () => {
  const { ctx } = ambiente({ respostas: [tokeninfoResposta(tokenValido({ email_verified: 'false' }))] });
  assert.deepEqual(plain(ctx.verificarIdToken_('idtok')), { ok: false });
});

test('verificarIdToken_ recusa token vencido', () => {
  const vencido = tokenValido({ exp: String(Math.floor(Date.now() / 1000) - 10) });
  const { ctx } = ambiente({ respostas: [tokeninfoResposta(vencido)] });
  assert.deepEqual(plain(ctx.verificarIdToken_('idtok')), { ok: false });
});

test('verificarIdToken_ recusa iss estranho', () => {
  const { ctx } = ambiente({ respostas: [tokeninfoResposta(tokenValido({ iss: 'https://evil.com' }))] });
  assert.deepEqual(plain(ctx.verificarIdToken_('idtok')), { ok: false });
});

test('verificarIdToken_ recusa HTTP 400', () => {
  const { ctx } = ambiente({ respostas: [tokeninfoResposta(tokenValido(), 400)] });
  assert.deepEqual(plain(ctx.verificarIdToken_('idtok')), { ok: false });
});

test('verificarIdToken_ recusa token vazio sem chamar fetch', () => {
  const { stubs, ctx } = ambiente({ respostas: [] });
  assert.deepEqual(plain(ctx.verificarIdToken_('')), { ok: false });
  assert.equal(stubs.chamadas.fetch, 0);
});

test('verificarIdToken_ aceita iss sem https://', () => {
  const { ctx } = ambiente({ respostas: [tokeninfoResposta(tokenValido({ iss: 'accounts.google.com' }))] });
  assert.deepEqual(plain(ctx.verificarIdToken_('idtok')), { ok: true, email: 'maria@gmail.com' });
});

test('verificarIdToken_ aceita email_verified booleano true', () => {
  const { ctx } = ambiente({ respostas: [tokeninfoResposta(tokenValido({ email_verified: true }))] });
  assert.deepEqual(plain(ctx.verificarIdToken_('idtok')), { ok: true, email: 'maria@gmail.com' });
});

// ---- buscarCliente_ ----

const CLIENTES = [
  ['email', 'nome', 'ativo'],
  [' Maria@Gmail.com ', 'Maria', 'SIM'],
  ['joao@x.com', 'João', true],
  ['ana@x.com', 'Ana', 'não'],
  ['bia@x.com', 'Bia', ''],
];

test('buscarCliente_ ignora maiúsculas e espaços e lê ativo', () => {
  const { stubs, ctx } = ambiente({ clientes: CLIENTES });
  assert.deepEqual(plain(ctx.buscarCliente_('maria@gmail.com')), { nome: 'Maria', ativo: true });
  assert.equal(plain(ctx.buscarCliente_('joao@x.com')).ativo, true);
  assert.equal(plain(ctx.buscarCliente_('ana@x.com')).ativo, false);
  assert.equal(plain(ctx.buscarCliente_('bia@x.com')).ativo, false);
  assert.equal(ctx.buscarCliente_('ninguem@x.com'), null);
  assert.equal(ctx.buscarCliente_('email'), null);
  assert.equal(stubs.chamadas.planilhaId, 'pid');
});

// ---- sessões ----

test('terceira sessão derruba a mais antiga', () => {
  const { ctx } = ambiente({ clientes: CLIENTES });
  const id1 = ctx.criarSessao_('a@x.com');
  const id2 = ctx.criarSessao_('a@x.com');
  const id3 = ctx.criarSessao_('a@x.com');
  assert.equal(id1, 'uuid-1');
  assert.equal(id2, 'uuid-2');
  assert.equal(id3, 'uuid-3');
  assert.equal(ctx.emailDaSessao_('uuid-1'), null);
  assert.equal(ctx.emailDaSessao_('uuid-2'), 'a@x.com');
  assert.equal(ctx.emailDaSessao_('uuid-3'), 'a@x.com');
});

test('sessões de e-mails diferentes não interferem', () => {
  const { ctx } = ambiente({ clientes: CLIENTES });
  const a1 = ctx.criarSessao_('a@x.com');
  const a2 = ctx.criarSessao_('a@x.com');
  const b1 = ctx.criarSessao_('b@x.com');
  assert.equal(ctx.emailDaSessao_(a1), 'a@x.com');
  assert.equal(ctx.emailDaSessao_(a2), 'a@x.com');
  assert.equal(ctx.emailDaSessao_(b1), 'b@x.com');
});

test('encerrarSessao_ apaga só aquela sessão', () => {
  const { ctx } = ambiente({ clientes: CLIENTES });
  const id1 = ctx.criarSessao_('a@x.com');
  const id2 = ctx.criarSessao_('a@x.com');
  ctx.encerrarSessao_(id1);
  assert.equal(ctx.emailDaSessao_(id1), null);
  assert.equal(ctx.emailDaSessao_(id2), 'a@x.com');
});

test('encerrarSessao_ com id inexistente ou vazio não lança', () => {
  const { ctx } = ambiente({ clientes: CLIENTES });
  assert.doesNotThrow(() => ctx.encerrarSessao_('nao-existe'));
  assert.doesNotThrow(() => ctx.encerrarSessao_(''));
});

test('emailDaSessao_ com id vazio ou desconhecido devolve null', () => {
  const { ctx } = ambiente({ clientes: CLIENTES });
  assert.equal(ctx.emailDaSessao_(''), null);
  assert.equal(ctx.emailDaSessao_('desconhecido'), null);
});
