/* Navi — beacons (RN71–RN74, propostas): ler o pacote iBeacon, estimar a distância e decidir
   quando a pessoa está "perto de" um lugar. Lógica pura, sem Bluetooth: quem lê o rádio é
   js/beacons-app.js. Nada daqui sai do aparelho (RN73). */
(function (raiz) {
  'use strict';
  const POTENCIA_PADRAO = -59;        // dBm a 1 m, quando o pacote não informa
  const FATOR = 2.5;                  // perda do sinal em ambiente interno
  const PESO_NOVA = 0.3;              // suavização: peso da leitura nova
  const LEITURAS_PARA_ENTRAR = 2;
  const SEM_LEITURA_MS = 8000;
  const VANTAGEM_PARA_TROCAR = 0.5;   // m: só troca de beacon com essa folga (evita alternar)
  const UUID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;
  const EMPRESA_APPLE = ['76', '004c', '0x004c', '4c'];

  function bytesDe(v) {
    if (v == null) return null;
    if (typeof v === 'string') {
      const h = v.replace(/\s|0x/gi, '');
      if (!/^([0-9a-f]{2})*$/i.test(h)) return null;
      const b = new Uint8Array(h.length / 2);
      for (let i = 0; i < b.length; i++) b[i] = parseInt(h.substr(i * 2, 2), 16);
      return b;
    }
    if (typeof DataView !== 'undefined' && v instanceof DataView) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    if (v instanceof Uint8Array) return v;
    if (typeof ArrayBuffer !== 'undefined' && v instanceof ArrayBuffer) return new Uint8Array(v);
    return null;
  }
  const hex2 = n => n.toString(16).padStart(2, '0').toUpperCase();

  /** manufacturerData (por empresa) → {uuid, major, minor, potencia} ou null se não for iBeacon. */
  function lerIBeacon(dados) {
    if (!dados || typeof dados !== 'object') return null;
    const chave = Object.keys(dados).find(k => EMPRESA_APPLE.includes(String(k).toLowerCase()));
    if (chave === undefined) return null;
    let b = bytesDe(dados[chave]);
    if (!b) return null;
    if (b.length >= 25 && b[0] === 0x4c && b[1] === 0x00) b = b.subarray(2); // algumas pontes mandam o código da empresa junto
    if (b.length < 23 || b[0] !== 0x02 || b[1] !== 0x15) return null;
    const u = Array.from(b.subarray(2, 18), hex2).join('');
    return {
      uuid: `${u.slice(0, 8)}-${u.slice(8, 12)}-${u.slice(12, 16)}-${u.slice(16, 20)}-${u.slice(20)}`,
      major: (b[18] << 8) | b[19],
      minor: (b[20] << 8) | b[21],
      potencia: b[22] > 127 ? b[22] - 256 : b[22]
    };
  }

  /** Distância estimada (m) a partir do RSSI e da potência medida a 1 m. */
  function distancia(rssi, potencia) {
    const p = typeof potencia === 'number' && potencia < 0 && potencia > -128 ? potencia : POTENCIA_PADRAO;
    return Math.pow(10, (p - rssi) / (10 * FATOR));
  }

  /**
   * Acompanha as leituras e diz de qual lugar a pessoa está perto.
   * @param {{uuid: string, raioPadrao: number, lista: {major:number, minor:number, lugar:string, raio?:number}[], agora?: () => number}} o
   */
  function criarRastreador({ uuid, raioPadrao = 2, lista = [], agora = () => Date.now() }) {
    const uuidLista = String(uuid || '').toUpperCase();
    const doLugar = new Map(lista.map(b => [b.major + ':' + b.minor, b]));
    const vistos = new Map();
    let atualChave = null;

    function registrar(l) {
      if (!l || typeof l.rssi !== 'number' || l.rssi === 0 || l.rssi > 20) return;
      const id = String(l.uuid).toUpperCase() + ':' + l.major + ':' + l.minor;
      const e = vistos.get(id) || { uuid: String(l.uuid).toUpperCase(), major: l.major, minor: l.minor, rssiSuave: null, dentro: 0, perto: false };
      e.rssi = l.rssi;
      e.rssiSuave = e.rssiSuave === null ? l.rssi : PESO_NOVA * l.rssi + (1 - PESO_NOVA) * e.rssiSuave;
      e.distancia = distancia(e.rssiSuave, l.potencia);
      e.vistoEm = agora();
      const item = e.uuid === uuidLista ? doLugar.get(e.major + ':' + e.minor) : null;
      e.lugar = item ? item.lugar : null;
      if (item) {
        const raio = item.raio || raioPadrao;
        e.dentro = e.distancia <= raio ? e.dentro + 1 : 0;
        if (e.dentro >= LEITURAS_PARA_ENTRAR) e.perto = true;
        if (e.distancia > 2 * raio) e.perto = false;
      }
      vistos.set(id, e);
    }

    const recente = e => agora() - e.vistoEm <= SEM_LEITURA_MS;

    function atual() {
      const candidatos = [...vistos.entries()].filter(([, e]) => e.lugar && e.perto && recente(e));
      if (!candidatos.length) { atualChave = null; return null; }
      candidatos.sort((a, b) => a[1].distancia - b[1].distancia);
      const agoraAtual = candidatos.find(([k]) => k === atualChave);
      const melhor = candidatos[0];
      if (!agoraAtual || melhor[1].distancia <= agoraAtual[1].distancia - VANTAGEM_PARA_TROCAR) atualChave = melhor[0];
      const e = vistos.get(atualChave);
      return { lugar: e.lugar, distancia: e.distancia };
    }

    function todos() {
      return [...vistos.values()].filter(recente).sort((a, b) => a.distancia - b.distancia)
        .map(e => ({ uuid: e.uuid, major: e.major, minor: e.minor, rssi: e.rssi, distancia: e.distancia, lugar: e.lugar, vistoEm: e.vistoEm }));
    }

    return { registrar, atual, todos };
  }

  /** Confere a lista de beacons de um local: UUID, números repetidos e lugares que existem. */
  function validarLista(beacons, local) {
    const erros = [];
    if (!beacons || !Array.isArray(beacons.lista)) return ['A lista de beacons está vazia ou mal formada.'];
    if (!UUID.test(String(beacons.uuid || '').toUpperCase())) erros.push(`UUID mal formado: ${beacons.uuid}`);
    const vistos = new Set();
    for (const b of beacons.lista) {
      const k = b.major + ':' + b.minor;
      if (vistos.has(k)) erros.push(`Beacon repetido: major ${b.major}, minor ${b.minor}.`);
      vistos.add(k);
      if (!local || !local.lugar(b.lugar)) erros.push(`Beacon major ${b.major}, minor ${b.minor}: lugar ${b.lugar} não existe.`);
    }
    return erros;
  }

  const api = { lerIBeacon, distancia, criarRastreador, validarLista, POTENCIA_PADRAO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else raiz.NaviBeacons = api;
})(typeof window !== 'undefined' ? window : globalThis);
