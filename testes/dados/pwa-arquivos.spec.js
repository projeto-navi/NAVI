// O service worker só instala se TODOS os arquivos do precache existirem (um 404 derruba a instalação).
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const SITE = path.resolve(__dirname, '../../site-acessivel');

test('todo arquivo da lista de precache do sw.js existe', () => {
  const sw = fs.readFileSync(path.join(SITE, 'sw.js'), 'utf8');
  const lista = JSON.parse(sw.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"'));
  const faltando = lista.filter(f => f !== './' && !fs.existsSync(path.join(SITE, f)));
  expect(faltando).toEqual([]);
});

test('as duas páginas só carregam scripts e estilos que estão no precache (ou são do 3D, carregado depois)', () => {
  const sw = fs.readFileSync(path.join(SITE, 'sw.js'), 'utf8');
  const lista = new Set(JSON.parse(sw.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"')));
  for (const pagina of ['index.html', 'mapa.html']) {
    const html = fs.readFileSync(path.join(SITE, pagina), 'utf8');
    const usados = [...html.matchAll(/(?:src|href)="((?:js|css|fontes)\/[^"]+)"/g)].map(m => m[1]);
    expect(usados.filter(u => !lista.has(u)), pagina).toEqual([]);
  }
});

test('manifest aponta para ícones que existem', () => {
  const m = JSON.parse(fs.readFileSync(path.join(SITE, 'manifest.webmanifest'), 'utf8'));
  for (const i of m.icons) expect(fs.existsSync(path.join(SITE, i.src)), i.src).toBe(true);
});

test('o local padrão que as páginas pedem logo no <head> é o mesmo de locais/indice.js', () => {
  // as duas páginas começam a baixar os arquivos do local padrão antes dos scripts rodarem
  const indice = fs.readFileSync(path.join(SITE, 'locais/indice.js'), 'utf8');
  const padrao = indice.match(/slug:\s*'([^']+)'[^}]*padrao:\s*true/)[1];
  for (const pagina of ['index.html', 'mapa.html']) {
    const html = fs.readFileSync(path.join(SITE, pagina), 'utf8');
    expect(html.match(/var PADRAO = '([^']+)'/)[1], pagina).toBe(padrao);
  }
  // e o que o <head> pede para o padrão existe (um pedido que dá 404 só atrasa a página)
  const mapa = fs.readFileSync(path.join(SITE, 'mapa.html'), 'utf8');
  const arquivos = JSON.parse(mapa.match(/\[('config\.js'[^\]]*)\]/)[0].replace(/'/g, '"'));
  for (const f of arquivos) expect(fs.existsSync(path.join(SITE, 'locais', padrao, f)), f).toBe(true);
});
