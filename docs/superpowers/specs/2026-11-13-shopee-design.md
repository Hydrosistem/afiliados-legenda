# Links da Shopee no Gerador de Post: design

Data: 2026-11-13.

## Intenção
O cliente cola o próprio link de afiliado da Shopee (`s.shopee.com.br/...`) e recebe a mesma legenda que já recebe com o Mercado Livre: foto, título, preços, a frase do Gemini e o link dele.

O vendedor tem acesso aprovado à Shopee Affiliate Open API.

## Decisões
1. **Credencial (escolha do vendedor, opção A):**
   - Todas as consultas usam o AppID e a senha do vendedor, guardados só nas Propriedades do script como `SHOPEE_APP_ID` e `SHOPEE_SECRET`.
   - O cliente não configura nada.
   - Proteções:
     - consulta guardada em cache por 1 hora, como já acontece no ML;
     - limite de 100 consultas da Shopee por cliente por dia. Acima disso, o servidor recusa com o erro `cota`.
2. **Link de afiliado intocado:**
   - A legenda usa sempre o link que o cliente colou.
   - A mutação `generateShortLink` **não** é usada, porque geraria links com o ID de afiliado do vendedor.
3. **Do link ao produto:**
   - O servidor segue os redirecionamentos do link curto até achar `-i.<shopId>.<itemId>` (ou `/product/<shopId>/<itemId>`) no endereço.
   - Ele não baixa a página da Shopee: só lê o endereço de destino.
   - Hosts aceitos: `shopee.com.br`, `s.shopee.com.br`, `shope.ee`.
4. **Consulta à API:**
   - `POST https://open-api.affiliate.shopee.com.br/graphql`.
   - Consulta `productOfferV2(itemId, shopId, limit: 1)` pedindo os campos `productName imageUrl priceMin priceMax priceDiscountRate`.
   - Assinatura: `Authorization: SHA256 Credential=<appId>, Timestamp=<segundos>, Signature=<sha256 hex de appId+timestamp+corpo+secret>`.
5. **Preços:**
   - O preço atual é `priceMin`.
   - O preço antigo é estimado como `priceMin / (1 - priceDiscountRate/100)`, arredondado para 2 casas. Isso só acontece com desconto maior que 0; sem desconto, não há preço antigo.
   - Os campos continuam editáveis na tela, como hoje.
6. **Imagem:** o domínio `susercontent.com` entra na lista de imagens permitidas, para o botão "Compartilhar imagem" funcionar.
7. **Erros novos na tela:**
   - O aviso de link de outra loja passa a dizer "Cole um link do Mercado Livre ou da Shopee."
   - Falha da API ou credencial ausente: "Não consegui consultar a Shopee agora. Tente de novo ou preencha à mão."
   - Limite da API ou cota do cliente: "Limite de buscas na Shopee atingido hoje. Preencha à mão ou tente mais tarde."

## Fora do escopo
- Gerar links de afiliado.
- Credencial própria do cliente (opções B e C).
- Outras lojas.
- Atualizar o guia em PDF (fica para depois).

## Riscos
- **URL de produção:** o endereço da API do Brasil é inferido do explorador (`open-api.affiliate.shopee.com.br`). Ele é conferido no primeiro teste real, com a função `testarShopee` rodada no editor.
- **Regras da Shopee:** não está claro se a Shopee permite usar o acesso do vendedor para atender outros afiliados. O vendedor confere os termos antes de vender.
- **Preço antigo:** pode diferir alguns centavos do mostrado na Shopee, porque é calculado a partir do percentual de desconto.
