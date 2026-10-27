// Abertura, perfis, link direto e preferências lembradas.
const { test, expect } = require('@playwright/test');
const N = require('../apoio/navi');

test.describe('Abertura', () => {
  test('RN01 — na primeira visita a pergunta de voz aparece antes dos perfis', async ({ page }) => {
    await N.abrir(page);
    const d = N.dialogoVoz(page);
    await expect(d).toBeVisible();
    await expect(d.getByRole('button', { name: 'Sim', exact: true })).toBeVisible();
    await expect(d.getByRole('button', { name: 'Não', exact: true })).toBeVisible();
    // enquanto a pergunta está aberta, o perfil não pode ser escolhido (diálogo modal)
    const perfil = await N.opcaoPerfil(page, 'Mobilidade reduzida');
    await expect(perfil.click({ timeout: 800, trial: true })).rejects.toThrow();
    await N.responderVoz(page, false);
    await expect(await N.opcaoPerfil(page, 'Mobilidade reduzida')).toBeVisible();
  });

  // FALHA CONHECIDA (F7, nova): RN01 diz "primeira vez", mas a pergunta aparece em toda visita.
  test('RN01 — na segunda visita a pergunta de voz não aparece de novo', async ({ page }) => {
    test.fail(true, 'F7: a resposta da pergunta de voz não é guardada; ela volta a cada carregamento.');
    await N.abrir(page);
    await N.responderVoz(page, false);
    await page.reload();
    await expect(N.dialogoVoz(page)).toBeHidden({ timeout: 1500 });
  });

  // FALHA CONHECIDA (F8, nova): os cartões de perfil têm role="listitem", que apaga o papel de botão.
  test('RN30 — as opções de perfil são botões com nome para o leitor de tela', async ({ page }) => {
    test.fail(true, 'F8: <button role="listitem"> — TalkBack/NVDA anunciam "item de lista", não "botão".');
    await N.abrir(page);
    await N.responderVoz(page, false);
    for (const nome of ['Deficiência visual', 'Mobilidade reduzida', 'Deficiência auditiva']) {
      await expect(page.getByRole('button', { name: new RegExp('^' + nome) })).toBeVisible({ timeout: 1000 });
    }
  });

  test('RN02 — existe a opção de seguir sem adaptações', async ({ page }) => {
    await N.abrir(page);
    await N.responderVoz(page, false);
    await expect(page.getByRole('button', { name: /sem adaptações/i })).toBeVisible();
  });
});

test.describe('Link direto e QR Code', () => {
  test('?perfil=mobilidade&origem=1-1401928 abre com a partida no Acesso Azul', async ({ page }) => {
    await N.abrir(page, { caminho: '?perfil=mobilidade&origem=1-1401928' });
    // hoje a pergunta de voz também aparece ao abrir pelo QR Code
    if (await N.dialogoVoz(page).isVisible()) await N.responderVoz(page, false);
    await expect(page.getByRole('button', { name: /^(Onde você está|Partida): Acesso Azul/ })).toBeVisible();
    // e o perfil de mobilidade está ativo
    await expect(page.getByRole('button', { name: /Perfil atual: Mobilidade reduzida/ })).toBeVisible();
  });

  test('link com origem e destino abre com a rota calculada', async ({ page }) => {
    await N.abrir(page, { caminho: '?perfil=mobilidade&origem=1-1401928&destino=1-1401929' });
    if (await N.dialogoVoz(page).isVisible()) await N.responderVoz(page, false);
    await expect(page.getByRole('region', { name: 'Seu caminho' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^(Para onde vai|Destino): Acesso Vermelho/ })).toBeVisible();
  });
});

test.describe('Preferências lembradas (RN07)', () => {
  test('alto contraste e A+ continuam ligados ao recarregar', async ({ page }) => {
    await N.abrir(page);
    await N.responderVoz(page, false);
    const contraste = page.getByRole('button', { name: 'Alto contraste' });
    const texto = page.getByRole('button', { name: 'Aumentar texto' });
    await contraste.click();
    await texto.click();
    await expect(contraste).toHaveAttribute('aria-pressed', 'true');
    await expect(texto).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    if (await N.dialogoVoz(page).isVisible()) await N.responderVoz(page, false);
    await expect(contraste).toHaveAttribute('aria-pressed', 'true');
    await expect(texto).toHaveAttribute('aria-pressed', 'true');
  });

  // FALHA CONHECIDA (F6): A+ só chega a 125%; RN41 pede até 200%.
  test('RN41 — A+ permite chegar a 200% do tamanho do texto', async ({ page }) => {
    test.fail(true, 'F6: html.texto-grande = 125%, sem outros níveis.');
    await N.abrir(page);
    await N.responderVoz(page, false);
    const base = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    const texto = page.getByRole('button', { name: 'Aumentar texto' });
    for (let i = 0; i < 4; i++) await texto.click();
    const maior = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    expect(maior / base).toBeGreaterThanOrEqual(2);
  });
});
