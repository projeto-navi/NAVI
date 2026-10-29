"""Navi — escritor mínimo de glTF 2.0 binário (.glb) e geometria simples, sem dependências além do numpy.

Convenções: metros; X para leste, Y para cima, Z para o sul (o "y para baixo" da planta).
Cada nó junta as malhas por material (uma primitiva por material), para o visualizador desenhar pouco.
"""
import json
import math
import struct

import numpy as np


def srgb_linear(hex_cor):
    """'#RRGGBB' → cor linear [r, g, b] (o glTF guarda baseColorFactor em espaço linear)."""
    h = hex_cor.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return out


class Material:
    def __init__(self, nome, cor, metal=0.0, aspereza=0.85, alfa=1.0, textura=None, emissivo=None, duplo=False):
        self.nome, self.cor, self.metal, self.aspereza, self.alfa = nome, cor, metal, aspereza, alfa
        self.textura = textura          # bytes PNG
        self.emissivo = emissivo        # '#RRGGBB'
        self.duplo = duplo or alfa < 1


class Malha:
    """Geometria de um nó, separada por material."""

    def __init__(self):
        self.partes = {}  # material -> [posições, normais, uvs, índices]

    def _parte(self, mat):
        if mat not in self.partes:
            self.partes[mat] = [[], [], [], []]
        return self.partes[mat]

    def vazia(self):
        return not self.partes

    def tri(self, mat, pts, normal, uvs=None):
        """Polígono convexo plano (lista de pontos em ordem anti-horária vista de fora)."""
        p = self._parte(mat)
        base = sum(len(a) for a in p[0])
        arr = np.asarray(pts, dtype=np.float32)
        p[0].append(arr)
        p[1].append(np.tile(np.asarray(normal, dtype=np.float32), (len(pts), 1)))
        if uvs is None:
            uvs = [(0.0, 0.0)] * len(pts)
        p[2].append(np.asarray(uvs, dtype=np.float32))
        idx = []
        for i in range(1, len(pts) - 1):
            idx += [base, base + i, base + i + 1]
        p[3].append(np.asarray(idx, dtype=np.uint32))

    def face(self, mat, pts, centro_ref, uvs=None):
        """Face plana; vira a ordem se a normal apontar para dentro (em relação a centro_ref)."""
        a = np.asarray(pts, dtype=np.float64)
        n = np.zeros(3)
        for i in range(len(a)):  # normal de Newell (robusta para quadriláteros quase planos)
            u, v = a[i], a[(i + 1) % len(a)]
            n += [(u[1] - v[1]) * (u[2] + v[2]), (u[2] - v[2]) * (u[0] + v[0]), (u[0] - v[0]) * (u[1] + v[1])]
        tam = np.linalg.norm(n)
        if tam < 1e-12:
            return
        n /= tam
        if np.dot(n, a.mean(axis=0) - np.asarray(centro_ref)) < 0:
            a = a[::-1]
            n = -n
            if uvs is not None:
                uvs = list(uvs)[::-1]
        self.tri(mat, a.tolist(), n.tolist(), uvs)

    def hexa(self, mat, c, faces='todas'):
        """Hexaedro por 8 cantos: 0-3 em baixo (ordem em volta), 4-7 em cima, na mesma ordem."""
        c = [list(map(float, q)) for q in c]
        centro = np.mean(np.asarray(c), axis=0)
        quads = {
            'baixo': (0, 1, 2, 3), 'cima': (4, 5, 6, 7),
            'l0': (0, 1, 5, 4), 'l1': (1, 2, 6, 5), 'l2': (2, 3, 7, 6), 'l3': (3, 0, 4, 7)
        }
        for nome, q in quads.items():
            if faces != 'todas' and nome not in faces:
                continue
            self.face(mat, [c[i] for i in q], centro)

    def caixa(self, mat, x0, x1, y0, y1, z0, z1, faces='todas'):
        if x1 < x0: x0, x1 = x1, x0
        if y1 < y0: y0, y1 = y1, y0
        if z1 < z0: z0, z1 = z1, z0
        if x1 - x0 < 1e-6 or y1 - y0 < 1e-6 or z1 - z0 < 1e-6:
            return
        self.hexa(mat, [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1),
                        (x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)], faces)

    def caixa_girada(self, mat, cx, cz, y0, y1, comp, larg, ang):
        """Caixa de comprimento comp (ao longo do ângulo ang, em radianos no plano XZ) e largura larg."""
        dx, dz = math.cos(ang), math.sin(ang)
        px, pz = -dz, dx
        h, w = comp / 2, larg / 2
        base = [(cx - dx * h - px * w, cz - dz * h - pz * w), (cx + dx * h - px * w, cz + dz * h - pz * w),
                (cx + dx * h + px * w, cz + dz * h + pz * w), (cx - dx * h + px * w, cz - dz * h + pz * w)]
        self.hexa(mat, [(x, y0, z) for x, z in base] + [(x, y1, z) for x, z in base])

    def cilindro(self, mat, a, b, r, lados=10, r_topo=None, tampas=True):
        """Cilindro (ou cone, com r_topo) entre os pontos a e b."""
        a, b = np.asarray(a, float), np.asarray(b, float)
        eixo = b - a
        L = np.linalg.norm(eixo)
        if L < 1e-9:
            return
        e = eixo / L
        aux = np.array([0, 1, 0]) if abs(e[1]) < 0.9 else np.array([1, 0, 0])
        u = np.cross(e, aux); u /= np.linalg.norm(u)
        v = np.cross(e, u)
        rt = r if r_topo is None else r_topo
        ang = [2 * math.pi * i / lados for i in range(lados)]
        anel_a = [a + r * (math.cos(t) * u + math.sin(t) * v) for t in ang]
        anel_b = [b + rt * (math.cos(t) * u + math.sin(t) * v) for t in ang]
        centro = (a + b) / 2
        for i in range(lados):
            j = (i + 1) % lados
            pts = [anel_a[i], anel_a[j], anel_b[j], anel_b[i]]
            if rt < 1e-6:
                pts = [anel_a[i], anel_a[j], b]
            # normal lisa aproximada pela face; suficiente para peças pequenas
            self.face(mat, [p.tolist() for p in pts], centro)
        if tampas:
            self.face(mat, [p.tolist() for p in anel_a], b)
            if rt > 1e-6:
                self.face(mat, [p.tolist() for p in anel_b], a)

    def esfera(self, mat, c, r, seg=8, aneis=6, achatar=1.0):
        c = np.asarray(c, float)
        pts = []
        for i in range(aneis + 1):
            phi = math.pi * i / aneis
            linha = []
            for j in range(seg):
                t = 2 * math.pi * j / seg
                linha.append(c + np.array([r * math.sin(phi) * math.cos(t), r * math.cos(phi) * achatar, r * math.sin(phi) * math.sin(t)]))
            pts.append(linha)
        for i in range(aneis):
            for j in range(seg):
                k = (j + 1) % seg
                q = [pts[i][j], pts[i][k], pts[i + 1][k], pts[i + 1][j]]
                if i == 0:
                    q = [pts[i][j], pts[i + 1][k], pts[i + 1][j]]
                elif i == aneis - 1:
                    q = [pts[i][j], pts[i][k], pts[i + 1][j]]
                self.face(mat, [p.tolist() for p in q], c)

    def quad_textura(self, mat, cantos):
        """Quadrilátero com UV 0..1: cantos em ordem (baixo-esq, baixo-dir, cima-dir, cima-esq), vistos de frente."""
        a = np.asarray(cantos, float)
        n = np.cross(a[1] - a[0], a[3] - a[0])
        n /= np.linalg.norm(n)
        self.tri(mat, a.tolist(), n.tolist(), [(0, 1), (1, 1), (1, 0), (0, 0)])


class No:
    def __init__(self, nome, extras=None, posicao=None):
        self.nome = nome
        self.malha = Malha()
        self.filhos = []
        self.extras = extras or {}
        self.posicao = posicao

    def filho(self, nome, extras=None, posicao=None):
        n = No(nome, extras, posicao)
        self.filhos.append(n)
        return n

    def contar_vertices(self):
        t = sum(sum(len(a) for a in p[0]) for p in self.malha.partes.values())
        return t + sum(f.contar_vertices() for f in self.filhos)


def escrever_glb(caminho, raiz, materiais, cena_nome='Navi'):
    """Escreve a árvore de nós num .glb. materiais: dict nome -> Material."""
    gltf = {'asset': {'version': '2.0', 'generator': 'Navi ferramentas/modelo3d'},
            'scene': 0, 'scenes': [{'name': cena_nome, 'nodes': []}],
            'nodes': [], 'meshes': [], 'materials': [], 'accessors': [], 'bufferViews': [], 'buffers': []}
    binario = bytearray()
    usados = {}

    def alinhar():
        while len(binario) % 4:
            binario.append(0)

    def visao(dados, alvo=None):
        alinhar()
        off = len(binario)
        binario.extend(dados)
        bv = {'buffer': 0, 'byteOffset': off, 'byteLength': len(dados)}
        if alvo:
            bv['target'] = alvo
        gltf['bufferViews'].append(bv)
        return len(gltf['bufferViews']) - 1

    def acessor(arr, tipo, comp, alvo, minmax=False):
        bv = visao(arr.tobytes(), alvo)
        a = {'bufferView': bv, 'componentType': comp, 'count': int(len(arr)), 'type': tipo}
        if minmax:
            a['min'] = arr.min(axis=0).astype(float).tolist()
            a['max'] = arr.max(axis=0).astype(float).tolist()
        gltf['accessors'].append(a)
        return len(gltf['accessors']) - 1

    def material(nome):
        if nome in usados:
            return usados[nome]
        m = materiais[nome]
        pbr = {'baseColorFactor': srgb_linear(m.cor) + [m.alfa], 'metallicFactor': m.metal, 'roughnessFactor': m.aspereza}
        md = {'name': nome, 'pbrMetallicRoughness': pbr}
        if m.alfa < 1:
            md['alphaMode'] = 'BLEND'
        if m.duplo:
            md['doubleSided'] = True
        if m.emissivo:
            md['emissiveFactor'] = srgb_linear(m.emissivo)
        if m.textura is not None:
            gltf.setdefault('images', []).append({'bufferView': visao(m.textura), 'mimeType': 'image/png', 'name': nome})
            gltf.setdefault('samplers', [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}])
            gltf.setdefault('textures', []).append({'sampler': 0, 'source': len(gltf['images']) - 1})
            pbr['baseColorTexture'] = {'index': len(gltf['textures']) - 1}
            pbr['baseColorFactor'] = [1, 1, 1, 1]
            md['emissiveTexture'] = {'index': len(gltf['textures']) - 1}   # tela que brilha um pouco
            md['emissiveFactor'] = [0.55, 0.55, 0.55]
        gltf['materials'].append(md)
        usados[nome] = len(gltf['materials']) - 1
        return usados[nome]

    def no(n):
        nd = {'name': n.nome}
        if n.extras:
            nd['extras'] = n.extras
        if n.posicao is not None:
            nd['translation'] = [float(v) for v in n.posicao]
        if not n.malha.vazia():
            prims = []
            for mat, (pos, nor, uv, idx) in n.malha.partes.items():
                P = np.concatenate(pos).astype(np.float32)
                N = np.concatenate(nor).astype(np.float32)
                I = np.concatenate(idx).astype(np.uint32)
                attrs = {'POSITION': acessor(P, 'VEC3', 5126, 34962, True), 'NORMAL': acessor(N, 'VEC3', 5126, 34962)}
                if materiais[mat].textura is not None:
                    attrs['TEXCOORD_0'] = acessor(np.concatenate(uv).astype(np.float32), 'VEC2', 5126, 34962)
                prims.append({'attributes': attrs, 'indices': acessor(I, 'SCALAR', 5125, 34963), 'material': material(mat)})
            gltf['meshes'].append({'name': n.nome, 'primitives': prims})
            nd['mesh'] = len(gltf['meshes']) - 1
        gltf['nodes'].append(nd)
        i = len(gltf['nodes']) - 1
        if n.filhos:
            nd['children'] = [no(f) for f in n.filhos]
        return i

    gltf['scenes'][0]['nodes'].append(no(raiz))
    alinhar()
    gltf['buffers'].append({'byteLength': len(binario)})
    for k in ['materials', 'meshes']:
        if not gltf[k]:
            del gltf[k]
    js = json.dumps(gltf, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    while len(js) % 4:
        js += b' '
    total = 12 + 8 + len(js) + 8 + len(binario)
    with open(caminho, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(binario), 0x004E4942)); f.write(bytes(binario))
    return total
