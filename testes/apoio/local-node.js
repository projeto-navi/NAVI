// Carrega um local do Navi no Node, num contexto isolado (vm), com os mesmos arquivos que o site publica.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SITE = path.resolve(__dirname, '../../site-acessivel');
const ENTRADA = path.resolve(__dirname, '../../ferramentas/dados/entrada');
// locais que saíram do site (o Shopping Estação) continuam como referência dos testes do motor
const FORA_DO_SITE = path.resolve(__dirname, '../../ferramentas/dados/locais-fora-do-site');
const pastaDoLocal = slug => (fs.existsSync(path.join(SITE, 'locais', slug)) ? path.join(SITE, 'locais', slug) : path.join(FORA_DO_SITE, slug));

function contexto() {
  const ctx = { console, Buffer, URLSearchParams, atob: s => Buffer.from(s, 'base64').toString('binary') };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  return ctx;
}
const rodar = (ctx, arquivo) => vm.runInContext(fs.readFileSync(arquivo, 'utf8'), ctx, { filename: arquivo });

/** Local montado (NaviLocal.montar) + motor, interdições e o próprio contexto. */
function carregarLocalNode(slug, { malha = false, pasta } = {}) {
  const ctx = contexto();
  for (const f of ['js/local.js', 'js/rotas.js', 'js/interdicoes.js', 'locais/indice.js']) rodar(ctx, path.join(SITE, f));
  const base = pasta || pastaDoLocal(slug);
  for (const f of ['config.js', 'avisos.js', 'dados.js', 'grafo.js', 'beacons.js'].concat(malha ? ['malha.js'] : [])) {
    const p = path.join(base, f);
    if (fs.existsSync(p)) rodar(ctx, p);
  }
  const local = ctx.NaviLocal.montar(slug, ctx.NAVI_LOCAIS[slug]);
  ctx.NaviRotas.usarMalha(malha ? local.malha : null);
  return { local, beacons: ctx.NAVI_LOCAIS[slug].beacons || null, R: ctx.NaviRotas, NaviLocal: ctx.NaviLocal, NaviInterdicoes: ctx.NaviInterdicoes, ctx };
}

/** Grafo do local no motor, com as referências do config (como o site faz). */
function grafoDoLocal(c) {
  return c.R.criarGrafo11(c.local.grafo, c.local.lugares, { referencias: c.local.config.referencias });
}

/** Dados legados do Shopping (entrada do gerador) e o motor, para comparar com o grafo 1.1. */
function carregarLegado({ malha = false } = {}) {
  const ctx = contexto();
  const pasta = path.join(ENTRADA, 'shopping-estacao');
  rodar(ctx, path.join(pasta, 'dados-legado.js'));
  if (malha) rodar(ctx, path.join(pasta, 'malha-legado.js'));
  rodar(ctx, path.join(SITE, 'js/rotas.js'));
  ctx.NaviRotas.usarMalha(malha ? ctx.NAVI_MALHA : null);
  return { D: ctx.NAVI_DADOS, R: ctx.NaviRotas };
}

/** Armazenamento falso (mesma interface do localStorage). */
function armazenamentoFalso(inicial = {}) {
  const m = new Map(Object.entries(inicial));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), dados: m };
}

module.exports = { carregarLocalNode, grafoDoLocal, carregarLegado, armazenamentoFalso, pastaDoLocal, SITE, ENTRADA, FORA_DO_SITE };
