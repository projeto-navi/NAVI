# Roteiro de testes kaizen — prédio comercial de testes

Versão de 29/10/2026. Branch `kaizen/predio-teste`.

O site abre no **Prédio comercial de testes**, um prédio fictício de 3 andares feito para testar as rotas acessíveis. Desde 30/10/2026 é o único mapa do site: o Shopping Estação saiu (os dados dele ficam em `ferramentas/dados/locais-fora-do-site/`).

Cada rodada segue o ciclo PDCA:

1. **Planejar:** escolha os cenários abaixo.
2. **Fazer:** rode os cenários no celular e no computador.
3. **Checar:** anote o que aconteceu e compare com o esperado.
4. **Agir:** o que for melhoria vira proposta no Documento 04 antes de virar código.

As regras em teste são RN64 e RN65. São propostas, à espera da aprovação de Camilly e Leonardo.

## O prédio

| Andar | O que tem |
|---|---|
| 1º | Entrada principal, Recepção (com Libras e atendimento por escrito), Lojas A e B, sanitário acessível, refeitório. O piso tátil vai da entrada à Escada B e contorna a Área central. |
| 2º | Administração, salas, Sala de reunião (porta de 0,85 m) e sanitário acessível. A passagem de 0,90 m fica entre a Copa e o Arquivo; a alternativa de 1,50 m passa pelos Escritórios. |
| 3º | Auditório, salas, Sala de eventos, Coworking e sanitário acessível. Os elevadores **não** chegam aqui. |
| Entre andares | **Escada A:** sem braille e sem piso tátil até a porta. **Escada B:** braille no corrimão e ligada ao piso tátil. **Elevadores 1 e 2:** só do 1º ao 2º andar. **Rampa:** em ziguezague, com inclinação de 8,33%, liga os três andares. |

O prédio começa **sem nenhum lugar interditado**. Para testar desvios, use **Avisar sobre um local** no painel do mapa. O aviso vale só no aparelho e sai com **Já foi resolvido**.

## Cenários

Todos partem da **Entrada principal**. Os perfis ligam as preferências sozinhos. Também dá para ligá-las em **Preferências → Rotas**.

| # | Perfil ou preferência | Destino | Avisos | Esperado |
|---|---|---|---|---|
| 1 | Sem adaptações | Sala de reunião (2º) | — | Pelo elevador (caminho mais curto) |
| 2 | Deficiência visual ("Preferir piso tátil e braille") | Sala de reunião (2º) | — | Pela **Escada B**, com "O corrimão tem braille.", e piso tátil o caminho todo, mesmo sendo mais longo |
| 3 | Deficiência visual | Sala de eventos (3º) | — | Escada B duas vezes; nunca a Escada A |
| 4 | Deficiência visual | Elevador 1 | — | O passo 1 avisa: "o piso tátil acaba aqui" |
| 5 | Mobilidade reduzida ("Evitar escadas") | Sala de reunião (2º) | — | Pelo Elevador 1 |
| 6 | Mobilidade reduzida | Sala de reunião (2º) | Elevador 1 e Elevador 2: danificados | **Pela rampa** |
| 7 | Mobilidade reduzida | Sala de eventos (3º) | — | Pelo elevador até o 2º e pela rampa até o 3º |
| 8 | Mobilidade reduzida | Sala de eventos (3º) | Rampa: interditada | Sem caminho sem escada. O site explica o motivo e oferece ajuda. |
| 9 | Qualquer um | Qualquer destino | Obstáculo num lugar do caminho | O aviso aparece no mapa, mas a rota não muda: hoje só "Interditado" e "Danificado" num elevador, escada ou rampa tiram trechos da rota |
| 10 | Qualquer um | Qualquer destino, no 3D | — | O modelo do prédio aparece com a rota. "Ver em primeira pessoa" percorre a rota. |
| 11 | Link antigo do Shopping (`mapa.html?origem=1-1401928&destino=1-2482759`) | — | — | Volta para a Página de Rota do prédio, com "Escolha para onde você vai" |

Os cenários 1 a 8 e 11 também rodam sozinhos:

- `npx playwright test testes/dados/predio-teste.spec.js testes/comportamento/predio-teste.spec.js`

## Ficha de retorno

Copie uma linha por cenário testado.

| Data | Quem testou | Aparelho | Cenário | Aconteceu o esperado? | O que estranhou ou faltou | Ideia de melhoria |
|---|---|---|---|---|---|---|
| | | | | | | |

## Perguntas para esta rodada

- O caminho pelo piso tátil (cenário 2) é longo demais? O peso atual é este: cada metro sem piso tátil vale por 5 metros com piso tátil. Ele fica em `js/preferencias-rota.js`.
- O aviso "o piso tátil acaba aqui" chega no momento certo?
- Para quem usa cadeira de rodas, a rampa longa (cerca de 36 m por andar) é aceitável quando o elevador para?
- Faltou algum ponto de referência para quem é surdo, como placas, telas ou luzes?
