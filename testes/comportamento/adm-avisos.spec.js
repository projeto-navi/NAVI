// Avisos compartilhados pelo servidor e Área ADM (RN66–RN70), com o Supabase simulado.
const { test, expect } = require('@playwright/test');
const N = require('../apoio/navi');
const { simularSupabase } = require('../apoio/supabase-falso');

// o service worker serviria os arquivos do cache, por fora das rotas do simulador
test.use({ serviceWorkers: 'block' });

const CADEIRA = { ...N.JA_VISITOU, 'navi-perfil': 'mobilidade', 'navi-escadas': '1' };
const ATE_SALA_DE_REUNIAO = 'mapa.html?origem=PCT_P01_L0001&destino=PCT_P02_L0007';
const ELEVADOR_1 = 'PCT_P01_L0007', ELEVADOR_2 = 'PCT_P01_L0008';
const resumo = page => page.getByRole('main').getByText(/^\d+ passos/).first();
const ENVIADO = 'Aviso enviado à equipe do Navi. Ele já vale neste aparelho e passa a valer para todos quando um ADM confirmar.';
const NA_FILA = 'Sem internet: o aviso será enviado quando a conexão voltar.';

async function avisar(page, lugar, tipo = /^Danificado/) {
  await N.expandirPainel(page);
  await page.getByRole('button', { name: /^Avisar sobre um local/ }).filter({ visible: true }).first().click();
  const d = page.getByRole('dialog');
  const novo = d.getByRole('button', { name: 'Avisar sobre outro local' });
  if (await novo.isVisible()) await novo.click();
  await d.getByRole('searchbox').fill(lugar);
  await d.getByRole('button', { name: new RegExp('^' + lugar) }).first().click();
  await d.getByRole('radio', { name: tipo }).check();
  await d.getByRole('button', { name: 'Registrar aviso' }).click();
  await expect(d.getByRole('heading', { name: /Agora avise/ })).toBeVisible();
  return d;
}

test.describe('Avisos compartilhados (parte pública)', () => {
  test('registrar um aviso chega ao servidor como pendente, sem nada sobre quem avisou', async ({ page, context }) => {
    const sim = await simularSupabase(context);
    await N.abrir(page, { caminho: ATE_SALA_DE_REUNIAO, armazenamento: CADEIRA });
    const d = await avisar(page, 'Elevador 1');
    await expect(d.getByText(ENVIADO)).toBeVisible();
    await expect.poll(() => sim.avisos.length).toBe(1);
    expect(sim.avisos[0]).toMatchObject({ local: 'predio-teste', lugar: ELEVADOR_1, tipo: 'danificado', situacao: 'pendente' });
    const enviado = sim.pedidos.find(p => p.metodo === 'POST' && p.caminho === '/rest/v1/avisos');
    expect(Object.keys(enviado.corpo).sort()).toEqual(['detalhe', 'local', 'lugar', 'tipo']);
    // os canais de antes continuam
    await expect(d.getByRole('button', { name: 'Copiar o texto do aviso' })).toBeVisible();
    await expect(d.getByRole('heading', { name: 'Seus avisos neste aparelho' })).toBeVisible();
    await expect(d.getByText('Aguardando confirmação', { exact: true })).toBeVisible();
  });

  test('os dois elevadores confirmados como danificados: a rota de mobilidade vai pela rampa', async ({ page, context }) => {
    const sim = await simularSupabase(context);
    sim.confirmar(ELEVADOR_1, 'danificado');
    sim.confirmar(ELEVADOR_2, 'danificado');
    await N.abrir(page, { caminho: ATE_SALA_DE_REUNIAO, armazenamento: CADEIRA });
    await expect(resumo(page)).toContainText('pela rampa');
    // na próxima visita, a cópia guardada já vale antes da resposta do servidor
    sim.offline = true;
    await page.reload();
    await expect(resumo(page)).toContainText('pela rampa');
  });

  test('confirmado depois que a página abriu: a rota é recalculada sozinha ao chegar a resposta', async ({ page, context }) => {
    const sim = await simularSupabase(context);
    let liberar;
    const espera = new Promise(r => { liberar = r; });
    await context.route(u => u.hostname === 'teste.supabase.co' && u.searchParams.get('situacao') === 'eq.confirmado', async r => { await espera; await r.fallback(); });
    await N.abrir(page, { caminho: ATE_SALA_DE_REUNIAO, armazenamento: CADEIRA });
    await expect(resumo(page)).toContainText('pelo elevador');
    sim.confirmar(ELEVADOR_1, 'danificado');
    sim.confirmar(ELEVADOR_2, 'danificado');
    liberar();
    await expect(resumo(page)).toContainText('pela rampa');
  });

  test('um aviso meu confirmado pela equipe aparece como "Confirmado pela equipe"', async ({ page, context }) => {
    const sim = await simularSupabase(context);
    await N.abrir(page, { caminho: ATE_SALA_DE_REUNIAO, armazenamento: CADEIRA });
    await avisar(page, 'Elevador 1');
    await expect.poll(() => sim.avisos.length).toBe(1);
    sim.avisos[0].situacao = 'confirmado';
    sim.avisos[0].decidido_em = new Date().toISOString();
    await page.reload();
    await N.expandirPainel(page);
    await page.getByRole('button', { name: /^Avisar sobre um local/ }).filter({ visible: true }).first().click();
    const d = page.getByRole('dialog');
    await expect(d.getByRole('heading', { name: 'Avisos confirmados pela equipe' })).toBeVisible();
    await expect(d.getByText('Confirmado pela equipe', { exact: true })).toBeVisible();
  });

  test('servidor com erro 500: a rota aparece e o aviso fica guardado para depois', async ({ page, context }) => {
    const sim = await simularSupabase(context);
    sim.falhar = 500;
    const erros = [];
    await N.abrir(page, { caminho: ATE_SALA_DE_REUNIAO, armazenamento: CADEIRA, erros });
    await expect(resumo(page)).toContainText('pelo elevador');
    const d = await avisar(page, 'Elevador 1');
    await expect(d.getByText(NA_FILA)).toBeVisible();
    expect(N.errosReais(erros).filter(e => !/500/.test(e))).toEqual([]);
  });

  test('sem internet: o aviso entra na fila e é enviado quando a página abre com conexão', async ({ page, context }) => {
    const sim = await simularSupabase(context);
    sim.offline = true;
    await N.abrir(page, { caminho: ATE_SALA_DE_REUNIAO, armazenamento: CADEIRA });
    const d = await avisar(page, 'Rampa', /^Interditado/);
    await expect(d.getByText(NA_FILA)).toBeVisible();
    expect(sim.avisos).toHaveLength(0);
    sim.offline = false;
    await page.reload();
    await expect.poll(() => sim.avisos.length).toBe(1);
    expect(sim.avisos[0]).toMatchObject({ tipo: 'interditado', situacao: 'pendente' });
    await page.reload();
    await expect(resumo(page)).toBeVisible();
    expect(sim.avisos).toHaveLength(1); // não reenvia
  });

  test('sem servidor configurado: o aviso funciona como antes, só neste aparelho', async ({ page }) => {
    await N.abrir(page, { caminho: ATE_SALA_DE_REUNIAO, armazenamento: CADEIRA });
    const d = await avisar(page, 'Elevador 1');
    await expect(d.getByText(/Aviso registrado/)).toBeVisible();
    await expect(d.getByText(/Até lá, ele vale só neste aparelho/)).toBeVisible();
    await expect(d.getByText(ENVIADO)).toHaveCount(0);
    await expect(d.getByText('Aguardando confirmação')).toHaveCount(0);
  });

  test('Página de Rota: link "Área ADM" no rodapé', async ({ page }) => {
    await N.abrir(page, { caminho: '', armazenamento: { ...N.JA_VISITOU, 'navi-perfil': 'geral' } });
    const link = page.getByRole('contentinfo').getByRole('link', { name: 'Área ADM' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'adm.html');
  });
});

test.describe('Área ADM — entrar, sair e cadastrar ADM', () => {
  async function entrar(page, usuario = 'naviadm', senha = '12345678') {
    await page.getByRole('textbox', { name: 'Usuário' }).fill(usuario);
    await page.getByLabel('Senha', { exact: true }).fill(senha);
    await page.getByRole('button', { name: 'Entrar' }).click();
  }
  const titulo = (page, nome) => page.getByRole('heading', { level: 1, name: nome });

  test('senha errada mostra o erro e não abre o painel', async ({ page, context }) => {
    await simularSupabase(context);
    await N.abrir(page, { caminho: 'adm.html' });
    await expect(titulo(page, 'Entrar na Área ADM')).toBeVisible();
    await entrar(page, 'naviadm', 'errada123');
    await expect(page.getByRole('alert')).toContainText('Usuário ou senha incorretos.');
    await expect(titulo(page, 'Avisos')).toHaveCount(0);
  });

  test('naviadm / 12345678 abre o painel; recarregar mantém a sessão; Sair volta ao login', async ({ page, context }) => {
    await simularSupabase(context);
    await N.abrir(page, { caminho: 'adm.html' });
    await entrar(page);
    await expect(titulo(page, 'Avisos')).toBeVisible();
    await expect(page.getByRole('banner')).toContainText('naviadm');
    await page.reload();
    await expect(titulo(page, 'Avisos')).toBeVisible();
    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(titulo(page, 'Entrar na Área ADM')).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('navi-adm-sessao'))).toBeNull();
    await page.reload();
    await expect(titulo(page, 'Entrar na Área ADM')).toBeVisible();
  });

  test('cadastrar um ADM: aparece na lista e entra com a senha dele; repetir avisa que já existe', async ({ page, context }) => {
    const sim = await simularSupabase(context);
    await N.abrir(page, { caminho: 'adm.html' });
    await entrar(page);
    const lista = page.getByRole('list', { name: 'ADMs cadastrados' });
    await expect(lista).toContainText('naviadm');
    const form = page.getByRole('form', { name: 'Novo ADM' });
    const preencher = async (u, s1, s2 = s1) => {
      await form.getByRole('textbox', { name: 'Usuário' }).fill(u);
      await form.getByLabel('Senha', { exact: true }).fill(s1);
      await form.getByLabel('Confirmar senha').fill(s2);
      await form.getByRole('button', { name: 'Cadastrar ADM' }).click();
    };
    await preencher('maria', 'senha-forte', 'senha-errada');
    await expect(form.getByRole('alert')).toContainText('As senhas não são iguais.');
    await preencher('maria', '1234567');
    await expect(form.getByRole('alert')).toContainText('A senha precisa ter pelo menos 8 caracteres.');
    expect(sim.adms).toHaveLength(1);
    await preencher('maria', 'senha-forte');
    await expect(lista).toContainText('maria');
    await expect(page.getByRole('status').filter({ hasText: 'maria' }).first()).toContainText('ADM maria cadastrado');
    expect(sim.adms.map(a => a.usuario)).toEqual(['naviadm', 'maria']);
    await preencher('maria', 'outra-senha');
    await expect(form.getByRole('alert')).toContainText('Esse usuário já existe.');
    // a nova ADM entra com a própria senha
    await page.getByRole('button', { name: 'Sair' }).click();
    await entrar(page, 'maria', 'senha-forte');
    await expect(titulo(page, 'Avisos')).toBeVisible();
  });

  test('sessão vencida: volta ao login com o aviso', async ({ page, context }) => {
    const sim = await simularSupabase(context);
    await N.abrir(page, { caminho: 'adm.html' });
    await entrar(page);
    await expect(titulo(page, 'Avisos')).toBeVisible();
    sim.sessaoExpirada = true;
    await page.reload();
    await expect(titulo(page, 'Entrar na Área ADM')).toBeVisible();
    await expect(page.getByText('Sua sessão terminou. Entre de novo.')).toBeVisible();
  });

  test('sem internet: avisa que a Área ADM precisa de conexão', async ({ page, context }) => {
    const sim = await simularSupabase(context);
    sim.offline = true;
    await N.abrir(page, { caminho: 'adm.html' });
    await entrar(page);
    await expect(page.getByRole('alert')).toContainText('Sem internet. A Área ADM precisa de conexão.');
  });

  test('sem servidor configurado: explica e não mostra o formulário', async ({ page }) => {
    await N.abrir(page, { caminho: 'adm.html' });
    await expect(page.getByText('O servidor do Navi ainda não foi configurado.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Voltar ao Navi/ })).toHaveAttribute('href', 'index.html');
  });
});
