# Gerador de Post (Mercado Livre)

Cola o link de afiliado, recebe a legenda pronta para o canal do WhatsApp.

## Testes

```
node --test test/*.test.js
```

Para testar com páginas reais do ML: salve 5 produtos (`Ctrl+S` → "Página da Web, somente HTML") em `test/fixtures/real/` e rode `node --test test/real.test.js`. Inclua pelo menos um produto sem desconto e um com desconto.
Opcional: crie `test/fixtures/real/esperado.json` com `{"arquivo.html": {"preco": 149.9, "precoAntigo": 199.9}}` (use `null` quando não há desconto) para o teste conferir os valores.

Tela (precisa de `playwright` e `google-chrome`): `python3 test/e2e/tela.py`.

## Implantação

### 1. Backend (Apps Script)
1. Acesse script.google.com e crie um projeto novo.
2. Crie três arquivos e cole o conteúdo de `src/parse.gs`, `src/acesso.gs` e `src/Code.gs` (um arquivo para cada).
3. Crie uma planilha com uma aba `Clientes`, cabeçalho `email | nome | ativo` e uma linha com o seu e-mail e `sim` em `ativo`.
4. Configurações do projeto → Propriedades do script → adicione `PLANILHA_ID` (o ID da planilha, na URL entre `/d/` e `/edit`) e `GOOGLE_CLIENT_ID` (o Client ID do OAuth do Google usado no login).
5. No editor, selecione a função `testarAcesso` e rode (▶). Autorize o acesso à planilha quando pedir; o resultado em Execuções deve mostrar seu nome e `ativo: true`.
6. Implantar → Nova implantação → App da Web. Executar como: **Eu**. Quem tem acesso: **Qualquer pessoa**.
7. Autorize quando pedir. Copie a URL que termina em `/exec`.

Para atualizar depois: Implantar → Gerenciar implantações → lápis → Versão: **Nova versão** → Implantar.

### 2. Tela
1. Em `web/index.html`, troque `COLE_AQUI_A_URL_DO_WEB_APP` pela URL do passo anterior.
2. Envie o repositório ao GitHub.
3. No Cloudflare: Workers & Pages → Create → "Continue to Pages" → Import an existing Git repository. Branch `main`, preset `None`, build command `node --test`, output directory `web`.
4. Cada push na `main` roda os testes e publica a pasta `web/` em https://gerador-de-post.pages.dev.

### 3. Celular
Abra https://gerador-de-post.pages.dev no Chrome, informe o `TOKEN` na primeira vez e use "Instalar app".

## Quando o ML mudar a página
Se título ou preço vierem vazios, a tela deixa os campos editáveis. Para corrigir a extração, salve a página nova em `test/fixtures/real/` e ajuste `src/parse.gs`.
