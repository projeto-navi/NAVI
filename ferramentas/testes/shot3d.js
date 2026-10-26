const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const url = 'file:///mnt/user-data/outputs/site-acessivel/index.html';
  const out = '/tmp/claude-0/s/';
  const errs = [];
  async function page(w, h) { const p = await b.newPage({ viewport: { width: w, height: h } }); p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => m.type()==='error' && !/TUNNEL|vlibras|fonts/i.test(m.text()) && errs.push(m.text())); await p.goto(url); await p.click('#voz-nao'); return p; }
  let p = await page(1366, 860);
  await p.click('[data-perfil="mobilidade"]');
  await p.click('[data-vista="3d"]');
  await p.waitForTimeout(2500);
  await p.screenshot({ path: out + '3a.png' });
  await p.click('[data-origem]:nth-of-type(2)');
  await p.click('[data-abrir="destino"]');
  await p.fill('#termo', 'bora');
  await p.click('.resultado');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: out + '3b-rota.png' });
  await p.click('#ver-dois-pisos');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: out + '3c-ambos.png' });
  await p.click('#zoom-mais'); await p.click('#zoom-mais');
  await p.waitForTimeout(800);
  await p.screenshot({ path: out + '3d-zoom.png' });
  // click on canvas center selects something?
  const before = await p.evaluate(() => window.Navi.E.destino && window.Navi.E.destino.nome);
  await p.mouse.click(900, 450); await p.waitForTimeout(500);
  const after = await p.evaluate(() => window.Navi.E.destino && window.Navi.E.destino.nome);
  console.log('clique 3D destino:', before, '->', after);
  // back to 2D and verify
  await p.click('[data-vista="2d"]'); await p.waitForTimeout(400);
  await p.screenshot({ path: out + '3e-2d.png' });
  // visual + contraste 3D mobile
  p = await page(390, 844);
  await p.click('[data-perfil="visual"]');
  await p.fill('#termo', 'sanit'); await p.click('.resultado');
  await p.click('[data-origem]');
  await p.click('[data-vista="3d"]');
  await p.waitForTimeout(2500);
  await p.locator('#mapa-area').screenshot({ path: out + '3f-mob.png' });
  console.log('erros:', errs);
  await b.close();
})();
