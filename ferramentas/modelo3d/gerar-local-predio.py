"""Navi — arquivos do local "predio-teste" (site-acessivel/locais/predio-teste/) a partir do modelo 3D.

Uso: python3 ferramentas/modelo3d/gerar-local-predio.py

Gera config, avisos (vazio: o prédio começa sem interdições), dados (plantas, formas e piso tátil),
grafo 1.1 (com piso tátil, braille, elevadores, rampa e larguras), malha (nula: as rotas seguem os nós),
lajes e modelo.glb (o prédio sem os obstáculos de teste).

Unidades: a planta usa 20 unidades por metro (escala_m_por_unidade = 0,05). x_planta = (x + 8) × 20 e
y_planta = (z + 1) × 20, com x e z em metros do modelo.
"""
import importlib.util
import json
import math
import os
import sys

import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
espec = importlib.util.spec_from_file_location('modelo', os.path.join(AQUI, 'gerar-predio-teste.py'))
MOD = importlib.util.module_from_spec(espec)
espec.loader.exec_module(MOD)
from glb import No, escrever_glb  # noqa: E402

RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
SAIDA = os.path.join(RAIZ, 'site-acessivel', 'locais', 'predio-teste')
SLUG, PRE = 'predio-teste', 'PCT'
U = 20.0                      # unidades da planta por metro
OX, OZ = 8.0, 1.0             # deslocamento para a planta ficar com coordenadas positivas
HOJE = '2026-10-29'
CEL, XMIN, ZMIN, NX, NZ = MOD.CEL, MOD.XMIN, MOD.ZMIN, MOD.NX, MOD.NZ


def P(x, z):
    return [round((x + OX) * U, 1), round((z + OZ) * U, 1)]


# ------------------------------------------------------------------ o que é caminhável em cada andar
ROTAS = {'P01': {'hall', 'rampa'}, 'P02': {'hall', 'rampa', 'ESCRITORIOS'}, 'P03': {'hall', 'rampa'}}
SEM_ROTA = {'ANEXOVAO'}       # o vão da rampa: a rampa é uma aresta só, de patamar a patamar

# móveis e peças fixas que a rota contorna (retângulos x0, x1, z0, z1 ou círculos ('c', x, z, r))
MOVEIS = {
    'P01': [('c', 5.25, 16.5, 2.45), (1.3, 2.95, 2.3, 4.7), (7.9, 8.7, 2.6, 3.4), (2.0, 2.8, 19.3, 20.1)],
    'P02': [(2.2, 3.0, 8.6, 9.4)] + [(x - 0.75, x + 0.75, z - 0.4, z + 0.9) for (x, z) in
                                     ((7.5, 15.5), (9.5, 15.5), (11.5, 15.5), (7.5, 18.6), (9.5, 18.6), (11.5, 18.6))],
    'P03': [(7.6, 8.4, 12.6, 13.4)] + [(x - 0.95, x + 0.95, z - 0.85, z + 0.85) for (x, z) in
                                     ((8.0, 18.2), (11.5, 18.2), (8.0, 20.6), (11.5, 20.6))],
}
# passagens de largura mínima (retângulo → largura em metros), além das portas
PASSAGENS = {'P02': [((4.8, 5.7, 12.0, 14.0), 0.90), ((9.0, 10.5, 12.0, 14.0), 1.50), ((6.0, 10.5, 27.0, 28.5), 1.50)]}


def mascaras(andar):
    esp = MOD.ESPACOS[andar]
    g, trechos = MOD.paredes(No('x'), esp, MOD.PORTAS[andar], 0.0)
    xs = XMIN + (np.arange(NX) + 0.5) * CEL
    zs = ZMIN + (np.arange(NZ) + 0.5) * CEL
    X, Z = np.meshgrid(xs, zs, indexing='ij')
    anda = np.zeros((NX, NZ), dtype=bool)
    for n, e in enumerate(esp):
        if e['grupo'] in ROTAS[andar] and e['id'] not in SEM_ROTA:
            anda |= g == n
    for ori, pos, a, b, _s in trechos:   # faixa das paredes
        if ori == 'v':
            anda &= ~((np.abs(X - pos) < 0.16) & (Z > a - 0.16) & (Z < b + 0.16))
        else:
            anda &= ~((np.abs(Z - pos) < 0.16) & (X > a - 0.16) & (X < b + 0.16))
    for ori, pos, a, b, _t, _n in MOD.PORTAS[andar]:   # vãos das portas
        if ori == 'v':
            anda |= (np.abs(X - pos) < 0.22) & (Z > a + 0.03) & (Z < b - 0.03)
        else:
            anda |= (np.abs(Z - pos) < 0.22) & (X > a + 0.03) & (X < b - 0.03)
    for m in MOVEIS.get(andar, []):
        if m[0] == 'c':
            anda &= ~(np.hypot(X - m[1], Z - m[2]) < m[3])
        else:
            anda &= ~((X > m[0]) & (X < m[1]) & (Z > m[2]) & (Z < m[3]))

    def erodir(r):
        k = int(round(r / CEL))
        out = anda.copy()
        for di in range(-k, k + 1):
            for dk in range(-k, k + 1):
                if di * di + dk * dk > k * k:
                    continue
                out &= np.roll(np.roll(anda, di, 0), dk, 1)
        return out
    return g, esp, anda, erodir(0.35), erodir(0.2)


def cel(x, z):
    return int((x - XMIN) / CEL), int((z - ZMIN) / CEL)


def livre(mask, p, q, ignorar=()):
    """O segmento p→q passa só por células livres (menos perto dos pontos em 'ignorar', como o vão de uma porta)."""
    L = math.hypot(q[0] - p[0], q[1] - p[1])
    n = max(1, int(L / 0.05))
    for k in range(n + 1):
        x = p[0] + (q[0] - p[0]) * k / n
        z = p[1] + (q[1] - p[1]) * k / n
        if any(math.hypot(x - a, z - b) < 0.4 for a, b in ignorar):
            continue
        i, j = cel(x, z)
        if not mask[i, j]:
            return False
    return True


# ------------------------------------------------------------------ grafo
class Grafo:
    def __init__(self):
        self.nos, self.arestas, self.idx = [], [], {}

    def no(self, andar, x, z, tipo, ref=None, chave=None):
        chave = chave or (andar, round(x, 2), round(z, 2))
        if chave in self.idx:
            if tipo in ('porta', 'acesso'):   # um ponto do piso tátil que também é a porta de um lugar
                next(n for n in self.nos if n['id'] == self.idx[chave])['tipo'] = tipo
            return self.idx[chave]
        nid = f'{PRE}_{andar}_N{sum(1 for n in self.nos if n["andar"] == andar) + 1:04d}'
        alt = {'P01': 0, 'P02': 3, 'P03': 6}[andar]
        self.nos.append({'id': nid, 'andar': andar, 'pos': [round(x + OX, 3), alt, round(z + OZ, 3)], 'tipo': tipo, 'ref_modelo': ref,
                         '_xz': (x, z)})
        self.idx[chave] = nid
        return nid

    def aresta(self, de, para, tipo='caminhada', tatil='nenhum', largura=None, custo=None, comp=None, equipamento=None, **extra):
        if de == para or any({a['de'], a['para']} == {de, para} and a['tipo'] == tipo for a in self.arestas):
            return
        n = {x['id']: x for x in self.nos}
        if comp is None:
            (x0, z0), (x1, z1) = n[de]['_xz'], n[para]['_xz']
            comp = math.hypot(x1 - x0, z1 - z0) * U
        a = {'de': de, 'para': para, 'tipo': tipo, 'comprimento_unid': round(comp, 2), 'custo': round(custo if custo is not None else comp, 2),
             'sentido': 'ambos', 'piso_tatil': tatil, 'inclinacao_pct': None, 'largura_min_m': largura, 'equipamento': equipamento}
        a.update(extra)
        self.arestas.append(a)


def amostrar(linha, passo=1.5, extras=()):
    """Pontos ao longo da polilinha, a cada ≤ passo metros, incluindo vértices e os pontos extras que caem nela."""
    pts = []
    for (a, b) in zip(linha, linha[1:]):
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        ts = {0.0, 1.0}
        n = max(1, math.ceil(L / passo))
        ts |= {k / n for k in range(n + 1)}
        for (ex, ez) in extras:   # cruzamentos com outras linhas
            if L < 1e-9:
                continue
            t = ((ex - a[0]) * (b[0] - a[0]) + (ez - a[1]) * (b[1] - a[1])) / (L * L)
            px, pz = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
            if -1e-6 <= t <= 1 + 1e-6 and math.hypot(px - ex, pz - ez) < 0.02:
                ts.add(min(1.0, max(0.0, t)))
        for t in sorted(ts):
            p = (round(a[0] + (b[0] - a[0]) * t, 3), round(a[1] + (b[1] - a[1]) * t, 3))
            if not pts or math.hypot(p[0] - pts[-1][0], p[1] - pts[-1][1]) > 0.05:
                pts.append(p)
    return pts


def linhas_tateis(andar):
    t = MOD.TATIL[andar]
    linhas = [list(l) for l in t['linhas']]
    if t.get('anel'):
        cx, cz, r = t['anel']
        # amostra o anel incluindo os quatro encontros com as linhas retas (N, L, S, O)
        angs = sorted({k * 2 * math.pi / 12 for k in range(12)} | {0, math.pi / 2, math.pi, 3 * math.pi / 2})
        linhas.append([(round(cx + r * math.cos(a), 3), round(cz + r * math.sin(a), 3)) for a in angs] +
                      [(round(cx + r, 3), round(cz, 3))])
    return linhas


ELEV = [(1, 6.8), (2, 10.8)]
ESC = {'A': {'patamar': (12.5, 10.1), 'porta': (12.1, 10.8)}, 'B': {'patamar': (-2.0, 21.15), 'porta': (0.0, 21.25)}}
RAMPA_INI, RAMPA_FIM = (18.375, 24.45), (20.125, 24.45)


def montar_grafo():
    G = Grafo()
    lugares_portas = {}   # (andar, nome da porta) -> nó
    especiais = {}
    for andar, nome, base in MOD.ANDARES:
        g, esp, anda, r35, r20 = mascaras(andar)
        locais = []   # nós deste andar que entram na ligação geral: (id, x, z, tipo)
        # 1) grade de 1,5 m
        for i in range(int((21.5 - (-7.5)) / 1.5)):
            for k in range(int(29.5 / 1.5)):
                x, z = -7.5 + 0.75 + 1.5 * i, 0.75 + 1.5 * k
                ci, ck = cel(x, z)
                if r35[ci, ck]:
                    locais.append((G.no(andar, x, z, 'corredor'), x, z, 'grade'))
        # 2) piso tátil
        linhas = linhas_tateis(andar)
        pontas = [p for l in MOD.TATIL[andar]['linhas'] for p in (l[0], l[-1])]
        tateis = set()
        for linha in linhas:
            pts = [p for p in amostrar(linha, 1.5, pontas)]
            ids = []
            for (x, z) in pts:
                ci, ck = cel(x, z)
                if anda[ci, ck]:
                    nid = G.no(andar, x, z, 'corredor')
                    tateis.add(nid)
                    ids.append((nid, x, z))
                    locais.append((nid, x, z, 'tatil'))
                else:
                    ids.append(None)
            for a, b in zip(ids, ids[1:]):
                if a and b:
                    G.aresta(a[0], b[0], tatil='direcional')
        # 3) portas
        portas = []
        for ori, pos, a, b, tipo, nome_p in MOD.PORTAS[andar]:
            if tipo == 'elevador':
                continue
            x, z = (pos, (a + b) / 2) if ori == 'v' else ((a + b) / 2, pos)
            nid = G.no(andar, x, z, 'porta')
            portas.append((nid, x, z, round(b - a, 2), nome_p))
            lugares_portas[(andar, nome_p)] = nid
        # 4) especiais: entrada, recepção, coworking, elevadores, escadas, rampa
        if andar == 'P01':
            especiais[('P01', 'entrada')] = G.no('P01', 5.25, 0.45, 'acesso')
            especiais[('P01', 'recepcao')] = G.no('P01', 3.15, 3.5, 'porta')
            locais += [(especiais[('P01', 'entrada')], 5.25, 0.45, 'esp'), (especiais[('P01', 'recepcao')], 3.15, 3.5, 'esp')]
        if andar == 'P03':
            especiais[('P03', 'coworking')] = G.no('P03', 8.4, 16.6, 'porta')
            locais.append((especiais[('P03', 'coworking')], 8.4, 16.6, 'esp'))
        if andar != 'P03':
            for num, zc in ELEV:
                en = G.no(andar, -1.3, zc, 'elevador', ref=f'{PRE}{andar}ELEVADOR_{num}')
                pn = G.no(andar, 0.0, zc, 'porta')
                especiais[(andar, f'elev{num}')] = en
                G.aresta(en, pn, largura=0.90)
                portas.append((pn, 0.0, zc, 0.90, f'Elevador {num}'))
        for q, e in ESC.items():
            en = G.no(andar, *e['patamar'], 'escada', ref=f'{PRE}{andar}ESCADA_{q}')
            especiais[(andar, f'esc{q}')] = en
            G.aresta(en, lugares_portas[(andar, f'Escada {q}')], largura=1.20, tatil='alerta')   # patamar com piso de alerta
        if andar != 'P03':
            especiais[(andar, 'rampa_ini')] = G.no(andar, *RAMPA_INI, 'rampa', ref=f'{PRE}{andar}RAMPA_1')
            locais.append((especiais[(andar, 'rampa_ini')], *RAMPA_INI, 'esp'))
        if andar != 'P01':
            especiais[(andar, 'rampa_fim')] = G.no(andar, *RAMPA_FIM, 'rampa', ref=f'{PRE}{andar}RAMPA_1', chave=(andar, 'rampa_fim'))
            locais.append((especiais[(andar, 'rampa_fim')], *RAMPA_FIM, 'esp'))
        # 5) ligações no andar
        for idx, (a, xa, za, ta) in enumerate(locais):
            for (b, xb, zb, tb) in locais[idx + 1:]:
                d = math.hypot(xb - xa, zb - za)
                if ta == 'grade' and tb == 'grade':
                    if d > 3.05:   # pula um ponto da grade que caiu num móvel (corredores entre mesas)
                        continue
                elif d > 1.6 or (ta == 'tatil' and tb == 'tatil' and d < 0.06):
                    continue
                if livre(r20, (xa, za), (xb, zb)):
                    G.aresta(a, b)
        for (pn, x, z, larg, nome_p) in portas:
            for (b, xb, zb, tb) in locais:
                d = math.hypot(xb - x, zb - z)
                if d <= 3.05 and livre(r20, (x, z), (xb, zb), ignorar=[(x, z)]):
                    perto_tatil = b in tateis and d <= 0.75
                    G.aresta(pn, b, tatil='alerta' if perto_tatil else 'nenhum', largura=larg)
        # larguras das passagens
        for a in G.arestas:
            na = next(n for n in G.nos if n['id'] == a['de'])
            if na['andar'] != andar or a['largura_min_m'] is not None:
                continue
            nb = next(n for n in G.nos if n['id'] == a['para'])
            for (x0, x1, z0, z1), w in PASSAGENS.get(andar, []):
                (xa, za), (xb, zb) = na['_xz'], nb['_xz']
                if any(x0 <= xa + (xb - xa) * t <= x1 and z0 <= za + (zb - za) * t <= z1 for t in (0.25, 0.5, 0.75)):
                    a['largura_min_m'] = w
    # 6) troca de andar
    for num, _zc in ELEV:
        G.aresta(especiais[('P01', f'elev{num}')], especiais[('P02', f'elev{num}')], tipo='elevador', comp=60, custo=90, equipamento=f'ELEV_0{num}')
    for q in ESC:
        for a, b in (('P01', 'P02'), ('P02', 'P03')):
            G.aresta(especiais[(a, f'esc{q}')], especiais[(b, f'esc{q}')], tipo='escada', comp=150, custo=220, equipamento=f'ESC_{q}',
                     braille=(q == 'B'), largura=1.70)
    for a, b in (('P01', 'P02'), ('P02', 'P03')):
        G.aresta(especiais[(a, 'rampa_ini')], especiais[(b, 'rampa_fim')], tipo='rampa', comp=860, custo=860, equipamento='RAMPA_1', largura=1.60)
        G.arestas[-1]['inclinacao_pct'] = 8.33
    return G, lugares_portas, especiais


# ------------------------------------------------------------------ lugares e formas
def lugares(G, portas, esp_nos):
    L = []
    cont = {}

    def add(andar, nome, cat, no_porta, cx, cz, w=1.2, h=1.2, rect=None, busca=''):
        cont[andar] = cont.get(andar, 0) + 1
        L.append({'id': f'{PRE}_{andar}_L{cont[andar]:04d}', 'nome': nome, 'categoria': cat, 'andar': andar, 'no_porta': no_porta,
                  'aliases': [], 'acessivel': True, 'codigo': None, 'busca': busca, '_c': (cx, cz, w, h), '_rect': rect})

    def sala(andar, id_esp, nome, cat, porta, busca=''):
        e = next(e for e in MOD.ESPACOS[andar] if e['id'] == id_esp)
        r = e['rects'][0]
        add(andar, nome, cat, portas[(andar, porta)], (r[0] + r[1]) / 2, (r[2] + r[3]) / 2, r[1] - r[0], r[3] - r[2], rect=r, busca=busca)

    # 1º andar
    add('P01', 'Entrada principal', 'entrada', esp_nos[('P01', 'entrada')], 5.25, 0.0, 1.8, 0.3, busca='porta rua')
    add('P01', 'Recepção', 'informacao', esp_nos[('P01', 'recepcao')], 2.15, 3.5, 1.5, 2.2, busca='informacoes atendimento libras ajuda')
    sala('P01', 'LOJAA', 'Loja A', 'loja', 'Loja A')
    sala('P01', 'LOJAB', 'Loja B', 'loja', 'Loja B')
    sala('P01', 'SANITARIO', 'Sanitário acessível', 'sanitario_acessivel', 'Sanitário acessível', 'banheiro')
    sala('P01', 'REFEITORIO', 'Refeitório', 'cantina', 'Passagem do refeitório (1,20 m)', 'restaurante almoco cardapio comida')
    # 2º andar
    sala('P02', 'SERVADM', 'Serviços administrativos', 'administracao', 'Serviços administrativos', 'guiche senha atendimento')
    sala('P02', 'COPA', 'Copa', 'sala', 'Copa', 'cafe cozinha')
    sala('P02', 'ARQUIVO', 'Arquivo', 'sala', 'Arquivo')
    sala('P02', 'ESCRITORIOS', 'Escritórios', 'sala', 'Escritórios — entrada oeste', 'escritorio')
    sala('P02', 'SANITARIO', 'Sanitário acessível', 'sanitario_acessivel', 'Sanitário acessível', 'banheiro')
    sala('P02', 'TREINAMENTO', 'Sala de treinamento', 'sala', 'Sala de treinamento', 'curso aula')
    sala('P02', 'REUNIAO', 'Sala de reunião', 'sala', 'Sala de reunião (vão de 0,85 m)', 'reuniao')
    # 3º andar
    sala('P03', 'EVENTOS', 'Sala de eventos', 'auditorio', 'Sala de eventos', 'auditorio palestra evento')
    sala('P03', 'MULTIUSO', 'Espaço multiuso', 'sala', 'Espaço multiuso', 'multiuso')
    add('P03', 'Coworking', 'sala', esp_nos[('P03', 'coworking')], 9.75, 18.5, 7.5, 9.0, rect=(6.0, 13.5, 14.0, 23.0), busca='mesa trabalho')
    sala('P03', 'SANITARIO', 'Sanitário acessível', 'sanitario_acessivel', 'Sanitário acessível', 'banheiro')
    sala('P03', 'TERRACO', 'Terraço', 'sala', 'Saída para o terraço (1,80 m)', 'area externa')
    # equipamentos em cada andar
    for andar, nome, _b in MOD.ANDARES:
        if andar != 'P03':
            for num, zc in ELEV:
                add(andar, f'Elevador {num}', 'elevador', esp_nos[(andar, f'elev{num}')], -1.3, zc, 2.4, 2.2, busca='elevador')
        add(andar, 'Escada A', 'escada', esp_nos[(andar, 'escA')], 12.5, 7.9, 4.0, 5.8, busca='escada sem braille')
        add(andar, 'Escada B', 'escada', esp_nos[(andar, 'escB')], -2.0, 23.3, 4.0, 6.0, busca='escada braille corrimao')
        no_r = esp_nos.get((andar, 'rampa_ini')) or esp_nos[(andar, 'rampa_fim')]
        add(andar, 'Rampa', 'rampa', no_r, 19.25, 25.5, 3.5, 2.0, busca='rampa cadeira de rodas')
    return L


# ------------------------------------------------------------------ escrita
def js(obj_nome, valor, comentario):
    return f'/* {comentario} Gerado por ferramentas/modelo3d/gerar-local-predio.py em {HOJE}. Não edite à mão. */\n' + \
        f'naviLocal({json.dumps(SLUG)}).{obj_nome}={json.dumps(valor, ensure_ascii=False, separators=(",", ":"))};\n'


def main():
    os.makedirs(SAIDA, exist_ok=True)
    G, portas, esp_nos = montar_grafo()
    lugs = lugares(G, portas, esp_nos)
    # dados: plantas (salas), formas, limites e piso tátil
    plantas, formas, pisos, tatil = {}, {}, {}, {}
    for andar, _n, _b in MOD.ANDARES:
        polys = []
        rect_poly = {}
        for e in MOD.ESPACOS[andar]:
            if e['grupo'] == 'hall' or e['cat'] == 'anexo':
                continue
            for r in e['rects']:
                rect_poly[tuple(r)] = len(polys)
                x0, x1, z0, z1 = r
                polys.append([P(x0, z0), P(x1, z0), P(x1, z1), P(x0, z1)])
        plantas[andar] = polys
        todos = [r for e in MOD.ESPACOS[andar] for r in e['rects']]
        pisos[andar] = {'minX': P(min(r[0] for r in todos), 0)[0], 'minY': P(0, min(r[2] for r in todos))[1],
                        'maxX': P(max(r[1] for r in todos), 0)[0], 'maxY': P(0, max(r[3] for r in todos))[1]}
        tatil[andar] = [[P(x, z) for (x, z) in l] for l in linhas_tateis(andar)]
    for l in lugs:
        cx, cz, w, h = l['_c']
        x, y = P(cx, cz)
        poly = rect_poly_lookup = -1
        if l['_rect'] is not None:
            for k, r in enumerate([tuple(r) for e in MOD.ESPACOS[l['andar']] if e['grupo'] != 'hall' and e['cat'] != 'anexo' for r in e['rects']]):
                if r == tuple(l['_rect']):
                    poly = k
        del rect_poly_lookup
        formas[l['id']] = {'x': x, 'y': y, 'w': round(w * U), 'h': round(h * U), 'r': 0, 'poly': poly}
    dados = {'gerado': HOJE, 'data_planta': HOJE, 'fonte': 'Prédio comercial de testes do Navi (planta de testes da equipe)',
             'pisos': pisos, 'plantas': plantas, 'formas': formas, 'tatil': tatil}
    for l in lugs:
        del l['_c'], l['_rect']
    usados = {a['de'] for a in G.arestas} | {a['para'] for a in G.arestas}
    nos = [{k: v for k, v in n.items() if k != '_xz'} for n in G.nos if n['id'] in usados]   # portas de salas sem rota (ex.: Depósito)
    grafo = {'versao': '1.1', 'local': SLUG, 'gerado': HOJE,
             'fonte': 'Modelo 3D do prédio comercial de testes (ferramentas/modelo3d), a partir da planta de testes da equipe de 29/10/2026.',
             'escala_m_por_unidade': 1 / U, 'escala_medida_em': None,
             'origem': 'canto noroeste do bloco central do modelo, deslocado 8 m para oeste e 1 m para o norte; x para leste, y para o sul',
             'andares': [{'id': a, 'nome': n, 'ordem': i + 1, 'altura_m': b} for i, (a, n, b) in enumerate(MOD.ANDARES)],
             'lugares': lugs, 'nos': nos, 'arestas': G.arestas,
             'equipamentos': [
                 {'id': 'ELEV_01', 'tipo': 'elevador', 'andares': ['P01', 'P02'], 'posicao_estimada': False},
                 {'id': 'ELEV_02', 'tipo': 'elevador', 'andares': ['P01', 'P02'], 'posicao_estimada': False},
                 {'id': 'ESC_A', 'tipo': 'escada', 'andares': ['P01', 'P02', 'P03'], 'posicao_estimada': False, 'braille': False},
                 {'id': 'ESC_B', 'tipo': 'escada', 'andares': ['P01', 'P02', 'P03'], 'posicao_estimada': False, 'braille': True},
                 {'id': 'RAMPA_1', 'tipo': 'rampa', 'andares': ['P01', 'P02', 'P03'], 'posicao_estimada': False}]}
    with open(os.path.join(SAIDA, 'grafo.json'), 'w', encoding='utf-8') as f:
        json.dump(grafo, f, ensure_ascii=False, indent=1)
    with open(os.path.join(SAIDA, 'grafo.js'), 'w', encoding='utf-8') as f:
        f.write(js('grafo', grafo, f'Navi — grafo de rotas (esquema 1.1) do local {SLUG}.'))
    with open(os.path.join(SAIDA, 'dados.js'), 'w', encoding='utf-8') as f:
        f.write(js('dados', dados, f'Navi — plantas, formas dos lugares e piso tátil do local {SLUG}.'))
    with open(os.path.join(SAIDA, 'malha.js'), 'w', encoding='utf-8') as f:
        f.write(f'/* Navi — {SLUG} não usa malha fina: a rota segue os nós do grafo, que já passam pelo piso tátil e pelo meio das passagens. */\n'
                f'naviLocal({json.dumps(SLUG)}).malha=null;\n')
    # lajes (contorno do piso de cada andar, em retângulos)
    lajes = {}
    for i, (andar, _n, _b) in enumerate(MOD.ANDARES):
        esp = MOD.ESPACOS[andar]
        g = MOD.grade(esp)
        ab = np.zeros_like(g, dtype=bool)
        for (x0, x1, z0, z1) in MOD.ABERTURAS_LAJE[andar]:
            ab[round((x0 - XMIN) / CEL):round((x1 - XMIN) / CEL), round((z0 - ZMIN) / CEL):round((z1 - ZMIN) / CEL)] = True
        rects = MOD.retangulos((g >= 0) & ~ab)
        lajes[str(i + 1)] = [{'ext': [P(x0, z0), P(x1, z0), P(x1, z1), P(x0, z1)], 'buracos': []} for (x0, x1, z0, z1) in rects]
    with open(os.path.join(SAIDA, 'dados3d.js'), 'w', encoding='utf-8') as f:
        f.write(js('lajes', lajes, f'Navi — contorno do piso de cada andar do local {SLUG}.'))
    with open(os.path.join(SAIDA, 'avisos.js'), 'w', encoding='utf-8') as f:
        f.write('/* Navi — avisos confirmados pela equipe para o prédio de testes. Começa vazio: nenhum lugar interditado.\n'
                '   Para testar interdições, use "Avisar sobre um local" no site (vale só no aparelho) ou acrescente aqui:\n'
                "   { lugar: 'PCT_P01_L0001', tipo: 'interditado' | 'danificado' | 'obstaculo', detalhe: '...', criado: 'AAAA-MM-DD' } */\n"
                f'naviLocal({json.dumps(SLUG)}).avisos = [];\n')
    # modelo 3D do site: o prédio sem os obstáculos, sem as placas de "fora de serviço" e sem a cobertura
    tx = MOD.texturas(MOD.ESPACOS)
    andares = [MOD.andar_no(a, n, b, tx) for a, n, b in MOD.ANDARES]

    def limpar(no):
        no.filhos = [f for f in no.filhos if not any(k in f.nome for k in ('OBSTACULO', 'INTERDICAO', 'COBERTURA', 'LARGURAMIN', 'ROTULO_ANDAR'))]
        for f in no.filhos:
            limpar(f)
    for a in andares:
        limpar(a)
        a.extras.pop('obstaculos', None)
    raiz = No(f'{PRE}_PREDIO', {'tipo': 'predio', 'local': SLUG, 'unidade': 'metro', 'unidades_planta_por_metro': U, 'deslocamento_planta_m': [OX, OZ]})
    raiz.filhos = andares
    tam = escrever_glb(os.path.join(SAIDA, 'modelo.glb'), raiz, MOD.M, 'Prédio comercial de testes')
    print(f'{len(G.nos)} nós, {len(G.arestas)} arestas, {len(lugs)} lugares; modelo.glb {tam / 1024 / 1024:.2f} MB')
    tat = sum(1 for a in G.arestas if a['piso_tatil'] != 'nenhum')
    print(f'arestas com piso tátil: {tat}')


if __name__ == '__main__':
    main()
