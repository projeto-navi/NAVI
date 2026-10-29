# Prédio comercial de testes — modelo 3D

Modelo 3D de três andares para testar rotas acessíveis do Navi. Foi feito a partir da planta de testes enviada pela equipe em 29/10/2026. O modelo fica fora do aplicativo: o app ainda não carrega `.glb`. Isso entra no Marco 3, com o `Map3DGlbRenderer`.

## Arquivos

| Arquivo | O que é |
|---|---|
| `predio-teste.glb` | O prédio inteiro (3 andares, rampa, escadas, elevadores, obstáculos) |
| `predio-teste-p01.glb`, `-p02.glb`, `-p03.glb` | Um andar por arquivo, com as escadas e a rampa que **sobem** dele |
| `index.html` | Visualizador para conferir e testar: andares, paredes baixas, obstáculos, elevadores fora de serviço, realces |
| `resumo.json` | Tamanho dos arquivos e número de vértices |

Para abrir o visualizador: sirva a raiz do repositório (ex.: `python3 -m http.server 8000`) e abra `http://localhost:8000/modelos/predio-teste/`.
Ele usa o Three.js do próprio site (`site-acessivel/js/three-navi.min.js`). Por `file://` o navegador não deixa ler o `.glb`.

Para gerar de novo: `python3 ferramentas/modelo3d/gerar-predio-teste.py` (precisa de numpy e Pillow). Depois, `python3 ferramentas/modelo3d/montar-visualizador.py`.

## O que o cenário testa

| Teste | Como está no modelo |
|---|---|
| Rota com piso tátil mais longa que a direta | 1º andar: da Entrada à Escada B, o piso tátil desce pelo eixo e contorna o canteiro da Área central. São cerca de 29 m, contra uns 21 m em linha reta. A Escada A fica a 11 m da entrada, mas não tem piso tátil nem braille. |
| Obstáculos em tempo real | 10 nós `OBSTACULO`, escondidos de início (`extras.estado_inicial = "oculto"`). A maioria fica sobre o piso tátil ou nas passagens estreitas; um interdita a rampa entre o 2º e o 3º andar. |
| Elevadores inutilizáveis | Elevadores 1 e 2, só do 1º ao 2º andar. Os nós `INTERDICAO_E1` e `INTERDICAO_E2` (um em cada andar) mostram a barreira e a placa "Fora de serviço". |
| Rampas | Rampa em ziguezague num anexo envidraçado a leste. Inclinação de 8,33%, quatro trechos de 9 m por andar (0,75 m de subida cada), patamares de 1,5 m, largura de 1,60 m, corrimão duplo dos dois lados e piso de alerta no começo e no fim. Liga os três andares. |
| Escadas com e sem braille | Escada A: corrimão simples, sem braille. Escada B: corrimão duplo (0,70 m e 0,92 m) dos dois lados, com placas em braille no começo e no fim de cada corrimão, e ligada ao piso tátil. As duas têm faixa amarela na borda dos degraus e piso de alerta. |
| Larguras mínimas | 1,20 m (passagem do refeitório). 0,90 m (passagem entre Copa e Arquivo, com piso tátil). 0,85 m (vão da porta da Sala de reunião). 1,50 m (alternativa pelos Escritórios e corredor até a rampa). 1,80 m (saída para o terraço). Cada uma é um nó `LARGURAMIN` com `extras.largura_m`. |
| Instruções para pessoas com deficiência auditiva | Recepção com atendimento por escrito e em Libras e luz azul de chamada no balcão. Um mapa com "Você está aqui" em cada andar. Painel de senhas com luz no guichê. Avisos com luz de alarme vermelha (estrobo). Cardápio com números para apontar. Tela de elevador fora de serviço. Avisos antes da passagem estreita, na sala de eventos e no terraço. |

## Nomes e metadados

- Os nomes seguem `{PREDIO}{ANDAR}{CATEGORIA}_{ID}`, com `PREDIO = PCT`. Exemplos: `PCTP01ESCADA_B`, `PCTP02OBSTACULO_01`, `PCTP01INTERDICAO_E1`, `PCTP02LARGURAMIN_090`, `PCTP01REFERENCIA_MAPA`.
- Eixos: X para leste, Y para cima e Z para o sul, que é o "y da planta". A origem fica no canto noroeste do bloco central. Medidas em metros; altura de andar de 3,0 m.
- `extras` do nó raiz (`PCT_PREDIO`): equipamentos (elevadores, escadas e rampa, com os nós de cada um) e a descrição dos testes.
- `extras` de cada andar (`PCTP01`…): espaços com seus retângulos e a lista de obstáculos.
- `PISOTATIL_DIRECIONAL`: as polilinhas, mais o anel da Área central no 1º andar. `PISOTATIL_ALERTA`: as áreas de alerta.
- `PORTA_GERAL`: todas as portas e vãos, com `largura_m`.
- Pontos de referência: `instrucoes` (o que a tela diz) e `publico`.
- Como manda a especificação do Marco 1, o 3D não define rotas: o grafo do local continua sendo a fonte de verdade. Os extras existem para ajudar a montar esse grafo.

## Decisões e suposições (para confirmar)

1. **Escala:** a planta não traz medidas gerais. Usei as larguras marcadas nela (0,85 m a 1,80 m) e cerca de 5 cm por pixel da imagem. O bloco central tem 10,5 × 28,5 m.
2. **Altura de andar de 3,0 m:** se o prédio real tiver mais, a rampa cresce na mesma proporção (cada 0,75 m de subida pede 9 m de rampa).
3. **Rampa:** a sala de rampa da planta virou o patamar de cada andar, e o ziguezague fica num anexo de 3,5 × 25 m a leste, como foi combinado.
4. **Elevadores:** cada poço tem 2,6 × 2,4 m e a cabine 1,60 × 2,15 m. No 3º andar, o lugar dos elevadores é a casa de máquinas, fechada.
5. **Braille:** só na Escada B, como foi pedido. A Escada A ficou sem piso tátil até a porta, para que a preferência apareça no teste.
6. **2º andar:** para a passagem de 0,90 m ser de fato estreita, ela fica entre a Copa e o Arquivo. A alternativa larga (1,50 m) passa pelos Escritórios.
7. **Mobiliário e cores:** são ilustrativos.
