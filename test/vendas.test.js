const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { loadGs, plain } = require('./helpers/load-gs');
const { makeStubs } = require('./helpers/gas-stubs');

// Formato PROVISÓRIO do aviso da Kiwify (montado a partir de documentação de terceiros).
// Trocar pelo aviso de teste real assim que o webhook for configurado.
const APROVADO = fs.readFileSync(path.join(__dirname, 'fixtures', 'kiwify-aprovado.json'), 'utf8');
const TOKEN = 'tok12345678';
const EMAIL = 'cliente.teste@example.com';

function ambiente(opts) {
  opts = opts || {};
  const props = Object.assign({ PLANILHA_ID: 'pid', KIWIFY_TOKEN: TOKEN, BREVO_API_KEY: 'chave-brevo' }, opts.props);
  const stubs = makeStubs({
    props: props,
    clientes: opts.clientes || [['email', 'nome', 'ativo']],
    respostas: opts.respostas || [],
  });
  const ctx = loadGs(['src/parse.gs', 'src/acesso.gs', 'src/shopee.gs', 'src/vendas.gs', 'src/Code.gs'], stubs);
  const chamar = (p) => JSON.parse(ctx.doPost({ parameter: {}, postData: { contents: JSON.stringify(p) } }).getContent());
  const webhook = (corpo, assinatura) => JSON.parse(ctx.doPost({
    parameter: { origem: 'kiwify', signature: assinatura === undefined ? assinar(corpo) : assinatura },
    postData: { contents: corpo },
  }).getContent());
  return { stubs, ctx, chamar, webhook, planilha: () => stubs.clientes };
}

const assinar = (corpo) => crypto.createHmac('sha1', TOKEN).update(corpo).digest('hex');
const brevoOk = () => ({ code: 201, body: '{"messageId":"x"}' });
const corpoCom = (mudancas) => JSON.stringify(Object.assign(JSON.parse(APROVADO), mudancas));

test('webhook com assinatura inválida é ignorado e não mexe na planilha', () => {
  const a = ambiente();
  assert.deepEqual(a.webhook(APROVADO, 'assinatura-falsa'), { ok: false, erro: 'assinatura' });
  assert.deepEqual(a.webhook(APROVADO, ''), { ok: false, erro: 'assinatura' });
  assert.equal(a.planilha().length, 1);
  assert.equal(a.stubs.chamadas.fetch, 0);
});

test('sem KIWIFY_TOKEN o webhook é recusado', () => {
  const a = ambiente({ props: { KIWIFY_TOKEN: null } });
  assert.deepEqual(a.webhook(APROVADO, assinar(APROVADO)), { ok: false, erro: 'assinatura' });
});

test('compra aprovada cria o cliente (e-mail minúsculo) e envia boas-vindas pelo Brevo', () => {
  const a = ambiente({ respostas: [brevoOk()] });
  assert.deepEqual(a.webhook(APROVADO), { ok: true, acao: 'ativado' });
  const linha = a.planilha()[1];
  assert.deepEqual(plain(linha.slice(0, 4)), [EMAIL, 'Cliente Teste', 'sim', 'pedido-teste-0001']);
  assert.equal(linha[5], 'kiwify');
  assert.deepEqual(plain(a.planilha()[0].slice(3, 6)), ['pedido', 'data', 'origem']);
  assert.equal(a.stubs.chamadas.urls[0], 'https://api.brevo.com/v3/smtp/email');
  const op = a.stubs.chamadas.opcoes[0];
  assert.equal(op.headers['api-key'], 'chave-brevo');
  const msg = JSON.parse(op.payload);
  assert.deepEqual(plain(msg.sender), { name: 'Gerador de Post', email: 'nao-responda@geradordepost.app.br' });
  assert.equal(msg.to[0].email, EMAIL);
  assert.match(msg.htmlContent, /geradordepost\.app\.br/);
  assert.match(msg.textContent, /geradordepost\.app\.br/);
});

test('o mesmo pedido entregue duas vezes não duplica a linha nem o e-mail', () => {
  const a = ambiente({ respostas: [brevoOk()] });
  a.webhook(APROVADO);
  assert.deepEqual(a.webhook(APROVADO), { ok: true, acao: 'ja_ativo' });
  assert.equal(a.planilha().length, 2);
  assert.equal(a.stubs.chamadas.fetch, 1);
});

test('compra de e-mail já cadastrado e desativado reativa a mesma linha e mantém o nome', () => {
  const a = ambiente({
    clientes: [['email', 'nome', 'ativo'], [EMAIL, 'Nome Antigo', 'não']],
    respostas: [brevoOk()],
  });
  assert.deepEqual(a.webhook(APROVADO), { ok: true, acao: 'ativado' });
  assert.equal(a.planilha().length, 2);
  assert.deepEqual(a.planilha()[1].slice(0, 3), [EMAIL, 'Nome Antigo', 'sim']);
});

test('reembolso e chargeback desativam o cliente e derrubam todas as sessões', () => {
  for (const mud of [
    { order_status: 'refunded', webhook_event_type: 'order_refunded' },
    { order_status: 'chargedback', webhook_event_type: 'chargeback' },
  ]) {
    const a = ambiente({ clientes: [['email', 'nome', 'ativo'], [EMAIL, 'Cliente', 'sim']] });
    const s1 = a.ctx.criarSessao_(EMAIL);
    const s2 = a.ctx.criarSessao_(EMAIL);
    const corpo = corpoCom(mud);
    assert.deepEqual(a.webhook(corpo), { ok: true, acao: 'desativado' });
    assert.equal(a.planilha()[1][2], 'não');
    assert.equal(a.ctx.emailDaSessao_(s1), null);
    assert.equal(a.ctx.emailDaSessao_(s2), null);
    assert.equal(a.stubs.propriedades['u:' + EMAIL], undefined);
  }
});

test('outros eventos (ex.: Pix gerado) são ignorados', () => {
  const a = ambiente();
  const corpo = corpoCom({ order_status: 'waiting_payment', webhook_event_type: 'pix_created' });
  assert.deepEqual(a.webhook(corpo), { ok: true, acao: 'ignorado' });
  assert.equal(a.planilha().length, 1);
});

test('o log do webhook mostra só a forma do JSON, nunca os dados do cliente', () => {
  const a = ambiente({ respostas: [brevoOk()] });
  const logs = [];
  const original = console.log;
  console.log = (...x) => logs.push(x.join(' '));
  try { a.webhook(APROVADO); } finally { console.log = original; }
  const tudo = logs.join('\n');
  assert.match(tudo, /Customer/);
  assert.doesNotMatch(tudo, /Cliente Teste|example\.com|5500000000000/i);
});

// ---------- Entrada por código ----------

function codigoDoEmail(a, i) {
  const msg = JSON.parse(a.stubs.chamadas.opcoes[i].payload);
  return /(\d{6})/.exec(msg.subject)[1];
}

function clienteAtivo(extra) {
  return Object.assign({ clientes: [['email', 'nome', 'ativo'], [EMAIL, 'Cliente', 'sim']] }, extra);
}

test('pedir código: só para quem comprou; o e-mail leva 6 dígitos e o cache guarda só o hash', () => {
  let a = ambiente();
  assert.deepEqual(a.chamar({ action: 'codigo', email: 'ninguem@example.com' }), { ok: false, erro: 'sem_compra' });
  assert.deepEqual(a.chamar({ action: 'codigo', email: 'invalido' }), { ok: false, erro: 'email' });

  a = ambiente(clienteAtivo({ respostas: [brevoOk()] }));
  assert.deepEqual(a.chamar({ action: 'codigo', email: '  Cliente.Teste@Example.com ' }), { ok: true });
  const codigo = codigoDoEmail(a, 0);
  assert.match(codigo, /^\d{6}$/);
  const cacheTexto = JSON.stringify([...a.stubs.chamadas.cachePut]);
  assert.ok(a.stubs.chamadas.cachePut.some((p) => p.ttl === 600));
  assert.doesNotMatch(cacheTexto, new RegExp(codigo));
});

test('entrar com o código certo cria a sessão (e o código não serve de novo)', () => {
  const a = ambiente(clienteAtivo({ respostas: [brevoOk()] }));
  a.chamar({ action: 'codigo', email: EMAIL });
  const codigo = codigoDoEmail(a, 0);
  const r = a.chamar({ action: 'entrar', email: 'CLIENTE.TESTE@example.com', codigo: codigo });
  assert.equal(r.ok, true);
  assert.equal(r.nome, 'Cliente');
  assert.equal(a.ctx.emailDaSessao_(r.sessao), EMAIL);
  assert.deepEqual(a.chamar({ action: 'entrar', email: EMAIL, codigo: codigo }), { ok: false, erro: 'codigo_expirado' });
});

test('código errado: avisa quantas tentativas restam e bloqueia na 5ª', () => {
  const a = ambiente(clienteAtivo({ respostas: [brevoOk()] }));
  a.chamar({ action: 'codigo', email: EMAIL });
  const certo = codigoDoEmail(a, 0);
  const errado = certo === '000000' ? '111111' : '000000';
  for (let i = 1; i <= 4; i++) {
    assert.deepEqual(a.chamar({ action: 'entrar', email: EMAIL, codigo: errado }), { ok: false, erro: 'codigo_errado', restantes: 5 - i });
  }
  assert.deepEqual(a.chamar({ action: 'entrar', email: EMAIL, codigo: errado }), { ok: false, erro: 'codigo_bloqueado' });
  assert.deepEqual(a.chamar({ action: 'entrar', email: EMAIL, codigo: certo }), { ok: false, erro: 'codigo_expirado' });
});

test('código vale 10 minutos', () => {
  const a = ambiente(clienteAtivo({ respostas: [brevoOk()] }));
  let agora = 1_000_000;
  a.ctx.agora_ = () => agora;
  a.chamar({ action: 'codigo', email: EMAIL });
  const codigo = codigoDoEmail(a, 0);
  agora += 10 * 60 * 1000 + 1;
  assert.deepEqual(a.chamar({ action: 'entrar', email: EMAIL, codigo: codigo }), { ok: false, erro: 'codigo_expirado' });
});

test('limites: 1 código por minuto e 5 por hora', () => {
  const respostas = [];
  for (let i = 0; i < 6; i++) respostas.push(brevoOk());
  const a = ambiente(clienteAtivo({ respostas }));
  assert.deepEqual(a.chamar({ action: 'codigo', email: EMAIL }), { ok: true });
  assert.deepEqual(a.chamar({ action: 'codigo', email: EMAIL }), { ok: false, erro: 'espere' });
  for (let i = 0; i < 4; i++) {
    a.stubs.CacheService.getScriptCache().remove(a.ctx.chaveCodigo_('cm', EMAIL));
    assert.deepEqual(a.chamar({ action: 'codigo', email: EMAIL }), { ok: true });
  }
  a.stubs.CacheService.getScriptCache().remove(a.ctx.chaveCodigo_('cm', EMAIL));
  assert.deepEqual(a.chamar({ action: 'codigo', email: EMAIL }), { ok: false, erro: 'limite_codigo' });
  assert.equal(a.stubs.chamadas.fetch, 5);
});

test('falha no Brevo devolve email_envio e não deixa código válido', () => {
  const a = ambiente(clienteAtivo({ respostas: [{ code: 401, body: '{"code":"unauthorized"}' }] }));
  assert.deepEqual(a.chamar({ action: 'codigo', email: EMAIL }), { ok: false, erro: 'email_envio' });
  assert.equal(a.stubs.CacheService.getScriptCache().get(a.ctx.chaveCodigo_('cod', EMAIL)), null);
});

test('sem BREVO_API_KEY não tenta enviar', () => {
  const a = ambiente(clienteAtivo({ props: { BREVO_API_KEY: null } }));
  assert.deepEqual(a.chamar({ action: 'codigo', email: EMAIL }), { ok: false, erro: 'email_envio' });
  assert.equal(a.stubs.chamadas.fetch, 0);
});

test('cliente desativado entre o código e a entrada não entra', () => {
  const a = ambiente(clienteAtivo({ respostas: [brevoOk()] }));
  a.chamar({ action: 'codigo', email: EMAIL });
  const codigo = codigoDoEmail(a, 0);
  a.ctx.SpreadsheetApp.openById('pid').getSheetByName('Clientes').getRange(2, 3).setValue('não');
  assert.deepEqual(a.chamar({ action: 'entrar', email: EMAIL, codigo: codigo }), { ok: false, erro: 'sem_compra' });
});
