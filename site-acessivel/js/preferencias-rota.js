/* Navi — preferências de rota que mudam o caminho escolhido, sem mudar o motor (js/rotas.js):
   o motor soma o custo de cada aresta; aqui fica quanto cada tipo de aresta "pesa" para cada pessoa.

   RN64 (proposta) — pessoas cegas ("Preferir piso tátil"): trechos a pé sem piso tátil pesam 5 vezes
   mais, e a escada sem braille só entra se não houver outro jeito. O passo a passo avisa onde o piso
   tátil acaba e onde recomeça.
   RN65 (proposta) — mobilidade reduzida ("Evitar escadas"): escadas ficam fora (RN15); a rampa só entra
   quando não há elevador funcionando até o andar; passagens com menos de 1,20 m pesam um pouco mais. */
(function (raiz) {
  'use strict';
  const PESO_SEM_TATIL = 5;          // um metro sem piso tátil "vale" cinco com piso tátil
  const PESO_ESCADA_SEM_BRAILLE = 4000;
  const PESO_RAMPA_COM_ELEVADOR = 5000;   // maior que qualquer volta até o elevador no mesmo andar
  const LARGURA_CONFORTAVEL = 1.2;   // metros
  const PESO_PASSAGEM_ESTREITA = 1.5;

  /** O que o local tem marcado na planta (um local sem piso tátil nem braille no grafo não muda de rota). */
  function recursos(G) {
    if (!G) return { tatil: true, braille: true };
    if (!G._recursosAcess) {
      let tatil = false, braille = false;
      for (const lista of Object.values(G.viz)) for (const e of lista) {
        if (e.tatil && e.tatil !== 'nenhum') tatil = true;
        if (e.braille) braille = true;
      }
      Object.defineProperty(G, '_recursosAcess', { value: { tatil, braille }, enumerable: false });
    }
    return G._recursosAcess;
  }

  /** Opções do motor para as preferências da pessoa (G: o grafo do local, para saber o que ele tem). */
  function opcoes(prefs, bloqueados, G) {
    const tem = recursos(G);
    const o = { semEscadas: !!prefs.evitarEscadas, preferirPisoTatil: !!prefs.preferirPisoTatil && (tem.tatil || tem.braille), preferirElevador: !!prefs.evitarEscadas, tem };
    if (bloqueados) o.bloqueados = bloqueados;
    if (o.preferirPisoTatil || o.preferirElevador) o.custo = custo(o);
    return o;
  }

  function custo(o) {
    return e => {
      let c = e.custo;
      const aPe = e.tipo === 'corredor' && e.rotulo !== 'rampa';
      if (o.preferirPisoTatil) {
        if (o.tem.tatil && aPe && (e.tatil || 'nenhum') === 'nenhum') c *= PESO_SEM_TATIL;
        if (o.tem.braille && e.tipo === 'escada' && !e.braille) c += PESO_ESCADA_SEM_BRAILLE;
      }
      if (o.preferirElevador) {
        if (e.rotulo === 'rampa') c += PESO_RAMPA_COM_ELEVADOR;
        if (aPe && e.largura != null && e.largura < LARGURA_CONFORTAVEL) c *= PESO_PASSAGEM_ESTREITA;
      }
      return c;
    };
  }

  /* ---------- aviso de trechos sem piso tátil no passo a passo (RN64) ---------- */
  const MINIMO = 30;   // trechos sem piso tátil menores que isso (≈ 1,5 m, como atravessar uma porta) não viram aviso

  function arestaEntre(G, u, v) {
    let e = null;
    for (const x of G.viz[u]) if (x.para === v && (!e || x.custo < e.custo)) e = x;
    return e;
  }
  const distSeg = (p, a, b) => {
    const vx = b.x - a.x, vy = b.y - a.y, L = vx * vx + vy * vy;
    const t = L ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / L)) : 0;
    return Math.hypot(p.x - a.x - vx * t, p.y - a.y - vy * t);
  };
  function passoMaisPerto(r, no) {
    let melhor = -1, d = Infinity;
    r.passos.forEach((p, i) => {
      if (p.piso !== no.piso || p.tipo === 'chegada') return;
      const dd = distSeg(no, p.de, p.ate);
      if (dd < d) { d = dd; melhor = i; }
    });
    return melhor;
  }

  /**
   * Marca no passo a passo onde o piso tátil acaba e onde recomeça. Muda r.passos[i].texto e
   * devolve um resumo: 'inteiro' (todo o caminho a pé tem piso tátil), 'parcial' ou 'nenhum'.
   */
  function anotarPisoTatil(G, r) {
    if (!r || !r.nos || r.nos.length < 2) return null;
    const lacunas = [];
    let atual = null, comTatil = 0;
    for (let k = 1; k < r.nos.length; k++) {
      const u = r.nos[k - 1], v = r.nos[k], e = arestaEntre(G, u, v);
      const aPe = e && e.tipo === 'corredor' && e.rotulo !== 'rampa';
      const L = Math.hypot(G.nos[v].x - G.nos[u].x, G.nos[v].y - G.nos[u].y);
      if (aPe && (e.tatil || 'nenhum') === 'nenhum') {
        if (!atual || G.nos[atual.fim].piso !== G.nos[v].piso) { if (atual) lacunas.push(atual); atual = { ini: u, fim: v, L: 0, k0: k - 1 }; }
        atual.fim = v; atual.L += L; atual.k1 = k;
      } else {
        if (aPe) comTatil += L;
        if (atual) { lacunas.push(atual); atual = null; }
      }
    }
    if (atual) lacunas.push(atual);
    const reais = lacunas.filter(l => l.L >= MINIMO);
    r.pisoTatil = !reais.length ? 'inteiro' : comTatil < MINIMO ? 'nenhum' : 'parcial';
    if (r.pisoTatil === 'nenhum') {
      if (r.passos[0]) r.passos[0].texto += ' Este caminho não tem piso tátil.';
      return r.pisoTatil;
    }
    const notas = {};
    const nota = (i, t) => { if (i >= 0) (notas[i] = notas[i] || []).includes(t) || notas[i].push(t); };
    for (const l of reais) {
      const inicio = l.k0 === 0, fim = l.k1 === r.nos.length - 1;
      const iIni = passoMaisPerto(r, G.nos[l.ini]), iFim = passoMaisPerto(r, G.nos[l.fim]);
      if (inicio && fim) continue;
      if (fim) { nota(iIni, `Atenção: o piso tátil acaba aqui; daqui até ${r.destino.nome} não há piso tátil.`); continue; }
      if (inicio) { nota(iFim, 'O piso tátil começa no fim deste trecho.'); continue; }
      if (iIni === iFim) nota(iIni, 'Atenção: neste trecho o piso tátil falta por um pedaço.');
      else { nota(iIni, 'Atenção: o piso tátil acaba neste trecho.'); nota(iFim, 'O piso tátil recomeça no fim deste trecho.'); }
    }
    for (const [i, ts] of Object.entries(notas)) r.passos[i].texto += ' ' + ts.join(' ');
    return r.pisoTatil;
  }

  /**
   * Quando o local tem mais de uma escada fixa ou mais de um elevador, o passo diz qual pegar
   * ("Pegue a Escada B") e se o corrimão tem braille. Os textos de um local com um elevador só não mudam.
   */
  function nomearEquipamentos(G, r) {
    if (!r || !r.nos || !G.lugaresDoEquipamento) return r;
    const usados = [];
    for (let k = 1; k < r.nos.length; k++) {
      const u = r.nos[k - 1], v = r.nos[k];
      if (G.nos[u].piso === G.nos[v].piso) continue;
      const e = arestaEntre(G, u, v);
      if (e) usados.push({ e, piso: G.nos[u].piso });
    }
    const quantos = tipo => new Set(G.places.filter(l => l.cat === tipo).map(l => G.equipamentoDoLugar(l.id)).filter(Boolean)).size;
    let i = 0;
    for (const p of r.passos) {
      if (!p.rotulo) continue;
      const uso = usados[i++];
      if (!uso || !uso.e.equipamento || !['escada', 'elevador'].includes(p.rotulo) || quantos(p.rotulo) < 2) continue;
      const lugar = G.lugaresDoEquipamento(uso.e.equipamento).map(id => G.lugarPorId[id]).find(l => l && l.piso === uso.piso);
      if (!lugar) continue;
      const artigo = p.rotulo === 'elevador' ? 'o' : 'a';
      p.texto = p.texto.replace(/^Pegue (a escada|o elevador) /, `Pegue ${artigo} ${lugar.nome} `);
      if (p.rotulo === 'escada' && recursos(G).braille) p.texto += uso.e.braille ? ' O corrimão tem braille.' : ' Esta escada não tem braille no corrimão.';
    }
    return r;
  }

  /** Calcula a rota com as preferências, diz qual escada ou elevador pegar e marca o piso tátil, quando pedido. */
  function rota(R, G, origem, destino, prefs, bloqueados) {
    const o = opcoes(prefs, bloqueados, G);
    const r = R.rota(G, origem, destino, o);
    if (r) nomearEquipamentos(G, r);
    if (r && o.preferirPisoTatil && o.tem.tatil) anotarPisoTatil(G, r);
    return r;
  }

  const api = { opcoes, custo, recursos, anotarPisoTatil, nomearEquipamentos, rota, PESO_SEM_TATIL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else raiz.NaviPreferenciasRota = api;
})(typeof window !== 'undefined' ? window : globalThis);
