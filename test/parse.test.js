const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGs, plain } = require('./helpers/load-gs');

const ctx = loadGs(['src/parse.gs']);
const fx = (n) => fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8');

test('extrai título, preço, preço antigo e imagem com desconto', () => {
  assert.deepEqual(plain(ctx.parseProduto(fx('com-desconto.html'))), {
    titulo: 'Fone Bluetooth X',
    preco: 149.9,
    precoAntigo: 199.9,
    imagem: 'https://http2.mlstatic.com/D_NQ_NP_123-F.webp',
  });
});

test('sem desconto devolve precoAntigo null', () => {
  const r = plain(ctx.parseProduto(fx('sem-desconto.html')));
  assert.equal(r.preco, 149.9);
  assert.equal(r.precoAntigo, null);
});

test('usa itemprop quando não há JSON-LD', () => {
  const r = plain(ctx.parseProduto(fx('so-itemprop.html')));
  assert.equal(r.preco, 1299.9);
  assert.equal(r.titulo, 'Notebook Y');
});

test('decodifica entidades no título', () => {
  const html = '<meta property="og:title" content="Caf&#233; &amp; P&#227;o &quot;Premium&quot; &lt;b&gt;&#39;x&#39;">';
  assert.equal(ctx.parseProduto(html).titulo, 'Café & Pão "Premium" <b>\'x\'');
});

test('html sem dados devolve tudo null', () => {
  assert.deepEqual(plain(ctx.parseProduto('<html></html>')), {
    titulo: null, preco: null, precoAntigo: null, imagem: null,
  });
});

test('preço antigo com milhar e sem centavos', () => {
  const html = '<s class="andes-money-amount--previous" aria-label="Antes: 1.999 reais"></s>';
  assert.equal(ctx.parseProduto(html).precoAntigo, 1999);
});

test('hostProdutoPermitido aceita hosts do ML', () => {
  for (const u of [
    'https://www.mercadolivre.com.br/x',
    'https://produto.mercadolivre.com.br/MLB-1',
    'https://meli.la/abc',
    'https://www.mercadolibre.com/x',
  ]) assert.equal(ctx.hostProdutoPermitido(u), true, u);
});

test('hostProdutoPermitido recusa hosts parecidos e esquemas inválidos', () => {
  for (const u of [
    'https://evilmercadolivre.com.br/',
    'https://mercadolivre.com.br.evil.com/',
    'https://mercadolivre.com.br@evil.com/',
    'http://mercadolivre.com.br/',
    'ftp://meli.la/a',
    'texto qualquer',
    '',
  ]) assert.equal(ctx.hostProdutoPermitido(u), false, u);
});

test('hostImagemPermitido', () => {
  assert.equal(ctx.hostImagemPermitido('https://http2.mlstatic.com/a.jpg'), true);
  assert.equal(ctx.hostImagemPermitido('https://mlstatic.com.evil.com/a.jpg'), false);
  assert.equal(ctx.hostImagemPermitido('http://http2.mlstatic.com/a.jpg'), false);
});

test('hostProdutoPermitido aceita mercadolivre.com (links /sec/) e recusa parecidos', () => {
  assert.equal(ctx.hostProdutoPermitido('https://mercadolivre.com/sec/abc'), true);
  assert.equal(ctx.hostProdutoPermitido('https://www.mercadolivre.com.br/social/lord'), true);
  assert.equal(ctx.hostProdutoPermitido('https://evilmercadolivre.com/sec/abc'), false);
  assert.equal(ctx.hostProdutoPermitido('https://mercadolivre.com.evil.com/sec/abc'), false);
});

const PRINCIPAL_SEM_DESCONTO =
  '<div class="ui-pdp-price ui-pdp-price--size-large"><span class="andes-money-amount--current"></span></div>';
const CARROSSEL =
  '<div class="poly-card"><s class="andes-money-amount--previous" aria-label="Antes: 999 reais"></s></div>';

test('preço antigo ignora carrossel distante quando o bloco principal não tem desconto', () => {
  const miolo = '<p>' + 'x'.repeat(4000) + '</p>';
  assert.equal(ctx.parseProduto(PRINCIPAL_SEM_DESCONTO + miolo + CARROSSEL).precoAntigo, null);
});

test('preço antigo usa o do bloco principal e não o do carrossel', () => {
  const principal =
    '<div class="ui-pdp-price"><s class="andes-money-amount--previous" aria-label="Antes: 199 reais com 90 centavos"></s></div>';
  assert.equal(ctx.parseProduto(principal + CARROSSEL).precoAntigo, 199.9);
});

test('sem marcador do bloco principal usa o primeiro preço antigo da página', () => {
  assert.equal(ctx.parseProduto(CARROSSEL).precoAntigo, 999);
});

test('remove o preço que o ML põe no fim do og:title', () => {
  const t = (c) => ctx.parseProduto(`<meta property="og:title" content="${c}">`).titulo;
  assert.equal(t('Cama Solteiro Ortobello - R$ 359'), 'Cama Solteiro Ortobello');
  assert.equal(t('Celular Samsung A17 - Azul - R$ 1.554'), 'Celular Samsung A17 - Azul');
  assert.equal(t('Kit 4 Blusas - R$ 64,99 | MercadoLivre'), 'Kit 4 Blusas');
  assert.equal(t('Vale R$ 50 em compras'), 'Vale R$ 50 em compras');
});
