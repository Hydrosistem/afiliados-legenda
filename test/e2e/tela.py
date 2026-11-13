"""Verificação da tela em Chrome headless (Playwright), com a API e o Gemini simulados.
Uso: python3 test/e2e/tela.py   (precisa de playwright e Chrome; não faz parte do `node --test`)
CHROME_PATH aponta pro executável do Chrome; sem ela, usa o Chromium do próprio Playwright.
"""
import json, os, socket, subprocess, sys, traceback, urllib.parse
from playwright.sync_api import sync_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WEB = os.path.join(RAIZ, 'web')
ICON = open(os.path.join(WEB, 'icon-192.png'), 'rb').read()

OK = {"ok": True, "titulo": "Fone Bluetooth X", "preco": 149.9, "precoAntigo": 199.9,
      "imagem": "https://http2.mlstatic.com/D_NQ_NP_123-F.webp", "urlFinal": "https://www.mercadolivre.com.br/p/MLB1"}
T0 = '*FONE BLUETOOTH X* 🎧\n\nde ~R$199,90~ por 💥 *R$149,90*💥\n\n💗 _Som potente pra animar seu dia!!_\n\n🏠 https://meli.la/abc'

FRASE_PADRAO = {"frase": "Som potente pra animar seu dia!!", "emoji": "🎧"}

# Substitui o script real do Google: expõe um google.accounts.id falso que só registra as
# chamadas (initialize/renderButton) em window.__gsi, pra conferir que o botão é sempre redesenhado.
GSI_FALSO = """
window.__gsi = window.__gsi || [];
window.google = { accounts: { id: {
  initialize: function (cfg) { window.__gsi.push({ fn: 'initialize', cfg: cfg }); },
  renderButton: function (el, opts) {
    window.__gsi.push({ fn: 'renderButton', opts: opts });
    el.textContent = 'BOTAO_GOOGLE_FAKE';
  }
} } };
"""

s = socket.socket(); s.bind(('127.0.0.1', 0)); PORTA = s.getsockname()[1]; s.close()
servidor = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORTA), '--directory', WEB],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def resposta_gemini(estado):
    if estado['geminiStatus'] != 200:
        return estado['geminiStatus'], '{}'
    corpo = estado.get('geminiResp') or FRASE_PADRAO
    return 200, json.dumps({"candidates": [{"content": {"parts": [{"text": json.dumps(corpo)}]}}]})


def novo(p, resp=OK, com_chave=False, sem_sessao=False, nome='Maria', bloquear_google=False):
    estado = {'resp': resp, 'abortar': False, 'urls': [], 'corpos': [], 'geminiHeaders': [],
              'geminiStatus': 200, 'geminiResp': None, 'erros': []}
    b = p.chromium.launch(executable_path=os.environ.get('CHROME_PATH'), args=['--no-sandbox'])
    pg = b.new_context(viewport={'width': 390, 'height': 844}).new_page()
    pg.on('pageerror', lambda e: estado['erros'].append(str(e)))

    def api(r):
        try:
            corpo = json.loads(r.request.post_data)
        except Exception:
            corpo = {}
        estado['corpos'].append(corpo)
        if estado['abortar']:
            r.abort()
            return
        acao = corpo.get('action')
        if acao == 'info':
            estado['urls'].append(corpo.get('url'))
            r.fulfill(status=200, content_type='application/json', body=json.dumps(estado['resp']))
        elif acao == 'sair':
            r.fulfill(status=200, content_type='application/json', body=json.dumps({"ok": True}))
        else:
            r.fulfill(status=200, content_type='application/json', body=json.dumps({"ok": False, "erro": "acao"}))

    def gemini(r):
        estado['geminiHeaders'].append(r.request.headers.get('x-goog-api-key'))
        status, body = resposta_gemini(estado)
        r.fulfill(status=status, content_type='application/json', body=body)

    def google_route(r):
        if bloquear_google:
            r.abort()
        else:
            r.fulfill(status=200, content_type='application/javascript', body=GSI_FALSO)

    pg.route('http://mock.local/**', api)
    pg.route('https://generativelanguage.googleapis.com/**', gemini)
    pg.route('https://accounts.google.com/**', google_route)
    pg.route('https://http2.mlstatic.com/**', lambda r: r.fulfill(status=200, content_type='image/png', body=ICON))
    pg.goto(f'http://127.0.0.1:{PORTA}/index.html')
    if not sem_sessao:
        script = "localStorage.setItem('gp_sessao','s1'); localStorage.setItem('gp_nome', %s);" % json.dumps(nome)
        if com_chave:
            script += "localStorage.setItem('gp_gemini','kTESTE');"
        pg.evaluate(script)
        pg.reload()
    pg.evaluate("API_URL='http://mock.local/api'")
    return b, pg, estado


def gerar(pg, link=None):
    if link is not None:
        pg.fill('#link', link)
    pg.click('#gerar')
    pg.wait_for_function("!document.getElementById('gerar').disabled")


def esperar_aviso(pg, trecho):
    pg.wait_for_function("t => document.getElementById('aviso').textContent.includes(t)", arg=trecho)


def sem_sessao_mostra_login(p):
    b, pg, e = novo(p, sem_sessao=True)
    pg.evaluate("localStorage.setItem('afl_token','velho')")
    pg.reload()
    assert pg.is_visible('#telaLogin') and not pg.is_visible('#app')
    assert pg.evaluate("localStorage.getItem('afl_token')") is None
    b.close()


def sessao_derrubada_volta_ao_login(p):
    b, pg, e = novo(p, resp={"ok": False, "erro": "sessao"})
    gerar(pg, 'https://meli.la/abc')
    pg.wait_for_selector('#telaLogin:not([hidden])')
    assert 'Sua sessão terminou' in pg.inner_text('#avisoLogin'), pg.inner_text('#avisoLogin')
    assert pg.evaluate("localStorage.getItem('gp_sessao')") is None
    # o botão do Google tem que reaparecer: não há como recarregar a página no app instalado.
    pg.wait_for_function("document.getElementById('botaoGoogle').textContent.includes('BOTAO_GOOGLE_FAKE')")
    b.close()


def falha_carregar_google(p):
    # Não depende de qual caminho pega a falha primeiro (onerror do script, que pode disparar antes
    # do script principal rodar, ou o prazo de ~8s de segurança): só espera o aviso aparecer, com
    # tempo de sobra além dos 8s do prazo.
    b, pg, e = novo(p, sem_sessao=True, bloquear_google=True)
    pg.wait_for_function(
        "t => document.getElementById('avisoLogin').textContent.includes(t)",
        arg='Não consegui carregar o login do Google', timeout=12000)
    b.close()


def acesso_desativado(p):
    b, pg, e = novo(p, resp={"ok": False, "erro": "sem_acesso"})
    gerar(pg, 'https://meli.la/abc')
    pg.wait_for_selector('#telaLogin:not([hidden])')
    assert 'acesso foi desativado' in pg.inner_text('#avisoLogin'), pg.inner_text('#avisoLogin')
    assert pg.evaluate("localStorage.getItem('gp_sessao')") is None
    b.close()


def sucesso_edicao(p):
    b, pg, e = novo(p, com_chave=True)
    gerar(pg, 'https://meli.la/abc')
    pg.wait_for_function("document.getElementById('titulo').value !== ''")
    assert pg.input_value('#legenda') == T0, pg.input_value('#legenda')
    assert pg.input_value('#frase') == 'Som potente pra animar seu dia!!' and pg.input_value('#emoji') == '🎧'
    assert not pg.is_disabled('#compartilhar') and pg.is_visible('#previa')
    pg.fill('#preco', '99,90')
    assert 'de ~R$199,90~ por 💥 *R$99,90*💥' in pg.input_value('#legenda'), pg.input_value('#legenda')
    pg.fill('#frase', 'Outra frase!!'); pg.fill('#emoji', '🔥')
    assert '💗 _Outra frase!!_' in pg.input_value('#legenda') and pg.input_value('#legenda').startswith('*FONE BLUETOOTH X* 🔥')
    assert e['erros'] == [], e['erros']
    b.close()


def frase_com_chave(p):
    b, pg, e = novo(p, com_chave=True)
    gerar(pg, 'https://meli.la/abc')
    pg.wait_for_function("document.getElementById('titulo').value !== ''")
    assert pg.input_value('#frase') == 'Som potente pra animar seu dia!!' and pg.input_value('#emoji') == '🎧'
    assert e['geminiHeaders'] and e['geminiHeaders'][-1] == 'kTESTE', e['geminiHeaders']
    assert all('kTESTE' not in json.dumps(c) for c in e['corpos']), e['corpos']
    b.close()


def frase_sem_chave(p):
    b, pg, e = novo(p)
    gerar(pg, 'https://meli.la/abc')
    pg.wait_for_function("document.getElementById('titulo').value !== ''")
    assert e['geminiHeaders'] == [], e['geminiHeaders']
    assert 'configure a chave em ⚙️' in pg.inner_text('#aviso'), pg.inner_text('#aviso')
    b.close()


def chave_recusada(p):
    b, pg, e = novo(p, com_chave=True)
    e['geminiStatus'] = 400
    gerar(pg, 'https://meli.la/abc')
    pg.wait_for_function("document.getElementById('titulo').value !== ''")
    assert '💗' not in pg.input_value('#legenda'), pg.input_value('#legenda')
    assert 'recusou sua chave' in pg.inner_text('#aviso'), pg.inner_text('#aviso')
    b.close()


def link_curto(p):
    b, pg, e = novo(p, {"ok": False, "erro": "link_curto"})
    gerar(pg, 'https://meli.la/abc')
    pg.wait_for_selector('#blocoProduto:not([hidden])')
    assert 'link do produto' in pg.inner_text('#aviso').lower()
    b.close()


def rede(p):
    b, pg, e = novo(p); e['abortar'] = True
    gerar(pg, 'https://meli.la/abc'); esperar_aviso(pg, 'rede')
    pg.fill('#titulo', 'Digitado à mão'); pg.fill('#preco', '50')
    assert '*DIGITADO À MÃO*' in pg.input_value('#legenda') and 'por 💥 *R$50*💥' in pg.input_value('#legenda'), pg.input_value('#legenda')
    assert pg.is_disabled('#compartilhar')
    b.close()


def falha_apaga_produto_anterior(p):
    b, pg, e = novo(p)
    gerar(pg, 'https://meli.la/abc')
    pg.wait_for_function("document.getElementById('titulo').value !== ''")
    e['abortar'] = True
    gerar(pg, 'https://meli.la/outro'); esperar_aviso(pg, 'rede')
    assert pg.input_value('#titulo') == '' and pg.input_value('#preco') == '' and pg.input_value('#precoAntigo') == ''
    assert pg.input_value('#frase') == '' and pg.input_value('#emoji') == ''
    assert not pg.is_visible('#previa') and pg.is_disabled('#compartilhar')
    assert 'FONE BLUETOOTH X' not in pg.input_value('#legenda')
    assert 'https://meli.la/outro' in pg.input_value('#legenda')
    b.close()


def link_do_produto_reinicia(p):
    b, pg, e = novo(p, {"ok": False, "erro": "link_curto"})
    gerar(pg, 'https://meli.la/abc')
    pg.wait_for_selector('#blocoProduto:not([hidden])')
    pg.fill('#produto', 'https://www.mercadolivre.com.br/p/MLB9')
    e['resp'] = OK
    gerar(pg)
    assert e['urls'][-1] == 'https://www.mercadolivre.com.br/p/MLB9', e['urls']
    assert not pg.is_visible('#blocoProduto') and pg.input_value('#produto') == ''
    gerar(pg, 'https://meli.la/novo')
    assert e['urls'][-1] == 'https://meli.la/novo', e['urls']
    # trocar o link de afiliado também reinicia o campo
    e['resp'] = {"ok": False, "erro": "link_curto"}
    gerar(pg, 'https://meli.la/outro2')
    pg.wait_for_selector('#blocoProduto:not([hidden])')
    pg.fill('#produto', 'https://www.mercadolivre.com.br/p/MLB7')
    pg.fill('#link', 'https://meli.la/diferente')
    assert not pg.is_visible('#blocoProduto') and pg.input_value('#produto') == ''
    b.close()


def nova_geracao_troca_a_frase(p):
    b, pg, e = novo(p, com_chave=True)
    gerar(pg, 'https://meli.la/abc')
    pg.wait_for_function("document.getElementById('titulo').value !== ''")
    pg.fill('#frase', 'editada')
    e['geminiResp'] = {"frase": "Nova frase!!", "emoji": "🛒"}
    gerar(pg)
    assert pg.input_value('#frase') == 'Nova frase!!' and pg.input_value('#emoji') == '🛒'
    assert '💗 _Nova frase!!_' in pg.input_value('#legenda')
    b.close()


def sair(p):
    b, pg, e = novo(p)
    pg.click('#sair')
    pg.wait_for_selector('#telaLogin:not([hidden])')
    assert {"action": "sair", "sessao": "s1"} in e['corpos'], e['corpos']
    assert pg.evaluate("localStorage.getItem('gp_sessao')") is None
    # idem: depois de Sair o botão do Google precisa estar desenhado de novo, sem reload.
    pg.wait_for_function("document.getElementById('botaoGoogle').textContent.includes('BOTAO_GOOGLE_FAKE')")
    b.close()


def manifest(p):
    b, pg, e = novo(p)
    assert pg.evaluate("fetch('manifest.json').then(r=>r.json()).then(j=>j.icons.length)") == 2
    b.close()


falhas = []
try:
    with sync_playwright() as p:
        for fn in [sem_sessao_mostra_login, sessao_derrubada_volta_ao_login, acesso_desativado,
                   falha_carregar_google, sucesso_edicao, frase_com_chave, frase_sem_chave, chave_recusada,
                   link_curto, rede, falha_apaga_produto_anterior, link_do_produto_reinicia,
                   nova_geracao_troca_a_frase, sair, manifest]:
            try:
                fn(p); print('ok  ', fn.__name__)
            except Exception:
                falhas.append(fn.__name__); print('FAIL', fn.__name__); traceback.print_exc(limit=2)
finally:
    servidor.terminate()
print('E2E', 'FALHOU: ' + ', '.join(falhas) if falhas else 'OK')
sys.exit(1 if falhas else 0)
