const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

// Carrega arquivos .gs num único contexto vm. Funções e `var` de topo viram propriedades do contexto.
function loadGs(files, globals = {}) {
  const ctx = vm.createContext({ ...globals, console });
  for (const f of files) {
    const code = fs.readFileSync(path.resolve(__dirname, '../..', f), 'utf8');
    vm.runInContext(code, ctx, { filename: f });
  }
  return ctx;
}

// Objetos criados dentro do vm têm outro prototype; isto os converte para comparar com deepStrictEqual.
function plain(v) {
  return JSON.parse(JSON.stringify(v));
}

module.exports = { loadGs, plain };
