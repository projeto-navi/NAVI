// Validação do grafo de rotas (esquema 1.1) de um local, com relatório.
// Uso: node ferramentas/dados/validar-grafo.js <slug>
//   escreve ferramentas/dados/relatorios/<slug>.md e sai com código 1 se houver erro.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const INCLINACAO_MAX = 8.33; // % — ABNT NBR 9050
const REF_MODELO = /^[A-Z]{2,6}P\d{2}[A-Z]{2,12}_[A-Z0-9]{1,12}$/;
const SEM_ESCADA = new Set(['escada', 'escada_rolante']);

/**
 * @param {object} grafo grafo 1.1
 * @param {{dados?: object, inclinacaoMaxPct?: number}} [opcoes]
 * @returns {{erros: string[], avisos: string[], semRotaSemEscada: {entrada: string, destino: string}[], semPorta: string[]}}
 */
function validarGrafo(grafo, opcoes = {}) {
  const limite = opcoes.inclinacaoMaxPct != null ? opcoes.inclinacaoMaxPct : INCLINACAO_MAX;
  const erros = [], avisos = [];
  const nome = l => `${l.id} (${l.nome})`;
  if (grafo.versao !== '1.1') erros.push(`Versão do esquema: esperado "1.1", veio "${grafo.versao}".`);

  // 1. ids únicos (nós, lugares, equipamentos) e aliases sem conflito
  const vistos = new Map();
  const marcar = (id, o) => { if (vistos.has(id)) erros.push(`Id repetido: ${id} (${vistos.get(id)} e ${o}).`); else vistos.set(id, o); };
  for (const n of grafo.nos) marcar(n.id, 'nó');
  for (const l of grafo.lugares) marcar(l.id, 'lugar');
  for (const e of grafo.equipamentos) marcar(e.id, 'equipamento');
  for (const l of grafo.lugares) for (const a of l.aliases || []) marcar(a, 'alias de ' + l.id);

  const no = Object.fromEntries(grafo.nos.map(n => [n.id, n]));
  const equip = Object.fromEntries(grafo.equipamentos.map(e => [e.id, e]));
  const andares = new Set(grafo.andares.map(a => a.id));

  // 2. arestas apontam para nós e equipamentos existentes; 6. escada rolante só de ida; 7. rampas
  const grau = {};
  const rampasExcluidas = [];
  for (const a of grafo.arestas) {
    const txt = `${a.de} → ${a.para}`;
    if (!no[a.de]) erros.push(`Aresta ${txt}: nó de origem inexistente.`);
    if (!no[a.para]) erros.push(`Aresta ${txt}: nó de destino inexistente.`);
    if (a.equipamento && !equip[a.equipamento]) erros.push(`Aresta ${txt}: equipamento ${a.equipamento} inexistente.`);
    if (a.tipo === 'escada_rolante' && a.sentido !== 'ida') erros.push(`Aresta ${txt}: escada rolante precisa de sentido "ida".`);
    if (typeof a.comprimento_unid !== 'number' || typeof a.custo !== 'number') erros.push(`Aresta ${txt}: comprimento_unid e custo são obrigatórios.`);
    if (a.tipo === 'rampa' && a.inclinacao_pct != null && a.inclinacao_pct > limite) {
      avisos.push(`Rampa ${txt} com ${a.inclinacao_pct}% (acima de ${limite}% da NBR 9050): excluída das rotas sem escada.`);
      rampasExcluidas.push(a);
    }
    grau[a.de] = (grau[a.de] || 0) + 1; grau[a.para] = (grau[a.para] || 0) + 1;
  }
  // 3. nenhum nó órfão
  for (const n of grafo.nos) {
    if (!grau[n.id]) erros.push(`Nó órfão: ${n.id}.`);
    if (!andares.has(n.andar)) erros.push(`Nó ${n.id}: andar ${n.andar} inexistente.`);
    // 5. ref_modelo
    if (n.ref_modelo != null && !REF_MODELO.test(n.ref_modelo)) erros.push(`Nó ${n.id}: ref_modelo "${n.ref_modelo}" fora do padrão {PREDIO}{ANDAR}{CATEGORIA}_{ID}.`);
  }
  // 4. lugares: porta existente, no mesmo andar, dentro dos limites do andar
  const semPorta = [];
  const limites = opcoes.dados && opcoes.dados.pisos;
  for (const l of grafo.lugares) {
    const p = no[l.no_porta];
    if (!l.no_porta || !p) { erros.push(`Lugar ${nome(l)}: sem no_porta válido.`); continue; }
    if (p.andar !== l.andar) erros.push(`Lugar ${nome(l)}: no_porta em outro andar (${p.andar}).`);
    if (p.tipo === 'corredor' && !['escada_rolante', 'escada', 'elevador', 'plataforma'].includes(l.categoria)) semPorta.push(nome(l));
    const b = limites && limites[l.andar];
    const f = opcoes.dados && opcoes.dados.formas && opcoes.dados.formas[l.id];
    if (b && f && (f.x < b.minX || f.x > b.maxX || f.y < b.minY || f.y > b.maxY)) {
      erros.push(`Lugar ${nome(l)}: centro (${f.x}, ${f.y}) fora dos limites do andar ${l.andar}.`);
    }
  }
  if (semPorta.length) avisos.push(`Sem caminho até a porta (a rota termina no centro): ${semPorta.join('; ')}.`);

  // 8. destinos sem rota sem escada, a partir de cada entrada (busca em largura, respeitando o sentido)
  const viz = {};
  for (const a of grafo.arestas) {
    if (SEM_ESCADA.has(a.tipo) || rampasExcluidas.includes(a)) continue;
    (viz[a.de] = viz[a.de] || []).push(a.para);
    if (a.sentido !== 'ida') (viz[a.para] = viz[a.para] || []).push(a.de);
  }
  const semRotaSemEscada = [];
  for (const ent of grafo.lugares.filter(l => l.categoria === 'entrada')) {
    const alcance = new Set([ent.no_porta]), fila = [ent.no_porta];
    while (fila.length) for (const v of viz[fila.shift()] || []) if (!alcance.has(v)) { alcance.add(v); fila.push(v); }
    for (const l of grafo.lugares) if (l !== ent && !alcance.has(l.no_porta)) semRotaSemEscada.push({ entrada: ent.nome, destino: l.nome });
  }
  return { erros, avisos, semRotaSemEscada, semPorta };
}

function carregarLocal(slug, pasta) {
  const base = pasta || path.resolve(__dirname, '../../site-acessivel/locais', slug);
  const grafo = JSON.parse(fs.readFileSync(path.join(base, 'grafo.json'), 'utf8'));
  let dados = null;
  if (fs.existsSync(path.join(base, 'dados.js'))) {
    const ctx = {}; ctx.window = ctx; ctx.globalThis = ctx;
    ctx.naviLocal = s => (ctx[s] = ctx[s] || {});
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(base, 'dados.js'), 'utf8'), ctx);
    dados = ctx[slug].dados;
  }
  return { grafo, dados };
}

function relatorio(slug, r) {
  const lista = (titulo, itens, vazio = 'nenhum') => `## ${titulo}\n\n${itens.length ? itens.map(i => `- ${i}`).join('\n') : vazio}\n`;
  const porEntrada = {};
  for (const s of r.semRotaSemEscada) (porEntrada[s.entrada] = porEntrada[s.entrada] || []).push(s.destino);
  const destinos = Object.entries(porEntrada).map(([e, ds]) => `${e}: ${ds.join(', ')}`);
  return `# Validação do grafo — ${slug}\n\n${new Date().toISOString().slice(0, 10)} · ${r.erros.length} erros, ${r.avisos.length} avisos.\n\n` +
    lista('Erros', r.erros) + '\n' + lista('Avisos', r.avisos) + '\n' +
    lista('Destinos sem rota sem escada, por entrada', destinos);
}

module.exports = { validarGrafo, carregarLocal, relatorio, INCLINACAO_MAX };

if (require.main === module) {
  const slug = process.argv[2];
  if (!slug) { console.error('Uso: node ferramentas/dados/validar-grafo.js <slug>'); process.exit(2); }
  const { grafo, dados } = carregarLocal(slug);
  const r = validarGrafo(grafo, { dados });
  const dir = path.resolve(__dirname, 'relatorios');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, slug + '.md'), relatorio(slug, r));
  console.log(`${slug}: ${r.erros.length} erros, ${r.avisos.length} avisos, ${r.semRotaSemEscada.length} destinos sem rota sem escada. Relatório em ferramentas/dados/relatorios/${slug}.md`);
  for (const e of r.erros) console.log('  erro: ' + e);
  process.exit(r.erros.length ? 1 : 0);
}
