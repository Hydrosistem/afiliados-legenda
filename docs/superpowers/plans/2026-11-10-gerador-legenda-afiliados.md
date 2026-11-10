# Gerador de legenda de afiliados (ML) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colar um link de afiliado do Mercado Livre e receber uma legenda de WhatsApp pronta (título, preço, link), no celular e no PC.

**Architecture:** Tela estática (PWA) no GitHub Pages chama um web app do Google Apps Script. O Apps Script segue o link, lê a página do produto e devolve JSON. A legenda é montada no navegador por templates fixos. Funções puras ficam em arquivos separados para rodar testes em Node.

**Tech Stack:** HTML/CSS/JS sem framework, Google Apps Script, Node 18+ (`node --test`, sem dependências), GitHub Pages via Actions.

**Spec:** `docs/superpowers/specs/2026-11-10-gerador-legenda-afiliados-design.md`

## Global Constraints

- Só Mercado Livre. Sem Shopee, Amazon, envio automático, fila, IA, login ou offline.
- Hosts de produto permitidos: `mercadolivre.com.br`, `produto.mercadolivre.com.br`, `mercadolivre.com`, `mercadolibre.com`, `meli.la`. Só `https`. Match exato do domínio ou subdomínio (`host === d || host.endsWith('.' + d)`).
- Host de imagem permitido: `mlstatic.com` (mesma regra de match).
- Backend exige `token` (comparado com `ScriptProperties.TOKEN`) em toda ação.
- Cache do `info`: 1 hora (3600 s), chave = hash MD5 da URL.
- Título da legenda cortado em ~70 caracteres, no limite de palavra, com `…`.
- Preço no formato `R$ 1.234,56`. Formatação WhatsApp: `*negrito*`, `~riscado~`.
- 4 templates de legenda, alternando por índice guardado no `localStorage`.
- Sem banco de dados. Estado local só no `localStorage`.
- Não tocar no Painel de Entulhos, no bot do Telegram nem em planilhas existentes.

## Review Focus

Entradas que o spec implica e nenhuma tarefa cobriria sozinha. Cada linha tem teste na tarefa dona.

1. Host parecido com ML (`evilmercadolivre.com.br`, `mercadolivre.com.br.evil.com`) ou redirecionamento para fora da lista deve ser recusado. (Tasks 1 e 2)
2. Título com entidades HTML (`&amp;`, `&quot;`, `&#233;`) deve sair legível. (Task 1)
3. Preço em formatos diferentes (`"149.9"` string, `1299.9` número, centavos ausentes em "Antes: 199 reais") deve virar número correto. (Task 1)
4. Preço antigo igual ou menor que o atual, ou preço ausente, não pode gerar "0% OFF" nem "R$ null". (Task 3)
5. Título longo sem espaços não pode estourar a legenda. (Task 3)

## File Structure

```
src/parse.gs            funções puras: parseProduto, hostProdutoPermitido, hostImagemPermitido
src/Code.gs             doGet, buscarInfo_, buscarImagem_ (usa UrlFetchApp, CacheService, PropertiesService)
web/caption.js          funções puras de legenda (CommonJS em Node, globais no navegador)
web/index.html          tela + lógica de UI
web/manifest.json       PWA
web/sw.js               service worker mínimo (só para instalação)
web/icon-192.png, icon-512.png
test/helpers/load-gs.js     carrega .gs num contexto vm
test/helpers/gas-stubs.js   fakes de UrlFetchApp, CacheService, PropertiesService, ContentService, Utilities
test/*.test.js, test/fixtures/
.github/workflows/pages.yml publica web/ no GitHub Pages
README.md               passos de implantação
```

---

### Task 1: Parser e validação de host

**Files:**
- Create: `src/parse.gs`, `test/helpers/load-gs.js`, `test/parse.test.js`, `test/fixtures/com-desconto.html`, `test/fixtures/sem-desconto.html`, `test/fixtures/so-itemprop.html`, `.gitignore`

**Interfaces:**
- Produces:
  - `loadGs(files: string[], globals?: object): object` em `test/helpers/load-gs.js` — lê cada arquivo `.gs` e roda em um único `vm` context com os `globals` dados; devolve o contexto (funções acessíveis como propriedades).
  - `parseProduto(html: string): {titulo: string|null, preco: number|null, precoAntigo: number|null, imagem: string|null}`
  - `hostProdutoPermitido(url: string): boolean`
  - `hostImagemPermitido(url: string): boolean`

- [ ] **Step 1: Iniciar o repositório e o helper**

`git init` em `afiliados-legenda/`, `.gitignore` com `node_modules/` e `test/fixtures/real/`. Escrever `loadGs` conforme a assinatura acima.

- [ ] **Step 2: Escrever as fixtures sintéticas**

Três HTML mínimos:
- `com-desconto.html`: `<meta property="og:title" content="Fone Bluetooth X | MercadoLivre">`, `<meta property="og:image" content="https://http2.mlstatic.com/D_NQ_NP_123-F.webp">`, JSON-LD `Product` com `offers.price` = `"149.9"` (string), e `<s class="andes-money-amount andes-money-amount--previous" aria-label="Antes: 199 reais com 90 centavos">`.
- `sem-desconto.html`: igual, sem o elemento `--previous`, `offers.price` = `149.9` (número).
- `so-itemprop.html`: sem JSON-LD, `<meta itemprop="price" content="1299.9">`.

- [ ] **Step 3: Escrever os testes que falham** (`test/parse.test.js`, `node:test` + `node:assert/strict`)

- `extrai título, preço, preço antigo e imagem com desconto`: `parseProduto(com-desconto)` deepEqual `{titulo:'Fone Bluetooth X', preco:149.9, precoAntigo:199.9, imagem:'https://http2.mlstatic.com/D_NQ_NP_123-F.webp'}` (o sufixo ` | MercadoLivre` e ` | Mercado Livre` é removido).
- `sem desconto devolve precoAntigo null`: preço `149.9`, `precoAntigo === null`.
- `usa itemprop quando não há JSON-LD`: `preco === 1299.9`.
- `decodifica entidades no título`: `og:title` = `Caf&#233; &amp; P&#227;o &quot;Premium&quot;` vira `Café & Pão "Premium"`. Cobrir `&amp; &quot; &#39; &lt; &gt; &nbsp;` e `&#NNN;`.
- `html sem dados devolve tudo null`.
- `hostProdutoPermitido` verdadeiro para `https://www.mercadolivre.com.br/x`, `https://produto.mercadolivre.com.br/MLB-1`, `https://meli.la/abc`, `https://www.mercadolibre.com/x`.
- `hostProdutoPermitido` falso para `https://evilmercadolivre.com.br/`, `https://mercadolivre.com.br.evil.com/`, `http://mercadolivre.com.br/`, `ftp://meli.la/a`, `texto qualquer`, `""`.
- `hostImagemPermitido` verdadeiro para `https://http2.mlstatic.com/a.jpg`; falso para `https://mlstatic.com.evil.com/a.jpg` e `http://http2.mlstatic.com/a.jpg`.

- [ ] **Step 4: Rodar e confirmar falha**

Run: `node --test test/parse.test.js`
Expected: FAIL (funções não definidas).

- [ ] **Step 5: Implementar `src/parse.gs`**

Regras que os testes não determinam:
- Sem `URL` global garantido no Apps Script: extrair host com regex `^https:\/\/([^\/:?#]+)`, em minúsculas.
- Preço: primeiro JSON-LD (`<script type="application/ld+json">`, `JSON.parse` em try/catch; aceitar objeto ou array; achar `@type === 'Product'`; `offers` pode ser objeto ou array; usar o primeiro `price`). Fallback: `itemprop="price" content="…"`. Converter com `Number(...)`; NaN vira `null`.
- Preço antigo: `aria-label` do elemento com classe `andes-money-amount--previous`, padrão `(\d+) reais( com (\d+) centavos)?` → `reais + centavos/100`.
- Sem `const`/`let` obrigatório: Apps Script V8 aceita; manter sintaxe ES2015+.

- [ ] **Step 6: Rodar e confirmar que passa**

Run: `node --test test/parse.test.js`
Expected: todos PASS.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: parser de produto e validação de host"
```

---

### Task 2: Backend (doGet, info, img)

**Files:**
- Create: `src/Code.gs`, `test/helpers/gas-stubs.js`, `test/code.test.js`

**Interfaces:**
- Consumes: `parseProduto`, `hostProdutoPermitido`, `hostImagemPermitido` (Task 1); `loadGs`.
- Produces:
  - `makeStubs(opts?: {token?: string, respostas?: Array<{code:number, headers?:object, body?:string|Buffer}>}): object` em `gas-stubs.js` — devolve `{UrlFetchApp, CacheService, PropertiesService, ContentService, Utilities, chamadas}`; `UrlFetchApp.fetch` consome `respostas` em ordem e conta chamadas em `chamadas.fetch`; `ContentService.createTextOutput(s)` devolve objeto com `getContent()`, `setMimeType()` encadeável.
  - `doGet(e: {parameter: {token?: string, action?: string, url?: string}}): TextOutput` — corpo JSON.
  - `buscarInfo_(url: string): {ok:true, titulo, preco, precoAntigo, imagem, urlFinal} | {ok:false, erro: 'host'|'link_curto'|'rede'}`
  - `buscarImagem_(url: string): {ok:true, base64: string, mime: string} | {ok:false, erro: 'host'|'rede'}`
  - Códigos de erro de `doGet`: `'token'`, `'acao'` além dos acima.

- [ ] **Step 1: Escrever os testes que falham** (helper: `chamar(params, stubsOpts)` carrega `parse.gs` + `Code.gs` com os stubs e devolve `JSON.parse(doGet(...).getContent())`)

- `token errado devolve erro token`
- `ação desconhecida devolve erro acao`
- `host fora da lista devolve erro host` (sem chamar fetch: `chamadas.fetch === 0`)
- `info feliz devolve campos e urlFinal`: resposta 1 = 302 com `Location: https://www.mercadolivre.com.br/p/MLB1`; resposta 2 = 200 com a fixture `com-desconto.html`. Esperado `ok:true`, `titulo:'Fone Bluetooth X'`, `preco:149.9`, `precoAntigo:199.9`, `urlFinal:'https://www.mercadolivre.com.br/p/MLB1'`.
- `redirect para host fora da lista devolve erro host`: 302 com `Location: https://evil.com/`.
- `mais de 5 redirecionamentos devolve erro rede`.
- `página sem título e sem preço devolve erro link_curto`.
- `fetch que lança exceção devolve erro rede`.
- `segunda chamada igual usa cache`: `chamadas.fetch` continua 2 (os da primeira chamada); cache expira em 3600 s (stub registra o TTL recebido).
- `img feliz devolve base64 e mime`: URL `https://http2.mlstatic.com/a.jpg`, resposta 200 com bytes e `Content-Type: image/jpeg`.
- `img com host fora da lista devolve erro host`.

- [ ] **Step 2: Rodar e confirmar falha**

Run: `node --test test/code.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar `src/Code.gs`**

Decisões:
- Redirecionamento manual (`followRedirects:false`, `muteHttpExceptions:true`), no máximo 5 saltos, lendo o cabeçalho `Location` (comparar nome sem diferenciar maiúsculas). Cada salto passa por `hostProdutoPermitido`; falhou → `'host'`. É assim que se obtém `urlFinal`, que o `UrlFetchApp` não expõe.
- `User-Agent` de navegador desktop recente em todas as requisições.
- Cache só de resultados `ok:true`. Chave: `'i:' + hex(MD5(url))` via `Utilities.computeDigest`.
- `link_curto` quando `titulo === null && preco === null`.
- Resposta sempre `ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)`.
- Sem `try` amplo escondendo erros: só o `fetch` é envolvido para virar `'rede'`.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `node --test`
Expected: Tasks 1 e 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: backend Apps Script com token, cache e redirecionamento seguro"
```

---

### Task 3: Montagem da legenda

**Files:**
- Create: `web/caption.js`, `test/caption.test.js`

**Interfaces:**
- Produces (exportados via `module.exports` quando `module` existir; globais no navegador):
  - `formatBRL(n: number): string` → `'R$ 1.234,50'`
  - `encurtarTitulo(t: string, max?: number): string` (`max` padrão 70)
  - `calcDesconto(antigo: number|null, atual: number|null): number|null`
  - `TEMPLATES: Array<(d: Dados) => string>` com 4 itens
  - `montarLegenda(d: {titulo: string, preco: number|null, precoAntigo: number|null, link: string}, idx: number): string` — usa `TEMPLATES[idx % 4]`

- [ ] **Step 1: Escrever os testes que falham** (`test/caption.test.js`)

- `formatBRL`: `1234.5` → `'R$ 1.234,50'`; `149.9` → `'R$ 149,90'`; `10` → `'R$ 10,00'`; `1234567.8` → `'R$ 1.234.567,80'`.
- `encurtarTitulo`: título curto volta igual; título de 90 caracteres com espaços volta com no máximo 71 caracteres, termina em `…` e não corta palavra no meio; título de 100 caracteres sem espaços volta com os 70 primeiros + `…`; string vazia volta `''`.
- `calcDesconto`: `(199.9, 149.9)` → `25`; `(100, 100)` → `null`; `(90, 100)` → `null`; `(null, 100)` → `null`; `(200, null)` → `null`.
- `legenda com desconto` (idx 0, `{titulo:'Fone X', preco:149.9, precoAntigo:199.9, link:'https://meli.la/abc'}`) é exatamente:
  `"🔥 *Fone X*\n\nDe ~R$ 199,90~ por *R$ 149,90* (25% OFF)\n\n👉 https://meli.la/abc"`
- `legenda sem preço antigo` não contém `~` nem `OFF`, e contém `*R$ 149,90*`.
- `legenda com preço antigo menor ou igual ao atual` não contém `OFF` nem `~`.
- `legenda sem preço` (`preco: null`) não contém `R$` nem `null`, e mantém título e link.
- `índice dá a volta`: `montarLegenda(d, 4) === montarLegenda(d, 0)`.
- `os 4 templates diferem entre si` e todos contêm título e link exatos.

- [ ] **Step 2: Rodar e confirmar falha**

Run: `node --test test/caption.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar `web/caption.js`**

Template 0 é o texto exato do teste acima. Os templates 1–3 variam abertura e chamada (ex.: `⚡ OFERTA`, `💥 Achado do dia`, `🛒 Olha esse preço`) mantendo o mesmo conjunto de dados. Corte de título: voltar até o último espaço antes de `max`; se não houver espaço, cortar em `max`. Formatar milhar com `toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})` e prefixo `R$ ` (conferir que o resultado usa espaço comum, trocando ` ` se aparecer).

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `node --test`
Expected: Tasks 1 a 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: montagem de legenda com 4 templates"
```

---

### Task 4: Tela (PWA)

**Files:**
- Create: `web/index.html`, `web/manifest.json`, `web/sw.js`, `web/icon-192.png`, `web/icon-512.png`

**Interfaces:**
- Consumes: `formatBRL`, `encurtarTitulo`, `calcDesconto`, `TEMPLATES`, `montarLegenda` (Task 3, via `<script src="caption.js">`); contrato JSON do backend (Task 2) via `GET API_URL?token=…&action=info&url=…` e `action=img`. Sem cabeçalhos customizados (evita preflight CORS).
- Produces: constante `API_URL` no topo do script (valor placeholder `COLE_AQUI_A_URL_DO_WEB_APP`, trocado na Task 5). Chaves do `localStorage`: `afl_token`, `afl_tpl`.

- [ ] **Step 1: Criar `manifest.json`, `sw.js` e ícones**

`manifest.json`: nome "Legenda Afiliados", `display: standalone`, `start_url: "./"`, `lang: pt-BR`, ícones 192 e 512. `sw.js`: apenas `fetch` repassando à rede (existe só para o Chrome oferecer instalação). Ícones gerados por script Python/Pillow, quadrados, cor sólida com a letra "L".

- [ ] **Step 2: Implementar `index.html`**

Comportamento a cumprir:
- Campo "Link de afiliado" + botão **Gerar** → `gerar()`.
- Primeira execução sem `afl_token`: `prompt` pede o token e salva.
- Resposta `ok:true`: preenche título, preço, preço antigo (editáveis), mostra a imagem, gera a legenda; o link na legenda é sempre o que o usuário colou.
- Qualquer edição de campo recalcula a legenda (`atualizarLegenda()`).
- Erro `token`: apaga `afl_token` e pede de novo. Erro `host`: "Cole um link do Mercado Livre." Erro `link_curto`: mostra segundo campo "Link do produto" e refaz a busca com ele (legenda continua com o link de afiliado). Erro `rede` ou falha de fetch: aviso na tela; campos continuam editáveis e vazios.
- **Copiar legenda** → `copiarLegenda()` (`navigator.clipboard.writeText`).
- **Outro modelo** → `trocarModelo()` incrementa `afl_tpl` e recalcula.
- **Compartilhar imagem** → `compartilharImagem()`: busca `action=img`, monta `File`; se `navigator.canShare({files})`, usa `navigator.share`; senão baixa o arquivo. Desativado enquanto não houver imagem.
- Layout de uma coluna, legível no celular, botões grandes.

- [ ] **Step 3: Verificar no navegador com API simulada**

Servir `web/` com `python3 -m http.server 8080`. No navegador embutido, abrir `http://localhost:8080`, sobrescrever `fetch` para devolver o JSON da fixture `com-desconto` (`titulo:'Fone Bluetooth X'`, `preco:149.9`, `precoAntigo:199.9`) e colar `https://meli.la/abc`. Capturar tela.
Expected: campos preenchidos, legenda com `~R$ 199,90~`, `*R$ 149,90*`, `25% OFF`, link `https://meli.la/abc`; **Outro modelo** muda o texto; simular `{ok:false, erro:'link_curto'}` mostra o segundo campo; simular `{ok:false, erro:'rede'}` mostra aviso e campos editáveis.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: tela PWA de geração de legenda"
```

---

### Task 5: Páginas reais, implantação e teste no celular

**Files:**
- Create: `test/real.test.js`, `.github/workflows/pages.yml`, `README.md`
- Modify: `web/index.html` (valor de `API_URL`)
- Fixtures (feitas pelo usuário): `test/fixtures/real/*.html`

**Interfaces:**
- Consumes: `parseProduto` (Task 1).

- [ ] **Step 1: Escrever `test/real.test.js`**

Para cada `.html` em `test/fixtures/real/`: `parseProduto` deve dar `titulo` não vazio, `preco` número maior que 0 e `imagem` começando com `https://`. Se a pasta estiver vazia ou ausente, o teste é pulado (`t.skip`).

- [ ] **Step 2: Usuário salva 5 páginas reais**

Pedir ao Lord: abrir 5 produtos de categorias diferentes (pelo menos 2 com desconto), `Ctrl+S` → "Página da Web, somente HTML", salvar em `test/fixtures/real/`. Pasta fica fora do git (`.gitignore`).

- [ ] **Step 3: Rodar contra páginas reais**

Run: `node --test test/real.test.js`
Expected: PASS nas 5. Se `precoAntigo` ou preço falhar, ajustar seletores em `src/parse.gs` e acrescentar uma fixture sintética que reproduza a estrutura real; rodar `node --test` completo.

- [ ] **Step 4: Escrever `README.md` e o workflow de Pages**

`README.md` com os passos manuais do usuário: (1) criar projeto no Apps Script e colar `src/parse.gs` e `src/Code.gs`; (2) Configurações do projeto → Propriedades do script → `TOKEN` = valor escolhido; (3) Implantar → App da Web → executar como "Eu", acesso "Qualquer pessoa"; copiar a URL; (4) colar a URL em `API_URL`; (5) enviar ao GitHub e ligar Pages com "GitHub Actions". `pages.yml` publica a pasta `web/` (ações oficiais `upload-pages-artifact` e `deploy-pages`).

- [ ] **Step 5: Teste manual no celular**

No Android: abrir a URL do Pages, informar o token, gerar com 2 links reais (um `meli.la`, um de produto), editar um campo, copiar a legenda, colar no canal, compartilhar a imagem, instalar o PWA.
Expected: legenda com título e preço corretos; imagem compartilhada; ícone instalado.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "docs: implantação e teste com páginas reais"
```
