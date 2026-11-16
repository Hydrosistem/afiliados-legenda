const crypto = require('node:crypto');

// Fakes dos serviços do Apps Script usados por src/Code.gs e src/acesso.gs.
// respostas: fila de {code, headers?, body?, throw?}; cada UrlFetchApp.fetch consome uma.
// clientes: linhas da aba "Clientes" (com cabeçalho) devolvidas por SpreadsheetApp.
function makeStubs({ props = {}, respostas = [], clientes = [['email', 'nome', 'ativo']] } = {}) {
  const propriedades = { ...props };
  const chamadas = { fetch: 0, urls: [], opcoes: [], cachePut: [], planilhaId: null };
  const fila = respostas.slice();
  const cache = new Map();

  const UrlFetchApp = {
    fetch(url, opcoes) {
      chamadas.fetch++;
      chamadas.urls.push(url);
      chamadas.opcoes.push(opcoes);
      const r = fila.shift();
      if (!r) throw new Error('sem resposta simulada');
      if (r.throw) throw new Error(r.throw);
      const corpo = r.body === undefined ? Buffer.alloc(0) : Buffer.from(r.body);
      return {
        getResponseCode: () => r.code,
        getHeaders: () => r.headers || {},
        getContentText: () => corpo.toString('utf8'),
        getContent: () => Array.from(corpo).map((b) => (b > 127 ? b - 256 : b)),
      };
    },
  };

  const CacheService = {
    getScriptCache: () => ({
      get: (k) => (cache.has(k) ? cache.get(k) : null),
      put: (k, v, ttl) => { cache.set(k, v); chamadas.cachePut.push({ k, ttl }); },
      remove: (k) => { cache.delete(k); },
    }),
  };

  const PropertiesService = {
    getScriptProperties: () => ({
      getProperty: (k) => (k in propriedades ? propriedades[k] : null),
      setProperty: (k, v) => { propriedades[k] = v; },
      deleteProperty: (k) => { delete propriedades[k]; },
    }),
  };

  const SpreadsheetApp = {
    openById: (id) => {
      chamadas.planilhaId = id;
      return {
        getSheetByName: () => ({
          getDataRange: () => ({ getValues: () => clientes.map((r) => r.slice()) }),
          appendRow: (linha) => { clientes.push(linha.slice()); },
          getRange: (linha, coluna, nLinhas, nColunas) => ({
            setValue: (v) => {
              while (clientes.length < linha) clientes.push([]);
              clientes[linha - 1][coluna - 1] = v;
            },
            setValues: (vals) => {
              for (let i = 0; i < vals.length; i++) {
                while (clientes.length < linha + i) clientes.push([]);
                for (let j = 0; j < vals[i].length; j++) clientes[linha - 1 + i][coluna - 1 + j] = vals[i][j];
              }
            },
          }),
        }),
      };
    },
  };

  const LockService = {
    getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }),
  };

  const ContentService = {
    MimeType: { JSON: 'JSON' },
    createTextOutput: (s) => ({
      content: s,
      mime: null,
      setMimeType(m) { this.mime = m; return this; },
      getContent() { return this.content; },
    }),
  };

  let uuidSeq = 0;
  const Utilities = {
    DigestAlgorithm: { MD5: 'MD5', SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' },
    MacAlgorithm: { HMAC_SHA_1: 'HMAC_SHA_1', HMAC_SHA_256: 'HMAC_SHA_256' },
    computeHmacSignature: (alg, valor, chave) =>
      Array.from(crypto.createHmac(alg === 'HMAC_SHA_256' ? 'sha256' : 'sha1', String(chave)).update(String(valor), 'utf8').digest())
        .map((b) => (b > 127 ? b - 256 : b)),
    computeDigest: (alg, str) =>
      Array.from(crypto.createHash(alg === 'SHA_256' ? 'sha256' : 'md5').update(String(str), 'utf8').digest())
        .map((b) => (b > 127 ? b - 256 : b)),
    base64Encode: (bytes) => Buffer.from(bytes.map((b) => b & 255)).toString('base64'),
    getUuid: () => { uuidSeq++; return 'uuid-' + uuidSeq; },
  };

  return {
    UrlFetchApp,
    CacheService,
    PropertiesService,
    SpreadsheetApp,
    LockService,
    ContentService,
    Utilities,
    chamadas,
    propriedades,
    clientes,
  };
}

module.exports = { makeStubs };
