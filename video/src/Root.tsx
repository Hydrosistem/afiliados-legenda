import { Composition, Folder } from 'remotion';
import { Anuncio, CENAS } from './Anuncio';
import { FPS, ROTEIRO, TOTAL_QUADROS, quadros } from './roteiro';

const LARGURA = 1080;
const ALTURA = 1920;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="Anuncio" component={Anuncio} durationInFrames={TOTAL_QUADROS} fps={FPS} width={LARGURA} height={ALTURA} />
      <Folder name="Cenas">
        {ROTEIRO.map((cena) => (
          <Composition
            key={cena.id}
            id={`cena-${cena.id}`}
            component={CENAS[cena.id]}
            durationInFrames={quadros(cena.id)}
            fps={FPS}
            width={LARGURA}
            height={ALTURA}
          />
        ))}
      </Folder>
    </>
  );
};
