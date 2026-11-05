// Ponte com o Bluetooth do celular (beacons-app.js), com o plugin falso no lugar do nativo.
const { test, expect } = require('@playwright/test');
const NBA = require('../../site-acessivel/js/beacons-app.js');
const { criarPluginFalso } = require('../apoio/bluetooth-falso');
const { armazenamentoFalso } = require('../apoio/local-node');

function documentoFalso() {
  const ouvintes = [];
  return {
    visibilityState: 'visible',
    addEventListener: (ev, fn) => { if (ev === 'visibilitychange') ouvintes.push(fn); },
    mudar(v) { this.visibilityState = v; ouvintes.forEach(f => f()); }
  };
}
function intervaloFalso() {
  const t = { fns: [] };
  t.intervalo = (fn, ms) => { t.fns.push({ fn, ms }); return () => { t.fns = t.fns.filter(x => x.fn !== fn); }; };
  t.passar = async () => { for (const x of t.fns.slice()) await x.fn(); };
  return t;
}
function montar(estado) {
  const plugin = criarPluginFalso(estado);
  const armazenamento = armazenamentoFalso(), documento = documentoFalso(), tempo = intervaloFalso();
  const app = NBA.criar({ plugin, armazenamento, documento, intervalo: tempo.intervalo });
  return { plugin, armazenamento, documento, tempo, app };
}
const nomes = p => p.chamadas.map(c => c.nome);
const espera = () => new Promise(r => setTimeout(r, 0));

test.describe('NaviBeaconsApp', () => {
  test('fora do app (sem Capacitor): indisponível e nenhum pedido ao plugin', () => {
    const app = NBA.criar({ armazenamento: armazenamentoFalso() });
    expect(app.disponivel()).toBe(false);
  });

  test('situação: Bluetooth desligado, localização ligada, permissão dada', async () => {
    const { app } = montar({ bluetooth: false });
    expect(app.disponivel()).toBe(true);
    expect(await app.situacao()).toEqual({ bluetooth: false, localizacao: true, permissao: 'permitida' });
  });

  test('permitir chama initialize sem neverForLocation; recusa vira "negada"', async () => {
    let c = montar({ permissao: 'perguntar' });
    expect(await c.app.permitir()).toBe(true);
    expect(c.plugin.chamadas.find(x => x.nome === 'initialize').arg).toEqual({ androidNeverForLocation: false });
    c = montar({ permissao: 'negada' });
    expect(await c.app.permitir()).toBe(false);
    expect((await c.app.situacao()).permissao).toBe('negada');
  });

  test('ligar Bluetooth e localização usam os pedidos do Android', async () => {
    const { app, plugin } = montar({ bluetooth: false, localizacao: false });
    await app.ligarBluetooth();
    await app.ligarLocalizacao();
    expect(nomes(plugin)).toEqual(expect.arrayContaining(['requestEnable', 'openLocationSettings']));
  });

  test('começar: busca com duplicados e baixa latência; só iBeacons chegam', async () => {
    const { app, plugin, armazenamento } = montar({});
    const lidas = [];
    await app.comecar(l => lidas.push(l));
    expect(plugin.chamadas.find(x => x.nome === 'requestLEScan').arg).toEqual({ allowDuplicates: true, scanMode: 2 });
    plugin.emitirBeacon(2, -60);
    plugin.emitir({ rssi: -50, manufacturerData: { 6: '0102' } });
    expect(lidas).toEqual([{ uuid: 'FDA50693-A4E2-4FB1-AFCF-C6EB07647825', major: 1, minor: 2, potencia: -59, rssi: -60 }]);
    expect(app.procurando()).toBe(true);
    expect(armazenamento.getItem('navi-beacons')).toBe('1');
    expect(app.lembrado()).toBe(true);
  });

  test('começar duas vezes: um ouvinte e uma busca, cada leitura chega uma vez', async () => {
    const { app, plugin } = montar({});
    const lidas = [];
    await Promise.all([app.comecar(l => lidas.push(l)), app.comecar(l => lidas.push(l))]);
    await app.comecar(l => lidas.push(l));
    expect(nomes(plugin).filter(n => n === 'addListener')).toHaveLength(1);
    expect(nomes(plugin).filter(n => n === 'requestLEScan')).toHaveLength(1);
    plugin.emitirBeacon(2, -60);
    expect(lidas).toHaveLength(1);
  });

  test('sem permissão, começar pede antes; recusada, não busca', async () => {
    const { app, plugin } = montar({ permissao: 'negada' });
    await expect(app.comecar(() => {})).rejects.toThrow('permissao');
    expect(nomes(plugin)).not.toContain('requestLEScan');
    expect(app.procurando()).toBe(false);
  });

  test('página oculta pausa a busca; visível de novo, retoma', async () => {
    const { app, plugin, documento } = montar({});
    await app.comecar(() => {});
    documento.mudar('hidden'); await espera();
    expect(nomes(plugin).filter(n => n === 'stopLEScan')).toHaveLength(1);
    expect(app.procurando()).toBe(true);
    documento.mudar('visible'); await espera();
    expect(nomes(plugin).filter(n => n === 'requestLEScan')).toHaveLength(2);
  });

  test('parar: busca encerrada, ouvinte removido e escolha apagada', async () => {
    const { app, plugin, armazenamento } = montar({});
    await app.comecar(() => {});
    await app.parar();
    expect(app.procurando()).toBe(false);
    expect(nomes(plugin)).toEqual(expect.arrayContaining(['stopLEScan', 'removeListener']));
    expect(armazenamento.getItem('navi-beacons')).toBeNull();
  });

  test('Bluetooth desligado no meio: a busca pausa e avisa; religado, retoma', async () => {
    const { app, plugin, tempo } = montar({});
    const mudancas = [];
    app.aoMudarSituacao(s => mudancas.push(s));
    await app.comecar(() => {});
    plugin.definir({ bluetooth: false });
    await tempo.passar();
    expect(tempo.fns[0].ms).toBe(5000);
    expect(nomes(plugin).filter(n => n === 'stopLEScan')).toHaveLength(1);
    expect(mudancas.at(-1)).toMatchObject({ bluetooth: false });
    plugin.definir({ bluetooth: true });
    await tempo.passar();
    expect(nomes(plugin).filter(n => n === 'requestLEScan')).toHaveLength(2);
    expect(mudancas.at(-1)).toMatchObject({ bluetooth: true });
    await tempo.passar();
    expect(mudancas).toHaveLength(2); // só avisa quando muda
  });
});
