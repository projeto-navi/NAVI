// Gera js/dados.js a partir do projeto Navi existente (data.js + footprints.json)
const fs = require('fs');
const SRC = process.argv[2], OUT = process.argv[3];
const ctx = {};
new Function('ctx', fs.readFileSync(SRC + '/data.js', 'utf8').replace(/const (\w+)=/g, 'ctx.$1=') )(ctx);
const footprints = JSON.parse(fs.readFileSync(SRC + '/assets/footprints.json', 'utf8'));

const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const KEEP_UP = new Set(['sac','adm','c&a','bk','mmartan','ri','zap','c','e','mc']);
const small = new Set(['de','da','do','das','dos','e','a','o','em','na','no','com','para']);
function titleCase(name) {
  return name.toLowerCase().split(/(\s+|\/|-)/).map((w, i) => {
    if (!w.trim() || /^[\/-]$/.test(w)) return w;
    if (w === 'sac' || w === 'adm') return w.toUpperCase();
    if (i > 0 && small.has(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join('');
}
function category(l) {
  const n = norm(l.name);
  if (/^acesso/.test(n)) return 'entrada';
  if (/sanitario/.test(n)) return 'sanitario';
  if (/elevador/.test(n)) return 'elevador';
  if (/escada/.test(n)) return 'escada';
  if (/sac|recepc/.test(n)) return 'informacao';
  if (/pagamento do estacionamento/.test(n)) return 'estacionamento';
  if (/caixas eletronicos/.test(n)) return 'caixa';
  if (/saida de emergencia/.test(n)) return 'emergencia';
  if (/^saida$/.test(n)) return 'saida';
  if (/familia/.test(n)) return 'familia';
  if (/museu/.test(n)) return 'museu';
  if (/torre da adm/.test(n)) return 'administracao';
  if (l.type === 'quiosque') return 'quiosque';
  return 'loja';
}
function inPoly(x, y, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const places = ctx.locations
  .filter(l => l.x >= 0 && l.y >= 0 && l.x <= 1920 && l.y <= 1080)
  .map(l => {
    const cat = category(l);
    const polys = footprints[l.floor] || [];
    let poly = -1;
    if (cat === 'loja') poly = polys.findIndex(p => inPoly(l.x, l.y, p));
    return { id: l.id, nome: titleCase(l.name).replace(/^Sac/, 'SAC'), cat, piso: l.floor,
      x: l.x, y: l.y, w: l.w, h: l.h, r: l.rotate, poly };
  });

const grafo = {};
for (const f of ['1', '2']) grafo[f] = ctx.floorPaths[f].filter(p => p.i || p.j).map(p => [p.i, p.j]);

const pisos = {};
for (const f of ['1', '2']) {
  const pts = footprints[f].flat();
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  pisos[f] = { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}
const out = { gerado: new Date().toISOString().slice(0, 10), fonte: 'Mapa Mall / shoppingestacao.com.br (via projeto Navi)', places, plantas: footprints, grafo, pisos };
fs.writeFileSync(OUT, '/* Dados do Shopping Estação — gerado a partir do projeto Navi. */\nwindow.NAVI_DADOS=' + JSON.stringify(out) + ';\n');
const cats = {}; places.forEach(p => cats[p.cat] = (cats[p.cat] || 0) + 1);
console.log(places.length, cats, 'lojas sem polígono:', places.filter(p => p.cat === 'loja' && p.poly < 0).map(p => p.piso + ' ' + p.nome).join(', '));
