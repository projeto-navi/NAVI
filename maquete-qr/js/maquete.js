/* Navi — maquete 3D do Shopping Estação que vira QR Code quando vista de cima.
   A maquete usa a mesma planta do mapa (contornos das lojas, quiosques, acessos, os dois pisos).
   A base é feita dos módulos do QR Code: de lado parece um piso de pedras; de cima vira o código. */
(function () {
  'use strict';
  const T = window.THREE, D = window.NAVI_DADOS, L3 = (window.NAVI_3D || {}).lajes || {};
  const CONFIG = window.NAVI_CONFIG || {};
  const URL_SITE = CONFIG.urlSite || 'https://navi-map.netlify.app/';
  const $ = id => document.getElementById(id);
  const reduz = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  const qr = window.NaviQR.gerar(URL_SITE, 'Q');
  const N = qr.tamanho, MARGEM = 4, G = N + MARGEM * 2, C = 10;        // módulos, margem obrigatória, grade total, tamanho da célula
  const BORDA = 3;                                                     // anel decorativo com jardim
  const meio = G * C / 2;
  const centroCel = (i, j) => [(i + 0.5) * C - meio, (j + 0.5) * C - meio];

  // ---------- cena ----------
  const area = $('cena');
  const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  area.appendChild(renderer.domElement);
  const cena = new T.Scene();
  cena.background = new T.Color('#E0E5EC');
  const camera = new T.PerspectiveCamera(32, 1, 10, 6000);
  const ctl = new T.OrbitControls(camera, renderer.domElement);
  ctl.enableDamping = true; ctl.dampingFactor = 0.08; ctl.enablePan = false;
  ctl.minDistance = 380; ctl.maxDistance = 1500; ctl.minPolarAngle = 0; ctl.maxPolarAngle = 1.32;
  ctl.target.set(0, 0, 0);
  cena.add(new T.HemisphereLight(0xffffff, 0xaab4c4, 1.35));
  const sol = new T.DirectionalLight(0xffffff, 1.6);
  sol.position.set(-420, 900, 520); sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -320, right: 320, top: 320, bottom: -320, near: 100, far: 2400 });
  sol.shadow.bias = -0.0006;
  cena.add(sol);

  // ---------- base e jardim ----------
  const ladoTotal = (G + BORDA * 2) * C;
  const base = new T.Mesh(new T.BoxGeometry(ladoTotal, 14, ladoTotal), new T.MeshStandardMaterial({ color: '#CDD5DF', roughness: 0.9 }));
  base.position.y = -7; base.receiveShadow = true; cena.add(base);
  // gramado só no anel externo (fica abaixo dos módulos para não "brigar" com eles)
  const borda = new T.Mesh(new T.BoxGeometry(ladoTotal - 4, 0.4, ladoTotal - 4), new T.MeshStandardMaterial({ color: '#B9D3A8', roughness: 1 }));
  borda.position.y = 0.2; borda.receiveShadow = true; cena.add(borda);
  // arbustos no anel externo (fora da margem do QR, então não atrapalham a leitura)
  const arbustos = [];
  const geoArb = new T.IcosahedronGeometry(1, 0);
  const coresArb = ['#5E9F57', '#79B465', '#4C8A4F', '#8CC07A'];
  const matArb = new T.MeshStandardMaterial({ roughness: 0.85, flatShading: true });
  const imArb = new T.InstancedMesh(geoArb, matArb, 4 * (G + BORDA * 2) * BORDA);
  let na = 0; const tmp = new T.Object3D(), cor = new T.Color();
  let semente = 7; const rnd = () => (semente = (semente * 16807) % 2147483647) / 2147483647;
  for (let j = -BORDA; j < G + BORDA; j++) for (let i = -BORDA; i < G + BORDA; i++) {
    if (i >= 0 && i < G && j >= 0 && j < G) continue;
    if (rnd() < 0.35) continue;
    const [x, z] = centroCel(i, j), r = 2.6 + rnd() * 3.2;
    arbustos.push({ x: x + (rnd() - .5) * 4, z: z + (rnd() - .5) * 4, r, rot: rnd() * 6 });
    imArb.setColorAt(na++, cor.set(coresArb[Math.floor(rnd() * coresArb.length)]));
  }
  imArb.count = arbustos.length; imArb.castShadow = true; cena.add(imArb);

  // ---------- módulos do QR (piso da maquete) ----------
  const celulas = [];
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const qi = i - MARGEM, qj = j - MARGEM;
    const dentro = qi >= 0 && qj >= 0 && qi < N && qj < N;
    const escuro = dentro && qr.modulos[qj][qi];
    const finder = dentro && ((qi < 7 && qj < 7) || (qi >= N - 7 && qj < 7) || (qi < 7 && qj >= N - 7));
    const [x, z] = centroCel(i, j);
    const d = Math.hypot(x, z) / (meio * 1.42);
    celulas.push({ x, z, escuro, finder, atraso: d });
  }
  const imCel = new T.InstancedMesh(new T.BoxGeometry(C * 0.96, 1, C * 0.96), new T.MeshStandardMaterial({ roughness: 0.7 }), celulas.length);
  imCel.receiveShadow = true; cena.add(imCel);
  const COR = {
    pisoClaro: new T.Color('#ECEFF3'), pisoEscuro: new T.Color('#C4CCD7'),
    qrClaro: new T.Color('#FFFFFF'), qrEscuro: new T.Color('#173B8C'), qrFinder: new T.Color('#1A5FD6')
  };

  // ---------- o shopping (mesma planta do mapa) ----------
  const shopping = new T.Group(); cena.add(shopping);
  const minX = Math.min(D.pisos[1].minX, D.pisos[2].minX), maxX = Math.max(D.pisos[1].maxX, D.pisos[2].maxX);
  const minY = Math.min(D.pisos[1].minY, D.pisos[2].minY), maxY = Math.max(D.pisos[1].maxY, D.pisos[2].maxY);
  const ESC = (N * C * 0.98) / (maxX - minX);
  const cxP = (minX + maxX) / 2, cyP = (minY + maxY) / 2;
  const pX = x => (x - cxP) * ESC, pZ = y => (y - cyP) * ESC;
  const BASE1 = 1.2, H1 = 9, BASE2 = 13, H2 = 8, ESP = 1.2;
  const mats = {
    laje1: new T.MeshStandardMaterial({ color: '#F4F5F7', roughness: 0.6 }),
    laje2: new T.MeshStandardMaterial({ color: '#E7EAEF', roughness: 0.6 }),
    borda: new T.MeshStandardMaterial({ color: '#BAC3CF', roughness: 0.9 }),
    parede: new T.MeshStandardMaterial({ color: '#F7F8FA', roughness: 0.8 }),
    teto: new T.MeshStandardMaterial({ color: '#AEB8C6', roughness: 0.9 }),
    parede2: new T.MeshStandardMaterial({ color: '#EEF1F6', roughness: 0.8 }),
    teto2: new T.MeshStandardMaterial({ color: '#97A3B5', roughness: 0.9 }),
    quiosque: new T.MeshStandardMaterial({ color: '#C9CDF4', roughness: 0.7 }),
    historico: new T.MeshStandardMaterial({ color: '#D8B46E', roughness: 0.85 }),
    telhado: new T.MeshStandardMaterial({ color: '#7A4A32', roughness: 0.8 }),
    vidro: new T.MeshStandardMaterial({ color: '#8FB8E8', roughness: 0.1, transparent: true, opacity: 0.5 })
  };
  const todosMats = Object.values(mats);
  function forma(pts, buracos = []) {
    const s = new T.Shape(pts.map(([x, y]) => new T.Vector2(pX(x), -pZ(y))));
    for (const h of buracos) s.holes.push(new T.Path(h.map(([x, y]) => new T.Vector2(pX(x), -pZ(y)))));
    return s;
  }
  function extr(shape, alt, y0, mat) {
    const g = new T.ExtrudeGeometry(shape, { depth: alt, bevelEnabled: false });
    g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
    const m = new T.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; shopping.add(m); return m;
  }
  const dentro = (x, y, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const museu = D.places.find(p => p.cat === 'museu');
  // Piso 1
  (L3[1] || []).forEach(l => extr(forma(l.ext, l.buracos), ESP, BASE1 - ESP, [mats.laje1, mats.borda]));
  (D.plantas[1] || []).forEach(poly => {
    if (museu && dentro(museu.x, museu.y, poly)) {
      extr(forma(poly), H1 + 2, BASE1, [mats.telhado, mats.historico]);
      // telhado em duas águas do antigo prédio da estação
      const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
      const w = (Math.max(...xs) - Math.min(...xs)) * ESC, d = (Math.max(...ys) - Math.min(...ys)) * ESC;
      const tri = new T.Shape([new T.Vector2(-d / 2, 0), new T.Vector2(d / 2, 0), new T.Vector2(0, 5)]);
      const g = new T.ExtrudeGeometry(tri, { depth: w * 0.96, bevelEnabled: false }); g.rotateY(Math.PI / 2);
      const t = new T.Mesh(g, mats.telhado); t.castShadow = true;
      t.position.set(pX((Math.min(...xs) + Math.max(...xs)) / 2) - w * 0.48, BASE1 + H1 + 2, pZ((Math.min(...ys) + Math.max(...ys)) / 2));
      shopping.add(t);
    } else extr(forma(poly), H1, BASE1, [mats.teto, mats.parede]);
  });
  // quiosques e acessos coloridos
  const CORES_ACESSO = { vermelho: '#E5484D', azul: '#3B82C4', verde: '#2FA866' };
  D.places.filter(p => p.cat === 'quiosque' || p.cat === 'entrada').forEach(p => {
    const ent = p.cat === 'entrada', alt = ent ? 1.4 : 2.6;
    const piso = p.piso === 1 ? BASE1 : BASE2;
    const m = new T.Mesh(new T.BoxGeometry(Math.max(p.w * ESC, 1.2), alt, Math.max(p.h * ESC, 1.2)),
      ent ? new T.MeshStandardMaterial({ color: CORES_ACESSO[p.nome.toLowerCase().split(' ')[1]] || '#3B82C4', roughness: 0.6 }) : mats.quiosque);
    if (ent) todosMats.push(m.material);
    m.position.set(pX(p.x), piso + alt / 2, pZ(p.y)); m.rotation.y = -(p.r || 0) * Math.PI / 180; m.castShadow = true;
    shopping.add(m);
    if (ent) { // pórtico de entrada
      const port = new T.Mesh(new T.BoxGeometry(Math.max(p.w * ESC, 1.2) + 1, 1, Math.max(p.h * ESC, 1.2) + 1), m.material);
      port.position.set(pX(p.x), BASE1 + H1 + 0.6, pZ(p.y)); port.rotation.y = m.rotation.y; port.castShadow = true; shopping.add(port);
    }
  });
  // Piso 2 (sobre pilares finos)
  (L3[2] || []).forEach(l => extr(forma(l.ext, l.buracos), ESP, BASE2 - ESP, [mats.laje2, mats.borda]));
  (D.plantas[2] || []).forEach(poly => extr(forma(poly), H2, BASE2, [mats.teto2, mats.parede2]));
  const pilar = new T.CylinderGeometry(0.5, 0.5, BASE2 - BASE1, 6);
  (L3[2] || []).forEach(l => l.ext.forEach((p, k) => {
    if (k % 6) return;
    const m = new T.Mesh(pilar, mats.borda); m.position.set(pX(p[0]), (BASE1 + BASE2) / 2, pZ(p[1])); shopping.add(m);
  }));
  // elevador de vidro
  const elev = D.places.find(p => p.cat === 'elevador');
  if (elev) { const m = new T.Mesh(new T.BoxGeometry(3.2, BASE2 + H2, 3.2), mats.vidro); m.position.set(pX(elev.x), (BASE2 + H2) / 2, pZ(elev.y)); shopping.add(m); }

  // ---------- transição maquete -> QR Code ----------
  // t = 0: maquete; t = 1: QR Code. Calculado pelo ângulo da câmera (0 = olhando de cima).
  const ANG_INICIO = 0.62, ANG_FIM = 0.1;
  const suave = x => x * x * (3 - 2 * x);
  const clamp = x => Math.max(0, Math.min(1, x));
  let tAtual = -1;
  function aplicarTransicao(t) {
    if (Math.abs(t - tAtual) < 0.002) return false;
    tAtual = t;
    const c = new T.Color();
    celulas.forEach((cel, k) => {
      const u = suave(clamp(t * 1.45 - cel.atraso * 0.45));
      const h = cel.escuro ? 1.2 + u * 2.6 : 1;
      tmp.position.set(cel.x, h / 2, cel.z); tmp.scale.set(1, h, 1); tmp.rotation.set(0, 0, 0); tmp.updateMatrix();
      imCel.setMatrixAt(k, tmp.matrix);
      const de = cel.escuro ? COR.pisoEscuro : COR.pisoClaro;
      const para = cel.escuro ? (cel.finder ? COR.qrFinder : COR.qrEscuro) : COR.qrClaro;
      imCel.setColorAt(k, c.copy(de).lerp(para, u));
    });
    imCel.instanceMatrix.needsUpdate = true; imCel.instanceColor.needsUpdate = true;
    // o shopping "afunda" no piso e some
    const m = suave(clamp(t * 1.35));
    shopping.scale.y = Math.max(0.002, 1 - m);
    shopping.visible = m < 0.995;
    const op = 1 - suave(clamp((m - 0.55) / 0.4));
    todosMats.forEach(mt => { mt.transparent = op < 1 || mt === mats.vidro; mt.opacity = mt === mats.vidro ? 0.5 * op : op; });
    arbustos.forEach((a, k) => {
      const s = a.r * (1 - suave(clamp(t * 1.3)) * 0.85);
      tmp.position.set(a.x, 0.4 + s * 0.8, a.z); tmp.scale.set(s, s * 1.2, s); tmp.rotation.set(0, a.rot, 0); tmp.updateMatrix();
      imArb.setMatrixAt(k, tmp.matrix);
    });
    imArb.instanceMatrix.needsUpdate = true;
    sol.castShadow = t < 0.9; // sem sombras sobre o QR pronto (leitura melhor)
    atualizarInterface(t);
    return true;
  }

  // ---------- interface ----------
  const pronto = $('qr-pronto'), barra = $('progresso-qr'), estado = $('estado-qr');
  let avisouPronto = false;
  function atualizarInterface(t) {
    barra.style.setProperty('--p', (t * 100).toFixed(0) + '%');
    barra.setAttribute('aria-valuenow', Math.round(t * 100));
    const ok = t > 0.985;
    pronto.hidden = !ok;
    estado.textContent = ok ? 'QR Code pronto. Aponte a câmera do celular para a tela.' : t > 0.02 ? 'Continue girando para olhar de cima…' : 'Gire a maquete para olhar de cima.';
    if (ok && !avisouPronto) { avisouPronto = true; $('anuncio').textContent = 'O QR Code apareceu. Aponte a câmera do celular para abrir o mapa.'; }
    if (!ok) avisouPronto = false;
    if ($('btn-cima').hidden !== ok) {
      $('btn-cima').hidden = ok; $('btn-maquete').hidden = !ok;
      requestAnimationFrame(() => { enquadrar(); if (ok && !anim) { const d = distanciaQR(); if (camera.position.distanceTo(ctl.target) < d * 0.98) irPara(0.0001, null, d); } });
    }
  }
  $('url-qr').textContent = URL_SITE.replace(/^https?:\/\//, '').replace(/\/$/, '');
  $('url-qr').href = URL_SITE;
  $('abrir-mapa').href = URL_SITE;

  // animação de câmera (botões)
  let anim = null;
  function irPara(polar, azim, dist) {
    const atual = new T.Spherical().setFromVector3(camera.position.clone().sub(ctl.target));
    anim = { de: atual.clone(), para: new T.Spherical(dist || atual.radius, polar, azim ?? atual.theta), t0: performance.now(), dur: reduz() ? 1 : 1400 };
    ctl.autoRotate = false; $('btn-girar').setAttribute('aria-pressed', 'false');
  }
  $('btn-cima').onclick = () => { ctl.maxDistance = Math.max(1500, distanciaQR() * 1.1); irPara(0.0001, 0, distanciaQR()); };
  $('btn-maquete').onclick = () => irPara(0.95, Math.PI / 4, Math.min(distanciaQR(), 900));
  $('btn-girar').onclick = () => { ctl.autoRotate = !ctl.autoRotate; $('btn-girar').setAttribute('aria-pressed', String(ctl.autoRotate)); };
  ctl.autoRotateSpeed = 0.8;
  renderer.domElement.addEventListener('pointerdown', () => { anim = null; });

  // baixar o QR em PNG (gerado em 2D, nítido para imprimir)
  $('baixar-qr').onclick = () => {
    const svg = window.NaviQR.svg(qr, { cor: '#173B8C' });
    const img = new Image(), cv = document.createElement('canvas'), lado = 1200;
    cv.width = lado; cv.height = lado + 140;
    img.onload = () => {
      const g = cv.getContext('2d');
      g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, cv.width, cv.height);
      g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, lado, lado);
      g.fillStyle = '#173B8C'; g.font = '700 52px "Plus Jakarta Sans", "DM Sans", sans-serif'; g.textAlign = 'center';
      g.fillText('NAVI', lado / 2, lado + 50);
      g.fillStyle = '#3D4852'; g.font = '500 30px "DM Sans", sans-serif';
      g.fillText('Mapa acessível do Shopping Estação', lado / 2, lado + 100);
      const a = document.createElement('a'); a.download = 'qr-code-navi.png'; a.href = cv.toDataURL('image/png'); a.click();
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };

  // ---------- laço ----------
  // área livre da tela (sem o painel de baixo e o topo): a cena é deslocada para ficar centralizada nela
  function areaLivre() {
    const w = area.clientWidth, h = area.clientHeight;
    const painel = document.querySelector('.painel').getBoundingClientRect();
    const cartao = document.querySelector('.pronto').getBoundingClientRect();
    const celular = w <= 760;
    const topo = !pronto.hidden && celular ? cartao.bottom + 10 : 84, baixo = h - painel.top + 12;
    const lateral = !pronto.hidden && !celular ? cartao.width + 32 : 0;
    return { w, h, topo, baixo, lateral, livreW: w - lateral, livreH: Math.max(160, h - topo - baixo) };
  }
  function enquadrar() {
    const a = areaLivre();
    camera.setViewOffset(a.w, a.h, a.lateral / 2, (a.baixo - a.topo) / 2, a.w, a.h);
    camera.updateProjectionMatrix();
  }
  // distância para o QR inteiro (com a margem) caber na área livre
  function distanciaQR() {
    const a = areaLivre(), lado = G * C * 1.12, tv = Math.tan(camera.fov * Math.PI / 360);
    const dV = (lado / 2) / tv * (a.h / a.livreH), dH = (lado / 2) / (tv * camera.aspect) * (a.w / a.livreW);
    return Math.max(dV, dH);
  }
  function redimensionar() {
    const w = area.clientWidth, h = area.clientHeight;
    renderer.setSize(w, h, false); renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
    camera.aspect = w / h; camera.updateProjectionMatrix(); enquadrar();
  }
  new ResizeObserver(redimensionar).observe(area);
  redimensionar();
  ctl.maxDistance = Math.max(1500, distanciaQR() * 1.2);
  const inicial = new T.Spherical(Math.max(distanciaQR() * (area.clientWidth < 760 ? 1.3 : 0.95), 700), 0.95, Math.PI / 4);
  ctl.maxDistance = Math.max(ctl.maxDistance, inicial.radius * 1.3);
  camera.position.setFromSpherical(inicial);
  ctl.update();
  ctl.autoRotate = !reduz();
  $('btn-girar').setAttribute('aria-pressed', String(ctl.autoRotate));
  const esf = new T.Spherical();
  function quadro(agora) {
    requestAnimationFrame(quadro);
    if (anim) {
      const u = Math.min(1, (agora - anim.t0) / anim.dur), e = u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      let dt = anim.para.theta - anim.de.theta; while (dt > Math.PI) dt -= 2 * Math.PI; while (dt < -Math.PI) dt += 2 * Math.PI;
      const s = new T.Spherical(anim.de.radius + (anim.para.radius - anim.de.radius) * e, anim.de.phi + (anim.para.phi - anim.de.phi) * e, anim.de.theta + dt * e);
      camera.position.setFromSpherical(s).add(ctl.target); camera.lookAt(ctl.target);
      if (u >= 1) anim = null;
    }
    ctl.update();
    esf.setFromVector3(camera.position.clone().sub(ctl.target));
    // girar sozinho para quando o QR começa a se formar
    if (ctl.autoRotate && esf.phi < ANG_INICIO) ctl.autoRotate = false;
    aplicarTransicao(suave(clamp((ANG_INICIO - esf.phi) / (ANG_INICIO - ANG_FIM))));
    renderer.render(cena, camera);
  }
  redimensionar();
  requestAnimationFrame(quadro);
  window.NaviMaquete = { qr, irPara, camera, ctl, get t() { return tAtual; } };
})();
