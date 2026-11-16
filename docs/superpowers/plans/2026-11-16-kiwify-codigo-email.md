# Venda pela Kiwify e entrada por código: plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O webhook da Kiwify libera e corta o acesso sozinho, envia boas-vindas pelo Brevo, e o cliente entra com um código de 6 dígitos enviado por e-mail.

**Architecture:**
- **Novo `src/vendas.gs`:** webhook da Kiwify, planilha, Brevo e código.
- **`src/acesso.gs`:** ganha `encerrarSessoesDoEmail_`.
- **`src/Code.gs`:** encaminha `?origem=kiwify` e as ações `codigo` e `entrar`.
- **Tela:** formulário de e-mail e código no `#telaLogin`, mais a nova `web/obrigado.html`.

**Tech Stack:** Apps Script (UrlFetchApp, CacheService, SpreadsheetApp, Utilities HMAC/SHA-256), Brevo API v3, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-16-kiwify-codigo-email-design.md`

## Global Constraints
- **Propriedades:** `KIWIFY_TOKEN` e `BREVO_API_KEY`, nunca no código, em log ou no chat.
- **Assinatura:** `signature` (query) = HMAC-SHA1 em hex do corpo bruto, com `KIWIFY_TOKEN`.
- **Remetente:** `Gerador de Post <nao-responda@geradordepost.app.br>`. Envio por `POST https://api.brevo.com/v3/smtp/email` com o cabeçalho `api-key`.
- **Código:**
  - 6 dígitos, válido por 10 minutos;
  - invalidado na 5ª tentativa errada;
  - no máximo 1 por minuto e 5 por hora para cada e-mail;
  - o cache guarda só o hash.
- **Planilha `Clientes`:** colunas `email | nome | ativo | pedido | data | origem`. O e-mail fica em minúsculas.
- **Erros novos:** `sem_compra`, `espere`, `limite_codigo`, `email`, `email_envio`, `codigo_errado`, `codigo_expirado` e `codigo_bloqueado`.
- **Log do webhook:** só a forma do JSON (chaves e tipos), nunca os valores (dados pessoais).

## Review Focus
- O mesmo pedido entregue duas vezes não duplica a linha nem o e-mail.
- Um e-mail com letras maiúsculas na Kiwify bate com o mesmo e-mail digitado em minúsculas.
- Reembolso de quem está logado em 2 aparelhos derruba os dois.
- Falha no Brevo devolve `email_envio` e não grava código.
- O formato do aviso da Kiwify é provisório (fixture montada a partir de documentação de terceiros) e deve ser substituído pelo aviso de teste real.

### Task 1: Servidor
- [ ] **Stubs:**
  - `Utilities.computeHmacSignature` e `MacAlgorithm`;
  - escrita na aba (`appendRow`, `getRange().setValue/setValues`);
  - `cache.remove`.
- [ ] **Testes em `test/vendas.test.js`, com a fixture `test/fixtures/kiwify-aprovado.json` (provisória):**
  - assinatura;
  - aprovado, duplicado, reembolso e chargeback;
  - pedir código e entrar;
  - limites, expiração e bloqueio;
  - falha do Brevo;
  - rotas no `doPost`.
- [ ] Implementar e rodar `node --test`. Todos os testes devem passar.

### Task 2: Tela
- [ ] **`#telaLogin`:** e-mail, depois código, depois "ou", depois o Google. Também as mensagens de erro e `mostrarTelaLogin` voltando ao formulário de e-mail.
- [ ] **`web/obrigado.html`.**
- [ ] **`test/tela-entrada.test.js`:** atualizar para os textos novos.

### Task 3: Textos
- [ ] **Termos e Privacidade:** citar Kiwify e Brevo.
- [ ] **README:** como configurar a Kiwify e o Brevo.
- [ ] **PROXIMOS-PASSOS:** atualizar o estado.
- [ ] **Commit local.** O push e a publicação acontecem só junto com a configuração do dono.
