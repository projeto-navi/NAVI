// Mapa: andares por escrito, controles com botão para cada gesto, 2D / 3D / primeira pessoa.
const { test, expect } = require('@playwright/test');
const N = require('../apoio/navi');

const ROTA_2_PISOS = 'mapa.html?perfil=mobilidade&origem=1-1401928&destino=2-2482766';
const comPerfil = { ...N.JA_VISITOU, 'navi-perfil': 'mobilidade', 'navi-escadas': '1' };

test.describe('Planta e andares (RN36, RN46)', () => {
  test('RN46 — o andar visível aparece por escrito e o seletor marca os andares da rota', async ({ page }) => {
    await N.abrir(page, { caminho: ROTA_2_PISOS, armazenamento: comPerfil });
    await expect(page.getByRole('note', { name: 'Andar visível no mapa' })).toContainText(/^Piso 1/);
    const grupo = page.getByRole('group', { name: 'Escolher piso' });
    await expect(grupo.getByRole('button', { name: 'Piso 1, parte da rota' })).toHaveAttribute('aria-pressed', 'true');
    await grupo.getByRole('button', { name: 'Piso 2, parte da rota' }).click();
    await expect(grupo.getByRole('button', { name: 'Piso 2, parte da rota' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('note', { name: 'Andar visível no mapa' })).toContainText(/^Piso 2/);
    await expect(page.getByRole('status').filter({ hasText: 'Mostrando o Piso 2.' })).toHaveCount(1);
    await expect(page.getByRole('img', { name: 'Planta do Piso 2 do shopping' })).toBeVisible();
  });

  test('passar ao passo do outro andar troca o andar do mapa sozinho', async ({ page }) => {
    await N.abrir(page, { caminho: ROTA_2_PISOS, armazenamento: comPerfil });
    const proximo = page.getByRole('button', { name: 'Próximo' });
    const noPiso2 = async () => /Passo \d+ de \d+, Piso 2/.test(await N.painel(page).innerText());
    for (let i = 0; i < 10 && !(await noPiso2()); i++) await proximo.click();
    expect(await noPiso2()).toBe(true);
    await expect(page.getByRole('group', { name: 'Escolher piso' }).getByRole('button', { pressed: true })).toHaveAccessibleName(/^Piso 2/);
  });

  test('WCAG 2.5.7 — aproximar, afastar e centralizar têm botões (não dependem de gesto)', async ({ page }) => {
    await N.abrir(page, { caminho: ROTA_2_PISOS, armazenamento: comPerfil });
    const planta = page.getByRole('img', { name: /^Planta do Piso 1/ });
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
    await expect(page.getByRole('img', { name: /^Planta do Piso 1/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mapa 3D' })).toHaveAttribute('aria-pressed', 'false');
    await page.waitForTimeout(500);
    expect(pedidos.some(u => /three-navi|mapa3d/.test(u))).toBe(false);
  });

  test('RN47 / RN48 — rota, andar e destino continuam iguais em 2D, 3D e primeira pessoa', async ({ page }) => {
    await N.abrir(page, { caminho: ROTA_2_PISOS, armazenamento: comPerfil });
    const passos = async () => (await N.painel(page).innerText()).match(/Passo \d+ de (\d+)/)[1];
    const andarAtivo = () => page.getByRole('group', { name: 'Escolher piso' }).getByRole('button', { pressed: true });
    const total = await passos();
    await expect(andarAtivo()).toHaveAccessibleName(/^Piso 1/);

    await page.getByRole('button', { name: 'Mapa 3D' }).click();
    await expect(page.getByRole('button', { name: 'Mapa 3D' })).toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 });
    await expect(andarAtivo()).toHaveAccessibleName(/^Piso 1/);
    await expect(page.getByRole('heading', { level: 1, name: 'Rota até Atelier de Costura' })).toBeVisible();
    expect(await passos()).toBe(total);

    await page.getByRole('group', { name: 'Opções do mapa 3D' }).getByRole('button', { name: 'Ver em primeira pessoa' }).click();
    const sair = page.getByRole('button', { name: 'Voltar ao mapa' }).first();
    await expect(sair).toBeVisible();
    await expect(page.getByText(new RegExp(`passo 1 de ${total}`))).toBeVisible();
    await sair.click();

    await page.getByRole('button', { name: 'Mapa 3D' }).click();
    await expect(page.getByRole('button', { name: 'Mapa 3D' })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('img', { name: /^Planta do Piso 1/ })).toBeVisible();
    expect(await passos()).toBe(total);
  });
});
