const crypto = require('node:crypto');

// Fakes dos serviços do Apps Script usados por src/Code.gs.
// respostas: fila de {code, headers?, body?, throw?}; cada UrlFetchApp.fetch consome uma.
function makeStubs({ token = 'tok', respostas = [] } = {}) {
  const chamadas = { fetch: 0, urls: [], cachePut: [] };
  const fila = respostas.slice();
  const cache = new Map();

  const UrlFetchApp = {
    fetch(url) {
      chamadas.fetch++;
      chamadas.urls.push(url);
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
    }),
  };

  const PropertiesService = {
    getScriptProperties: () => ({ getProperty: (k) => (k === 'TOKEN' ? token : null) }),
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

  const Utilities = {
    DigestAlgorithm: { MD5: 'MD5' },
    computeDigest: (alg, str) =>
      Array.from(crypto.createHash('md5').update(String(str)).digest()).map((b) => (b > 127 ? b - 256 : b)),
    base64Encode: (bytes) => Buffer.from(bytes.map((b) => b & 255)).toString('base64'),
  };

  return { UrlFetchApp, CacheService, PropertiesService, ContentService, Utilities, chamadas };
}

module.exports = { makeStubs };
