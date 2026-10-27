/* Navi — preferências, perfis e parâmetros entre as duas páginas.
   Preferências combináveis (RN06): ouvir instruções, evitar escadas, Libras, texto maior, tema e
   "uso leitor de tela". O perfil é só um atalho que liga um conjunto delas; depois cada uma muda sozinha.
   Tudo fica no próprio aparelho (chaves navi-*, RN07), sem cadastro nem envio de dados (RN55). */
(function (raiz) {
  'use strict';
  const CHAVES = {
    perfil: 'navi-perfil', voz: 'navi-voz', tema: 'navi-tema', texto: 'navi-texto', escadas: 'navi-escadas',
    libras: 'navi-libras', leitor: 'navi-leitor', velocidade: 'navi-velocidade', vista: 'navi-vista',
    avisos: 'navi-avisos', boasVindas: 'navi-boas-vindas', contraste: 'navi-contraste'
  };
  const TEMAS = ['claro', 'contraste', 'daltonismo'];
  const TEXTOS = [100, 125, 150, 175, 200];
  const VELOCIDADES = { devagar: 0.8, normal: 1, rapido: 1.25 };

  const PERFIS = {
    visual: { nome: 'Deficiência visual', icone: 'i-visual', desc: 'Letras maiores, alto contraste e instruções faladas, um passo de cada vez.' },
    mobilidade: { nome: 'Mobilidade reduzida', icone: 'i-mobilidade', desc: 'Rotas sem escadas. Para mudar de andar, o caminho passa pelo elevador.' },
    auditiva: { nome: 'Deficiência auditiva', icone: 'i-auditiva', desc: 'Tradutor de Libras e todas as orientações por escrito, sem depender de som.' },
    geral: { nome: 'Sem adaptações', icone: 'i-geral', desc: 'Mapa e passo a passo, sem mudanças.' }
  };

  const arm = () => { try { return raiz.localStorage || null; } catch (e) { return null; } };
  function ler(nome) { try { const a = arm(); return a ? a.getItem(CHAVES[nome] || nome) : null; } catch (e) { return null; } }
  function guardar(nome, valor) { try { const a = arm(); if (a) a.setItem(CHAVES[nome] || nome, String(valor)); } catch (e) { /* sem armazenamento */ } }
  function apagar(nome) { try { const a = arm(); if (a) a.removeItem(CHAVES[nome] || nome); } catch (e) { /* */ } }

  function preferencias() {
    let tema = ler('tema');
    if (!TEMAS.includes(tema)) tema = ler('contraste') === '1' ? 'contraste' : 'claro';
    let texto = parseInt(ler('texto'), 10);
    if (ler('texto') === '1') texto = 125; // valor antigo do botão A+
    if (!TEXTOS.includes(texto)) texto = 100;
    const leitor = ler('leitor') === '1';
    return {
      perfil: PERFIS[ler('perfil')] ? ler('perfil') : null,
      voz: !leitor && ler('voz') === '1',
      leitorDeTela: leitor,
      evitarEscadas: ler('escadas') === '1',
      libras: ler('libras') === '1',
      tema, texto,
      velocidade: VELOCIDADES[ler('velocidade')] ? ler('velocidade') : 'normal'
    };
  }

  function salvar(p) {
    if ('perfil' in p) p.perfil ? guardar('perfil', p.perfil) : apagar('perfil');
    if ('voz' in p) guardar('voz', p.voz ? '1' : '0');
    if ('leitorDeTela' in p) guardar('leitor', p.leitorDeTela ? '1' : '0');
    if ('evitarEscadas' in p) guardar('escadas', p.evitarEscadas ? '1' : '0');
    if ('libras' in p) guardar('libras', p.libras ? '1' : '0');
    if ('tema' in p && TEMAS.includes(p.tema)) { guardar('tema', p.tema); apagar('contraste'); }
    if ('texto' in p && TEXTOS.includes(+p.texto)) guardar('texto', p.texto);
    if ('velocidade' in p && VELOCIDADES[p.velocidade]) guardar('velocidade', p.velocidade);
    return preferencias();
  }

  /** Atalho do perfil: liga as preferências dele e mantém as outras como estão. */
  function aplicarPerfil(perfil) {
    const atual = preferencias();
    const p = { perfil };
    if (perfil === 'visual') { p.tema = 'contraste'; p.texto = Math.max(atual.texto, 125); if (!atual.leitorDeTela) p.voz = true; }
    if (perfil === 'mobilidade') p.evitarEscadas = true;
    if (perfil === 'auditiva') p.libras = true;
    return salvar(p);
  }

  /** Aplica tema e tamanho do texto no <html> (também feito por um script curto no <head>, antes de pintar). */
  function aplicarNaPagina(p, doc = raiz.document) {
    const h = doc.documentElement;
    h.classList.toggle('contraste', p.tema === 'contraste');
    h.classList.toggle('daltonismo', p.tema === 'daltonismo');
    h.classList.toggle('texto-grande', p.texto > 100);
    if (p.texto > 100) h.dataset.texto = String(p.texto); else delete h.dataset.texto;
    const meta = doc.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = p.tema === 'contraste' ? '#061A33' : p.tema === 'daltonismo' ? '#005A8C' : '#0B4FA8';
  }

  function apagarTudo() { for (const k of Object.keys(CHAVES)) if (k !== 'avisos') apagar(k); }
  const primeiraVisita = () => ler('boasVindas') !== '1';
  const concluirBoasVindas = () => guardar('boasVindas', '1');

  /** Parâmetros da URL que as duas páginas entendem. */
  function parametros(search) {
    const q = new URLSearchParams(search || '');
    const v = k => { const s = (q.get(k) || '').trim(); return s || null; };
    return { local: v('local'), perfil: PERFIS[v('perfil')] ? v('perfil') : null, origem: v('origem'), destino: v('destino'),
      avisar: q.has('avisar'), msg: v('msg'), alterar: v('alterar') };
  }
  function montarUrl(pagina, params) {
    const q = new URLSearchParams();
    for (const k of ['local', 'origem', 'destino', 'perfil', 'alterar', 'msg']) if (params[k]) q.set(k, params[k]);
    if (params.avisar) q.set('avisar', '1');
    const s = q.toString();
    return pagina + (s ? '?' + s : '');
  }
  const urlMapa = p => montarUrl('mapa.html', p);
  const urlRota = p => montarUrl('index.html', p);

  raiz.NaviEstado = {
    CHAVES, TEMAS, TEXTOS, VELOCIDADES, PERFIS,
    ler, guardar, apagar, preferencias, salvar, aplicarPerfil, aplicarNaPagina, apagarTudo,
    primeiraVisita, concluirBoasVindas, parametros, urlMapa, urlRota
  };
})(typeof window !== 'undefined' ? window : globalThis);
