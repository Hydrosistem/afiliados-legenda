const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8');
const inicio = html.indexOf('<div id="telaLogin"');
const fim = html.indexOf('<main id="app"');
const tela = html.slice(inicio, fim);

test('tela de entrada apresenta o app', () => {
  assert.ok(inicio >= 0 && fim > inicio, 'bloco #telaLogin não encontrado');
  const textos = [
    'Sua legenda de oferta pronta em segundos',
    'Cole o link do produto e receba a legenda pronta para o seu canal do WhatsApp.',
    'Entre com a conta Google usada na compra.',
    'Exemplo',
    'Fone Bluetooth sem fio',
    'R$ 199,90',
    'R$ 89,90',
    'Som potente pra acompanhar o seu dia todo',
    'Cole o link',
    'Gere a legenda',
    'Copie pro WhatsApp',
  ];
  for (const t of textos) assert.ok(tela.includes(t), `falta: ${t}`);
});

test('botão do Google e aviso vêm antes do exemplo', () => {
  const exemplo = tela.indexOf('Fone Bluetooth sem fio');
  assert.ok(exemplo > 0);
  assert.ok(tela.indexOf('id="botaoGoogle"') < exemplo, 'botão depois do exemplo');
  assert.ok(tela.indexOf('id="avisoLogin"') < exemplo, 'aviso depois do exemplo');
});
