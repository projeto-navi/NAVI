const { chromium } = require('playwright');
const SITE = 'file:///mnt/user-data/outputs/site-acessivel/index.html';
const OUT = '/tmp/claude-0/-home-claude/1706e07e-e36f-536b-ae08-8cf3d3b7c6be/scratchpad/mob/x-';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const nova = async (opts = {}) => { const c = await b.newContext({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true, ...opts }); const p = await c.newPage();
    p.on('pageerror', e => errs.push(e.message)); await p.goto(SITE); await p.waitForTimeout(250); return p; };
  // 1. visual no celular
  let p = await nova(); await p.tap('#voz-nao'); await p.tap('[data-perfil="visual"]'); await p.waitForTimeout(250);
  const foco1 = await p.evaluate(() => document.activeElement.id);
  await p.fill('#termo', 'renner'); await p.tap('.resultado'); await p.waitForTimeout(250);
  await p.tap('.atalhos.entradas [data-origem]'); await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '1-visual.png' });
  const foco2 = await p.evaluate(() => document.activeElement.id);
  // 2. alto contraste + mobilidade
  p = await nova(); await p.tap('#voz-nao'); await p.tap('#btn-contraste'); await p.tap('[data-perfil="mobilidade"]'); await p.waitForTimeout(250);
  await p.screenshot({ path: OUT + '2-contraste-destino.png' });
  await p.fill('#termo', 'renner'); await p.tap('.resultado'); await p.waitForTimeout(250); await p.tap('.atalhos.entradas [data-origem]'); await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '3-contraste-rota.png' });
  // 3. avisar e primeira pessoa
  await p.tap('#abrir-aviso'); await p.waitForTimeout(250);
  await p.screenshot({ path: OUT + '4-avisar.png' });
  await p.tap('#aviso-voltar'); await p.waitForTimeout(300);
  const temRota = await p.evaluate(() => !!Navi.E.rota && document.querySelector('.passo-atual') !== null);
  await p.tap('#ver-primeira-pessoa'); await p.waitForTimeout(2500);
  await p.screenshot({ path: OUT + '5-primeira-pessoa.png' });
  // 4. teclado: perfil por Enter, destino digitado, resultado por Enter, entrada por Enter
  p = await nova(); await p.keyboard.press('Tab'); await p.keyboard.press('Shift+Tab');
  await p.focus('#voz-nao'); await p.keyboard.press('Enter');
  await p.focus('[data-perfil="geral"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  await p.focus('#termo'); await p.keyboard.type('renner'); await p.waitForTimeout(100);
  await p.focus('.resultado'); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  await p.focus('.atalhos.entradas [data-origem]'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  await p.keyboard.press('Tab'); const tab1 = await p.evaluate(() => document.activeElement.id || document.activeElement.className);
  const kb = await p.evaluate(() => [!!Navi.E.rota, document.activeElement.id]);
  // 5. botões sem nome acessível na tela da rota
  const semNome = await p.evaluate(() => [...document.querySelectorAll('#painel button, #painel a')].filter(b => !(b.getAttribute('aria-label') || b.textContent).trim()).length);
  // 6. alvos de toque menores que 44 px no painel
  const pequenos = await p.evaluate(() => [...document.querySelectorAll('#painel button')].filter(b => { const r = b.getBoundingClientRect(); return r.width && (r.height < 44 || r.width < 44); }).map(b => b.id || b.textContent.trim().slice(0, 30)));
  console.log({ errs, foco1, foco2, temRota, kb, tab1, semNome, pequenos });
  await b.close();
})();
