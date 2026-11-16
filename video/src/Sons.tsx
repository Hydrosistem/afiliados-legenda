import { Audio } from '@remotion/media';
import { Sequence, interpolate, staticFile } from 'remotion';
import { ROTEIRO, TOTAL_QUADROS, quadros } from './roteiro';

// Efeitos sonoros (public/sfx, do pacote de sons do Remotion) e trilha original (public/musica).
// Cada efeito é marcado pelo quadro dentro da sua cena, casando com a animação.
type Efeito = { cena: string; quadro: number; som: string; volume: number };

const EFEITOS: Efeito[] = [
  // Gancho: pergunta entra e "na mão?" bate na tela
  { cena: 'gancho', quadro: 3, som: 'whoosh', volume: 0.5 },
  { cena: 'gancho', quadro: 14, som: 'whip', volume: 0.45 },
  // Dor: cada tarefa riscada
  { cena: 'dor', quadro: 16, som: 'switch', volume: 0.3 },
  { cena: 'dor', quadro: 32, som: 'switch', volume: 0.3 },
  { cena: 'dor', quadro: 48, som: 'switch', volume: 0.3 },
  { cena: 'dor', quadro: 64, som: 'switch', volume: 0.3 },
  { cena: 'dor', quadro: 80, som: 'record-scratch', volume: 0.22 },
  // Cola o link: celular sobe e o dedo toca em Gerar
  { cena: 'cola', quadro: 0, som: 'whoosh', volume: 0.5 },
  { cena: 'cola', quadro: 20, som: 'whoosh', volume: 0.35 },
  { cena: 'cola', quadro: 95, som: 'mouse-click', volume: 0.6 },
  // Resultado: selos aparecem e o post chega
  { cena: 'resultado', quadro: 0, som: 'page-turn', volume: 0.35 },
  { cena: 'resultado', quadro: 24, som: 'whip', volume: 0.35 },
  { cena: 'resultado', quadro: 46, som: 'ding', volume: 0.35 },
  // Comente: GERAR entra, comentário digitado e publicado
  { cena: 'comente', quadro: 0, som: 'whoosh', volume: 0.5 },
  { cena: 'comente', quadro: 10, som: 'whip', volume: 0.4 },
  { cena: 'comente', quadro: 31, som: 'mouse-click', volume: 0.25 },
  { cena: 'comente', quadro: 35, som: 'mouse-click', volume: 0.25 },
  { cena: 'comente', quadro: 39, som: 'mouse-click', volume: 0.25 },
  { cena: 'comente', quadro: 43, som: 'mouse-click', volume: 0.25 },
  { cena: 'comente', quadro: 47, som: 'mouse-click', volume: 0.25 },
  { cena: 'comente', quadro: 56, som: 'mouse-click', volume: 0.55 },
  { cena: 'comente', quadro: 59, som: 'ding', volume: 0.45 },
];

const inicioDaCena = (id: string) => {
  let soma = 0;
  for (const c of ROTEIRO) {
    if (c.id === id) return soma;
    soma += quadros(c.id);
  }
  throw new Error(`Cena desconhecida: ${id}`);
};

export const Sons: React.FC = () => {
  return (
    <>
      <Audio
        src={staticFile('musica/trilha.wav')}
        volume={(f) =>
          interpolate(f, [0, 8, TOTAL_QUADROS - 45, TOTAL_QUADROS], [0, 0.06, 0.06, 0.13], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
        }
      />
      {EFEITOS.map((e, i) => (
        <Sequence key={i} from={inicioDaCena(e.cena) + e.quadro} durationInFrames={60} name={`sfx ${e.som}`} layout="none">
          <Audio src={staticFile(`sfx/${e.som}.wav`)} volume={e.volume} />
        </Sequence>
      ))}
    </>
  );
};
