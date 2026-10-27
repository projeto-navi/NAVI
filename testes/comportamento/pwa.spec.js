// PWA: instalável e sem internet depois da primeira visita (RN62).
const { test, expect } = require('@playwright/test');
const N = require('../apoio/navi');

test('manifest com nome, ícones 192 e 512, lang pt-BR e endereços relativos', async ({ page, request }) => {
  await N.abrir(page, { armazenamento: N.JA_VISITOU });
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const m = await (await request.get(href)).json();
  expect(m.name).toMatch(/Navi/);
  expect(m.short_name).toBe('Navi');
  expect(m.lang).toBe('pt-BR');
  expect(m.display).toBe('standalone');
  expect(m.start_url.startsWith('/')).toBe(false);
  expect(m.scope.startsWith('/')).toBe(false);
  const tamanhos = m.icons.map(i => i.sizes);
  expect(tamanhos).toEqual(expect.arrayContaining(['192x192', '512x512']));
  for (const i of m.icons) expect((await request.get(i.src)).ok(), i.src).toBe(true);
});

test('RN62 — depois da primeira visita: abre, busca, calcula a rota e mostra o passo a passo sem internet', async ({ page, context }) => {
  await N.abrir(page, { armazenamento: { ...N.JA_VISITOU, 'navi-perfil': 'geral' } });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(async () => (await caches.keys()).some(k => k.startsWith('navi-dados')), null, { timeout: 15_000 });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Para onde você vai?' })).toBeVisible();
  await expect(page.getByText(/Sem internet/)).toBeVisible();
  await N.buscarEEscolher(page, 'pasteis', '10 Pastéis');
  await N.botaoEntrada(page, 'Acesso Azul').click();
  await page.waitForURL(/mapa\.html/);
  await expect(page.getByRole('heading', { level: 1, name: 'Rota até 10 Pastéis' })).toBeVisible();
  await expect(N.painel(page)).toContainText(/Passo 1 de \d+/);
  await expect(N.painel(page)).toContainText('Sem internet. A rota e o passo a passo continuam funcionando.');
  await context.setOffline(false);
});

test('RN62 — sem internet, Libras avisa por texto que precisa de conexão', async ({ page, context }) => {
  await N.abrir(page, { caminho: 'mapa.html?origem=1-1401928&destino=1-2482759', armazenamento: { ...N.JA_VISITOU, 'navi-perfil': 'auditiva', 'navi-libras': '1' } });
  await context.setOffline(true);
  await N.expandirPainel(page);
  await page.getByRole('button', { name: 'Abrir tradutor de Libras' }).click();
  await expect(page.getByRole('status').filter({ hasText: /precisa de internet/ })).toHaveCount(1);
  await context.setOffline(false);
});
