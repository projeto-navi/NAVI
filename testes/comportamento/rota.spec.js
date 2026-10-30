// Da Página de Rota até a Página do Mapa, regras do passo a passo, mobilidade e interdições.
const { test, expect } = require('@playwright/test');
const N = require('../apoio/navi');

// os dois elevadores e a rampa com aviso: o 2º andar fica sem caminho sem escada
const SEM_ELEVADOR_NEM_RAMPA = JSON.stringify(['PCT_P01_L0007', 'PCT_P01_L0008', 'PCT_P01_L0011']
  .map(lugar => ({ lugar, tipo: 'danificado', detalhe: 'teste automático', criado: '2026-10-30T10:00:00.000Z' })));

test.describe('Fluxo até o mapa (RN56, RN57, RN61)', () => {
  test('RN56 — destino primeiro, entrada depois, no máximo 3 toques até a Página do Mapa', async ({ page }) => {
    const toques = await N.planejarRota(page);
    expect(toques).toBeLessThanOrEqual(3);
    expect(page.url()).toMatch(/mapa\.html\?/);
    await expect(page.getByRole('heading', { level: 1, name: 'Rota até Sala de reunião' })).toBeVisible();
    // a Página do Mapa não tem barra de pesquisa
    await expect(page.getByRole('searchbox')).toHaveCount(0);
  });

  test('RN61 — digitar e mover o foco na lista nunca troca de página', async ({ page }) => {
    await N.abrir(page, { armazenamento: { ...N.JA_VISITOU, 'navi-perfil': 'geral' } });
    await N.campoBusca(page).fill('reuni');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    expect(page.url()).not.toMatch(/mapa\.html/);
    // o botão que decide a rota avisa no nome
    await page.getByRole('button', { name: /^Sala de reunião/ }).first().click();
    await expect(page.getByRole('button', { name: 'Entrada principal — ver a rota' })).toBeVisible();
  });

  test('RN57 — "mais próximo" sem partida pergunta a entrada e calcula sozinho', async ({ page }) => {
    await N.abrir(page, { armazenamento: { ...N.JA_VISITOU, 'navi-perfil': 'auditiva' } });
    await page.getByRole('button', { name: 'Sanitário acessível' }).click();
    await expect(page.getByRole('heading', { level: 1, name: /Por qual entrada/ })).toBeVisible();
    await N.botaoEntrada(page, N.ENTRADA).click();
    await page.waitForURL(/mapa\.html/);
    await expect(page.getByRole('heading', { level: 1, name: /^Rota até Sanitário acessível/ })).toBeVisible();
  });

  test('Voltar do mapa leva à etapa anterior da Página de Rota', async ({ page }) => {
    await N.planejarRota(page);
    await page.getByRole('link', { name: 'Voltar' }).click();
    await expect(page.getByRole('heading', { level: 1, name: /Por qual entrada/ })).toBeVisible();
  });
});

test.describe('Página do Mapa: passo a passo (RN25, RN35, RN42)', () => {
  test('RN35 — ao abrir, foco no título e um anúncio "Rota calculada: N passos. Passo 1: …"', async ({ page }) => {
    await N.planejarRota(page);
    await expect(N.tituloDaRota(page)).toBeFocused();
    await expect(page.getByRole('status').filter({ hasText: /^Rota calculada: \d+ passos\. Passo 1: / })).toHaveCount(1);
  });

  test('RN25 / RN42 — Anterior, Próximo e Repetir no painel; o foco fica no botão', async ({ page }) => {
    await N.planejarRota(page);
    const proximo = page.getByRole('button', { name: 'Próximo' });
    const anterior = page.getByRole('button', { name: 'Anterior' });
    await expect(anterior).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('button', { name: 'Repetir' })).toBeVisible();
    await expect(N.painel(page)).toContainText(/Passo 1 de \d+/);
    await proximo.click();
    await expect(N.painel(page)).toContainText(/Passo 2 de \d+/);
    await expect(proximo).toBeFocused();
    await expect(page.getByRole('status').filter({ hasText: /^Passo 2 de \d+: / })).toHaveCount(1);
    await anterior.click();
    await expect(N.painel(page)).toContainText(/Passo 1 de \d+/);
  });

  test('RN20 — a rota inteira existe só em texto, passo a passo', async ({ page }) => {
    await N.planejarRota(page);
    await N.expandirPainel(page);
    // a lista inteira fica recolhida: o painel mostra o passo atual; um botão abre todos
    const ver = page.getByRole('button', { name: /^Ver todos os passos/ });
    await expect(ver).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('button', { name: /^Passo 2/ })).toHaveCount(0);
    await ver.click();
    await expect(ver).toHaveAttribute('aria-expanded', 'true');
    const lista = page.getByRole('list').filter({ has: page.getByRole('button', { name: /^Passo 1/ }) });
    await expect(lista.getByRole('button', { name: /^Passo \d/ }).first()).toBeVisible();
    expect(await lista.getByRole('button').count()).toBeGreaterThan(2);
  });

  test('RN19 — selo "Rota demonstrativa, não verificada no local" com a data da planta', async ({ page }) => {
    await N.planejarRota(page);
    await N.expandirPainel(page);
    await expect(N.painel(page)).toContainText('Rota demonstrativa, não verificada no local.');
    await expect(N.painel(page)).toContainText('29/10/2026');
  });

  test('RN54 — aviso de que o Navi não serve para emergências', async ({ page }) => {
    await N.planejarRota(page);
    await N.expandirPainel(page);
    await expect(N.painel(page)).toContainText('Não use o Navi em emergências.');
  });

  test('painel inferior: alça com aria-expanded, três estados e Esc recolhe', async ({ page }, info) => {
    test.skip(info.project.name !== 'celular', 'no computador o painel fica à esquerda, sem estados');
    await N.planejarRota(page);
    const a = N.alca(page);
    await expect(a).toHaveAttribute('aria-expanded', 'false');
    await a.click();
    await expect(a).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('heading', { name: 'Próximos passos' })).toBeVisible();
    await a.click();
    await expect(a).toHaveAccessibleName('Recolher o passo a passo');
    await expect(page.getByRole('button', { name: 'Recalcular' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(a).toHaveAttribute('aria-expanded', 'false');
    await expect(a).toBeFocused();
    // recolhido: o que fica abaixo da borda da tela sai do alcance do foco (inert, WCAG 2.4.11)
    const recalcular = page.getByRole('button', { name: 'Recalcular' });
    await expect(recalcular).not.toBeInViewport();
    expect(await recalcular.evaluate(e => !!e.closest('[inert]'))).toBe(true);
  });

  test('computador: o passo a passo fica num painel à esquerda, inteiro', async ({ page }, info) => {
    test.skip(info.project.name !== 'computador', 'layout do computador');
    await N.planejarRota(page);
    await expect(N.alca(page)).toBeHidden();
    await expect(page.getByRole('button', { name: /^Ver todos os passos/ })).toBeVisible();
    const box = await N.painel(page).boundingBox();
    expect(box.x).toBeLessThan(10);
    expect(box.width).toBeLessThanOrEqual(401);
  });

  test('"Esconder mapa" deixa só o passo a passo, em tela cheia', async ({ page }) => {
    await N.planejarRota(page);
    await N.expandirPainel(page);
    await page.getByRole('button', { name: /^Esconder mapa/ }).click();
    await expect(page.getByRole('region', { name: 'Mapa' })).toBeHidden();
    await expect(page.getByRole('button', { name: /^Mostrar mapa/ }).first()).toBeVisible();
    // sem mapa, a lista é a página: todos os passos à vista, sem botão para abrir
    await expect(page.getByRole('heading', { name: 'Passo a passo' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Passo 2/ })).toBeVisible();
  });
});

test.describe('Trocar a rota na Página do Mapa (RN09, RN10, RN13)', () => {
  test('RN13 — inverter partida e destino recalcula na hora', async ({ page }) => {
    await N.planejarRota(page);
    await N.expandirPainel(page);
    await page.getByRole('button', { name: 'Inverter partida e destino' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Rota até Entrada principal' })).toBeVisible();
    expect(page.url()).toMatch(/mapa\.html/);
  });

  test('RN10 — tocar num lugar abre o cartão com "Ir para cá"; o destino troca ali mesmo', async ({ page }) => {
    await N.planejarRota(page, { destino: { termo: 'loja a', nome: 'Loja A' } });
    await N.expandirPainel(page);
    // a lista de lugares do andar é a alternativa em texto ao toque no mapa (RN36)
    await page.getByText(/^Lugares do 1º andar/).click();
    await page.getByRole('button', { name: /^Loja B\b/ }).click();
    const cartao = page.getByRole('dialog', { name: 'Loja B' });
    await expect(cartao).toBeVisible();
    await cartao.getByRole('button', { name: 'Ir para cá' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Rota até Loja B' })).toBeVisible();
    expect(page.url()).toMatch(/mapa\.html.*destino=PCT_P01_L0004/);
  });

  test('RN10 — o toque na planta também abre o cartão (sem trocar de página)', async ({ page }) => {
    await N.planejarRota(page, { destino: { termo: 'loja a', nome: 'Loja A' } });
    const ponto = await page.evaluate(() => {
      const area = document.getElementById('mapa-area').getBoundingClientRect();
      const cobertos = ['mapa-topo', 'mapa-info', 'mapa-controles', 'conteudo'].map(id => document.getElementById(id).getBoundingClientRect());
      const livre = (x, y) => x > area.left && x < area.right && y > area.top && y < area.bottom && !cobertos.some(r => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
      for (const n of document.querySelectorAll('.loja-forma.clicavel')) {
        const r = n.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
        if (r.width > 14 && r.height > 14 && livre(x, y) && document.elementFromPoint(x, y) === n) return { x, y };
      }
      return null;
    });
    expect(ponto, 'algum lugar visível na planta').not.toBeNull();
    await page.mouse.click(ponto.x, ponto.y);
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Ir para cá' })).toBeVisible();
    expect(page.url()).toMatch(/mapa\.html/);
  });
});

test.describe('Mobilidade e interdições (RN04, RN15, RN16, RN17)', () => {
  test('RN04 / RN15 — com mobilidade, a troca de andar é pelo elevador, nunca pela escada', async ({ page }) => {
    await N.planejarRota(page, { perfil: 'Mobilidade reduzida' });
    await expect(N.painel(page)).toContainText('pelo elevador');
    await N.verTodosOsPassos(page);
    const texto = await N.textoDoPainel(page);
    expect(texto).toMatch(/Pegue o Elevador [12]/);
    expect(texto).not.toMatch(/Pegue a Escada/);
  });

  test('RN16 / RN17 — elevadores e rampa com aviso: sem caminho acessível, com o motivo e onde pedir ajuda', async ({ page }) => {
    await N.planejarRota(page, { perfil: 'Mobilidade reduzida', armazenamento: { 'navi-avisos': SEM_ELEVADOR_NEM_RAMPA } });
    const texto = await N.textoDoPainel(page);
    expect(texto).toContain('Não encontramos caminho acessível confirmado');
    expect(texto).toMatch(/O elevador e a rampa estão com aviso de interdição ou defeito, e a rota sem escadas depende deles\./);
    expect(texto).toMatch(/Procure a Recepção, no 1º andar, ao lado da entrada\./);
    await expect(page.getByRole('button', { name: 'Pedir ajuda' }).first()).toBeVisible();
    // nenhuma rota inventada
    await expect(page.getByRole('button', { name: 'Próximo' })).toHaveCount(0);
  });
});
