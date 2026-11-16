import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { COR, Fundo, Legenda, fontFamily } from '../comum';

const TAREFAS = ['Copiar o título', 'Calcular o desconto', 'Inventar uma frase', 'Formatar o texto'];

// Cena 2 — a dor: tarefas aparecem e são riscadas, relógio no fim.
export const Dor: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Fundo />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 90 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26, width: 860 }}>
          {TAREFAS.map((t, i) => {
            const inicio = 6 + i * 16;
            const risco = inicio + 10;
            return (
              <div
                key={t}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 26,
                  padding: '30px 38px',
                  borderRadius: 30,
                  backgroundColor: COR.card,
                  border: `2px solid ${COR.borda}`,
                  opacity: interpolate(frame, [inicio, inicio + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
                  translate: `${interpolate(frame, [inicio, inicio + 12], [-80, 0], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                    easing: Easing.bezier(0.16, 1, 0.3, 1),
                  })}px 0px`,
                }}
              >
                <span style={{ fontSize: 56, color: COR.vermelho, fontWeight: 900 }}>✗</span>
                <span style={{ fontSize: 58, fontWeight: 700, color: COR.texto, position: 'relative' }}>
                  {t}
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: '52%',
                      height: 7,
                      borderRadius: 4,
                      backgroundColor: COR.vermelho,
                      width: `${interpolate(frame, [risco, risco + 8], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}%`,
                    }}
                  />
                </span>
              </div>
            );
          })}
          <div
            style={{
              marginTop: 26,
              textAlign: 'center',
              fontSize: 76,
              fontWeight: 900,
              color: COR.vermelho,
              opacity: interpolate(frame, [80, 92], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
              scale: `${interpolate(frame, [80, 96], [1.4, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing: Easing.spring({ damping: 12 }),
              })}`,
            }}
          >
            ⏱ minutos por post
          </div>
        </div>
      </AbsoluteFill>
      <Legenda texto="Copiar título, calcular desconto, inventar uma frase… isso leva minutos." />
    </AbsoluteFill>
  );
};
