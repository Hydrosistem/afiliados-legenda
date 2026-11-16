// Frase com IA inclusa: o servidor chama o Gemini com a chave do vendedor (propriedade GEMINI_KEY),
// com cota diária por cliente (COTA_FRASES_DIA, padrão 50). Quem cola a própria chave em ⚙️ usa o
// Gemini direto do navegador, sem cota e sem passar por aqui.
// Depende de web/frase.js (colado no Apps Script como "frase": montarPromptFrase, lerRespostaFrase,
// MODELO_GEMINI), vendas.gs (propriedade_, chaveCodigo_) e shopee.gs (sha256Hex_).

var COTA_FRASES_PADRAO_ = 50;

function cotaFrasesDia_() {
  var v = Number(propriedade_('COTA_FRASES_DIA'));
  return v > 0 ? Math.floor(v) : COTA_FRASES_PADRAO_;
}

function chaveCotaFrase_(email) {
  return chaveCodigo_('fr', email) + ':' + new Date().toISOString().slice(0, 10);
}

function gerarFraseServidor_(email, tituloBruto) {
  var titulo = String(tituloBruto || '').trim();
  if (!titulo) return { ok: false, erro: 'titulo' };
  var chave = propriedade_('GEMINI_KEY');
  if (!chave) {
    console.warn('IA: falta GEMINI_KEY nas propriedades do script');
    return { ok: false, erro: 'ia_indisponivel' };
  }

  var cache = CacheService.getScriptCache();
  var chaveCota = chaveCotaFrase_(email);
  var limite = cotaFrasesDia_();
  var usadas = Number(cache.get(chaveCota) || 0);
  if (usadas >= limite) return { ok: false, erro: 'cota_frase', limite: limite };

  var resp;
  try {
    resp = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(MODELO_GEMINI) + ':generateContent', {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      headers: { 'x-goog-api-key': chave },
      payload: JSON.stringify({
        contents: [{ parts: [{ text: montarPromptFrase(titulo) }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 1, maxOutputTokens: 300 }
      })
    });
  } catch (err) {
    console.warn('IA: falha de rede: ' + err);
    return { ok: false, erro: 'rede' };
  }

  var code = resp.getResponseCode();
  if (code === 429) return { ok: false, erro: 'limite' };
  if (code === 400 || code === 401 || code === 403) {
    console.warn('IA: o Gemini recusou a chave do vendedor (HTTP ' + code + ')');
    return { ok: false, erro: 'ia_indisponivel' };
  }
  if (code !== 200) {
    console.warn('IA: HTTP ' + code);
    return { ok: false, erro: 'rede' };
  }

  var lido = null;
  try {
    lido = lerRespostaFrase(JSON.parse(resp.getContentText()).candidates[0].content.parts[0].text);
  } catch (err) {
    lido = null;
  }
  if (!lido) return { ok: false, erro: 'formato' };

  cache.put(chaveCota, String(usadas + 1), 86400);
  return { ok: true, frase: lido.frase, emoji: lido.emoji, restantes: limite - usadas - 1 };
}

// Para rodar no editor: confere se a GEMINI_KEY do servidor funciona.
function testarIA() {
  console.log(JSON.stringify(gerarFraseServidor_('teste@teste', 'Fone Bluetooth sem fio')));
}
