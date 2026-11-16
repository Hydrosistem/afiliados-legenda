import { Audio } from '@remotion/media';
import { AbsoluteFill, Series, staticFile } from 'remotion';
import { NARRACAO, ROTEIRO, quadros } from './roteiro';
import { Gancho } from './cenas/Gancho';
import { Dor } from './cenas/Dor';
import { ColaLink } from './cenas/ColaLink';
import { Resultado } from './cenas/Resultado';
import { Comente } from './cenas/Comente';
import { Sons } from './Sons';

export const CENAS: Record<string, React.FC> = {
  gancho: Gancho,
  dor: Dor,
  cola: ColaLink,
  resultado: Resultado,
  comente: Comente,
};

// Anúncio completo: as seis cenas em sequência, cada uma com sua narração (quando já gerada).
export const Anuncio: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0d0d0f' }}>
      <Series>
        {ROTEIRO.map((cena) => {
          const Cena = CENAS[cena.id];
          return (
            <Series.Sequence key={cena.id} name={cena.id} durationInFrames={quadros(cena.id)}>
              <Cena />
              {cena.temAudio ? <Audio src={staticFile(`voz/${cena.id}.mp3`)} /> : null}
            </Series.Sequence>
          );
        })}
      </Series>
      <Audio src={staticFile(NARRACAO)} />
      <Sons />
    </AbsoluteFill>
  );
};
