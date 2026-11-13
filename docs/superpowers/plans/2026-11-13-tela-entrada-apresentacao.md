# Tela de entrada com apresentação — plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar a quem já comprou, na tela de login, o que o app faz: título, exemplo de legenda em balão de WhatsApp e 3 passos, com o botão do Google visível sem rolar.

**Architecture:** HTML e CSS estáticos dentro de `#telaLogin` em `web/index.html`, sem JavaScript novo. Um teste em Node lê o HTML e confere o conteúdo e a ordem dos blocos.

**Tech Stack:** HTML/CSS puro, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-13-tela-entrada-apresentacao-design.md`

## Global Constraints
- Ordem em `#telaLogin`: título → linha de apoio → "Entre com a conta Google usada na compra." → `#botaoGoogle` → `#avisoLogin` → exemplo → 3 passos.
- Textos exatos:
  - "Sua legenda de oferta pronta em segundos"
  - "Cole o link do produto e receba a legenda pronta para o seu canal do WhatsApp."
  - "Exemplo"
  - "Fone Bluetooth sem fio"
  - "R$ 199,90"
  - "R$ 89,90"
  - "Som potente pra acompanhar o seu dia todo"
  - "Cole o link"
  - "Gere a legenda"
  - "Copie pro WhatsApp"
- Os ids `telaLogin`, `botaoGoogle` e `avisoLogin` são mantidos, e nenhum JavaScript novo é adicionado.
- Visual: mesma largura máxima (560px) e mesmas cores do app. Balão verde-claro sem logo do WhatsApp.

## Review Focus
- Com 375×667, o botão do Google aparece sem rolar a tela. Conferido na prévia, porque não há teste automático de layout.
- Em telas estreitas, os 3 passos quebram linha sem estourar a largura.
- Uma mensagem de erro em `#avisoLogin` aparece logo abaixo do botão, não depois do exemplo.

---

### Task 1: Apresentação na tela de entrada

**Files:**
- Create: `test/tela-entrada.test.js`
- Modify: `web/index.html` (o CSS de `#telaLogin`, por volta das linhas 47-51, e o bloco `#telaLogin`, por volta das linhas 89-93)

- [ ] **Step 1: Escrever o teste.** `test/tela-entrada.test.js` lê `web/index.html` e isola o trecho de `<div id="telaLogin"` até `<main id="app"`. Dois testes:
  - **`tela de entrada apresenta o app`:** confere que o trecho contém cada um dos textos exatos das Global Constraints.
  - **`botão do Google vem antes do exemplo`:** o índice de `id="botaoGoogle"` e o de `id="avisoLogin"` são menores que o índice de `Fone Bluetooth sem fio`.
- [ ] **Step 2:** Rodar `node --test test/tela-entrada.test.js`. Deve FALHAR, porque os textos ainda não existem.
- [ ] **Step 3: Montar o HTML e o CSS** na ordem das Global Constraints:
  - Balão com classe `balao`: fundo `#dcf8c6`, raio 10px e "rabinho" com `::before`.
  - Formatação do WhatsApp com `<strong>`, `<s>` e `<em>`.
  - Hora fictícia no canto do balão.
  - Passos em flex com `flex-wrap: wrap`.
- [ ] **Step 4:** Rodar `node --test`. Deve PASSAR, com 85 testes.
- [ ] **Step 5: Prévia.** Abrir `http://localhost:8765` no painel do navegador em 375×667 e no PC, conferir os itens da Review Focus e mostrar ao usuário.
- [ ] **Step 6:** Fazer commit e push só quando o usuário pedir.
