// App Android: painel de beacons e "Você está perto de" (RN71–RN74 propostas), com o Bluetooth falso.
const { test, expect } = require('@playwright/test');
const N = require('../apoio/navi');
const { scriptInit } = require('../apoio/bluetooth-falso');

const GERAL = { ...N.JA_VISITOU, 'navi-perfil': 'geral' };
const PROCURANDO = { ...GERAL, 'navi-beacons': '1' };
const ATE_SALA_DE_REUNIAO = 'mapa.html?origem=PCT_P01_L0001&destino=PCT_P02_L0007';
const cartao = page => page.locator('#beacons-area');
const escaneando = page => page.waitForFunction(() => window.__bleFalso && window.__bleFalso.estado().escaneando);
const emitir = (page, minor, rssi = -59, vezes = 2) => page.evaluate(([m, r, v]) => { for (let i = 0; i < v; i++) window.__bleFalso.emitirBeacon(m, r); }, [minor, rssi, vezes]);
const chamou = (page, nome) => page.evaluate(n => window.__bleFalso.chamadas.some(c => c.nome === n), nome);

async function abrirPainel(page) {
  await page.getByRole('button', { name: 'Encontrar onde você está' }).click();
  await expect(cartao(page).getByText('O Navi usa o Bluetooth e a localização do celular só para perceber os beacons do prédio. Nada sai do seu celular.')).toBeVisible();
}

test.describe('App: beacons na Página de Rota', () => {
  test('no navegador comum nada novo aparece e não há erros', async ({ page }) => {
    const erros = [];
    await N.abrir(page, { caminho: '', armazenamento: GERAL, erros });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(cartao(page)).toBeEmpty();
    await page.locator('#btn-preferencias').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Beacons por perto' })).toHaveCount(0);
    expect(N.errosReais(erros)).toEqual([]);
  });

  test('Bluetooth desligado: "Ligar o Bluetooth" e "Começar a procurar" desativado até ligar', async ({ page }) => {
    await page.addInitScript(scriptInit({ bluetooth: false }));
    await N.abrir(page, { caminho: '', armazenamento: GERAL });
    await abrirPainel(page);
    const comecar = cartao(page).getByRole('button', { name: 'Começar a procurar' });
    await expect(comecar).toBeDisabled();
    await cartao(page).getByRole('button', { name: 'Ligar o Bluetooth' }).click();
    expect(await chamou(page, 'requestEnable')).toBe(true);
    await expect(cartao(page).getByText('Ligado', { exact: true })).toBeVisible();
    await expect(comecar).toBeEnabled();
  });

  test('perto do Elevador 1: o cartão mostra e "Sair daqui" preenche a partida', async ({ page }) => {
    await page.addInitScript(scriptInit({}));
    await N.abrir(page, { caminho: '', armazenamento: GERAL });
    await abrirPainel(page);
    await cartao(page).getByRole('button', { name: 'Começar a procurar' }).click();
    await escaneando(page);
    await expect(cartao(page).getByRole('button', { name: 'Parar de procurar' })).toBeVisible();
    await emitir(page, 2);
    await expect(cartao(page).getByText('Você está perto de: Elevador 1 (1º andar)')).toBeVisible();
    await cartao(page).getByRole('button', { name: 'Sair daqui' }).click();
    await expect(page).toHaveURL(/index\.html\?origem=PCT_P01_L0007$/);
    await expect(page.getByRole('main')).toContainText('Elevador 1');
  });

  test('permissão negada: explica como permitir nas configurações', async ({ page }) => {
    await page.addInitScript(scriptInit({ permissao: 'negada' }));
    await N.abrir(page, { caminho: '', armazenamento: GERAL });
    await abrirPainel(page);
    await cartao(page).getByRole('button', { name: 'Permitir' }).click();
    await expect(cartao(page).getByText(/Configurações → Apps → Navi → Permissões/)).toBeVisible();
    await expect(cartao(page).getByRole('button', { name: 'Começar a procurar' })).toBeDisabled();
  });

  test('Bluetooth desligado no meio da busca: pausa e oferece religar', async ({ page }) => {
    await page.addInitScript(scriptInit({}));
    await N.abrir(page, { caminho: '', armazenamento: PROCURANDO });
    await escaneando(page);
    await page.evaluate(() => window.__bleFalso.definir({ bluetooth: false }));
    await expect(cartao(page).getByText('O Bluetooth foi desligado. A busca está pausada.')).toBeVisible({ timeout: 7000 });
    await expect(cartao(page).getByRole('button', { name: 'Ligar o Bluetooth' })).toBeVisible();
  });

  test('a 360 px: sem rolagem lateral e botões com 48 px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.addInitScript(scriptInit({ bluetooth: false, localizacao: false }));
    await N.abrir(page, { caminho: '', armazenamento: GERAL });
    await abrirPainel(page);
    await N.semRolagemLateral(page);
    const pequenos = await cartao(page).locator('button').evaluateAll(bs => bs.filter(b => b.offsetParent).map(b => b.getBoundingClientRect()).filter(r => r.height < 47.5 || r.width < 47.5).length);
    expect(pequenos).toBe(0);
  });

  test('no app, as Preferências têm o link "Beacons por perto"', async ({ page }) => {
    await page.addInitScript(scriptInit({}));
    await N.abrir(page, { caminho: '', armazenamento: GERAL });
    await page.locator('#btn-preferencias').click();
    await expect(page.getByRole('link', { name: 'Beacons por perto' })).toHaveAttribute('href', 'beacons.html');
  });
});

test.describe('App: beacons na Página do Mapa', () => {
  const faixa = page => page.locator('#beacons-faixa');

  test('perto da Rampa: faixa e "Recalcular daqui" troca a partida', async ({ page }) => {
    await page.addInitScript(scriptInit({}));
    await N.abrir(page, { caminho: ATE_SALA_DE_REUNIAO, armazenamento: PROCURANDO });
    await escaneando(page);
    await emitir(page, 5);
    await expect(faixa(page)).toContainText('Você está perto de: Rampa (1º andar)');
    await faixa(page).getByRole('button', { name: 'Recalcular daqui' }).click();
    await expect(page).toHaveURL(/mapa\.html\?origem=PCT_P01_L0011&destino=PCT_P02_L0007$/);
  });

  test('perto do destino: "Você chegou", sem botão; perto da partida: nenhuma faixa', async ({ page }) => {
    await page.addInitScript(scriptInit({}));
    await N.abrir(page, { caminho: ATE_SALA_DE_REUNIAO, armazenamento: PROCURANDO });
    await escaneando(page);
    await emitir(page, 1);
    await page.waitForTimeout(300);
    await expect(faixa(page)).toBeHidden();
    await emitir(page, 1, -95, 12); // afasta da Entrada
    await emitir(page, 7);
    await expect(faixa(page)).toContainText('Você chegou: Sala de reunião');
    await expect(faixa(page).getByRole('button')).toHaveCount(0);
  });
});

test.describe('App: tela Beacons por perto', () => {
  const lista = page => page.getByRole('list', { name: 'Beacons por perto' });

  test('lista os beacons percebidos, cadastrados ou não, e copia os números', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.addInitScript(scriptInit({}));
    await N.abrir(page, { caminho: 'beacons.html', armazenamento: PROCURANDO });
    await expect(page.getByRole('heading', { level: 1, name: 'Beacons por perto' })).toBeVisible();
    await escaneando(page);
    await emitir(page, 2, -59);
    await emitir(page, 99, -70);
    await expect(lista(page).getByRole('listitem')).toHaveCount(2);
    const elevador = lista(page).getByRole('listitem').filter({ hasText: 'Elevador 1' });
    await expect(elevador).toContainText('minor 2');
    await expect(elevador).toContainText('Sinal: -59 dBm');
    await expect(elevador).toContainText('Distância: ~1,0 m');
    await expect(lista(page).getByRole('listitem').filter({ hasText: 'minor 99' })).toContainText('não cadastrado');
    await page.getByRole('button', { name: 'Copiar números' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Números copiados' })).toBeVisible();
    const copiado = await page.evaluate(() => navigator.clipboard.readText());
    expect(copiado.trim().split('\n')).toEqual([
      'FDA50693-A4E2-4FB1-AFCF-C6EB07647825,1,2,-59',
      'FDA50693-A4E2-4FB1-AFCF-C6EB07647825,1,99,-70'
    ]);
  });

  test('com a busca desligada, oferece "Começar a procurar"', async ({ page }) => {
    await page.addInitScript(scriptInit({}));
    await N.abrir(page, { caminho: 'beacons.html', armazenamento: GERAL });
    await page.getByRole('button', { name: 'Começar a procurar' }).click();
    await escaneando(page);
    await emitir(page, 3);
    await expect(lista(page)).toContainText('Recepção');
  });

  test('fora do app: avisa que a tela é só do app', async ({ page }) => {
    await N.abrir(page, { caminho: 'beacons.html', armazenamento: GERAL });
    await expect(page.getByText('Esta tela funciona só no app do Navi.')).toBeVisible();
    await expect(page.getByRole('link', { name: /Voltar ao Navi/ })).toHaveAttribute('href', 'index.html');
  });
});
