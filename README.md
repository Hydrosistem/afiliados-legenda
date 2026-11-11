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
2. Crie três arquivos e cole o conteúdo de `src/parse.gs`, `src/frase.gs` e `src/Code.gs` (um arquivo para cada).
3. Configurações do projeto → Propriedades do script → adicione `TOKEN` com uma senha longa que você escolher.
4. (Frase de efeito automática) Crie uma chave grátis em aistudio.google.com → "Get API key" e adicione em Propriedades do script `GEMINI_KEY`. Opcional: `GEMINI_MODEL` para trocar o modelo (padrão `gemini-3.5-flash-lite`). Sem chave, a tela deixa a frase em branco para você digitar.
5. Implantar → Nova implantação → App da Web. Executar como: **Eu**. Quem tem acesso: **Qualquer pessoa**.
6. Autorize quando pedir. Copie a URL que termina em `/exec`.

Para atualizar depois: Implantar → Gerenciar implantações → lápis → Versão: **Nova versão** → Implantar.

### 2. Tela
1. Em `web/index.html`, troque `COLE_AQUI_A_URL_DO_WEB_APP` pela URL do passo anterior.
2. Envie o repositório ao GitHub.
3. Settings → Pages → Source: **GitHub Actions**. O workflow `pages.yml` publica a pasta `web/`.

### 3. Celular
Abra a URL do Pages no Chrome, informe o `TOKEN` na primeira vez e use "Instalar app".

## Quando o ML mudar a página
Se título ou preço vierem vazios, a tela deixa os campos editáveis. Para corrigir a extração, salve a página nova em `test/fixtures/real/` e ajuste `src/parse.gs`.
