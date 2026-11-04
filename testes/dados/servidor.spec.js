// Ligação com o servidor do Navi (Supabase): avisos e Área ADM (RN66–RN70).
// Usa um fetch falso que grava os pedidos; nada sai da máquina.
const { test, expect } = require('@playwright/test');
const NaviServidor = require('../../site-acessivel/js/servidor.js');
const { armazenamentoFalso } = require('../apoio/local-node');

const URL_ = 'https://exemplo.supabase.co';
const CONFIG = { url: URL_, chavePublica: 'chave-publica' };

function resp(status, corpo) {
  return {
    ok: status >= 200 && status < 300, status,
    json: async () => corpo,
    text: async () => (corpo === undefined ? '' : JSON.stringify(corpo))
  };
}

// fila de respostas: cada item é (pedido) => resposta
function fetchFalso(respostas) {
  const pedidos = [];
  const f = async (url, op = {}) => {
    const p = { url, metodo: op.method || 'GET', cab: op.headers || {}, corpo: op.body ? JSON.parse(op.body) : undefined };
    pedidos.push(p);
    const r = respostas.shift();
    if (!r) throw new Error('pedido inesperado: ' + url);
    if (r === 'rede') throw new TypeError('Failed to fetch');
    return typeof r === 'function' ? r(p) : r;
  };
  f.pedidos = pedidos;
  return f;
}

const TOKEN_OK = resp(200, { access_token: 'tok-1', refresh_token: 'ref-1', expires_in: 3600, user: { id: 'u1' } });

function criar(respostas, extra = {}) {
  const fetch = fetchFalso(respostas);
  const armazenamento = armazenamentoFalso();
  const sessaoArm = armazenamentoFalso();
  const s = NaviServidor.criar({ config: CONFIG, fetch, armazenamento, sessaoArm, ...extra });
  return { s, fetch, armazenamento, sessaoArm };
}

async function logado(respostasDepois) {
  const c = criar([TOKEN_OK, resp(200, [{ usuario: 'naviadm' }]), ...respostasDepois]);
  await c.s.entrar('naviadm', '12345678');
  return c;
}

test.describe('NaviServidor', () => {
  test('sem url ou chave: não está configurado e não faz pedidos', async () => {
    const f = fetchFalso([]);
    const s = NaviServidor.criar({ config: { url: '', chavePublica: '' }, fetch: f, armazenamento: armazenamentoFalso(), sessaoArm: armazenamentoFalso() });
    expect(s.configurado()).toBe(false);
    expect(await s.enviarAviso({ local: 'predio-teste', lugar: 'Rampa', tipo: 'interditado', detalhe: '' })).toBe(false);
    expect(await s.confirmados('predio-teste')).toBeNull();
    await expect(s.entrar('naviadm', '12345678')).rejects.toThrow('nao-configurado');
    expect(f.pedidos).toHaveLength(0);
  });

  test('configurado com url e chave', () => {
    expect(criar([]).s.configurado()).toBe(true);
  });

  test('enviarAviso: POST anônimo com só os 4 campos, sem situação, e sem pedir a linha de volta', async () => {
    const { s, fetch } = criar([resp(201)]);
    const ok = await s.enviarAviso({ local: 'predio-teste', lugar: 'Elevador 1', tipo: 'danificado', detalhe: 'porta travada', situacao: 'confirmado' });
    expect(ok).toBe(true);
    const [p] = fetch.pedidos;
    expect(p.url).toBe(URL_ + '/rest/v1/avisos');
    expect(p.metodo).toBe('POST');
    expect(p.cab.apikey).toBe('chave-publica');
    expect(p.cab.Authorization).toBeUndefined();
    expect(p.cab.Prefer).toBe('return=minimal');
    expect(p.corpo).toEqual({ local: 'predio-teste', lugar: 'Elevador 1', tipo: 'danificado', detalhe: 'porta travada' });
  });

  test('enviarAviso: sem internet devolve false', async () => {
    const { s } = criar(['rede']);
    expect(await s.enviarAviso({ local: 'predio-teste', lugar: 'Rampa', tipo: 'interditado', detalhe: '' })).toBe(false);
  });

  test('confirmados: consulta só os confirmados do local e guarda uma cópia', async () => {
    const { s, fetch, armazenamento } = criar([resp(200, [{ lugar: 'Rampa', tipo: 'interditado', detalhe: 'obra', decidido_em: '2026-11-04T12:00:00Z' }])]);
    const lista = await s.confirmados('predio-teste');
    expect(fetch.pedidos[0].url).toBe(URL_ + '/rest/v1/avisos?select=lugar,tipo,detalhe,decidido_em&local=eq.predio-teste&situacao=eq.confirmado');
    expect(fetch.pedidos[0].cab.Authorization).toBeUndefined();
    expect(lista).toEqual([{ lugar: 'Rampa', tipo: 'interditado', detalhe: 'obra', desde: '2026-11-04T12:00:00Z' }]);
    expect(JSON.parse(armazenamento.getItem('navi-avisos-servidor'))['predio-teste']).toEqual(lista);
    expect(s.confirmadosGuardados('predio-teste')).toEqual(lista);
    expect(s.confirmadosGuardados('outro-local')).toEqual([]);
  });

  test('confirmados: erro devolve null e mantém a cópia anterior', async () => {
    const { s } = criar([resp(200, [{ lugar: 'Rampa', tipo: 'interditado', detalhe: '', decidido_em: null }]), 'rede']);
    await s.confirmados('predio-teste');
    expect(await s.confirmados('predio-teste')).toBeNull();
    expect(s.confirmadosGuardados('predio-teste')).toHaveLength(1);
  });

  test('entrar: usa <usuario>@adm.navi, confere a tabela adms e guarda a sessão na aba', async () => {
    const { s, fetch, sessaoArm } = await logado([]);
    const [token, adm] = fetch.pedidos;
    expect(token.url).toBe(URL_ + '/auth/v1/token?grant_type=password');
    expect(token.corpo).toEqual({ email: 'naviadm@adm.navi', password: '12345678' });
    expect(adm.url).toBe(URL_ + '/rest/v1/adms?select=usuario&id=eq.u1');
    expect(adm.cab.Authorization).toBe('Bearer tok-1');
    expect(s.sessao()).toEqual({ usuario: 'naviadm' });
    expect(sessaoArm.getItem('navi-adm-sessao')).toContain('tok-1');
    s.sair();
    expect(s.sessao()).toBeNull();
    expect(sessaoArm.getItem('navi-adm-sessao')).toBeNull();
  });

  test('entrar: usuário com maiúsculas e espaços vira o mesmo e-mail', () => {
    expect(NaviServidor.emailDe('  NaviADM ')).toBe('naviadm@adm.navi');
  });

  test('entrar: senha errada → credenciais; sem internet → rede; conta fora de adms → nao-adm', async () => {
    await expect(criar([resp(400, { error: 'invalid_grant' })]).s.entrar('naviadm', 'errada00')).rejects.toThrow('credenciais');
    await expect(criar(['rede']).s.entrar('naviadm', '12345678')).rejects.toThrow('rede');
    const c = criar([TOKEN_OK, resp(200, [])]);
    await expect(c.s.entrar('joao', '12345678')).rejects.toThrow('nao-adm');
    expect(c.s.sessao()).toBeNull();
  });

  test('um 401 renova a sessão e repete o pedido uma vez', async () => {
    const { s, fetch } = await logado([
      resp(401, { message: 'JWT expired' }),
      resp(200, { access_token: 'tok-2', refresh_token: 'ref-2', expires_in: 3600, user: { id: 'u1' } }),
      resp(200, [{ id: 'a', lugar: 'Rampa', tipo: 'interditado', situacao: 'pendente' }])
    ]);
    const lista = await s.listarAvisos('predio-teste');
    expect(lista).toHaveLength(1);
    const [, , primeira, renova, repete] = fetch.pedidos;
    expect(primeira.url).toBe(URL_ + '/rest/v1/avisos?select=*&local=eq.predio-teste&order=criado_em.desc');
    expect(renova.url).toBe(URL_ + '/auth/v1/token?grant_type=refresh_token');
    expect(renova.corpo).toEqual({ refresh_token: 'ref-1' });
    expect(repete.cab.Authorization).toBe('Bearer tok-2');
    expect(fetch.pedidos).toHaveLength(5);
  });

  test('401 e a renovação falha: sai e rejeita com sessao', async () => {
    const { s } = await logado([resp(401, {}), resp(400, { error: 'invalid_grant' })]);
    await expect(s.listarAvisos('predio-teste')).rejects.toThrow('sessao');
    expect(s.sessao()).toBeNull();
  });

  test('decidir: PATCH ?id=in.(a,b) com a situação, a data e quem decidiu', async () => {
    const { s, fetch } = await logado([resp(204)]);
    await s.decidir(['a', 'b'], 'confirmado');
    const p = fetch.pedidos[2];
    expect(p.metodo).toBe('PATCH');
    expect(p.url).toBe(URL_ + '/rest/v1/avisos?id=in.(a,b)');
    expect(p.cab.Authorization).toBe('Bearer tok-1');
    expect(p.corpo.situacao).toBe('confirmado');
    expect(p.corpo.decidido_por).toBe('naviadm');
    expect(Number.isNaN(Date.parse(p.corpo.decidido_em))).toBe(false);
    expect(Object.keys(p.corpo).sort()).toEqual(['decidido_em', 'decidido_por', 'situacao']);
  });

  test('decidir: situação desconhecida não chega ao servidor', async () => {
    const { s, fetch } = await logado([]);
    await expect(s.decidir(['a'], 'apagado')).rejects.toThrow('invalido');
    expect(fetch.pedidos).toHaveLength(2);
  });

  test('listarAdms', async () => {
    const { s, fetch } = await logado([resp(200, [{ usuario: 'naviadm', criado_em: '2026-11-04T10:00:00Z' }])]);
    expect(await s.listarAdms()).toEqual([{ usuario: 'naviadm', criado_em: '2026-11-04T10:00:00Z' }]);
    expect(fetch.pedidos[2].url).toBe(URL_ + '/rest/v1/adms?select=usuario,criado_em&order=criado_em.asc');
  });

  test('criarAdm: chama a função criar-adm com a sessão', async () => {
    const { s, fetch } = await logado([resp(201, { usuario: 'joao' })]);
    await s.criarAdm('joao', 'senha-forte');
    const p = fetch.pedidos[2];
    expect(p.url).toBe(URL_ + '/functions/v1/criar-adm');
    expect(p.metodo).toBe('POST');
    expect(p.cab.Authorization).toBe('Bearer tok-1');
    expect(p.cab.apikey).toBe('chave-publica');
    expect(p.corpo).toEqual({ usuario: 'joao', senha: 'senha-forte' });
  });

  test('criarAdm: erros', async () => {
    let c = await logado([resp(409, { erro: 'existe' })]);
    await expect(c.s.criarAdm('naviadm', '12345678')).rejects.toThrow('existe');
    c = await logado([]);
    await expect(c.s.criarAdm('Jo', '12345678')).rejects.toThrow('invalido');
    await expect(c.s.criarAdm('joao', '1234567')).rejects.toThrow('invalido');
    expect(c.fetch.pedidos).toHaveLength(2);
    c = await logado(['rede']);
    await expect(c.s.criarAdm('joao', '12345678')).rejects.toThrow('rede');
    const sem = criar([]);
    await expect(sem.s.criarAdm('joao', '12345678')).rejects.toThrow('sessao');
  });

  test('a sessão sobrevive a recarregar a página (mesmo sessionStorage)', async () => {
    const { sessaoArm } = await logado([]);
    const outra = NaviServidor.criar({ config: CONFIG, fetch: fetchFalso([]), armazenamento: armazenamentoFalso(), sessaoArm });
    expect(outra.sessao()).toEqual({ usuario: 'naviadm' });
  });

  test('USUARIO aceita minúsculas, números, ponto e hífen, de 3 a 30', () => {
    expect(NaviServidor.USUARIO.test('naviadm')).toBe(true);
    expect(NaviServidor.USUARIO.test('ana.silva-2')).toBe(true);
    expect(NaviServidor.USUARIO.test('ab')).toBe(false);
    expect(NaviServidor.USUARIO.test('Ana')).toBe(false);
    expect(NaviServidor.USUARIO.test('a'.repeat(31))).toBe(false);
  });
});
