/* Navi — locais disponíveis neste site. O local padrão abre quando o link não tem ?local=.
   Para publicar um site só de um local (ex.: navi-uniopet.netlify.app), marque padrao: true nele.
   codigosAntigos: links e QR Codes feitos antes de o local ganhar ?local= continuam abrindo nele quando
   a partida ou o destino do link têm um desses códigos (ex.: ?destino=SHE_P01_L0012 ou ?destino=1-2482759).
   Se mudar o padrão ou os códigos, mude também o script do <head> do index.html e do mapa.html. */
self.NAVI_LOCAIS_INDICE = [
  { slug: 'predio-teste', nome: 'Prédio comercial de testes', padrao: true },
  { slug: 'shopping-estacao', nome: 'Shopping Estação', codigosAntigos: /^(SHE_|\d+-\d+$)/ },
  { slug: 'uniopet-reboucas', nome: 'UniOpet — Campus Rebouças' }
];
