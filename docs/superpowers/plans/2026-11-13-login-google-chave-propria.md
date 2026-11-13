# Login com Google e chave Gemini do cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a senha única (`TOKEN`) por login com Google para clientes cadastrados numa planilha (até 2 sessões cada), e mover a frase do Gemini para o navegador, usando a chave do próprio cliente.

**Architecture:** O Apps Script ganha `src/acesso.gs` (confere ID token do Google, lê a planilha `Clientes`, guarda sessões em Propriedades do script) e passa a responder só por `doPost`. `src/frase.gs` sai; o prompt e a leitura da resposta viram `web/frase.js`, chamado pela página com a chave guardada no `localStorage`. A página ganha tela de login (Google Identity Services), barra da conta com "Sair" e um painel ⚙️ para a chave.

**Tech Stack:** Google Apps Script (V8), HTML/JS sem build, Google Identity Services, API Gemini `generateContent`, testes `node --test` com fakes em `test/helpers/gas-stubs.js`, e2e opcional em Playwright (Python).

**Spec:** `docs/superpowers/specs/2026-11-13-login-google-chave-propria-design.md`

## Global Constraints

- `API_URL` em `web/index.html` continua `https://script.google.com/macros/s/AKfycbzH4coDv1Xl1mFLOnETUP5jRLA93kGO4EpQ6z12aaEuFSqrTOl9HTPe9nd4vAWe9AjbCg/exec`.
- Nenhum segredo no repositório (é público). O Google Client ID é público e pode ir no código.
- Propriedades do script usadas: `GOOGLE_CLIENT_ID`, `PLANILHA_ID`. `TOKEN` e `GEMINI_KEY` deixam de ser lidas.
- Planilha: aba `Clientes`, colunas A `email`, B `nome`, C `ativo`, linha 1 = cabeçalho.
- Máximo de sessões por e-mail: `2`.
- Chaves do `localStorage`: `gp_sessao`, `gp_nome`, `gp_gemini`. A antiga `afl_token` é apagada ao abrir a página.
- Modelo Gemini: `gemini-3.5-flash-lite`. A chave vai só no cabeçalho `x-goog-api-key`, nunca na URL, e nunca em pedidos para `API_URL`.
- Códigos de erro do servidor: `login`, `sem_acesso`, `sessao`, `acao`, `host`, `link_curto`, `rede`.
- Textos da interface em português do Brasil.
- `node --test` precisa passar em todo commit (o Cloudflare Pages roda isso antes de publicar).

## Review Focus

1. Terceiro login do mesmo e-mail: a sessão mais antiga deixa de valer, e o aparelho dela volta à tela de login com aviso, sem laço de recarga. (Tasks 2 e 4.)
2. Cliente desativado na planilha com a página aberta: o próximo "Gerar" devolve `sem_acesso`, a sessão é apagada e a página mostra "Seu acesso foi desativado", não "Falha de rede". (Tasks 3 e 4.)
3. E-mail na planilha com maiúsculas ou espaços (`" Maria@Gmail.com "`) e `ativo` como caixa de seleção (`true`) ou `SIM`: precisa liberar. (Task 2.)
4. ID token com `aud` de outro app, `email_verified` falso ou vencido: precisa recusar com `login`. (Task 2.)
5. Chave do Gemini inválida ou limite estourado: a legenda continua sendo montada e o aviso diz o motivo; a chave nunca aparece no corpo de pedidos ao `API_URL`. (Tasks 1 e 4.)

---

### Task 1: `web/frase.js` — frase do Gemini no navegador

**Files:**
- Create: `web/frase.js`
- Modify: `test/frase.test.js` (passa a testar `web/frase.js`)

**Interfaces:**
- Produces (globais no navegador, `module.exports` no Node, mesmo padrão de `web/caption.js`):
  - `MODELO_GEMINI: string` = `'gemini-3.5-flash-lite'`
  - `montarPromptFrase(titulo: string): string` — mesmo texto e mesmos exemplos de `montarPromptFrase_` em `src/frase.gs`
  - `lerRespostaFrase(texto: string): {frase: string, emoji: string} | null` — mesma regra de `lerRespostaFrase_`
  - `gerarFrase(titulo: string, chave: string, fetchFn?: typeof fetch): Promise<{frase: string, emoji: string, erro: '' | 'sem_chave' | 'chave' | 'limite' | 'rede' | 'formato'}>`

- [ ] **Step 1: Reescrever `test/frase.test.js` para `require('../web/frase.js')`**

Mantenha os testes de prompt e de `lerRespostaFrase` (renomeados sem `_`, sem `plain()`). Acrescente, com um `fetchFn` falso que registra `(url, opcoes)` e devolve `{status, ok, text: async () => corpo}`:

```js
test('gerarFrase sem chave não chama a rede', async () => {
  let chamou = false;
  const r = await f.gerarFrase('Fone', '', async () => { chamou = true; });
  assert.deepEqual(r, { frase: '', emoji: '', erro: 'sem_chave' });
  assert.equal(chamou, false);
});

test('gerarFrase com chave: POST no modelo certo, chave só no cabeçalho', async () => {
  const chamadas = [];
  const corpo = JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"frase":"Oi!!","emoji":"🎧"}' }] } }] });
  const r = await f.gerarFrase('Fone Bluetooth X', 'k123', async (url, op) => { chamadas.push([url, op]); return { status: 200, ok: true, text: async () => corpo }; });
  assert.deepEqual(r, { frase: 'Oi!!', emoji: '🎧', erro: '' });
  const [url, op] = chamadas[0];
  assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
  assert.equal(op.method, 'POST');
  assert.equal(op.headers['x-goog-api-key'], 'k123');
  assert.ok(!url.includes('k123'));
  assert.ok(JSON.parse(op.body).contents[0].parts[0].text.includes('Fone Bluetooth X'));
});

test('gerarFrase traduz falhas em erro', async () => {
  const resp = (status, corpo = '{}') => async () => ({ status, ok: status === 200, text: async () => corpo });
  assert.equal((await f.gerarFrase('x', 'k', resp(400))).erro, 'chave');
  assert.equal((await f.gerarFrase('x', 'k', resp(403))).erro, 'chave');
  assert.equal((await f.gerarFrase('x', 'k', resp(429))).erro, 'limite');
  assert.equal((await f.gerarFrase('x', 'k', resp(500))).erro, 'rede');
  assert.equal((await f.gerarFrase('x', 'k', async () => { throw new Error('caiu'); })).erro, 'rede');
  assert.equal((await f.gerarFrase('x', 'k', resp(200, 'nao json'))).erro, 'formato');
  assert.equal((await f.gerarFrase('x', 'k', resp(200, '{"candidates":[]}'))).erro, 'formato');
});
```

Em toda falha, `frase` e `emoji` são `''`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test test/frase.test.js`
Expected: FAIL com `Cannot find module '../web/frase.js'`.

- [ ] **Step 3: Criar `web/frase.js`**

Porte `EXEMPLOS_FRASE_`, `montarPromptFrase_` e `lerRespostaFrase_` de `src/frase.gs` sem mudar textos nem limites (`FRASE_MAX` 160, título no prompt até 200). `gerarFrase`: chave vazia → `sem_chave` sem rede; `fetchFn` padrão = `fetch` global; corpo igual ao de `src/frase.gs` (`generationConfig: {responseMimeType: 'application/json', temperature: 1, maxOutputTokens: 300}`); 400/401/403 → `chave`, 429 → `limite`, outro status ou exceção → `rede`, JSON ou formato inválido → `formato`. Não apague `src/frase.gs` aqui (sai na Task 3).

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test`
Expected: tudo passa.

- [ ] **Step 5: Commit**

```bash
git add web/frase.js test/frase.test.js
git commit -m "feat: frase do Gemini gerada no navegador com a chave do cliente"
```

---

### Task 2: `src/acesso.gs` — ID token, planilha e sessões

**Files:**
- Create: `src/acesso.gs`, `test/acesso.test.js`
- Modify: `test/helpers/gas-stubs.js`

**Interfaces:**
- Consumes (Apps Script): `UrlFetchApp`, `PropertiesService`, `SpreadsheetApp`, `LockService`, `Utilities.getUuid`.
- Produces:
  - `verificarIdToken_(idToken: string): {ok: true, email: string} | {ok: false}`
  - `buscarCliente_(email: string): {nome: string, ativo: boolean} | null`
  - `criarSessao_(email: string): string` (id da sessão)
  - `emailDaSessao_(id: string): string | null`
  - `encerrarSessao_(id: string): void`
  - `testarAcesso(): void` — sem `_`, para rodar no editor; registra `buscarCliente_(Session.getEffectiveUser().getEmail())` com `console.log`.
- Produces (stubs): `makeStubs({token = 'tok', props = {}, respostas = [], clientes = [['email','nome','ativo']]})` (o `token` continua só até a Task 3 removê-lo, para `test/code.test.js` seguir passando), com `PropertiesService` mutável (`getProperty`, `setProperty`, `deleteProperty`; estado exposto em `stubs.propriedades`), `SpreadsheetApp.openById(id).getSheetByName('Clientes').getDataRange().getValues()` devolvendo `clientes` (e `stubs.chamadas.planilhaId` com o id usado), `LockService.getScriptLock()` com `waitLock()`/`releaseLock()` vazios, e `Utilities.getUuid()` devolvendo `'uuid-1'`, `'uuid-2'`, …

- [ ] **Step 1: Escrever `test/acesso.test.js`**

Carregue `loadGs(['src/acesso.gs'], makeStubs({...}))`. Token válido de exemplo: `{aud: 'cid', iss: 'https://accounts.google.com', email: 'Maria@Gmail.com', email_verified: 'true', exp: String(Math.floor(Date.now() / 1000) + 600)}` com `props: {GOOGLE_CLIENT_ID: 'cid', PLANILHA_ID: 'pid'}`. Testes:

- `verificarIdToken_ aceita token válido e devolve e-mail em minúsculas` → `{ok: true, email: 'maria@gmail.com'}`; a URL chamada começa com `https://oauth2.googleapis.com/tokeninfo?id_token=` e `muteHttpExceptions` é `true`.
- `verificarIdToken_ recusa aud errado, e-mail não verificado, vencido, iss estranho, HTTP 400 e token vazio` → `{ok: false}` em cada caso; token vazio não chama `fetch`.
- `buscarCliente_ ignora maiúsculas e espaços e lê ativo` com `clientes`:
  `[['email','nome','ativo'], [' Maria@Gmail.com ', 'Maria', 'SIM'], ['joao@x.com', 'João', true], ['ana@x.com', 'Ana', 'não'], ['bia@x.com', 'Bia', '']]` →
  `maria@gmail.com` → `{nome: 'Maria', ativo: true}`; `joao@x.com` → ativo `true`; `ana@x.com` e `bia@x.com` → ativo `false`; `ninguem@x.com` → `null`; cabeçalho nunca vira cliente (`buscarCliente_('email')` → `null`); `openById` recebe `'pid'`.
- `terceira sessão derruba a mais antiga`: `criarSessao_('a@x.com')` três vezes → ids `uuid-1..3`; `emailDaSessao_('uuid-1')` → `null`; `uuid-2` e `uuid-3` → `'a@x.com'`.
- `sessões de e-mails diferentes não interferem`: 2 sessões de `a@x.com` e 1 de `b@x.com` → as três valem.
- `encerrarSessao_ apaga só aquela sessão`: depois de encerrar `uuid-1`, `uuid-2` continua valendo e `emailDaSessao_('uuid-1')` → `null`; encerrar id inexistente ou `''` não lança.
- `emailDaSessao_ com id vazio ou desconhecido devolve null`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test test/acesso.test.js`
Expected: FAIL (`verificarIdToken_ is not defined`).

- [ ] **Step 3: Atualizar `test/helpers/gas-stubs.js` e criar `src/acesso.gs`**

Sessões em Propriedades do script: `'s:' + id` → e-mail; `'u:' + email` → JSON com a lista de ids, do mais antigo ao mais novo. `criarSessao_` e `encerrarSessao_` rodam dentro de `LockService.getScriptLock()` (`waitLock(10000)`, `releaseLock()` em `finally`). `verificarIdToken_`: só `code 200`, `aud === GOOGLE_CLIENT_ID`, `iss` em `accounts.google.com` ou `https://accounts.google.com`, `email_verified` igual a `'true'` ou `true`, `Number(exp) * 1000 > Date.now()`. `buscarCliente_`: `ativo` é `true` se o valor for `true` ou casar `/^(sim|s|true|1)$/i` depois de `trim`. Comentário de topo: depende de `GOOGLE_CLIENT_ID` e `PLANILHA_ID`.

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test`
Expected: tudo passa, inclusive `test/code.test.js` sem mudanças.

- [ ] **Step 5: Commit**

```bash
git add src/acesso.gs test/acesso.test.js test/helpers/gas-stubs.js
git commit -m "feat: login com Google, clientes na planilha e até 2 sessões"
```

---

### Task 3: `src/Code.gs` — `doPost` com sessão, sem TOKEN e sem Gemini

**Files:**
- Modify: `src/Code.gs`, `test/code.test.js`, `README.md` (seção Backend)
- Delete: `src/frase.gs`

**Interfaces:**
- Consumes: tudo de `src/acesso.gs` (Task 2); `parseProduto`, `hostProdutoPermitido`, `hostImagemPermitido` de `src/parse.gs`.
- Produces (contrato HTTP; corpo do POST é JSON em `text/plain`):
  - `{action: 'login', idToken}` → `{ok: true, sessao, nome, email}` | `{ok: false, erro: 'login' | 'sem_acesso'}`
  - `{action: 'sair', sessao}` → `{ok: true}`
  - `{action: 'info', sessao, url}` → `{ok: true, titulo, preco, precoAntigo, imagem, urlFinal}` | erros `host`, `link_curto`, `rede`
  - `{action: 'img', sessao, url}` → `{ok: true, base64, mime}` | erros `host`, `rede`
  - Qualquer ação exceto `login`: sessão desconhecida → `{ok: false, erro: 'sessao'}`; cliente inativo ou fora da planilha → encerra a sessão e `{ok: false, erro: 'sem_acesso'}`.
  - Ação desconhecida ou corpo que não é JSON → `{ok: false, erro: 'acao'}`. `doGet` sempre → `{ok: false, erro: 'acao'}`.

- [ ] **Step 1: Reescrever o topo de `test/code.test.js`**

Tire o parâmetro `token` (e a propriedade `TOKEN`) de `makeStubs`. `ambiente(opts)` carrega `['src/parse.gs', 'src/acesso.gs', 'src/Code.gs']` com `makeStubs({props: {GOOGLE_CLIENT_ID: 'cid', PLANILHA_ID: 'pid'}, clientes: [['email','nome','ativo'], ['maria@gmail.com','Maria','sim']], ...opts})`, e `chamar(p)` faz `JSON.parse(ctx.doPost({postData: {contents: JSON.stringify(p)}}).getContent())`. Um helper `logado(amb)` cria a sessão direto com `ctx.criarSessao_('maria@gmail.com')`. Apague os testes de Gemini (`com chave…`, `GEMINI_MODEL…`, `sem chave…`, `Gemini falha…`, `cache: guarda quando há frase…`, `sem chave o resultado…`) e o de `token errado`. Os testes de `info`/`img`/redirect/cache continuam, agora com `sessao`; `info feliz` espera o objeto sem `frase`/`emoji`. Novos testes:

- `login feliz devolve sessão, nome e e-mail` (resposta simulada do `tokeninfo` válida) → `{ok: true, sessao: 'uuid-1', nome: 'Maria', email: 'maria@gmail.com'}`.
- `login com e-mail fora da planilha ou inativo devolve sem_acesso` e não cria sessão (`stubs.propriedades` sem chave `s:`).
- `login com token recusado devolve erro login`.
- `info sem sessão ou com sessão desconhecida devolve erro sessao sem chamar fetch`.
- `cliente desativado depois do login: info devolve sem_acesso e a sessão some` (mude a linha em `clientes` para `'não'` depois de logar).
- `sair encerra a sessão`: depois, `info` com a mesma sessão → `sessao`.
- `corpo inválido e ação desconhecida devolvem acao`; `doGet devolve acao`.
- `info sempre guarda em cache` (uma chamada → `cachePut.length === 1`).

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test test/code.test.js`
Expected: FAIL (`ctx.doPost is not a function`).

- [ ] **Step 3: Implementar `doPost(e)` e ajustar `src/Code.gs`; apagar `src/frase.gs`**

`doGet` só devolve `acao`. `buscarInfo_` perde `gerarFrase_`, `frase`, `emoji` e o `if` do cache (sempre `cache.put`). Comentário de topo: depende de `src/parse.gs` e `src/acesso.gs`. No README, seção "1. Backend": três arquivos viram `src/parse.gs`, `src/acesso.gs`, `src/Code.gs`; troque os passos de `TOKEN` e `GEMINI_KEY` por: criar a planilha (aba `Clientes`, cabeçalho `email | nome | ativo`, seu e-mail com `sim`), propriedades `PLANILHA_ID` e `GOOGLE_CLIENT_ID`, rodar `testarAcesso` no editor para autorizar o acesso à planilha.

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test`
Expected: tudo passa; `grep -rn "TOKEN\|GEMINI_KEY\|gerarFrase_" src` não encontra nada.

- [ ] **Step 5: Commit**

```bash
git add -A src test README.md
git commit -m "feat: servidor por POST com sessão; sai o TOKEN e a frase do servidor"
```

---

### Task 4: `web/index.html` — tela de login, conta, ⚙️ chave do Gemini

**Files:**
- Modify: `web/index.html`, `test/e2e/tela.py`, `README.md` (seções Tela e Celular)

**Interfaces:**
- Consumes: contrato HTTP da Task 3; `gerarFrase`, `MODELO_GEMINI` de `web/frase.js` (Task 1); `montarLegenda`, `parseValor` de `web/caption.js`.
- Produces: constante `GOOGLE_CLIENT_ID = 'COLE_AQUI_O_CLIENT_ID'` (trocada na Task 5); elementos `#telaLogin`, `#botaoGoogle`, `#avisoLogin`, `#app`, `#conta`, `#nomeConta`, `#sair`, `#config`, `#chaveGemini`, `#salvarChave`, `#apagarChave`, `#statusChave`.

- [ ] **Step 1: Atualizar `test/e2e/tela.py` para o novo contrato**

Lance o Chrome com `executable_path=os.environ.get('CHROME_PATH')` (None usa o Chromium do Playwright). O mock de `http://mock.local/**` lê `json.loads(r.request.post_data)` e responde por `action`, guardando todos os corpos em `estado['corpos']`. Bloqueie `https://accounts.google.com/**` com script vazio. Simule `https://generativelanguage.googleapis.com/**` com resposta `{"candidates":[{"content":{"parts":[{"text":"{\"frase\":\"Som potente pra animar seu dia!!\",\"emoji\":\"🎧\"}"}]}}]}` e guarde o cabeçalho `x-goog-api-key` recebido. `novo()` grava `gp_sessao='s1'`, `gp_nome='Maria'` e, quando pedido, `gp_gemini='kTESTE'`, depois recarrega. Ajuste os cenários atuais (o `OK` do mock perde `frase`/`emoji`; a frase vem do mock do Gemini) e acrescente:

- `sem_sessao_mostra_login`: sem `gp_sessao`, `#telaLogin` visível, `#app` oculto, e `afl_token` antigo apagado.
- `sessao_derrubada_volta_ao_login`: mock responde `{"ok":false,"erro":"sessao"}` ao `info` → `#telaLogin` visível, `#avisoLogin` contém `Sua sessão terminou`, `gp_sessao` apagado.
- `acesso_desativado`: `erro: 'sem_acesso'` → `#avisoLogin` contém `acesso foi desativado`.
- `frase_com_chave`: com `gp_gemini`, gerar preenche frase e emoji pelo mock do Gemini; o cabeçalho recebido é `kTESTE`; nenhum corpo em `estado['corpos']` contém `kTESTE`.
- `frase_sem_chave`: sem `gp_gemini`, nenhum pedido ao Gemini e `#aviso` contém `configure a chave em ⚙️`.
- `chave_recusada`: mock do Gemini devolve 400 → legenda montada sem a linha 💗 e `#aviso` contém `recusou sua chave`.
- `sair`: clicar `#sair` envia `{"action":"sair","sessao":"s1"}`, apaga `gp_sessao` e mostra `#telaLogin`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `python test/e2e/tela.py` (com Playwright instalado; `CHROME_PATH` opcional)
Expected: FAIL nos cenários novos. Sem Playwright disponível, registre isso e siga; a Step 4 usa o painel de navegador.

- [ ] **Step 3: Implementar em `web/index.html`**

- Carregue `<script src="https://accounts.google.com/gsi/client" async defer></script>` e `<script src="frase.js"></script>` antes do script principal.
- Ao abrir: `apagarLS('afl_token')`; com `gp_sessao`, mostra `#app` e `#conta` ("Olá, {nome}" + botão `Sair`); sem, mostra `#telaLogin` com o texto "Entre com a conta Google usada na compra." e o botão do Google (`google.accounts.id.initialize({client_id: GOOGLE_CLIENT_ID, callback})` + `renderButton(#botaoGoogle, {theme: 'outline', size: 'large', text: 'signin_with', locale: 'pt-BR'})`, chamados quando a biblioteca carregar).
- `api(params)`: `fetch(API_URL, {method: 'POST', body: JSON.stringify({sessao, ...params})})` sem cabeçalho `Content-Type`. Resposta `sessao` → sai com "Sua sessão terminou (sua conta entrou em outro aparelho). Entre de novo."; `sem_acesso` → sai com "Seu acesso foi desativado. Fale com quem te vendeu o Gerador de Post.". Sair = apagar `gp_sessao`/`gp_nome`, mostrar `#telaLogin` com o aviso.
- Callback do login: `api({action: 'login', idToken: resp.credential})` sem sessão; `ok` grava sessão e nome; `sem_acesso` → "Este e-mail não tem acesso. Fale com quem te vendeu o Gerador de Post."; `login` → "Não consegui confirmar seu login. Tente de novo.".
- `#sair`: `api({action: 'sair'})` (ignora falha) e sai sem mensagem.
- `gerar()`: depois do `info` ok, preenche os campos e, com o título, chama `gerarFrase(titulo, lerLS('gp_gemini') || '')`. Avisos por `erro`: `sem_chave` → "Sem chave do Gemini: digite a frase ou configure a chave em ⚙️."; `chave` → "O Gemini recusou sua chave. Confira em ⚙️."; `limite` → "Limite do Gemini atingido. Tente daqui a pouco ou digite a frase."; `rede`/`formato` → "Não consegui criar a frase. Digite abaixo.". Enquanto espera: "Criando a frase…".
- `#config` é um `<details>` no fim do `#app`: resumo "⚙️ Sua chave do Gemini (frase automática)", campo `type="password"`, botões Salvar/Apagar, link `https://aistudio.google.com/apikey` ("Criar chave grátis"), e o texto "A chave fica só neste aparelho e vai direto para o Gemini." `#statusChave` mostra "Chave salva" ou "Sem chave".
- Estilo no padrão atual (variáveis de `:root`, `border-radius: 10px`); `#conta` em linha discreta abaixo do cabeçalho.
- README, seções 2 e 3: trocar o `TOKEN` por "Entrar com Google" e explicar ⚙️ e o link do AI Studio.

- [ ] **Step 4: Verificar**

Run: `node --test` → tudo passa. Run: `python test/e2e/tela.py` → todos os cenários passam (se houver Playwright). Sem Playwright: subir `.claude/launch.json` (`web`, porta 8765) no painel de navegador, em tamanho de celular, com `API_URL` sobrescrito para um mock via `javascript_tool` só na sessão de teste, e conferir login visível sem sessão, `#app` com sessão, ⚙️ salvando e apagando a chave, e console sem erros.

- [ ] **Step 5: Commit (sem push)**

```bash
git add web/index.html test/e2e/tela.py README.md
git commit -m "feat: tela de login com Google, conta e chave do Gemini no aparelho"
```

Não faça push: o servidor novo e a página nova precisam ir ao ar juntos (Task 5).

---

### Task 5: Configuração e publicação junto com o vendedor

Passos manuais do dono da conta; quem executa o plano guia e confere, não cria contas nem digita chaves.

**Files:**
- Modify: `web/index.html` (só o valor de `GOOGLE_CLIENT_ID`)

- [ ] **Step 1: Cliente OAuth no Google Cloud (vendedor)** — console.cloud.google.com → novo projeto "Gerador de Post" → Tela de consentimento OAuth (Externo, nome "Gerador de Post", e-mail de suporte) → publicar em produção → Credenciais → ID do cliente OAuth → "Aplicativo da Web" → Origens JavaScript autorizadas: `https://gerador-de-post.pages.dev` e `http://localhost:8765`. O vendedor informa o Client ID (`….apps.googleusercontent.com`, público).
- [ ] **Step 2: Gravar o Client ID** em `GOOGLE_CLIENT_ID` no `web/index.html`; `node --test` passa; commit `chore: client ID do login com Google`.
- [ ] **Step 3: Planilha (vendedor)** — nova Planilha Google, aba renomeada para `Clientes`, linha 1 `email | nome | ativo`, linha 2 com o e-mail do vendedor e `sim`. O ID da planilha sai da URL (`/d/<ID>/edit`).
- [ ] **Step 4: Apps Script (vendedor)** — colar `src/acesso.gs` (arquivo novo) e o novo `src/Code.gs`; apagar o arquivo `frase.gs`; Propriedades do script: adicionar `GOOGLE_CLIENT_ID` e `PLANILHA_ID`; rodar `testarAcesso` e autorizar → o registro mostra `{"nome":"…","ativo":true}`.
- [ ] **Step 5: Publicar juntos** — vendedor faz Implantar → Gerenciar implantações → ✏️ → Nova versão; logo em seguida `git push origin main`. Conferir que `https://gerador-de-post.pages.dev` serve o `index.html` novo (mesmo md5 do local) e o `frase.js`.
- [ ] **Step 6: Teste real (vendedor)** — reinstalar o app, entrar com Google, colar a chave do Gemini em ⚙️, gerar `https://meli.la/11MbeLK`: título, preço 170,99, antigo 249,99, frase e emoji preenchidos. Se o Gemini falhar por CORS no navegador, parar e reportar (é o risco do spec). Depois, o vendedor apaga `TOKEN` e `GEMINI_KEY` das Propriedades do script.
