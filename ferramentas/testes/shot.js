const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const url = 'file:///mnt/user-data/outputs/site-acessivel/index.html';
  const out = '/tmp/claude-0/s/';
  const errs = [];
  async function page(w, h) { const p = await b.newPage({ viewport: { width: w, height: h } }); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type()==='error' && errs.push(m.text())); await p.goto(url); await p.click('#voz-nao'); return p; }
  let p = await page(1366, 860);
  await p.screenshot({ path: out + 'a-home.png' });
  await p.click('[data-perfil="mobilidade"]');
  await p.waitForTimeout(300);
  await p.screenshot({ path: out + 'b-mob.png' });
  await p.click('[data-origem]:nth-of-type(2)');
  await p.click('[data-abrir="destino"]');
  await p.fill('#termo', 'bora');
  await p.waitForTimeout(100);
  await p.screenshot({ path: out + 'c-busca.png' });
  await p.click('.resultado');
  await p.waitForTimeout(300);
  await p.screenshot({ path: out + 'd-rota.png' });
  await p.click('.pisos button[data-piso="2"]');
  await p.waitForTimeout(200);
  await p.screenshot({ path: out + 'e-piso2.png' });
  // visual mobile
  p = await page(390, 844);
  await p.click('[data-perfil="visual"]');
  await p.fill('#termo', 'sanit'); await p.click('.resultado');
  await p.click('[data-origem]');
  await p.waitForTimeout(300);
  await p.screenshot({ path: out + 'f-visual-mob.png', fullPage: true });
  // auditiva
  p = await page(1366, 860);
  await p.click('[data-perfil="auditiva"]');
  await p.click('[data-origem]');
  await p.click('[data-proximo="informacao"]');
  await p.waitForTimeout(300);
  await p.screenshot({ path: out + 'g-auditiva.png' });
  console.log('erros:', errs);
  await b.close();
})();
