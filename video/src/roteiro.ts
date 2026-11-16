// Roteiro do anúncio: uma entrada por cena. `segundos` é a duração da cena e acompanha
// a duração da narração (arquivo em public/voz/<id>.mp3) com uma pequena folga.
// Quando os áudios são gerados, basta ajustar `segundos` e marcar `temAudio: false`.

export const FPS = 30;

// Narração gravada de uma vez só (soa mais natural). As durações acima casam cada cena
// com o trecho da fala; ela toca inteira por cima do anúncio.
export const NARRACAO = 'voz/narracao.mp3';

export type Cena = {
  id: string;
  segundos: number;
  narracao: string;
  temAudio: boolean;
};

export const ROTEIRO: Cena[] = [
  { id: 'gancho', segundos: 2.55, narracao: 'Você ainda monta post de oferta na mão?', temAudio: false },
  { id: 'dor', segundos: 4.91, narracao: 'Copiar título, calcular desconto, inventar uma frase… isso leva minutos.', temAudio: false },
  { id: 'cola', segundos: 3.88, narracao: 'Com o Gerador de Post, você só cola o link do Mercado Livre ou da Shopee…', temAudio: false },
  { id: 'resultado', segundos: 4.42, narracao: '…e recebe foto, preços e uma frase criada por IA, prontos pro seu canal.', temAudio: false },
  { id: 'comente', segundos: 4.64, narracao: 'Quer o link? Comenta GERAR aqui embaixo que eu te mando!', temAudio: false },
];

export const quadros = (id: string) => Math.round(ROTEIRO.find((c) => c.id === id)!.segundos * FPS);
export const TOTAL_QUADROS = ROTEIRO.reduce((soma, c) => soma + Math.round(c.segundos * FPS), 0);
