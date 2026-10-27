// Fluxo até a rota, restrições de mobilidade, interdições e troca 2D / 3D / primeira pessoa.
const { test, expect } = require('@playwright/test');
const N = require('../apoio/navi');

const DESTINO_PISO_2 = { termo: 'atelier', nome: 'Atelier de Costura' };

/**
 * Planeja uma rota do jeito que a tela atual pedir, contando os toques a partir
 * da tela "Para onde você vai?" (digitar não conta como toque).
 */
async function planejarRota(page, { perfil = 'Mobilidade reduzida', destino = DESTINO_PISO_2, entrada = 'Acesso Azul' } = {}) {
  await N.abrir(page);
  await N.responderVoz(page, false);
  await N.escolherPerfil(page, perfil);
  let toques = 0;
  const paraOnde = page.getByRole('heading', { name: /para onde você (vai|quer ir)\?/i });
  await expect(paraOnde).toBeVisible();
  if (!(await N.campoBusca(page).isVisible())) {
    // computador: a tela mostra os dois campos; abre o de destino
    await page.getByRole('button', { name: /^Para onde vai/ }).click(); toques++;
  }
  await N.campoBusca(page).fill(destino.termo);
  await page.getByRole('button', { name: new RegExp('^' + destino.nome) }).first().click(); toques++;
  const perguntaEntrada = page.getByRole('heading', { name: /onde você está/i });
  if (await perguntaEntrada.isVisible().catch(() => false)) {
    await N.botaoEntrada(page, entrada).click(); toques++;
  } else {
    await page.getByRole('button', { name: /^Onde você está/ }).click(); toques++;
    await N.botaoEntrada(page, entrada).click(); toques++;
  }
  return toques;
}

test.describe('Fluxo até a rota', () => {
  test('RN56 — no celular: destino primeiro, entrada depois, no máximo 3 toques', async ({ page }, info) => {
    test.skip(info.project.name !== 'celular', 'regra do celular');
    await N.abrir(page);
    await N.responderVoz(page, false);
    await N.escolherPerfil(page, 'Mobilidade reduzida');
    // logo depois do perfil a pergunta é o DESTINO, com a busca pronta
    await expect(page.getByRole('heading', { name: 'Para onde você vai?' })).toBeVisible();
    await expect(N.campoBusca(page)).toBeVisible();
    // atalhos "mais próximo" já na tela de destino (RN57)
    await expect(page.getByRole('button', { name: 'Sanitário mais próximo' })).toBeVisible();
    let toques = 0;
    await N.campoBusca(page).fill(DESTINO_PISO_2.termo);
    await page.getByRole('button', { name: new RegExp('^' + DESTINO_PISO_2.nome) }).first().click(); toques++;
    // depois pergunta a ENTRADA
    await expect(page.getByRole('heading', { name: /onde você está/i })).toBeVisible();
    await N.botaoEntrada(page, 'Acesso Azul').click(); toques++;
    await expect(page.getByRole('region', { name: 'Seu caminho' })).toBeVisible();
    expect(toques).toBeLessThanOrEqual(3);
  });

  test('RN57 — atalho "mais próximo" sem partida pergunta a entrada e calcula sozinho', async ({ page }, info) => {
    test.skip(info.project.name !== 'celular', 'regra do celular');
    await N.abrir(page);
    await N.responderVoz(page, false);
    await N.escolherPerfil(page, 'Deficiência auditiva');
    await page.getByRole('button', { name: 'Sanitário mais próximo' }).click();
    await expect(page.getByRole('heading', { name: /onde você está/i })).toBeVisible();
    await N.botaoEntrada(page, 'Acesso Verde').click();
    await expect(page.getByRole('region', { name: 'Seu caminho' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^(Destino|Para onde vai): Sanitários/ })).toBeVisible();
  });

  test('RN13 — inverter partida e destino recalcula na hora', async ({ page }) => {
    await planejarRota(page);
    await page.getByRole('button', { name: 'Inverter origem e destino' }).click();
    await expect(page.getByRole('button', { name: /^(Partida|Onde você está): Atelier de Costura/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^(Destino|Para onde vai): Acesso Azul/ })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Seu caminho' })).toBeVisible();
  });
});

test.describe('Mobilidade e interdições', () => {
  test('RN04 / RN15 — mobilidade troca de piso pelo elevador, nunca pela escada rolante', async ({ page }) => {
    await planejarRota(page, { perfil: 'Mobilidade reduzida' });
    const rota = page.getByRole('region', { name: 'Seu caminho' });
    await expect(rota).toBeVisible();
    await expect(rota).toContainText('Sem escadas');
    await expect(rota).toContainText('Usa elevador');
    await expect(rota).not.toContainText('Usa escada rolante');
  });

  test('RN16 / RN17 — elevador interditado: sem rota sem escada e mensagem com o SAC', async ({ page }) => {
    const aviso = [{ lugar: '2-22327', tipo: 'danificado', detalhe: 'teste automático', criado: '2026-10-27T10:00:00.000Z' }];
    await page.addInitScript(a => { if (!localStorage.getItem('navi-avisos')) localStorage.setItem('navi-avisos', a); }, JSON.stringify(aviso));
    await planejarRota(page, { perfil: 'Mobilidade reduzida' });
    await expect(page.getByRole('region', { name: 'Seu caminho' })).toBeHidden();
    const texto = await N.textoDaRota(page);
    expect(texto).toMatch(/Não encontramos (um )?caminho/);
    expect(texto).toMatch(/elevador/i);
    expect(texto).toMatch(/SAC/);
    expect(texto).toMatch(/\(41\) 3094-5300/);
  });

  // FALHA CONHECIDA: texto de RN17 ainda é o antigo (regra "Parcial").
  test('RN17 — usa o texto aprovado "Não encontramos caminho acessível confirmado"', async ({ page }) => {
    test.fail(true, 'RN17 Parcial: o texto atual é "Não encontramos um caminho entre esses dois pontos sem escadas".');
    const aviso = [{ lugar: '2-22327', tipo: 'danificado', detalhe: '', criado: '2026-10-27T10:00:00.000Z' }];
    await page.addInitScript(a => { if (!localStorage.getItem('navi-avisos')) localStorage.setItem('navi-avisos', a); }, JSON.stringify(aviso));
    await planejarRota(page, { perfil: 'Mobilidade reduzida' });
    expect(await N.textoDaRota(page)).toContain('Não encontramos caminho acessível confirmado');
  });
});

test.describe('2D, 3D e primeira pessoa (RN45–RN48)', () => {
  test('RN45 — o mapa abre em 2D e o 3D só carrega quando pedido', async ({ page }) => {
    const pedidos = [];
    page.on('request', r => pedidos.push(r.url()));
    await planejarRota(page);
    await expect(page.getByRole('button', { name: 'Mapa 2D' })).toHaveAttribute('aria-pressed', 'true');
    expect(pedidos.some(u => /three-navi|mapa3d/.test(u))).toBe(false);
  });

  test('RN48 — rota, piso e destino continuam iguais em 2D, 3D e primeira pessoa', async ({ page }) => {
    await planejarRota(page);
    const rota = page.getByRole('region', { name: 'Seu caminho' });
    const resumo2d = (await rota.innerText()).match(/(\d+) passos/)[1];
    const pisoAtivo = async () => (await page.getByRole('group', { name: 'Escolher piso' }).getByRole('button', { pressed: true }).innerText()).trim();
    const piso2d = await pisoAtivo();
    const destino = page.getByRole('button', { name: /^(Destino|Para onde vai): Atelier de Costura/ });

    await page.getByRole('button', { name: 'Mapa 3D' }).click();
    await expect(page.getByRole('button', { name: 'Mapa 3D' })).toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 });
    expect(await pisoAtivo()).toBe(piso2d);
    await expect(destino).toBeVisible();
    expect((await rota.innerText()).match(/(\d+) passos/)[1]).toBe(resumo2d);

    await page.getByRole('button', { name: 'Ver em primeira pessoa' }).first().click();
    const sair = page.getByRole('button', { name: 'Voltar ao mapa' }).first();
    await expect(sair).toBeVisible();
    await expect(page.getByText(new RegExp(`passo 1 de ${resumo2d}`))).toBeVisible();
    await sair.click();

    await page.getByRole('button', { name: 'Mapa 2D' }).click();
    await expect(page.getByRole('button', { name: 'Mapa 2D' })).toHaveAttribute('aria-pressed', 'true');
    await expect(destino).toBeVisible();
    expect((await rota.innerText()).match(/(\d+) passos/)[1]).toBe(resumo2d);
  });
});
