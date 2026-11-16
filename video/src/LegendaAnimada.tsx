import { useCallback, useEffect, useMemo, useState } from 'react';
import { AbsoluteFill, Easing, Sequence, interpolate, staticFile, useCurrentFrame, useDelayRender, useVideoConfig } from 'remotion';
import { createTikTokStyleCaptions } from '@remotion/captions';
import type { Caption, TikTokPage } from '@remotion/captions';
import { fontFamily } from './comum';

// Legenda estilo motion design: sem caixa, palavras surgindo no ritmo da fala,
// palavras-chave em dourado. Tempos em public/legendas.json (gerado por ferramentas/legendas.py).

const DESTAQUES = new Set(['mão?', 'minutos.', 'Gerador', 'Post,', 'IA,', 'GERAR']);
const SOBRA_MS = 600; // quanto a página fica na tela depois da última palavra

const ehDestaque = (tokens: TikTokPage['tokens'], i: number) => {
  const palavra = tokens[i].text.trim();
  if (DESTAQUES.has(palavra)) return true;
  // o "de" de "Gerador de Post"
  return palavra === 'de' && tokens[i - 1]?.text.trim() === 'Gerador';
};

// `somePorUltimo`: some no fim só quando há uma pausa depois; se a próxima frase vem colada, troca direto.
const Pagina: React.FC<{ pagina: TikTokPage; duracao: number; somePorUltimo: boolean }> = ({ pagina, duracao, somePorUltimo }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const agoraMs = pagina.startMs + (frame / fps) * 1000;
  const saida = somePorUltimo
    ? interpolate(frame, [duracao - 5, duracao], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 1;
  // Entrada da frase inteira: sobe, desfoca e aparece em ~6 quadros.
  const entrada = interpolate(frame, [0, 6], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 250, paddingLeft: 80, paddingRight: 80 }}>
      <div
        style={{
          fontFamily,
          fontSize: 84,
          fontWeight: 900,
          lineHeight: 1.08,
          letterSpacing: -2,
          textAlign: 'center',
          whiteSpace: 'pre-wrap',
          opacity: saida * entrada,
          translate: `0px ${(1 - entrada) * 30}px`,
          scale: `${0.92 + 0.08 * entrada}`,
          filter: `blur(${(1 - entrada) * 6}px)`,
        }}
      >
        {pagina.tokens.map((token, i) => {
          // p: 0 antes de a palavra ser falada, 1 depois (transição de ~120 ms)
          const p = interpolate(agoraMs, [token.fromMs, token.fromMs + 120], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          });
          // pulo da palavra que está sendo falada
          const pulo = interpolate(agoraMs, [token.fromMs, token.fromMs + 90, token.toMs + 120], [0, 1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const destaque = ehDestaque(pagina.tokens, i);
          return (
            <span
              key={`${token.fromMs}-${i}`}
              style={{
                display: 'inline-block',
                whiteSpace: 'pre',
                opacity: 0.35 + 0.65 * p,
                translate: `0px ${-6 * pulo}px`,
                scale: `${1 + 0.07 * pulo}`,
                filter: 'drop-shadow(0 8px 22px rgba(0,0,0,.65))',
                color: destaque ? undefined : '#ffffff',
                ...(destaque
                  ? {
                      backgroundImage: 'linear-gradient(180deg, #fff3a8 0%, #ffd84d 45%, #ffb800 100%)',
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }
                  : {}),
              }}
            >
              {token.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const LegendaAnimada: React.FC = () => {
  const { fps, durationInFrames } = useVideoConfig();
  const [legendas, setLegendas] = useState<Caption[] | null>(null);
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender('Carregando legendas'));

  const carregar = useCallback(async () => {
    try {
      const resp = await fetch(staticFile('legendas.json'));
      setLegendas(await resp.json());
      continueRender(handle);
    } catch (e) {
      cancelRender(e);
    }
  }, [continueRender, cancelRender, handle]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const paginas = useMemo(() => {
    if (!legendas) return [];
    // Só troca de página onde o legendas.json marca pageBreakAfter.
    return createTikTokStyleCaptions({ captions: legendas, combineTokensWithinMilliseconds: 60000 }).pages;
  }, [legendas]);

  return (
    <AbsoluteFill>
      {paginas.map((pagina, i) => {
        const proxima = paginas[i + 1] ?? null;
        const ultimoToken = pagina.tokens[pagina.tokens.length - 1];
        const inicio = Math.round((pagina.startMs / 1000) * fps);
        const colada = proxima !== null && proxima.startMs <= ultimoToken.toMs + SOBRA_MS;
        const fimMs = proxima ? Math.min(proxima.startMs, ultimoToken.toMs + SOBRA_MS) : (durationInFrames / fps) * 1000;
        const duracao = Math.round((fimMs / 1000) * fps) - inicio;
        if (duracao <= 0) return null;
        return (
          <Sequence key={i} from={inicio} durationInFrames={duracao} name={`legenda: ${pagina.text.trim()}`}>
            <Pagina pagina={pagina} duracao={duracao} somePorUltimo={!colada} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
