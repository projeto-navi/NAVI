/* Navi — avisos de interdição, dano ou obstáculo (RN16, RN49–RN52).
   Oficiais: locais/<slug>/avisos.js (confirmados, valem para todos).
   Do aparelho: localStorage "navi-avisos" (valem só neste aparelho, na hora).
   Ids antigos (ex.: '2-22327', 'elevador-piso-1') são aceitos e viram o id do grafo 1.1.
   Interditar um lugar que faz parte de um equipamento (elevador, escada) bloqueia o equipamento
   inteiro, em todos os andares. */
(function (raiz) {
  'use strict';
  const CHAVE = 'navi-avisos';
  const TIPOS = {
    interditado: { nome: 'Interditado', desc: 'Fechado ou com a passagem bloqueada' },
    danificado: { nome: 'Danificado', desc: 'Quebrado ou com defeito, como elevador parado ou piso solto' },
    obstaculo: { nome: 'Obstáculo no caminho', desc: 'Obra, materiais, mesas ou algo atrapalhando a passagem' }
  };
  const EQUIPAMENTO = ['escada', 'escada_rolante', 'elevador', 'plataforma', 'rampa'];

  function criar({ local, G, armazenamento }) {
    const arm = armazenamento || (typeof localStorage !== 'undefined' ? localStorage : null);
    let memoria = null; // se o navegador não deixar salvar, os avisos ficam só nesta visita
    const lerDoAparelho = () => {
      if (memoria) return memoria;
      try { const v = JSON.parse((arm && arm.getItem(CHAVE)) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
    };
    const normalizar = a => {
      const l = a && local.lugar(a.lugar);
      return l && TIPOS[a.tipo] ? { ...a, lugar: l.id } : null;
    };
    let doServidor = []; // confirmados por um ADM (RN69): valem para todos
    const oficiais = () => (local.avisos || []).concat(doServidor).map(normalizar).filter(Boolean).map(a => ({ ...a, oficial: true }));
    function definirDoServidor(lista) {
      doServidor = (Array.isArray(lista) ? lista : []).map(a => ({ ...a, origem: 'servidor' }));
    }
    const meus = () => lerDoAparelho().map(normalizar).filter(Boolean);
    const todos = () => oficiais().concat(meus());
    const de = id => todos().find(a => a.lugar === id) || null;

    function bloqueados() {
      const s = new Set();
      for (const a of todos()) {
        const l = G.lugarPorId[a.lugar];
        if (!l) continue;
        const ehEquipamento = EQUIPAMENTO.includes(l.cat);
        if (a.tipo === 'interditado' || (a.tipo === 'danificado' && ehEquipamento)) {
          s.add(l.id);
          const eq = G.equipamentoDoLugar ? G.equipamentoDoLugar(l.id) : null;
          if (eq) for (const id of G.lugaresDoEquipamento(eq)) s.add(id);
        }
      }
      return s;
    }
    function salvar(lista) {
      memoria = lista;
      try { if (arm) arm.setItem(CHAVE, JSON.stringify(lista)); } catch (e) { /* fica em memória */ }
    }
    function registrar(aviso) {
      const l = local.lugar(aviso.lugar);
      if (!l || !TIPOS[aviso.tipo]) return null;
      const novo = { lugar: l.id, tipo: aviso.tipo, detalhe: String(aviso.detalhe || '').trim().slice(0, 300), criado: aviso.criado || new Date().toISOString() };
      const lista = meus().filter(x => x.lugar !== novo.lugar);
      lista.push(novo);
      salvar(lista);
      return novo;
    }
    function remover(indice) {
      const lista = meus();
      const [rem] = lista.splice(indice, 1);
      salvar(lista);
      return rem || null;
    }
    return { todos, de, bloqueados, oficiais, meus, registrar, remover, definirDoServidor };
  }

  const api = { criar, TIPOS, CHAVE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else raiz.NaviInterdicoes = api;
})(typeof window !== 'undefined' ? window : globalThis);
