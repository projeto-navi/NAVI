// Locais: escolha por ?local=, montagem, ids antigos, local ainda sem planta e grafo gerado.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { carregarLocalNode, SITE } = require('../apoio/local-node');

const indice = [{ slug: 'shopping-estacao', padrao: true }, { slug: 'uniopet-reboucas' }];

test.describe('slugDaUrl', () => {
  const { NaviLocal } = carregarLocalNode('shopping-estacao');
  const casos = [['', 'shopping-estacao'], ['?local=shopping-estacao', 'shopping-estacao'], ['?local=uniopet-reboucas', 'uniopet-reboucas'],
    ['?local=nao-existe', 'shopping-estacao'], ['?local=../x', 'shopping-estacao'], ['?local=SHOPPING-ESTACAO', 'shopping-estacao'],
    ['?local=%3Cscript%3E', 'shopping-estacao']];
  for (const [entrada, esperado] of casos) test(`"${entrada}" → ${esperado}`, () => expect(NaviLocal.slugDaUrl(entrada, indice)).toBe(esperado));
});

test('lugar() aceita id novo e id antigo e devolve o mesmo objeto', () => {
  const { local } = carregarLocalNode('shopping-estacao');
  const azul = local.lugar('1-1401928');
  expect(azul.nome).toBe('Acesso Azul');
  expect(local.lugar(azul.id)).toBe(azul);
  expect(azul.id).toMatch(/^SHE_P01_L\d{4}$/);
  expect(local.lugar('nao-existe')).toBeNull();
  expect(local.lugar(null)).toBeNull();
});

test('legado aponta para os mesmos objetos, por ordem do andar', () => {
  const { local } = carregarLocalNode('shopping-estacao');
  expect(local.legado.places).toBe(local.lugares);
  expect(local.legado.plantas[1]).toBe(local.dados.plantas.P01);
  expect(local.legado.pisos[2]).toBe(local.dados.pisos.P02);
});

test('UniOpet Rebouças: local em preparação, sem lugares, com config completo', () => {
  const { local } = carregarLocalNode('uniopet-reboucas');
  expect(local.pendente).toBe(true);
  expect(local.lugares).toEqual([]);
  expect(local.config.nome).toBe('UniOpet — Campus Rebouças');
  expect(local.config.dadosProntos).toBe(false);
  expect(local.config.atalhos.map(a => a[1])).toEqual(expect.arrayContaining(['Sanitário acessível mais próximo', 'Secretaria', 'Biblioteca']));
});

test.describe('grafo gerado do Shopping', () => {
  const { local } = carregarLocalNode('shopping-estacao');
  const g = local.grafo;
  test('grafo.js e grafo.json têm o mesmo conteúdo', () => {
    const json = JSON.parse(fs.readFileSync(path.join(SITE, 'locais/shopping-estacao/grafo.json'), 'utf8'));
    expect(JSON.stringify(json)).toBe(JSON.stringify(g));
  });
  test('contagens', () => {
    expect(g.versao).toBe('1.1');
    expect(g.lugares).toHaveLength(215);
    expect(g.nos.filter(n => n.tipo === 'corredor')).toHaveLength(316);
    expect(g.arestas.filter(a => a.tipo === 'escada_rolante' && a.sentido === 'ida')).toHaveLength(6);
    expect(g.equipamentos.map(e => e.id)).toEqual(['ESC_01', 'ESC_02', 'ESC_03', 'ELEV_01']);
    expect(g.equipamentos.find(e => e.id === 'ELEV_01').posicao_estimada).toBe(true);
  });
  test('todo id antigo é alias de exatamente um lugar', () => {
    const aliases = g.lugares.flatMap(l => l.aliases);
    expect(new Set(aliases).size).toBe(aliases.length);
    expect(aliases).toContain('elevador-piso-1');
    expect(aliases).toContain('1-2484249');
  });
  test('ids seguem o padrão', () => {
    for (const l of g.lugares) expect(l.id).toMatch(/^SHE_P0[12]_L\d{4}$/);
    for (const n of g.nos) expect(n.id).toMatch(/^SHE_P0[12]_N\d{4}$/);
  });
  test('sem escala medida, a posição é a da planta e metros não aparecem', () => {
    expect(g.escala_m_por_unidade).toBeNull();
    expect(g.escala_medida_em).toBeNull();
    const n = g.nos[0];
    expect(n.pos[1]).toBe(0);
  });
});

test('gerar de novo mantém os ids e só muda a data', async () => {
  const { gerar } = await import('../../ferramentas/dados/gerar-local.mjs');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'navi-'));
  fs.copyFileSync(path.join(SITE, 'locais/shopping-estacao/grafo.json'), path.join(tmp, 'grafo.json'));
  const r = gerar('shopping-estacao', { saida: tmp, data: '2030-01-01' });
  const atual = JSON.parse(fs.readFileSync(path.join(SITE, 'locais/shopping-estacao/grafo.json'), 'utf8'));
  expect({ ...r.grafo, gerado: atual.gerado }).toEqual(atual);
});
