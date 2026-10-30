// Gera a pasta de um local (site-acessivel/locais/<slug>/) a partir dos dados de entrada.
// Uso: node ferramentas/dados/gerar-local.mjs <slug> [--data=AAAA-MM-DD] [--saida=<pasta>] [--sem-portas]
//
// Entrada (ferramentas/dados/entrada/<slug>/):
//   local.json        prefixo dos ids, andares, escala, origem, data da planta
//   correcoes.json    { "<id antigo>": { x?, y?, w?, h?, r? } | { "remover": true } }
//   dados-legado.js   lugares, plantas e células de corredor (window.NAVI_DADOS)
//   malha-legado.js   distância de cada ponto à parede (window.NAVI_MALHA)
//   dados3d-legado.js lajes do 3D (window.NAVI_3D)
// Saída: dados.js, grafo.json, grafo.js, malha.js, dados3d.js — nunca edite à mão.
//
// Regras do grafo 1.1 (ver docs/superpowers/specs/2026-10-27-marco-1-especificacao.md):
// ids estáveis entre versões (reaproveita o grafo.json existente), ids antigos em "aliases",
// escada rolante como duas arestas de sentido "ida" (o sentido real ainda não foi registrado),
// e uma porta por lugar, ligada ao corredor (correção F2).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const R = require(path.join(RAIZ, 'site-acessivel/js/rotas.js'));

const CATEGORIA = { escada: 'escada_rolante' }; // nome da categoria legada → categoria no grafo 1.1
const EQUIPAMENTOS = ['escada', 'elevador'];     // categorias legadas que são ponta de equipamento (sem porta própria)
const PORTA = { candidatos: 24, amostra: 3, ignorarPerto: 18, folgaMin: 1, distMax: 60 };

export function carregarJs(arquivo) {
  const ctx = { console };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(arquivo, 'utf8'), ctx, { filename: arquivo });
  return ctx;
}

const pad = (n, w = 4) => String(n).padStart(w, '0');

function contorno(D, p) {
  if (p.poly >= 0) return D.plantas[p.piso][p.poly].map(([x, y]) => ({ x, y }));
  const a = (p.r || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), hw = p.w / 2, hh = p.h / 2;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([u, v]) => ({ x: p.x + u * c - v * s, y: p.y + u * s + v * c }));
}
function pontoMaisPerto(pts, q) {
  let melhor = null, d = Infinity;
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k], b = pts[(k + 1) % pts.length], vx = b.x - a.x, vy = b.y - a.y, L = vx * vx + vy * vy;
    const u = L ? Math.max(0, Math.min(1, ((q.x - a.x) * vx + (q.y - a.y) * vy) / L)) : 0;
    const x = a.x + vx * u, y = a.y + vy * u, dd = Math.hypot(q.x - x, q.y - y);
    if (dd < d) { d = dd; melhor = { x, y }; }
  }
  return { ponto: melhor, d };
}
function criarFolga(M) {
  const F = {};
  for (const k of Object.keys(M.folga)) F[k] = new Uint8Array(Buffer.from(M.folga[k], 'base64'));
  return (piso, x, y) => {
    const i = Math.round(x / M.passo), j = Math.round(y / M.passo);
    if (i < 0 || j < 0 || i >= M.larg || j >= M.alt) return 0;
    return F[piso][j * M.larg + i];
  };
}
/** Porta de um lugar: ponto do contorno mais perto de um nó de corredor, com passagem livre até ele. */
export function acharPorta(D, G, folga, p) {
  const pts = contorno(D, p);
  const cands = G.porPiso[p.piso].map(id => G.nos[id]).map(n => ({ n, ...pontoMaisPerto(pts, n) }))
    .sort((a, b) => a.d - b.d).slice(0, PORTA.candidatos);
  for (const c of cands) {
    if (c.d > PORTA.distMax) break;
    const passos = Math.max(1, Math.ceil(c.d / PORTA.amostra));
    let livre = true;
    for (let k = 0; k <= passos && livre; k++) {
      const t = k / passos, x = c.n.x + (c.ponto.x - c.n.x) * t, y = c.n.y + (c.ponto.y - c.n.y) * t;
      if (Math.hypot(x - c.ponto.x, y - c.ponto.y) <= PORTA.ignorarPerto) continue;
      if (folga(p.piso, x, y) < PORTA.folgaMin) livre = false;
    }
    if (livre) return { no: c.n.id, ponto: { x: Math.round(c.ponto.x * 10) / 10, y: Math.round(c.ponto.y * 10) / 10 }, d: c.d };
  }
  return null;
}

export function gerar(slug, opcoes = {}) {
  const ENTRADA = path.join(RAIZ, 'ferramentas/dados/entrada', slug);
  const noSite = path.join(RAIZ, 'site-acessivel/locais', slug), foraDoSite = path.join(RAIZ, 'ferramentas/dados/locais-fora-do-site', slug);
  const SAIDA = opcoes.saida || (!fs.existsSync(noSite) && fs.existsSync(foraDoSite) ? foraDoSite : noSite);
  const cfg = JSON.parse(fs.readFileSync(path.join(ENTRADA, 'local.json'), 'utf8'));
  const correcoes = fs.existsSync(path.join(ENTRADA, 'correcoes.json')) ? JSON.parse(fs.readFileSync(path.join(ENTRADA, 'correcoes.json'), 'utf8')) : {};
  const D0 = carregarJs(path.join(ENTRADA, 'dados-legado.js')).NAVI_DADOS;
  const M = carregarJs(path.join(ENTRADA, 'malha-legado.js')).NAVI_MALHA;
  const lajes = carregarJs(path.join(ENTRADA, 'dados3d-legado.js')).NAVI_3D.lajes;

  // correções da equipe sobre os dados legados
  const places = [];
  for (const p of D0.places) {
    const c = correcoes[p.id];
    if (c && c.remover) continue;
    places.push(c ? { ...p, ...c } : p);
  }
  const D = { ...D0, places };
  const G = R.criarGrafo(D);
  const folga = criarFolga(M);

  const andarDaOrdem = {};
  for (const a of cfg.andares) andarDaOrdem[a.ordem] = a;
  const e = cfg.escala_m_por_unidade || 1;
  const pos = (piso, x, y) => [round(x * e), andarDaOrdem[piso].altura_m != null ? andarDaOrdem[piso].altura_m : 0, round(y * e)];

  // ids estáveis: reaproveita o grafo existente (lugar pelo alias; nó pela posição)
  const anterior = fs.existsSync(path.join(SAIDA, 'grafo.json')) ? JSON.parse(fs.readFileSync(path.join(SAIDA, 'grafo.json'), 'utf8')) : null;
  const idAntigoDoLugar = {}, idAntigoDoNo = {}, portaAntigaDoLugar = {}, usados = new Set();
  if (anterior) {
    const tipoDoNo = Object.fromEntries(anterior.nos.map(n => [n.id, n.tipo]));
    for (const l of anterior.lugares) for (const a of l.aliases || []) {
      idAntigoDoLugar[a] = l.id;
      // a porta é do lugar: dois lugares no mesmo contorno podem ter portas no mesmo ponto
      if (['porta', 'acesso'].includes(tipoDoNo[l.no_porta])) portaAntigaDoLugar[a] = l.no_porta;
    }
    for (const n of anterior.nos) if (n.tipo === 'corredor') idAntigoDoNo[n.andar + ':' + Math.round(n.pos[0]) + ':' + Math.round(n.pos[2])] = n.id;
    for (const l of anterior.lugares) usados.add(l.id);
    for (const n of anterior.nos) usados.add(n.id);
  }
  const contadores = {};
  const novoId = (andar, letra) => {
    const k = andar + letra;
    for (;;) {
      contadores[k] = (contadores[k] || 0) + 1;
      const id = `${cfg.prefixo}_${andar}_${letra}${pad(contadores[k])}`;
      if (!usados.has(id)) { usados.add(id); return id; }
    }
  };
  const idDoCorredor = (andar, x, y) => idAntigoDoNo[andar + ':' + Math.round(x) + ':' + Math.round(y)] || novoId(andar, 'N');

  // nós de corredor
  const nos = G.nos.map(n => {
    const andar = andarDaOrdem[n.piso].id;
    const id = idDoCorredor(andar, n.x, n.y);
    return { id, andar, pos: pos(n.piso, n.x, n.y), tipo: 'corredor', ref_modelo: null };
  });
  const arestas = [];
  const base = { piso_tatil: 'nenhum', inclinacao_pct: null, largura_min_m: null };
  G.viz.forEach((lista, a) => lista.forEach(v => {
    if (v.tipo === 'corredor' && a < v.para) arestas.push({ de: nos[a].id, para: nos[v.para].id, tipo: 'caminhada', comprimento_unid: v.custo, custo: v.custo, sentido: 'ambos', ...base, equipamento: null });
  }));

  // equipamentos (escadas rolantes na ordem do Piso 1; depois o elevador)
  const equipamentos = [];
  let nEsc = 0;
  for (const c of G.conexoes) {
    const na = G.nos[c.a], nb = G.nos[c.b], horiz = round(Math.hypot(na.x - nb.x, na.y - nb.y));
    const andares = [andarDaOrdem[na.piso].id, andarDaOrdem[nb.piso].id];
    if (c.tipo === 'escada') {
      const id = 'ESC_' + pad(++nEsc, 2);
      equipamentos.push({ id, tipo: 'escada_rolante', andares, posicao_estimada: false });
      // sentido real não registrado: uma aresta "ida" em cada sentido (ver F3)
      arestas.push({ de: nos[c.a].id, para: nos[c.b].id, tipo: 'escada_rolante', comprimento_unid: horiz, custo: c.custo, sentido: 'ida', ...base, equipamento: id });
      arestas.push({ de: nos[c.b].id, para: nos[c.a].id, tipo: 'escada_rolante', comprimento_unid: horiz, custo: c.custo, sentido: 'ida', ...base, equipamento: id });
    } else {
      const id = 'ELEV_01';
      equipamentos.push({ id, tipo: 'elevador', andares, posicao_estimada: true });
      arestas.push({ de: nos[c.a].id, para: nos[c.b].id, tipo: 'elevador', comprimento_unid: horiz, custo: c.custo, sentido: 'ambos', ...base, equipamento: id });
    }
  }

  // lugares, formas e portas
  const lugares = [], formas = {}, semPorta = [];
  for (const p of G.places) {
    const andar = andarDaOrdem[p.piso].id;
    const id = idAntigoDoLugar[p.id] || novoId(andar, 'L');
    let noPorta = nos[G.noDoLugar(p)].id;
    if (!opcoes.semPortas && !EQUIPAMENTOS.includes(p.cat)) {
      const porta = acharPorta(D, G, folga, p);
      if (porta) {
        const tipo = p.cat === 'entrada' ? 'acesso' : 'porta';
        const idPorta = portaAntigaDoLugar[p.id] || novoId(andar, 'N');
        nos.push({ id: idPorta, andar, pos: pos(p.piso, porta.ponto.x, porta.ponto.y), tipo, ref_modelo: null });
        const L = round(porta.d);
        arestas.push({ de: nos[porta.no].id, para: idPorta, tipo: 'caminhada', comprimento_unid: L, custo: L, sentido: 'ambos', ...base, equipamento: null });
        noPorta = idPorta;
      } else semPorta.push(p);
    }
    lugares.push({ id, nome: p.nome, codigo: null, categoria: CATEGORIA[p.cat] || p.cat, andar, no_porta: noPorta, aliases: [p.id], acessivel: null });
    formas[id] = { x: p.x, y: p.y, w: p.w, h: p.h, r: p.r || 0, poly: p.poly, ...(p.estimado ? { estimado: true } : {}) };
  }

  const gerado = opcoes.data || new Date().toISOString().slice(0, 10);
  const grafo = {
    versao: '1.1', local: slug, gerado,
    fonte: `${D0.fonte} — planta de ${cfg.data_planta}. Sentido das escadas rolantes não confirmado: cada uma aparece nos dois sentidos (F3).`,
    escala_m_por_unidade: cfg.escala_m_por_unidade, escala_medida_em: cfg.escala_medida_em, origem: cfg.origem,
    andares: cfg.andares, lugares, nos, arestas, equipamentos
  };
  const porId = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [andarDaOrdem[k].id, v]));
  const dados = { gerado, data_planta: cfg.data_planta, fonte: D0.fonte, pisos: porId(D0.pisos), plantas: porId(D0.plantas), formas };

  fs.mkdirSync(SAIDA, { recursive: true });
  const cab = (o) => `/* Navi — ${o} do local ${slug}. Gerado por ferramentas/dados/gerar-local.mjs em ${gerado}. Não edite à mão. */\n`;
  const json = JSON.stringify(grafo);
  fs.writeFileSync(path.join(SAIDA, 'grafo.json'), JSON.stringify(grafo, null, 1) + '\n');
  fs.writeFileSync(path.join(SAIDA, 'grafo.js'), cab('grafo de rotas (esquema 1.1)') + `naviLocal(${JSON.stringify(slug)}).grafo=${json};\n`);
  fs.writeFileSync(path.join(SAIDA, 'dados.js'), cab('geometria (plantas e formas dos lugares)') + `naviLocal(${JSON.stringify(slug)}).dados=${JSON.stringify(dados)};\n`);
  fs.writeFileSync(path.join(SAIDA, 'malha.js'), cab('malha fina dos corredores') + `naviLocal(${JSON.stringify(slug)}).malha=${JSON.stringify(M)};\n`);
  fs.writeFileSync(path.join(SAIDA, 'dados3d.js'), cab('lajes do 3D') + `naviLocal(${JSON.stringify(slug)}).lajes=${JSON.stringify(lajes)};\n`);
  return { grafo, dados, semPorta: semPorta.map(p => `${p.id} ${p.nome}`) };
}

function round(v) { return Math.round(v * 1000) / 1000; }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const slug = args.find(a => !a.startsWith('--'));
  if (!slug) { console.error('Uso: node ferramentas/dados/gerar-local.mjs <slug> [--data=AAAA-MM-DD] [--saida=<pasta>] [--sem-portas]'); process.exit(2); }
  const opt = k => (args.find(a => a.startsWith('--' + k + '=')) || '').split('=')[1];
  const r = gerar(slug, { data: opt('data'), saida: opt('saida') && path.resolve(opt('saida')), semPortas: args.includes('--sem-portas') });
  console.log(`${slug}: ${r.grafo.lugares.length} lugares, ${r.grafo.nos.length} nós, ${r.grafo.arestas.length} arestas, ${r.grafo.equipamentos.length} equipamentos.`);
  if (r.semPorta.length) console.log('Sem caminho até a porta (centro mantido): ' + r.semPorta.join('; '));
}
