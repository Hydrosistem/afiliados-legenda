// Web app do Apps Script. Depende de src/parse.gs, src/acesso.gs e src/shopee.gs (mesmo projeto).

var UA_ = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
var MAX_REDIRECIONAMENTOS_ = 5;
var TTL_CACHE_ = 3600;

function resposta_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return resposta_({ ok: false, erro: 'acao' });
}

// Confere a sessão e, a cada chamada, se o cliente continua ativo na planilha
// (revogação imediata: desativar na planilha encerra o acesso na próxima chamada).
function autenticar_(sessao) {
  var email = emailDaSessao_(sessao);
  if (!email) return { ok: false, erro: 'sessao' };
  var cliente = buscarCliente_(email);
  if (!cliente || !cliente.ativo) {
    encerrarSessao_(sessao);
    return { ok: false, erro: 'sem_acesso' };
  }
  return { ok: true, email: email, cliente: cliente };
}

function login_(idToken) {
  var verificado = verificarIdToken_(idToken);
  if (!verificado.ok) return { ok: false, erro: 'login' };
  var cliente = buscarCliente_(verificado.email);
  if (!cliente || !cliente.ativo) return { ok: false, erro: 'sem_acesso' };
  var sessao = criarSessao_(verificado.email);
  return { ok: true, sessao: sessao, nome: cliente.nome, email: verificado.email };
}

function doPost(e) {
  try {
    var p;
    try {
      p = JSON.parse(e && e.postData && e.postData.contents);
    } catch (err) {
      return resposta_({ ok: false, erro: 'acao' });
    }
    if (!p || typeof p !== 'object') return resposta_({ ok: false, erro: 'acao' });

    if (p.action === 'login') return resposta_(login_(p.idToken));

    if (p.action === 'sair') {
      encerrarSessao_(p.sessao);
      return resposta_({ ok: true });
    }

    if (p.action === 'info' || p.action === 'img') {
      var auth = autenticar_(p.sessao);
      if (!auth.ok) return resposta_(auth);
      return resposta_(p.action === 'info' ? buscarInfo_(p.url, auth.email) : buscarImagem_(p.url));
    }

    return resposta_({ ok: false, erro: 'acao' });
  } catch (err) {
    console.error('doPost: ' + err);
    return resposta_({ ok: false, erro: 'rede' });
  }
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

function buscarInfo_(url, email) {
  if (hostShopee(url)) return buscarShopee_(url, email);
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
