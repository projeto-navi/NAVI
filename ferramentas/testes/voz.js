const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const out = '/tmp/claude-0/s/';
  const errs = [];
  async function page(w, h) {
    const p = await b.newPage({ viewport: { width: w, height: h }, hasTouch: true });
    p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => {
      window.__falas = [];
      const fake = { speaking: false, cancel() {}, getVoices: () => [], speak(u) { window.__falas.push(u.text); }, onvoiceschanged: null };
      Object.defineProperty(window, 'speechSynthesis', { value: fake });
      window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    });
    await p.goto('file:///mnt/user-data/outputs/site-acessivel/index.html');
    return p;
  }
  const falas = async p => { const f = await p.evaluate(() => window.__falas.splice(0)); return f; };
  // Mobile, Sim
  let p = await page(390, 844);
  await p.waitForTimeout(600);
  await p.screenshot({ path: out + 'v1-popup.png' });
  console.log('abertura:', await falas(p));
  await p.click('#voz-sim');
  console.log('sim:', await falas(p));
  await p.click('[data-perfil="visual"]');
  console.log('1o toque:', await falas(p), 'tela mapa visível?', await p.isVisible('#tela-mapa'));
  await p.click('[data-perfil="visual"]');
  await p.waitForTimeout(200);
  console.log('2o toque:', await falas(p));
  console.log('foco em:', await p.evaluate(() => document.activeElement.id));
  await p.screenshot({ path: out + 'v2-busca.png' });
  await p.keyboard.type('burger');
  await p.click('.resultado');
  console.log('destino:', await falas(p), 'foco:', await p.evaluate(() => document.activeElement.id));
  await p.screenshot({ path: out + 'v3-origem.png' });
  await p.click('[data-origem]');
  await p.waitForTimeout(200);
  console.log('rota:', (await falas(p)).map(t => t.slice(0, 120)));
  // Desktop, Não, mobilidade
  p = await page(1366, 860);
  await p.click('#voz-nao');
  console.log('nao:', await falas(p));
  await p.click('[data-perfil="mobilidade"]');
  console.log('mobilidade fala?', await falas(p), 'tela mapa:', await p.isVisible('#tela-mapa'));
  // Não + visual: busca focada, sem voz
  p = await page(1366, 860);
  await p.click('#voz-nao'); await p.click('[data-perfil="visual"]');
  console.log('nao+visual foco:', await p.evaluate(() => document.activeElement.id), 'falas:', await falas(p));
  console.log('erros:', errs);
  await b.close();
})();
