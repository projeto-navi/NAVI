// Gestos do TalkBack dentro do Navi (RN76): 1 toque lê, 2 toques ativam, deslizar muda de item.
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const N = require('../apoio/navi');

const GESTOS = path.join(__dirname, '..', '..', 'site-acessivel', 'js', 'leitor-gestos.js');
const COM_VOZ = { 'navi-boas-vindas': '1', 'navi-voz': '1' };
const SEM_VOZ = { 'navi-boas-vindas': '1', 'navi-voz': '0' }; // a página não liga os próprios gestos; o teste liga os seus

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
  for (let i = 1; i <= 2; i++) await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 2, y }] });
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await c.detach();
}

test.describe('Gestos do TalkBack (RN76)', () => {
  test.beforeEach(async ({}, info) => { test.skip(info.project.name !== 'celular', 'gestos são de tela de toque'); });

  test('1 toque lê "Preferências, botão" e não abre; 2 toques abrem; retângulo verde em volta', async ({ page }) => {
    await N.abrir(page, { armazenamento: SEM_VOZ });
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
    await N.abrir(page, { armazenamento: SEM_VOZ });
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
    await N.abrir(page, { armazenamento: SEM_VOZ });
    await ligarGestos(page);
    await tocar(page, page.locator('#btn-preferencias'));
    await expect.poll(() => ultimaFala(page)).toBe('Preferências, botão');
    await tocarDuasVezes(page, page.locator('#btn-preferencias'));
    const dlg = page.getByRole('dialog', { name: /preferências/i });
    await expect(dlg).toBeVisible();
    for (let i = 0; i < 6; i++) {
      await deslizar(page, 120);
      expect(await page.evaluate(() => { const a = window.__g.atual(); return !!(a && a.closest('dialog[open]')); })).toBe(true);
    }
  });

  test('descrever: nome, tipo e estado', async ({ page }) => {
    await N.abrir(page, { armazenamento: SEM_VOZ });
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
    await N.abrir(page, { armazenamento: SEM_VOZ });
    await N.escolherPerfil(page, 'Sem adaptações');
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
    await N.abrir(page, { armazenamento: SEM_VOZ });
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
    await N.abrir(page, { armazenamento: SEM_VOZ });
    await ligarGestos(page);
    await page.evaluate(() => window.__g.desligar());
    await expect(page.locator('.foco-gestos')).toHaveCount(0);
    await tocar(page, page.locator('#btn-preferencias'));
    await expect(page.getByRole('dialog', { name: /preferências/i })).toBeVisible();
  });
});

/* ---------- nas páginas do Navi (Tarefa 4) ---------- */
const TUTORIAL = 'Toque uma vez para ouvir um item, toque duas vezes para ativar e deslize para a direita para ir ao próximo.';
// voz do navegador falsa: guarda cada frase em window.__falas
function vozFalsa() {
  window.__falas = [];
  const falsa = { speaking: false, pending: false, paused: false, speak(u) { window.__falas.push(u.text); setTimeout(() => u.onend && u.onend(), 0); },
    cancel() {}, pause() {}, resume() {}, getVoices: () => [], addEventListener() {}, onvoiceschanged: null };
  Object.defineProperty(window, 'speechSynthesis', { value: falsa, configurable: true });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
}
// TalkBack do celular falso (plugin ScreenReader do app)
function talkbackFalso(ligado) {
  window.__tb = { ligado, ouvinte: null };
  window.Capacitor = { isNativePlatform: () => true, Plugins: { ScreenReader: {
    isEnabled: async () => ({ value: window.__tb.ligado }),
    addListener: async (ev, fn) => { if (ev === 'stateChange') window.__tb.ouvinte = fn; return { remove() {} }; }
  } } };
}
const ROTA = 'mapa.html?perfil=geral&origem=PCT_P01_L0001&destino=PCT_P02_L0007';
async function doisDedos(page, de, ate) {
  const c = await page.context().newCDPSession(page);
  const pts = (x, y) => [{ x, y, id: 1 }, { x: x + 60, y, id: 2 }];
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: de.x, y: de.y, id: 1 }] });
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(de.x, de.y) });
  for (let i = 1; i <= 5; i++) await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(de.x + (ate.x - de.x) * i / 5, de.y + (ate.y - de.y) * i / 5) });
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await c.detach();
}

test.describe('Voz e gestos nas páginas (RN76, RN77, RN78)', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'celular', 'gestos são de tela de toque');
    await page.addInitScript(vozFalsa);
  });

  test('primeira visita: Sim fala o tutorial e liga os gestos; 1 toque num perfil só lê', async ({ page }) => {
    await N.abrir(page);
    await tocar(page, N.dialogoVoz(page).getByRole('button', { name: 'Sim', exact: true }));
    await expect.poll(() => ultimaFala(page)).toContain(TUTORIAL);
    expect(await ultimaFala(page)).toMatch(/^Voz ligada\. /);
    await tocar(page, N.opcaoPerfil(page, 'Deficiência visual'));
    await expect.poll(() => ultimaFala(page)).toMatch(/^Deficiência visual, botão/);
    await expect(page.getByRole('heading', { level: 1, name: /Como você prefere/ })).toBeVisible();
    await tocarDuasVezes(page, N.opcaoPerfil(page, 'Deficiência visual'));
    await expect(N.campoBusca(page)).toBeVisible();
  });

  test('Preferências: "Ouvir como usar os gestos" fala o tutorial; desligar a Voz desliga os gestos', async ({ page }) => {
    await N.abrir(page, { armazenamento: COM_VOZ });
    const pref = page.locator('#btn-preferencias');
    await tocar(page, pref); await page.waitForTimeout(350);
    await tocarDuasVezes(page, pref);
    const dlg = page.getByRole('dialog', { name: /preferências/i });
    await expect(dlg).toBeVisible();
    const tutorial = dlg.getByRole('button', { name: 'Ouvir como usar os gestos' });
    await tocar(page, tutorial); await page.waitForTimeout(350);
    await tocarDuasVezes(page, tutorial);
    await expect.poll(() => ultimaFala(page)).toContain(TUTORIAL);
    const sw = dlg.getByRole('switch', { name: 'Ouvir as instruções em voz alta' });
    await tocar(page, sw); await page.waitForTimeout(350);
    await tocarDuasVezes(page, sw);
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('.foco-gestos')).toHaveCount(0);
    await expect(tutorial).toBeHidden();
    // sem gestos, 1 toque volta a funcionar direto
    await tocar(page, sw);
    await expect(sw).toHaveAttribute('aria-checked', 'true');
  });

  test('mapa: 2 dedos movem a planta; 1 toque num lugar lê "nome, andar"; 2 toques abrem o cartão', async ({ page }) => {
    await N.abrir(page, { caminho: ROTA, armazenamento: { ...COM_VOZ, 'navi-perfil': 'geral' } });
    const planta = page.getByRole('img', { name: /^Planta do 1º andar/ });
    await expect(planta).toBeVisible();
    // 2 dedos arrastam a planta para cima (a folha do passo a passo cobre a parte de baixo)
    const vb = () => planta.evaluate(s => s.getAttribute('viewBox'));
    const antes = await vb();
    await doisDedos(page, { x: 120, y: 200 }, { x: 120, y: 80 });
    await expect.poll(vb).not.toBe(antes);
    const alvo = await page.evaluate(() => {
      const { G } = window.NaviMapaPagina;
      const alca = document.querySelector('.folha-alca');
      const limite = alca ? alca.getBoundingClientRect().top - 8 : innerHeight;
      for (const f of document.querySelectorAll('svg.mapa-svg .loja-forma[data-id], svg.mapa-svg .icone-mapa[data-id]')) {
        const r = f.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2;
        if (r.width < 12 || r.height < 12 || x < 10 || y < 60 || x > innerWidth - 10 || y > limite) continue;
        const topo = document.elementFromPoint(x, y);
        if (!topo || !topo.closest('svg.mapa-svg')) continue;
        const l = G.lugarPorId[f.dataset.id];
        if (!l || l.id === window.NaviMapaPagina.st.destino.id || l.id === window.NaviMapaPagina.st.origem.id) continue;
        return { x, y, texto: `${l.nome}, ${G.nomeDoAndar(l.piso)}`, nome: l.nome };
      }
      return null;
    });
    expect(alvo).not.toBeNull();
    await page.touchscreen.tap(alvo.x, alvo.y);
    await expect.poll(() => ultimaFala(page)).toBe(alvo.texto);
    await expect(page.locator('#dlg-lugar')).toBeHidden();
    await page.touchscreen.tap(alvo.x, alvo.y); await page.touchscreen.tap(alvo.x, alvo.y);
    const cartao = page.locator('#dlg-lugar');
    await expect(cartao).toBeVisible();
    await expect(cartao.getByRole('heading', { name: alvo.nome })).toBeVisible();
  });

  test('TalkBack do celular ligado: o Navi não fala nem intercepta toques, e avisa uma vez', async ({ page }) => {
    await page.addInitScript(talkbackFalso, true);
    await N.abrir(page, { armazenamento: COM_VOZ });
    await expect(page.locator('#anuncio')).toHaveText('O TalkBack do celular está ligado. O Navi deixa a leitura com ele.');
    await page.evaluate(() => { window.__falas = []; });
    await tocar(page, page.locator('#btn-preferencias'));
    await expect(page.getByRole('dialog', { name: /preferências/i })).toBeVisible();
    expect(await falas(page)).toEqual([]);
    await page.keyboard.press('Escape');
    // TalkBack desligado → voz e gestos voltam
    await page.evaluate(() => window.__tb.ouvinte({ value: false }));
    await tocar(page, page.locator('#btn-preferencias'));
    await expect.poll(() => ultimaFala(page)).toBe('Preferências, botão');
    await expect(page.getByRole('dialog', { name: /preferências/i })).toBeHidden();
  });

  test('no app, a pergunta da primeira visita é falada pela voz do Android', async ({ page }) => {
    await page.addInitScript(() => {
      window.__tts = [];
      window.Capacitor = { isNativePlatform: () => true, Plugins: { TextToSpeech: {
        speak: async o => { window.__tts.push(o); }, stop: async () => {}
      } } };
    });
    await N.abrir(page);
    await expect.poll(() => page.evaluate(() => window.__tts.map(o => o.text).join(' | '))).toContain('Deseja ouvir as instruções em voz alta?');
    const o = await page.evaluate(() => window.__tts[0]);
    expect(o).toMatchObject({ lang: 'pt-BR', rate: 1, queueStrategy: 0 });
    expect(await page.evaluate(() => window.__falas)).toEqual([]);
  });
});

test.describe('Computador: voz e Tab (RN76)', () => {
  test.use({ hasTouch: false });
  test('com a Voz ligada, Tab lê o item focado no formato "nome, tipo"', async ({ page }, info) => {
    test.skip(info.project.name !== 'computador', 'teclado do computador');
    await page.addInitScript(vozFalsa);
    await N.abrir(page, { armazenamento: COM_VOZ });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect.poll(() => ultimaFala(page)).toBe('Pular para o conteúdo, link');
    expect(await page.evaluate(() => !!document.querySelector('.foco-gestos'))).toBe(false);
  });
});
