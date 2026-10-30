// Adaptador do motor para o grafo 1.1: mesmas rotas do motor atual e regras novas (sentido, rampa, equipamento).
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { carregarLocalNode, carregarLegado, FORA_DO_SITE } = require('../apoio/local-node');

function grafoSintetico({ sentido = 'ambos', rampa = null } = {}) {
  const no = (id, andar, x) => ({ id, andar, pos: [x, 0, 0], tipo: 'corredor', ref_modelo: null });
  const ar = (de, para, tipo = 'caminhada', extra = {}) => ({ de, para, tipo, comprimento_unid: 30, custo: 30, sentido: 'ambos', piso_tatil: 'nenhum', inclinacao_pct: null, largura_min_m: null, equipamento: null, ...extra });
  const arestas = [ar('A', 'B'), ar('C', 'D')];
  if (rampa != null) arestas.push(ar('B', 'C', 'rampa', { inclinacao_pct: rampa }));
  else arestas.push(ar('B', 'C', 'escada_rolante', { sentido, equipamento: 'ESC_01', custo: 60 }));
  return {
    versao: '1.1', escala_m_por_unidade: null,
    andares: [{ id: 'P01', nome: 'Térreo', ordem: 1 }, { id: 'P02', nome: '1º andar', ordem: 2 }],
    nos: [no('A', 'P01', 0), no('B', 'P01', 30), no('C', 'P02', 30), no('D', 'P02', 60)],
    arestas, equipamentos: [{ id: 'ESC_01', tipo: 'escada_rolante', andares: ['P01', 'P02'] }]
  };
}
const lugaresSinteticos = () => [
  { id: 'L1', nome: 'Entrada', cat: 'entrada', piso: 1, x: 0, y: 0, no_porta: 'A' },
  { id: 'L2', nome: 'Sala 204', cat: 'sala', piso: 2, x: 60, y: 0, no_porta: 'D' },
  { id: 'E1', nome: 'Escada rolante', cat: 'escada_rolante', piso: 1, x: 30, y: 0, no_porta: 'B' },
  { id: 'E2', nome: 'Escada rolante', cat: 'escada_rolante', piso: 2, x: 30, y: 0, no_porta: 'C' }
];

test('aresta "ida" só vale num sentido', () => {
  const { R } = carregarLocalNode('shopping-estacao');
  const L = lugaresSinteticos();
  const G = R.criarGrafo11(grafoSintetico({ sentido: 'ida' }), L);
  expect(R.rota(G, L[0], L[1], { malha: false })).not.toBeNull();
  expect(R.rota(G, L[1], L[0], { malha: false })).toBeNull();
});

test('nome do andar e do meio de troca vêm do grafo', () => {
  const { R } = carregarLocalNode('shopping-estacao');
  const L = lugaresSinteticos();
  const r = R.rota(R.criarGrafo11(grafoSintetico(), L), L[0], L[1], { malha: false });
  const textos = r.passos.map(p => p.texto).join(' ');
  expect(textos).toContain('Pegue a escada rolante e suba para o 1º andar.');
  expect(textos).toContain('No 1º andar, ao sair da escada rolante');
});

test('rampa acima de 8,33% sai das rotas sem escada; abaixo, continua', () => {
  const { R } = carregarLocalNode('shopping-estacao');
  const L = lugaresSinteticos();
  expect(R.rota(R.criarGrafo11(grafoSintetico({ rampa: 12 }), L), L[0], L[1], { semEscadas: true, malha: false })).toBeNull();
  expect(R.rota(R.criarGrafo11(grafoSintetico({ rampa: 12 }), L), L[0], L[1], { malha: false })).not.toBeNull();
  expect(R.rota(R.criarGrafo11(grafoSintetico({ rampa: 6 }), L), L[0], L[1], { semEscadas: true, malha: false })).not.toBeNull();
});

test('lugares de cada equipamento e conexões do Shopping', () => {
  const c = carregarLocalNode('shopping-estacao');
  const G = c.R.criarGrafo11(c.local.grafo, c.local.lugares);
  expect(G.lugaresDoEquipamento('ELEV_01').map(id => G.lugarPorId[id].nome)).toEqual(['Elevadores', 'Elevadores']);
  for (const e of ['ESC_01', 'ESC_02', 'ESC_03']) expect(G.lugaresDoEquipamento(e)).toHaveLength(2);
  const elev = G.conexoes.find(x => x.tipo === 'elevador');
  expect(G.nos[elev.a].piso).toBe(1);
  expect(G.nos[elev.b].piso).toBe(2);
  expect(G.equipamentoDoLugar(c.local.lugar('2-22327').id)).toBe('ELEV_01');
});

test('equivalência: sem as portas, o grafo 1.1 dá as mesmas rotas do motor atual', async () => {
  test.setTimeout(120_000);
  const { gerar } = await import('../../ferramentas/dados/gerar-local.mjs');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'navi-'));
  for (const f of ['config.js', 'avisos.js']) fs.copyFileSync(path.join(FORA_DO_SITE, 'shopping-estacao', f), path.join(tmp, f));
  gerar('shopping-estacao', { saida: tmp, semPortas: true, data: '2026-10-27' });
  const novo = carregarLocalNode('shopping-estacao', { pasta: tmp });
  const Gn = novo.R.criarGrafo11(novo.local.grafo, novo.local.lugares, { referencias: { museu: 'do Museu Ferroviário' } });
  const { D, R } = carregarLegado();
  const Gv = R.criarGrafo(D);
  Gv.referencias = { museu: 'do Museu Ferroviário' };
  const entradas = Gv.places.filter(p => p.cat === 'entrada');
  let comparadas = 0;
  for (const opcoes of [{ malha: false }, { malha: false, semEscadas: true }]) for (const e of entradas) for (const p of Gv.places) {
    if (p === e) continue;
    const a = R.rota(Gv, e, p, opcoes);
    const b = novo.R.rota(Gn, novo.local.lugar(e.id), novo.local.lugar(p.id), opcoes);
    expect(!!b, `${e.nome} → ${p.nome}`).toBe(!!a);
    if (!a) continue;
    expect(b.passos.map(s => s.texto), `${e.nome} → ${p.nome}`).toEqual(a.passos.map(s => s.texto));
    expect([b.usaEscada, b.usaElevador]).toEqual([a.usaEscada, a.usaElevador]);
    comparadas++;
  }
  expect(comparadas).toBe(2 * 642);
});
