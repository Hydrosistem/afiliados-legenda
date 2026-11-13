# Login com Google e chave Gemini do cliente — design

Data: 2026-11-13. Objetivo: vender o Gerador de Post em compra única, com uso ilimitado, sem custo de IA para o vendedor e com o compartilhamento de acesso desencorajado.

## Decisões

1. **Login com Google.** A página mostra o botão "Entrar com Google" (Google Identity Services). O ID token vai ao servidor, que o confere no Google e libera o acesso só para e-mails cadastrados e ativos. Compartilhar normalmente exigiria entregar a própria conta Google, mas a sessão salva (`gp_sessao`) é um token sem validade: um comprador técnico poderia copiá-lo para outras pessoas até ser derrubado por um novo login. Expirar/rotacionar esse token é um possível reforço futuro.
2. **Clientes numa planilha.** Aba `Clientes` de uma Planilha Google, colunas `email | nome | ativo`, linha 1 de cabeçalho. `ativo` aceita `sim`, `s`, `true`, `1` (sem diferenciar maiúsculas) ou caixa de seleção marcada; qualquer outro valor bloqueia. E-mail comparado sem espaços e em minúsculas. Acesso vitalício: o vendedor só desativa à mão (reembolso, abuso).
3. **Até 2 sessões por cliente.** Cada login cria uma sessão; a terceira derruba a mais antiga. Sessão derrubada, cliente desativado ou removido: o próximo pedido devolve erro e a página volta à tela de login com uma mensagem clara.
4. **Sem senha única.** O `TOKEN` some do servidor e da página.
5. **IA com a chave do próprio cliente.** O cliente cola a chave do Gemini em ⚙️ na página. Ela fica só no `localStorage` do aparelho e vai direto do navegador ao Gemini, nunca ao servidor do vendedor. Sem chave, a frase fica em branco para digitar. O prompt e a leitura da resposta saem de `src/frase.gs` e passam para `web/frase.js`. A `GEMINI_KEY` do servidor deixa de existir. Modelo: `gemini-3.5-flash-lite`.
6. **Pedidos por POST.** A página chama o Apps Script com `POST` e corpo JSON em `text/plain` (sem preflight). Sessão e ID token não vão na URL.

## Configuração (uma vez, pelo vendedor)

- Google Cloud: cliente OAuth "Aplicativo da Web" com origens `https://gerador-de-post.pages.dev` e `http://localhost:8765`. O Client ID é público e vai em `web/index.html` e na propriedade `GOOGLE_CLIENT_ID`.
- Propriedades do script: `GOOGLE_CLIENT_ID`, `PLANILHA_ID`. Saem `TOKEN` e `GEMINI_KEY`.

## Fora do escopo

Pagamento automático (Kiwify/Hotmart), registro de uso por cliente, mudança do servidor para Cloudflare Workers, outras lojas além do Mercado Livre, repositório privado (decisão do vendedor antes de vender).

## Riscos

- Chamada ao Gemini direto do navegador depende de o Google aceitar CORS com `x-goog-api-key`. A conferência é feita no deploy com a chave real do vendedor.
- Servidor novo e página antiga são incompatíveis: os dois precisam ser publicados juntos.
