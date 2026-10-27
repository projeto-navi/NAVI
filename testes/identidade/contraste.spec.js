// Contraste de cada par de tokens usado pelos componentes e pelo mapa, nos três temas.
// Texto ≥ 4,5:1 (≥ 7:1 no alto contraste); ícones, bordas, foco e limites de controles ≥ 3:1;
// rota ≥ 3:1 contra piso e corredor (WCAG 1.4.3, 1.4.6, 1.4.11; RN39).
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const CSS = fs.readFileSync(path.resolve(__dirname, '../../site-acessivel/css/tokens.css'), 'utf8');

function blocos(seletor) {
  const re = new RegExp(seletor.replace(/[.]/g, '\\.') + '\\s*\\{([^}]*)\\}', 'g');
  const out = {};
  for (const m of CSS.matchAll(re)) for (const d of m[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[d[1]] = d[2].trim();
  return out;
}
const BASE = blocos(':root');
const TEMAS = { claro: BASE, contraste: { ...BASE, ...blocos('html.contraste') }, daltonismo: { ...BASE, ...blocos('html.daltonismo') } };

function cor(tema, nome) {
  let v = TEMAS[tema]['--' + nome];
  for (let i = 0; v && v.startsWith('var(') && i < 5; i++) v = TEMAS[tema][v.slice(4, -1).trim()];
  if (!/^#[0-9a-f]{6}$/i.test(v || '')) throw new Error(`token --${nome} no tema ${tema} não é uma cor #RRGGBB: ${v}`);
  return v;
}
function luminancia(hex) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(x => x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const razao = (a, b) => { const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// [frente, fundo, tipo]  — tipo 'texto' usa 4,5 (7 no alto contraste); 'grafico' usa 3.
const PARES = [
  ['cor-texto', 'cor-fundo', 'texto'], ['cor-texto', 'cor-superficie', 'texto'], ['cor-texto', 'cor-superficie-2', 'texto'],
  ['cor-texto', 'cor-acao-suave', 'texto'], ['cor-texto-2', 'cor-fundo', 'texto'], ['cor-texto-2', 'cor-superficie', 'texto'],
  ['cor-texto-2', 'cor-superficie-2', 'texto'], ['cor-acao-texto', 'cor-acao', 'texto'], ['cor-acao-texto', 'cor-acao-pressionada', 'texto'],
  ['cor-acao', 'cor-superficie', 'texto'], ['cor-acao', 'cor-fundo', 'texto'], ['cor-destaque-texto', 'cor-destaque', 'texto'],
  ['cor-sucesso', 'cor-sucesso-fundo', 'texto'], ['cor-sucesso', 'cor-superficie', 'texto'],
  ['cor-alerta', 'cor-alerta-fundo', 'texto'], ['cor-alerta', 'cor-superficie', 'texto'],
  ['cor-erro', 'cor-erro-fundo', 'texto'], ['cor-erro', 'cor-superficie', 'texto'],
  ['mapa-rotulo', 'mapa-rotulo-halo', 'texto'],
  ['cor-borda', 'cor-fundo', 'grafico'], ['cor-borda', 'cor-superficie', 'grafico'], ['cor-borda', 'cor-superficie-2', 'grafico'],
  ['cor-borda-forte', 'cor-superficie', 'grafico'], ['cor-acao', 'cor-fundo', 'grafico'],
  ['cor-foco', 'cor-fundo', 'grafico'], ['cor-foco', 'cor-superficie', 'grafico'], ['cor-foco', 'cor-foco-interno', 'grafico'],
  ['cor-foco-interno', 'cor-acao', 'grafico'],
  ['cor-alerta-borda', 'cor-superficie', 'grafico'], ['cor-alerta-borda', 'cor-fundo', 'grafico'],
  ['mapa-rota', 'mapa-piso', 'grafico'], ['mapa-rota', 'mapa-fundo', 'grafico'], ['mapa-rota', 'mapa-rota-contorno', 'grafico'],
  ['mapa-parede', 'mapa-piso', 'grafico'], ['mapa-quiosque-borda', 'mapa-piso', 'grafico'],
  ['mapa-trecho-ativo-borda', 'mapa-piso', 'grafico'],
  ['mapa-acessibilidade-icone', 'mapa-acessibilidade', 'grafico'], ['mapa-servico-icone', 'mapa-servico', 'grafico'],
  ['mapa-aviso-icone', 'mapa-aviso', 'grafico']
];
// Marcas do mapa (partida, destino, ícones, avisos): precisam se separar do piso E das lojas,
// pelo preenchimento, pela borda ou pelo contorno externo (halo) — o que tiver contraste.
const MARCAS = ['partida', 'destino', 'acessibilidade', 'servico', 'aviso'];
function marcaOk(tema, m) {
  const fill = cor(tema, 'mapa-' + m), borda = cor(tema, 'mapa-' + m + '-borda'), halo = cor(tema, 'mapa-marca-halo');
  const piso = cor(tema, 'mapa-piso'), loja = cor(tema, 'mapa-loja');
  const contraPiso = Math.max(razao(fill, piso), razao(borda, piso));
  const contraLoja = Math.max(razao(fill, loja), razao(borda, loja), razao(halo, loja));
  return { contraPiso, contraLoja };
}

for (const tema of Object.keys(TEMAS)) {
  test(`contraste no tema ${tema}`, () => {
    const falhas = [];
    for (const [a, b, tipo] of PARES) {
      const minimo = tipo === 'texto' ? (tema === 'contraste' ? 7 : 4.5) : 3;
      const r = razao(cor(tema, a), cor(tema, b));
      if (r < minimo) falhas.push(`--${a} sobre --${b}: ${r.toFixed(2)}:1 (mínimo ${minimo}:1)`);
    }
    for (const m of MARCAS) {
      const { contraPiso, contraLoja } = marcaOk(tema, m);
      if (contraPiso < 3) falhas.push(`marca ${m} sobre o piso: ${contraPiso.toFixed(2)}:1 (mínimo 3:1)`);
      if (contraLoja < 3) falhas.push(`marca ${m} sobre as lojas: ${contraLoja.toFixed(2)}:1 (mínimo 3:1)`);
    }
    expect(falhas, '\n' + falhas.join('\n')).toEqual([]);
  });
}

test('tabela de contraste (para o Documento 02)', () => {
  const linhas = [];
  for (const [a, b] of PARES) linhas.push([`${a} / ${b}`, ...Object.keys(TEMAS).map(t => razao(cor(t, a), cor(t, b)).toFixed(2))]);
  for (const m of MARCAS) {
    linhas.push([`marca ${m} / piso`, ...Object.keys(TEMAS).map(t => marcaOk(t, m).contraPiso.toFixed(2))]);
    linhas.push([`marca ${m} / lojas`, ...Object.keys(TEMAS).map(t => marcaOk(t, m).contraLoja.toFixed(2))]);
  }
  const saida = path.resolve(__dirname, '../../ferramentas/identidade/contraste.md');
  fs.mkdirSync(path.dirname(saida), { recursive: true });
  fs.writeFileSync(saida, '# Contraste dos tokens\n\nGerado por testes/identidade/contraste.spec.js.\n\n| Par | Claro | Alto contraste | Cores distintas |\n| --- | --- | --- | --- |\n' +
    linhas.map(l => `| ${l.join(' | ')} |`).join('\n') + '\n');
  expect(linhas.length).toBe(PARES.length + 2 * MARCAS.length);
});
