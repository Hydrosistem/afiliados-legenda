# Gerador de Post (Mercado Livre)

Cola o link de afiliado, recebe a legenda pronta para o canal do WhatsApp.

## Testes

```
node --test test/*.test.js
```

Para testar com páginas reais do ML: salve 5 produtos (`Ctrl+S` → "Página da Web, somente HTML") em `test/fixtures/real/` e rode `node --test test/real.test.js`. Inclua pelo menos um produto sem desconto e um com desconto.
Opcional: crie `test/fixtures/real/esperado.json` com `{"arquivo.html": {"preco": 149.9, "precoAntigo": 199.9}}` (use `null` quando não há desconto) para o teste conferir os valores.

Tela (precisa de `playwright`; usa o Chromium do próprio Playwright, ou aponte `CHROME_PATH` pro Chrome instalado): `python3 test/e2e/tela.py`.

## Implantação

### 1. Cliente OAuth no Google Cloud
1. Acesse console.cloud.google.com e crie um projeto novo (ex.: "Gerador de Post").
2. APIs e serviços → Tela de consentimento OAuth: tipo **Externo**, nome do app "Gerador de Post", e-mail de suporte o seu. Depois publique a tela em produção (enquanto estiver em teste o login dos clientes expira em poucos dias).
3. APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth → tipo **Aplicativo da Web**. Em "Origens JavaScript autorizadas" adicione as duas:
   - `https://gerador-de-post.pages.dev`
   - `http://localhost:8765`
4. Copie o Client ID gerado (termina em `.apps.googleusercontent.com`; é público, pode ficar no código) — ele é usado nos passos 2 e 3 abaixo.

### 2. Backend (Apps Script)
1. Acesse script.google.com e crie um projeto novo.
2. Crie três arquivos e cole o conteúdo de `src/parse.gs`, `src/acesso.gs` e `src/Code.gs` (um arquivo para cada).
3. Crie uma planilha com uma aba `Clientes`, cabeçalho `email | nome | ativo` e uma linha com o seu e-mail e `sim` em `ativo`.
4. Configurações do projeto → Propriedades do script → adicione `PLANILHA_ID` (o ID da planilha, na URL entre `/d/` e `/edit`) e `GOOGLE_CLIENT_ID` (o Client ID copiado no passo 1).
5. No editor, selecione a função `testarAcesso` e rode (▶). Autorize o acesso à planilha quando pedir; o resultado em Execuções deve mostrar seu nome e `ativo: true`.
6. Implantar → Nova implantação → App da Web. Executar como: **Eu**. Quem tem acesso: **Qualquer pessoa**. Autorize quando pedir.

   Só numa implantação **nova** (criada do zero, não numa atualização) é preciso copiar a URL que termina em `/exec`: ela já está em `API_URL`, em `web/index.html` deste repositório; se você criar seu próprio projeto do Apps Script, troque esse valor pela URL da sua implantação.

Para atualizar depois: Implantar → Gerenciar implantações → lápis → Versão: **Nova versão** → Implantar.

### 3. Tela
1. Em `web/index.html`, na linha `var GOOGLE_CLIENT_ID = 'COLE_AQUI_O_CLIENT_ID';`, troque só o **valor** `COLE_AQUI_O_CLIENT_ID` (o texto entre aspas) pelo Client ID copiado no passo 1 — mantenha as aspas e o nome `GOOGLE_CLIENT_ID` como está, só o conteúdo entre aspas muda.
2. Envie o repositório ao GitHub.
3. No Cloudflare: Workers & Pages → Create → "Continue to Pages" → Import an existing Git repository. Branch `main`, preset `None`, build command `node --test`, output directory `web`.
4. Cada push na `main` roda os testes e publica a pasta `web/` em https://gerador-de-post.pages.dev.

### 4. Celular
Abra https://gerador-de-post.pages.dev no Chrome e toque em "Entrar com Google" (sua conta precisa estar na planilha de Clientes, com `ativo` = sim). Depois use "Instalar app".
Para a frase de efeito automática, abra ⚙️ "Sua chave do Gemini", crie uma chave grátis em https://aistudio.google.com/apikey e cole ali — a chave fica só nesse aparelho e vai direto para o Gemini. Sem chave, a frase tem que ser digitada à mão.

### Atualizando um projeto antigo (da versão com TOKEN)
Se o seu projeto ainda é da versão anterior (um `TOKEN` único compartilhado e `GEMINI_KEY` no servidor), a migração é:
1. No Apps Script: crie o arquivo `acesso.gs` (cole o conteúdo de `src/acesso.gs`), substitua o conteúdo de `Code.gs` pelo novo `src/Code.gs`, e apague o arquivo `frase.gs`.
2. Propriedades do script: adicione `PLANILHA_ID` e `GOOGLE_CLIENT_ID` (veja os passos 1 e 3 do backend acima).
3. Rode `testarAcesso` e autorize o acesso à planilha.
4. Implantar → Gerenciar implantações → lápis → Versão: **Nova versão** → Implantar — e, **no mesmo momento**, publique a página nova (`git push origin main`). O servidor novo e a página antiga (ou vice-versa) não se entendem: não deixe um rodando sem o outro, nem que seja por alguns minutos.
5. Só depois de confirmar que o login e a geração de legenda funcionam, apague `TOKEN` e `GEMINI_KEY` das Propriedades do script.

## Clientes
- **Adicionar um cliente:** nova linha na aba `Clientes` com o e-mail exato da conta Google usada na compra (inclusive os pontos, ex.: `maria.silva@gmail.com`), o nome e `sim` em `ativo`.
- **Desativar:** troque `ativo` para `não` (pode deixar a linha na planilha).
- Mantenha **uma linha por e-mail**: se houver duplicidade, só a primeira linha encontrada vale.
- Cada cliente pode estar logado em até **2 aparelhos** ao mesmo tempo; um terceiro login derruba o mais antigo.
- Cada cliente cola a própria chave do Gemini em ⚙️ "Sua chave do Gemini", na tela — grátis em https://aistudio.google.com/apikey — e ela nunca passa pelo seu servidor.

Limite prático: as sessões ficam guardadas nas Propriedades do script, que têm 500 KB no total — o suficiente para uns dois mil clientes, aproximadamente.

## Quando o ML mudar a página
Se título ou preço vierem vazios, a tela deixa os campos editáveis. Para corrigir a extração, salve a página nova em `test/fixtures/real/` e ajuste `src/parse.gs`.
