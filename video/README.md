# Vídeo promocional do Gerador de Post

Anúncio vertical (1080×1920, 30 fps, ~20 s) para Facebook e Instagram, feito em [Remotion](https://www.remotion.dev).
Termina pedindo para a pessoa comentar **GERAR**; o preço só aparece na página `/conhecer`.

## Como usar

```bash
npm install
npm run dev        # abre o Remotion Studio para ver e ajustar
npx remotion render src/index.ts Anuncio out/bruto.mp4 --codec=h264 --crf=18
npx remotion ffmpeg -i out/bruto.mp4 -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:a aac -b:a 192k -ar 48000 out/anuncio-gerador-de-post.mp4
```

O segundo comando deixa o volume no padrão de Reels (-14 LUFS).

## Onde fica cada coisa

- `src/roteiro.ts`: cenas, falas e duração de cada uma. As durações casam com as pausas de `public/voz/narracao.mp3` (voz Jonas, ElevenLabs, gravada de uma vez só).
- `src/cenas/`: uma animação por cena (Gancho, Dor, ColaLink, Resultado, Comente).
- `src/Sons.tsx`: trilha de fundo e efeitos sonoros, cada efeito no quadro da sua animação.
- `public/sfx/`: efeitos do pacote de sons do Remotion.
- `public/musica/trilha.wav`: trilha original gerada por `ferramentas/trilha.py` (`python ferramentas/trilha.py public/musica/trilha.wav 20.5`, requer numpy).

Ao trocar a narração, meça as pausas do áudio novo e ajuste `segundos` em `src/roteiro.ts`.
