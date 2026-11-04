// Supabase falso para os testes de comportamento: REST (avisos, adms), Auth e a função criar-adm.
// O estado fica em memória e imita as regras de acesso de supabase/migracao.sql:
// sem sessão de ADM, só os avisos confirmados aparecem; só ADM decide e cadastra.
const URL_SUPABASE = 'https://teste.supabase.co';
const CHAVE = 'chave-publica-teste';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, prefer, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS'
};

let seq = 0;
const novoId = () => 'id-' + (++seq) + '-' + Math.random().toString(36).slice(2, 8);

/**
 * Liga o simulador no contexto e preenche js/servidor-config.js com o endereço dele.
 * @returns estado: { avisos, adms, falhar (status ou null), offline (bool), pedidos }
 */
async function simularSupabase(context, { avisos = [], configurar = true } = {}) {
  const estado = {
    avisos: avisos.map(a => ({ id: novoId(), detalhe: '', situacao: 'pendente', criado_em: new Date().toISOString(), decidido_em: null, decidido_por: null, local: 'predio-teste', ...a })),
    adms: [{ id: 'adm-naviadm', usuario: 'naviadm', senha: '12345678', criado_em: '2026-11-04T10:00:00.000Z', criado_por: 'instalação' }],
    falhar: null,
    offline: false,
    sessaoExpirada: false, // tokens e renovação passam a ser recusados
    pedidos: [],
    /** confirma avisos como faria um ADM */
    confirmar(lugar, tipo) {
      estado.avisos.push({ id: novoId(), local: 'predio-teste', lugar, tipo, detalhe: '', situacao: 'confirmado', criado_em: new Date().toISOString(), decidido_em: new Date().toISOString(), decidido_por: 'naviadm' });
    }
  };

  if (configurar) {
    await context.route('**/js/servidor-config.js', r => r.fulfill({
      status: 200, contentType: 'application/javascript',
      body: `self.NAVI_SERVIDOR = { url: '${URL_SUPABASE}', chavePublica: '${CHAVE}' };`
    }));
  }

  const admDoToken = cab => {
    const m = /^Bearer tok-(.+)$/.exec(cab.authorization || '');
    return m ? estado.adms.find(a => a.id === m[1]) || null : null;
  };
  const sp0 = url => url.searchParams.get('grant_type');
  const responder = (r, status, corpo) => r.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: corpo === undefined ? '' : JSON.stringify(corpo) });
  const filtros = (sp, linhas) => {
    for (const [k, v] of sp) {
      if (['select', 'order'].includes(k)) continue;
      if (v.startsWith('eq.')) linhas = linhas.filter(l => String(l[k]) === v.slice(3));
      else if (v.startsWith('in.(')) { const ids = v.slice(4, -1).split(','); linhas = linhas.filter(l => ids.includes(String(l[k]))); }
    }
    const ord = sp.get('order');
    if (ord) { const [col, dir] = ord.split('.'); linhas = linhas.slice().sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (dir === 'desc' ? -1 : 1)); }
    const sel = sp.get('select');
    return sel && sel !== '*' ? linhas.map(l => Object.fromEntries(sel.split(',').map(c => [c, l[c]]))) : linhas;
  };

  await context.route(u => u.hostname === 'teste.supabase.co', async r => {
    const req = r.request();
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: CORS, body: '' });
    if (estado.offline) return r.abort('internetdisconnected');
    const url = new URL(req.url()), cab = req.headers(), corpo = req.postDataJSON ? (() => { try { return req.postDataJSON(); } catch (e) { return null; } })() : null;
    estado.pedidos.push({ metodo: req.method(), caminho: url.pathname + url.search, corpo });
    if (estado.falhar) return responder(r, estado.falhar, { message: 'falha simulada' });
    if (cab.apikey !== CHAVE) return responder(r, 401, { message: 'chave errada' });
    if (estado.sessaoExpirada && cab.authorization) return responder(r, 401, { message: 'JWT expired' });
    if (estado.sessaoExpirada && sp0(url) === 'refresh_token') return responder(r, 400, { error: 'invalid_grant' });
    const adm = admDoToken(cab);
    const sp = url.searchParams;

    if (url.pathname === '/auth/v1/token') {
      if (sp.get('grant_type') === 'password') {
        const a = estado.adms.find(x => x.usuario + '@adm.navi' === corpo.email && x.senha === corpo.password);
        return a ? responder(r, 200, { access_token: 'tok-' + a.id, refresh_token: 'ref-' + a.id, expires_in: 3600, user: { id: a.id } })
          : responder(r, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
      }
      const id = String(corpo.refresh_token || '').replace(/^ref-/, '');
      return estado.adms.some(a => a.id === id) ? responder(r, 200, { access_token: 'tok-' + id, refresh_token: 'ref-' + id, user: { id } }) : responder(r, 400, { error: 'invalid_grant' });
    }
    if (url.pathname === '/rest/v1/avisos') {
      if (req.method() === 'POST') {
        const permitido = ['local', 'lugar', 'tipo', 'detalhe'];
        if (Object.keys(corpo).some(k => !permitido.includes(k))) return responder(r, 401, { message: 'permission denied' });
        estado.avisos.push({ id: novoId(), detalhe: '', ...corpo, situacao: 'pendente', criado_em: new Date().toISOString(), decidido_em: null, decidido_por: null });
        return responder(r, 201);
      }
      if (req.method() === 'GET') return responder(r, 200, filtros(sp, adm ? estado.avisos : estado.avisos.filter(a => a.situacao === 'confirmado')));
      if (req.method() === 'PATCH') {
        if (!adm) return responder(r, 200, []);
        const ids = (sp.get('id') || '').replace(/^in\.\(|\)$/g, '').split(',');
        for (const a of estado.avisos) if (ids.includes(a.id)) Object.assign(a, corpo);
        return responder(r, 204);
      }
    }
    if (url.pathname === '/rest/v1/adms') {
      if (!adm) return responder(r, 200, []);
      return responder(r, 200, filtros(sp, estado.adms));
    }
    if (url.pathname === '/functions/v1/criar-adm') {
      if (!adm) return responder(r, 401, { erro: 'sessao' });
      const usuario = String(corpo.usuario || '').trim().toLowerCase();
      if (!/^[a-z0-9.-]{3,30}$/.test(usuario) || String(corpo.senha || '').length < 8) return responder(r, 400, { erro: 'invalido' });
      if (estado.adms.some(a => a.usuario === usuario)) return responder(r, 409, { erro: 'existe' });
      estado.adms.push({ id: 'adm-' + usuario, usuario, senha: corpo.senha, criado_em: new Date().toISOString(), criado_por: adm.usuario });
      return responder(r, 201, { usuario });
    }
    return responder(r, 404, { message: 'não simulado: ' + url.pathname });
  });
  return estado;
}

module.exports = { simularSupabase, URL_SUPABASE, CHAVE };
