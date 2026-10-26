// Mesmo roteiro no desktop, versão antiga x nova: as capturas precisam ser idênticas.
const { chromium } = require('playwright');
const DIR = '/tmp/claude-0/-home-claude/1706e07e-e36f-536b-ae08-8cf3d3b7c6be/scratchpad/mob/';
const sites = { antes: 'file:///home/claude/build/backup-antes-mobile-1792797679/index.html', depois: 'file:///mnt/user-data/outputs/site-acessivel/index.html' };
(async () => {
  const b = await chromium.launch();
  for (const [nome, url] of Object.entries(sites)) {
    for (const perfil of ['mobilidade', 'visual', 'auditiva', 'geral']) {
      const p = await b.newPage({ viewport: { width: 1366, height: 860 } });
      await p.goto(url); await p.waitForTimeout(200); await p.click('#voz-nao');
      if (perfil === 'geral') await p.click('.link-sem-perfil'); else await p.click(`[data-perfil="${perfil}"]`);
      await p.waitForTimeout(250);
      await p.screenshot({ path: `${DIR}desk-${nome}-${perfil}-a.png` });
      await p.evaluate(() => { const G = Navi.G; Navi.escolher('origem', G.places.find(x => x.cat === 'entrada')); Navi.escolher('destino', G.places.find(x => /renner/i.test(x.nome))); });
      await p.waitForTimeout(400);
      await p.evaluate(() => document.querySelectorAll('.rota-fluxo').forEach(e => e.style.animation = 'none'));
      await p.screenshot({ path: `${DIR}desk-${nome}-${perfil}-b.png` });
      await p.close();
    }
  }
  await b.close();
})();
