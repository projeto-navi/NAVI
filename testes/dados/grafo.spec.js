// Testes de DADOS e do motor de rotas, sem navegador, sobre locais/shopping-estacao/ (grafo 1.1).
const { test, expect } = require('@playwright/test');
const { carregarLocalNode, grafoDoLocal, carregarLegado } = require('../apoio/local-node');

const PENDENTES_F1 = ['1-2484249', '1-35749', '2-2119510']; // La Maçã, saída de emergência, pagamento do estacionamento P2

test('215 lugares: 214 da planta + o elevador estimado do Piso 1; 2 andares; 3 entradas', () => {
  const { local } = carregarLocalNode('shopping-estacao');
  expect(local.lugares).toHaveLength(215);
  expect(local.andares.map(a => [a.id, a.nome, a.piso])).toEqual([['P01', 'Piso 1', 1], ['P02', 'Piso 2', 2]]);
  expect(local.lugares.filter(l => l.cat === 'entrada').map(l => l.nome).sort()).toEqual(['Acesso Azul', 'Acesso Verde', 'Acesso Vermelho']);
  expect(local.lugar('elevador-piso-1').estimado).toBe(true);
});

test('RN04 / RN15 — com "sem escadas", nenhuma rota entre entrada e lugar usa escada rolante', () => {
  const c = carregarLocalNode('shopping-estacao');
  const G = grafoDoLocal(c);
  const ruins = [];
  let comRota = 0;
  for (const e of G.places.filter(p => p.cat === 'entrada')) for (const p of G.places) {
    if (p === e) continue;
    const r = c.R.rota(G, e, p, { semEscadas: true, malha: false });
    if (!r) continue;
    comRota++;
    if (r.usaEscada || r.passos.some(s => s.tipo === 'escada' || /Pegue a escada/.test(s.texto))) ruins.push(`${e.nome} → ${p.nome}`);
  }
  expect(ruins).toEqual([]);
  expect(comRota).toBe(642);
});

test('RN16 — elevador interditado bloqueia as portas dos dois pisos', () => {
  const c = carregarLocalNode('shopping-estacao');
  const G = grafoDoLocal(c);
  const azul = c.local.lugar('1-1401928');
  const piso2 = G.places.find(p => p.piso === 2 && p.cat === 'loja');
  const elevadores = new Set(G.lugaresDoEquipamento('ELEV_01'));
  expect([...elevadores].map(id => G.lugarPorId[id].piso).sort()).toEqual([1, 2]);
  expect(c.R.rota(G, azul, piso2, { semEscadas: true, bloqueados: elevadores, malha: false })).toBeNull();
  expect(c.R.rota(G, azul, piso2, { semEscadas: true, malha: false })).not.toBeNull();
});

test('RN11 — a busca ignora acentos e maiúsculas e aceita parte do nome', () => {
  const { local, R } = carregarLocalNode('shopping-estacao');
  const nomes = q => R.buscar(local.lugares, q).map(p => p.nome);
  expect(nomes('BOTICARIO')).toContain('O Boticário');
  expect(nomes('boti')).toContain('O Boticário');
  expect(nomes('sanitarios').length).toBeGreaterThan(0);
});

test('RN22 — não há dois passos seguidos "Continue em frente" no mesmo piso', () => {
  const c = carregarLocalNode('shopping-estacao', { malha: true });
  const G = grafoDoLocal(c);
  const ruins = [];
  const lojas = G.places.filter(x => x.cat === 'loja').filter((_, i) => i % 3 === 0);
  for (const e of G.places.filter(p => p.cat === 'entrada')) for (const p of lojas) {
    const r = c.R.rota(G, e, p, {});
    if (!r) continue;
    r.passos.forEach((s, i) => {
      const a = r.passos[i - 1];
      if (i && /^Continue em frente/.test(s.texto) && /^Continue em frente/.test(a.texto) && s.piso === a.piso) ruins.push(`${e.nome} → ${p.nome} (passo ${i + 1})`);
    });
  }
  expect(ruins).toEqual([]);
});

test('F2 — a rota começa e termina na porta do lugar, a até 60 unidades do corredor', () => {
  const c = carregarLocalNode('shopping-estacao', { malha: true });
  const G = grafoDoLocal(c);
  const noPorId = Object.fromEntries(c.local.grafo.nos.map(n => [n.id, n]));
  const vizinhos = {};
  for (const a of c.local.grafo.arestas) { (vizinhos[a.de] = vizinhos[a.de] || []).push(a); (vizinhos[a.para] = vizinhos[a.para] || []).push(a); }
  const ruins = [];
  for (const l of c.local.lugares) {
    if (['escada_rolante', 'elevador'].includes(l.cat) || l.aliases.some(a => PENDENTES_F1.includes(a))) continue;
    const porta = noPorId[l.no_porta];
    const ligacao = (vizinhos[porta.id] || [])[0];
    if (!['porta', 'acesso'].includes(porta.tipo) || !ligacao || ligacao.comprimento_unid > 60) ruins.push(l.nome);
  }
  expect(ruins).toEqual([]);
  // a linha da rota termina no ponto da porta, não no centro da loja
  const renner = c.local.lugares.find(l => l.nome === 'Renner');
  const r = c.R.rota(G, c.local.lugar('1-1401928'), renner, {});
  const fim = r.trechos.at(-1).pontos.at(-1), porta = G.pontoDoLugar(renner);
  expect([fim.x, fim.y]).toEqual([porta.x, porta.y]);
  expect(Math.hypot(porta.x - renner.x, porta.y - renner.y)).toBeGreaterThan(5);
});

test('F5 — os motores não alteram os dados de entrada', () => {
  const { D, R } = carregarLegado();
  const antes = JSON.stringify(D.places);
  const Gv = R.criarGrafo(D);
  expect(JSON.stringify(D.places)).toBe(antes);
  expect(D.places).toHaveLength(214);
  expect(Gv.places).toHaveLength(215);
  const c = carregarLocalNode('shopping-estacao');
  const grafoAntes = JSON.stringify(c.local.grafo), lugaresAntes = JSON.stringify(c.local.lugares);
  grafoDoLocal(c);
  expect(JSON.stringify(c.local.grafo)).toBe(grafoAntes);
  expect(JSON.stringify(c.local.lugares)).toBe(lugaresAntes);
});

/* ------------------ falhas conhecidas (dependem de dados que a equipe ainda vai confirmar) ------------------ */

test('F1 — todo lugar fica dentro dos limites do seu piso', () => {
  test.fail(true, 'F1: La Maçã em (0, 0) e Saída de Emergência 1-35749 em y = 773 (limite 736). Aguardando a posição certa.');
  const { local } = carregarLocalNode('shopping-estacao');
  const fora = local.lugares.filter(l => { const b = local.legado.pisos[l.piso]; return l.x < b.minX || l.x > b.maxX || l.y < b.minY || l.y > b.maxY; })
    .map(l => `${l.aliases[0]} ${l.nome} (${l.x}, ${l.y})`);
  expect(fora).toEqual([]);
});

test('F3 — escada rolante tem um sentido só', () => {
  test.fail(true, 'F3: o sentido de cada escada rolante ainda não foi registrado; cada uma aparece nos dois sentidos.');
  const { local } = carregarLocalNode('shopping-estacao');
  const porEquip = {};
  for (const a of local.grafo.arestas.filter(a => a.tipo === 'escada_rolante')) (porEquip[a.equipamento] = porEquip[a.equipamento] || []).push(a);
  expect(Object.values(porEquip).filter(l => l.length > 1).map(l => l[0].equipamento)).toEqual([]);
});

test('F4 — sanitário acessível tem categoria própria', () => {
  test.fail(true, 'F4: os 4 sanitários estão na categoria "sanitario", sem indicar qual é acessível.');
  const { local } = carregarLocalNode('shopping-estacao');
  expect(local.lugares.some(l => l.cat === 'sanitario_acessivel' || l.acessivel === true)).toBe(true);
});
