// Gestos do TalkBack dentro do Navi (RN76): 1 toque lê, 2 toques ativam, deslizar muda de item.
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const N = require('../apoio/navi');

const GESTOS = path.join(__dirname, '..', '..', 'site-acessivel', 'js', 'leitor-gestos.js');
const COM_VOZ = { 'navi-boas-vindas': '1', 'navi-voz': '1' };

test.use({ hasTouch: true });

async function ligarGestos(page) {
  if (!(await page.evaluate(() => !!window.NaviGestos))) await page.addScriptTag({ path: GESTOS });
  await page.evaluate(() => {
    window.__falas = [];
    window.__g = window.NaviGestos.criar({ voz: { falar: t => { window.__falas.push(t); return true; } }, sons: false });
    window.__g.ligar();
  });
}
const falas = page => page.evaluate(() => window.__falas.slice());
const ultimaFala = page => page.evaluate(() => window.__falas[window.__falas.length - 1] || '');
async function centro(loc) { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }

async function tocar(page, loc) { const c = await centro(loc); await page.touchscreen.tap(c.x, c.y); }
async function tocarDuasVezes(page, loc) { const c = await centro(loc); await page.touchscreen.tap(c.x, c.y); await page.touchscreen.tap(c.x, c.y); }
async function deslizar(page, dx, { x = 180, y = 320 } = {}) {
  const c = await page.context().newCDPSession(page);
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 4; i++) await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 4, y }] });
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await c.detach();
}

test.describe('Gestos do TalkBack (RN76)', () => {
  test.beforeEach(async ({}, info) => { test.skip(info.project.name !== 'celular', 'gestos são de tela de toque'); });

  test('1 toque lê "Preferências, botão" e não abre; 2 toques abrem; retângulo verde em volta', async ({ page }) => {
    await N.abrir(page, { armazenamento: COM_VOZ });
    await ligarGestos(page);
    const pref = page.locator('#btn-preferencias');
    await tocar(page, pref);
    await expect.poll(() => ultimaFala(page)).toBe('Preferências, botão');
    await expect(page.getByRole('dialog', { name: /preferências/i })).toBeHidden();
    const anel = page.locator('.foco-gestos');
    await expect(anel).toBeVisible();
    const [a, b] = [await anel.boundingBox(), await pref.boundingBox()];
    expect(a.x).toBeLessThanOrEqual(b.x); expect(a.y).toBeLessThanOrEqual(b.y);
    expect(a.x + a.width).toBeGreaterThanOrEqual(b.x + b.width); expect(a.y + a.height).toBeGreaterThanOrEqual(b.y + b.height);
    await tocarDuasVezes(page, pref);
    await expect(page.getByRole('dialog', { name: /preferências/i })).toBeVisible();
  });

  test('deslizar para a direita e a esquerda percorre os itens na ordem; no fim, o item fica', async ({ page }) => {
    await N.abrir(page, { armazenamento: COM_VOZ });
    await ligarGestos(page);
    const esperado = await page.evaluate(() => {
      const l = window.NaviGestos.itensDeLeitura();
      window.__g.selecionar(l[0]);
      return l.slice(0, 3).map(el => window.NaviGestos.descrever(el));
    });
    await page.evaluate(() => { window.__falas = []; });
    await deslizar(page, 120);
    await deslizar(page, 120);
    expect(await falas(page)).toEqual([esperado[1], esperado[2]]);
    await deslizar(page, -120);
    expect(await ultimaFala(page)).toBe(esperado[1]);
    // no último item, deslizar para a direita não muda nada
    const ultimo = await page.evaluate(() => { const l = window.NaviGestos.itensDeLeitura(); window.__g.selecionar(l[l.length - 1]); window.__falas = []; return l.length; });
    await deslizar(page, 120);
    expect(await falas(page)).toEqual([]);
    expect(await page.evaluate(n => window.__g.atual() === window.NaviGestos.itensDeLeitura()[n - 1], ultimo)).toBe(true);
  });

  test('com uma janela aberta, deslizar só passa por itens dentro dela', async ({ page }) => {
    await N.abrir(page, { armazenamento: COM_VOZ });
    await ligarGestos(page);
    await tocar(page, page.locator('#btn-preferencias'));
    await expect.poll(() => ultimaFala(page)).toBe('Preferências, botão');
    await tocarDuasVezes(page, page.locator('#btn-preferencias'));
    const dlg = page.getByRole('dialog', { name: /preferências/i });
    await expect(dlg).toBeVisible();
    for (let i = 0; i < 6; i++) {
      await deslizar(page, 120);
      expect(await page.evaluate(() => !!(window.__g.atual() && window.__g.atual().closest('dialog[open]')))).toBe(true);
    }
  });

  test('descrever: nome, tipo e estado', async ({ page }) => {
    await N.abrir(page, { armazenamento: COM_VOZ });
    await ligarGestos(page);
    const r = await page.evaluate(() => {
      const caixa = document.createElement('div');
      caixa.innerHTML = `
        <button id="d1" aria-pressed="true">Voz</button>
        <label for="d2">Destino</label><input id="d2" value="Sala">
        <div role="tab" id="d3" aria-selected="true">Pendentes</div>
        <h2 id="d4">Passo a passo</h2>
        <button id="d5" disabled>Mapa 3D</button>
        <a id="d6" href="adm.html">Área ADM</a>
        <img id="d7" alt="Logo" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">
        <button id="d8" aria-expanded="false">Mais opções</button>`;
      document.body.appendChild(caixa);
      const d = id => window.NaviGestos.descrever(document.getElementById(id));
      return ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8'].map(d);
    });
    expect(r).toEqual([
      'Voz, botão de alternância, ativado',
      'Destino, campo de edição, Sala',
      'Pendentes, aba, selecionado',
      'Passo a passo, título nível 2',
      'Mapa 3D, botão, indisponível',
      'Área ADM, link',
      'Logo, imagem',
      'Mais opções, botão, recolhido'
    ]);
  });

  test('2 toques no campo de busca: o campo fica focado e dá para digitar', async ({ page }) => {
    await N.abrir(page, { armazenamento: COM_VOZ });
    await N.opcaoPerfil(page, 'Sem adaptações').press('Enter'); // com a voz ligada, o teclado escolhe direto
    await ligarGestos(page);
    const campo = N.campoBusca(page);
    await tocar(page, campo);
    await expect.poll(() => ultimaFala(page)).toMatch(/campo de edição/);
    await tocarDuasVezes(page, campo);
    await expect(campo).toBeFocused();
    await page.keyboard.type('reuni');
    await expect(campo).toHaveValue('reuni');
  });

  test('se o item selecionado some da página, o próximo deslize recomeça do primeiro item', async ({ page }) => {
    await N.abrir(page, { armazenamento: COM_VOZ });
    await ligarGestos(page);
    const primeiro = await page.evaluate(() => {
      const b = document.createElement('button'); b.textContent = 'Temporário'; document.querySelector('main').appendChild(b);
      window.__g.selecionar(b); b.remove(); window.__falas = [];
      return window.NaviGestos.descrever(window.NaviGestos.itensDeLeitura()[0]);
    });
    const erros = [];
    page.on('pageerror', e => erros.push(e.message));
    await deslizar(page, 120);
    expect(await falas(page)).toEqual([primeiro]);
    expect(erros).toEqual([]);
  });

  test('com os gestos desligados, 1 toque funciona como sempre', async ({ page }) => {
    await N.abrir(page, { armazenamento: COM_VOZ });
    await ligarGestos(page);
    await page.evaluate(() => window.__g.desligar());
    await expect(page.locator('.foco-gestos')).toHaveCount(0);
    await tocar(page, page.locator('#btn-preferencias'));
    await expect(page.getByRole('dialog', { name: /preferências/i })).toBeVisible();
  });
});
