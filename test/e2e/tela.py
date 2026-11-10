"""Verificação da tela em Chrome headless (Playwright), com a API simulada.
Uso: python3 test/e2e/tela.py   (precisa de playwright e google-chrome; não faz parte do `node --test`)
"""
import json, os, socket, subprocess, sys, traceback, urllib.parse
from playwright.sync_api import sync_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WEB = os.path.join(RAIZ, 'web')
ICON = open(os.path.join(WEB, 'icon-192.png'), 'rb').read()
OK = {"ok": True, "titulo": "Fone Bluetooth X", "preco": 149.9, "precoAntigo": 199.9,
      "imagem": "https://http2.mlstatic.com/D_NQ_NP_123-F.webp", "urlFinal": "https://www.mercadolivre.com.br/p/MLB1"}
T0 = '🔥 *Fone Bluetooth X*\n\nDe ~R$ 199,90~ por *R$ 149,90* (25% OFF)\n\n👉 https://meli.la/abc'

s = socket.socket(); s.bind(('127.0.0.1', 0)); PORTA = s.getsockname()[1]; s.close()
servidor = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORTA), '--directory', WEB],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def novo(p, resp=OK):
    estado = {'resp': resp, 'abortar': False, 'urls': []}
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_context(viewport={'width': 390, 'height': 844}).new_page()
    estado['erros'] = []
    pg.on('pageerror', lambda e: estado['erros'].append(str(e)))

    def api(r):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(r.request.url).query)
        if q.get('action', [''])[0] == 'info':
            estado['urls'].append(q['url'][0])
        if estado['abortar']:
            r.abort()
        else:
            r.fulfill(status=200, content_type='application/json', body=json.dumps(estado['resp']))
    pg.route('http://mock.local/**', api)
    pg.route('https://http2.mlstatic.com/**', lambda r: r.fulfill(status=200, content_type='image/png', body=ICON))
    pg.goto(f'http://127.0.0.1:{PORTA}/index.html')
    pg.evaluate("localStorage.setItem('afl_token','tok'); localStorage.removeItem('afl_tpl'); API_URL='http://mock.local/api'")
    return b, pg, estado

def gerar(pg, link=None):
    if link is not None:
        pg.fill('#link', link)
    pg.click('#gerar')
    pg.wait_for_function("!document.getElementById('gerar').disabled")

def esperar_aviso(pg, trecho):
    pg.wait_for_function("t => document.getElementById('aviso').textContent.includes(t)", arg=trecho)

def sucesso_edicao_modelo(p):
    b, pg, e = novo(p)
    gerar(pg, 'https://meli.la/abc')
    pg.wait_for_function("document.getElementById('titulo').value !== ''")
    assert pg.input_value('#legenda') == T0, pg.input_value('#legenda')
    assert not pg.is_disabled('#compartilhar') and pg.is_visible('#previa')
    pg.click('#modelo')
    assert 'OFERTA' in pg.input_value('#legenda')
    pg.fill('#preco', '99,90')
    assert '*R$ 99,90*' in pg.input_value('#legenda') and '50% OFF' in pg.input_value('#legenda')
    assert e['erros'] == [], e['erros']
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
    assert 'Digitado à mão' in pg.input_value('#legenda') and '*R$ 50,00*' in pg.input_value('#legenda')
    assert pg.is_disabled('#compartilhar')
    b.close()

def token_invalido(p):
    b, pg, e = novo(p, {"ok": False, "erro": "token"})
    gerar(pg, 'https://meli.la/abc'); esperar_aviso(pg, 'Token')
    assert pg.evaluate("localStorage.getItem('afl_token')") is None
    b.close()

def falha_apaga_produto_anterior(p):
    b, pg, e = novo(p)
    gerar(pg, 'https://meli.la/abc')
    pg.wait_for_function("document.getElementById('titulo').value !== ''")
    e['abortar'] = True
    gerar(pg, 'https://meli.la/outro'); esperar_aviso(pg, 'rede')
    assert pg.input_value('#titulo') == '' and pg.input_value('#preco') == '' and pg.input_value('#precoAntigo') == ''
    assert not pg.is_visible('#previa') and pg.is_disabled('#compartilhar')
    assert 'Fone Bluetooth X' not in pg.input_value('#legenda')
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

def modelo_alterna_a_cada_geracao(p):
    b, pg, e = novo(p)
    gerar(pg, 'https://meli.la/abc')
    pg.wait_for_function("document.getElementById('titulo').value !== ''")
    primeira = pg.input_value('#legenda')
    assert primeira == T0, primeira
    gerar(pg)
    segunda = pg.input_value('#legenda')
    assert segunda != primeira and 'OFERTA' in segunda, segunda
    b.close()

def manifest(p):
    b, pg, e = novo(p)
    assert pg.evaluate("fetch('manifest.json').then(r=>r.json()).then(j=>j.icons.length)") == 2
    b.close()

falhas = []
try:
    with sync_playwright() as p:
        for fn in [sucesso_edicao_modelo, link_curto, rede, token_invalido, falha_apaga_produto_anterior,
                   link_do_produto_reinicia, modelo_alterna_a_cada_geracao, manifest]:
            try:
                fn(p); print('ok  ', fn.__name__)
            except Exception:
                falhas.append(fn.__name__); print('FAIL', fn.__name__); traceback.print_exc(limit=2)
finally:
    servidor.terminate()
print('E2E', 'FALHOU: ' + ', '.join(falhas) if falhas else 'OK')
sys.exit(1 if falhas else 0)
