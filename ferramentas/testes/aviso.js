const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = '/tmp/claude-0/s/';
  const errs = [];
  const p = await b.newPage({ viewport: { width: 1366, height: 860 } });
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  p.on('console', m => m.type() === 'error' && !/TUNNEL|vlibras|fonts/i.test(m.text()) && errs.push(m.text()));
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto('file:///mnt/user-data/outputs/site-acessivel/index.html');
  await p.click('#voz-nao');
  await p.click('[data-perfil="mobilidade"]');
  await p.click('[data-origem]:nth-of-type(2)');
  await p.click('[data-abrir="destino"]'); await p.fill('#termo', 'bora'); await p.click('.resultado');
  console.log('rota antes:', await p.evaluate(() => window.Navi.E.rota && window.Navi.E.rota.passos.length));
  await p.click('#abrir-aviso');
  await p.screenshot({ path: out + 'av1-form.png' });
  // submit without place -> error
  await p.click('#form-aviso button[type=submit]');
  console.log('erro:', await p.textContent('#erro-aviso'));
  await p.click('[data-aviso-lugar]:has-text("Elevador")');
  await p.check('input[value="danificado"]');
  await p.fill('#detalhe-aviso', 'Elevador parado, com fita na porta');
  await p.click('#form-aviso button[type=submit]');
  await p.waitForTimeout(300);
  await p.screenshot({ path: out + 'av2-enviado.png' });
  console.log('whatsapp href:', (await p.getAttribute('a[href^="https://wa.me"]', 'href')).slice(0, 120));
  await p.click('#aviso-voltar'); await p.waitForTimeout(300);
  console.log('rota com elevador quebrado (mobilidade):', await p.evaluate(() => window.Navi.E.rota), '|', (await p.textContent('.rota')).trim().slice(0, 200));
  await p.screenshot({ path: out + 'av3-semrota.png' });
  // mark destination store as interditado and view 2D + 3D
  await p.click('#abrir-aviso');
  await p.click('[data-aviso-lugar]:has-text("Meu destino")');
  await p.check('input[value="interditado"]');
  await p.click('#form-aviso button[type=submit]');
  await p.click('#aviso-voltar');
  await p.click('.pisos button[data-piso="2"]'); await p.waitForTimeout(300);
  await p.screenshot({ path: out + 'av4-mapa2d.png' });
  await p.click('[data-vista="3d"]'); await p.waitForTimeout(2500);
  await p.screenshot({ path: out + 'av5-mapa3d.png' });
  // search result tag
  await p.click('[data-abrir="destino"]'); await p.fill('#termo', 'bora');
  console.log('tag na busca:', await p.textContent('.tag-aviso'));
  // persistence after reload
  await p.reload(); await p.click('#voz-nao'); await p.click('[data-perfil="geral"]');
  console.log('avisos após recarregar:', await p.evaluate(() => window.Navi.E.avisos.map(a => a.lugar + ':' + a.tipo)));
  console.log('erros:', errs);
  await b.close();
})();
