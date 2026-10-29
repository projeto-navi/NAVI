/* Navi — leitor de .glb para o 3D dos locais que têm modelo (config.modelo3d).
   Lê só o que os modelos do Navi usam: malhas com posição, normal e UV, materiais PBR com cor,
   transparência e textura PNG embutida, e nós com nome, posição e extras. Sem animação, sem skin.
   Usa o Three.js do site (js/three-navi.min.js), que já está na página quando o 3D abre. */
(function (raiz) {
  'use strict';

  /** Baixa o .glb do local; devolve um ArrayBuffer. */
  async function baixar(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('Modelo 3D não encontrado: ' + url);
    return r.arrayBuffer();
  }

  /**
   * Monta a cena do .glb. Cada malha guarda userData.glb = true, para o 3D não trocar o material dela
   * (os realces do Navi usam peças próprias, por cima do modelo).
   * @returns {Promise<THREE.Group>}
   */
  async function ler(buf, T) {
    const dv = new DataView(buf);
    if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('O arquivo não é .glb');
    let off = 12, json = null, bin = null;
    while (off < buf.byteLength) {
      const len = dv.getUint32(off, true), tipo = dv.getUint32(off + 4, true);
      if (tipo === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, off + 8, len)));
      if (tipo === 0x004E4942) bin = buf.slice(off + 8, off + 8 + len);
      off += 8 + len;
    }
    const acessor = i => {
      const a = json.accessors[i], bv = json.bufferViews[a.bufferView];
      const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type] * a.count;
      const Tipo = a.componentType === 5126 ? Float32Array : a.componentType === 5125 ? Uint32Array : Uint16Array;
      return new Tipo(bin, (bv.byteOffset || 0) + (a.byteOffset || 0), n);
    };
    const texturas = await Promise.all((json.textures || []).map(async t => {
      const img = json.images[t.source], bv = json.bufferViews[img.bufferView];
      const blob = new Blob([new Uint8Array(bin, bv.byteOffset || 0, bv.byteLength)], { type: img.mimeType });
      const bmp = await createImageBitmap(blob);
      const tx = new T.Texture(bmp);
      tx.flipY = false; tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 4; tx.needsUpdate = true;
      return tx;
    }));
    const materiais = (json.materials || []).map(m => {
      const pbr = m.pbrMetallicRoughness || {}, c = pbr.baseColorFactor || [1, 1, 1, 1];
      const mat = new T.MeshStandardMaterial({ metalness: pbr.metallicFactor ?? 0, roughness: pbr.roughnessFactor ?? 1 });
      mat.color.setRGB(c[0], c[1], c[2], T.LinearSRGBColorSpace);
      if (m.alphaMode === 'BLEND') { mat.transparent = true; mat.opacity = c[3]; mat.depthWrite = false; }
      if (m.doubleSided) mat.side = T.DoubleSide;
      if (m.emissiveFactor) mat.emissive.setRGB(m.emissiveFactor[0], m.emissiveFactor[1], m.emissiveFactor[2], T.LinearSRGBColorSpace);
      if (pbr.baseColorTexture) mat.map = texturas[pbr.baseColorTexture.index];
      if (m.emissiveTexture) mat.emissiveMap = texturas[m.emissiveTexture.index];
      mat.name = m.name || '';
      return mat;
    });
    const geos = (json.meshes || []).map(me => me.primitives.map(p => {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(acessor(p.attributes.POSITION), 3));
      g.setAttribute('normal', new T.BufferAttribute(acessor(p.attributes.NORMAL), 3));
      if (p.attributes.TEXCOORD_0 !== undefined) g.setAttribute('uv', new T.BufferAttribute(acessor(p.attributes.TEXCOORD_0), 2));
      g.setIndex(new T.BufferAttribute(acessor(p.indices), 1));
      return { g, m: p.material };
    }));
    function no(i) {
      const n = json.nodes[i], grupo = new T.Group();
      grupo.name = n.name || ''; grupo.userData = Object.assign({ glb: true }, n.extras || {});
      if (n.translation) grupo.position.fromArray(n.translation);
      if (n.rotation) grupo.quaternion.fromArray(n.rotation);
      if (n.scale) grupo.scale.fromArray(n.scale);
      if (n.mesh !== undefined) for (const { g, m } of geos[n.mesh]) {
        const malha = new T.Mesh(g, materiais[m]);
        malha.userData = { glb: true };
        malha.matrixAutoUpdate = false;
        grupo.add(malha);
      }
      for (const f of n.children || []) grupo.add(no(f));
      if (grupo.userData.estado_inicial === 'oculto') grupo.visible = false;
      return grupo;
    }
    const cena = new T.Group();
    for (const i of json.scenes[json.scene || 0].nodes) cena.add(no(i));
    return cena;
  }

  raiz.NaviGLB = { baixar, ler };
})(typeof window !== 'undefined' ? window : globalThis);
