// Fila de avisos sem internet, avisos confirmados pelo ADM nas interdições e NaviServidor.ligar (RN68–RN70).
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test, expect } = require('@playwright/test');
const { carregarLocalNode, grafoDoLocal, armazenamentoFalso, SITE } = require('../apoio/local-node');

const CONFIG = { url: 'https://exemplo.supabase.co', chavePublica: 'chave-publica' };
const ELEVADOR_1 = 'PCT_P01_L0007';

function resp(status, corpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo };
}
// rede ligada/desligada à vontade; grava os avisos que chegaram ao "servidor"
function rede() {
  const r = { online: true, recebidos: [], confirmados: [] };
  r.fetch = async (url, op = {}) => {
    if (!r.online) throw new TypeError('Failed to fetch');
    if ((op.method || 'GET') === 'POST' && url.endsWith('/rest/v1/avisos')) { r.recebidos.push(JSON.parse(op.body)); return resp(201); }
    if (url.includes('situacao=eq.confirmado')) return resp(200, r.confirmados);
    throw new Error('pedido inesperado: ' + url);
  };
  return r;
}

function carregar() {
  const c = carregarLocalNode('predio-teste');
  for (const f of ['js/servidor.js', 'js/fila-avisos.js']) vm.runInContext(fs.readFileSync(path.join(SITE, f), 'utf8'), c.ctx, { filename: f });
  const G = grafoDoLocal(c);
  const inter = c.NaviInterdicoes.criar({ local: c.local, G, armazenamento: armazenamentoFalso() });
  return { ...c, G, inter, NaviServidor: c.ctx.NaviServidor, NaviFilaAvisos: c.ctx.NaviFilaAvisos };
}

function filaCom(c, r, armazenamento = armazenamentoFalso()) {
  const servidor = c.NaviServidor.criar({ config: CONFIG, fetch: r.fetch, armazenamento: armazenamentoFalso(), sessaoArm: armazenamentoFalso() });
  return { fila: c.NaviFilaAvisos.criar({ servidor, armazenamento }), armazenamento };
}

const AVISO = { local: 'predio-teste', lugar: ELEVADOR_1, tipo: 'danificado', detalhe: 'porta travada' };

test.describe('NaviFilaAvisos', () => {
  test('com internet: o aviso vai direto e a fila fica vazia', async () => {
    const c = carregar(); const r = rede();
    const { fila } = filaCom(c, r);
    expect(await fila.adicionar(AVISO)).toBe('enviado');
    expect(r.recebidos).toEqual([AVISO]);
    expect(fila.pendentes()).toEqual([]);
  });

  test('sem internet: o aviso vai para a fila, guardada no aparelho', async () => {
    const c = carregar(); const r = rede(); r.online = false;
    const { fila, armazenamento } = filaCom(c, r);
    expect(await fila.adicionar(AVISO)).toBe('fila');
    expect(fila.pendentes()).toHaveLength(1);
    expect(JSON.parse(armazenamento.getItem('navi-avisos-fila'))).toHaveLength(1);
  });

  test('enviar() com a internet de volta esvazia a fila e não reenvia', async () => {
    const c = carregar(); const r = rede(); r.online = false;
    const { fila, armazenamento } = filaCom(c, r);
    await fila.adicionar(AVISO);
    await fila.adicionar({ ...AVISO, lugar: 'PCT_P01_L0011', tipo: 'interditado', detalhe: '' });
    r.online = true;
    expect(await fila.enviar()).toBe(2);
    expect(r.recebidos.map(a => a.lugar)).toEqual([ELEVADOR_1, 'PCT_P01_L0011']);
    expect(fila.pendentes()).toEqual([]);
    expect(await fila.enviar()).toBe(0);
    expect(r.recebidos).toHaveLength(2);
    // outra página do mesmo aparelho lê a mesma fila (já vazia)
    expect(filaCom(c, r, armazenamento).fila.pendentes()).toEqual([]);
  });

  test('enviar() duas vezes ao mesmo tempo não manda o aviso em dobro', async () => {
    const c = carregar(); const r = rede(); r.online = false;
    const { fila } = filaCom(c, r);
    await fila.adicionar(AVISO);
    r.online = true;
    await Promise.all([fila.enviar(), fila.enviar()]);
    expect(r.recebidos).toHaveLength(1);
  });

  test('o detalhe é cortado em 280 caracteres (limite do servidor)', async () => {
    const c = carregar(); const r = rede();
    const { fila } = filaCom(c, r);
    await fila.adicionar({ ...AVISO, detalhe: 'x'.repeat(300) });
    expect(r.recebidos[0].detalhe).toHaveLength(280);
  });
});

test.describe('NaviInterdicoes.definirDoServidor', () => {
  test('Elevador 1 danificado e confirmado bloqueia o elevador nos dois andares', () => {
    const c = carregar();
    const andares = c.G.lugaresDoEquipamento(c.G.equipamentoDoLugar(ELEVADOR_1));
    expect(andares.length).toBeGreaterThanOrEqual(2);
    expect(c.inter.bloqueados().size).toBe(0);
    c.inter.definirDoServidor([{ lugar: ELEVADOR_1, tipo: 'danificado', detalhe: '', desde: '2026-11-04T12:00:00Z' }]);
    const b = c.inter.bloqueados();
    for (const id of andares) expect(b.has(id)).toBe(true);
    const [of] = c.inter.oficiais();
    expect(of).toMatchObject({ lugar: ELEVADOR_1, origem: 'servidor', oficial: true, desde: '2026-11-04T12:00:00Z' });
  });

  test('lugar inexistente ou tipo desconhecido é ignorado', () => {
    const c = carregar();
    c.inter.definirDoServidor([{ lugar: 'NAO_EXISTE', tipo: 'interditado' }, { lugar: ELEVADOR_1, tipo: 'explodido' }]);
    expect(c.inter.oficiais()).toEqual([]);
    expect(c.inter.bloqueados().size).toBe(0);
  });

  test('uma lista nova substitui a anterior (aviso resolvido sai)', () => {
    const c = carregar();
    c.inter.definirDoServidor([{ lugar: ELEVADOR_1, tipo: 'interditado' }]);
    c.inter.definirDoServidor([]);
    expect(c.inter.bloqueados().size).toBe(0);
  });
});

test.describe('NaviServidor.ligar', () => {
  function ligar(c, r, armazenamento, aoMudar) {
    return c.NaviServidor.ligar({ local: 'predio-teste', inter: c.inter, aoMudar, config: CONFIG, fetch: r.fetch, armazenamento, sessaoArm: armazenamentoFalso() });
  }

  test('sem servidor configurado: desligado, nada muda', async () => {
    const c = carregar();
    const l = c.NaviServidor.ligar({ local: 'predio-teste', inter: c.inter, config: { url: '', chavePublica: '' }, armazenamento: armazenamentoFalso() });
    expect(l.configurado).toBe(false);
    expect(await l.enviar(AVISO)).toBe('desligado');
  });

  test('usa a cópia guardada na hora e avisa quando o servidor traz algo novo', async () => {
    const c = carregar(); const r = rede();
    const arm = armazenamentoFalso({ 'navi-avisos-servidor': JSON.stringify({ 'predio-teste': [{ lugar: 'PCT_P01_L0011', tipo: 'interditado', detalhe: '', desde: null }] }) });
    r.confirmados = [{ lugar: ELEVADOR_1, tipo: 'danificado', detalhe: '', decidido_em: '2026-11-04T12:00:00Z' }];
    let mudou = 0;
    const l = ligar(c, r, arm, () => { mudou++; });
    expect(l.configurado).toBe(true);
    expect(c.inter.bloqueados().has('PCT_P01_L0011')).toBe(true); // cópia, sem esperar a rede
    await l.pronto;
    expect(mudou).toBe(1);
    expect(c.inter.bloqueados().has('PCT_P01_L0011')).toBe(false);
    expect(c.inter.bloqueados().has(ELEVADOR_1)).toBe(true);
  });

  test('servidor igual à cópia: aoMudar não é chamado', async () => {
    const c = carregar(); const r = rede();
    const arm = armazenamentoFalso({ 'navi-avisos-servidor': JSON.stringify({ 'predio-teste': [{ lugar: ELEVADOR_1, tipo: 'danificado', detalhe: '', desde: '2026-11-04T12:00:00Z' }] }) });
    r.confirmados = [{ lugar: ELEVADOR_1, tipo: 'danificado', detalhe: '', decidido_em: '2026-11-04T12:00:00Z' }];
    let mudou = 0;
    await ligar(c, r, arm, () => { mudou++; }).pronto;
    expect(mudou).toBe(0);
  });

  test('sem internet: mantém a cópia e o aviso novo vai para a fila', async () => {
    const c = carregar(); const r = rede(); r.online = false;
    const arm = armazenamentoFalso({ 'navi-avisos-servidor': JSON.stringify({ 'predio-teste': [{ lugar: ELEVADOR_1, tipo: 'danificado', detalhe: '', desde: null }] }) });
    const l = ligar(c, r, arm);
    await l.pronto;
    expect(c.inter.bloqueados().has(ELEVADOR_1)).toBe(true);
    expect(await l.enviar({ lugar: 'PCT_P01_L0011', tipo: 'interditado', detalhe: '' })).toBe('fila');
    r.online = true;
    expect(await l.enviar({ lugar: 'PCT_P01_L0004', tipo: 'obstaculo', detalhe: 'caixas' })).toBe('enviado');
    expect(r.recebidos.map(a => a.lugar).sort()).toEqual(['PCT_P01_L0004', 'PCT_P01_L0011']);
    expect(r.recebidos.every(a => a.local === 'predio-teste')).toBe(true);
  });
});
