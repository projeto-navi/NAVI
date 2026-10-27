// Gera a Figura 1 do Documento 06 (arquitetura.png) a partir de arq.html.
// Uso: node ferramentas/documentos/arq-png.js   (precisa do Playwright: npm install)
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 2 });
  await pagina.goto('file://' + path.resolve(__dirname, 'arq.html'));
  await pagina.evaluate(() => document.fonts.ready);
  const caixa = await pagina.locator('.w').boundingBox();
  await pagina.screenshot({ path: path.resolve(__dirname, 'arquitetura.png'), clip: caixa, fullPage: true });
  await navegador.close();
  console.log('ferramentas/documentos/arquitetura.png', Math.round(caixa.width), '×', Math.round(caixa.height));
})();
