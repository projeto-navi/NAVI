// Testes de DADOS e das regras RN64 e RN65 (propostas) sobre o prédio comercial de testes (kaizen).
// Sem navegador: carrega locais/predio-teste/ no Node e calcula as rotas com js/preferencias-rota.js.
const { test, expect } = require('@playwright/test');
const { carregar } = require('../apoio/local-predio');
const { validarGrafo } = require('../../ferramentas/dados/validar-grafo');

const c = carregar('predio-teste');
const { local, G, R, PR } = c;
const L = (nome, andar) => local.lugares.find(l => l.nome === nome && (!andar || l.andar === andar));
const ent = L('Entrada principal');
const CEGO = { preferirPisoTatil: true }, CADEIRA = { evitarEscadas: true }, NADA = {};
const rota = (destino, prefs, bloq) => PR.rota(R, G, ent, destino, prefs, bloq);
/** Equipamentos usados para trocar de andar, na ordem. */
function equipamentos(r) {
  const usados = [];
  for (let k = 1; k < r.nos.length; k++) {
    const u = r.nos[k - 1], v = r.nos[k];
    if (G.nos[u].piso === G.nos[v].piso) continue;
    const e = G.viz[u].find(x => x.para === v);
    if (e && e.equipamento) usados.push(e.equipamento);
  }
  return usados;
}
const elevadores = () => new Set([...G.lugaresDoEquipamento('ELEV_01'), ...G.lugaresDoEquipamento('ELEV_02')]);

test.describe('Prédio de testes — dados', () => {
  test('grafo válido: sem erros, sem avisos, todo destino com rota sem escada', () => {
    const r = validarGrafo(local.grafo, { dados: local.dados });
    expect(r.erros).toEqual([]);
    expect(r.semRotaSemEscada).toEqual([]);
  });
  test('começa sem nenhum lugar interditado (só o "Avisar" do site deixa lugares indisponíveis)', () => {
    expect(local.avisos).toEqual([]);
  });
  test('três andares, duas escadas (só a B com braille), dois elevadores até o 2º e uma rampa até o 3º', () => {
    expect(local.andares.map(a => a.id)).toEqual(['P01', 'P02', 'P03']);
    const eq = Object.fromEntries(local.grafo.equipamentos.map(e => [e.id, e]));
    expect(Object.keys(eq).sort()).toEqual(['ELEV_01', 'ELEV_02', 'ESC_A', 'ESC_B', 'RAMPA_1']);
    const braille = local.grafo.arestas.filter(a => a.tipo === 'escada');
    expect(new Set(braille.filter(a => a.braille).map(a => a.equipamento))).toEqual(new Set(['ESC_B']));
    expect(L('Elevador 1', 'P03')).toBeUndefined();
    expect(L('Rampa', 'P03')).toBeTruthy();
  });
  test('o 2D tem as linhas de piso tátil e o 3D tem o modelo .glb do local', () => {
    expect(local.legado.tatil[1].length).toBeGreaterThan(3);
    expect(local.config.modelo3d.arquivo).toBe('modelo.glb');
    expect(require('node:fs').existsSync(require('node:path').join(__dirname, '../../site-acessivel/locais/predio-teste/modelo.glb'))).toBe(true);
  });
});

test.describe('RN64 (proposta) — pessoas cegas: piso tátil e braille', () => {
  test('sem preferência, a rota mais curta sobe pelo elevador', () => {
    const r = rota(L('Sala de reunião'), NADA);
    expect(equipamentos(r)).toEqual(['ELEV_01']);
  });
  test('com "Preferir piso tátil", sobe pela Escada B (com braille), mesmo sendo mais longa, e com piso tátil o caminho todo', () => {
    const curta = rota(L('Sala de reunião'), NADA), r = rota(L('Sala de reunião'), CEGO);
    expect(equipamentos(r)).toEqual(['ESC_B']);
    expect(r.comprimento).toBeGreaterThan(curta.comprimento);
    expect(r.pisoTatil).toBe('inteiro');
    const passo = r.passos.find(p => p.rotulo === 'escada');
    expect(passo.texto).toMatch(/^Pegue a Escada B .*O corrimão tem braille\.$/);
  });
  test('nunca escolhe a Escada A (sem braille) quando a B serve, nem até o 3º andar', () => {
    const r = rota(L('Sala de eventos'), CEGO);
    expect(equipamentos(r)).toEqual(['ESC_B', 'ESC_B']);
  });
  test('onde o piso tátil acaba, o passo avisa', () => {
    const r = rota(L('Elevador 1', 'P01'), CEGO);
    expect(r.pisoTatil).toBe('parcial');
    expect(r.passos.map(p => p.texto).join(' ')).toMatch(/o piso tátil acaba aqui/);
  });
  test('sem a preferência, os passos não ganham avisos de piso tátil', () => {
    const r = rota(L('Elevador 1', 'P01'), NADA);
    expect(r.passos.map(p => p.texto).join(' ')).not.toMatch(/piso tátil/);
  });
});

test.describe('RN65 (proposta) — mobilidade reduzida: elevador primeiro, rampa na falta dele', () => {
  test('troca de andar pelo elevador', () => {
    const r = rota(L('Sala de reunião'), CADEIRA);
    expect(equipamentos(r)).toEqual(['ELEV_01']);
    expect(r.usaEscada).toBe(false);
  });
  test('com os dois elevadores interditados, sobe pela rampa', () => {
    const r = rota(L('Sala de reunião'), CADEIRA, elevadores());
    expect(equipamentos(r)).toEqual(['RAMPA_1']);
    expect(r.passos.some(p => /^Pegue a rampa e suba para o 2º andar/.test(p.texto))).toBe(true);
  });
  test('até o 3º andar (onde o elevador não chega): elevador até o 2º e rampa até o 3º', () => {
    const r = rota(L('Sala de eventos'), CADEIRA);
    expect(equipamentos(r)).toEqual(['ELEV_01', 'RAMPA_1']);
  });
  test('com a rampa interditada e destino no 3º andar, não há caminho sem escada', () => {
    const bloq = new Set(G.lugaresDoEquipamento('RAMPA_1'));
    expect(rota(L('Sala de eventos'), CADEIRA, bloq)).toBeNull();
  });
});

test('Shopping Estação (sem piso tátil nem braille na planta): as preferências novas não mudam nenhuma rota', () => {
  const s = carregar('shopping-estacao');
  const entradas = s.local.lugares.filter(l => l.cat === 'entrada');
  let diferentes = 0;
  for (const o of entradas) for (const d of s.local.lugares) {
    if (o === d) continue;
    for (const prefs of [{ preferirPisoTatil: true }, { evitarEscadas: true }]) {
      const a = s.PR.rota(s.R, s.G, o, d, prefs), b = s.R.rota(s.G, o, d, { semEscadas: !!prefs.evitarEscadas });
      if ((a && a.passos.map(p => p.texto).join('|')) !== (b && b.passos.map(p => p.texto).join('|'))) diferentes++;
    }
  }
  expect(diferentes).toBe(0);
});
