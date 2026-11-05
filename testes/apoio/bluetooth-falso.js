// Plugin de Bluetooth falso, no formato da ponte nativa do @capacitor-community/bluetooth-le
// (métodos que devolvem {value}, ouvinte 'onScanResult', manufacturerData em hex).
// Serve aos testes de dados (Node) e, por scriptInit(), aos de comportamento (navegador).

// Esta função vai para o navegador como texto: não use nada de fora dela.
function criarPluginFalso(op = {}) {
  const UUID_HEX = 'FDA50693A4E24FB1AFCFC6EB07647825';
  const est = { bluetooth: true, localizacao: true, permissao: 'permitida', ...op };
  const chamadas = [], ouvintes = [];
  let escaneando = false, filtro = null;
  const anota = (nome, arg) => { chamadas.push({ nome, arg }); };
  const nivel = p => (p === 'permitida' ? 'granted' : p === 'negada' ? 'denied' : 'prompt');
  const h2 = n => (n & 0xff).toString(16).padStart(2, '0');
  const plugin = {
    chamadas,
    async initialize(arg) {
      anota('initialize', arg);
      if (est.permissao === 'negada') throw new Error('Permission denied.');
      est.permissao = 'permitida';
    },
    async isEnabled() { anota('isEnabled'); return { value: est.bluetooth }; },
    async isLocationEnabled() { anota('isLocationEnabled'); return { value: est.localizacao }; },
    async checkPermissions() { anota('checkPermissions'); return { bluetooth: nivel(est.permissao), location: nivel(est.permissao) }; },
    async requestEnable() { anota('requestEnable'); est.bluetooth = true; },
    async openLocationSettings() { anota('openLocationSettings'); est.localizacao = true; },
    async openBluetoothSettings() { anota('openBluetoothSettings'); },
    async requestLEScan(arg) { anota('requestLEScan', arg); escaneando = true; filtro = (arg && arg.manufacturerData) || null; },
    async stopLEScan() { anota('stopLEScan'); escaneando = false; },
    async addListener(ev, fn) {
      anota('addListener', ev);
      const o = { ev, fn };
      ouvintes.push(o);
      return { remove: async () => { anota('removeListener', ev); ouvintes.splice(ouvintes.indexOf(o), 1); } };
    },
    /** Entrega um resultado de busca, como a ponte nativa faria. */
    emitir(resultado) {
      if (!escaneando) return;
      // como o ScanFilter do Android: com filtro de fabricante, só passa o que bate com empresa e prefixo
      if (filtro && filtro.length) {
        const dados = (resultado && resultado.manufacturerData) || {};
        const passa = filtro.some(f => {
          const v = dados[String(f.companyIdentifier)];
          return typeof v === 'string' && v.toLowerCase().startsWith(String(f.dataPrefix).toLowerCase());
        });
        if (!passa) return;
      }
      for (const o of ouvintes.slice()) if (o.ev === 'onScanResult') o.fn(resultado);
    },
    /** Atalho: um iBeacon com o UUID de teste. */
    emitirBeacon(minor, rssi, { major = 1, potencia = -59, uuidHex = UUID_HEX } = {}) {
      plugin.emitir({ device: { deviceId: 'AA:BB:CC:00:00:' + h2(minor) }, rssi, txPower: 127,
        manufacturerData: { 76: '0215' + uuidHex + h2(major >> 8) + h2(major) + h2(minor >> 8) + h2(minor) + h2(potencia) } });
    },
    definir(o) { Object.assign(est, o); },
    estado: () => ({ ...est, escaneando })
  };
  return plugin;
}

/** Script para page.addInitScript: instala o Capacitor falso com este plugin em window.__bleFalso. */
function scriptInit(op = {}) {
  return `(function () {
    var criar = ${criarPluginFalso.toString()};
    var p = criar(${JSON.stringify(op)});
    window.__bleFalso = p;
    window.Capacitor = { isNativePlatform: function () { return true; }, Plugins: { BluetoothLe: p } };
  })();`;
}

module.exports = { criarPluginFalso, scriptInit };
