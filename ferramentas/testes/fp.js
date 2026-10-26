const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = '/tmp/claude-0/s/';
  const errs = [];
  async function page(w, h) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
    p.on('console', m => m.type() === 'error' && !/TUNNEL|vlibras|fonts/i.test(m.text()) && errs.push(m.text()));
    await p.emulateMedia({ reducedMotion: 'reduce' });
    await p.goto('file:///mnt/user-data/outputs/site-acessivel/index.html');
    await p.click('#voz-nao');
    return p;
  }
  let p = await page(1366, 860);
  await p.click('[data-perfil="mobilidade"]');
  await p.click('[data-origem]:nth-of-type(2)');
  await p.click('[data-abrir="destino"]'); await p.fill('#termo', 'bora'); await p.click('.resultado');
  await p.click('#ver-primeira-pessoa'); await p.waitForTimeout(2500);
  await p.screenshot({ path: out + 'fp1.png' });
  for (let i = 0; i < 6; i++) await p.click('.fp-controles [data-fp="frente"]');
  await p.waitForTimeout(500);
  await p.screenshot({ path: out + 'fp2.png' });
  // drag to look left
  await p.mouse.move(800, 450); await p.mouse.down(); await p.mouse.move(1000, 430, { steps: 8 }); await p.mouse.up();
  await p.waitForTimeout(300);
  await p.screenshot({ path: out + 'fp3-olhar.png' });
  let guard = 0, txt = '';
  while (guard++ < 200) { txt = await p.textContent('.fp-controles [data-fp="frente"]'); if (/Subir|Descer/.test(txt)) break; await p.click('.fp-controles [data-fp="frente"]'); }
  console.log('conexao botão:', txt, 'instr:', await p.textContent('.fp-texto'));
  await p.screenshot({ path: out + 'fp4-elevador.png' });
  await p.click('.fp-controles [data-fp="frente"]'); await p.waitForTimeout(400);
  console.log('piso2 instr:', await p.textContent('.fp-meta'), '|', await p.textContent('.fp-texto'));
  await p.screenshot({ path: out + 'fp5-piso2.png' });
  guard = 0;
  while (guard++ < 200) { if (await p.isVisible('.fp-chegada')) break; await p.click('.fp-controles [data-fp="frente"]'); }
  await p.waitForTimeout(400);
  console.log('chegada:', await p.textContent('.fp-chegada-texto'));
  await p.screenshot({ path: out + 'fp6-chegada.png' });
  await p.click('[data-fp="fechar"]'); await p.click('[data-fp="destino"]'); await p.waitForTimeout(500);
  await p.screenshot({ path: out + 'fp7-destino.png' });
  await p.click('.fp-sair'); await p.waitForTimeout(500);
  console.log('saiu, em-fp?', await p.evaluate(() => document.getElementById('mapa-area').classList.contains('em-fp')));
  // mobile
  p = await page(390, 844);
  await p.click('[data-perfil="geral"]');
  // fluxo novo do celular: atalho do destino primeiro, depois a entrada
  await p.click('[data-proximo="sanitario"]');
  await p.click('.atalhos.entradas [data-origem]');
  await p.click('#ver-primeira-pessoa'); await p.waitForTimeout(2500);
  let g = 0; while (g++ < 200) { if (await p.isVisible('.fp-chegada')) break; await p.click('.fp-controles [data-fp="frente"]'); }
  console.log('celular: chegou ao destino em primeira pessoa?', await p.isVisible('.fp-chegada'), 'cliques', g);
  await p.screenshot({ path: out + 'fp8b-mob-chegada.png' });
  await p.click('[data-fp="fechar"]').catch(() => {});
  await p.waitForTimeout(400);
  await p.screenshot({ path: out + 'fp8-mob.png' });
  await p.click('[data-fp="tela"]'); await p.waitForTimeout(500);
  await p.screenshot({ path: out + 'fp9-mob-cheia.png' });
  console.log('erros:', errs);
  await b.close();
})();
