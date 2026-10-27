// Qualidade transversal: rolagem lateral, axe-core e console sem erros.
const { test, expect } = require('@playwright/test');
const N = require('../apoio/navi');

let AxeBuilder = null;
try { AxeBuilder = require('@axe-core/playwright').default; } catch { /* pacote não instalado */ }

/** Percorre as telas principais e chama `verificar` em cada uma. */
async function percorrerTelas(page, verificar) {
  await N.abrir(page);
  await N.responderVoz(page, false);
  await verificar('perfis');
  await N.escolherPerfil(page, 'Mobilidade reduzida');
  if (!(await N.campoBusca(page).isVisible())) await page.getByRole('button', { name: /^Para onde vai/ }).click();
  await N.campoBusca(page).fill('atelier');
  await verificar('busca');
  await page.getByRole('button', { name: /^Atelier de Costura/ }).first().click();
  if (!(await page.getByRole('heading', { name: /onde você está/i }).isVisible())) await page.getByRole('button', { name: /^Onde você está/ }).click();
  await N.botaoEntrada(page, 'Acesso Azul').click();
  await expect(page.getByRole('region', { name: 'Seu caminho' })).toBeVisible();
  await verificar('rota');
  await page.getByRole('button', { name: 'Avisar sobre um local' }).click();
  await verificar('aviso');
}

test.describe('Celular estreito (RN43, WCAG 1.4.10)', () => {
  for (const comAmais of [false, true]) {
    test(`sem rolagem lateral em 320 px ${comAmais ? 'com' : 'sem'} A+`, async ({ page }, info) => {
      test.skip(info.project.name !== 'celular', 'largura de celular');
      // FALHA CONHECIDA (F9, nova): com A+, os botões do topo passam 12 px da tela de 320 px
      test.fail(comAmais, 'F9: .topo-acoes vai até 332 px em 320 px com A+ (busca, rota e aviso).');
      await page.setViewportSize({ width: 320, height: 568 });
      if (comAmais) await page.addInitScript(() => { if (!sessionStorage.getItem('__a')) { sessionStorage.setItem('__a', 1); localStorage.setItem('navi-texto', '1'); } });
      const falhas = [];
      await percorrerTelas(page, async tela => {
        const m = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
        if (m[0] > m[1]) falhas.push(`${tela}: ${m[0]}px > ${m[1]}px`);
      });
      expect(falhas, falhas.join('; ')).toEqual([]);
    });
  }
});

test.describe('Acessibilidade automática (axe-core)', () => {
  for (const contraste of [false, true]) {
    test(`sem violações sérias ou críticas ${contraste ? 'no alto contraste' : 'no tema padrão'}`, async ({ page }) => {
      test.skip(!AxeBuilder, 'Instale as dependências (npm install) para rodar o axe-core.');
      if (contraste) await page.addInitScript(() => { if (!sessionStorage.getItem('__c')) { sessionStorage.setItem('__c', 1); localStorage.setItem('navi-contraste', '1'); } });
      const achados = [];
      await percorrerTelas(page, async tela => {
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).exclude('#vlibras').analyze();
        for (const v of r.violations.filter(v => ['serious', 'critical'].includes(v.impact))) {
          achados.push(`${tela}: ${v.id} (${v.impact}) × ${v.nodes.length} — ${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')}`);
        }
      });
      expect(achados, '\n' + achados.join('\n')).toEqual([]);
    });
  }
});

test('console sem erros no fluxo principal', async ({ page }) => {
  const erros = [];
  page.on('pageerror', e => erros.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
  await percorrerTelas(page, async () => {});
  expect(N.errosReais(erros)).toEqual([]);
});

test('todo controle interativo visível tem nome acessível', async ({ page }) => {
  // complemento do axe que roda mesmo sem dependências instaladas
  const semNome = [];
  await percorrerTelas(page, async tela => {
    const lista = await page.evaluate(() => [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]')]
      .filter(e => e.offsetParent !== null && !e.closest('[hidden],[aria-hidden="true"]'))
      .filter(e => {
        const rotulo = e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || (e.id && document.querySelector(`label[for="${e.id}"]`)) || e.closest('label') || e.title;
        return !rotulo && !(e.textContent || e.value || "").trim();
      }).map(e => e.outerHTML.slice(0, 80)));
    lista.forEach(h => semNome.push(`${tela}: ${h}`));
  });
  expect(semNome).toEqual([]);
});
