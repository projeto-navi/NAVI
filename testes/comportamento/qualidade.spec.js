// Qualidade transversal nas duas páginas: rolagem lateral, alvos de toque, nomes acessíveis,
// console sem erros e axe-core (quando instalado).
const { test, expect } = require('@playwright/test');
const N = require('../apoio/navi');

let AxeBuilder = null;
try { AxeBuilder = require('@axe-core/playwright').default; } catch { /* pacote não instalado */ }

/** Percorre as telas principais das duas páginas e chama `verificar` em cada uma. */
async function percorrerTelas(page, verificar, armazenamento = {}) {
  await N.abrir(page, { armazenamento });
  await N.responderVoz(page, false);
  await verificar('perfis');
  await N.escolherPerfil(page, 'Mobilidade reduzida');
  await verificar('destino');
  await N.campoBusca(page).fill('atelier');
  await verificar('busca');
  await page.getByRole('button', { name: /^Atelier de Costura/ }).first().click();
  await verificar('entrada');
  await N.botaoEntrada(page, 'Acesso Azul').click();
  await page.waitForURL(/mapa\.html/);
  await expect(N.tituloDaRota(page)).toBeVisible();
  await page.waitForTimeout(400);
  await verificar('mapa');
  await N.expandirPainel(page);
  await verificar('mapa expandido');
  await page.getByRole('button', { name: /^Avisar sobre um local/ }).first().click();
  // mede depois da animação de abertura do diálogo (durante ela, os botões ficam um pouco menores)
  await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'));
  await verificar('aviso');
}

test.describe('Celular estreito (RN43, WCAG 1.4.10)', () => {
  for (const texto of [null, '200']) {
    test(`sem rolagem lateral em 320 px ${texto ? 'com o texto a ' + texto + '%' : 'com o texto padrão'}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'celular', 'largura de celular');
      await page.setViewportSize({ width: 320, height: 568 });
      const falhas = [];
      await percorrerTelas(page, async tela => {
        const m = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
        if (m[0] > m[1]) falhas.push(`${tela}: ${m[0]}px > ${m[1]}px`);
      }, texto ? { 'navi-texto': texto } : {});
      expect(falhas, falhas.join('; ')).toEqual([]);
    });
  }

  test('com o texto a 200%, o passo atual e os botões continuam ao alcance', async ({ page }, info) => {
    test.skip(info.project.name !== 'celular', 'largura de celular');
    await page.setViewportSize({ width: 320, height: 568 });
    await N.abrir(page, { caminho: 'mapa.html?origem=1-1401928&destino=2-2482766', armazenamento: { ...N.JA_VISITOU, 'navi-texto': '200', 'navi-perfil': 'mobilidade', 'navi-escadas': '1' } });
    const proximo = page.getByRole('button', { name: 'Próximo' });
    await proximo.scrollIntoViewIfNeeded();
    await expect(proximo).toBeInViewport();
    await proximo.click();
    await expect(N.painel(page)).toContainText(/Passo 2 de \d+/);
  });
});

test('RN40 — alvos de toque de pelo menos 48 × 48 px nas duas páginas', async ({ page }) => {
  const pequenos = [];
  await percorrerTelas(page, async tela => {
    const lista = await page.evaluate(() => [...document.querySelectorAll('button, a[href], input:not([type="radio"]):not(.sr), select, summary, [role="switch"]')]
      .filter(e => e.offsetParent !== null && !e.closest('[hidden],[inert],[aria-hidden="true"]') && getComputedStyle(e).visibility !== 'hidden')
      .filter(e => !e.closest('p, li > span') || e.closest('.lugar, .passo, .acao'))     // link dentro de frase: exceção da WCAG 2.5.8
      .map(e => { const r = e.getBoundingClientRect(); return { r, h: e.outerHTML.slice(0, 70) }; })
      .filter(({ r }) => r.width > 0 && r.height > 0 && (r.width < 47.5 || r.height < 47.5))
      .map(({ r, h }) => `${Math.round(r.width)}×${Math.round(r.height)} ${h}`));
    lista.forEach(h => pequenos.push(`${tela}: ${h}`));
  });
  expect(pequenos, '\n' + pequenos.join('\n')).toEqual([]);
});

test('todo controle interativo visível tem nome acessível', async ({ page }) => {
  // complemento do axe que roda mesmo sem dependências instaladas
  const semNome = [];
  await percorrerTelas(page, async tela => {
    const lista = await page.evaluate(() => [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="switch"]')]
      .filter(e => e.offsetParent !== null && !e.closest('[hidden],[aria-hidden="true"]'))
      .filter(e => {
        const rotulo = e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || (e.id && document.querySelector(`label[for="${e.id}"]`)) || e.closest('label') || e.title;
        return !rotulo && !(e.textContent || e.value || '').trim();
      }).map(e => e.outerHTML.slice(0, 80)));
    lista.forEach(h => semNome.push(`${tela}: ${h}`));
  });
  expect(semNome).toEqual([]);
});

test('console sem erros no fluxo principal das duas páginas', async ({ page }) => {
  const erros = [];
  page.on('pageerror', e => erros.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
  await percorrerTelas(page, async () => {});
  expect(N.errosReais(erros)).toEqual([]);
});

test.describe('Acessibilidade automática (axe-core)', () => {
  for (const tema of ['claro', 'contraste', 'daltonismo']) {
    test(`sem violações sérias ou críticas no tema ${tema}`, async ({ page }) => {
      test.skip(!AxeBuilder, 'Instale as dependências (npm install) para rodar o axe-core.');
      const achados = [];
      await percorrerTelas(page, async tela => {
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).exclude('#vlibras').analyze();
        for (const v of r.violations.filter(v => ['serious', 'critical'].includes(v.impact))) {
          achados.push(`${tela}: ${v.id} (${v.impact}) × ${v.nodes.length} — ${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')}`);
        }
      }, { 'navi-tema': tema });
      expect(achados, '\n' + achados.join('\n')).toEqual([]);
    });
  }
});
