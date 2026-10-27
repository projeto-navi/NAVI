// Ajudantes compartilhados pelos testes de comportamento.
// Regra: localizar por papel e nome acessível. Quando o site atual não expõe o papel certo
// (falha registrada no relatório da Fase 0), o ajudante usa o texto visível como reserva,
// para o teste continuar descrevendo o COMPORTAMENTO e não a implementação.
const { expect } = require('@playwright/test');

const LOCAL = /^(127\.0\.0\.1|localhost)$/;

/** Abre o site com rede externa bloqueada (fontes e VLibras viram respostas vazias). */
async function abrir(page, { caminho = '', armazenamento = {}, erros } = {}) {
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

const dialogoVoz = page => page.getByRole('dialog', { name: /voz/i });

/** Responde à pergunta de abertura sobre a voz. */
async function responderVoz(page, sim = false) {
  const d = dialogoVoz(page);
  await expect(d).toBeVisible();
  await d.getByRole('button', { name: sim ? 'Sim' : 'Não', exact: true }).click();
  await expect(d).toBeHidden();
}

/** Opção de perfil: por papel de botão; reserva pelo texto (hoje os cartões têm role="listitem"). */
async function opcaoPerfil(page, nome) {
  const botao = page.getByRole('button', { name: new RegExp('^' + nome) });
  if (await botao.count()) return botao.first();
  return page.getByText(nome, { exact: true }).first();
}

async function escolherPerfil(page, nome) {
  await (await opcaoPerfil(page, nome)).click();
}

/** Campo de busca do destino ou da partida. */
const campoBusca = page => page.getByRole('searchbox', { name: /buscar|para onde|nome/i });

/** Busca um lugar e toca no primeiro resultado com esse nome. */
async function buscarEEscolher(page, termo, nomeResultado = termo) {
  await campoBusca(page).fill(termo);
  await page.getByRole('button', { name: new RegExp('^' + nomeResultado, 'i') }).first().click();
}

/** Botão de uma entrada do local (ex.: "Acesso Azul"). */
const botaoEntrada = (page, nome) => page.getByRole('button', { name: new RegExp('^' + nome) }).first();

/** Texto completo visível da região de rota (passo a passo ou mensagem de sem caminho). */
async function textoDaRota(page) {
  return (await page.getByRole('main').innerText()).replace(/\s+/g, ' ');
}

/** Sem rolagem lateral na página. */
async function semRolagemLateral(page) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(m.sw, `largura do conteúdo ${m.sw}px > janela ${m.cw}px`).toBeLessThanOrEqual(m.cw);
}

/** Filtra erros de console que vêm só do bloqueio de rede externa feito pelos testes. */
const errosReais = erros => erros.filter(e => !/vlibras|fonts\.g|Failed to load resource/i.test(e));

module.exports = { abrir, dialogoVoz, responderVoz, opcaoPerfil, escolherPerfil, campoBusca, buscarEEscolher, botaoEntrada, textoDaRota, semRolagemLateral, errosReais };
