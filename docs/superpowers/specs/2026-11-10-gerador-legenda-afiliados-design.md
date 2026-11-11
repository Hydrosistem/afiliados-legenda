# Gerador de legenda de afiliados (Mercado Livre) — Design

Data: 2026-11-10
Status: aguardando revisão

## Objetivo

Colar um link de afiliado do Mercado Livre e receber uma legenda pronta (título, preço, link) para postar no canal de WhatsApp. O usuário revisa, copia e cola no canal.

## Escopo (Fase 1)

- Só Mercado Livre.
- Uso no celular e no PC (PWA instalável).
- Revisão e envio manuais.
- Projeto novo e separado. Não toca no Painel de Entulhos, no bot do Telegram nem em suas planilhas.

## Fora do escopo

Shopee, Amazon, envio automático ao canal, fila e agenda, legenda por IA, login de usuários, modo offline.

## Arquitetura

Mesma stack que o usuário já opera, em repositório próprio.

| Peça | Tecnologia | Função |
|---|---|---|
| `index.html` + `caption.js` | HTML/CSS/JS + `manifest.json` + `sw.js` mínimo | Tela. Hospedada no GitHub Pages. A lógica de legenda fica em `caption.js` para ser testada em Node. |
| `Code.gs` + `parse.gs` + `frase.gs` | Google Apps Script (web app) | Busca e lê a página do produto. A extração fica em `parse.gs` (função pura, testável). `frase.gs` pede ao Gemini (plano gratuito) a frase de efeito e o emoji do produto. |

Sem banco de dados. Estado local (token de acesso) fica no `localStorage`.

## Backend (`Code.gs`)

`doGet(e)` com parâmetro `token` obrigatório e `action`:

### `action=info&url=...`

1. Valida o token contra `ScriptProperties.TOKEN`. Token errado devolve `{ok:false, erro:"token"}`.
2. Valida o host da URL contra uma lista fixa: `mercadolivre.com.br`, `produto.mercadolivre.com.br`, `mercadolivre.com`, `mercadolibre.com`, `meli.la`. Qualquer outro host é recusado (evita uso do backend como proxy aberto).
3. `UrlFetchApp.fetch` com redirecionamento ligado, `muteHttpExceptions` e `User-Agent` de navegador.
4. Extrai da página final:
   - título: `og:title`;
   - imagem: `og:image`;
   - preço atual: JSON-LD `Product.offers.price`; se ausente, meta `itemprop="price"`;
   - preço antigo: valor riscado ("preço anterior") quando existir; senão `null`.
5. Resposta: `{ok, titulo, preco, precoAntigo, imagem, urlFinal}`.
6. Cache de 1 hora (`CacheService`), chave = hash da URL.

### `action=img&url=...`

Mesma validação de token. Aceita só URLs de imagem do domínio `mlstatic.com`. Devolve `{ok, base64, mime}`. Existe porque a CDN de imagens pode bloquear leitura direta pelo navegador (CORS), o que impediria compartilhar o arquivo.

### Resolução do link curto

O usuário cola um link de afiliado (ex.: `meli.la/...`). O backend segue os redirecionamentos até a página do produto. Se o link curto não resolver para uma página de produto, devolve `{ok:false, erro:"link_curto"}` e a tela pede o link do produto em um segundo campo. O link colado pelo usuário é sempre o que vai na legenda.

## Frontend (`index.html`)

Elementos:

1. Campo "Link de afiliado" + botão **Gerar**.
2. Pré-visualização da imagem.
3. Campos editáveis: título, emoji, preço atual, preço antigo, frase de efeito.
4. Caixa de texto com a legenda montada (editável).
5. Botões: **Copiar legenda**, **Compartilhar imagem** (Web Share API com arquivo; se o aparelho não suportar, baixa a imagem).
6. Configuração inicial: pedir o token na primeira vez e guardar no `localStorage`. URL do Apps Script fixa em constante.

### Formato da legenda

Um único formato, igual ao dos posts do canal (formatação do WhatsApp: `*negrito*`, `~riscado~`, `_itálico_`):

```
*{TÍTULO EM CAIXA ALTA}* {emoji}

de ~R$300~ por 💥 *R$183,20*💥

💗 _{frase de efeito}_

🏠 {link}
```

Sem preço antigo, a linha de preço vira `por 💥 *R$274,17*💥`.

Regras de montagem:

- Título em caixa alta, cortado em ~100 caracteres no limite de palavra, com "…".
- Preço sem espaço depois de `R$`, sem `,00` quando inteiro, ponto de milhar (`R$1.299,90`, `R$300`).
- "de ~antigo~" só aparece se `antigo > atual`. Não há "% OFF".
- Frase vazia: a linha do 💗 some. Sem emoji: sem espaço sobrando depois do título. Sem preço: a linha de preço some.

### Frase de efeito (Gemini)

- O backend chama a API REST do Gemini (`generateContent`) depois de ler a página, com o título como único dado do produto. O prompt traz dois exemplos reais do canal e trata o título como dado não confiável (uma linha, até 200 caracteres, sem `<`/`>`).
- A resposta é JSON `{frase, emoji}`; é validada (sem `*`, `_`, `~`, até 160 caracteres, emoji curto e sem letras). Qualquer falha (sem chave, cota, rede, resposta inválida) devolve frase e emoji vazios: a tela avisa e o usuário digita.
- Chave em `ScriptProperties` (`GEMINI_KEY`), enviada no cabeçalho `x-goog-api-key`, nunca na URL. Modelo opcional em `GEMINI_MODEL` (padrão `gemini-3.5-flash-lite`).
- Resultado com frase entra no cache de 1 h; resultado sem frase (falha do Gemini) não é guardado, para a próxima tentativa poder gerar.
- No plano gratuito, Google pode usar os prompts para melhorar seus produtos; só o título público do produto é enviado.

## Tratamento de erros

| Situação | Comportamento |
|---|---|
| Token errado | Mensagem e pedido de novo token. |
| Host não permitido | "Cole um link do Mercado Livre." |
| ML bloqueia ou muda a página | Campos vazios e editáveis, aviso na tela. O usuário preenche à mão e a legenda ainda funciona. |
| Link curto não resolve | Segundo campo pede o link do produto. |
| Gemini indisponível, sem chave ou sem cota | Frase e emoji vazios, aviso na tela; o usuário digita a frase. |
| Imagem não carrega | Legenda continua disponível; compartilhar imagem fica desativado. |
| Backend fora do ar | Mensagem de erro de rede, sem travar a tela. |

## Testes

- A função de extração (HTML → título/preço/imagem) é pura e fica separada do `fetch`.
- 5 páginas reais de produto salvas como fixtures (categorias diferentes, com e sem desconto). Um script Node carrega o `Code.gs` e confere os campos extraídos.
- Teste manual no celular antes de dar por pronto: gerar, editar, copiar, compartilhar imagem, instalar o PWA.

## Implantação

1. Repositório novo no GitHub com Pages ligado.
2. O usuário cola `Code.gs` num projeto do Apps Script, define `TOKEN` em `ScriptProperties` e publica como web app ("Qualquer pessoa"). Esse passo é manual, pois exige a conta Google dele.
3. URL do web app entra na constante do `index.html`.

## Riscos

- O ML pode bloquear os IPs do Google. Mitigação: campos editáveis (a ferramenta continua útil). Plano B: mover só o backend para um Cloudflare Worker, sem mudar a tela.
- O HTML do ML muda sem aviso. Mitigação: extração isolada e testada; falha vira preenchimento manual.
- O web app fica público. Mitigação: token obrigatório e lista fixa de hosts.

## Próximas fases (não fazem parte deste spec)

- Fase 1b: Shopee, via API oficial de afiliados.
- Fase 2: envio automático ao canal (Whapi.Cloud), com botão de aprovar.
- Fase 3: fila e agendamento.
