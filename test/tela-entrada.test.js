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
    'Entre com o e-mail usado na compra.',
    'Receber código',
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

test('exemplo mostra a foto do produto acima da legenda', () => {
  const foto = tela.indexOf('class="foto"');
  assert.ok(foto > 0, 'falta a foto no exemplo');
  assert.ok(foto < tela.indexOf('Fone Bluetooth sem fio'), 'foto depois da legenda');
});

test('botão do Google e aviso vêm antes do exemplo', () => {
  const exemplo = tela.indexOf('Fone Bluetooth sem fio');
  assert.ok(exemplo > 0);
  assert.ok(tela.indexOf('id="botaoGoogle"') < exemplo, 'botão depois do exemplo');
  assert.ok(tela.indexOf('id="avisoLogin"') < exemplo, 'aviso depois do exemplo');
});

test('tela de entrada avisa o aceite dos Termos de Uso, com link', () => {
  assert.ok(tela.includes('Ao entrar, você concorda com os'), 'falta o aviso de aceite');
  assert.ok(tela.includes('href="termos.html"'), 'falta o link dos termos');
  assert.ok(tela.indexOf('href="termos.html"') < tela.indexOf('Fone Bluetooth sem fio'), 'aviso deve ficar junto do botão');
});

test('Termos de Uso trazem as cláusulas exigidas pela Shopee', () => {
  const termos = fs.readFileSync(path.join(__dirname, '..', 'web', 'termos.html'), 'utf8');
  assert.ok(termos.includes('terceira beneficiária'), 'Shopee como terceira beneficiária');
  assert.ok(termos.includes('termina automaticamente se você descumprir'), 'encerramento por violação ou ordem da Shopee');
  assert.ok(termos.includes('Não é afiliado, patrocinado, endossado'), 'aviso de independência');
});

test('login por código: formulário de e-mail, de código e o Google como alternativa', () => {
  for (const id of ['formEmail', 'emailLogin', 'pedirCodigo', 'formCodigo', 'codigoLogin', 'entrarCodigo', 'trocarEmail', 'botaoGoogle']) {
    assert.ok(tela.includes(`id="${id}"`), `falta #${id}`);
  }
  assert.ok(tela.indexOf('id="formEmail"') < tela.indexOf('id="botaoGoogle"'), 'e-mail vem antes do Google');
  assert.ok(/id="formCodigo"[^>]*hidden/.test(tela), 'código começa escondido');
  assert.ok(html.includes("action: 'codigo'") && html.includes("action: 'entrar'"), 'chamadas ao servidor');
});

test('página /obrigado existe e leva ao app', () => {
  const obrigado = fs.readFileSync(path.join(__dirname, '..', 'web', 'obrigado.html'), 'utf8');
  assert.ok(obrigado.includes('Pagamento aprovado'));
  assert.ok(obrigado.includes('href="./"'));
});

test('frase: sem chave própria usa a IA inclusa pelo servidor; com chave, o Gemini direto', () => {
  assert.ok(html.includes("action: 'frase'"), 'chama a IA inclusa no servidor');
  assert.ok(html.includes('function criarFrase'), 'escolhe entre IA inclusa e chave própria');
  assert.ok(html.includes('inclusa'), 'explica que a IA já vem inclusa');
});

test('página de vendas: botões levam ao checkout da Kiwify e há link a partir da entrada', () => {
  const vendas = fs.readFileSync(path.join(__dirname, '..', 'web', 'conhecer.html'), 'utf8');
  const botoes = vendas.match(/data-checkout href="([^"]+)"/g) || [];
  assert.ok(botoes.length >= 3, 'pelo menos 3 botões de compra');
  for (const b of botoes) assert.ok(b.includes('https://pay.kiwify.com.br/'), b);
  assert.ok(vendas.includes('19,90'));
  assert.ok(vendas.includes('não é afiliado'), 'aviso de independência');
  assert.ok(vendas.includes('href="termos.html"') && vendas.includes('href="privacidade.html"'));
  assert.ok(tela.includes('href="conhecer"'), 'link da entrada para a página de vendas');
});
