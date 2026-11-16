// Venda pela Kiwify (webhook) e entrada por código enviado por e-mail (Brevo).
// Propriedades do script: KIWIFY_TOKEN (token do webhook) e BREVO_API_KEY. Nunca no código.
// Depende de acesso.gs (planilha, sessões) e shopee.gs (sha256Hex_).

var BREVO_API_ = 'https://api.brevo.com/v3/smtp/email';
var REMETENTE_ = { name: 'Gerador de Post', email: 'nao-responda@geradordepost.app.br' };
var SITE_ = 'https://geradordepost.app.br';
var CODIGO_VALIDADE_MS_ = 10 * 60 * 1000;
var CODIGO_TENTATIVAS_ = 5;
var CODIGO_POR_HORA_ = 5;
var CABECALHO_CLIENTES_ = ['email', 'nome', 'ativo', 'pedido', 'data', 'origem'];

function agora_() {
  return Date.now();
}

function propriedade_(nome) {
  return PropertiesService.getScriptProperties().getProperty(nome);
}

function hexDe_(bytes) {
  return bytes.map(function (b) {
    return ((b < 0 ? b + 256 : b)).toString(16).padStart(2, '0');
  }).join('');
}

function normalizarEmail_(email) {
  return String(email || '').trim().toLowerCase();
}

function escaparHtml_(s) {
  return String(s || '').replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// ---------------- Webhook da Kiwify ----------------

// Confere a assinatura do aviso: HMAC-SHA1 (hex) do corpo com o token do webhook. Aceita também o corpo
// em JSON compacto e HMAC-SHA256, e ignora espaços no token. Devolve o nome da variação que conferiu, ou ''.
function conferirAssinaturaKiwify_(corpo, assinatura) {
  var token = String(propriedade_('KIWIFY_TOKEN') || '').trim();
  var recebido = String(assinatura || '').trim().toLowerCase();
  if (!token || !recebido) return '';
  var compacto = null;
  try { compacto = JSON.stringify(JSON.parse(corpo)); } catch (err) {}
  var utf8 = Utilities.Charset.UTF_8;
  var variacoes = [
    ['sha1_bruto_utf8', Utilities.MacAlgorithm.HMAC_SHA_1, corpo, utf8],
    ['sha1_compacto_utf8', Utilities.MacAlgorithm.HMAC_SHA_1, compacto, utf8],
    ['sha1_bruto', Utilities.MacAlgorithm.HMAC_SHA_1, corpo, null],
    ['sha1_compacto', Utilities.MacAlgorithm.HMAC_SHA_1, compacto, null],
    ['sha256_bruto_utf8', Utilities.MacAlgorithm.HMAC_SHA_256, corpo, utf8],
    ['sha256_compacto_utf8', Utilities.MacAlgorithm.HMAC_SHA_256, compacto, utf8]
  ];
  for (var i = 0; i < variacoes.length; i++) {
    var v = variacoes[i];
    if (v[2] === null) continue;
    var bytes = v[3] ? Utilities.computeHmacSignature(v[1], v[2], token, v[3]) : Utilities.computeHmacSignature(v[1], v[2], token);
    if (iguaisSemPressa_(hexDe_(bytes), recebido)) return v[0];
  }
  return '';
}

function assinaturaKiwifyValida_(corpo, assinatura) {
  return conferirAssinaturaKiwify_(corpo, assinatura) !== '';
}

function iguaisSemPressa_(a, b) {
  if (a.length !== b.length) return false;
  var diferenca = 0;
  for (var i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

// Só a forma do JSON (chaves e tipos), para conferir o formato real sem registrar dados pessoais.
function formatoDe_(v) {
  if (Array.isArray(v)) return v.length ? [formatoDe_(v[0])] : [];
  if (v && typeof v === 'object') {
    var out = {};
    for (var k in v) out[k] = formatoDe_(v[k]);
    return out;
  }
  return v === null ? 'null' : typeof v;
}

// Campos conferidos com o aviso de teste real da Kiwify (2026-11-16).
function lerPedidoKiwify_(dados) {
  var c = dados.Customer || dados.customer || {};
  var nome = c.full_name || c.name || [c.first_name, c.last_name].filter(Boolean).join(' ');
  var status = String(dados.order_status || '').toLowerCase();
  var evento = String(dados.webhook_event_type || '').toLowerCase();
  var tipo = 'outro';
  if (status === 'refunded' || status === 'chargedback' || evento === 'order_refunded' || evento === 'chargeback') {
    tipo = 'cancelado';
  } else if (status === 'paid' || evento === 'order_approved') {
    tipo = 'aprovado';
  }
  return {
    tipo: tipo,
    email: normalizarEmail_(c.email),
    nome: String(nome || '').trim(),
    pedido: String(dados.order_id || dados.order_ref || '')
  };
}

// Guarda um resumo do último aviso (sem nome, e-mail ou outros dados pessoais) para conferir no editor
// com mostrarUltimoAvisoKiwify(): os registros de execuções do web app nem sempre aparecem no painel.
function registrarAvisoKiwify_(info, dados) {
  try {
    var resumo = {
      quando: new Date().toISOString(),
      assinatura: info.assinatura,
      resultado: info.resultado,
      conferiu: info.detalhes ? info.detalhes.conferiu : undefined,
      assinaturaRecebida: info.detalhes ? info.detalhes.assinaturaRecebida : undefined,
      token: info.detalhes ? info.detalhes.token : undefined,
      corpo: info.detalhes ? info.detalhes.corpo : undefined,
      evento: dados ? String(dados.webhook_event_type || '') : '',
      status: dados ? String(dados.order_status || '') : '',
      formato: dados ? formatoDe_(dados) : null
    };
    PropertiesService.getScriptProperties().setProperty('kiwify:ultimo', JSON.stringify(resumo).slice(0, 8000));
  } catch (err) {
    console.warn('Kiwify: não consegui guardar o resumo: ' + err);
  }
}

function lerJson_(texto) {
  try {
    var v = JSON.parse(texto);
    return v && typeof v === 'object' ? v : null;
  } catch (err) {
    return null;
  }
}

function pareceAvisoKiwify_(dados) {
  return !!(dados && !dados.action && (dados.webhook_event_type || dados.order_status || dados.Customer));
}

function kiwifyWebhook_(e) {
  var corpo = (e.postData && e.postData.contents) || '';
  var dados = lerJson_(corpo);
  var assinatura = e.parameter && e.parameter.signature;
  var conferiu = conferirAssinaturaKiwify_(corpo, assinatura);
  var token = String(propriedade_('KIWIFY_TOKEN') || '');
  var detalhes = {
    conferiu: conferiu || 'nenhuma',
    assinaturaRecebida: { tamanho: String(assinatura || '').length, hex: /^[0-9a-f]+$/i.test(String(assinatura || '').trim()) },
    token: { tamanho: token.trim().length, espacoSobrando: token !== token.trim() },
    corpo: { tamanho: corpo.length, temAcento: /[^\x00-\x7f]/.test(corpo), temEscapeUnicode: /\\u[0-9a-fA-F]{4}/.test(corpo), temQuebraDeLinha: /\n/.test(corpo) }
  };
  if (!conferiu) {
    var motivo = !token.trim() ? 'sem_token' : (!assinatura ? 'sem_assinatura' : 'falhou');
    console.warn('Kiwify: assinatura inválida (' + motivo + ')');
    registrarAvisoKiwify_({ assinatura: motivo, resultado: 'assinatura', detalhes: detalhes }, dados);
    return { ok: false, erro: 'assinatura' };
  }
  if (!dados) {
    registrarAvisoKiwify_({ assinatura: 'ok', resultado: 'formato', detalhes: detalhes }, null);
    return { ok: false, erro: 'formato' };
  }
  console.log('Kiwify (formato do aviso): ' + JSON.stringify(formatoDe_(dados)));

  var r = processarAvisoKiwify_(dados);
  registrarAvisoKiwify_({ assinatura: 'ok', resultado: r.acao || r.erro, detalhes: detalhes }, dados);
  return r;
}

function processarAvisoKiwify_(dados) {
  var p = lerPedidoKiwify_(dados);
  if (p.tipo === 'outro') return { ok: true, acao: 'ignorado' };
  if (!p.email) return { ok: false, erro: 'formato' };

  if (p.tipo === 'aprovado') {
    var novo = ativarCliente_(p);
    if (!novo) return { ok: true, acao: 'ja_ativo' };
    enviarBoasVindas_(p.email, p.nome);
    return { ok: true, acao: 'ativado' };
  }
  desativarCliente_(p.email);
  encerrarSessoesDoEmail_(p.email);
  return { ok: true, acao: 'desativado' };
}

// Para rodar no editor: mostra o resumo do último aviso da Kiwify que chegou ao servidor.
function mostrarUltimoAvisoKiwify() {
  console.log(propriedade_('kiwify:ultimo') || 'Nenhum aviso da Kiwify chegou ainda.');
}

// ---------------- Planilha ----------------

function abaClientes_() {
  return SpreadsheetApp.openById(propriedade_('PLANILHA_ID')).getSheetByName('Clientes');
}

// Devolve true se o acesso foi (re)ativado agora; false se esse pedido já estava ativo (aviso repetido).
function ativarCliente_(p) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var aba = abaClientes_();
    var linhas = aba.getDataRange().getValues();
    if (!linhas[0] || !linhas[0][3]) aba.getRange(1, 1, 1, CABECALHO_CLIENTES_.length).setValues([CABECALHO_CLIENTES_]);
    var data = new Date().toISOString();
    for (var i = 1; i < linhas.length; i++) {
      if (normalizarEmail_(linhas[i][0]) !== p.email) continue;
      if (ativoVerdadeiro_(linhas[i][2]) && String(linhas[i][3] || '') === p.pedido) return false;
      var nome = String(linhas[i][1] || '').trim() || p.nome;
      aba.getRange(i + 1, 2, 1, 5).setValues([[nome, 'sim', p.pedido, data, 'kiwify']]);
      return true;
    }
    aba.appendRow([p.email, p.nome, 'sim', p.pedido, data, 'kiwify']);
    return true;
  } finally {
    lock.releaseLock();
  }
}

function desativarCliente_(email) {
  var aba = abaClientes_();
  var linhas = aba.getDataRange().getValues();
  for (var i = 1; i < linhas.length; i++) {
    if (normalizarEmail_(linhas[i][0]) === email) aba.getRange(i + 1, 3).setValue('não');
  }
}

// ---------------- E-mail (Brevo) ----------------

function enviarEmail_(para, nome, assunto, html, texto) {
  var chave = propriedade_('BREVO_API_KEY');
  if (!chave) {
    console.warn('Brevo: falta BREVO_API_KEY nas propriedades do script');
    return false;
  }
  var resp;
  try {
    resp = UrlFetchApp.fetch(BREVO_API_, {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      headers: { 'api-key': chave, accept: 'application/json' },
      payload: JSON.stringify({
        sender: REMETENTE_,
        to: [{ email: para, name: nome || para }],
        subject: assunto,
        htmlContent: html,
        textContent: texto
      })
    });
  } catch (err) {
    console.warn('Brevo: falha de rede: ' + err);
    return false;
  }
  var code = resp.getResponseCode();
  if (code < 200 || code >= 300) {
    console.warn('Brevo: HTTP ' + code + ' ' + resp.getContentText().slice(0, 200));
    return false;
  }
  return true;
}

function moldeEmail_(titulo, corpoHtml) {
  return '<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#222">' +
    '<div style="background:#ffd000;border-radius:12px 12px 0 0;padding:18px;text-align:center;font-size:20px;font-weight:bold">Gerador de Post</div>' +
    '<div style="background:#fff;border:1px solid #eee;border-top:0;border-radius:0 0 12px 12px;padding:22px">' +
    '<h2 style="margin:0 0 12px;font-size:18px">' + titulo + '</h2>' + corpoHtml + '</div>' +
    '<p style="font-size:12px;color:#888;text-align:center">E-mail automático, não responda. ' +
    '<a href="' + SITE_ + '/termos" style="color:#888">Termos</a> · <a href="' + SITE_ + '/privacidade" style="color:#888">Privacidade</a></p></div>';
}

function enviarBoasVindas_(email, nome) {
  var ola = nome ? 'Olá, ' + escaparHtml_(nome.split(' ')[0]) + '!' : 'Olá!';
  var html = moldeEmail_('Seu Gerador de Post está liberado 🎉',
    '<p>' + ola + ' Sua compra foi aprovada e o seu acesso já está ativo.</p>' +
    '<p style="text-align:center;margin:22px 0"><a href="' + SITE_ + '" style="background:#ffd000;color:#222;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px;display:inline-block">Abrir o Gerador de Post</a></p>' +
    '<p>Para entrar, digite <strong>este e-mail</strong> (' + escaparHtml_(email) + ') e toque em <strong>Receber código</strong>. Se preferir, também dá para entrar com o Google.</p>');
  var texto = (nome ? 'Olá, ' + nome.split(' ')[0] + '! ' : 'Olá! ') +
    'Sua compra foi aprovada e o seu acesso ao Gerador de Post já está ativo.\n\n' +
    'Acesse: ' + SITE_ + '\nPara entrar, digite este e-mail (' + email + ') e toque em "Receber código".';
  return enviarEmail_(email, nome, 'Seu Gerador de Post está liberado', html, texto);
}

// ---------------- Entrada por código ----------------

function chaveCodigo_(prefixo, email) {
  return prefixo + ':' + sha256Hex_(normalizarEmail_(email)).slice(0, 32);
}

function gerarCodigo_() {
  var n = parseInt(sha256Hex_(Utilities.getUuid() + ':' + agora_() + ':' + Math.random()).slice(0, 12), 16) % 1000000;
  return String(n).padStart(6, '0');
}

function pedirCodigo_(emailBruto) {
  var email = normalizarEmail_(emailBruto);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, erro: 'email' };
  var cliente = buscarCliente_(email);
  if (!cliente || !cliente.ativo) return { ok: false, erro: 'sem_compra' };

  var cache = CacheService.getScriptCache();
  if (cache.get(chaveCodigo_('cm', email))) return { ok: false, erro: 'espere' };
  var naHora = Number(cache.get(chaveCodigo_('ch', email)) || 0);
  if (naHora >= CODIGO_POR_HORA_) return { ok: false, erro: 'limite_codigo' };

  var codigo = gerarCodigo_();
  var html = moldeEmail_('Seu código de acesso',
    '<p>Use este código para entrar no Gerador de Post:</p>' +
    '<p style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;margin:18px 0">' + codigo + '</p>' +
    '<p>Ele vale por <strong>10 minutos</strong>. Se não foi você que pediu, pode ignorar este e-mail.</p>');
  var texto = 'Seu código de acesso ao Gerador de Post: ' + codigo + '\nEle vale por 10 minutos. Se não foi você que pediu, ignore este e-mail.';
  if (!enviarEmail_(email, cliente.nome, 'Seu código de acesso: ' + codigo, html, texto)) {
    return { ok: false, erro: 'email_envio' };
  }

  cache.put(chaveCodigo_('cod', email), JSON.stringify({ h: sha256Hex_(email + ':' + codigo), t: 0, criado: agora_() }), 600);
  cache.put(chaveCodigo_('cm', email), '1', 60);
  cache.put(chaveCodigo_('ch', email), String(naHora + 1), 3600);
  return { ok: true };
}

function entrarComCodigo_(emailBruto, codigoBruto) {
  var email = normalizarEmail_(emailBruto);
  var codigo = String(codigoBruto || '').replace(/\D/g, '');
  var cache = CacheService.getScriptCache();
  var chave = chaveCodigo_('cod', email);
  var bruto = cache.get(chave);
  if (!bruto) return { ok: false, erro: 'codigo_expirado' };

  var reg;
  try {
    reg = JSON.parse(bruto);
  } catch (err) {
    cache.remove(chave);
    return { ok: false, erro: 'codigo_expirado' };
  }
  if (agora_() - reg.criado > CODIGO_VALIDADE_MS_) {
    cache.remove(chave);
    return { ok: false, erro: 'codigo_expirado' };
  }
  if (sha256Hex_(email + ':' + codigo) !== reg.h) {
    reg.t = (reg.t || 0) + 1;
    if (reg.t >= CODIGO_TENTATIVAS_) {
      cache.remove(chave);
      return { ok: false, erro: 'codigo_bloqueado' };
    }
    cache.put(chave, JSON.stringify(reg), 600);
    return { ok: false, erro: 'codigo_errado', restantes: CODIGO_TENTATIVAS_ - reg.t };
  }

  cache.remove(chave);
  var cliente = buscarCliente_(email);
  if (!cliente || !cliente.ativo) return { ok: false, erro: 'sem_compra' };
  var sessao = criarSessao_(email);
  return { ok: true, sessao: sessao, nome: cliente.nome, email: email };
}

// Para rodar no editor: manda um e-mail de teste para o dono do script e mostra se o Brevo aceitou.
function testarBrevo() {
  var para = Session.getEffectiveUser().getEmail();
  console.log('Brevo aceitou: ' + enviarEmail_(para, '', 'Teste do Gerador de Post',
    moldeEmail_('Teste de envio', '<p>Se você recebeu este e-mail, o Brevo está funcionando.</p>'),
    'Se você recebeu este e-mail, o Brevo está funcionando.'));
}
