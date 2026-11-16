import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { COR, Fundo, OURO_TEXTO, fontFamily } from '../comum';

const ITENS = [
  { emoji: '🖼️', texto: 'Foto' },
  { emoji: '💰', texto: 'Preços' },
  { emoji: '✨', texto: 'Frase com IA' },
];

// Cena 4 — o resultado: selos aparecendo e a postagem pronta no balão do WhatsApp.
export const Resultado: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Fundo />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 150, gap: 46 }}>
        <div style={{ display: 'flex', gap: 22 }}>
          {ITENS.map((it, i) => (
            <div
              key={it.texto}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '18px 28px',
                borderRadius: 99,
                backgroundColor: 'rgba(255,214,0,.10)',
                border: '2px solid rgba(255,214,0,.45)',
                color: COR.ouro,
                fontSize: 42,
                fontWeight: 800,
                opacity: interpolate(frame, [i * 8, i * 8 + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
                scale: `${interpolate(frame, [i * 8, i * 8 + 14], [0.5, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                  easing: Easing.spring({ damping: 11 }),
                })}`,
              }}
            >
              <span>{it.emoji}</span>
              <span>{it.texto}</span>
            </div>
          ))}
        </div>

        <div
          style={{
            width: 840,
            borderRadius: 48,
            padding: '30px 30px 30px 44px',
            backgroundColor: '#1b1b1f',
            border: `2px solid ${COR.borda}`,
            boxShadow: '0 40px 100px rgba(0,0,0,.6), 0 0 140px rgba(255,200,0,.12)',
            opacity: interpolate(frame, [22, 34], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
            translate: `0px ${interpolate(frame, [22, 44], [260, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            })}px`,
          }}
        >
          <div
            style={{
              position: 'relative',
              backgroundColor: COR.verde,
              borderRadius: '0 26px 26px 26px',
              padding: '16px 26px 50px',
              color: '#111',
              fontSize: 40,
              lineHeight: 1.4,
            }}
          >
            <Img
              src={staticFile('img/exemplo-fone.jpg')}
              style={{ display: 'block', width: 'calc(100% + 30px)', margin: '-6px -15px 18px', borderRadius: 18, aspectRatio: '4 / 3', objectFit: 'cover' }}
            />
            <div style={{ opacity: interpolate(frame, [46, 54], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
              <b>FONE BLUETOOTH SEM FIO</b> 🎧
            </div>
            <div style={{ opacity: interpolate(frame, [56, 64], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
              de <s>R$199,90</s> por 💥 <b>R$89,90</b>💥
            </div>
            <div style={{ opacity: interpolate(frame, [66, 74], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
              💗 <i>Som potente pra acompanhar o seu dia todo</i>
            </div>
            <div style={{ color: '#027eb5', opacity: interpolate(frame, [76, 84], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
              🏠 https://meli.la/…
            </div>
            <span style={{ position: 'absolute', right: 22, bottom: 12, fontSize: 28, color: '#667781' }}>14:32</span>
          </div>
        </div>

        <div
          style={{
            fontSize: 64,
            fontWeight: 900,
            opacity: interpolate(frame, [92, 102], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          }}
        >
          <span style={{ color: COR.texto }}>Pronto pro </span>
          <span style={OURO_TEXTO}>seu canal</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
