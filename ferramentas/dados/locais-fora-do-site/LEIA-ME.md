# Locais fora do site

Locais que saíram do site publicado, mas cujos dados continuam no repositório.

## shopping-estacao

O Shopping Estação foi o primeiro local do Navi, com planta 2D, malha dos corredores e 3D montado a partir da planta. Saiu do site em 30/10/2026, quando o prédio comercial de testes (`site-acessivel/locais/predio-teste/`) virou o único mapa, para os testes kaizen.

Os arquivos ficam aqui porque os testes de dados e do motor de rotas usam este grafo como referência: `testes/dados/grafo.spec.js`, `motor11.spec.js`, `validar-e-avisos.spec.js` e `local.spec.js`. Eles conferem que mudanças no motor não alteram rotas já conhecidas.

Para o Shopping voltar ao site:

1. Mova esta pasta de volta para `site-acessivel/locais/shopping-estacao/`.
2. Acrescente-o em `site-acessivel/locais/indice.js`.

Para gerar de novo, o comando é o mesmo de antes: `node ferramentas/dados/gerar-local.mjs shopping-estacao --saida=ferramentas/dados/locais-fora-do-site/shopping-estacao`.
