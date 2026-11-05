/* Navi — ponte com o Bluetooth do celular, só dentro do app Android (Capacitor).
   Usa a ponte nativa do plugin @capacitor-community/bluetooth-le (window.Capacitor), sem módulo JS,
   porque o site não tem build. Fora do app, disponivel() é falso e nada aqui é chamado.
   Detecção só no aparelho; nada é enviado (RN73, proposta). */
(function (raiz) {
  'use strict';
  const NB = raiz.NaviBeacons || (typeof require === 'function' ? require('./beacons.js') : null);
  const CHAVE = 'navi-beacons';
  const SCAN_MODE_LOW_LATENCY = 2;
  // Filtro aplicado pelo próprio Android (ScanFilter): só anúncios da Apple (empresa 76 = 0x004C)
  // que começam como iBeacon (02 15). Sem ele, todo aparelho Bluetooth em volta (fones, relógios,
  // TVs, celulares) gera eventos na ponte, várias vezes por segundo, e trava celulares intermediários.
  const FILTRO_IBEACON = [{ companyIdentifier: 76, dataPrefix: '0215' }];
  const CONFERIR_MS = 5000;

  function pluginNativo() {
    const C = raiz.Capacitor;
    if (!C || typeof C.isNativePlatform !== 'function' || !C.isNativePlatform()) return null;
    if (C.Plugins && C.Plugins.BluetoothLe) return C.Plugins.BluetoothLe;
    try { return typeof C.registerPlugin === 'function' ? C.registerPlugin('BluetoothLe') : null; } catch (e) { return null; }
  }
  const valor = r => (r && typeof r === 'object' && 'value' in r ? !!r.value : !!r);

  /**
   * @param {{plugin?: object, armazenamento?: Storage, documento?: Document,
   *          intervalo?: (fn: () => void, ms: number) => () => void}} op
   */
  function criar(op = {}) {
    const plugin = op.plugin !== undefined ? op.plugin : pluginNativo();
    const arm = op.armazenamento !== undefined ? op.armazenamento : (typeof localStorage !== 'undefined' ? localStorage : null);
    const doc = op.documento !== undefined ? op.documento : (typeof document !== 'undefined' ? document : null);
    const intervalo = op.intervalo || ((fn, ms) => { const id = setInterval(fn, ms); return () => clearInterval(id); });
    const guardar = (sim) => { try { if (arm) { if (sim) arm.setItem(CHAVE, '1'); else arm.removeItem(CHAVE); } } catch (e) { /* bloqueado */ } };

    let iniciado = false, permissaoNegada = false;
    let querendo = false, ativa = false, pausadaPorSituacao = false;
    let ouvinte = null, aoLer = null, emAndamento = null, pararConferencia = null, aoMudar = null, ultima = null;

    const disponivel = () => !!plugin;

    async function permissao() {
      if (permissaoNegada) return 'negada';
      if (iniciado) return 'permitida';
      if (plugin && typeof plugin.checkPermissions === 'function') {
        try {
          const v = Object.values((await plugin.checkPermissions()) || {});
          if (v.length && v.some(x => x === 'denied')) return 'negada';
          if (v.length && v.every(x => x === 'granted')) return 'permitida';
        } catch (e) { /* sem informação */ }
      }
      return 'perguntar';
    }
    async function situacao() {
      if (!plugin) return { bluetooth: false, localizacao: false, permissao: 'perguntar' };
      const ler = async m => { try { return valor(await plugin[m]()); } catch (e) { return false; } };
      return { bluetooth: await ler('isEnabled'), localizacao: await ler('isLocationEnabled'), permissao: await permissao() };
    }

    async function permitir() {
      if (!plugin) return false;
      try {
        await plugin.initialize({ androidNeverForLocation: false });
        iniciado = true; permissaoNegada = false;
        return true;
      } catch (e) {
        permissaoNegada = true;
        return false;
      }
    }
    async function garantirIniciado() { if (!iniciado && !(await permitir())) throw new Error('permissao'); }
    async function ligarBluetooth() { await garantirIniciado(); await plugin.requestEnable(); }
    async function ligarLocalizacao() { await garantirIniciado(); await plugin.openLocationSettings(); }

    function aoResultado(r) {
      if (!aoLer || !r) return;
      const b = NB.lerIBeacon(r.manufacturerData);
      if (!b) return;
      if (typeof b.potencia !== 'number' && typeof r.txPower === 'number' && r.txPower !== 127) b.potencia = r.txPower;
      aoLer({ ...b, rssi: r.rssi });
    }
    async function ligarBusca() {
      if (ativa) return;
      await plugin.requestLEScan({ allowDuplicates: true, scanMode: SCAN_MODE_LOW_LATENCY, manufacturerData: FILTRO_IBEACON });
      ativa = true;
    }
    async function desligarBusca() {
      if (!ativa) return;
      ativa = false;
      try { await plugin.stopLEScan(); } catch (e) { /* já parada */ }
    }

    async function conferir() {
      if (!querendo) return;
      const s = await situacao();
      const chave = s.bluetooth + '|' + s.localizacao;
      if (!s.bluetooth || !s.localizacao) { pausadaPorSituacao = true; await desligarBusca(); }
      else if (pausadaPorSituacao) { pausadaPorSituacao = false; if (visivel()) await ligarBusca(); }
      if (ultima !== null && chave !== ultima && aoMudar) aoMudar(s);
      ultima = chave;
    }
    const visivel = () => !doc || doc.visibilityState !== 'hidden';
    let ouvindoPagina = false;
    function vigiarPagina() {
      if (ouvindoPagina || !doc || typeof doc.addEventListener !== 'function') return;
      ouvindoPagina = true;
      doc.addEventListener('visibilitychange', () => {
        if (!querendo) return;
        if (!visivel()) desligarBusca();
        else if (!pausadaPorSituacao) ligarBusca().catch(() => {});
      });
    }

    function comecar(fn) {
      aoLer = fn;
      if (querendo) return emAndamento || Promise.resolve();
      if (emAndamento) return emAndamento;
      emAndamento = (async () => {
        await garantirIniciado();
        if (!ouvinte) ouvinte = await plugin.addListener('onScanResult', aoResultado);
        await ligarBusca();
        querendo = true;
        guardar(true);
        vigiarPagina();
        ultima = null;
        await conferir();
        if (!pararConferencia) pararConferencia = intervalo(conferir, CONFERIR_MS);
      })().finally(() => { emAndamento = null; });
      return emAndamento;
    }

    async function parar() {
      querendo = false; pausadaPorSituacao = false;
      if (pararConferencia) { pararConferencia(); pararConferencia = null; }
      await desligarBusca();
      if (ouvinte) { const o = ouvinte; ouvinte = null; try { await o.remove(); } catch (e) { /* já removido */ } }
      guardar(false);
    }

    const lembrado = () => { try { return !!arm && arm.getItem(CHAVE) === '1'; } catch (e) { return false; } };

    return {
      disponivel, situacao, permitir, ligarBluetooth, ligarLocalizacao, comecar, parar,
      procurando: () => querendo,
      lembrado,
      aoMudarSituacao: cb => { aoMudar = cb; }
    };
  }

  const api = { criar, CHAVE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else raiz.NaviBeaconsApp = api;
})(typeof window !== 'undefined' ? window : globalThis);
