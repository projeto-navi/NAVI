// Abertura, perfis, links e QR Codes, preferências lembradas.
const { test, expect } = require('@playwright/test');
const N = require('../apoio/navi');

test.describe('Abertura (RN01, RN02, RN30)', () => {
  test('RN01 — na primeira visita a pergunta de voz aparece antes dos perfis', async ({ page }) => {
    await N.abrir(page);
    const d = N.dialogoVoz(page);
    await expect(d).toBeVisible();
    await expect(d.getByRole('button', { name: 'Sim', exact: true })).toBeVisible();
    await expect(d.getByRole('button', { name: 'Não', exact: true })).toBeVisible();
    // enquanto a pergunta está aberta, o perfil não pode ser escolhido (diálogo modal)
    await expect(N.opcaoPerfil(page, 'Mobilidade reduzida').click({ timeout: 800, trial: true })).rejects.toThrow();
    await N.responderVoz(page, false);
    await expect(N.opcaoPerfil(page, 'Mobilidade reduzida')).toBeVisible();
  });

  test('RN01 — na segunda visita a pergunta de voz não aparece de novo (F7 corrigida)', async ({ page }) => {
    await N.abrir(page);
    await N.responderVoz(page, false);
    await page.reload();
    await expect(N.opcaoPerfil(page, 'Mobilidade reduzida')).toBeVisible();
    await expect(N.dialogoVoz(page)).toBeHidden();
  });

  test('RN30 — as opções de perfil são botões com nome e descrição (F8 corrigida)', async ({ page }) => {
    await N.abrir(page, { armazenamento: N.JA_VISITOU });
    for (const nome of ['Deficiência visual', 'Mobilidade reduzida', 'Deficiência auditiva', 'Sem adaptações']) {
      const b = page.getByRole('button', { name: nome, exact: true });
      await expect(b).toBeVisible();
      await expect(b).toHaveAccessibleDescription(/\S/);
    }
  });

  test('RN02 / RN03 — depois do perfil, a primeira pergunta é o destino, com a busca pronta', async ({ page }) => {
    await N.abrir(page, { armazenamento: N.JA_VISITOU });
    await N.escolherPerfil(page, 'Sem adaptações');
    await expect(page.getByRole('heading', { level: 1, name: 'Para onde você vai?' })).toBeVisible();
    await expect(N.campoBusca(page)).toBeVisible();
    // a Página de Rota não tem mapa
    await expect(page.getByRole('img', { name: /Planta/ })).toHaveCount(0);
  });
});

test.describe('Links e QR Codes (RN59, RN60)', () => {
  test('QR Code na entrada (?perfil=mobilidade&origem=…): partida preenchida, pergunta só o destino', async ({ page }) => {
    await N.abrir(page, { caminho: '?perfil=mobilidade&origem=PCT_P01_L0001' });
    if (await N.dialogoVoz(page).isVisible()) await N.responderVoz(page, false);
    await expect(page.getByRole('heading', { level: 1, name: 'Para onde você vai?' })).toBeVisible();
    await expect(page.getByRole('main')).toContainText('Partida');
    await expect(page.getByRole('main')).toContainText('Entrada principal');
    // o perfil de mobilidade ligou "evitar escadas"
    expect(await page.evaluate(() => localStorage.getItem('navi-escadas'))).toBe('1');
  });

  test('RN59 — link com partida e destino abre direto a Página do Mapa', async ({ page }) => {
    await N.abrir(page, { caminho: 'mapa.html?perfil=mobilidade&origem=PCT_P01_L0001&destino=PCT_P01_L0003' });
    await expect(page.getByRole('heading', { level: 1, name: 'Rota até Loja A' })).toBeVisible();
    await expect(N.dialogoVoz(page)).toHaveCount(0); // nunca na Página do Mapa (RN01)
  });

  test('link antigo index.html?origem=…&destino=… continua funcionando', async ({ page }) => {
    await N.abrir(page, { caminho: 'index.html?perfil=mobilidade&origem=PCT_P01_L0001&destino=PCT_P01_L0003', armazenamento: N.JA_VISITOU });
    await page.waitForURL(/mapa\.html\?/);
    expect(page.url()).toContain('origem=');
    await expect(page.getByRole('heading', { level: 1, name: 'Rota até Loja A' })).toBeVisible();
  });

  test('links e QR Codes do Shopping Estação (fora do site) voltam para a Página de Rota do prédio', async ({ page }) => {
    await N.abrir(page, { caminho: 'mapa.html?origem=1-1401928&destino=1-2482759', armazenamento: { ...N.JA_VISITOU, 'navi-perfil': 'geral' } });
    await page.waitForURL(u => !/mapa\.html/.test(u.pathname));
    await expect(page.getByRole('heading', { level: 1, name: 'Para onde você vai?' })).toBeVisible();
    await N.abrir(page, { caminho: '?local=shopping-estacao', armazenamento: { ...N.JA_VISITOU, 'navi-perfil': 'geral' } });
    await N.campoBusca(page).fill('reuni');
    await expect(page.getByRole('button', { name: /^Sala de reunião/ }).first()).toBeVisible();
  });

  test('RN60 — Página do Mapa sem partida ou destino válidos volta para a Página de Rota', async ({ page }) => {
    await N.abrir(page, { caminho: 'mapa.html?origem=nao-existe', armazenamento: { ...N.JA_VISITOU, 'navi-perfil': 'geral' } });
    await page.waitForURL(u => !/mapa\.html/.test(u.pathname));
    await expect(page.getByRole('heading', { level: 1, name: 'Para onde você vai?' })).toBeVisible();
    await expect(page.getByText('Escolha para onde você vai.')).toBeVisible();
  });
});

test.describe('Preferências lembradas (RN06, RN07, RN41)', () => {
  test('tema de alto contraste e texto a 150% continuam ao recarregar', async ({ page }) => {
    await N.abrir(page, { armazenamento: N.JA_VISITOU });
    await page.getByRole('button', { name: 'Preferências' }).click();
    const dlg = page.getByRole('dialog', { name: 'Preferências' });
    await dlg.getByRole('radio', { name: /^Alto contraste/ }).check();
    await dlg.getByRole('radio', { name: /^150%/ }).check();
    await dlg.getByRole('button', { name: 'Fechar preferências' }).click();
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/contraste/);
    await expect(page.locator('html')).toHaveAttribute('data-texto', '150');
    await page.getByRole('button', { name: 'Preferências' }).click();
    await expect(page.getByRole('radio', { name: /^Alto contraste/ })).toBeChecked();
  });

  test('RN41 — o texto chega a 200% (F6 corrigida)', async ({ page }) => {
    await N.abrir(page, { armazenamento: N.JA_VISITOU });
    const base = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    await page.getByRole('button', { name: 'Preferências' }).click();
    await page.getByRole('dialog', { name: 'Preferências' }).getByRole('radio', { name: /^200%/ }).check();
    const maior = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    expect(maior / base).toBeGreaterThanOrEqual(2);
  });

  test('tema "Cores distintas" (daltonismo) é um tema do mesmo site', async ({ page }) => {
    await N.abrir(page, { armazenamento: N.JA_VISITOU });
    await page.getByRole('button', { name: 'Preferências' }).click();
    await page.getByRole('dialog', { name: 'Preferências' }).getByRole('radio', { name: /^Cores distintas/ }).check();
    await expect(page.locator('html')).toHaveClass(/daltonismo/);
    await expect(page.locator('html')).not.toHaveClass(/contraste/);
  });

  test('RN07 — "Apagar minhas preferências" volta ao padrão e mantém os avisos', async ({ page }) => {
    const avisos = JSON.stringify([{ lugar: 'PCT_P01_L0003', tipo: 'obstaculo', detalhe: '', criado: '2026-10-27T10:00:00.000Z' }]);
    await N.abrir(page, { armazenamento: { ...N.JA_VISITOU, 'navi-perfil': 'visual', 'navi-tema': 'contraste', 'navi-avisos': avisos } });
    await page.getByRole('button', { name: 'Preferências' }).click();
    await page.getByRole('button', { name: 'Apagar minhas preferências' }).click();
    await expect(N.dialogoVoz(page)).toBeVisible(); // volta a ser a primeira visita
    expect(await page.evaluate(() => [localStorage.getItem('navi-tema'), localStorage.getItem('navi-perfil'), localStorage.getItem('navi-avisos')]))
      .toEqual([null, null, avisos]);
  });
});
