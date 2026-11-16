# Próximos passos: Gerador de Post

> Para retomar em outro computador ou numa conversa nova com o Claude:
> "Leia o PROXIMOS-PASSOS.md e o README.md e continue de onde paramos."
>
> Este arquivo não tem nenhuma senha, chave ou credencial. Os segredos ficam só nas
> Propriedades do script do Apps Script e nunca devem ir para o repositório, que é público.

Atualizado em 13 de novembro de 2026.

## O que já está pronto e no ar

- **Site:** https://geradordepost.app.br (domínio próprio desde 2026-11-16; https://gerador-de-post.pages.dev continua funcionando), servido pelo Cloudflare Pages. Cada push na `main` roda `node --test` e publica a pasta `web/` em cerca de 30 segundos. **Push na main = produção.**
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

- **Domínio pronto (2026-11-16):** `geradordepost.app.br` está registrado no Registro.br, com DNS no Cloudflare (nameservers `aurora` e `ryan`). Ele está ligado ao projeto do Pages, assim como o `www`, os dois com status Active e SSL.
- **Login do Google:** o domínio foi autorizado nas origens do cliente OAuth e no Branding (página inicial, `/privacidade`, `/termos`, domínios autorizados).
- **E-mail (Brevo), pronto em 2026-11-16:**
  - Domínio autenticado no Brevo, com DKIM `brevo1` e `brevo2` e o TXT `brevo-code`.
  - Os registros padrão do Registro.br (MX `.`, `spf -all` e `_dmarc p=reject`) foram removidos. Entraram no lugar `v=spf1 include:spf.brevo.com ~all` e `_dmarc`: `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com`.
  - O remetente **Gerador de Post `<nao-responda@geradordepost.app.br>`** está verificado, com DKIM e DMARC certos. O domínio não recebe e-mails (não há MX).
  - Falta criar a chave da API do Brevo quando formos programar. Ela vai para a propriedade `BREVO_API_KEY` do script, nunca no chat ou no repositório.

## O que falta, em ordem

1. ~~**Ligar o domínio ao site**~~: feito em 2026-11-16. Falta só atualizar o guia em PDF (`docs/guia`) com o endereço novo.
2. ~~**Brevo**~~: feito em 2026-11-16 (veja "Onde paramos"). Falta só a chave da API, que é criada na hora de programar o envio do código.
3. **Kiwify + entrada por código: código pronto em 2026-11-16, ainda não publicado.** O commit local tem:
   - `src/vendas.gs`: webhook, planilha, Brevo e código;
   - a tela com e-mail, código e Google;
   - `web/obrigado.html`;
   - Termos e Privacidade atualizados;
   - 121 testes passando.

   O formato do aviso da Kiwify em `test/fixtures/kiwify-aprovado.json` é **provisório**. Falta, com o dono:
   1. **Brevo:** criar a chave da API, colocar em `BREVO_API_KEY` e rodar `testarBrevo`.
   2. **Kiwify:** criar o produto (R$ 29,90), a URL de obrigado `/obrigado` e o webhook para `/exec?origem=kiwify`, com os eventos de aprovada, reembolso e chargeback. Depois, colocar o token em `KIWIFY_TOKEN`.
   3. **Apps Script:** colar `vendas.gs`, `acesso.gs` e `Code.gs` e publicar a Nova versão **junto** com o push do site.
   4. Disparar um aviso de teste, conferir em Execuções a linha "Kiwify (formato do aviso)" e ajustar `lerPedidoKiwify_` e a fixture, se precisar.
   5. Se a Kiwify recusar a resposta 302 do Apps Script, usar o plano B (Cloudflare Pages Function), descrito no spec `docs/superpowers/specs/2026-11-16-kiwify-codigo-email-design.md`.
4. ~~Entrada por código~~: incluída no item 3.
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
