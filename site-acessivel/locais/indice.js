/* Navi — locais disponíveis neste site. O local padrão abre quando o link não tem ?local=.
   Para publicar um site só de um local (ex.: navi-uniopet.netlify.app), marque padrao: true nele.
   codigosAntigos (opcional): links e QR Codes feitos antes de o local ganhar ?local= continuam abrindo nele
   quando a partida ou o destino do link têm um desses códigos.
   Se mudar o padrão, mude também o script do <head> do index.html e do mapa.html.
   O Shopping Estação saiu do site em 30/10/2026 (ferramentas/dados/locais-fora-do-site/). */
self.NAVI_LOCAIS_INDICE = [
  { slug: 'predio-teste', nome: 'Prédio comercial de testes', padrao: true },
  { slug: 'uniopet-reboucas', nome: 'UniOpet — Campus Rebouças' }
];
