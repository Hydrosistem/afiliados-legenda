const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { loadGs, plain } = require('./helpers/load-gs');
const { makeStubs } = require('./helpers/gas-stubs');

const CURTO = 'https://s.shopee.com.br/30pThflgN1';
const PRODUTO = 'https://shopee.com.br/Camera-De-Seguranca-i.1262200225.58167745429?utm_source=an_1';

function ambiente(opts) {
  opts = opts || {};
  const props = opts.semCredencial ? {} : { SHOPEE_APP_ID: 'app123', SHOPEE_SECRET: 'segredo' };
  const stubs = makeStubs({ props: props, respostas: opts.respostas || [] });
  const ctx = loadGs(['src/parse.gs', 'src/shopee.gs'], stubs);
  return { stubs, ctx };
}

const redir = (para) => ({ code: 301, headers: { Location: para } });
const api = (node) => ({ code: 200, body: JSON.stringify({ data: { productOfferV2: { nodes: node ? [node] : [] } } }) });
const NODE = {
  productName: 'Câmera de Segurança Lente Dupla',
  imageUrl: 'https://down-br.img.susercontent.com/file/abc',
  priceMin: '89.9',
  priceMax: '120',
  priceDiscountRate: 55,
};

test('idsShopee lê os dois formatos de endereço', () => {
  const { ctx } = ambiente();
  assert.deepEqual(plain(ctx.idsShopee(PRODUTO)), { shopId: '1262200225', itemId: '58167745429' });
  assert.deepEqual(plain(ctx.idsShopee('https://shopee.com.br/product/12/34')), { shopId: '12', itemId: '34' });
  assert.equal(ctx.idsShopee(CURTO), null);
});

test('hostShopee aceita a Shopee e recusa parecidos', () => {
  const { ctx } = ambiente();
  for (const u of [CURTO, PRODUTO, 'https://shope.ee/abc']) assert.equal(ctx.hostShopee(u), true, u);
  for (const u of ['https://shopee.com.br.evil.com/x', 'https://evilshopee.com.br/x', 'http://shopee.com.br/x', 'https://meli.la/x'])
    assert.equal(ctx.hostShopee(u), false, u);
});

test('precoAntigoPorDesconto estima o preço cheio', () => {
  const { ctx } = ambiente();
  assert.equal(ctx.precoAntigoPorDesconto(89.9, 55), 199.78);
  assert.equal(ctx.precoAntigoPorDesconto(89.9, 0), null);
  assert.equal(ctx.precoAntigoPorDesconto(null, 30), null);
});

test('susercontent.com é imagem permitida', () => {
  const { ctx } = ambiente();
  assert.equal(ctx.hostImagemPermitido('https://down-br.img.susercontent.com/file/abc'), true);
});

test('link curto: segue o redirecionamento e consulta a API com assinatura correta', () => {
  const { ctx, stubs } = ambiente({ respostas: [redir(PRODUTO), api(NODE)] });
  const r = plain(ctx.buscarShopee_(CURTO, 'maria@gmail.com'));
  assert.deepEqual(r, {
    ok: true,
    titulo: 'Câmera de Segurança Lente Dupla',
    preco: 89.9,
    precoAntigo: 199.78,
    imagem: 'https://down-br.img.susercontent.com/file/abc',
    urlFinal: PRODUTO,
  });
  assert.equal(stubs.chamadas.urls[1], 'https://open-api.affiliate.shopee.com.br/graphql');
  const op = stubs.chamadas.opcoes[1];
  assert.equal(op.method, 'post');
  assert.equal(op.contentType, 'application/json');
  const corpo = JSON.parse(op.payload);
  assert.match(corpo.query, /productOfferV2\(itemId: 58167745429, shopId: 1262200225, limit: 1\)/);
  assert.doesNotMatch(op.payload, /generateShortLink/);
  const m = /^SHA256 Credential=app123, Timestamp=(\d+), Signature=([0-9a-f]{64})$/.exec(op.headers.Authorization);
  assert.ok(m, op.headers.Authorization);
  const esperado = crypto.createHash('sha256').update('app123' + m[1] + op.payload + 'segredo').digest('hex');
  assert.equal(m[2], esperado);
});

test('link de produto completo não precisa de redirecionamento', () => {
  const { ctx, stubs } = ambiente({ respostas: [api(NODE)] });
  assert.equal(ctx.buscarShopee_(PRODUTO, 'maria@gmail.com').ok, true);
  assert.equal(stubs.chamadas.fetch, 1);
});

test('sem desconto não há preço antigo', () => {
  const { ctx } = ambiente({ respostas: [api(Object.assign({}, NODE, { priceDiscountRate: 0 }))] });
  assert.equal(ctx.buscarShopee_(PRODUTO, 'maria@gmail.com').precoAntigo, null);
});

test('consulta repetida usa o cache e não gasta cota', () => {
  const { ctx, stubs } = ambiente({ respostas: [api(NODE)] });
  ctx.buscarShopee_(PRODUTO, 'maria@gmail.com');
  const r = ctx.buscarShopee_(PRODUTO, 'maria@gmail.com');
  assert.equal(r.ok, true);
  assert.equal(stubs.chamadas.fetch, 1);
});

test('sem credencial devolve shopee sem chamar a API', () => {
  const { ctx, stubs } = ambiente({ semCredencial: true });
  assert.deepEqual(plain(ctx.buscarShopee_(PRODUTO, 'maria@gmail.com')), { ok: false, erro: 'shopee' });
  assert.equal(stubs.chamadas.fetch, 0);
});

test('erro da API devolve shopee; limite da API (10030) devolve cota', () => {
  const erro = (code) => ({ code: 200, body: JSON.stringify({ errors: [{ message: 'x', extensions: { code: code } }] }) });
  let a = ambiente({ respostas: [erro(10020)] });
  assert.deepEqual(plain(a.ctx.buscarShopee_(PRODUTO, 'maria@gmail.com')), { ok: false, erro: 'shopee' });
  a = ambiente({ respostas: [erro(10030)] });
  assert.deepEqual(plain(a.ctx.buscarShopee_(PRODUTO, 'maria@gmail.com')), { ok: false, erro: 'cota' });
  a = ambiente({ respostas: [{ code: 500, body: 'x' }] });
  assert.deepEqual(plain(a.ctx.buscarShopee_(PRODUTO, 'maria@gmail.com')), { ok: false, erro: 'shopee' });
  a = ambiente({ respostas: [api(null)] });
  assert.deepEqual(plain(a.ctx.buscarShopee_(PRODUTO, 'maria@gmail.com')), { ok: false, erro: 'shopee' });
  a = ambiente({ respostas: [{ throw: 'timeout' }] });
  assert.deepEqual(plain(a.ctx.buscarShopee_(PRODUTO, 'maria@gmail.com')), { ok: false, erro: 'shopee' });
});

test('a 101ª consulta do dia do mesmo cliente devolve cota', () => {
  const respostas = [];
  for (let i = 0; i < 101; i++) respostas.push(api(NODE));
  const { ctx, stubs } = ambiente({ respostas });
  for (let i = 0; i < 100; i++) {
    const r = ctx.buscarShopee_('https://shopee.com.br/p-i.1.' + i, 'maria@gmail.com');
    assert.equal(r.ok, true, 'consulta ' + i);
  }
  assert.deepEqual(plain(ctx.buscarShopee_('https://shopee.com.br/p-i.1.999', 'maria@gmail.com')), { ok: false, erro: 'cota' });
  assert.equal(stubs.chamadas.fetch, 100);
  assert.equal(ctx.buscarShopee_('https://shopee.com.br/p-i.1.999', 'joao@gmail.com').ok, true);
});

test('redirecionamento para fora da Shopee devolve host', () => {
  const { ctx } = ambiente({ respostas: [redir('https://evil.com/x')] });
  assert.deepEqual(plain(ctx.buscarShopee_(CURTO, 'maria@gmail.com')), { ok: false, erro: 'host' });
});

test('link que não chega a um produto devolve link_curto', () => {
  const { ctx } = ambiente({ respostas: [{ code: 200, body: '<html></html>' }] });
  assert.deepEqual(plain(ctx.buscarShopee_(CURTO, 'maria@gmail.com')), { ok: false, erro: 'link_curto' });
});
