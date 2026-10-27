// Navi — gera os ícones do site (PWA, favicon, ícone da tela inicial) e a imagem de compartilhamento
// a partir da marca da identidade (o mesmo desenho do símbolo "navi-marca" em js/icones.js).
// Uso: node ferramentas/identidade/gerar-icones.js   (precisa do Playwright instalado)
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const SITE = path.resolve(__dirname, '../../site-acessivel');
const IMG = path.join(SITE, 'img');
const FONTE = fs.readFileSync(path.join(SITE, 'fontes/atkinson-hyperlegible-next.woff2')).toString('base64');

const AZUL = '#0B4FA8', BRANCO = '#FFFFFF', AMARELO = '#FFC62E', TINTA = '#0D1B2A';
/** Desenho da marca num quadrado de 128: caminho com partida e chegada. */
const tracos = (traco = BRANCO, destino = AMARELO) =>
  `<path d="M30 96H58V70H86V54" fill="none" stroke="${traco}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<circle cx="86" cy="40" r="12" fill="none" stroke="${destino}" stroke-width="9"/>`;

const svgIcone = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="Navi">` +
  `<rect width="128" height="128" rx="30" fill="${AZUL}"/>${tracos()}</svg>\n`;
// quadrado cheio (iOS arredonda sozinho; Android "maskable" corta um círculo: o desenho fica na zona segura de 80%)
const svgCheio = (escala = 1) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" fill="${AZUL}"/>` +
  `<g transform="translate(64 64) scale(${escala}) translate(-64 -64)">${tracos()}</g></svg>`;
const svgLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 128" role="img" aria-label="Navi, Navegador Acessível de Vias Internas">` +
  `<rect width="128" height="128" rx="30" fill="${AZUL}"/>${tracos()}` +
  `<text x="156" y="92" font-family="'Atkinson Hyperlegible Next', 'Atkinson Hyperlegible', system-ui, sans-serif" font-size="84" font-weight="800" fill="${TINTA}" letter-spacing="1">Navi</text></svg>\n`;

const paginaCompartilhar = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
@font-face { font-family: A; src: url(data:font/woff2;base64,${FONTE}) format("woff2"); font-weight: 200 800; }
html, body { margin: 0; }
body { width: 1200px; height: 630px; background: ${AZUL}; color: ${BRANCO}; font-family: A, sans-serif; display: grid; grid-template-columns: 300px 1fr; align-items: center; gap: 64px; padding: 0 96px; box-sizing: border-box; }
.marca { width: 300px; height: 300px; }
h1 { font-size: 112px; font-weight: 800; margin: 0 0 12px; letter-spacing: 1px; line-height: 1; }
p { font-size: 40px; line-height: 1.3; margin: 0; max-width: 16ch; }
.trilha { display: flex; gap: 10px; margin-top: 40px; }
.trilha i { width: 64px; height: 14px; border-radius: 7px; background: ${AMARELO}; }
.trilha i + i { background: rgb(255 255 255 / 0.35); }
</style></head><body>
<svg class="marca" viewBox="0 0 128 128"><rect width="128" height="128" rx="30" fill="${BRANCO}"/>${tracos(AZUL, '#E0A300')}</svg>
<div><h1>Navi</h1><p>Rotas acessíveis dentro do local, com voz, Libras e caminhos sem escadas.</p><div class="trilha"><i></i><i></i><i></i><i></i></div></div>
</body></html>`;

(async () => {
  fs.writeFileSync(path.join(IMG, 'icone-navi.svg'), svgIcone);
  fs.writeFileSync(path.join(IMG, 'logo-navi.svg'), svgLogo);
  const b = await chromium.launch();
  const p = await b.newPage();
  async function png(svg, tamanho, arquivo) {
    await p.setViewportSize({ width: tamanho, height: tamanho });
    await p.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${tamanho}" height="${tamanho}" `)}</body></html>`);
    await p.screenshot({ path: path.join(IMG, arquivo), omitBackground: true });
  }
  await png(svgIcone, 192, 'icone-192.png');
  await png(svgIcone, 512, 'icone-512.png');
  await png(svgCheio(1), 180, 'icone-180.png');
  await png(svgCheio(0.78), 512, 'icone-maskable-512.png');
  await p.setViewportSize({ width: 1200, height: 630 });
  await p.setContent(paginaCompartilhar);
  await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(IMG, 'compartilhar.png') });
  await b.close();
  console.log('Ícones gerados em', IMG);
})();
