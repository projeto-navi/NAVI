/* Navi — beacons do prédio de testes (números de TESTE, para o app Beacon Simulator).
   Quando os beacons reais forem instalados, troque major/minor pelos que aparecem na tela
   "Beacons por perto" do app. UUID: padrão de fábrica dos beacons Feasycom. Raio em metros. */
naviLocal("predio-teste").beacons = {
  uuid: "FDA50693-A4E2-4FB1-AFCF-C6EB07647825",
  raioPadrao: 2,
  lista: [
    { major: 1, minor: 1, lugar: "PCT_P01_L0001" }, // Entrada principal
    { major: 1, minor: 2, lugar: "PCT_P01_L0007" }, // Elevador 1, 1º andar
    { major: 1, minor: 3, lugar: "PCT_P01_L0002" }, // Recepção
    { major: 1, minor: 4, lugar: "PCT_P01_L0010" }, // Escada B, 1º andar
    { major: 1, minor: 5, lugar: "PCT_P01_L0011" }, // Rampa, 1º andar
    { major: 1, minor: 6, lugar: "PCT_P02_L0008" }, // Elevador 1, 2º andar
    { major: 1, minor: 7, lugar: "PCT_P02_L0007" }, // Sala de reunião
    { major: 1, minor: 8, lugar: "PCT_P03_L0001" }  // Sala de eventos
  ]
};
