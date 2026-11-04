/* Navi — fila dos avisos feitos sem internet (RN68).
   Guarda no aparelho (localStorage "navi-avisos-fila") e envia quando a conexão volta.
   Cada aviso tem só local, lugar, tipo e detalhe (RN55). */
(function (raiz) {
  'use strict';
  const CHAVE = 'navi-avisos-fila';
  const MAXIMO = 50;
  const TIPOS = ['interditado', 'danificado', 'obstaculo'];
  const LOCAL = /^[a-z0-9-]{1,40}$/;

  // mesmos limites do servidor (supabase/migracao.sql), para nenhum aviso ficar preso na fila
  function limpo(a) {
    if (!a) return null;
    const local = String(a.local || ''), lugar = String(a.lugar || '').slice(0, 60);
    if (!LOCAL.test(local) || !lugar || !TIPOS.includes(a.tipo)) return null;
    return { local, lugar, tipo: a.tipo, detalhe: String(a.detalhe || '').trim().slice(0, 280) };
  }

  function criar({ servidor, armazenamento }) {
    const arm = armazenamento !== undefined ? armazenamento : (typeof localStorage !== 'undefined' ? localStorage : null);
    let memoria = null;
    let emAndamento = null;

    function pendentes() {
      if (memoria) return memoria.slice();
      try { const v = JSON.parse((arm && arm.getItem(CHAVE)) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
    }
    function salvar(lista) {
      try { if (arm) { arm.setItem(CHAVE, JSON.stringify(lista)); memoria = null; return; } } catch (e) { /* cai para a memória */ }
      memoria = lista.slice();
    }

    // Envia na ordem; para no primeiro que falhar (ainda sem internet). Devolve quantos foram.
    function enviar() {
      if (emAndamento) return emAndamento;
      emAndamento = (async () => {
        let enviados = 0;
        for (;;) {
          const lista = pendentes();
          if (!lista.length) break;
          if (!(await servidor.enviarAviso(lista[0]))) break;
          salvar(pendentes().slice(1));
          enviados++;
        }
        return enviados;
      })().finally(() => { emAndamento = null; });
      return emAndamento;
    }

    async function adicionar(aviso) {
      const a = limpo(aviso);
      if (!a) return 'fila';
      if (await servidor.enviarAviso(a)) {
        if (pendentes().length) enviar(); // a conexão voltou: aproveita para mandar os atrasados
        return 'enviado';
      }
      salvar(pendentes().concat([a]).slice(-MAXIMO));
      return 'fila';
    }

    return { adicionar, enviar, pendentes };
  }

  const api = { criar, CHAVE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else raiz.NaviFilaAvisos = api;
})(typeof window !== 'undefined' ? window : globalThis);
