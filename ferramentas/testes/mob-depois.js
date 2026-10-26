const { chromium } = require('playwright');
const SITE = 'file:///mnt/user-data/outputs/site-acessivel/index.html';
const OUT = '/tmp/claude-0/-home-claude/1706e07e-e36f-536b-ae08-8cf3d3b7c6be/scratchpad/mob/depois-';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(SITE); await p.waitForTimeout(300);
  let toques = 0; const tap = async s => { await p.tap(s); toques++; await p.waitForTimeout(250); };
  await tap('#voz-nao');
  await p.screenshot({ path: OUT + '1-perfil.png' });
  const visivel = await p.evaluate(() => [...document.querySelectorAll('.perfil')].map(e => e.getBoundingClientRect().bottom <= innerHeight));
  await tap('[data-perfil="mobilidade"]');
  await p.screenshot({ path: OUT + '2-destino.png' });
  await p.fill('#termo', 'renner'); await p.waitForTimeout(150);
  await p.screenshot({ path: OUT + '3-busca.png' });
  await tap('.resultado');
  await p.screenshot({ path: OUT + '4-entrada.png' });
  await tap('.atalhos.entradas [data-origem]');
  await p.screenshot({ path: OUT + '5-rota.png' });
  const info = await p.evaluate(() => ({ titulo: document.querySelector('.passo-atual .t')?.textContent, scrollH: document.documentElement.scrollHeight, inner: innerHeight,
    nav: document.querySelector('.nav-passos')?.getBoundingClientRect().bottom }));
  await tap('#passo-prox');
  await p.screenshot({ path: OUT + '6-passo2.png' });
  // atalho mais próximo sem partida
  await tap('#nova-rota');
  await tap('[data-proximo="sanitario"]');
  await p.screenshot({ path: OUT + '7-sanitario-entrada.png' });
  const dest1 = await p.evaluate(() => Navi.E.destino && Navi.E.destino.nome);
  // perfil novo, sem partida: atalho pede a entrada e calcula sozinho
  await p.evaluate(() => { localStorage.clear(); });
  const p2 = await ctx.newPage(); p2.on('pageerror', e => errs.push(e.message));
  await p2.goto(SITE); await p2.waitForTimeout(300); await p2.tap('#voz-nao'); await p2.tap('[data-perfil="auditiva"]'); await p2.waitForTimeout(250);
  await p2.tap('[data-proximo="sanitario"]'); await p2.waitForTimeout(250);
  await p2.screenshot({ path: OUT + '8-sanitario-entrada.png' });
  await p2.tap('.atalhos.entradas [data-origem]:nth-child(2)'); await p2.waitForTimeout(300);
  await p2.screenshot({ path: OUT + '9-sanitario-rota.png' });
  const dest2 = await p2.evaluate(() => [Navi.E.origem.nome, Navi.E.destino && Navi.E.destino.nome, Navi.E.pendente]);
  console.log({ errs, visivel, toques, info, dest1, dest2 });
  await b.close();
})();
