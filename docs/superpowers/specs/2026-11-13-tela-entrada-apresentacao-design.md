# Tela de entrada com apresentação — design (mudança pequena)

Data: 2026-11-13.

## Intenção
A tela de login hoje só tem a frase "Entre com a conta Google usada na compra" e o botão. Quem já comprou deve, ao abrir o link, reconhecer que está no lugar certo e entender em segundos o que o app faz.

- **Para quem:** cliente que já comprou (não é página de venda).
- **Não-objetivos:** preço, botão "Quero comprar", depoimentos, mudar a lógica do login.
- **Anti-objetivo:** o botão do Google ficar escondido abaixo da dobra no celular.

## Abordagens consideradas
- A. Título + 3 passos: curta, mas não mostra o resultado.
- B. Título + exemplo de legenda em balão de WhatsApp: mostra o resultado, mas ocupa espaço.
- **C. As duas, com o botão logo abaixo do título (escolhida pelo usuário):** mostra o resultado e o uso, e o botão fica visível sem rolar.

## Design
Ordem dentro de `#telaLogin`, centralizado, mesma largura máxima (560px) e mesmas cores:
1. Título "Sua legenda de oferta pronta em segundos" e uma linha de apoio: "Cole o link do produto e receba a legenda pronta para o seu canal do WhatsApp."
2. "Entre com a conta Google usada na compra.", o botão do Google e `#avisoLogin`, sem mudanças.
3. Etiqueta "Exemplo" e um balão no estilo WhatsApp (fundo verde-claro, canto com "rabinho", hora no canto). Dentro, a legenda no formato que o app gera, já com a formatação do WhatsApp aplicada (negrito, riscado, itálico). Produto fictício e sem marca:
   - **Fone Bluetooth sem fio** 🎧
   - de ~~R$ 199,90~~ por 💥 **R$ 89,90**💥
   - 💗 _Som potente pra acompanhar o seu dia todo_
   - 🏠 link do produto
4. Três passos numa linha (quebram em coluna se não couber): ① Cole o link → ② Gere a legenda → ③ Copie pro WhatsApp.

Só HTML e CSS estáticos em `web/index.html`. Nenhum JavaScript novo; ids existentes mantidos (o teste de tela depende deles).

## Decisões minhas (para conferir)
- O texto do título e da linha de apoio.
- O produto de exemplo, inventado para não usar marca real.
- O balão imita o WhatsApp só no visual: verde-claro e cantos arredondados, sem logo.
- Com 375px de largura, o botão do Google precisa aparecer sem rolar. Isso é conferido na prévia.
