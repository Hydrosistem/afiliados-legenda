# Gera public/legendas.json (formato Caption do @remotion/captions) a partir dos trechos de fala
# medidos em public/voz/narracao.mp3. Dentro de cada trecho, o tempo de cada palavra é
# distribuído pelo número de sílabas. "|" marca onde a legenda troca de página.
# Uso (dentro de video/): python ferramentas/legendas.py
import json, re

TRECHOS = [
    (0.07, 2.44, 'Você ainda monta | post de oferta | na mão? |'),
    (2.64, 4.25, 'Copiar título, | calcular desconto, |'),
    (4.39, 5.22, 'inventar uma frase... |'),
    (5.38, 5.92, 'isso'),
    (6.17, 7.33, 'leva minutos. |'),
    (7.61, 11.27, 'Com o Gerador de Post, | você só cola | o link | do Mercado Livre | ou da Shopee... |'),
    (11.44, 11.87, 'e recebe'),
    (12.03, 13.21, 'foto, preços | e uma frase |'),
    (13.27, 14.45, 'criada por IA, |'),
    (14.55, 15.60, 'prontos pro seu canal. |'),
    (15.93, 16.38, 'Quer o link? |'),
    (16.69, 18.66, 'Comenta GERAR | aqui embaixo, | que eu te mando! |'),
]


def silabas(palavra):
    p = palavra.lower()
    if p == 'ia':
        return 2  # lido "i-a"
    return max(1, len(re.findall(r'[aeiouáéíóúâêôãõà]+', p)))


legendas = []
for inicio, fim, texto in TRECHOS:
    tokens = texto.split()
    palavras = [t for t in tokens if t != '|']
    total = sum(silabas(p) for p in palavras)
    t = inicio
    for i, tok in enumerate(tokens):
        if tok == '|':
            legendas[-1]['pageBreakAfter'] = True
            continue
        dur = (fim - inicio) * silabas(tok) / total
        legendas.append({
            'text': ' ' + tok,
            'startMs': round(t * 1000),
            'endMs': round((t + dur) * 1000),
            'timestampMs': round((t + dur / 2) * 1000),
            'confidence': None,
        })
        t += dur

legendas[0]['text'] = legendas[0]['text'].lstrip()
with open('public/legendas.json', 'w', encoding='utf-8') as f:
    json.dump(legendas, f, ensure_ascii=False, indent=2)
print(len(legendas), 'palavras')
