// Testes de DADOS e do motor de rotas, sem navegador.
// Carregam os mesmos arquivos que o site publica (js/dados.js, js/malha.js, js/rotas.js)
// num contexto isolado, para cada teste partir dos dados originais.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SITE = path.resolve(__dirname, '../../site-acessivel');
function carregar() {
  const ctx = { console, Buffer, atob: s => Buffer.from(s, 'base64').toString('binary') };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['js/dados.js', 'js/malha.js', 'js/rotas.js']) vm.runInContext(fs.readFileSync(path.join(SITE, f), 'utf8'), ctx, { filename: f });
  return { D: ctx.NAVI_DADOS, R: ctx.NaviRotas };
}

test('214 lugares em 2 pisos, 3 entradas (contexto do projeto)', () => {
  const { D } = carregar();
  expect(D.places.length).toBe(214);
  expect(Object.keys(D.pisos)).toEqual(['1', '2']);
  expect(D.places.filter(p => p.cat === 'entrada').map(p => p.nome).sort()).toEqual(['Acesso Azul', 'Acesso Verde', 'Acesso Vermelho']);
});

test('RN04 / RN15 — com "sem escadas", nenhuma rota entre entrada e lugar usa escada rolante', () => {
  const { D, R } = carregar();
  const G = R.criarGrafo(D);
  const entradas = G.places.filter(p => p.cat === 'entrada');
  const ruins = [];
  let comRota = 0;
  for (const e of entradas) for (const p of G.places) {
    if (p === e) continue;
    const r = R.rota(G, e, p, { semEscadas: true, malha: false });
    if (!r) continue;
    comRota++;
    if (r.usaEscada || r.passos.some(s => s.tipo === 'escada' || /escada rolante e (suba|desça)/.test(s.texto))) ruins.push(`${e.nome} → ${p.nome}`);
  }
  expect(ruins).toEqual([]);
  expect(comRota).toBeGreaterThan(600);
});

test('RN16 — elevador interditado bloqueia as portas dos dois pisos', () => {
  const { D, R } = carregar();
  const G = R.criarGrafo(D);
  const azul = G.lugarPorId['1-1401928'];
  const piso2 = G.places.find(p => p.piso === 2 && p.cat === 'loja');
  const elevadores = new Set(G.places.filter(p => p.cat === 'elevador').map(p => p.id));
  expect(elevadores.size).toBe(2);
  expect(R.rota(G, azul, piso2, { semEscadas: true, bloqueados: elevadores, malha: false })).toBeNull();
  expect(R.rota(G, azul, piso2, { semEscadas: true, malha: false })).not.toBeNull();
});

test('RN11 — a busca ignora acentos e maiúsculas e aceita parte do nome', () => {
  const { D, R } = carregar();
  const nomes = q => R.buscar(D.places, q).map(p => p.nome);
  expect(nomes('BOTICARIO')).toContain('O Boticário');
  expect(nomes('boti')).toContain('O Boticário');
  expect(nomes('sanitarios').length).toBeGreaterThan(0);
});

test('RN22 — não há dois passos seguidos "Continue em frente" no mesmo piso', () => {
  const { D, R } = carregar();
  const G = R.criarGrafo(D);
  const entradas = G.places.filter(p => p.cat === 'entrada');
  const ruins = [];
  for (const e of entradas) for (const p of G.places.filter(x => x.cat === 'loja')) {
    const r = R.rota(G, e, p, {});
    if (!r) continue;
    r.passos.forEach((s, i) => { if (i && s.tipo === 'reto' && /^Continue em frente/.test(s.texto) && /^Continue em frente/.test(r.passos[i - 1].texto) && s.piso === r.passos[i - 1].piso) ruins.push(`${e.nome} → ${p.nome} (passo ${i + 1})`); });
  }
  expect(ruins).toEqual([]);
});

/* ------------------ falhas conhecidas (devem virar verdes nas correções) ------------------ */

test('F1 — todo lugar fica dentro dos limites do seu piso', () => {
  test.fail(true, 'F1: La Maçã em (0, 0). Também fora: Saída de Emergência 1-35749 (y = 773 > 736) — confirmar se é erro.');
  const { D } = carregar();
  const fora = D.places.filter(p => { const b = D.pisos[p.piso]; return p.x < b.minX || p.x > b.maxX || p.y < b.minY || p.y > b.maxY; })
    .map(p => `${p.id} ${p.nome} (${p.x}, ${p.y})`);
  expect(fora).toEqual([]);
});

test('F2 — a porta de todo lugar fica a no máximo 60 unidades do corredor', () => {
  test.fail(true, 'F2: o último trecho é uma linha reta do nó mais próximo até o centro do lugar.');
  const { D, R } = carregar();
  const G = R.criarGrafo(D);
  const longe = G.places.filter(p => { const n = G.nos[G.noDoLugar(p)]; return Math.hypot(n.x - p.x, n.y - p.y) > 60; });
  expect(longe.map(p => p.nome)).toEqual([]);
});

test('F3 — escada rolante tem um sentido só', () => {
  test.fail(true, 'F3: as escadas rolantes são ligadas nos dois sentidos; falta registrar o sentido de cada uma.');
  const { D, R } = carregar();
  const G = R.criarGrafo(D);
  const dePara = new Set();
  G.viz.forEach((lista, de) => lista.filter(e => e.tipo === 'escada').forEach(e => dePara.add(de + '>' + e.para)));
  const ida_e_volta = [...dePara].filter(k => { const [a, b] = k.split('>'); return dePara.has(b + '>' + a); });
  expect(ida_e_volta).toEqual([]);
});

test('F4 — sanitário acessível tem categoria própria', () => {
  test.fail(true, 'F4: os 4 sanitários estão na mesma categoria "sanitario", sem indicar qual é acessível.');
  const { D } = carregar();
  expect(D.places.some(p => p.cat === 'sanitario_acessivel' || p.acessivel === true)).toBe(true);
});

test('F5 — criarGrafo não altera os dados de entrada', () => {
  test.fail(true, 'F5: criarGrafo acrescenta "elevador-piso-1" a D.places e renomeia o elevador do Piso 2.');
  const { D, R } = carregar();
  const antes = JSON.stringify(D.places);
  R.criarGrafo(D);
  expect(JSON.stringify(D.places)).toBe(antes);
});
