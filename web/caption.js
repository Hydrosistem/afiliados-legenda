// Funções puras de legenda. Em Node exporta via module.exports; no navegador ficam globais.

function encurtarTitulo(t, max) {
  max = max || 70;
  t = String(t || '');
  if (t.length <= max) return t;
  var candidato = t.slice(0, max + 1);
  var corte = candidato.lastIndexOf(' ');
  if (corte > 0) return t.slice(0, corte).replace(/\s+$/, '') + '…';
  return t.slice(0, max) + '…';
}

function parseValor(s) {
  if (s === null || s === undefined) return null;
  var t = String(s).replace(/R\$|\s/g, '');
  if (t === '') return null;
  if (t.indexOf(',') !== -1) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  var n = Number(t);
  return isFinite(n) ? n : null;
}

// 183.2 -> 'R$183,20'; 300 -> 'R$300' (sem espaço e sem ,00, como no canal)
function precoCurto(n) {
  var partes = Math.abs(n).toFixed(2).split('.');
  var inteiro = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return 'R$' + inteiro + (partes[1] === '00' ? '' : ',' + partes[1]);
}

function linhaPreco_(d) {
  if (!(d.preco > 0)) return '';
  var por = '💥 *' + precoCurto(d.preco) + '*💥';
  if (d.precoAntigo > d.preco) return 'de ~' + precoCurto(d.precoAntigo) + '~ por ' + por;
  return 'por ' + por;
}

function linhaTitulo_(d) {
  var t = encurtarTitulo(String(d.titulo || '').trim(), 100).toUpperCase();
  if (t === '') return '';
  var e = String(d.emoji || '').trim();
  return '*' + t + '*' + (e === '' ? '' : ' ' + e);
}

function linhaFrase_(d) {
  var f = String(d.frase || '').trim();
  return f === '' ? '' : '💗 _' + f + '_';
}

function montarLegenda(d) {
  return [linhaTitulo_(d), linhaPreco_(d), linhaFrase_(d), '🏠 ' + d.link]
    .filter(function (b) { return b !== ''; })
    .join('\n\n');
}

if (typeof module !== 'undefined') {
  module.exports = { encurtarTitulo: encurtarTitulo, parseValor: parseValor, precoCurto: precoCurto, montarLegenda: montarLegenda };
}
