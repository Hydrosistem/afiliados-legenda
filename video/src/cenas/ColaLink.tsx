import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { COR, Celular, Fundo, OURO_TEXTO, fontFamily } from '../comum';

// Cena 3 — a solução: logo do Gerador, celular com o link colado e o toque em "Gerar".
export const ColaLink: React.FC = () => {
  const frame = useCurrentFrame();
  const toque = 95;
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Fundo />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingBottom: 260, gap: 56 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 26,
            opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
            scale: `${interpolate(frame, [0, 14], [0.7, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.spring({ damping: 12 }),
            })}`,
          }}
        >
          <Img src={staticFile('img/icon-192.png')} style={{ width: 120, height: 120, borderRadius: 32, border: '5px solid #fff' }} />
          <div style={{ fontSize: 84, fontWeight: 900, color: COR.texto, letterSpacing: -2 }}>Gerador de Post</div>
        </div>
        <div
          style={{
            fontSize: 70,
            fontWeight: 900,
            textAlign: 'center',
            lineHeight: 1.1,
            opacity: interpolate(frame, [12, 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          }}
        >
          <span style={{ color: COR.texto }}>Só cole o </span>
          <span style={OURO_TEXTO}>link de afiliado</span>
        </div>
        <div
          style={{
            position: 'relative',
            translate: `0px ${interpolate(frame, [18, 40], [500, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            })}px`,
          }}
        >
          <Celular largura={920}>
            <Img src={staticFile('img/tela-link.jpg')} style={{ display: 'block', width: '100%' }} />
          </Celular>
          {/* Toque no botão Gerar (canto inferior direito da tela) */}
          <div
            style={{
              position: 'absolute',
              right: 58,
              bottom: 62,
              width: 120,
              height: 120,
              marginRight: -30,
              marginBottom: -30,
              borderRadius: '50%',
              border: `8px solid ${COR.ouro}`,
              opacity: interpolate(frame, [toque - 4, toque, toque + 14], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
              scale: `${interpolate(frame, [toque, toque + 14], [0.4, 1.4], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 40,
              bottom: 20,
              fontSize: 110,
              opacity: interpolate(frame, [toque - 25, toque - 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
              translate: `${interpolate(frame, [toque - 25, toque - 2, toque + 4], [120, 0, 6], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              })}px ${interpolate(frame, [toque - 25, toque - 2, toque + 4], [160, 0, 6], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              })}px`,
            }}
          >
            👆
          </div>
        </div>
        <div style={{ display: 'flex', gap: 22, fontSize: 48, fontWeight: 700, color: COR.cinza }}>
          <span>Mercado Livre</span>
          <span style={{ color: COR.ouro }}>•</span>
          <span>Shopee</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
