/* Navi — avisos CONFIRMADOS pela equipe ou pelo shopping. Valem para todas as pessoas.
   Como usar: ao receber e confirmar um aviso, adicione um item abaixo e publique o site de novo.
   - lugar: id do local (novo, ex.: 'SHE_P02_L0011', ou antigo, ex.: '2-22327' — os elevadores)
   - tipo: 'interditado' (rotas desviam), 'danificado' (rotas desviam se for elevador ou escada) ou 'obstaculo' (só aviso)
   - detalhe: texto curto que aparece para as pessoas
   - desde: data no formato AAAA-MM-DD
   Exemplo:
   { lugar: 'elevador-piso-1', tipo: 'danificado', detalhe: 'Elevador em manutenção', desde: '2026-10-20' },
*/
naviLocal('shopping-estacao').avisos = [
];
