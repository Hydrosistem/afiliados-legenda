// Web app do Apps Script. Depende de src/parse.gs (mesmo projeto).

var UA_ = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
var MAX_REDIRECIONAMENTOS_ = 5;
var TTL_CACHE_ = 3600;

function resposta_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  var esperado = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!esperado || p.token !== esperado) return resposta_({ ok: false, erro: 'token' });
  if (p.action === 'info') return resposta_(buscarInfo_(p.url));
  if (p.action === 'img') return resposta_(buscarImagem_(p.url));
  return resposta_({ ok: false, erro: 'acao' });
}

function cabecalho_(resp, nome) {
  var h = resp.getHeaders();
  var alvo = nome.toLowerCase();
  for (var k in h) {
    if (k.toLowerCase() === alvo) return h[k];
  }
  return null;
}

function md5Hex_(texto) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, texto);
  return bytes.map(function (b) {
    return ((b < 0 ? b + 256 : b)).toString(16).padStart(2, '0');
  }).join('');
}

// Segue redirecionamentos à mão: o UrlFetchApp não expõe a URL final e cada salto precisa passar pela lista de hosts.
function baixarPagina_(url) {
  var atual = url;
  for (var salto = 0; salto <= MAX_REDIRECIONAMENTOS_; salto++) {
    if (!hostProdutoPermitido(atual)) return { erro: 'host' };
    var resp;
    try {
      resp = UrlFetchApp.fetch(atual, {
        followRedirects: false,
        muteHttpExceptions: true,
        headers: { 'User-Agent': UA_, 'Accept-Language': 'pt-BR,pt;q=0.9' }
      });
    } catch (err) {
      return { erro: 'rede' };
    }
    var code = resp.getResponseCode();
    if (code >= 300 && code < 400) {
      var destino = cabecalho_(resp, 'Location');
      if (!destino) return { erro: 'rede' };
      atual = destino.charAt(0) === '/' ? 'https://' + hostDe_(atual) + destino : destino;
      continue;
    }
    if (code < 200 || code >= 300) return { erro: 'rede' };
    return { resp: resp, urlFinal: atual };
  }
  return { erro: 'rede' };
}

function buscarInfo_(url) {
  if (!hostProdutoPermitido(url)) return { ok: false, erro: 'host' };
  var cache = CacheService.getScriptCache();
  var chave = 'i:' + md5Hex_(url);
  var salvo = cache.get(chave);
  if (salvo) return JSON.parse(salvo);

  var pagina = baixarPagina_(url);
  if (pagina.erro) return { ok: false, erro: pagina.erro };
  var d = parseProduto(pagina.resp.getContentText());
  if (d.titulo === null && d.preco === null) return { ok: false, erro: 'link_curto' };

  var out = {
    ok: true,
    titulo: d.titulo,
    preco: d.preco,
    precoAntigo: d.precoAntigo,
    imagem: d.imagem,
    urlFinal: pagina.urlFinal
  };
  cache.put(chave, JSON.stringify(out), TTL_CACHE_);
  return out;
}

function buscarImagem_(url) {
  if (!hostImagemPermitido(url)) return { ok: false, erro: 'host' };
  var resp;
  try {
    resp = UrlFetchApp.fetch(url, {
      followRedirects: false,
      muteHttpExceptions: true,
      headers: { 'User-Agent': UA_ }
    });
  } catch (err) {
    return { ok: false, erro: 'rede' };
  }
  if (resp.getResponseCode() !== 200) return { ok: false, erro: 'rede' };
  var mime = String(cabecalho_(resp, 'Content-Type') || 'image/jpeg').split(';')[0];
  return { ok: true, base64: Utilities.base64Encode(resp.getContent()), mime: mime };
}
