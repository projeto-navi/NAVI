// Lighthouse mobile, mediana de 3 execuções (requer `npm install`, que traz o lighthouse e o chrome-launcher).
// Uso: node testes/desempenho/lighthouse.mjs [url] [execuções]
//   padrão: https://navi-map.netlify.app/  3
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const url = process.argv[2] || 'https://navi-map.netlify.app/';
const N = Number(process.argv[3] || 3);
const med = xs => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

const runs = [];
for (let i = 0; i < N; i++) {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new'] });
  const { lhr } = await lighthouse(url, { port: chrome.port, output: 'json', onlyCategories: ['performance', 'accessibility'] });
  await chrome.kill();
  const a = lhr.audits;
  const r = {
    performance: Math.round(lhr.categories.performance.score * 100),
    acessibilidade: Math.round(lhr.categories.accessibility.score * 100),
    LCP_ms: Math.round(a['largest-contentful-paint'].numericValue),
    TBT_ms: Math.round(a['total-blocking-time'].numericValue),
    FCP_ms: Math.round(a['first-contentful-paint'].numericValue),
    CLS: +a['cumulative-layout-shift'].numericValue.toFixed(3),
    transferido_KB: Math.round(a['total-byte-weight'].numericValue / 1024)
  };
  runs.push(r);
  console.error(`execução ${i + 1}:`, r);
}
const mediana = Object.fromEntries(Object.keys(runs[0]).map(k => [k, med(runs.map(r => r[k]))]));
console.log(JSON.stringify({ url, execucoes: N, mediana }, null, 2));
