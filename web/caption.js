// Funções puras de legenda. Em Node exporta via module.exports; no navegador ficam globais.

function formatBRL(n) {
  var partes = Math.abs(n).toFixed(2).split('.');
  var inteiro = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return 'R$ ' + inteiro + ',' + partes[1];
}

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

function calcDesconto(antigo, atual) {
  if (!(antigo > 0) || !(atual > 0) || !(antigo > atual)) return null;
  var pct = Math.round(((antigo - atual) / antigo) * 100);
  return pct > 0 ? pct : null;
}

function linhaPreco_(d) {
  if (!(d.preco > 0)) return '';
  var desc = calcDesconto(d.precoAntigo, d.preco);
  if (desc === null) return '*' + formatBRL(d.preco) + '*';
  return 'De ~' + formatBRL(d.precoAntigo) + '~ por *' + formatBRL(d.preco) + '* (' + desc + '% OFF)';
}

function negrito_(t) {
  return t === '' ? '' : '*' + t + '*';
}

function juntar_(blocos) {
  return blocos.filter(function (b) { return b !== ''; }).join('\n\n');
}

var TEMPLATES = [
  function (d) { return juntar_([(d.titulo === '' ? '🔥' : '🔥 ' + negrito_(d.titulo)), linhaPreco_(d), '👉 ' + d.link]); },
  function (d) { return juntar_(['⚡ OFERTA RELÂMPAGO', negrito_(d.titulo), linhaPreco_(d), '🛒 Compre aqui: ' + d.link]); },
  function (d) { return juntar_(['💥 Achado do dia', d.titulo, linhaPreco_(d), '👇 Link:\n' + d.link]); },
  function (d) { return juntar_(['🛒 Olha esse preço!', [negrito_(d.titulo), linhaPreco_(d)].filter(function (l) { return l !== ''; }).join('\n'), 'Garanta o seu 👉 ' + d.link]); }
];

function montarLegenda(d, idx) {
  var dados = { titulo: encurtarTitulo(d.titulo), preco: d.preco, precoAntigo: d.precoAntigo, link: d.link };
  return TEMPLATES[idx % TEMPLATES.length](dados);
}

if (typeof module !== 'undefined') {
  module.exports = { formatBRL: formatBRL, encurtarTitulo: encurtarTitulo, calcDesconto: calcDesconto, parseValor: parseValor, TEMPLATES: TEMPLATES, montarLegenda: montarLegenda };
}
