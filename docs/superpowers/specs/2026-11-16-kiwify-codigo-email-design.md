# Venda pela Kiwify e entrada por código no e-mail: design

Data: 2026-11-16. Status: proposta para aprovação.

## Intenção
Vender o Gerador de Post por **R$ 19,90** via anúncio (FB/IG), sem nenhum passo manual do vendedor:
1. A pessoa paga na Kiwify.
2. O acesso é liberado sozinho.
3. Ela recebe o link por e-mail.
4. Ela entra com o próprio e-mail, recebendo um **código de 6 dígitos** (sem senha). Quem tem conta Google continua podendo entrar com o Google.

- **Objetivos:**
  - nenhuma digitação na planilha;
  - acesso liberado em segundos, a qualquer hora;
  - funcionar com qualquer e-mail, não só Gmail;
  - reembolso e estorno cortam o acesso sozinhos.
- **Não-objetivos (ficam para depois):** página de vendas, vídeo, ManyChat, área de membros, mais de um produto.
- **Anti-objetivos:**
  - alguém conseguir acesso sem pagar;
  - o cliente pagar e ficar sem conseguir entrar;
  - o servidor guardar senhas.

## Fluxo
```
Kiwify (pagamento aprovado) ──webhook──► Apps Script
   1. confere a assinatura do aviso (HMAC-SHA1 com o token do webhook)
   2. planilha Clientes: cria/atualiza linha (email, nome, ativo=sim, pedido, data, origem=kiwify)
   3. e-mail de boas-vindas pelo Brevo: "Seu acesso está liberado: geradordepost.app.br"
Kiwify redireciona o comprador ──► geradordepost.app.br/obrigado
   "Pagamento aprovado! Enviamos o acesso para o seu e-mail.  [Entrar agora]"

Tela de entrada:
   E-mail da compra [______]  [Receber código]
   → servidor confere: e-mail ativo na planilha? → gera código, envia pelo Brevo
   Código [______]  [Entrar]
   → servidor confere o código → cria sessão (mesmas regras de hoje: até 2 aparelhos)
   ── ou ──  [Entrar com Google]  (como hoje)

Reembolso/estorno (webhook) ──► ativo = não + encerra as sessões do e-mail
```

## Abordagens consideradas
- **A. O Apps Script recebe o webhook direto (escolhida).** Não cria peça nova, porque a planilha, as sessões e o envio de e-mail já estão no servidor.
  - **Risco:** o Apps Script responde POST com um redirecionamento 302. Se a Kiwify tratar isso como falha, ela reenvia o aviso.
  - **Mitigação:** o processamento é idempotente, usando o número do pedido.
- **B. Receber o webhook numa função do Cloudflare Pages e repassar ao Apps Script.** É o plano B, se o teste real mostrar que a Kiwify não aceita a resposta do Apps Script. O custo é uma peça a mais (Pages Functions) no mesmo repositório.
- **C. Cadastro com senha.** Descartado com o dono: dá mais passos ao comprador, exige "esqueci minha senha", guarda senhas no servidor e facilita o compartilhamento.

## Decisões
1. **Webhook da Kiwify**
   - **Endereço:** a mesma URL `/exec` do Apps Script, com `?origem=kiwify`.
   - **Roteamento:** o `doPost` desvia para `kiwifyWebhook_` quando `e.parameter.origem === 'kiwify'`.
   - **Autenticidade:** `signature` (query) = HMAC-SHA1 em hex do corpo bruto (`e.postData.contents`), com a propriedade `KIWIFY_TOKEN`. A comparação ignora maiúsculas e minúsculas. Se a assinatura for inválida, o aviso é ignorado.
   - **Eventos:**
     - **Compra aprovada:** ativa o acesso e envia o e-mail de boas-vindas.
     - **Reembolso e chargeback:** desativa o acesso e encerra as sessões.
     - Os outros eventos são ignorados.
   - **Campos:** os nomes exatos (e-mail, nome, status, id do pedido, tipo de evento) são confirmados com um **aviso de teste real** antes de fechar o código. O parser fica isolado numa função (`lerPedidoKiwify_`) com testes sobre o JSON real salvo em `test/fixtures/`.
   - **Idempotência:** o mesmo pedido processado duas vezes não duplica a linha nem reenvia o e-mail de boas-vindas.
2. **Planilha `Clientes`**
   - Ganha as colunas `pedido | data | origem`, depois de `email | nome | ativo`. O código de hoje continua lendo só as 3 primeiras.
   - O e-mail é guardado em minúsculas.
   - **Compra de um e-mail que já existe:** a linha é reativada (`ativo = sim`) e o nome é mantido.
   - **Reembolso:** muda para `ativo = não`, como na desativação manual de hoje.
3. **Código por e-mail**
   - **Pedir código:** ação `codigo {email}`.
     - Se o e-mail estiver ativo, gera 6 dígitos aleatórios e guarda **só o hash** (SHA-256 com o próprio e-mail) no CacheService, com validade de **10 minutos**. Em seguida envia pelo Brevo.
     - Se não estiver ativo, responde `sem_compra`.
   - **Entrar:** ação `entrar {email, codigo}`.
     - Se o código estiver certo, apaga o código e cria a sessão (`criarSessao_`, limite de 2 aparelhos).
     - Se errar **5 vezes**, o código é invalidado e é preciso pedir outro.
   - **Limites de envio:** no máximo 1 código por minuto e 5 por hora para cada e-mail. Isso protege a cota do Brevo (300 por dia) e evita abuso.
4. **E-mails (Brevo, API transacional)**
   - **Remetente:** `Gerador de Post <nao-responda@geradordepost.app.br>`.
   - **Chave:** `BREVO_API_KEY`, guardada só nas Propriedades do script.
   - **Dois modelos, em HTML simples com as cores do app e versão em texto:**
     - **Boas-vindas:** "Seu Gerador de Post está liberado", com botão para geradordepost.app.br e instrução de entrar com o e-mail da compra.
     - **Código:** "Seu código de acesso: 123456 (vale 10 minutos)".
5. **Telas**
   - **Entrada:** o bloco de login passa a ter e-mail, "Receber código", campo do código, "Entrar", a divisória "ou" e o botão do Google. O resto da tela continua igual (apresentação, exemplo e passos).
   - **Mensagens claras:**
     - código enviado;
     - código errado;
     - código expirado;
     - limite de envios;
     - compra não encontrada: "Não encontramos compra com esse e-mail. Se pagou por Pix ou boleto, aguarde alguns minutos e tente de novo."
   - **`web/obrigado.html`:** página de destino depois do pagamento, configurada na Kiwify.
6. **Termos e Privacidade:** citar a Kiwify (pagamento) e o Brevo (envio de e-mails), e que o e-mail da compra é usado para liberar o acesso e enviar os códigos.

## O dono configura (com guia)
- **Kiwify:**
  - criar o produto (R$ 19,90);
  - URL de obrigado: `https://geradordepost.app.br/obrigado`;
  - criar o webhook com os eventos de compra aprovada, reembolso e chargeback, apontando para a URL do Apps Script;
  - copiar o token do webhook para a propriedade `KIWIFY_TOKEN`.
- **Brevo:** criar a chave da API e colocar na propriedade `BREVO_API_KEY`.
- **Apps Script:** colar os arquivos novos e publicar a Nova versão junto com o push do site.

## Riscos e como verificar
- **Formato real do aviso da Kiwify:**
  - Disparar um aviso de teste no painel da Kiwify, salvar o corpo, sem dados pessoais reais, em `test/fixtures/kiwify-aprovado.json` e escrever os testes em cima dele.
  - Uma função de diagnóstico no Apps Script registra o último aviso recebido.
- **Resposta 302 do Apps Script:** testar com o aviso de teste. Se a Kiwify marcar falha, usar a abordagem B.
- **Entregabilidade:** mandar um código de teste para Gmail, Outlook e Hotmail e conferir que não cai no spam.
- **Pix e boleto aprovados depois:** a mensagem "aguarde alguns minutos" cobre esse intervalo.

## Testes (node --test, com fakes do Apps Script)
- **Assinatura:** válida passa, inválida é ignorada.
- **Compra aprovada:** cria a linha e envia boas-vindas. Repetida, não duplica.
- **Reembolso e chargeback:** mudam para `ativo = não` e encerram as sessões.
- **Código:**
  - é gerado só para e-mail ativo;
  - expira em 10 minutos;
  - é invalidado na 5ª tentativa errada;
  - respeita os limites por minuto e por hora;
  - o certo cria a sessão.
- **Envio pelo Brevo:** URL, cabeçalho `api-key`, remetente e destinatário corretos. A chave nunca aparece em log.
- **Tela:** os textos e os elementos do novo login existem, e o botão do Google continua lá.
