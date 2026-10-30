// Ajudantes compartilhados pelos testes de comportamento (duas páginas: Rota e Mapa).
// Regra: localizar por papel e nome acessível (getByRole), nunca por classe CSS.
const { expect } = require('@playwright/test');

const LOCAL = /^(127\.0\.0\.1|localhost)$/;

/**
 * Abre o site com a rede externa bloqueada (VLibras vira resposta vazia).
 * A maior parte dos testes de comportamento usa o Shopping Estação, que deixou de ser o local padrão
 * (o padrão agora é o prédio de testes): sem caminho, abre ?local=shopping-estacao.
 */
async function abrir(page, { caminho = '?local=shopping-estacao', armazenamento = {}, erros } = {}) {
  await page.route(url => !LOCAL.test(url.hostname), rota => rota.fulfill({ status: 200, body: '' }));
  if (Object.keys(armazenamento).length) {
    await page.addInitScript(itens => {
      // só na primeira carga: recarregar não deve apagar o que o site salvou
      if (sessionStorage.getItem('__navi_teste_init')) return;
      sessionStorage.setItem('__navi_teste_init', '1');
      for (const [k, v] of Object.entries(itens)) localStorage.setItem(k, v);
    }, armazenamento);
  }
  if (erros) {
    page.on('pageerror', e => erros.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
  }
  await page.goto(caminho);
}

/** Visita que já respondeu à pergunta de voz (não é a primeira). */
const JA_VISITOU = { 'navi-boas-vindas': '1', 'navi-voz': '0' };

const dialogoVoz = page => page.getByRole('dialog', { name: /voz/i });

/** Responde à pergunta de abertura sobre a voz. */
async function responderVoz(page, sim = false) {
  const d = dialogoVoz(page);
  await expect(d).toBeVisible();
  await d.getByRole('button', { name: sim ? 'Sim' : 'Não', exact: true }).click();
  await expect(d).toBeHidden();
}

const opcaoPerfil = (page, nome) => page.getByRole('button', { name: new RegExp('^' + nome) });
async function escolherPerfil(page, nome) { await opcaoPerfil(page, nome).click(); }

/** Campo de busca do destino ou da partida (Página de Rota). */
const campoBusca = page => page.getByRole('searchbox', { name: /buscar/i });

/** Busca um lugar e toca no resultado com esse nome. */
async function buscarEEscolher(page, termo, nomeResultado = termo) {
  await campoBusca(page).fill(termo);
  await page.getByRole('button', { name: new RegExp('^' + nomeResultado, 'i') }).first().click();
}

/** Botão de uma entrada (ex.: "Acesso Azul — ver a rota"). */
const botaoEntrada = (page, nome) => page.getByRole('button', { name: new RegExp('^' + nome) }).first();

const DESTINO_PISO_2 = { termo: 'atelier', nome: 'Atelier de Costura' };

/**
 * Do zero até a Página do Mapa: voz, perfil, destino e entrada.
 * Conta os toques a partir da tela "Para onde você vai?" (digitar não conta).
 */
async function planejarRota(page, { perfil = 'Mobilidade reduzida', destino = DESTINO_PISO_2, entrada = 'Acesso Azul', armazenamento = {} } = {}) {
  await abrir(page, { armazenamento });
  await responderVoz(page, false);
  await escolherPerfil(page, perfil);
  await expect(page.getByRole('heading', { level: 1, name: 'Para onde você vai?' })).toBeVisible();
  let toques = 0;
  await campoBusca(page).fill(destino.termo);
  await page.getByRole('button', { name: new RegExp('^' + destino.nome) }).first().click(); toques++;
  await expect(page.getByRole('heading', { level: 1, name: /Por qual entrada/ })).toBeVisible();
  await botaoEntrada(page, entrada).click(); toques++;
  await page.waitForURL(/mapa\.html/);
  await expect(tituloDaRota(page)).toBeVisible();
  return toques;
}

/** Título da Página do Mapa ("Rota até …"). */
const tituloDaRota = page => page.getByRole('heading', { level: 1, name: /^Rota até / });
/** Painel do passo a passo (é o conteúdo principal da Página do Mapa). */
const painel = page => page.getByRole('main');
/** Texto todo do painel, numa linha. */
async function textoDoPainel(page) { return (await painel(page).innerText()).replace(/\s+/g, ' '); }
/** Alça do painel (só existe no celular em pé): "Mostrar mais…", "Mostrar as opções do passo a passo", "Recolher…". */
const alca = page => page.getByRole("button", { name: /^(Mostrar|Recolher) .*passo a passo/ });

/** Abre o painel até o estado expandido (no computador ele já é um painel lateral inteiro). */
async function expandirPainel(page) {
  const a = alca(page);
  if (!(await a.isVisible())) return;
  for (let i = 0; i < 3 && !/Recolher/.test(await a.getAttribute('aria-label') || await a.innerText()); i++) {
    await a.click();
    await page.waitForTimeout(350);
  }
}

/** Abre a lista com todos os passos (no painel ela fica recolhida atrás de "Ver todos os passos"). */
async function verTodosOsPassos(page) {
  await expandirPainel(page);
  const ver = page.getByRole('button', { name: /^Ver todos os passos/ });
  // sem mapa (ex.: tela pequena com texto grande), a lista já é a página e não há botão
  if (!(await ver.count())) { await expect(page.getByRole('heading', { name: 'Passo a passo' })).toBeVisible(); return; }
  if ((await ver.getAttribute('aria-expanded')) !== 'true') await ver.click();
  await expect(ver).toHaveAttribute('aria-expanded', 'true');
  await page.waitForTimeout(350); // a lista abre com uma transição curta
}

/** Sem rolagem lateral na página. */
async function semRolagemLateral(page) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(m.sw, `largura do conteúdo ${m.sw}px > janela ${m.cw}px`).toBeLessThanOrEqual(m.cw);
}

/** Erros de console que vêm só do bloqueio de rede externa feito pelos testes ficam de fora. */
const errosReais = erros => erros.filter(e => !/vlibras|fonts\.g|Failed to load resource|ERR_INTERNET_DISCONNECTED/i.test(e));

module.exports = {
  abrir, JA_VISITOU, dialogoVoz, responderVoz, opcaoPerfil, escolherPerfil, campoBusca, buscarEEscolher, botaoEntrada,
  DESTINO_PISO_2, planejarRota, tituloDaRota, painel, textoDoPainel, alca, expandirPainel, verTodosOsPassos, semRolagemLateral, errosReais
};
