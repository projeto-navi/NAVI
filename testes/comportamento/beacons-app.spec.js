// App Android: painel de beacons e "Você está perto de" (RN71–RN74 propostas), com o Bluetooth falso.
const { test, expect } = require('@playwright/test');
const N = require('../apoio/navi');
const { scriptInit } = require('../apoio/bluetooth-falso');

const GERAL = { ...N.JA_VISITOU, 'navi-perfil': 'geral' };
const PROCURANDO = { ...GERAL, 'navi-beacons': '1' };
const ATE_SALA_DE_REUNIAO = 'mapa.html?origem=PCT_P01_L0001&destino=PCT_P02_L0007';
const cartao = page => page.locator('#beacons-area');
const escaneando = page => page.waitForFunction(() => window.__bleFalso && window.__bleFalso.estado().escaneando);
// o app aceita no máximo uma leitura por beacon a cada 0,5 s: as leituras vêm espaçadas, como num beacon real
async function emitir(page, minor, rssi = -59, vezes = 2) {
  for (let i = 0; i < vezes; i++) {
    if (i) await page.waitForTimeout(550);
    await page.evaluate(([m, r]) => window.__bleFalso.emitirBeacon(m, r), [minor, rssi]);
  }
}
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
    await page.waitForTimeout(1200);
    await expect(faixa(page)).toBeHidden();
    await emitir(page, 7, -45); // bem mais perto da Sala de reunião do que da Entrada
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

test.describe('App: localizador automático e "Você está aqui"', () => {
  const faixa = page => page.locator('#beacons-faixa');
  const bolinha = page => page.locator('svg.mapa-svg .marca-posicao');

  test('ao traçar a rota, a busca liga sozinha (sem tocar em nada)', async ({ page }) => {
    await page.addInitScript(scriptInit({}));
    await N.abrir(page, { caminho: ATE_SALA_DE_REUNIAO, armazenamento: GERAL });
    await escaneando(page);
  });

  test('se a pessoa desligou ("Parar de procurar"), não religa sozinha', async ({ page }) => {
    await page.addInitScript(scriptInit({}));
    await N.abrir(page, { caminho: ATE_SALA_DE_REUNIAO, armazenamento: { ...GERAL, 'navi-beacons': '0' } });
    await expect(N.tituloDaRota(page)).toBeVisible();
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.__bleFalso.estado().escaneando)).toBe(false);
    await expect(faixa(page)).toBeHidden();
  });

  test('Bluetooth desligado ao traçar a rota: faixa com "Ativar", que liga e começa a busca', async ({ page }) => {
    await page.addInitScript(scriptInit({ bluetooth: false }));
    await N.abrir(page, { caminho: ATE_SALA_DE_REUNIAO, armazenamento: GERAL });
    await expect(faixa(page)).toContainText('Para mostrar onde você está no mapa, ative o Bluetooth e a localização.');
    await faixa(page).getByRole('button', { name: 'Ativar' }).click();
    expect(await chamou(page, 'requestEnable')).toBe(true);
    await escaneando(page);
    await expect(faixa(page)).toBeHidden();
  });

  test('bolinha vermelha "Você está aqui" no lugar do beacon e só no andar dele', async ({ page }) => {
    await page.addInitScript(scriptInit({}));
    await N.abrir(page, { caminho: ATE_SALA_DE_REUNIAO, armazenamento: GERAL });
    await escaneando(page);
    await emitir(page, 5); // Rampa, 1º andar
    await expect(bolinha(page)).toHaveCount(1);
    await expect(bolinha(page)).toContainText('Você está aqui');
    const id = await page.evaluate(() => document.querySelector('svg.mapa-svg .marca-posicao').dataset.id);
    expect(id).toBe('PCT_P01_L0011');
    // com a bolinha, a partida deixa de dizer "Você:" (a pessoa não está mais lá)
    await expect(page.locator('svg.mapa-svg g.marca-origem')).toContainText('Partida: Entrada principal');
    await expect(page.locator('svg.mapa-svg')).not.toContainText('Você: Entrada principal');
    await emitir(page, 6, -45); // Elevador 1, 2º andar: o mapa está no 1º
    await expect(bolinha(page)).toHaveCount(0);
    await expect(faixa(page)).toContainText('Você está perto de: Elevador 1 (2º andar)');
  });

  test('no 3D, a bolinha e o rótulo "Você está aqui" também aparecem', async ({ page }, info) => {
    test.skip(info.project.name !== 'computador', 'o 3D é conferido uma vez');
    await page.addInitScript(scriptInit({}));
    await N.abrir(page, { caminho: ATE_SALA_DE_REUNIAO, armazenamento: GERAL });
    await escaneando(page);
    await emitir(page, 5);
    await expect(bolinha(page)).toHaveCount(1);
    await page.getByRole('button', { name: 'Mapa 3D' }).click();
    await expect(page.locator('.rotulo3d.posicao')).toHaveText('Você está aqui', { timeout: 15000 });
    expect(await page.evaluate(() => window.NaviMapaPagina.mapa().posicao)).toBe('PCT_P01_L0011');
  });

  test('a bolinha some quando o beacon deixa de ser ouvido', async ({ page }) => {
    await page.addInitScript(scriptInit({}));
    await N.abrir(page, { caminho: ATE_SALA_DE_REUNIAO, armazenamento: GERAL });
    await escaneando(page);
    await emitir(page, 5);
    await expect(bolinha(page)).toHaveCount(1);
    await expect(bolinha(page)).toHaveCount(0, { timeout: 12000 });
  });

  test('enxurrada de leituras: a tela muda poucas vezes e nada trava', async ({ page }) => {
    await page.addInitScript(scriptInit({}));
    const erros = [];
    await N.abrir(page, { caminho: '', armazenamento: PROCURANDO, erros });
    await escaneando(page);
    await page.evaluate(() => {
      window.__mudancas = 0;
      new MutationObserver(ms => { window.__mudancas += ms.length; }).observe(document.getElementById('beacons-area'), { childList: true, subtree: true });
    });
    const t0 = Date.now();
    await page.evaluate(() => { for (let i = 0; i < 2000; i++) window.__bleFalso.emitirBeacon(1 + (i % 8), -70); });
    expect(Date.now() - t0).toBeLessThan(1500);
    await page.waitForTimeout(2500);
    expect(await page.evaluate(() => window.__mudancas)).toBeLessThan(40);
    expect(N.errosReais(erros)).toEqual([]);
  });

  test('no app, com a Voz ligada, o aviso "perto de" também é falado (RN78)', async ({ page }) => {
    await page.addInitScript(scriptInit({}));
    await page.addInitScript(() => {
      window.__falas = 0;
      const falsa = { speak() { window.__falas++; }, cancel() {}, pause() {}, resume() {}, getVoices: () => [], speaking: false, pending: false, paused: false, addEventListener() {}, onvoiceschanged: null };
      Object.defineProperty(window, 'speechSynthesis', { value: falsa, configurable: true });
      window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    });
    await N.abrir(page, { caminho: '', armazenamento: { ...PROCURANDO, 'navi-voz': '1' } });
    await escaneando(page);
    const antes = await page.evaluate(() => window.__falas);
    await emitir(page, 2);
    await expect(cartao(page).getByText('Você está perto de: Elevador 1 (1º andar)')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__falas)).toBeGreaterThan(antes);
  });
});

test.describe('App: tela Beacons por perto — diagnóstico', () => {
  test('mostra a versão do app e quantas leituras chegaram', async ({ page }) => {
    await page.addInitScript(scriptInit({}));
    await N.abrir(page, { caminho: 'beacons.html', armazenamento: PROCURANDO });
    await escaneando(page);
    await emitir(page, 2, -59, 3);
    await expect(page.getByText(/^Versão do app: /)).toBeVisible();
    await expect(page.getByText(/^Leituras recebidas: [1-9]/)).toBeVisible({ timeout: 4000 });
  });
});
