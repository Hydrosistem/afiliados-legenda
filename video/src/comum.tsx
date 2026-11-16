import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';

export const { fontFamily } = loadFont('normal', { weights: ['500', '700', '800', '900'], subsets: ['latin'] });

// Paleta preto premium (igual à página de vendas).
export const COR = {
  fundo: '#0d0d0f',
  card: '#16161a',
  borda: '#2a2a30',
  texto: '#f2f2f2',
  cinza: '#a7a7ad',
  ouro: '#ffd84d',
  ouro1: '#ffe14d',
  ouro2: '#ffc400',
  vermelho: '#ef6a55',
  verde: '#dcf8c6',
};

export const OURO_TEXTO: React.CSSProperties = {
  background: 'linear-gradient(90deg, #ffe680, #ffc400)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
};

// Fundo escuro com brilho dourado que respira devagar.
export const Fundo: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: COR.fundo }}>
      <AbsoluteFill
        style={{
          background: 'radial-gradient(70% 45% at 85% 5%, rgba(255,208,0,.22) 0%, rgba(13,13,15,0) 70%)',
          opacity: interpolate(frame, [0, 90, 180], [0.75, 1, 0.75], { extrapolateRight: 'extend' }),
        }}
      />
      <AbsoluteFill
        style={{ background: 'radial-gradient(60% 35% at 10% 100%, rgba(255,196,0,.10) 0%, rgba(13,13,15,0) 70%)' }}
      />
    </AbsoluteFill>
  );
};

// Moldura de celular para as telas do app.
export const Celular: React.FC<{ children: React.ReactNode; largura?: number }> = ({ children, largura = 620 }) => (
  <div
    style={{
      width: largura,
      borderRadius: 64,
      border: '14px solid #26262c',
      backgroundColor: '#f5f5f5',
      overflow: 'hidden',
      boxShadow: '0 40px 90px rgba(0,0,0,.65), 0 0 120px rgba(255,200,0,.10)',
    }}
  >
    {children}
  </div>
);
