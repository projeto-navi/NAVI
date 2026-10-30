// Mapa: andares por escrito, controles com botão para cada gesto, 2D / 3D / primeira pessoa.
const { test, expect } = require('@playwright/test');
const N = require('../apoio/navi');

const ROTA_2_PISOS = 'mapa.html?perfil=mobilidade&origem=PCT_P01_L0001&destino=PCT_P02_L0007';
const comPerfil = { ...N.JA_VISITOU, 'navi-perfil': 'mobilidade', 'navi-escadas': '1' };

test.describe('Planta e andares (RN36, RN46)', () => {
  test('RN46 — o andar visível aparece por escrito e o seletor marca os andares da rota', async ({ page }) => {
    await N.abrir(page, { caminho: ROTA_2_PISOS, armazenamento: comPerfil });
    await expect(page.getByRole('note', { name: 'Andar visível no mapa' })).toContainText(/^1º andar/);
    const grupo = page.getByRole('group', { name: 'Escolher andar' });
    await expect(grupo.getByRole('button', { name: '1º andar, parte da rota' })).toHaveAttribute('aria-pressed', 'true');
    await expect(grupo.getByRole('button', { name: '3º andar' })).toHaveAttribute('aria-pressed', 'false');
    await grupo.getByRole('button', { name: '2º andar, parte da rota' }).click();
    await expect(grupo.getByRole('button', { name: '2º andar, parte da rota' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('note', { name: 'Andar visível no mapa' })).toContainText(/^2º andar/);
    await expect(page.getByRole('status').filter({ hasText: 'Mostrando o 2º andar.' })).toHaveCount(1);
    await expect(page.getByRole('img', { name: 'Planta do 2º andar do prédio' })).toBeVisible();
  });

  test('passar ao passo do outro andar troca o andar do mapa sozinho', async ({ page }) => {
    await N.abrir(page, { caminho: ROTA_2_PISOS, armazenamento: comPerfil });
    const proximo = page.getByRole('button', { name: 'Próximo' });
    const noPiso2 = async () => /Passo \d+ de \d+, 2º andar/.test(await N.painel(page).innerText());
    for (let i = 0; i < 10 && !(await noPiso2()); i++) await proximo.click();
    expect(await noPiso2()).toBe(true);
    await expect(page.getByRole('group', { name: 'Escolher andar' }).getByRole('button', { pressed: true })).toHaveAccessibleName(/^2º andar/);
  });

  test('WCAG 2.5.7 — aproximar, afastar e centralizar têm botões (não dependem de gesto)', async ({ page }) => {
    await N.abrir(page, { caminho: ROTA_2_PISOS, armazenamento: comPerfil });
    const planta = page.getByRole('img', { name: /^Planta do 1º andar/ });
    const vb = () => planta.evaluate(s => s.getAttribute('viewBox'));
    const antes = await vb();
    await page.getByRole('button', { name: 'Aproximar' }).click();
    const perto = await vb();
    expect(perto).not.toBe(antes);
    await page.getByRole('button', { name: 'Afastar' }).click();
    await page.getByRole('button', { name: 'Centralizar na rota' }).click();
    // e o teclado também move a planta
    await planta.focus();
    const v1 = await vb();
    await page.keyboard.press('ArrowRight');
    expect(await vb()).not.toBe(v1);
  });
});

test.describe('2D, 3D e primeira pessoa (RN45–RN48)', () => {
  test('RN45 — o mapa abre em 2D e o 3D só carrega quando pedido', async ({ page }) => {
    const pedidos = [];
    page.on('request', r => pedidos.push(r.url()));
    await N.abrir(page, { caminho: ROTA_2_PISOS, armazenamento: comPerfil });
    await expect(page.getByRole('img', { name: /^Planta do 1º andar/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mapa 3D' })).toHaveAttribute('aria-pressed', 'false');
    await page.waitForTimeout(500);
    expect(pedidos.some(u => /three-navi|mapa3d|glb/.test(u))).toBe(false);
  });

  test('RN47 / RN48 — rota, andar e destino continuam iguais em 2D, 3D e primeira pessoa', async ({ page }) => {
    await N.abrir(page, { caminho: ROTA_2_PISOS, armazenamento: comPerfil });
    const passos = async () => (await N.painel(page).innerText()).match(/Passo \d+ de (\d+)/)[1];
    const andarAtivo = () => page.getByRole('group', { name: 'Escolher andar' }).getByRole('button', { pressed: true });
    const total = await passos();
    await expect(andarAtivo()).toHaveAccessibleName(/^1º andar/);

    await page.getByRole('button', { name: 'Mapa 3D' }).click();
    await expect(page.getByRole('button', { name: 'Mapa 3D' })).toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 });
    await expect(andarAtivo()).toHaveAccessibleName(/^1º andar/);
    await expect(page.getByRole('heading', { level: 1, name: 'Rota até Sala de reunião' })).toBeVisible();
    expect(await passos()).toBe(total);

    await page.getByRole('group', { name: 'Opções do mapa 3D' }).getByRole('button', { name: 'Ver em primeira pessoa' }).click();
    const sair = page.getByRole('button', { name: 'Voltar ao mapa' }).first();
    await expect(sair).toBeVisible();
    await expect(page.getByText(new RegExp(`passo 1 de ${total}`))).toBeVisible();
    await sair.click();

    await page.getByRole('button', { name: 'Mapa 3D' }).click();
    await expect(page.getByRole('button', { name: 'Mapa 3D' })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('img', { name: /^Planta do 1º andar/ })).toBeVisible();
    expect(await passos()).toBe(total);
  });
});
