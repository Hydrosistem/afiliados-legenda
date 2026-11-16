# Trilha "premium" original: groove lento (92 BPM), piano elétrico com acordes de 7ª e 9ª,
# pad quente, sub grave, bateria suave e reverb de sala grande. Sem direitos autorais.
import sys, wave
import numpy as np

SR = 44100
BPM = 92
BEAT = 60 / BPM
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 20.5
N = int(SR * DUR) + SR * 3  # cauda para o reverb
rng = np.random.default_rng(11)


def fft_conv(x, h):
    n = 1 << int(np.ceil(np.log2(len(x) + len(h))))
    y = np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(h, n), n)
    return y[: len(x)]


def lowpass(x, cutoff, taps=255):
    fc = cutoff / SR
    n = np.arange(taps) - (taps - 1) / 2
    h = np.sinc(2 * fc * n) * np.blackman(taps)
    return fft_conv(x, h / h.sum())


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(buf, s, t0):
    i = int(t0 * SR)
    if i >= len(buf):
        return
    f = min(len(buf), i + len(s))
    buf[i:f] += s[: f - i]


def adsr(n, a, d, s, r):
    t = np.arange(n) / SR
    tot = n / SR
    env = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    rel = np.clip((tot - t) / max(r, 1e-4), 0, 1)
    return env * rel


def epiano(m, dur, vel=1.0):
    # piano elétrico tipo Rhodes: senoide + parcial de sino que some rápido
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(m)
    corpo = np.sin(2 * np.pi * f * t + 0.6 * np.sin(2 * np.pi * f * t) * np.exp(-t * 3))
    sino = 0.35 * np.sin(2 * np.pi * f * 7.0 * t) * np.exp(-t * 18)
    trem = 1 + 0.06 * np.sin(2 * np.pi * 4.5 * t)
    return vel * (corpo + sino) * np.exp(-t * 1.6) * trem * np.minimum(1, t / 0.004) * np.clip((dur - t) / 0.08, 0, 1)


def pad_voz(m, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for det in (-0.06, 0.0, 0.07):
        f = hz(m + det)
        s += np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t) + 0.1 * np.sin(2 * np.pi * 3 * f * t)
    return s * adsr(n, 0.9, 1.5, 0.8, 1.0)


# Acordes: Am9 – Fmaj9 – Cmaj7 – G6(9)
ACORDES = [
    (33, [60, 64, 67, 71]),  # Lá menor 9
    (29, [57, 60, 64, 67]),  # Fá maior 9
    (36, [59, 64, 67, 71]),  # Dó maior 7
    (31, [57, 59, 62, 67]),  # Sol 6/9
]
COMP = 4 * BEAT

piano = np.zeros(N); pad = np.zeros(N); sub = np.zeros(N); kick = np.zeros(N); snap = np.zeros(N); shaker = np.zeros(N)

n_comp = int(DUR / COMP) + 1
for c in range(n_comp):
    raiz, notas = ACORDES[c % 4]
    t0 = c * COMP
    # Pad sustentado
    for m in notas:
        add(pad, pad_voz(m - 12, COMP + 0.8), t0)
    # Piano: acorde no 1, notas soltas em colcheias com swing leve
    for k, m in enumerate(notas):
        add(piano, epiano(m, 2.2, 0.55) , t0 + k * 0.012)  # dedilhado rápido
    padrao = [(1.5, 3), (2.0, 2), (2.75, 1), (3.5, 3)]
    for tempo, idx in padrao:
        add(piano, epiano(notas[idx] + 12, 1.2, 0.3), t0 + tempo * BEAT)
    # Sub grave sustentado com ataque suave
    n = int(COMP * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * hz(raiz + 12) * t) * adsr(n, 0.03, 0.8, 0.85, 0.15)
    add(sub, s, t0)

# Bateria suave
tk = np.arange(int(0.45 * SR)) / SR
som_kick = np.sin(2 * np.pi * np.cumsum(48 + 60 * np.exp(-tk * 35)) / SR) * np.exp(-tk * 7)
tn = np.arange(int(0.25 * SR)) / SR
ruido = rng.standard_normal(len(tn))
som_snap = (highpass(ruido, 1800) * np.exp(-tn * 30) + 0.4 * np.sin(2 * np.pi * 190 * tn) * np.exp(-tn * 40))
ts = np.arange(int(0.07 * SR)) / SR
som_shaker = highpass(rng.standard_normal(len(ts)), 6000) * np.sin(np.pi * ts / ts[-1]) ** 2

total_b = int(DUR / BEAT) + 1
for b in range(total_b):
    tb = b * BEAT
    if b % 4 in (0,):
        add(kick, som_kick, tb)
    if b % 4 == 2:
        add(kick, som_kick * 0.8, tb - BEAT / 2)  # "e" do 2
        add(kick, som_kick * 0.9, tb + BEAT / 4)
    if b % 2 == 1:
        add(snap, som_snap, tb)
    for k in range(4):
        sw = 0.03 if k % 2 else 0  # swing
        add(shaker, som_shaker * (0.6 if k % 2 == 0 else 1.0), tb + k * BEAT / 4 + sw)

# Reverb de sala grande
ir_t = np.arange(int(2.6 * SR)) / SR
ir = rng.standard_normal(len(ir_t)) * np.exp(-ir_t / 0.55)
ir = lowpass(ir, 5000)
ir /= np.sqrt(np.sum(ir ** 2))


def norm(x):
    return x / (np.abs(x).max() + 1e-9)


piano = lowpass(norm(piano), 5000)
pad = lowpass(norm(pad), 1400)
seco = 0.55 * piano + 0.30 * pad + 0.10 * norm(snap) + 0.05 * norm(shaker)
molhado = fft_conv(seco, ir)
mix = seco + 0.55 * norm(molhado) * np.abs(seco).max() + 0.42 * norm(lowpass(sub, 200)) + 0.55 * norm(kick)

mix = mix[: int(DUR * SR)]
fi, fo = int(0.6 * SR), int(1.8 * SR)
mix[:fi] *= np.linspace(0, 1, fi) ** 2
mix[-fo:] *= np.linspace(1, 0, fo) ** 1.5
mix = np.tanh(1.3 * norm(mix)) / np.tanh(1.3)  # saturação leve, calor de fita
mix *= 0.89

st = np.stack([mix, mix], axis=1)
# leve abertura estéreo: atraso de 12 ms no canal direito só do reverb seria ideal; aqui um Haas sutil no todo
d = int(0.008 * SR)
st[d:, 1] = 0.85 * st[d:, 1] + 0.15 * mix[:-d]
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(st, -1, 1) * 32767).astype('<i2').tobytes())
print('ok', DUR)
