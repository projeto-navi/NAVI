// Prédio comercial de testes (kaizen): local padrão do site, piso tátil (RN64) e elevador/rampa (RN65).
const { test, expect } = require('@playwright/test');
const N = require('../apoio/navi');

const CEGO = { ...N.JA_VISITOU, 'navi-perfil': 'visual', 'navi-piso-tatil': '1' };
const CADEIRA = { ...N.JA_VISITOU, 'navi-perfil': 'mobilidade', 'navi-escadas': '1' };
const ATE_SALA_DE_REUNIAO = 'mapa.html?origem=PCT_P01_L0001&destino=PCT_P02_L0007';
const resumo = page => page.getByRole('main').getByText(/^\d+ passos/).first();

test.describe('Prédio de testes', () => {
  test('é o local padrão: sem ?local=, a busca encontra as salas do prédio', async ({ page }) => {
    await N.abrir(page, { caminho: '', armazenamento: { ...N.JA_VISITOU, 'navi-perfil': 'geral' } });
    await expect(page.getByRole('heading', { level: 1, name: 'Para onde você vai?' })).toBeVisible();
    await N.campoBusca(page).fill('reuni');
    await expect(page.getByRole('button', { name: /^Sala de reunião/ }).first()).toBeVisible();
  });

  test('é o único mapa: ?local=shopping-estacao abre o prédio', async ({ page }) => {
    await N.abrir(page, { caminho: 'mapa.html?local=shopping-estacao&origem=PCT_P01_L0001&destino=PCT_P01_L0003', armazenamento: CADEIRA });
    await expect(page.getByRole('heading', { level: 1, name: 'Rota até Loja A' })).toBeVisible();
  });

  test('começa sem avisos de interdição', async ({ page }) => {
    await N.abrir(page, { caminho: ATE_SALA_DE_REUNIAO, armazenamento: CADEIRA });
    await expect(N.tituloDaRota(page)).toBeVisible();
    expect(await page.evaluate(() => (window.naviLocal('predio-teste').avisos || []).length)).toBe(0);
  });

  test('RN64 — com "Preferir piso tátil", sobe pela Escada B, que tem braille', async ({ page }) => {
    await N.abrir(page, { caminho: ATE_SALA_DE_REUNIAO, armazenamento: CEGO });
    await expect(N.tituloDaRota(page)).toBeVisible();
    await expect(resumo(page)).toContainText('pela escada');
    await N.verTodosOsPassos(page);
    await expect(page.getByRole('main')).toContainText('Pegue a Escada B e suba para o 2º andar. O corrimão tem braille.');
  });

  test('RN64 — a preferência aparece em Preferências e muda a rota na hora', async ({ page }) => {
    await N.abrir(page, { caminho: ATE_SALA_DE_REUNIAO, armazenamento: { ...N.JA_VISITOU, 'navi-perfil': 'geral' } });
    await expect(resumo(page)).toContainText('pelo elevador');
    await N.expandirPainel(page);
    await page.getByRole('button', { name: /^Preferências/ }).filter({ visible: true }).first().click();
    await page.getByRole('switch', { name: /Preferir piso tátil e braille/ }).click();
    await page.keyboard.press('Escape');
    await expect(resumo(page)).toContainText('pela escada');
    expect(await page.evaluate(() => localStorage.getItem('navi-piso-tatil'))).toBe('1');
  });

  test('RN65 — mobilidade reduzida: elevador; com os dois elevadores avisados como danificados, a rampa', async ({ page }) => {
    await N.abrir(page, { caminho: ATE_SALA_DE_REUNIAO, armazenamento: CADEIRA });
    await expect(resumo(page)).toContainText('pelo elevador');
    for (const elevador of ['Elevador 1', 'Elevador 2']) {
      await N.expandirPainel(page);
      await page.getByRole('button', { name: /^Avisar sobre um local/ }).filter({ visible: true }).first().click();
      const d = page.getByRole('dialog');
      const novo = d.getByRole('button', { name: 'Avisar sobre outro local' });
      if (await novo.isVisible()) await novo.click();
      await d.getByRole('searchbox').fill(elevador);
      await d.getByRole('button', { name: new RegExp('^' + elevador) }).first().click();
      await d.getByRole('radio', { name: /^Danificado/ }).check();
      await d.getByRole('button', { name: 'Registrar aviso' }).click();
      await expect(d.getByRole('heading', { name: /Agora avise/ })).toBeVisible();
      await page.keyboard.press('Escape');
    }
    await expect(resumo(page)).toContainText('pela rampa');
  });

  test('RN65 — até o 3º andar: elevador até o 2º e rampa até o 3º', async ({ page }) => {
    await N.abrir(page, { caminho: 'mapa.html?origem=PCT_P01_L0001&destino=PCT_P03_L0001', armazenamento: CADEIRA });
    await expect(resumo(page)).toContainText('pelo elevador e pela rampa');
  });

  test('RN17/RN65 — rampa interditada e destino no 3º andar: diz que a rota sem escadas depende da rampa', async ({ page }) => {
    const rampa = JSON.stringify([{ lugar: 'PCT_P02_L0012', tipo: 'interditado', detalhe: 'teste automático', criado: '2026-10-29T10:00:00.000Z' }]);
    await N.abrir(page, { caminho: 'mapa.html?origem=PCT_P01_L0001&destino=PCT_P03_L0001', armazenamento: { ...CADEIRA, 'navi-avisos': rampa } });
    await expect(page.getByRole('main')).toContainText('A rampa está com aviso de interdição ou defeito, e a rota sem escadas depende dela.');
  });

  test('3D do modelo: abre o .glb do prédio sem erros', async ({ page }, info) => {
    test.skip(info.project.name !== 'computador', 'uma vez basta');
    const erros = [];
    await N.abrir(page, { caminho: ATE_SALA_DE_REUNIAO, armazenamento: CEGO, erros });
    await expect(N.tituloDaRota(page)).toBeVisible();
    const glb = page.waitForResponse(r => /locais\/predio-teste\/modelo\.glb$/.test(r.url()) && r.ok());
    await page.getByRole('button', { name: 'Mapa 3D' }).click();
    await glb;
    await expect(page.getByRole('region', { name: 'Mapa' }).getByRole('button', { name: /Ver em primeira pessoa/ })).toBeVisible();
    await page.waitForTimeout(1500);
    expect(N.errosReais(erros)).toEqual([]);
  });
});
