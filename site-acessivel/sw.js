/* Navi — service worker escrito à mão (sem Workbox: o site não tem build).
   Estratégias (spec do Marco 1, RN62):
   - as duas páginas, CSS, JS, fontes e ícones: guardados na instalação (precache), servidos do cache;
   - dados e grafo de cada local: do cache na hora e atualizados por trás (stale-while-revalidate);
   - avisos.js: rede primeiro, cache como reserva (cada aviso mostra a própria data, RN52);
   - Three.js e 3D (com o modelo .glb do local, quando há): guardados depois do primeiro uso;
   - VLibras e "Buscar falando" são de fora: só funcionam com internet (o site avisa por texto).
   Versão nova: troque VERSAO. A Página de Rota oferece "Atualizar agora"; a Página do Mapa nunca
   recarrega no meio de uma rota (a versão nova entra no próximo carregamento). */
'use strict';
const VERSAO = '2026-11-04-adm';
const APP = 'navi-app-' + VERSAO;
const DADOS = 'navi-dados-' + VERSAO;
const TRES_D = 'navi-3d-' + VERSAO;
const AVISOS = 'navi-avisos-' + VERSAO;
const CACHES_ATUAIS = [APP, DADOS, TRES_D, AVISOS];

const PRECACHE = [
  './', 'index.html', 'mapa.html', 'manifest.webmanifest',
  'css/tokens.css', 'css/base.css', 'css/rota.css', 'css/mapa.css',
  'fontes/atkinson-hyperlegible-next.woff2',
  'img/icone-navi.svg', 'img/icone-192.png', 'img/icone-512.png', 'img/icone-180.png',
  'js/icones.js', 'js/estado.js', 'js/categorias.js', 'js/voz.js', 'js/libras.js', 'js/ui.js',
  'js/local.js', 'js/rotas.js', 'js/preferencias-rota.js', 'js/interdicoes.js', 'js/avisos-ui.js', 'js/pwa.js',
  'js/servidor-config.js', 'js/servidor.js', 'js/fila-avisos.js',
  'js/pagina-rota.js', 'js/folha.js', 'js/mapa-renderer.js', 'js/mapa2d.js', 'js/pagina-mapa.js',
  'locais/indice.js'
];
// a malha entra também: sem ela o traçado muda e o texto dos passos ficaria diferente sem internet
const ARQUIVOS_DO_LOCAL = ['config.js', 'avisos.js', 'dados.js', 'grafo.js', 'malha.js', 'dados3d.js'];
const SO_DEPOIS_DO_USO = /\/(js\/three-navi\.min\.js|js\/mapa3d\.js|js\/mapa3d-renderer\.js|js\/glb-leitor\.js|css\/mapa3d\.css|locais\/[^/]+\/[^/]+\.glb)$/;

/** Arquivos de cada local do índice (o que não existir, como os dados de um local em preparação, fica de fora). */
function arquivosDosLocais() {
  try { importScripts('locais/indice.js'); } catch (e) { return []; }
  const lista = [];
  for (const l of self.NAVI_LOCAIS_INDICE || []) for (const f of ARQUIVOS_DO_LOCAL) lista.push(`locais/${l.slug}/${f}`);
  return lista;
}

self.addEventListener('install', ev => {
  ev.waitUntil((async () => {
    const app = await caches.open(APP);
    await app.addAll(PRECACHE);
    const dados = await caches.open(DADOS);
    await Promise.all(arquivosDosLocais().map(u => dados.add(u).catch(() => null)));
  })());
});

self.addEventListener('activate', ev => {
  ev.waitUntil((async () => {
    for (const nome of await caches.keys()) if (nome.startsWith('navi-') && !CACHES_ATUAIS.includes(nome)) await caches.delete(nome);
    await self.clients.claim();
  })());
});

self.addEventListener('message', ev => {
  if (ev.data && ev.data.tipo === 'ativar-agora') self.skipWaiting();
});

async function doCacheOuRede(req, nomeCache) {
  const achado = await caches.match(req, { ignoreSearch: true });
  if (achado) return achado;
  const resp = await fetch(req);
  if (resp && resp.ok && nomeCache) (await caches.open(nomeCache)).put(req, resp.clone());
  return resp;
}
async function cacheEAtualiza(req, ev) {
  const cache = await caches.open(DADOS);
  const achado = await cache.match(req, { ignoreSearch: true });
  const daRede = fetch(req).then(resp => { if (resp && resp.ok) cache.put(req, resp.clone()); return resp; }).catch(() => null);
  if (achado) { ev.waitUntil(daRede); return achado; }
  const resp = await daRede;
  return resp || new Response('', { status: 504, statusText: 'Sem internet' });
}
async function redePrimeiro(req, nomeCache) {
  const cache = await caches.open(nomeCache);
  try {
    const resp = await fetch(req);
    if (resp && resp.ok) cache.put(req, resp.clone());
    return resp;
  } catch (e) {
    const achado = await cache.match(req, { ignoreSearch: true }) || await caches.match(req, { ignoreSearch: true });
    return achado || new Response('', { status: 504, statusText: 'Sem internet' });
  }
}

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // VLibras e outros serviços de fora: sempre pela rede
  const caminho = url.pathname;

  // páginas: do cache (a URL com ?origem=… usa a mesma página guardada); sem cache, pela rede
  if (req.mode === 'navigate') {
    ev.respondWith((async () => {
      const pagina = /mapa\.html$/.test(caminho) ? 'mapa.html' : /(\/|index\.html)$/.test(caminho) ? 'index.html' : null;
      const achado = pagina && await caches.match(pagina);
      if (achado) return achado;
      try { return await fetch(req); } catch (e) { return (await caches.match('index.html')) || Response.error(); }
    })());
    return;
  }
  if (/\/locais\/[^/]+\/avisos\.js$/.test(caminho)) { ev.respondWith(redePrimeiro(req, AVISOS)); return; }
  if (/\/locais\/[^/]+\/[^/]+\.js$/.test(caminho)) { ev.respondWith(cacheEAtualiza(req, ev)); return; }
  if (SO_DEPOIS_DO_USO.test(caminho)) { ev.respondWith(doCacheOuRede(req, TRES_D)); return; }
  ev.respondWith(doCacheOuRede(req, APP));
});
