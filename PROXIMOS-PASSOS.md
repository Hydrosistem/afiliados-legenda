# Próximos passos: Gerador de Post

> Para retomar em outro computador ou numa conversa nova com o Claude:
> "Leia o PROXIMOS-PASSOS.md e o README.md e continue de onde paramos."
>
> Este arquivo não tem nenhuma senha, chave ou credencial. Os segredos ficam só nas
> Propriedades do script do Apps Script e nunca devem ir para o repositório, que é público.

Atualizado em 13 de novembro de 2026.

## O que já está pronto e no ar

- **Site:** https://gerador-de-post.pages.dev, servido pelo Cloudflare Pages. Cada push na `main` roda `node --test` e publica a pasta `web/` em cerca de 30 segundos. **Push na main = produção.**
- **Servidor:** Google Apps Script, com os arquivos `src/parse.gs`, `src/acesso.gs`, `src/shopee.gs` e `src/Code.gs`.
  - O deploy é **manual**: colar os arquivos no editor e publicar "Nova versão" em Implantar → Gerenciar implantações.
  - Publicar nova versão mantém a URL `/exec`, que está em `API_URL` no `web/index.html`.
- **Login com Google:**
  - Projeto "Gerador de Post" no Google Cloud, com a tela de consentimento em produção.
  - Os clientes ficam na aba `Clientes` da planilha (colunas `email | nome | ativo`).
  - Cada cliente pode ter até 2 sessões.
- **Frase com IA:** cada cliente usa a própria chave do Gemini, que fica só no aparelho dele. Modelo `gemini-3.5-flash-lite`.
- **Lojas suportadas:**
  - **Mercado Livre:** o servidor lê a página do produto.
  - **Shopee:** usa a Shopee Affiliate Open API com a credencial do **vendedor**, guardada nas propriedades `SHOPEE_APP_ID` e `SHOPEE_SECRET`.
    - Cada produto fica 1 hora em cache, e cada cliente pode fazer até 100 consultas por dia.
    - O app nunca usa `generateShortLink`, para a comissão continuar sendo do cliente.
- **Telas:**
  - tela de entrada com apresentação (exemplo de legenda com foto e 3 passos);
  - cabeçalho com barra de vidro e ícones de categoria;
  - passo a passo para criar a chave do Gemini (⚙️);
  - `termos.html` com as cláusulas exigidas pela Shopee (terceira beneficiária etc.) e `privacidade.html`;
  - aviso de aceite dos termos na tela de login.
- **Guia em PDF para clientes:** `docs/guia/Guia-Gerador-de-Post.pdf`. Ele fica fora do git, então copie à parte.
- **Testes:** `node --test`, com 103 testes passando.

## Onde paramos

O domínio **geradordepost.app.br** foi registrado no Registro.br. O domínio `geradordepost.com.br` já tinha dono.

- O domínio já foi adicionado ao Cloudflare com o plano Free, e os nameservers foram trocados no Registro.br para `aurora.ns.cloudflare.com` e `ryan.ns.cloudflare.com`.
- O Registro.br mostrava "servidores em transição", com a delegação liberada em cerca de 2 horas. **Primeiro passo ao retomar:** conferir se o Cloudflare mostra o domínio como **Active**:
  ```
  nslookup -type=NS geradordepost.app.br a.dns.br
  ```
  Os servidores do Cloudflare devem aparecer.
- A zona no Cloudflare tem 3 registros padrão do Registro.br que dizem "este domínio não envia e-mail":
  - MX `.`
  - TXT `v=spf1 -all`
  - TXT `_dmarc` com `p=reject`

  Eles precisam ser trocados quando o Brevo for configurado.

## O que falta, em ordem

1. **Ligar o domínio ao site:**
   - No Cloudflare, abrir Workers & Pages → projeto gerador-de-post → Custom domains e adicionar `geradordepost.app.br` e `www.geradordepost.app.br`.
   - Depois, atualizar:
     - as origens do cliente OAuth no Google Cloud, adicionando `https://geradordepost.app.br` e mantendo o pages.dev;
     - o Branding do Google, com a página inicial, `/privacidade` e `/termos`;
     - os textos e links que citam `gerador-de-post.pages.dev` (README, guia em PDF, termos).
2. **Brevo, para os e-mails do app:**
   - O remetente vai ser `nao-responda@geradordepost.app.br`.
   - Criar a conta grátis, autenticar o domínio (registros DNS no Cloudflare) e trocar os registros SPF/DMARC/MX padrão.
   - A chave da API do Brevo vai só nas Propriedades do script.
3. **Kiwify:** produto "Gerador de Post" a **R$ 29,90**.
   - O webhook de venda aprovada preenche a planilha sozinho (nome, e-mail, `ativo = sim`).
   - Reembolso ou estorno muda para `ativo = não`.
   - O checkout deve deixar claro que o e-mail usado é o de acesso.
4. **Entrada por código enviado por e-mail (sem senha)**, decisão já tomada:
   - O cliente digita o e-mail da compra, recebe um código de 6 dígitos pelo Brevo e entra.
   - O botão "Entrar com Google" continua como opção.
   - Depois do pagamento, a Kiwify redireciona para uma tela "Pronto! Confira seu e-mail ou entre agora".
   - E-mail de boas-vindas com o link do app.
   - Antes de programar: escrever o design em `docs/superpowers/specs/` e aprovar com o dono.
5. **Página de vendas** (por exemplo, `/conhecer`):
   - explica o Gerador, mostra exemplos e tem o botão "Quero o Gerador", que leva ao checkout da Kiwify;
   - o link dela é o que o robô manda no direct.
6. **Vídeo promocional** para anúncios no Facebook e no Instagram, terminando com "comente **Gerar**".
7. **ManyChat:** comentário "Gerar" no anúncio vira uma mensagem automática no direct com o link da página de vendas.
8. **Pendências menores:**
   - pedir à Shopee, por escrito, a confirmação do uso da Open API para atender clientes (openapi@support.shopee.com);
   - atualizar o guia em PDF depois que o login por código existir;
   - ajustar o exemplo da tela de entrada para mostrar o título em MAIÚSCULAS, como a legenda real.

## Como o dono gosta de trabalhar

- Ele pede **commit e push** de forma explícita. Antes de mudanças visuais, quer ver uma **prévia**.
- Mudanças em `src/*.gs` só valem depois que ele cola os arquivos no Apps Script e publica "Nova versão". Servidor e site incompatíveis precisam ir ao ar juntos.
- Para diagnosticar o servidor, peça para ele rodar no editor uma função de teste (`testarAcesso`, `testarShopee`, `testarLinkShopee`) e mandar o print de Execuções.
- Nunca colocar chaves em arquivos, nem repetir no chat segredos que ele colar.
