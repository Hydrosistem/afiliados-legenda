import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { COR, Fundo, Legenda, OURO_TEXTO, fontFamily } from '../comum';

// Cena 6 — chamada: "Comente GERAR", comentário sendo digitado e seta pulsando para baixo.
export const Comente: React.FC = () => {
  const frame = useCurrentFrame();
  const palavra = 'GERAR';
  const letras = Math.floor(interpolate(frame, [30, 50], [0, palavra.length], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Fundo />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 46, paddingBottom: 200 }}>
        <div
          style={{
            fontSize: 96,
            fontWeight: 900,
            color: COR.texto,
            letterSpacing: -2,
            opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          }}
        >
          Quer o link?
        </div>
        <div
          style={{
            textAlign: 'center',
            lineHeight: 1,
            scale: `${interpolate(frame, [8, 22], [0.5, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.spring({ damping: 10 }),
            })}`,
            opacity: interpolate(frame, [8, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          }}
        >
          <div style={{ fontSize: 88, fontWeight: 800, color: COR.cinza }}>Comente</div>
          <div style={{ ...OURO_TEXTO, fontSize: 230, fontWeight: 900, letterSpacing: -6 }}>GERAR</div>
        </div>

        {/* Comentário estilo Instagram sendo digitado */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            width: 860,
            padding: '26px 30px',
            borderRadius: 40,
            backgroundColor: COR.card,
            border: `2px solid ${COR.borda}`,
            opacity: interpolate(frame, [22, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
            translate: `0px ${interpolate(frame, [22, 36], [80, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            })}px`,
          }}
        >
          <div
            style={{
              width: 90,
              height: 90,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ffe14d, #ff8a00)',
              display: 'grid',
              placeItems: 'center',
              fontSize: 48,
            }}
          >
            🙋
          </div>
          <div style={{ flex: 1, fontSize: 52, fontWeight: 700, color: COR.texto }}>
            {palavra.slice(0, letras)}
            <span style={{ opacity: frame % 20 < 10 ? 1 : 0, color: COR.ouro }}>|</span>
          </div>
          <div
            style={{
              padding: '16px 28px',
              borderRadius: 24,
              fontSize: 40,
              fontWeight: 800,
              color: '#111',
              background: 'linear-gradient(180deg, #ffe14d, #ffc400)',
              scale: `${interpolate(frame, [54, 58, 62], [1, 0.9, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}`,
            }}
          >
            Publicar
          </div>
        </div>

        <div
          style={{
            fontSize: 120,
            color: COR.ouro,
            translate: `0px ${interpolate(frame % 30, [0, 15, 30], [0, 22, 0])}px`,
            opacity: interpolate(frame, [40, 50], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          }}
        >
          ⬇
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            opacity: interpolate(frame, [60, 72], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          }}
        >
          <Img src={staticFile('img/icon-192.png')} style={{ width: 70, height: 70, borderRadius: 20 }} />
          <span style={{ fontSize: 44, fontWeight: 800, color: COR.texto }}>Gerador de Post</span>
        </div>
      </AbsoluteFill>
      <Legenda texto="Quer o link? Comenta GERAR aqui embaixo que eu te mando!" />
    </AbsoluteFill>
  );
};
