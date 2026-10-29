/* Navi — vista 3D (usada pelo adaptador js/mapa3d-renderer.js, só quando o 3D é pedido).
   Geometria construída com as MESMAS coordenadas do mapa 2D (plantas, quiosques, malha de corredores),
   então lugares, rotas e marcadores ficam exatamente no mesmo lugar nas duas vistas.
   Local com modelo (.glb, opcoes.modelo): o prédio vem do modelo, colocado na escala da planta, e as
   salas viram peças finas e invisíveis sobre o piso, que só aparecem para realçar (clique, destino, aviso).
   Alturas e materiais são ilustrativos. As cores vêm dos tokens do tema ativo (css/tokens.css).
   Desempenho (Marco 1): pixel ratio até 1,5, sem preserveDrawingBuffer, materiais simples e sem sombras,
   e o quadro só é desenhado quando algo muda (nada se move sozinho). */
(function () {
  'use strict';
  const T = window.THREE;
  const ALT_PISO_PADRAO = 120; // distância vertical entre Piso 1 e Piso 2 (unidades da planta)
  const ALT_LOJA = 34, ALT_QUIOSQUE = 12, ESP_LAJE = 6;
  const AFASTAR = 170;       // separação extra entre os pisos no modo "ver os dois pisos"

  function suportaWebGL() {
    try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); }
    catch (e) { return false; }
  }
  // cor de um token do tema ativo (com reserva, para nunca ficar sem cor)
  const cssVar = (n, reserva = '#888888') => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || reserva;
  const ehEscada = cat => cat === 'escada' || cat === 'escada_rolante';
  const ACESSIBILIDADE = ['elevador', 'plataforma', 'rampa', 'piso_tatil', 'sanitario_acessivel', 'vaga_pcd'];
  const reduzMovimento = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function dentro(x, y, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }

  /**
   * @param {HTMLElement} container
   * @param {{places: object[], plantas: object, pisos: object}} D geometria por andar (local.legado)
   * @param {object} G grafo do motor
   * @param {{selecionar?: Function, anunciar?: Function, saiuPrimeiraPessoa?: Function}} ao
   * @param {{lajes?: object, nomeAndar?: (piso: number) => string, textos?: object, corEntrada?: (lugar: object) => string|null,
   *   modelo?: {cena: Promise<object>, unidadesPorMetro: number, deslocamento: number[], alturaAndar: number}}} [opcoes]
   */
  function iniciar(container, D, G, ao, opcoes = {}) {
    if (!T || !suportaWebGL()) return null;
    const lajes = opcoes.lajes || (window.NAVI_3D || {}).lajes || {};
    const nomeAndar = opcoes.nomeAndar || (p => 'Piso ' + p);
    const txt = opcoes.textos || {};
    const corEntrada = opcoes.corEntrada || (() => null);
    const MOD = opcoes.modelo || null;
    const ALT_PISO = MOD ? MOD.alturaAndar * MOD.unidadesPorMetro : ALT_PISO_PADRAO;
    const SOBRE = 1.4;   // espessura das peças de realce sobre o piso do modelo
    // lugares desenhados como forma (sala, loja…); os outros viram ícone (mesma regra do 2D)
    const comoForma = cat => ['loja', 'quiosque', 'entrada', 'administracao', 'sala', 'laboratorio'].includes(cat);
    const PISOS = Object.keys(D.pisos).map(Number).sort((a, b) => a - b);
    const TOPO = PISOS[PISOS.length - 1];
    // centro da planta → origem do mundo
    const caixas = PISOS.map(p => D.pisos[p]);
    const cx = (Math.min(...caixas.map(b => b.minX)) + Math.max(...caixas.map(b => b.maxX))) / 2;
    const cz = (Math.min(...caixas.map(b => b.minY)) + Math.max(...caixas.map(b => b.maxY))) / 2;
    let extra2 = 0;
    const P = (x, y, piso, h = 0) => new T.Vector3(x - cx, (piso - 1) * (ALT_PISO + extra2) + h, y - cz);

    const renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = false; // sem sombras: o relevo vem da luz ambiente e da cor das paredes
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.className = 'mapa3d-canvas';
    container.appendChild(renderer.domElement);
    const rotulos = document.createElement('div');
    rotulos.className = 'rotulos3d';
    container.appendChild(rotulos);
    const dica = document.createElement('div');
    dica.className = 'dica3d'; dica.hidden = true;
    container.appendChild(dica);

    const cena = new T.Scene();
    const camera = new T.PerspectiveCamera(38, 1, 5, 9000);
    const controles = new T.OrbitControls(camera, renderer.domElement);
    controles.enableDamping = true; controles.dampingFactor = 0.12;
    controles.maxPolarAngle = Math.PI * 0.47; controles.minDistance = 120; controles.maxDistance = 3200;
    controles.screenSpacePanning = false;

    const hemi = new T.HemisphereLight(0xffffff, 0xaeb8c6, 1.6);
    cena.add(hemi);
    const sol = new T.DirectionalLight(0xffffff, 1.5);
    sol.position.set(-700, 1400, 600);
    cena.add(sol);

    // textura de piso (porcelanato claro em placas, como nos corredores do shopping)
    function texturaPiso(base, junta) {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = base; g.fillRect(0, 0, 128, 128);
      g.strokeStyle = junta; g.lineWidth = 2;
      g.strokeRect(1, 1, 126, 126);
      g.globalAlpha = 0.25; g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 128); g.moveTo(0, 64); g.lineTo(128, 64); g.stroke();
      const t = new T.CanvasTexture(c);
      t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(1 / 60, 1 / 60); t.colorSpace = T.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    }

    const M = {};
    const L = (o) => new T.MeshLambertMaterial(o);
    function criarMateriais() {
      const contraste = document.documentElement.classList.contains('contraste');
      const fundo = new T.Color(cssVar('--mapa-fundo', '#DCE2E9'));
      cena.background = fundo;
      const pisoBase = cssVar('--mapa-piso', '#FFFFFF'), pisoJunta = cssVar('--cor-divisor', '#D3DAE2');
      if (M.piso) { M.piso.map.dispose(); }
      const rota = cssVar('--mapa-rota', '#0B4FA8'), ativo = cssVar('--mapa-trecho-ativo', '#FFC62E'), destino = cssVar('--mapa-destino', '#FFC62E');
      const novo = {
        piso: L({ map: texturaPiso(pisoBase, pisoJunta) }),
        borda: L({ color: cssVar('--mapa-parede', '#6B7A8C') }),
        parede: L({ color: cssVar('--mapa-quiosque', '#E6EBF1') }),
        teto: L({ color: cssVar('--mapa-loja', '#C9D3DF') }),
        quiosque: L({ color: cssVar('--mapa-quiosque', '#E6EBF1') }),
        selecionada: L({ color: cssVar('--mapa-selecionado', '#FFE08A'), emissive: '#5A4300', emissiveIntensity: 0.25 }),
        hover: L({ color: contraste ? '#FFE38A' : cssVar('--mapa-selecionado', '#FFE08A') }),
        historico: L({ color: '#D8B46E' }),
        historicoTeto: L({ color: '#7A4A32' }),
        rota: L({ color: rota, emissive: rota, emissiveIntensity: 0.35 }),
        passo: L({ color: ativo, emissive: ativo, emissiveIntensity: 0.4 }),
        fantasma: new T.MeshBasicMaterial({ color: rota, transparent: true, opacity: 0.45, depthTest: false, depthWrite: false }),
        lajeVidro: L({ color: pisoBase, transparent: true, opacity: 0.55, depthWrite: false }),
        origem: L({ color: cssVar('--mapa-partida', '#FFFFFF') }),
        origemAnel: L({ color: cssVar('--mapa-partida-borda', '#0D1B2A') }),
        destino: L({ color: destino, emissive: destino, emissiveIntensity: 0.2 }),
        aviso: L({ color: cssVar('--mapa-aviso', '#A85F00'), emissive: cssVar('--mapa-aviso', '#A85F00'), emissiveIntensity: 0.2 }),
        quiosqueFantasma: L({ color: cssVar('--mapa-quiosque', '#E6EBF1'), transparent: true, opacity: 0.18, depthWrite: false }),
        feixe: new T.MeshBasicMaterial({ color: destino, transparent: true, opacity: 0.22, depthWrite: false, side: T.DoubleSide, fog: false }),
        seta: new T.MeshBasicMaterial({ color: rota }),
        setaBorda: new T.MeshBasicMaterial({ color: cssVar('--mapa-rota-contorno', '#FFFFFF') }),
        setaRota: new T.MeshBasicMaterial({ color: cssVar('--mapa-rota-contorno', '#FFFFFF') }),
        vidro: L({ color: '#9CC3E6', transparent: true, opacity: 0.35, depthWrite: false }),
        invisivel: new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
      };
      for (const k in novo) { if (M[k]) { M[k].dispose(); } M[k] = novo[k]; }
      for (const k of Object.keys(M)) if (k.startsWith('entrada-')) { M[k].dispose(); delete M[k]; }
    }
    /** Material da entrada na cor da placa real (no alto contraste e nas cores distintas, a cor do tema). */
    function materialEntrada(lugar) {
      const cor = corEntrada(lugar) || cssVar('--mapa-servico', '#0D1B2A');
      const k = 'entrada-' + cor;
      return M[k] || (M[k] = L({ color: cor }));
    }
    criarMateriais();

    // ---------- construção da planta ----------
    const grupos = {};
    for (const p of PISOS) { grupos[p] = new T.Group(); grupos[p].name = 'piso' + p; cena.add(grupos[p]); }
    const lojas = [];            // meshes clicáveis: {mesh, lugar, piso}
    const porLugar = {};

    function forma(pts, buracos = []) {
      const s = new T.Shape(pts.map(([x, y]) => new T.Vector2(x - cx, -(y - cz))));
      for (const h of buracos) s.holes.push(new T.Path(h.map(([x, y]) => new T.Vector2(x - cx, -(y - cz)))));
      return s;
    }
    function extrudar(shape, altura, base) {
      const g = new T.ExtrudeGeometry(shape, { depth: altura, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      g.translate(0, base, 0);
      return g;
    }

    const museu = D.places.find(p => p.cat === 'museu');
    const nomeHistorico = txt.historico3d || (museu ? museu.nome : '');
    const nomeHistoricoLongo = txt.historico3dLongo || nomeHistorico;
    for (const piso of PISOS) {
      const base = (piso - 1) * ALT_PISO;
      for (const l of lajes[piso] || []) {
        const m = new T.Mesh(extrudar(forma(l.ext, l.buracos), ESP_LAJE, base - ESP_LAJE), [M.piso, M.borda]);
        m.userData.tipo = 'laje';
        grupos[piso].add(m);
      }
      const lugaresPiso = D.places.filter(p => p.piso === piso);
      const porPoly = {};
      lugaresPiso.forEach(p => { if (p.poly >= 0 && !porPoly[p.poly]) porPoly[p.poly] = p; });
      (D.plantas[piso] || []).forEach((poly, i) => {
        const lugar = porPoly[i] || null;
        if (MOD) {
          if (!lugar) return;
          const m = new T.Mesh(extrudar(forma(poly), SOBRE, base + 0.3), M.invisivel);
          m.userData = { tipo: 'loja', lugar, sobre: true };
          grupos[piso].add(m); lojas.push(m); (porLugar[lugar.id] = porLugar[lugar.id] || []).push(m);
          return;
        }
        const historico = !!(museu && museu.piso === piso && dentro(museu.x, museu.y, poly));
        const alt = historico ? ALT_LOJA + 6 : ALT_LOJA;
        const m = new T.Mesh(extrudar(forma(poly), alt, base), historico ? [M.historicoTeto, M.historico] : [M.teto, M.parede]);
        m.userData = { tipo: 'loja', lugar: historico ? museu : lugar, historico };
        grupos[piso].add(m);
        if (m.userData.lugar) { lojas.push(m); (porLugar[m.userData.lugar.id] = porLugar[m.userData.lugar.id] || []).push(m); }
        if (historico) {
          // telhado em duas águas do antigo prédio da estação (estilizado)
          const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
          const w = Math.max(...xs) - Math.min(...xs), d = Math.max(...ys) - Math.min(...ys);
          const tri = new T.Shape([new T.Vector2(-d / 2, 0), new T.Vector2(d / 2, 0), new T.Vector2(0, 22)]);
          const g = new T.ExtrudeGeometry(tri, { depth: w - 6, bevelEnabled: false });
          g.rotateY(Math.PI / 2);
          const telhado = new T.Mesh(g, M.historicoTeto);
          const c = P((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, piso, alt);
          telhado.position.set(c.x - (w - 6) / 2, c.y, c.z);
          telhado.userData = m.userData;
          grupos[piso].add(telhado); lojas.push(telhado); porLugar[museu.id].push(telhado);
        }
      });
      // quiosques, entradas e lojas sem contorno na planta
      if (MOD) {
        lugaresPiso.filter(p => p.poly < 0 && comoForma(p.cat) && p.w && p.h).forEach(p => {
          const m = new T.Mesh(new T.BoxGeometry(p.w, SOBRE, p.h), M.invisivel);
          m.position.copy(P(p.x, p.y, piso, 0.3 + SOBRE / 2)); m.rotation.y = -(p.r || 0) * Math.PI / 180;
          m.userData = { tipo: 'loja', lugar: p, sobre: true };
          grupos[piso].add(m); lojas.push(m); (porLugar[p.id] = porLugar[p.id] || []).push(m);
        });
        continue;
      }
      lugaresPiso.filter(p => p.cat === 'quiosque' || p.cat === 'entrada' || (p.cat === 'loja' && p.poly < 0)).forEach(p => {
        const ent = p.cat === 'entrada';
        const alt = ent ? 3 : p.cat === 'quiosque' ? ALT_QUIOSQUE : ALT_LOJA * 0.6;
        const g = new T.BoxGeometry(p.w, alt, p.h);
        const m = new T.Mesh(g, ent ? materialEntrada(p) : M.quiosque);
        const c = P(p.x, p.y, piso, alt / 2);
        m.position.copy(c); m.rotation.y = -(p.r || 0) * Math.PI / 180;
        m.userData = { tipo: ent ? 'entrada' : 'quiosque', lugar: p };
        grupos[piso].add(m); lojas.push(m); (porLugar[p.id] = porLugar[p.id] || []).push(m);
        if (ent) {
          // pórtico de entrada na cor do acesso
          const port = new T.Mesh(new T.BoxGeometry(p.w + 4, 6, p.h + 4), m.material);
          port.position.copy(P(p.x, p.y, piso, 58)); port.rotation.y = m.rotation.y;
          port.userData = m.userData; grupos[piso].add(port); lojas.push(port); porLugar[p.id].push(port);
        }
      });
    }
    // poço do elevador (vidro) ligando os pisos, na posição usada pelas rotas
    const elev = MOD ? null : G.conexoes.find(c => c.tipo === 'elevador');
    let poco = null;
    if (elev) {
      const n = G.nos[elev.b];
      poco = new T.Mesh(new T.BoxGeometry(30, ALT_PISO + ALT_LOJA, 30), M.vidro);
      poco.position.copy(P(n.x, n.y, PISOS[0], (ALT_PISO + ALT_LOJA) / 2));
      cena.add(poco);
    }

    // ---------- modelo .glb do local (quando há) ----------
    // As paredes do modelo são cortadas um pouco acima da cintura (como numa maquete aberta), para a rota
    // aparecer de qualquer ângulo; na primeira pessoa elas voltam inteiras.
    const CORTAVEIS = new Set(['parede', 'parede_externa', 'vidro', 'caixilho', 'porta', 'porta_corta_fogo']);
    const planosCorte = {};
    function cortarParedes() {
      if (!MOD) return;
      for (const piso of PISOS) {
        const pl = planosCorte[piso];
        if (pl) pl.constant = fp ? 1e6 : grupos[piso].position.y + (piso - 1) * ALT_PISO + 1.4 * MOD.unidadesPorMetro;
      }
    }
    if (MOD) {
      renderer.localClippingEnabled = true;
      const k = MOD.unidadesPorMetro, desl = MOD.deslocamento || [0, 0];
      Promise.resolve(MOD.cena).then(modelo => {
        const andares = [];
        modelo.traverse(o => { if (o.userData && o.userData.tipo === 'andar') andares.push(o); });
        for (const a of andares) {
          const piso = MOD.piso(a.userData.andar);
          if (!grupos[piso]) continue;
          // metros do modelo → unidades da planta, com a mesma origem do resto da cena
          const suporte = new T.Group();
          suporte.scale.setScalar(k);
          suporte.position.set(desl[0] * k - cx, 0, desl[1] * k - cz);
          suporte.userData.glb = true;
          suporte.add(a);
          const plano = planosCorte[piso] = new T.Plane(new T.Vector3(0, -1, 0), 1e6);
          const proprios = {};
          a.traverse(o => {
            if (!o.isMesh || !CORTAVEIS.has(o.material.name)) return;
            const n = o.material.name;
            if (!proprios[n]) { proprios[n] = o.material.clone(); proprios[n].clippingPlanes = [plano]; }
            o.material = proprios[n];
          });
          grupos[piso].add(suporte);
        }
        // o piso do modelo substitui as lajes desenhadas
        for (const piso of PISOS) grupos[piso].children.forEach(o => { if (o.userData.tipo === 'laje') o.visible = false; });
        cortarParedes();
        pedirRender();
      }).catch(e => { console.warn('[Navi] 3D sem o modelo do local:', e && e.message); });
    }

    // ---------- pictogramas dos serviços (mesmos símbolos do 2D) ----------
    const icones = [];
    const cacheTex = {};
    function pintarIcone(cat, c, t) {
      const g = c.getContext('2d');
      const acess = ACESSIBILIDADE.includes(cat);
      const fundo = acess ? cssVar('--mapa-acessibilidade', '#0B4FA8') : cssVar('--mapa-servico', '#0D1B2A');
      const traco = acess ? cssVar('--mapa-acessibilidade-icone', '#FFFFFF') : cssVar('--mapa-servico-icone', '#FFFFFF');
      g.clearRect(0, 0, 128, 128);
      g.fillStyle = fundo;
      g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
      g.lineWidth = 6; g.strokeStyle = cssVar('--mapa-marca-halo', '#FFFFFF'); g.stroke();
      const sym = document.getElementById('c-' + cat) || document.getElementById('p-' + cat);
      if (sym) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${sym.getAttribute('viewBox')}" width="72" height="72" color="${traco}">${sym.innerHTML}</svg>`;
        const img = new Image();
        img.onload = () => { g.drawImage(img, 28, 28, 72, 72); t.needsUpdate = true; pedirRender(); };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      }
      t.needsUpdate = true;
    }
    function texturaIcone(cat) {
      if (cacheTex[cat]) return cacheTex[cat].t;
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
      cacheTex[cat] = { c, t };
      pintarIcone(cat, c, t);
      return t;
    }
    D.places.filter(p => MOD ? !comoForma(p.cat) : !['loja', 'quiosque', 'entrada', 'administracao'].includes(p.cat)).forEach(p => {
      const s = new T.Sprite(new T.SpriteMaterial({ map: texturaIcone(p.cat), depthTest: true, transparent: true }));
      s.position.copy(P(p.x, p.y, p.piso, ALT_LOJA + 26));
      s.scale.set(30, 30, 1);
      s.userData = { tipo: 'servico', lugar: p };
      s.renderOrder = 5;
      grupos[p.piso].add(s); icones.push(s); lojas.push(s);
      (porLugar[p.id] = porLugar[p.id] || []).push(s);
      // haste ligando o ícone ao chão
      const haste = new T.Mesh(new T.CylinderGeometry(1.2, 1.2, ALT_LOJA + 12, 6), M.borda);
      haste.position.copy(P(p.x, p.y, p.piso, (ALT_LOJA + 12) / 2));
      haste.userData.tipo = 'haste';
      grupos[p.piso].add(haste);
    });

    // ---------- rota e marcadores ----------
    const grupoRota = new T.Group(); cena.add(grupoRota);

    function tubo(pts, raio, mat) {
      const cp = new T.CurvePath();
      for (let i = 1; i < pts.length; i++) if (pts[i].distanceTo(pts[i - 1]) > 0.01) cp.add(new T.LineCurve3(pts[i - 1], pts[i]));
      if (!cp.curves.length) return null;
      const m = new T.Mesh(new T.TubeGeometry(cp, Math.max(8, cp.curves.length * 6), raio, 10, false), mat);
      return { mesh: m, curva: cp };
    }

    // setas paradas sobre a linha da rota mostram o sentido (no lugar da esfera que corria pela linha)
    function setasSobreRota(pontos, piso) {
      const ESP = 70;
      let falta = ESP * 0.6;
      for (let i = 1; i < pontos.length; i++) {
        const a = pontos[i - 1], b = pontos[i], L = Math.hypot(b.x - a.x, b.y - a.y);
        if (L < 0.01) continue;
        const yaw = yawDe(b.x - a.x, b.y - a.y);
        let pos = falta;
        while (pos <= L) {
          const x = a.x + (b.x - a.x) * pos / L, y = a.y + (b.y - a.y) * pos / L;
          const m = new T.Mesh(geoSeta, M.setaRota);
          m.scale.setScalar(0.62); m.position.copy(P(x, y, piso, 10)); m.rotation.y = yaw; m.renderOrder = 11;
          grupoRota.add(m);
          pos += ESP;
        }
        falta = pos - L;
      }
    }

    let estado = { piso: PISOS[0], ambos: false };
    function limparGrupo(g) { while (g.children.length) { const c = g.children.pop(); c.geometry && c.geometry.dispose(); } }

    function desenharRota(E) {
      limparGrupo(grupoRota);
      document.querySelectorAll('.rotulo3d-fixo').forEach(n => n.remove());
      for (const m of lojas) if (m.userData.marcada) { m.material = m.userData.matOriginal; m.userData.marcada = false; }
      restaurarAvisos();
      const visivel = piso => estado.ambos || piso === estado.piso;
      if (E.rota && fp) {
        desenharSetasChao(E);
      } else if (E.rota) {
        E.rota.trechos.forEach((t, i) => {
          const pts = t.pontos.map(p => P(p.x, p.y, t.piso, 5));
          if (visivel(t.piso)) {
            const r = tubo(pts, 4.5, M.rota); if (r) grupoRota.add(r.mesh);
            const f = tubo(pts, 3, M.fantasma); if (f) { f.mesh.renderOrder = 10; grupoRota.add(f.mesh); }
            setasSobreRota(t.pontos, t.piso);
          }
          const prox = E.rota.trechos[i + 1];
          if (prox && estado.ambos) {
            const a = pts[pts.length - 1], b = P(prox.pontos[0].x, prox.pontos[0].y, prox.piso, 5);
            const r = tubo([a, new T.Vector3(a.x, b.y, a.z), b], 4.5, M.rota); if (r) grupoRota.add(r.mesh);
            const f = tubo([a, new T.Vector3(a.x, b.y, a.z), b], 3, M.fantasma); if (f) { f.mesh.renderOrder = 10; grupoRota.add(f.mesh); }
          }
        });
        const p = E.rota.passos[E.passo];
        if (p && visivel(p.piso) && (p.de.x !== p.ate.x || p.de.y !== p.ate.y)) {
          const r = tubo([P(p.de.x, p.de.y, p.piso, 6), P(p.ate.x, p.ate.y, p.piso, 6)], 7, M.passo);
          if (r) grupoRota.add(r.mesh);
        }
      }
      // marcadores
      const marca = (lugar, tipo) => {
        if (!lugar || !visivel(lugar.piso)) return;
        (porLugar[lugar.id] || []).forEach(m => {
          if (m.isSprite || m.userData.tipo === 'entrada') return;
          m.userData.matOriginal = m.userData.matHover || m.material; m.userData.matHover = null; m.userData.marcada = true;
          m.material = Array.isArray(m.material) ? [M.selecionada, M.selecionada] : M.selecionada;
        });
        if (tipo === 'origem') {
          const g = new T.Group();
          const disco = new T.Mesh(new T.CylinderGeometry(13, 13, 6, 32), M.origem);
          const anel = new T.Mesh(new T.TorusGeometry(15, 4, 10, 40), M.origemAnel); anel.rotation.x = Math.PI / 2; anel.position.y = 3;
          g.add(disco, anel); g.position.copy(P(lugar.x, lugar.y, lugar.piso, 3));
          grupoRota.add(g);
        } else {
          const g = new T.Group();
          const cone = new T.Mesh(new T.ConeGeometry(10, 30, 24), M.destino); cone.rotation.x = Math.PI; cone.position.y = 15;
          const bola = new T.Mesh(new T.SphereGeometry(14, 24, 16), M.destino); bola.position.y = 36;
          g.add(cone, bola); g.position.copy(P(lugar.x, lugar.y, lugar.piso, ALT_LOJA + 4));
          g.userData.pino = true;
          grupoRota.add(g);
          if (fp) {
            // feixe de luz sobre o destino, visível de longe na primeira pessoa
            const feixe = new T.Mesh(new T.CylinderGeometry(16, 16, 260, 32, 1, true), M.feixe);
            feixe.position.copy(P(lugar.x, lugar.y, lugar.piso, 130)); feixe.renderOrder = 3;
            grupoRota.add(feixe);
          }
        }
        const el = document.createElement('div');
        el.className = 'rotulo3d rotulo3d-fixo ' + tipo;
        el.textContent = (tipo === 'origem' ? 'Você: ' : '') + lugar.nome;
        el.dataset.x = lugar.x; el.dataset.y = lugar.y; el.dataset.piso = lugar.piso;
        el.dataset.h = tipo === 'origem' ? 20 : fp ? ALT_LOJA - 6 : ALT_LOJA + 64;
        rotulos.appendChild(el);
      };
      marca(E.origem, 'origem'); marca(E.destino, 'destino');
    }

    function visibilidade(E) {
      const mob = E.evitarEscadas != null ? !!E.evitarEscadas : E.perfil === 'mobilidade';
      for (const piso of PISOS) {
        const g = grupos[piso];
        g.visible = estado.ambos || piso === estado.piso;
        // no modo "ambos" o piso de cima fica translúcido para ver o de baixo
        g.traverse(o => {
          if (!o.isMesh || o.userData.marcada || o.userData.glb) return;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(m => { m.transparent = false; m.opacity = 1; });
        });
      }
      for (const s of icones) s.material.opacity = mob && ehEscada(s.userData.lugar.cat) ? 0.4 : 1;
      for (const piso of PISOS) grupos[piso].children.forEach(o => { if (o.userData.tipo === 'haste') o.visible = !fp; });
      extra2 = estado.ambos ? AFASTAR : 0;
      for (const piso of PISOS) {
        if (piso === PISOS[0]) continue;
        grupos[piso].position.y = extra2 * (piso - PISOS[0]);
        grupos[piso].children.forEach(o => { if (o.userData.tipo === 'laje') o.material = estado.ambos ? [M.lajeVidro, M.lajeVidro] : [M.piso, M.borda]; });
      }
      cortarParedes();
      if (poco) { poco.visible = estado.ambos || true; poco.scale.y = (ALT_PISO + extra2 + ALT_LOJA) / (ALT_PISO + ALT_LOJA); poco.position.y = (ALT_PISO + extra2 + ALT_LOJA) / 2; }
    }

    // ---------- avisos de interdição / dano ----------
    const grupoAvisos = new T.Group(); cena.add(grupoAvisos);
    let texAviso = null, comAviso = [];
    function texturaAviso() {
      if (texAviso) return texAviso;
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = cssVar('--mapa-aviso', '#A85F00'); g.beginPath(); g.moveTo(64, 8); g.lineTo(122, 112); g.lineTo(6, 112); g.closePath(); g.fill();
      g.lineWidth = 6; g.strokeStyle = cssVar('--mapa-aviso-borda', '#FFFFFF'); g.lineJoin = 'round'; g.stroke();
      g.fillStyle = cssVar('--mapa-aviso-icone', '#FFFFFF'); g.fillRect(58, 42, 12, 40); g.beginPath(); g.arc(64, 96, 7, 0, Math.PI * 2); g.fill();
      texAviso = new T.CanvasTexture(c); texAviso.colorSpace = T.SRGBColorSpace;
      return texAviso;
    }
    function restaurarAvisos() {
      for (const m of comAviso) {
        const atual = Array.isArray(m.material) ? m.material[0] : m.material;
        if (atual === M.aviso && m.userData.matAviso) m.material = m.userData.matAviso;
        m.userData.matAviso = null;
      }
      comAviso = [];
    }
    function desenharAvisos(lista) {
      limparGrupo(grupoAvisos);
      restaurarAvisos();
      for (const a of lista || []) {
        const l = G.lugarPorId[a.lugar];
        if (!l || !(estado.ambos || l.piso === estado.piso)) continue;
        const s = new T.Sprite(new T.SpriteMaterial({ map: texturaAviso(), transparent: true, depthTest: false }));
        s.position.copy(P(l.x, l.y, l.piso, ALT_LOJA + 48)); s.scale.set(30, 30, 1); s.renderOrder = 12;
        grupoAvisos.add(s);
        (porLugar[l.id] || []).forEach(m => {
          if (m.isSprite || m.userData.marcada || m.userData.tipo === 'entrada') return;
          m.userData.matAviso = m.material; comAviso.push(m);
          m.material = Array.isArray(m.material) ? [M.aviso, M.aviso] : M.aviso;
        });
      }
    }

    // ---------- câmera ----------
    function caixaPiso(piso) {
      const b = D.pisos[piso];
      return { a: P(b.minX, b.minY, piso), b: P(b.maxX, b.maxY, piso) };
    }
    function enquadrar(pts3, piso, inclinacao, azimute) {
      const box = new T.Box3().setFromPoints(pts3);
      const centro = box.getCenter(new T.Vector3());
      const tam = box.getSize(new T.Vector3());
      const asp = camera.aspect || 1.6;
      const raio = Math.max(tam.x / Math.min(asp, 2.2), tam.z * 1.15, 260) * 0.62;
      const dist = raio / Math.tan((camera.fov * Math.PI / 180) / 2);
      const pol = inclinacao != null ? inclinacao : 0.78; // ângulo a partir da vertical
      const az = azimute != null ? azimute : -0.32;
      controles.target.copy(centro);
      camera.position.set(centro.x + dist * Math.sin(pol) * Math.sin(az), centro.y + dist * Math.cos(pol), centro.z + dist * Math.sin(pol) * Math.cos(az));
      controles.update(); pedirRender(); atualizarRotulos();
    }
    function ajustar() {
      const pisos = estado.ambos ? PISOS : [estado.piso];
      const pts = []; pisos.forEach(p => { const c = caixaPiso(p); pts.push(c.a, c.b); });
      enquadrar(pts, estado.piso, estado.ambos ? 1.08 : null);
    }
    function focar(pontosPlanta, piso) {
      enquadrar(pontosPlanta.map(p => P(p.x, p.y, piso || estado.piso)), piso);
    }
    function vistaDeCima() {
      const pisos = estado.ambos ? PISOS : [estado.piso];
      const pts = []; pisos.forEach(p => { const c = caixaPiso(p); pts.push(c.a, c.b); });
      enquadrar(pts, estado.piso, 0.001, 0);
    }
    function zoom(f) {
      if (fp) { camera.fov = Math.min(80, Math.max(30, camera.fov * f)); camera.updateProjectionMatrix(); pedirRender(); atualizarRotulos(); return; }
      const v = camera.position.clone().sub(controles.target).multiplyScalar(f);
      const d = Math.min(controles.maxDistance, Math.max(controles.minDistance, v.length()));
      camera.position.copy(controles.target).add(v.setLength(d));
      controles.update(); pedirRender(); atualizarRotulos();
    }

    // ---------- rótulos em HTML (nítidos e legíveis) ----------
    const vec = new T.Vector3();
    let mostrarTodos = false, rotulosLojas = [];
    function montarRotulosLojas() {
      rotulosLojas.forEach(r => r.el.remove());
      rotulosLojas = [];
      const vistos = new Set();
      for (const m of lojas) {
        const l = m.userData.lugar;
        if (!l || vistos.has(l.id) || m.isSprite || m.userData.tipo === 'entrada') continue;
        vistos.add(l.id);
        const el = document.createElement('div');
        el.className = 'rotulo3d loja' + (m.userData.historico ? ' historico' : '');
        el.textContent = m.userData.historico ? nomeHistorico : l.nome;
        rotulos.appendChild(el);
        rotulosLojas.push({ el, lugar: l, h: m.userData.tipo === 'quiosque' ? ALT_QUIOSQUE + 6 : ALT_LOJA + 8, prio: m.userData.historico ? 2 : m.userData.tipo === 'quiosque' ? 0 : 1 });
      }
    }
    montarRotulosLojas();
    function projetar(x, y, piso, h, w, hgt) {
      vec.copy(P(x, y, piso, h)).project(camera);
      if (vec.z > 1 || vec.z < -1) return null;
      const sx = (vec.x + 1) / 2 * w, sy = (1 - vec.y) / 2 * hgt;
      if (sx < -50 || sy < -20 || sx > w + 50 || sy > hgt + 20) return null;
      return [sx, sy];
    }
    let pendenteRot = false;
    function atualizarRotulos() {
      if (pendenteRot) return; pendenteRot = true;
      requestAnimationFrame(() => {
        pendenteRot = false;
        const w = container.clientWidth, h = container.clientHeight;
        const ocupados = [];
        const cabe = (x, y, lw, lh) => { const r = [x - lw / 2, y - lh, x + lw / 2, y]; if (ocupados.some(o => o[0] < r[2] && r[0] < o[2] && o[1] < r[3] && r[1] < o[3])) return false; ocupados.push(r); return true; };
        rotulos.querySelectorAll('.rotulo3d-fixo').forEach(el => {
          const s = projetar(+el.dataset.x, +el.dataset.y, +el.dataset.piso, +el.dataset.h, w, h);
          if (!s) { el.style.display = 'none'; return; }
          el.style.display = '';
          const ew = el.offsetWidth, eh = el.offsetHeight;
          let y = s[1];
          for (let k = 0; k < 4; k++) {
            const r = [s[0] - ew / 2, y - eh, s[0] + ew / 2, y];
            if (!ocupados.some(o => o[0] < r[2] && r[0] < o[2] && o[1] < r[3] && r[1] < o[3])) break;
            y += eh + 6;
          }
          el.style.transform = `translate(${s[0]}px, ${y}px) translate(-50%, -100%)`;
          ocupados.push([s[0] - ew / 2, y - eh, s[0] + ew / 2, y]);
        });
        if (fp) { rotulosPrimeiraPessoa(w, h, cabe); return; }
        const dist = camera.position.distanceTo(controles.target);
        const perto = dist < 900;
        const fixos = new Set([...rotulos.querySelectorAll('.rotulo3d-fixo')].map(e => e.textContent.replace(/^Você: /, '')));
        rotulosLojas.slice().sort((a, b) => b.prio - a.prio).forEach(r => {
          const vis = (estado.ambos ? r.lugar.piso === TOPO || !perto : r.lugar.piso === estado.piso) && (mostrarTodos || perto || r.prio === 2) && !fixos.has(r.lugar.nome);
          if (!vis) { r.el.style.display = 'none'; return; }
          const s = projetar(r.lugar.x, r.lugar.y, r.lugar.piso, r.h, w, h);
          if (!s) { r.el.style.display = 'none'; return; }
          const lw = r.el.textContent.length * 7.5 + 22, lh = 26;
          if (!cabe(s[0], s[1], lw, lh)) { r.el.style.display = 'none'; return; }
          r.el.style.display = ''; r.el.style.transform = `translate(${s[0]}px, ${s[1]}px) translate(-50%, -100%)`;
        });
      });
    }

    // ---------- interação ----------
    const ray = new T.Raycaster(), mouse = new T.Vector2();
    function alvo(ev) {
      const r = renderer.domElement.getBoundingClientRect();
      mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(mouse, camera);
      const vis = lojas.filter(m => PISOS.some(p => grupos[p].visible && m.parent === grupos[p]));
      const hit = ray.intersectObjects(vis, false)[0];
      return hit ? hit.object : null;
    }
    let baixo = null, hoverObj = null;
    renderer.domElement.addEventListener('pointerdown', ev => { baixo = { x: ev.clientX, y: ev.clientY }; });
    renderer.domElement.addEventListener('pointerup', ev => {
      if (!baixo || fp) return;
      const moveu = Math.hypot(ev.clientX - baixo.x, ev.clientY - baixo.y) > 6; baixo = null;
      if (moveu) return;
      const o = alvo(ev);
      if (o && o.userData.lugar && ao.selecionar) ao.selecionar(o.userData.lugar);
    });
    let ultimoHover = 0;
    renderer.domElement.addEventListener('pointermove', ev => {
      if (ev.buttons) { dica.hidden = true; return; }
      const agora = performance.now(); if (agora - ultimoHover < 50) return; ultimoHover = agora;
      const o = alvo(ev);
      if (hoverObj && hoverObj !== o && !hoverObj.userData.marcada && hoverObj.userData.matHover) { hoverObj.material = hoverObj.userData.matHover; hoverObj.userData.matHover = null; }
      hoverObj = o;
      if (o && o.userData.lugar) {
        if (!o.isSprite && !o.userData.marcada && o.userData.tipo !== 'entrada' && !o.userData.matHover) { o.userData.matHover = o.material; o.material = Array.isArray(o.material) ? [M.hover, M.hover] : M.hover; }
        const r = container.getBoundingClientRect();
        dica.textContent = o.userData.historico ? nomeHistoricoLongo : o.userData.lugar.nome;
        dica.style.transform = `translate(${ev.clientX - r.left + 14}px, ${ev.clientY - r.top + 14}px)`;
        dica.hidden = false; renderer.domElement.style.cursor = 'pointer';
      } else { dica.hidden = true; renderer.domElement.style.cursor = ''; }
      pedirRender();
    });
    renderer.domElement.addEventListener('pointerleave', () => { dica.hidden = true; });
    controles.addEventListener('change', () => { pedirRender(); atualizarRotulos(); });

    // ---------- primeira pessoa (estilo Street View: anda sobre a rota, arrasta para olhar) ----------
    const OLHO = MOD ? 1.55 * MOD.unidadesPorMetro : 12, PASSO_FP = 22;
    let fp = null;
    const SETA_HUD = { inicio: 'd-reto', reto: 'd-reto', esq: 'd-esq', dir: 'd-dir', 'leve-esq': 'd-leve-esq', 'leve-dir': 'd-leve-dir',
      volta: 'd-volta', chegada: 'd-chegada', elevador: 'c-elevador', escada: 'c-escada_rolante' };
    const areaMapa = container.closest('.mapa-area') || container;
    const hud = document.createElement('div');
    hud.className = 'fp-hud'; hud.hidden = true;
    hud.innerHTML = `
      <div class="fp-topo">
        <button type="button" class="fp-btn fp-sair" data-fp="sair"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Voltar ao mapa</button>
        <div class="fp-instrucao" aria-live="polite" aria-atomic="true">
          <span class="fp-seta" aria-hidden="true"><svg><use href="#d-reto"/></svg></span>
          <div><span class="fp-meta"></span><strong class="fp-texto"></strong><span class="fp-depois"></span></div>
        </div>
      </div>
      <canvas class="fp-mini" width="400" height="250" aria-hidden="true"></canvas>
      <div class="fp-base">
        <div class="fp-progresso" aria-hidden="true"><i></i></div>
        <div class="fp-controles">
          <button type="button" class="fp-btn fp-girar" data-fp="esq" aria-label="Olhar para a esquerda"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 7H4V2M4.5 7A9 9 0 1 1 3 13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <button type="button" class="fp-btn" data-fp="tras">Recuar</button>
          <button type="button" class="fp-btn fp-frente" data-fp="frente">Avançar</button>
          <button type="button" class="fp-btn fp-girar" data-fp="dir" aria-label="Olhar para a direita"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M15 7h5V2M19.5 7A9 9 0 1 0 21 13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        </div>
        <div class="fp-opcoes">
          <button type="button" class="fp-btn" data-fp="auto" aria-pressed="false">Percorrer sozinho</button>
          <button type="button" class="fp-btn" data-fp="destino">Olhar o destino</button>
          <button type="button" class="fp-btn" data-fp="tela" aria-pressed="false">Tela cheia</button>
        </div>
      </div>
      <div class="fp-chegada" hidden>
        <div class="fp-chegada-caixa" role="alert">
          <svg class="fp-chegada-ico" aria-hidden="true" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="#FFCB2E"/><path d="M14 25l7 7 14-15" fill="none" stroke="#12233F" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <strong>Você chegou!</strong>
          <p class="fp-chegada-texto"></p>
          <div class="fp-chegada-btns">
            <button type="button" class="fp-btn fp-frente" data-fp="fechar">Continuar olhando</button>
            <button type="button" class="fp-btn" data-fp="sair">Voltar ao mapa</button>
          </div>
        </div>
      </div>`;
    container.appendChild(hud);
    const $h = sel => hud.querySelector(sel);
    const yawDe = (dx, dy) => Math.atan2(-dx, -dy);
    const difAng = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
    const distSeg = (p, a, b) => {
      const vx = b.x - a.x, vy = b.y - a.y, L = vx * vx + vy * vy;
      const u = L ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / L)) : 0;
      return Math.hypot(p.x - (a.x + vx * u), p.y - (a.y + vy * u));
    };

    function prepararTrechos(E) {
      const r = E.rota, passos = r.passos;
      return r.trechos.map((t, ti) => {
        const am = [];
        let pontos = t.pontos.slice();
        if (ti === 0 && pontos.length > 2) pontos.shift();                       // não começa dentro da loja de origem
        if (ti === r.trechos.length - 1 && pontos.length > 2) pontos.pop();      // para no corredor, em frente ao destino
        for (let i = 1; i < pontos.length; i++) {
          const a = pontos[i - 1], b = pontos[i], L = Math.hypot(b.x - a.x, b.y - a.y);
          if (L < 0.5) continue;
          const n = Math.max(1, Math.round(L / PASSO_FP));
          for (let k = am.length ? 1 : 0; k <= n; k++) am.push({ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n });
        }
        if (!am.length) am.push({ x: pontos[0].x, y: pontos[0].y });
        // direção de cada ponto: olha ~50 unidades à frente
        am.forEach((s, i) => {
          let j = i, d = 0;
          while (j < am.length - 1 && d < 50) { d += Math.hypot(am[j + 1].x - am[j].x, am[j + 1].y - am[j].y); j++; }
          let alvo = am[j];
          if (j === i && i > 0) { const p = am[i - 1]; s.yaw = yawDe(s.x - p.x, s.y - p.y); return; }
          s.yaw = j === i ? 0 : yawDe(alvo.x - s.x, alvo.y - s.y);
        });
        // qual passo da lista corresponde a cada ponto
        const ids = passos.map((p, k) => k).filter(k => passos[k].piso === t.piso && !['elevador', 'escada', 'chegada'].includes(passos[k].tipo));
        const deste = [];
        // passos deste trecho: os que ficam entre as conexões
        let trechoAtual = 0;
        passos.forEach((p, k) => { if (p.tipo === 'elevador' || p.tipo === 'escada') trechoAtual++; else if (trechoAtual === ti && ids.includes(k)) deste.push(k); });
        let ptr = 0;
        am.forEach(s => {
          while (ptr < deste.length - 1) {
            const a = passos[deste[ptr]], b = passos[deste[ptr + 1]];
            if (distSeg(s, b.de, b.ate) <= distSeg(s, a.de, a.ate) + 0.01) ptr++; else break;
          }
          s.passo = deste.length ? deste[ptr] : 0;
        });
        const conexao = t.saida ? passos.findIndex((p, k) => (p.tipo === 'elevador' || p.tipo === 'escada') && passos.slice(0, k).filter(q => q.tipo === 'elevador' || q.tipo === 'escada').length === ti) : -1;
        return { piso: t.piso, saida: t.saida, amostras: am, conexao };
      });
    }

    let setasChao = [];
    const geoSeta = (() => {
      const sh = new T.Shape([new T.Vector2(0, 7), new T.Vector2(8, -1), new T.Vector2(5, -4), new T.Vector2(0, 1), new T.Vector2(-5, -4), new T.Vector2(-8, -1)]);
      const g = new T.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); return g;
    })();
    function desenharSetasChao(E) {
      const t = fp.trechos[fp.ti];
      const pts = t.amostras;
      // linha fina no chão + setas a cada passo de amostragem
      setasChao = [];
      const linha = tubo(pts.map(p => P(p.x, p.y, t.piso, 0.4)), 0.9, M.seta);
      if (linha) { linha.mesh.castShadow = false; grupoRota.add(linha.mesh); }
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const m = new T.Vector3((a.x + b.x) / 2, 0, (a.y + b.y) / 2);
        const yaw = yawDe(b.x - a.x, b.y - a.y);
        const borda = new T.Mesh(geoSeta, M.setaBorda); borda.scale.setScalar(0.85);
        const seta = new T.Mesh(geoSeta, M.seta); seta.scale.setScalar(0.62);
        for (const [o, h] of [[borda, 0.6], [seta, 0.8]]) { o.position.copy(P(m.x, m.z, t.piso, h)); o.rotation.y = yaw; o.userData.px = m.x; o.userData.py = m.z; grupoRota.add(o); setasChao.push(o); }
      }
    }

    function aplicarCamera() {
      // esconde as setas que ficam embaixo dos pés (atrapalham a visão)
      for (const o of setasChao) o.visible = Math.hypot(o.userData.px - fp.x, o.userData.py - fp.y) > 16;
      // quiosques no meio do corredor ficam transparentes quando você passa por eles
      for (const m of lojas) {
        if (m.userData.tipo !== 'quiosque' || m.userData.marcada) continue;
        const l = m.userData.lugar, perto = l.piso === fp.piso && Math.hypot(l.x - fp.x, l.y - fp.y) < 46;
        m.material = perto ? M.quiosqueFantasma : M.quiosque;
      }
      camera.position.copy(P(fp.x + (fp.ox || 0), fp.y + (fp.oy || 0), fp.piso, OLHO));
      camera.rotation.set(fp.pitch, fp.yaw, 0, 'YXZ');
      pedirRender(); atualizarRotulos(); desenharMini();
    }
    function mover(i, girar = true) {
      const t = fp.trechos[fp.ti];
      i = Math.max(0, Math.min(t.amostras.length - 1, i));
      const alvo = t.amostras[i];
      const dur = reduzMovimento() ? 0 : 420;
      fp.ox = fp.oy = 0;
      fp.anim = { x0: fp.x, y0: fp.y, yaw0: fp.yaw, x1: alvo.x, y1: alvo.y, yaw1: girar ? fp.yaw + difAng(fp.yaw, alvo.yaw) : fp.yaw, t0: performance.now(), dur };
      fp.i = i;
      atualizarHud(true);
    }
    function tickPrimeiraPessoa(t) {
      if (fp.anim) {
        const a = fp.anim, u = a.dur ? Math.min(1, (t - a.t0) / a.dur) : 1, e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        fp.x = a.x0 + (a.x1 - a.x0) * e; fp.y = a.y0 + (a.y1 - a.y0) * e; fp.yaw = a.yaw0 + (a.yaw1 - a.yaw0) * e;
        if (u >= 1) fp.anim = null;
        aplicarCamera();
      } else if (fp.auto && t - (fp.ultimoAuto || 0) > 260) {
        fp.ultimoAuto = t;
        const tr = fp.trechos[fp.ti];
        if (fp.i < tr.amostras.length - 1) avancar(); else pararAuto();
      }
    }
    function pararAuto() { fp.auto = false; $h('[data-fp="auto"]').setAttribute('aria-pressed', 'false'); $h('[data-fp="auto"]').textContent = 'Percorrer sozinho'; }

    function avancar() {
      const tr = fp.trechos[fp.ti];
      if (fp.chegou) return;
      if (fp.i < tr.amostras.length - 1) { mover(fp.i + 1); return; }
      if (fp.ti < fp.trechos.length - 1) { trocarPiso(fp.ti + 1); return; }
      chegar();
    }
    function voltar() {
      if (fp.i > 0) { mover(fp.i - 1); return; }
      if (fp.ti > 0) trocarPiso(fp.ti - 1, true);
    }
    function trocarPiso(ti, paraFim) {
      pararAuto();
      fp.ti = ti; const t = fp.trechos[ti];
      fp.piso = t.piso; estado.piso = t.piso; estado.ambos = false;
      visibilidade(fp.E); desenharRota(fp.E); desenharAvisos(fp.E.avisos);
      const s = paraFim ? t.amostras[t.amostras.length - 1] : t.amostras[0];
      fp.i = paraFim ? t.amostras.length - 1 : 0; fp.x = s.x; fp.y = s.y; fp.yaw = s.yaw; fp.anim = null;
      aplicarCamera(); atualizarHud(true);
      if (!paraFim && ao.anunciar) ao.anunciar(`Você está no ${nomeAndar(t.piso)}. ${fp.E.rota.passos[t.amostras[0].passo].texto}`);
    }
    function chegar() {
      fp.chegou = true; pararAuto();
      const ult = fp.E.rota.passos[fp.E.rota.passos.length - 1];
      const texto = ult.texto.replace(/^Você chegou:\s*/, '');
      $h('.fp-chegada-texto').textContent = texto.charAt(0).toUpperCase() + texto.slice(1);
      $h('.fp-chegada').hidden = false;
      $h('[data-fp="fechar"]').focus();
      if (ao.anunciar) ao.anunciar('Você chegou! ' + texto);
      atualizarHud(false);
    }
    function olharDestino() {
      const d = fp.E.destino; if (!d) return;
      if (d.piso !== fp.piso) { if (ao.anunciar) ao.anunciar(`O destino fica no ${nomeAndar(d.piso)}.`); return; }
      // dá alguns passos para trás (como do outro lado do corredor) para ver a fachada inteira
      const dx = d.x - fp.x, dy = d.y - fp.y, L = Math.hypot(dx, dy) || 1;
      fp.ox = -dx / L * 48; fp.oy = -dy / L * 48;
      fp.anim = { x0: fp.x, y0: fp.y, yaw0: fp.yaw, x1: fp.x, y1: fp.y, yaw1: fp.yaw + difAng(fp.yaw, yawDe(dx, dy)), t0: performance.now(), dur: reduzMovimento() ? 0 : 500 };
      fp.pitch = 0.12;
    }
    function girar(delta) { fp.anim = { x0: fp.x, y0: fp.y, yaw0: fp.yaw, x1: fp.x, y1: fp.y, yaw1: fp.yaw + delta, t0: performance.now(), dur: reduzMovimento() ? 0 : 260 }; }

    function atualizarHud(falar) {
      const E = fp.E, t = fp.trechos[fp.ti], s = t.amostras[fp.i];
      const passos = E.rota.passos;
      const noFim = fp.i === t.amostras.length - 1;
      let k = s.passo, principal = passos[k];
      if (noFim && t.saida && t.conexao >= 0) { k = t.conexao; principal = passos[k]; }
      else if (noFim && fp.ti === fp.trechos.length - 1) { k = passos.length - 1; principal = passos[k]; }
      const prox = passos[k + 1];
      const meioIcone = ['elevador', 'escada', 'escada_rolante', 'rampa', 'plataforma'].includes(principal.rotulo) ? 'c-' + principal.rotulo : null;
      $h('.fp-seta use').setAttribute('href', '#' + (meioIcone || SETA_HUD[principal.tipo] || 'd-reto'));
      $h('.fp-seta').classList.toggle('destaque', !!meioIcone || ['elevador', 'escada', 'chegada'].includes(principal.tipo));
      $h('.fp-meta').textContent = `${nomeAndar(t.piso)}, passo ${k + 1} de ${passos.length}`;
      $h('.fp-texto').textContent = principal.texto;
      $h('.fp-depois').textContent = prox && !noFim ? 'Depois: ' + prox.texto : '';
      const frente = $h('.fp-controles [data-fp="frente"]');
      frente.textContent = noFim && t.saida ? `${fp.trechos[fp.ti + 1].piso > t.piso ? 'Subir' : 'Descer'} para o ${nomeAndar(fp.trechos[fp.ti + 1].piso)}` : noFim ? 'Chegar' : 'Avançar';
      frente.disabled = !!fp.chegou;
      $h('.fp-controles [data-fp="tras"]').disabled = fp.ti === 0 && fp.i === 0;
      // progresso total da rota
      const total = fp.trechos.reduce((a, tr) => a + tr.amostras.length, 0);
      const feito = fp.trechos.slice(0, fp.ti).reduce((a, tr) => a + tr.amostras.length, 0) + fp.i + 1;
      $h('.fp-progresso i').style.width = (100 * feito / total).toFixed(1) + '%';
      if (falar && k !== fp.ultimoPassoFalado) { fp.ultimoPassoFalado = k; if (ao.anunciar) ao.anunciar(`Passo ${k + 1}. ${principal.texto}`); }
    }

    // minimapa: planta do piso com a sua posição e para onde está olhando
    function desenharMini() {
      const cv = $h('.fp-mini'); if (!cv || cv.offsetParent === null) return;
      const g = cv.getContext('2d'), W = cv.width, H = cv.height, b = D.pisos[fp.piso], pad = 14;
      const k = Math.min((W - pad * 2) / (b.maxX - b.minX), (H - pad * 2) / (b.maxY - b.minY));
      const ox = (W - (b.maxX - b.minX) * k) / 2 - b.minX * k, oy = (H - (b.maxY - b.minY) * k) / 2 - b.minY * k;
      const X = x => ox + x * k, Y = y => oy + y * k;
      g.clearRect(0, 0, W, H);
      g.fillStyle = cssVar('--mapa-piso', '#FFFFFF'); g.fillRect(0, 0, W, H);
      g.fillStyle = cssVar('--mapa-loja', '#C9D3DF'); g.strokeStyle = cssVar('--mapa-parede', '#6B7A8C'); g.lineWidth = 1;
      for (const poly of D.plantas[fp.piso] || []) { g.beginPath(); poly.forEach(([x, y], i) => i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))); g.closePath(); g.fill(); g.stroke(); }
      const t = fp.trechos[fp.ti];
      g.strokeStyle = cssVar('--mapa-rota', '#0B4FA8'); g.lineWidth = 5; g.lineJoin = g.lineCap = 'round';
      g.beginPath(); t.amostras.forEach((p, i) => i ? g.lineTo(X(p.x), Y(p.y)) : g.moveTo(X(p.x), Y(p.y))); g.stroke();
      const d = fp.E.destino;
      if (d && d.piso === fp.piso) { g.fillStyle = cssVar('--mapa-destino', '#FFC62E'); g.strokeStyle = cssVar('--mapa-destino-borda', '#0D1B2A'); g.lineWidth = 3; g.beginPath(); g.arc(X(d.x), Y(d.y), 9, 0, Math.PI * 2); g.fill(); g.stroke(); }
      // você: ponto + cone de visão
      const fx = -Math.sin(fp.yaw), fy = -Math.cos(fp.yaw), ang = Math.atan2(fy, fx), abert = (camera.fov * camera.aspect * Math.PI / 180) / 2;
      g.globalAlpha = 0.28; g.fillStyle = cssVar('--mapa-rota', '#0B4FA8');
      g.beginPath(); g.moveTo(X(fp.x), Y(fp.y)); g.arc(X(fp.x), Y(fp.y), 38, ang - Math.min(abert, 1), ang + Math.min(abert, 1)); g.closePath(); g.fill();
      g.globalAlpha = 1;
      g.fillStyle = cssVar('--mapa-rota', '#0B4FA8'); g.strokeStyle = cssVar('--mapa-rota-contorno', '#FFFFFF'); g.lineWidth = 3;
      g.beginPath(); g.arc(X(fp.x), Y(fp.y), 8, 0, Math.PI * 2); g.fill(); g.stroke();
    }

    function rotulosPrimeiraPessoa(w, h, cabe) {
      const fwdX = -Math.sin(fp.yaw), fwdY = -Math.cos(fp.yaw);
      const lista = rotulosLojas.map(r => {
        const dx = r.lugar.x - fp.x, dy = r.lugar.y - fp.y, d = Math.hypot(dx, dy);
        return { r, d, frente: dx * fwdX + dy * fwdY };
      }).filter(o => o.r.lugar.piso === fp.piso && o.d < 380 && o.frente > 0 && (!fp.E.destino || o.r.lugar.id !== fp.E.destino.id))
        .sort((a, b) => a.d - b.d);
      const mostrar = new Set();
      for (const o of lista) {
        const s = projetar(o.r.lugar.x, o.r.lugar.y, o.r.lugar.piso, o.r.lugar.cat === 'quiosque' ? ALT_QUIOSQUE + 4 : ALT_LOJA - 4, w, h);
        if (!s) continue;
        const lw = o.r.el.textContent.length * 7.5 + 22, lh = 26;
        if (!cabe(s[0], s[1], lw, lh)) continue;
        o.r.el.style.display = ''; o.r.el.style.transform = `translate(${s[0]}px, ${s[1]}px) translate(-50%, -100%)`;
        o.r.el.style.opacity = Math.max(0.55, 1 - o.d / 520).toFixed(2);
        mostrar.add(o.r);
      }
      rotulosLojas.forEach(r => { if (!mostrar.has(r)) { r.el.style.display = 'none'; r.el.style.opacity = ''; } });
    }

    function entrarPrimeiraPessoa(E) {
      if (!E.rota) return false;
      if (fp) sairPrimeiraPessoa(true);
      fp = { E, rota: E.rota, trechos: prepararTrechos(E), ti: 0, i: 0, pitch: -0.06, auto: false, chegou: false,
        pisoAntes: estado.piso, ambosAntes: estado.ambos, ultimoPassoFalado: -1, fovAntes: camera.fov, passoApp: E.passo };
      const s = fp.trechos[0].amostras[0];
      fp.x = s.x; fp.y = s.y; fp.yaw = s.yaw; fp.piso = fp.trechos[0].piso;
      estado.piso = fp.piso; estado.ambos = false;
      controles.enabled = false;
      camera.fov = 76; camera.updateProjectionMatrix();
      icones.forEach(ic => ic.scale.set(15, 15, 1)); // placas de serviço menores na altura dos olhos
      const fundo = new T.Color(cssVar('--mapa-fundo', '#DCE2E9'));
      cena.background = fundo; cena.fog = new T.Fog(fundo, 300, 1300);
      visibilidade(E); desenharRota(E); desenharAvisos(E.avisos);
      hud.hidden = false; $h('.fp-chegada').hidden = true;
      areaMapa.classList.add('em-fp');
      aplicarCamera(); atualizarHud(true);
      $h('.fp-controles [data-fp="frente"]').focus({ preventScroll: true });
      return true;
    }
    function sairPrimeiraPessoa(silencioso) {
      if (!fp) return;
      const antes = fp; fp = null;
      areaMapa.classList.remove('em-fp', 'fp-tela-cheia');
      hud.hidden = true;
      cena.fog = null; cena.background = new T.Color(cssVar('--mapa-fundo', '#DCE2E9'));
      camera.fov = 38; camera.updateProjectionMatrix();
      icones.forEach(ic => ic.scale.set(30, 30, 1));
      controles.enabled = true;
      estado.piso = antes.pisoAntes; estado.ambos = antes.ambosAntes;
      visibilidade(antes.E); desenharRota(antes.E); desenharAvisos(antes.E.avisos);
      rotulosLojas.forEach(r => { r.el.style.opacity = ''; });
      for (const m of lojas) if (m.userData.tipo === 'quiosque' && m.material === M.quiosqueFantasma) m.material = M.quiosque;
      const t = antes.E.rota && antes.E.rota.trechos.find(t => t.piso === estado.piso);
      if (t) focar(t.pontos, t.piso); else ajustar();
      if (!silencioso && ao.saiuPrimeiraPessoa) ao.saiuPrimeiraPessoa();
    }
    function irParaPassoFP(k) {
      for (let ti = 0; ti < fp.trechos.length; ti++) {
        const i = fp.trechos[ti].amostras.findIndex(s => s.passo === k);
        if (i >= 0) { if (ti !== fp.ti) trocarPiso(ti); fp.chegou = false; $h('.fp-chegada').hidden = true; mover(i); return; }
      }
    }

    // controles da primeira pessoa
    hud.addEventListener('click', ev => {
      const b = ev.target.closest('[data-fp]'); if (!b || !fp) return;
      const a = b.dataset.fp;
      if (a === 'sair') sairPrimeiraPessoa();
      else if (a === 'frente') avancar();
      else if (a === 'tras') voltar();
      else if (a === 'esq') girar(Math.PI / 6);
      else if (a === 'dir') girar(-Math.PI / 6);
      else if (a === 'destino') olharDestino();
      else if (a === 'fechar') { $h('.fp-chegada').hidden = true; $h('[data-fp="destino"]').focus(); }
      else if (a === 'auto') { fp.auto = !fp.auto; b.setAttribute('aria-pressed', fp.auto); b.textContent = fp.auto ? 'Pausar' : 'Percorrer sozinho'; }
      else if (a === 'tela') { const on = !areaMapa.classList.contains('fp-tela-cheia'); areaMapa.classList.toggle('fp-tela-cheia', on); b.setAttribute('aria-pressed', on); b.textContent = on ? 'Sair da tela cheia' : 'Tela cheia'; }
    });
    // arrastar para olhar em volta; toque/clique sem arrastar anda para frente (como no Street View)
    let olhar = null;
    renderer.domElement.addEventListener('pointerdown', ev => {
      if (!fp) return;
      olhar = { x: ev.clientX, y: ev.clientY, yaw: fp.yaw, pitch: fp.pitch, moveu: false };
      renderer.domElement.setPointerCapture?.(ev.pointerId);
    });
    renderer.domElement.addEventListener('pointermove', ev => {
      if (!fp || !olhar) return;
      const dx = ev.clientX - olhar.x, dy = ev.clientY - olhar.y;
      if (!olhar.moveu && Math.hypot(dx, dy) < 6) return;
      olhar.moveu = true; fp.anim = null;
      const k = (camera.fov * Math.PI / 180) / container.clientHeight;
      fp.yaw = olhar.yaw + dx * k; fp.pitch = Math.max(-0.7, Math.min(0.55, olhar.pitch + dy * k));
      aplicarCamera();
    });
    renderer.domElement.addEventListener('pointerup', ev => {
      if (!fp || !olhar) return;
      const clicou = !olhar.moveu; olhar = null;
      if (clicou && !fp.chegou) avancar();
    });
    renderer.domElement.addEventListener('wheel', ev => { if (!fp) return; ev.preventDefault(); zoom(ev.deltaY > 0 ? 1.08 : 1 / 1.08); }, { passive: false });
    areaMapa.addEventListener('keydown', ev => {
      if (!fp || ev.target.closest('input, select, textarea')) return;
      const acoes = { ArrowUp: avancar, w: avancar, ArrowDown: voltar, s: voltar, ArrowLeft: () => girar(Math.PI / 12), a: () => girar(Math.PI / 12),
        ArrowRight: () => girar(-Math.PI / 12), d: () => girar(-Math.PI / 12), Escape: () => sairPrimeiraPessoa() };
      if (acoes[ev.key] && !(ev.key.startsWith('Arrow') && ev.target.closest('button') && false)) { ev.preventDefault(); acoes[ev.key](); }
    });

    // ---------- laço de desenho ----------
    let ativo = false, precisa = true;
    function pedirRender() { precisa = true; }
    function quadro(t) {
      if (!ativo) return;
      requestAnimationFrame(quadro);
      if (fp) tickPrimeiraPessoa(t); else controles.update();
      if (precisa) { renderer.render(cena, camera); precisa = false; }
    }
    function redimensionar() {
      const w = container.clientWidth, h = container.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
      camera.aspect = w / h; camera.updateProjectionMatrix(); pedirRender(); atualizarRotulos();
    }
    new ResizeObserver(redimensionar).observe(container);

    let primeira = true;
    return {
      mostrar(on) {
        container.hidden = !on; ativo = on;
        if (on) { redimensionar(); if (primeira) { primeira = false; ajustar(); } requestAnimationFrame(quadro); pedirRender(); }
      },
      atualizar(E, opcoes = {}) {
        if (fp) {
          if (E.rota !== fp.rota) sairPrimeiraPessoa();
          else { if (E.passo !== fp.passoApp) { fp.passoApp = E.passo; irParaPassoFP(E.passo); } return false; }
        }
        const mudouPiso = estado.piso !== E.piso;
        estado.piso = E.piso; mostrarTodos = !!E.nomes;
        if (opcoes.ambos != null) estado.ambos = opcoes.ambos;
        visibilidade(E); desenharRota(E); desenharAvisos(E.avisos); pedirRender(); atualizarRotulos();
        return mudouPiso;
      },
      ajustar() { if (!fp) ajustar(); }, focar(p, piso) { if (!fp) focar(p, piso); }, zoom, vistaDeCima,
      primeiraPessoa: entrarPrimeiraPessoa,
      sairPrimeiraPessoa(silencioso) { sairPrimeiraPessoa(silencioso); },
      get emPrimeiraPessoa() { return !!fp; },
      ambos(on) { estado.ambos = on; },
      get emAmbos() { return estado.ambos; },
      cores() {
        criarMateriais(); reaplicarMateriais();
        for (const cat of Object.keys(cacheTex)) pintarIcone(cat, cacheTex[cat].c, cacheTex[cat].t);
        if (texAviso) { texAviso.dispose(); texAviso = null; }
        if (fp) { const f = new T.Color(cssVar('--mapa-fundo', '#DCE2E9')); cena.background = f; cena.fog = new T.Fog(f, 300, 1300); }
        pedirRender();
      },
      renderer
    };

    function reaplicarMateriais() {
      for (const piso of PISOS) grupos[piso].traverse(o => {
        if (!o.isMesh || o.userData.glb) return;
        const u = o.userData;
        if (u.tipo === 'laje') o.material = [M.piso, M.borda];
        else if (u.sobre) o.material = M.invisivel;
        else if (u.tipo === 'loja') o.material = u.historico ? (o.geometry.type === 'ExtrudeGeometry' && Array.isArray(o.material) ? [M.historicoTeto, M.historico] : M.historicoTeto) : [M.teto, M.parede];
        else if (u.tipo === 'quiosque') o.material = M.quiosque;
        else if (u.tipo === 'entrada') o.material = materialEntrada(u.lugar);
        else if (o.geometry.type === 'CylinderGeometry') o.material = M.borda;
        u.marcada = false; u.matHover = null;
      });
      if (poco) poco.material = M.vidro;
    }
  }

  window.NaviMapa3D = { iniciar, suportaWebGL };
})();
