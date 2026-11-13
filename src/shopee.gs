// Links da Shopee pela Affiliate Open API (GraphQL), com a credencial do vendedor.
// Depende de src/parse.gs e das propriedades do script SHOPEE_APP_ID e SHOPEE_SECRET.
// Nunca gera links de afiliado: a legenda usa sempre o link que o cliente colou.

var SHOPEE_API_ = 'https://open-api.affiliate.shopee.com.br/graphql';
var COTA_SHOPEE_DIA_ = 100;
var TTL_CACHE_SHOPEE_ = 3600;
var SALTOS_SHOPEE_ = 5;

function sha256Hex_(texto) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto, Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    return ((b < 0 ? b + 256 : b)).toString(16).padStart(2, '0');
  }).join('');
}

function localizacao_(resp) {
  var h = resp.getHeaders();
  for (var k in h) {
    if (k.toLowerCase() === 'location') return h[k];
  }
  return null;
}

// Segue o link curto só até o endereço trazer os IDs do produto; a página da Shopee não é baixada.
function resolverIdsShopee_(url) {
  var atual = url;
  for (var salto = 0; salto <= SALTOS_SHOPEE_; salto++) {
    if (!hostShopee(atual)) return { erro: 'host' };
    var ids = idsShopee(atual);
    if (ids) return { ids: ids, urlFinal: atual };
    var resp;
    try {
      resp = UrlFetchApp.fetch(atual, {
        followRedirects: false,
        muteHttpExceptions: true,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
    } catch (err) {
      return { erro: 'rede' };
    }
    var code = resp.getResponseCode();
    if (code < 300 || code >= 400) return { erro: 'link_curto' };
    var destino = localizacao_(resp);
    if (!destino) return { erro: 'link_curto' };
    atual = destino.charAt(0) === '/' ? 'https://' + hostDe_(atual) + destino : destino;
  }
  return { erro: 'link_curto' };
}

// Consulta productOfferV2. Assinatura: sha256(appId + timestamp + corpo + secret), em hex.
function consultarShopee_(ids) {
  var props = PropertiesService.getScriptProperties();
  var appId = props.getProperty('SHOPEE_APP_ID');
  var secret = props.getProperty('SHOPEE_SECRET');
  if (!appId || !secret) {
    console.warn('Shopee: faltam SHOPEE_APP_ID/SHOPEE_SECRET nas propriedades do script');
    return { erro: 'shopee' };
  }

  // ids vêm de idsShopee: só dígitos, seguros para entrar na consulta.
  var corpo = JSON.stringify({
    query: '{ productOfferV2(itemId: ' + ids.itemId + ', shopId: ' + ids.shopId + ', limit: 1) ' +
      '{ nodes { productName imageUrl priceMin priceMax priceDiscountRate } } }'
  });
  var ts = String(Math.floor(Date.now() / 1000));
  var assinatura = sha256Hex_(appId + ts + corpo + secret);

  var resp;
  try {
    resp = UrlFetchApp.fetch(SHOPEE_API_, {
      method: 'post',
      contentType: 'application/json',
      payload: corpo,
      muteHttpExceptions: true,
      headers: { Authorization: 'SHA256 Credential=' + appId + ', Timestamp=' + ts + ', Signature=' + assinatura }
    });
  } catch (err) {
    console.warn('Shopee: falha de rede: ' + err);
    return { erro: 'shopee' };
  }

  var json;
  try {
    json = JSON.parse(resp.getContentText());
  } catch (err) {
    console.warn('Shopee: HTTP ' + resp.getResponseCode() + ' sem JSON');
    return { erro: 'shopee' };
  }
  if (json && json.errors && json.errors.length) {
    var e = json.errors[0] || {};
    var codigo = Number(e.extensions && e.extensions.code);
    console.warn('Shopee: erro ' + codigo + ' ' + e.message);
    return { erro: codigo === 10030 ? 'cota' : 'shopee' };
  }
  var nodes = json && json.data && json.data.productOfferV2 && json.data.productOfferV2.nodes;
  var node = nodes && nodes[0];
  if (resp.getResponseCode() !== 200) {
    console.warn('Shopee: HTTP ' + resp.getResponseCode());
    return { erro: 'shopee' };
  }
  // Produto que não está nas ofertas de afiliado: a API responde sem nenhum item.
  if (!node) return { erro: 'shopee_produto' };

  var preco = Number(node.priceMin);
  if (!(preco > 0)) preco = null;
  return {
    titulo: node.productName || null,
    preco: preco,
    precoAntigo: precoAntigoPorDesconto(preco, Number(node.priceDiscountRate)),
    imagem: node.imageUrl || null
  };
}

// Até COTA_SHOPEE_DIA_ consultas à API por cliente por dia (protege a credencial do vendedor).
function usarCotaShopee_(email) {
  var cache = CacheService.getScriptCache();
  var dia = new Date().toISOString().slice(0, 10);
  var chave = 'q:' + sha256Hex_(String(email || '').toLowerCase()).slice(0, 32) + ':' + dia;
  var usadas = Number(cache.get(chave) || 0);
  if (usadas >= COTA_SHOPEE_DIA_) return false;
  cache.put(chave, String(usadas + 1), 86400);
  return true;
}

function buscarShopee_(url, email) {
  if (!hostShopee(url)) return { ok: false, erro: 'host' };
  var cache = CacheService.getScriptCache();
  var chave = 's:' + sha256Hex_(url).slice(0, 32);
  var salvo = cache.get(chave);
  if (salvo) return JSON.parse(salvo);

  var r = resolverIdsShopee_(url);
  if (r.erro) return { ok: false, erro: r.erro };
  if (!usarCotaShopee_(email)) return { ok: false, erro: 'cota' };
  var d = consultarShopee_(r.ids);
  if (d.erro) return { ok: false, erro: d.erro };

  var out = {
    ok: true,
    titulo: d.titulo,
    preco: d.preco,
    precoAntigo: d.precoAntigo,
    imagem: d.imagem,
    urlFinal: r.urlFinal
  };
  cache.put(chave, JSON.stringify(out), TTL_CACHE_SHOPEE_);
  return out;
}

// Para rodar no editor do Apps Script e conferir a credencial da Shopee (produto público de exemplo).
function testarShopee() {
  console.log(JSON.stringify(consultarShopee_({ shopId: '669207032', itemId: '49368310877' })));
}

// Troque o texto entre aspas por um link seu da Shopee antes de rodar no editor.
function testarLinkShopee() {
  var link = 'COLE_AQUI_UM_LINK_SEU_DA_SHOPEE';
  console.log(JSON.stringify(buscarShopee_(link, 'teste@teste')));
}
