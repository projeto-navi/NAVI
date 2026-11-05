// Beacons (RN71–RN74 propostas): leitura de iBeacon, distância e "perto de".
const { test, expect } = require('@playwright/test');
const NB = require('../../site-acessivel/js/beacons.js');
const { carregarLocalNode } = require('../apoio/local-node');

const UUID = 'FDA50693-A4E2-4FB1-AFCF-C6EB07647825';
const HEX = '0215FDA50693A4E24FB1AFCFC6EB0764782500010002C5'; // major 1, minor 2, -59 dBm a 1 m
const dataView = hex => { const b = Buffer.from(hex.replace(/\s/g, ''), 'hex'); return new DataView(b.buffer, b.byteOffset, b.length); };
// rssi para uma distância d com potência -59: rssi = -59 - 25*log10(d)
const rssiPara = d => -59 - 25 * Math.log10(d);

test.describe('NaviBeacons.lerIBeacon', () => {
  test('lê UUID, major, minor e potência do pacote da Apple (empresa 76)', () => {
    expect(NB.lerIBeacon({ 76: HEX })).toEqual({ uuid: UUID, major: 1, minor: 2, potencia: -59 });
  });
  test('aceita hex com espaços, chave 004c e DataView', () => {
    const esp = HEX.match(/../g).join(' ');
    expect(NB.lerIBeacon({ '76': esp })).toEqual({ uuid: UUID, major: 1, minor: 2, potencia: -59 });
    expect(NB.lerIBeacon({ '004c': HEX })).toMatchObject({ minor: 2 });
    expect(NB.lerIBeacon({ 76: dataView(HEX) })).toEqual({ uuid: UUID, major: 1, minor: 2, potencia: -59 });
  });
  test('ignora outra empresa, outro tipo e pacote curto', () => {
    expect(NB.lerIBeacon({ 6: HEX })).toBeNull();
    expect(NB.lerIBeacon({ 76: '0216' + HEX.slice(4) })).toBeNull();
    expect(NB.lerIBeacon({ 76: HEX.slice(0, 44) })).toBeNull();
    expect(NB.lerIBeacon(null)).toBeNull();
    expect(NB.lerIBeacon({})).toBeNull();
  });
});

test.describe('NaviBeacons.distancia', () => {
  test('1 m na potência medida e 10 m com 25 dB a menos', () => {
    expect(NB.distancia(-59, -59)).toBeCloseTo(1, 2);
    expect(NB.distancia(-84, -59)).toBeCloseTo(10, 2);
  });
  test('potência 127 (indisponível) ou ausente usa -59', () => {
    expect(NB.distancia(-59, 127)).toBeCloseTo(1, 2);
    expect(NB.distancia(-59)).toBeCloseTo(1, 2);
  });
});

test.describe('NaviBeacons.criarRastreador', () => {
  const LISTA = [{ major: 1, minor: 2, lugar: 'PCT_P01_L0007' }, { major: 1, minor: 5, lugar: 'PCT_P01_L0011' }, { major: 1, minor: 7, lugar: 'PCT_P02_L0007', raio: 3 }];
  function rastreador() {
    let t = 0;
    const r = NB.criarRastreador({ uuid: UUID, raioPadrao: 2, lista: LISTA, agora: () => t });
    return { r, passar: ms => { t += ms; }, ler: (minor, d, extra = {}) => r.registrar({ uuid: UUID, major: 1, minor, potencia: -59, rssi: rssiPara(d), ...extra }) };
  }

  test('entra em "perto" só depois de 2 leituras seguidas dentro do raio', () => {
    const { r, ler } = rastreador();
    ler(2, 1);
    expect(r.atual()).toBeNull();
    ler(2, 1);
    expect(r.atual()).toMatchObject({ lugar: 'PCT_P01_L0007' });
    expect(r.atual().distancia).toBeCloseTo(1, 1);
  });

  test('sai quando a distância suavizada passa de 2 × raio', () => {
    const { r, ler } = rastreador();
    ler(2, 1); ler(2, 1);
    let leituras = 0;
    while (r.atual() && leituras < 50) { ler(2, 6); leituras++; }
    expect(r.atual()).toBeNull();
    expect(leituras).toBeGreaterThan(1); // a suavização não sai na primeira leitura longe
  });

  test('sai depois de 8 s sem leitura', () => {
    const { r, ler, passar } = rastreador();
    ler(2, 1); ler(2, 1);
    passar(7999);
    expect(r.atual()).not.toBeNull();
    passar(2);
    expect(r.atual()).toBeNull();
  });

  test('beacon fora da lista nunca vira "perto", mas aparece em todos()', () => {
    const { r, ler } = rastreador();
    ler(99, 0.5); ler(99, 0.5); ler(99, 0.5);
    expect(r.atual()).toBeNull();
    expect(r.todos()).toEqual([expect.objectContaining({ uuid: UUID, major: 1, minor: 99, lugar: null })]);
  });

  test('outro UUID é ignorado como lugar', () => {
    const { r, ler } = rastreador();
    ler(2, 1, { uuid: '11111111-2222-3333-4444-555555555555' }); ler(2, 1, { uuid: '11111111-2222-3333-4444-555555555555' });
    expect(r.atual()).toBeNull();
  });

  test('RSSI 0 é ignorado', () => {
    const { r, ler } = rastreador();
    ler(2, 1);
    r.registrar({ uuid: UUID, major: 1, minor: 2, potencia: -59, rssi: 0 });
    expect(r.atual()).toBeNull();
    ler(2, 1);
    expect(r.atual()).toMatchObject({ lugar: 'PCT_P01_L0007' });
  });

  test('raio próprio do beacon vale no lugar do raio padrão', () => {
    const { r, ler } = rastreador();
    ler(7, 2.6); ler(7, 2.6);
    expect(r.atual()).toMatchObject({ lugar: 'PCT_P02_L0007' });
  });

  test('dois beacons quase à mesma distância: só troca com 0,5 m de vantagem', () => {
    const { r, ler } = rastreador();
    ler(2, 1.8); ler(2, 1.8);
    expect(r.atual().lugar).toBe('PCT_P01_L0007');
    for (let i = 0; i < 6; i++) { ler(5, 1.6); ler(2, 1.8); }
    expect(r.atual().lugar).toBe('PCT_P01_L0007');
    for (let i = 0; i < 10; i++) { ler(5, 1.0); ler(2, 1.8); }
    expect(r.atual().lugar).toBe('PCT_P01_L0011');
  });
});

test.describe('beacons do prédio de testes', () => {
  test('a lista tem os 8 beacons de teste e todos os lugares existem', () => {
    const c = carregarLocalNode('predio-teste');
    expect(c.beacons.uuid).toBe(UUID);
    expect(c.beacons.raioPadrao).toBe(2);
    expect(c.beacons.lista.map(b => [b.minor, b.lugar])).toEqual([
      [1, 'PCT_P01_L0001'], [2, 'PCT_P01_L0007'], [3, 'PCT_P01_L0002'], [4, 'PCT_P01_L0010'],
      [5, 'PCT_P01_L0011'], [6, 'PCT_P02_L0008'], [7, 'PCT_P02_L0007'], [8, 'PCT_P03_L0001']
    ]);
    expect(NB.validarLista(c.beacons, c.local)).toEqual([]);
  });
  test('validarLista acusa lugar inexistente, número repetido e UUID mal formado', () => {
    const c = carregarLocalNode('predio-teste');
    const ruim = { uuid: 'nao-e-uuid', raioPadrao: 2, lista: [{ major: 1, minor: 1, lugar: 'NAO_EXISTE' }, { major: 1, minor: 2, lugar: 'PCT_P01_L0007' }, { major: 1, minor: 2, lugar: 'PCT_P01_L0002' }] };
    expect(NB.validarLista(ruim, c.local)).toHaveLength(3);
  });
});
