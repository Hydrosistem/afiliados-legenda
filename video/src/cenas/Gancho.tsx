import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame } from 'remotion';
import { COR, Fundo, Legenda, OURO_TEXTO, fontFamily } from '../comum';

// Cena 1 — gancho: pergunta gigante, "na mão?" tremendo.
export const Gancho: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Fundo />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 90, gap: 10 }}>
        <Interactive.Div
          name="Emoji"
          style={{
            fontSize: 150,
            scale: interpolate(frame, [0, 12], [0.3, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.spring({ damping: 12 }),
              output: 'perceptual-scale',
            }),
            rotate: interpolate(frame, [12, 16, 20, 24, 28], ['0deg', '-10deg', '10deg', '-6deg', '0deg'], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          😩
        </Interactive.Div>
        <Interactive.Div
          name="Pergunta"
          style={{
            color: COR.texto,
            fontSize: 112,
            fontWeight: 900,
            lineHeight: 1.02,
            letterSpacing: -3,
            textAlign: 'center',
            opacity: interpolate(frame, [4, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
            translate: interpolate(frame, [4, 18], ['0px 60px', '0px 0px'], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          Ainda monta post de oferta
        </Interactive.Div>
        <Interactive.Div
          name="Na mão"
          style={{
            ...OURO_TEXTO,
            fontSize: 150,
            fontWeight: 900,
            letterSpacing: -4,
            opacity: interpolate(frame, [14, 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
            scale: interpolate(frame, [14, 26], [1.6, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.spring({ damping: 10 }),
              output: 'perceptual-scale',
            }),
            translate: interpolate(frame, [30, 33, 36, 39, 42, 45], ['0px 0px', '-8px 0px', '8px 0px', '-6px 0px', '6px 0px', '0px 0px'], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          na mão?
        </Interactive.Div>
      </AbsoluteFill>
      <Legenda texto="Você ainda monta post de oferta na mão?" />
    </AbsoluteFill>
  );
};
