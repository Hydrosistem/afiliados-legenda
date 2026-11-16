import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame } from 'remotion';
import { COR, Fundo, OURO_TEXTO, fontFamily } from '../comum';

// Cena 1 — gancho: pergunta gigante, "na mão?" tremendo.
// Tudo já aparece completo no quadro 0: é ele que o feed mostra antes de o vídeo tocar.
export const Gancho: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Fundo />
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          padding: 90,
          gap: 10,
          scale: interpolate(frame, [0, 14], [1.06, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        <Interactive.Div
          name="Emoji"
          style={{
            fontSize: 150,
            rotate: interpolate(frame, [6, 10, 14, 18, 22], ['0deg', '-10deg', '10deg', '-6deg', '0deg'], {
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
            scale: interpolate(frame, [10, 16, 26], [1, 1.14, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.33, 1, 0.68, 1),
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
    </AbsoluteFill>
  );
};
