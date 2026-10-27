// Linha de base de desempenho sem Lighthouse (funciona só com o Playwright).
// Imita o perfil "mobile" do Lighthouse com limitação real (DevTools):
//   CPU 4× mais lenta, rede Slow 4G (562,5 ms de latência, 1,47 Mb/s de descida, 675 kb/s de subida),
//   tela 412×823, cache vazio. Mede LCP, FCP, TBT aproximado e bytes transferidos. Mediana de N execuções.
// Uso: node testes/desempenho/linha-de-base.mjs [url] [execuções]
//   sem url, sobe o servidor local em site-acessivel/.
// Observação: Google Fonts e VLibras são externos; com --sem-externos eles são bloqueados
// (necessário em ambientes sem internet) e o peso deles fica de fora.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const semExternos = args.includes('--sem-externos');
const pos = args.filter(a => !a.startsWith('--'));
const N = Number(pos[1] || 3);
let url = pos[0];
let servidor = null;
if (!url) {
  const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  servidor = spawn(process.execPath, [resolve(raiz, 'testes/servidor.mjs'), 'site-acessivel', '4180'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 600));
  url = 'http://127.0.0.1:4180/';
}

async function medir() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  if (semExternos) await page.route(u => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), r => r.fulfill({ status: 200, body: '' }));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 562.5, downloadThroughput: 1474.56 * 1024 / 8, uploadThroughput: 675 * 1024 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  let bytes = 0; const porTipo = {};
  const tipos = {};
  cdp.on('Network.responseReceived', e => { tipos[e.requestId] = e.type; });
  cdp.on('Network.loadingFinished', e => { bytes += e.encodedDataLength; const t = tipos[e.requestId] || 'Other'; porTipo[t] = (porTipo[t] || 0) + e.encodedDataLength; });
  await page.addInitScript(() => {
    window.__m = { lcp: 0, longas: [] };
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__m.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__m.longas.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true });
  });
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'load', timeout: 120_000 });
  await page.waitForTimeout(5000); // janela de silêncio para o TBT
  const r = await page.evaluate(() => {
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0;
    const tbt = window.__m.longas.filter(([s]) => s >= fcp).reduce((a, [, d]) => a + Math.max(0, d - 50), 0);
    const nav = performance.getEntriesByType('navigation')[0];
    return { fcp, lcp: window.__m.lcp, tbt, load: nav.loadEventEnd };
  });
  await browser.close();
  return { ...r, bytes, porTipo, total: Date.now() - t0 };
}

const med = xs => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const runs = [];
for (let i = 0; i < N; i++) { const r = await medir(); runs.push(r); console.error(`execução ${i + 1}: LCP ${r.lcp.toFixed(0)} ms, TBT ${r.tbt.toFixed(0)} ms, ${(r.bytes / 1024).toFixed(0)} KB`); }
const res = {
  url, execucoes: N, semExternos,
  perfil: 'CPU 4×, Slow 4G (DevTools), 412×823, cache vazio',
  mediana: {
    FCP_ms: Math.round(med(runs.map(r => r.fcp))), LCP_ms: Math.round(med(runs.map(r => r.lcp))),
    TBT_ms: Math.round(med(runs.map(r => r.tbt))), load_ms: Math.round(med(runs.map(r => r.load))),
    transferido_KB: Math.round(med(runs.map(r => r.bytes)) / 1024)
  },
  porTipo_KB: Object.fromEntries(Object.entries(runs[0].porTipo).map(([k, v]) => [k, Math.round(v / 1024)]))
};
console.log(JSON.stringify(res, null, 2));
servidor?.kill();
