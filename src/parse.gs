// Funções puras de extração e validação. Sem dependência de serviços do Apps Script.

var HOSTS_PRODUTO_ = ['mercadolivre.com.br', 'produto.mercadolivre.com.br', 'mercadolivre.com', 'mercadolibre.com', 'meli.la'];
var HOSTS_IMAGEM_ = ['mlstatic.com'];

function hostDe_(url) {
  var m = /^https:\/\/([^\/:?#@]+)(?::\d+)?(?:[\/?#]|$)/i.exec(String(url || ''));
  return m ? m[1].toLowerCase() : null;
}

function hostNaLista_(url, lista) {
  var host = hostDe_(url);
  if (!host) return false;
  for (var i = 0; i < lista.length; i++) {
    if (host === lista[i] || host.slice(-(lista[i].length + 1)) === '.' + lista[i]) return true;
  }
  return false;
}

function hostProdutoPermitido(url) {
  return hostNaLista_(url, HOSTS_PRODUTO_);
}

function hostImagemPermitido(url) {
  return hostNaLista_(url, HOSTS_IMAGEM_);
}

function decodificarEntidades_(s) {
  var nomes = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, function (m, e) {
    if (e.charAt(0) === '#') {
      var cod = e.charAt(1).toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return isNaN(cod) ? m : String.fromCodePoint(cod);
    }
    var v = nomes[e.toLowerCase()];
    return v === undefined ? m : v;
  });
}

function metaContent_(html, attr, valor) {
  var tags = html.match(/<meta\b[^>]*>/gi) || [];
  var chave = new RegExp('\\b' + attr + '\\s*=\\s*["\']' + valor + '["\']', 'i');
  for (var i = 0; i < tags.length; i++) {
    if (chave.test(tags[i])) {
      var c = /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tags[i]);
      if (c) return c[1] !== undefined ? c[1] : c[2];
    }
  }
  return null;
}

function paraNumero_(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = Number(v);
  return isFinite(n) ? n : null;
}

function ehProduct_(item) {
  var t = item && item['@type'];
  return t === 'Product' || (Array.isArray(t) && t.indexOf('Product') !== -1);
}

function precoJsonLd_(html) {
  var re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  var m;
  while ((m = re.exec(html))) {
    var dados;
    try { dados = JSON.parse(m[1]); } catch (e) { continue; }
    var itens = Array.isArray(dados) ? dados.slice() : [dados];
    for (var i = 0; i < itens.length; i++) {
      if (itens[i] && Array.isArray(itens[i]['@graph'])) itens = itens.concat(itens[i]['@graph']);
    }
    for (var j = 0; j < itens.length; j++) {
      if (!ehProduct_(itens[j])) continue;
      var ofertas = itens[j].offers;
      var oferta = Array.isArray(ofertas) ? ofertas[0] : ofertas;
      var preco = oferta ? paraNumero_(oferta.price) : null;
      if (preco !== null) return preco;
    }
  }
  return null;
}

// O preço antigo do produto fica no bloco principal de preço (classe ui-pdp-price*).
// Sem esse marcador na página, cai no primeiro preço antigo encontrado.
function precoAntigo_(html) {
  var escopo = html;
  var marca = /class\s*=\s*["'][^"']*ui-pdp-price/i.exec(html);
  if (marca) escopo = html.substr(marca.index, 3000);
  var tag = /<[^>]*andes-money-amount--previous[^>]*>/i.exec(escopo);
  if (!tag) return null;
  var rotulo = /aria-label\s*=\s*["']([^"']*)["']/i.exec(tag[0]);
  if (!rotulo) return null;
  var v = /(\d[\d.]*)\s+reais(?:\s+com\s+(\d+)\s+centavos?)?/i.exec(rotulo[1]);
  if (!v) return null;
  var reais = Number(v[1].replace(/\./g, ''));
  var centavos = v[2] ? Number(v[2]) : 0;
  return isFinite(reais) ? reais + centavos / 100 : null;
}

// '1.554,90' -> 1554.9; '64,99' -> 64.99; '359' -> 359
function valorBR_(s) {
  var n = Number(String(s).replace(/\./g, '').replace(',', '.'));
  return isFinite(n) && n > 0 ? n : null;
}

function parseProduto(html) {
  html = String(html || '');
  var titulo = metaContent_(html, 'property', 'og:title');
  var precoTitulo = null;
  if (titulo !== null) {
    titulo = decodificarEntidades_(titulo).replace(/\s*\|\s*Mercado\s?Livre\s*$/i, '');
    // O ML põe o preço atual no fim do og:title. Na página "social" do afiliado é o único lugar com ele.
    var sufixo = /\s+-\s+R\$\s*(\d[\d.]*(?:,\d{1,2})?)\s*$/.exec(titulo);
    if (sufixo) {
      precoTitulo = valorBR_(sufixo[1]);
      titulo = titulo.slice(0, sufixo.index);
    }
    titulo = titulo.trim();
    if (titulo === '') titulo = null;
  }
  var imagem = metaContent_(html, 'property', 'og:image');
  var preco = precoJsonLd_(html);
  if (preco === null) preco = paraNumero_(metaContent_(html, 'itemprop', 'price'));
  if (preco === null) preco = precoTitulo;
  return { titulo: titulo, preco: preco, precoAntigo: precoAntigo_(html), imagem: imagem };
}
