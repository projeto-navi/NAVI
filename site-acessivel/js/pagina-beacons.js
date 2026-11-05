/* Navi — tela de teste "Beacons por perto" (beacons.html), só no app Android.
   Mostra todo iBeacon percebido, com sinal e distância aproximada, para instalar e calibrar os
   beacons e preencher locais/<slug>/beacons.js. Nada é enviado (RN73, proposta). */
(async function () {
  'use strict';
  const NE = window.NaviEstado, NL = window.NaviLocal, NB = window.NaviBeacons;
  const $ = id => document.getElementById(id);
  const svg = id => window.NaviIcones.svg(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tela = $('beacons-tela');
  const anunciar = t => { const r = $('anuncio'); r.textContent = ''; setTimeout(() => { r.textContent = t; }, 50); };
  NE.aplicarNaPagina(NE.preferencias());

  const app = window.NaviBeaconsApp.criar();
  if (!app.disponivel()) {
    tela.innerHTML = `<p>Esta tela funciona só no app do Navi.</p>
      <a class="btn-texto" href="index.html">${svg('i-voltar')}Voltar ao Navi</a>`;
    return;
  }

  const indice = window.NAVI_LOCAIS_INDICE || [];
  const slug = NL.slugDaUrl(location.search, indice);
  let local = null;
  try { local = await NL.carregar(slug, { malha: false }); } catch (e) { /* mostra só os números */ }
  const beacons = await window.NaviBeaconsUI.listaDoLocal(slug);
  const rastreador = NB.criarRastreador(beacons
    ? { uuid: beacons.uuid, raioPadrao: beacons.raioPadrao, lista: beacons.lista }
    : { uuid: '', lista: [] });
  const nomeDe = id => { const l = id && local ? local.lugar(id) : null; return l ? l.nome : null; };
  const metros = d => '~' + d.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' m';
  let quantos = -1, erro = '';

  function htmlControles() {
    if (app.procurando()) return `<button type="button" class="btn" id="btn-copiar">Copiar números</button>`;
    return `<p class="texto-2">A busca está desligada.</p>
      ${erro ? `<div class="faixa-aviso">${svg('i-aviso')}<p>${esc(erro)}</p></div>` : ''}
      <button type="button" class="btn btn-primario" id="btn-comecar">Começar a procurar</button>`;
  }
  function render() {
    tela.innerHTML = `<p>Todos os beacons que este celular percebe agora. Os cadastrados mostram o lugar; os outros aparecem como "não cadastrado".</p>
      <div class="beacons-controles">${htmlControles()}</div>
      <p class="texto-2" id="beacons-contagem" role="status"></p>
      <ul class="beacons-lista" aria-label="Beacons por perto"></ul>`;
    const c = $('btn-comecar');
    if (c) c.onclick = comecar;
    const cp = $('btn-copiar');
    if (cp) cp.onclick = copiar;
    quantos = -1;
    atualizarLista();
  }
  function atualizarLista() {
    const ul = tela.querySelector('.beacons-lista');
    if (!ul) return;
    const todos = rastreador.todos();
    const agora = Date.now();
    ul.innerHTML = todos.map(b => `<li class="beacons-item">
        <b>${esc(nomeDe(b.lugar) || 'não cadastrado')}</b>
        <span>UUID ${esc(b.uuid.slice(0, 8))}…, major ${b.major}, minor ${b.minor}</span>
        <span>Sinal: ${b.rssi} dBm</span>
        <span>Distância: ${metros(b.distancia)}</span>
        <span class="texto-2">visto há ${Math.max(0, Math.round((agora - b.vistoEm) / 1000))} s</span>
      </li>`).join('');
    if (todos.length !== quantos) {
      quantos = todos.length;
      $('beacons-contagem').textContent = app.procurando()
        ? (quantos ? `${quantos} ${quantos === 1 ? 'beacon por perto' : 'beacons por perto'}.` : 'Procurando beacons por perto…')
        : '';
    }
  }
  async function comecar() {
    erro = '';
    try {
      await app.comecar(l => rastreador.registrar(l));
    } catch (e) {
      erro = 'Não foi possível começar. Na página inicial, em "Encontrar onde você está", ligue o Bluetooth, a localização e a permissão.';
    }
    render();
  }
  async function copiar() {
    const texto = rastreador.todos().map(b => [b.uuid, b.major, b.minor, b.rssi].join(',')).join('\n');
    try {
      await navigator.clipboard.writeText(texto);
    } catch (e) {
      const t = document.createElement('textarea');
      t.value = texto; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } catch (e2) { /* sem área de transferência */ }
      t.remove();
    }
    $('beacons-contagem').textContent = 'Números copiados.';
    anunciar('Números copiados.');
  }

  render();
  if (app.lembrado()) await comecar();
  setInterval(atualizarLista, 1000);
})();
