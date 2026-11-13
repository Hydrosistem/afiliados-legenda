// Login com Google e controle de clientes/sessões. Depende das propriedades do script
// GOOGLE_CLIENT_ID (Client ID do OAuth) e PLANILHA_ID (planilha com a aba "Clientes").

var MAX_SESSOES_POR_CLIENTE_ = 2;

// Confere o id_token do Google Identity Services chamando o endpoint tokeninfo.
// Estrito de propósito: decide quem usa um produto pago.
function verificarIdToken_(idToken) {
  if (!idToken) return { ok: false };

  var resp;
  try {
    resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), {
      muteHttpExceptions: true
    });
  } catch (err) {
    return { ok: false };
  }
  if (resp.getResponseCode() !== 200) return { ok: false };

  var info;
  try {
    info = JSON.parse(resp.getContentText());
  } catch (err) {
    return { ok: false };
  }

  var clientId = PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_ID');
  if (!info || info.aud !== clientId) return { ok: false };
  if (info.iss !== 'accounts.google.com' && info.iss !== 'https://accounts.google.com') return { ok: false };
  if (info.email_verified !== 'true' && info.email_verified !== true) return { ok: false };
  if (!info.exp || Number(info.exp) * 1000 <= Date.now()) return { ok: false };
  if (!info.email) return { ok: false };

  return { ok: true, email: String(info.email).toLowerCase() };
}

// Procura o e-mail na aba "Clientes" (email | nome | ativo, linha 1 = cabeçalho).
function buscarCliente_(email) {
  var planilhaId = PropertiesService.getScriptProperties().getProperty('PLANILHA_ID');
  var linhas = SpreadsheetApp.openById(planilhaId).getSheetByName('Clientes').getDataRange().getValues();
  var alvo = String(email).trim().toLowerCase();

  for (var i = 1; i < linhas.length; i++) {
    var linha = linhas[i];
    var linhaEmail = String(linha[0]).trim().toLowerCase();
    if (linhaEmail === alvo) {
      return { nome: linha[1], ativo: ativoVerdadeiro_(linha[2]) };
    }
  }
  return null;
}

function ativoVerdadeiro_(valor) {
  if (valor === true) return true;
  return /^(sim|s|true|1)$/i.test(String(valor).trim());
}

// Sessões ficam nas Propriedades do script: "s:<id>" -> email; "u:<email>" -> JSON com os ids
// do cliente, do mais antigo ao mais novo. No máximo MAX_SESSOES_POR_CLIENTE_ por e-mail.
function criarSessao_(email) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var props = PropertiesService.getScriptProperties();
    var chaveLista = 'u:' + email;
    var ids = listaSessoes_(props, chaveLista);

    var id = Utilities.getUuid();
    ids.push(id);
    while (ids.length > MAX_SESSOES_POR_CLIENTE_) {
      var removido = ids.shift();
      props.deleteProperty('s:' + removido);
    }

    props.setProperty('s:' + id, email);
    props.setProperty(chaveLista, JSON.stringify(ids));
    return id;
  } finally {
    lock.releaseLock();
  }
}

function listaSessoes_(props, chaveLista) {
  var bruto = props.getProperty(chaveLista);
  if (!bruto) return [];
  try {
    var ids = JSON.parse(bruto);
    return Array.isArray(ids) ? ids : [];
  } catch (err) {
    return [];
  }
}

function emailDaSessao_(id) {
  if (!id) return null;
  var email = PropertiesService.getScriptProperties().getProperty('s:' + id);
  return email || null;
}

function encerrarSessao_(id) {
  if (!id) return;
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var props = PropertiesService.getScriptProperties();
    var email = props.getProperty('s:' + id);
    if (!email) return;
    props.deleteProperty('s:' + id);

    var chaveLista = 'u:' + email;
    var ids = listaSessoes_(props, chaveLista).filter(function (x) { return x !== id; });
    if (ids.length) {
      props.setProperty(chaveLista, JSON.stringify(ids));
    } else {
      props.deleteProperty(chaveLista);
    }
  } finally {
    lock.releaseLock();
  }
}

// Para rodar no editor do Apps Script e conferir o próprio acesso.
function testarAcesso() {
  console.log(buscarCliente_(Session.getEffectiveUser().getEmail()));
}
