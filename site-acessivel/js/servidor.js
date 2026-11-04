/* Navi — ligação com o servidor (Supabase) para avisos compartilhados e Área ADM (RN66–RN70).
   Só fetch, sem biblioteca: REST (PostgREST), Auth e a Edge Function criar-adm.
   Visitante: manda só a chave pública. ADM: chave pública + token da sessão (sessionStorage).
   Nada sobre quem avisa é enviado (RN55). */
(function (raiz) {
  'use strict';
  const USUARIO = /^[a-z0-9.-]{3,30}$/;
  const CHAVE_CONFIRMADOS = 'navi-avisos-servidor';
  const CHAVE_SESSAO = 'navi-adm-sessao';
  const SITUACOES = ['pendente', 'confirmado', 'recusado', 'resolvido'];

  const emailDe = (usuario) => String(usuario || '').trim().toLowerCase() + '@adm.navi';
  const falha = (codigo) => new Error(codigo);

  function guardaSegura(arm) {
    return {
      ler(k) { try { return arm ? arm.getItem(k) : null; } catch (e) { return null; } },
      gravar(k, v) { try { if (arm) arm.setItem(k, v); } catch (e) { /* sem espaço ou bloqueado */ } },
      apagar(k) { try { if (arm) arm.removeItem(k); } catch (e) { /* idem */ } }
    };
  }

  function criar(op = {}) {
    const cfg = op.config || raiz.NAVI_SERVIDOR || {};
    const base = String(cfg.url || '').replace(/\/+$/, '');
    const chave = String(cfg.chavePublica || '');
    const buscar = op.fetch || (typeof fetch !== 'undefined' ? fetch.bind(raiz) : null);
    const arm = guardaSegura(op.armazenamento !== undefined ? op.armazenamento : (typeof localStorage !== 'undefined' ? localStorage : null));
    const ses = guardaSegura(op.sessaoArm !== undefined ? op.sessaoArm : (typeof sessionStorage !== 'undefined' ? sessionStorage : null));

    const configurado = () => !!(base && chave && buscar);

    async function pedir(caminho, { metodo = 'GET', corpo, token, prefer } = {}) {
      const cab = { apikey: chave, 'Content-Type': 'application/json' };
      if (token) cab.Authorization = 'Bearer ' + token;
      if (prefer) cab.Prefer = prefer;
      try {
        return await buscar(base + caminho, { method: metodo, headers: cab, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
      } catch (e) {
        throw falha('rede');
      }
    }
    async function json(r) { try { return await r.json(); } catch (e) { return null; } }

    // ---------- sessão do ADM ----------
    function lerSessao() {
      const t = ses.ler(CHAVE_SESSAO);
      if (!t) return null;
      try { const s = JSON.parse(t); return s && s.usuario && s.access_token ? s : null; } catch (e) { return null; }
    }
    const gravarSessao = (s) => ses.gravar(CHAVE_SESSAO, JSON.stringify(s));
    function sessao() { const s = lerSessao(); return s ? { usuario: s.usuario } : null; }
    function sair() { ses.apagar(CHAVE_SESSAO); }

    async function renovar(s) {
      const r = await pedir('/auth/v1/token?grant_type=refresh_token', { metodo: 'POST', corpo: { refresh_token: s.refresh_token } });
      if (!r.ok) return null;
      const d = await json(r);
      if (!d || !d.access_token) return null;
      const nova = { ...s, access_token: d.access_token, refresh_token: d.refresh_token || s.refresh_token };
      gravarSessao(nova);
      return nova;
    }

    // Pedido de ADM: um 401 renova a sessão e repete uma vez.
    async function pedirAdm(caminho, opcoes = {}) {
      let s = lerSessao();
      if (!s || !configurado()) throw falha('sessao');
      let r = await pedir(caminho, { ...opcoes, token: s.access_token });
      if (r.status === 401) {
        s = await renovar(s);
        if (!s) { sair(); throw falha('sessao'); }
        r = await pedir(caminho, { ...opcoes, token: s.access_token });
        if (r.status === 401) { sair(); throw falha('sessao'); }
      }
      return r;
    }
    async function okOuFalha(r) {
      if (r.ok) return r;
      if (r.status === 401 || r.status === 403) throw falha('sessao');
      throw falha('rede');
    }

    async function entrar(usuario, senha) {
      if (!configurado()) throw falha('nao-configurado');
      const nome = String(usuario || '').trim().toLowerCase();
      const r = await pedir('/auth/v1/token?grant_type=password', { metodo: 'POST', corpo: { email: emailDe(nome), password: String(senha || '') } });
      if (r.status === 400 || r.status === 401 || r.status === 422) throw falha('credenciais');
      if (!r.ok) throw falha('rede');
      const d = await json(r);
      if (!d || !d.access_token || !d.user) throw falha('rede');
      const a = await pedir('/rest/v1/adms?select=usuario&id=eq.' + encodeURIComponent(d.user.id), { token: d.access_token });
      if (!a.ok) throw falha('rede');
      const linhas = (await json(a)) || [];
      if (!linhas.length) { sair(); throw falha('nao-adm'); }
      gravarSessao({ usuario: linhas[0].usuario, access_token: d.access_token, refresh_token: d.refresh_token });
      return { usuario: linhas[0].usuario };
    }

    // ---------- visitante ----------
    async function enviarAviso({ local, lugar, tipo, detalhe }) {
      if (!configurado()) return false;
      try {
        // return=minimal: o visitante não pode ler avisos pendentes, então não pede a linha de volta
        const r = await pedir('/rest/v1/avisos', { metodo: 'POST', prefer: 'return=minimal', corpo: { local, lugar, tipo, detalhe: detalhe || '' } });
        return r.ok;
      } catch (e) {
        return false;
      }
    }

    function lerGuardados() {
      try { return JSON.parse(arm.ler(CHAVE_CONFIRMADOS) || '{}') || {}; } catch (e) { return {}; }
    }
    function confirmadosGuardados(local) {
      const l = lerGuardados()[local];
      return Array.isArray(l) ? l : [];
    }
    async function confirmados(local) {
      if (!configurado()) return null;
      try {
        const r = await pedir('/rest/v1/avisos?select=lugar,tipo,detalhe,decidido_em&local=eq.' + encodeURIComponent(local) + '&situacao=eq.confirmado');
        if (!r.ok) return null;
        const linhas = await json(r);
        if (!Array.isArray(linhas)) return null;
        const lista = linhas.map(l => ({ lugar: l.lugar, tipo: l.tipo, detalhe: l.detalhe || '', desde: l.decidido_em || null }));
        const todos = lerGuardados();
        todos[local] = lista;
        arm.gravar(CHAVE_CONFIRMADOS, JSON.stringify(todos));
        return lista;
      } catch (e) {
        return null;
      }
    }

    // ---------- ADM ----------
    async function listarAvisos(local) {
      const r = await okOuFalha(await pedirAdm('/rest/v1/avisos?select=*&local=eq.' + encodeURIComponent(local) + '&order=criado_em.desc'));
      return (await json(r)) || [];
    }
    async function decidir(ids, situacao) {
      if (!SITUACOES.includes(situacao) || !Array.isArray(ids) || !ids.length) throw falha('invalido');
      const s = lerSessao();
      if (!s) throw falha('sessao');
      const lista = ids.map(id => encodeURIComponent(id)).join(',');
      await okOuFalha(await pedirAdm('/rest/v1/avisos?id=in.(' + lista + ')', {
        metodo: 'PATCH', prefer: 'return=minimal',
        corpo: { situacao, decidido_em: new Date().toISOString(), decidido_por: s.usuario }
      }));
    }
    async function listarAdms() {
      const r = await okOuFalha(await pedirAdm('/rest/v1/adms?select=usuario,criado_em&order=criado_em.asc'));
      return (await json(r)) || [];
    }
    async function criarAdm(usuario, senha) {
      const nome = String(usuario || '').trim().toLowerCase();
      if (!USUARIO.test(nome) || String(senha || '').length < 8) throw falha('invalido');
      const r = await pedirAdm('/functions/v1/criar-adm', { metodo: 'POST', corpo: { usuario: nome, senha: String(senha) } });
      if (r.ok) return;
      if (r.status === 409) throw falha('existe');
      if (r.status === 400) throw falha('invalido');
      if (r.status === 401 || r.status === 403) throw falha('sessao');
      throw falha('rede');
    }

    return { configurado, enviarAviso, confirmados, confirmadosGuardados, entrar, sessao, sair, listarAvisos, decidir, listarAdms, criarAdm };
  }

  // Liga uma página pública ao servidor: confirmados nas interdições (cópia na hora, servidor depois)
  // e envio de avisos com fila. `pronto` resolve quando a busca no servidor termina.
  function ligar({ local, inter, aoMudar, ...op }) {
    const s = criar(op);
    if (!s.configurado()) return { configurado: false, enviar: async () => 'desligado', pronto: Promise.resolve() };
    const Fila = raiz.NaviFilaAvisos || (typeof require === 'function' ? require('./fila-avisos.js') : null);
    const fila = Fila.criar({ servidor: s, armazenamento: op.armazenamento });
    const assinatura = l => JSON.stringify((l || []).map(a => [a.lugar, a.tipo, a.detalhe || '', a.desde || '']).sort());

    const guardados = s.confirmadosGuardados(local);
    inter.definirDoServidor(guardados);
    let atual = assinatura(guardados);

    const pronto = s.confirmados(local).then(lista => {
      if (!lista || assinatura(lista) === atual) return;
      atual = assinatura(lista);
      inter.definirDoServidor(lista);
      if (aoMudar) aoMudar();
    });
    fila.enviar();
    if (typeof raiz.addEventListener === 'function') raiz.addEventListener('online', () => fila.enviar());

    return { configurado: true, pronto, enviar: aviso => fila.adicionar({ ...aviso, local }) };
  }

  const api = { criar, ligar, emailDe, USUARIO, CHAVE_CONFIRMADOS, CHAVE_SESSAO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else raiz.NaviServidor = api;
})(typeof window !== 'undefined' ? window : globalThis);
