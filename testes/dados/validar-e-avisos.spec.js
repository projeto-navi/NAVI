// Validador do grafo 1.1 e modelo de avisos de interdição.
const { test, expect } = require('@playwright/test');
const { validarGrafo } = require('../../ferramentas/dados/validar-grafo.js');
const { carregarLocalNode, armazenamentoFalso } = require('../apoio/local-node');

function minimo() {
  const no = (id, andar) => ({ id, andar, pos: [0, 0, 0], tipo: 'corredor', ref_modelo: null });
  const ar = (de, para, extra = {}) => ({ de, para, tipo: 'caminhada', comprimento_unid: 1, custo: 1, sentido: 'ambos', equipamento: null, ...extra });
  return {
    versao: '1.1', andares: [{ id: 'P01', ordem: 1 }, { id: 'P02', ordem: 2 }],
    nos: [no('A', 'P01'), no('B', 'P01'), no('C', 'P02'), no('D', 'P02')],
    arestas: [ar('A', 'B'), ar('C', 'D'), ar('B', 'C', { tipo: 'elevador', equipamento: 'ELEV_01' })],
    lugares: [{ id: 'L1', nome: 'Entrada', categoria: 'entrada', andar: 'P01', no_porta: 'A', aliases: [] },
      { id: 'L2', nome: 'Biblioteca', categoria: 'biblioteca', andar: 'P02', no_porta: 'D', aliases: [] }],
    equipamentos: [{ id: 'ELEV_01', tipo: 'elevador', andares: ['P01', 'P02'] }]
  };
}

test.describe('validarGrafo', () => {
  test('grafo mínimo correto: sem erros', () => expect(validarGrafo(minimo()).erros).toEqual([]));
  test('id repetido', () => { const g = minimo(); g.nos.push({ ...g.nos[0] }); expect(validarGrafo(g).erros.join()).toMatch(/Id repetido: A/); });
  test('aresta para nó inexistente', () => { const g = minimo(); g.arestas.push({ ...g.arestas[0], para: 'X' }); expect(validarGrafo(g).erros.join()).toMatch(/nó de destino inexistente/); });
  test('nó órfão', () => { const g = minimo(); g.nos.push({ id: 'Z', andar: 'P01', pos: [0, 0, 0], tipo: 'corredor', ref_modelo: null }); expect(validarGrafo(g).erros.join()).toMatch(/Nó órfão: Z/); });
  test('lugar sem porta', () => { const g = minimo(); g.lugares[1].no_porta = 'X'; expect(validarGrafo(g).erros.join()).toMatch(/Biblioteca\): sem no_porta/); });
  test('ref_modelo fora do padrão', () => { const g = minimo(); g.nos[0].ref_modelo = 'bloco-a'; expect(validarGrafo(g).erros.join()).toMatch(/ref_modelo/); g.nos[0].ref_modelo = 'UNIP01SALA_204'; expect(validarGrafo(g).erros).toEqual([]); });
  test('escada rolante sem sentido "ida"', () => { const g = minimo(); g.arestas[2].tipo = 'escada_rolante'; expect(validarGrafo(g).erros.join()).toMatch(/sentido "ida"/); });
  test('rampa íngreme vira aviso e sai das rotas sem escada', () => {
    const g = minimo(); g.arestas[2] = { ...g.arestas[2], tipo: 'rampa', inclinacao_pct: 12, equipamento: null };
    const r = validarGrafo(g);
    expect(r.avisos.join()).toMatch(/12% \(acima de 8.33%/);
    expect(r.semRotaSemEscada).toEqual([{ entrada: 'Entrada', destino: 'Biblioteca' }]);
  });
  test('Shopping: só os erros de F1, e todo destino tem rota sem escada', () => {
    const { local } = carregarLocalNode('shopping-estacao');
    const r = validarGrafo(local.grafo, { dados: local.dados });
    expect(r.erros.map(e => e.match(/\(([^)]+)\)/)[1])).toEqual(['La Maçã', 'Saida de Emergencia']); // F1 — esvazia quando a posição for confirmada
    expect(r.semRotaSemEscada).toEqual([]);
    expect(r.semPorta).toHaveLength(3);
  });
});

test.describe('NaviInterdicoes', () => {
  function montar(avisos) {
    const c = carregarLocalNode('shopping-estacao');
    const G = c.R.criarGrafo11(c.local.grafo, c.local.lugares);
    const arm = armazenamentoFalso({ 'navi-avisos': JSON.stringify(avisos) });
    return { ...c, G, arm, av: c.NaviInterdicoes.criar({ local: c.local, G, armazenamento: arm }) };
  }
  test('aviso antigo do elevador (2-22327) bloqueia as portas dos dois pisos', () => {
    const { av, G, local } = montar([{ lugar: '2-22327', tipo: 'danificado', criado: '2026-10-27T10:00:00Z' }]);
    expect([...av.bloqueados()].sort()).toEqual(G.lugaresDoEquipamento('ELEV_01').sort());
    expect(av.todos()[0].lugar).toBe(local.lugar('2-22327').id);
  });
  test('o id antigo "elevador-piso-1" também bloqueia o elevador', () => {
    const { av, G } = montar([{ lugar: 'elevador-piso-1', tipo: 'interditado' }]);
    expect(av.bloqueados().size).toBe(2);
    expect([...av.bloqueados()].sort()).toEqual(G.lugaresDoEquipamento('ELEV_01').sort());
  });
  test('escada rolante danificada bloqueia só aquele equipamento', () => {
    const { av, G } = montar([]);
    const esc = G.lugaresDoEquipamento('ESC_02');
    av.registrar({ lugar: esc[0], tipo: 'danificado' });
    expect([...av.bloqueados()].sort()).toEqual(esc.sort());
  });
  test('obstáculo não bloqueia; loja interditada bloqueia só a loja; lugar desconhecido é ignorado', () => {
    const { av, local } = montar([{ lugar: '1-2482759', tipo: 'obstaculo' }, { lugar: 'nao-existe', tipo: 'interditado' }]);
    expect(av.bloqueados().size).toBe(0);
    expect(av.todos()).toHaveLength(1);
    const renner = local.lugares.find(l => l.nome === 'Renner');
    av.registrar({ lugar: renner.id, tipo: 'interditado', detalhe: '  Porta fechada  ' });
    expect([...av.bloqueados()]).toEqual([renner.id]);
    expect(av.de(renner.id).detalhe).toBe('Porta fechada');
  });
  test('registrar grava o id novo; remover apaga', () => {
    const { av, arm, local } = montar([]);
    av.registrar({ lugar: '1-1401928', tipo: 'obstaculo' });
    expect(JSON.parse(arm.getItem('navi-avisos'))[0].lugar).toBe(local.lugar('1-1401928').id);
    av.remover(0);
    expect(JSON.parse(arm.getItem('navi-avisos'))).toEqual([]);
  });
});
