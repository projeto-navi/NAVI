"""Navi — modelo 3D do prédio comercial de testes (3 andares), a partir da planta de testes enviada pela equipe.

Uso: python3 ferramentas/modelo3d/gerar-predio-teste.py   → modelos/predio-teste/*.glb

O que o cenário testa (pedido da equipe, 29/10/2026):
- piso tátil com rotas mais longas que o caminho direto (1º andar: Entrada → Escada B pela Área central);
- obstáculos que aparecem e somem para testar rotas alternativas (nós OBSTACULO, escondidos de início);
- elevadores 1 e 2 (só até o 2º andar) que podem ficar "fora de serviço" (nós INTERDICAO);
- rampa i = 8,33% entre os três andares, em ziguezague com patamares a cada 0,75 m de subida (NBR 9050);
- Escada A sem braille e Escada B com corrimão duplo e braille (preferência de rota);
- passagens de largura mínima: 1,20 m (refeitório), 0,90 m e 0,85 m (2º andar), 1,50 m e 1,80 m;
- pontos de referência com instruções visuais para pessoas com deficiência auditiva.

O 3D não define rotas: o grafo do local continua sendo a fonte de verdade (especificação do Marco 1).
Os extras dos nós trazem o que o grafo vai precisar (piso tátil, portas, larguras, equipamentos).
Nomes seguem {PREDIO}{ANDAR}{CATEGORIA}_{ID}, com PREDIO = PCT (prédio comercial de testes).
"""
import json
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glb import Material, No, escrever_glb  # noqa: E402
import paineis  # noqa: E402

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SAIDA = os.path.join(RAIZ, 'modelos', 'predio-teste')
P = 'PCT'
CEL = 0.05
ALT = 3.0          # altura de andar a andar (piso a piso)
LAJE = 0.2
T = 0.15           # espessura das paredes
XMIN, XMAX, ZMIN, ZMAX = -7.5, 21.5, -1.0, 29.5
NX, NZ = round((XMAX - XMIN) / CEL), round((ZMAX - ZMIN) / CEL)
ANDARES = [('P01', '1º andar', 0.0), ('P02', '2º andar', 3.0), ('P03', '3º andar', 6.0)]

# ------------------------------------------------------------------ materiais
M = {}


def mat(nome, cor, **kw):
    M[nome] = Material(nome, cor, **kw)


mat('piso', '#E6E9ED'); mat('piso_hall', '#EEF0F2'); mat('piso_sanitario', '#D9E3EC'); mat('piso_loja', '#E7DFD3')
mat('piso_refeitorio', '#E9E2D4'); mat('piso_madeira', '#B08A60'); mat('piso_tecnico', '#AEB6BF'); mat('piso_rampa', '#CED4DA')
mat('piso_escada', '#D3D7DC'); mat('laje', '#C4C9CF')
mat('parede', '#F6F6F3'); mat('parede_externa', '#DEDBD4'); mat('vidro', '#A8D0EC', alfa=0.28, aspereza=0.05)
mat('caixilho', '#5A6470', metal=0.3, aspereza=0.5); mat('porta', '#C9B08A'); mat('porta_corta_fogo', '#B8432F')
mat('tatil', '#F2C200', aspereza=0.7); mat('borda_degrau', '#F2C200', aspereza=0.7)
mat('degrau', '#C9CDD2'); mat('rampa', '#BFC6CD'); mat('corrimao', '#9AA3AD', metal=0.35, aspereza=0.35)
mat('braille_placa', '#24282E', metal=0.3, aspereza=0.5); mat('braille_ponto', '#F4F4F4')
mat('elevador', '#B9C2CB', metal=0.35, aspereza=0.35); mat('elevador_interno', '#D8DEE4', metal=0.2, aspereza=0.5)
mat('tela_escura', '#14202E', emissivo='#0F3A2A'); mat('botao', '#2D3540'); mat('luz_chamada', '#3E8EF7', emissivo='#2F6FD0')
mat('estrobo', '#E53935', emissivo='#8A1414')
mat('mobilia', '#DDE3EA'); mat('madeira', '#A77B4F'); mat('estofado', '#3E6FB0'); mat('balcao', '#E9EDF1')
mat('planta', '#3B8A3E'); mat('vaso', '#8E5B3A'); mat('louca', '#FAFAFA'); mat('totem', '#0B4FA8', metal=0.2, aspereza=0.5)
mat('palco', '#5B4636'); mat('guarda_sol', '#0B4FA8', duplo=True)
mat('obstaculo', '#F26B1D'); mat('obstaculo_branco', '#FFFFFF'); mat('caixa', '#B9894E'); mat('aviso_amarelo', '#F7C600')
mat('interdicao', '#D62828'); mat('metal_escuro', '#3A424C', metal=0.3, aspereza=0.5)


def mat_textura(nome, png_bytes):
    M[nome] = Material(nome, '#FFFFFF', textura=png_bytes, aspereza=0.6)
    return nome


# ------------------------------------------------------------------ espaços de cada andar
def E(id_, nome, rects, grupo=None, cat='sala', piso='piso', curto=None, vidro_hall=False, laje=True, rotulo=True):
    return dict(id=id_, nome=nome, rects=rects, grupo=grupo or id_, cat=cat, piso=piso, curto=curto,
                vidro_hall=vidro_hall, laje=laje, rotulo=rotulo)


COMUNS = [
    E('ESCADAA', 'Escada A — sem braille', [(10.5, 14.5, 5.0, 10.8)], cat='escada', piso='piso_escada', curto='Esc. A', rotulo=False),
    E('ESCADAB', 'Escada B — corrimão duplo com braille', [(-4.0, 0.0, 20.3, 26.3)], cat='escada', piso='piso_escada', curto='Esc. B', rotulo=False),
    E('RAMPA', 'Rampa (patamar)', [(10.5, 17.5, 23.0, 28.5)], grupo='rampa', cat='rampa', piso='piso_rampa', curto='Rampa', rotulo=False),
    E('ANEXOVAO', 'Rampa i = 8,33%', [(17.5, 21.0, 3.0, 24.0)], grupo='rampa', cat='anexo', piso='piso_rampa', rotulo=False),
    E('ANEXOPATAMAR', 'Patamar da rampa', [(17.5, 21.0, 24.0, 28.5)], grupo='rampa', cat='anexo', piso='piso_rampa', rotulo=False),
]
ELEV = [
    E('ELEVADOR1', 'Elevador 1 (1º e 2º andar)', [(-2.6, 0.0, 5.6, 8.0)], cat='shaft', piso='piso_tecnico', curto='E1', rotulo=False),
    E('ELEVADOR2', 'Elevador 2 (1º e 2º andar)', [(-2.6, 0.0, 9.6, 12.0)], cat='shaft', piso='piso_tecnico', curto='E2', rotulo=False),
]

ESPACOS = {
    'P01': [
        E('HALL', 'Hall', [(0.0, 10.5, 0.0, 23.0), (10.5, 14.5, 10.8, 14.0), (10.5, 13.5, 19.0, 23.0)], grupo='hall', piso='piso_hall', rotulo=False),
        E('REFEITORIO', 'Refeitório', [(0.0, 10.5, 23.0, 28.5)], piso='piso_refeitorio', curto='Refeitório'),
        E('LOJAA', 'Loja A', [(-7.0, 0.0, 14.0, 19.0)], piso='piso_loja', curto='Loja A'),
        E('LOJAB', 'Loja B', [(10.5, 17.5, 14.0, 19.0)], piso='piso_loja', curto='Loja B'),
        E('SANITARIO', 'Sanitário acessível', [(13.5, 17.5, 19.0, 23.0)], piso='piso_sanitario', curto='Sanit.'),
    ] + ELEV + COMUNS,
    'P02': [
        E('SERVADM', 'Serviços administrativos', [(0.0, 10.5, 0.0, 6.0)], curto='Serv. administrativos', vidro_hall=True),
        E('HALL', 'Hall', [(0.0, 10.5, 6.0, 12.0), (4.8, 5.7, 12.0, 14.0), (9.0, 10.5, 12.0, 14.0), (10.5, 17.5, 10.8, 14.0),
                           (0.0, 6.0, 14.0, 28.5), (6.0, 10.5, 27.0, 28.5)], grupo='hall', piso='piso_hall', rotulo=False),
        E('COPA', 'Copa', [(0.0, 4.8, 12.0, 14.0)], curto='Copa'),
        E('ARQUIVO', 'Arquivo', [(5.7, 9.0, 12.0, 14.0)], curto='Arquivo'),
        E('ESCRITORIOS', 'Escritórios', [(6.0, 13.5, 14.0, 20.5)], curto='Escritórios'),
        E('SANITARIO', 'Sanitário acessível', [(13.5, 17.5, 14.0, 19.0)], piso='piso_sanitario', curto='Sanit.'),
        E('TECNICA', 'Sala técnica', [(13.5, 17.5, 19.0, 23.0), (10.5, 13.5, 20.5, 23.0)], piso='piso_tecnico', rotulo=False),
        E('TREINAMENTO', 'Sala de treinamento', [(6.0, 10.5, 20.5, 27.0)], curto='Treinamento'),
        E('REUNIAO', 'Sala de reunião', [(-5.0, 0.0, 14.0, 19.0)], curto='Reunião'),
    ] + ELEV + COMUNS,
    'P03': [
        E('EVENTOS', 'Sala de eventos', [(0.0, 10.5, 0.0, 12.0)], piso='piso_madeira', curto='Sala de eventos', vidro_hall=True),
        E('HALL', 'Hall', [(0.0, 10.5, 12.0, 14.0), (0.0, 6.0, 14.0, 23.0), (10.5, 17.5, 10.8, 14.0)], grupo='hall', piso='piso_hall', rotulo=False),
        E('COWORKING', 'Coworking', [(6.0, 13.5, 14.0, 23.0)], grupo='hall', piso='piso', curto='Coworking'),
        E('CASAMAQUINAS', 'Casa de máquinas (sem elevador)', [(-2.6, 0.0, 5.6, 12.0)], piso='piso_tecnico', curto='Sem elevador'),
        E('MULTIUSO', 'Espaço multiuso', [(-5.0, 0.0, 14.0, 19.5)], curto='Multiuso'),
        E('SANITARIO', 'Sanitário acessível', [(13.5, 17.5, 14.0, 19.0)], piso='piso_sanitario', curto='Sanit.'),
        E('DEPOSITO', 'Depósito', [(13.5, 17.5, 19.0, 23.0)], piso='piso_tecnico', rotulo=False),
        E('TERRACO', 'Terraço', [(0.0, 10.5, 23.0, 28.5)], cat='terraco', piso='piso_madeira', curto='Terraço', vidro_hall=True),
    ] + COMUNS,
}

# portas e vãos: (linha 'v' = x fixo | 'h' = z fixo, posição, início, fim, tipo, nome)
PORTAS = {
    'P01': [('h', 0.0, 4.35, 6.15, 'vidro_duplo', 'Entrada principal'),
            ('v', 0.0, 6.35, 7.25, 'elevador', 'Elevador 1'), ('v', 0.0, 10.35, 11.25, 'elevador', 'Elevador 2'),
            ('h', 10.8, 11.5, 12.7, 'corta_fogo', 'Escada A'),
            ('v', 0.0, 15.9, 17.1, 'porta', 'Loja A'), ('v', 10.5, 15.9, 17.1, 'porta', 'Loja B'),
            ('v', 13.5, 20.5, 21.5, 'porta', 'Sanitário acessível'),
            ('v', 0.0, 20.65, 21.85, 'corta_fogo', 'Escada B'),
            ('h', 23.0, 4.65, 5.85, 'vao', 'Passagem do refeitório (1,20 m)'),
            ('h', 23.0, 11.0, 12.5, 'vao', 'Rampa')],
    'P02': [('h', 6.0, 4.6, 5.9, 'vidro', 'Serviços administrativos'),
            ('v', 0.0, 6.35, 7.25, 'elevador', 'Elevador 1'), ('v', 0.0, 10.35, 11.25, 'elevador', 'Elevador 2'),
            ('h', 10.8, 11.5, 12.7, 'corta_fogo', 'Escada A'),
            ('h', 12.0, 1.5, 2.4, 'porta', 'Copa'), ('h', 12.0, 6.9, 7.8, 'porta', 'Arquivo'),
            ('h', 14.0, 9.0, 10.5, 'vao', 'Escritórios — entrada norte (1,50 m)'),
            ('v', 6.0, 17.0, 18.5, 'vao', 'Escritórios — entrada oeste'),
            ('h', 14.0, 14.5, 15.5, 'porta', 'Sanitário acessível'),
            ('v', 0.0, 16.0, 16.85, 'porta', 'Sala de reunião (vão de 0,85 m)'),
            ('v', 0.0, 20.65, 21.85, 'corta_fogo', 'Escada B'),
            ('v', 6.0, 22.0, 23.5, 'porta', 'Sala de treinamento'),
            ('v', 10.5, 27.0, 28.5, 'vao', 'Rampa')],
    'P03': [('h', 12.0, 4.5, 6.0, 'vidro', 'Sala de eventos'),
            ('h', 10.8, 11.5, 12.7, 'corta_fogo', 'Escada A'),
            ('v', 0.0, 16.0, 17.2, 'porta', 'Espaço multiuso'),
            ('v', 0.0, 20.65, 21.85, 'corta_fogo', 'Escada B'),
            ('h', 14.0, 14.5, 15.5, 'porta', 'Sanitário acessível'),
            ('v', 13.5, 20.5, 21.4, 'porta', 'Depósito'),
            ('h', 23.0, 4.35, 6.15, 'vidro', 'Saída para o terraço (1,80 m)'),
            ('h', 23.0, 11.0, 12.5, 'vao', 'Rampa')],
}

# lajes abertas (escadas, poço dos elevadores e vão da rampa) nos andares de cima
ABERTURAS_LAJE = {
    'P01': [],
    'P02': [(10.5, 14.5, 5.0, 9.4), (-4.0, 0.0, 22.0, 26.3), (17.5, 21.0, 3.0, 24.0), (-2.6, 0.0, 5.6, 8.0), (-2.6, 0.0, 9.6, 12.0)],
    'P03': [(10.5, 14.5, 5.0, 9.4), (-4.0, 0.0, 22.0, 26.3), (17.5, 21.0, 3.0, 24.0)],
}

# piso tátil: linhas direcionais (polilinhas x, z) e áreas de alerta (centro x, z, largura x, profundidade z)
ANEL = (5.25, 16.5, 2.9)  # Área central do 1º andar: o piso tátil contorna o canteiro
TATIL = {
    'P01': {'linhas': [[(5.25, 0.7), (5.25, 13.6)], [(2.35, 16.5), (0.45, 16.5)], [(8.15, 16.5), (10.05, 16.5)],
                       [(5.25, 19.4), (5.25, 26.9)], [(5.25, 21.25), (0.45, 21.25)], [(5.25, 3.5), (3.3, 3.5)]],
            'anel': ANEL,
            'alertas': [(5.25, 0.7), (5.25, 3.5), (3.3, 3.5), (5.25, 13.6), (5.25, 19.4), (2.35, 16.5), (8.15, 16.5),
                        (0.45, 16.5), (10.05, 16.5), (5.25, 21.25), (0.45, 21.25), (5.25, 26.9)]},
    'P02': {'linhas': [[(5.25, 4.6), (5.25, 27.75), (10.05, 27.75)], [(5.25, 16.43), (0.45, 16.43)], [(5.25, 21.25), (0.45, 21.25)]],
            'alertas': [(5.25, 4.6), (5.25, 11.5), (5.25, 16.43), (5.25, 21.25), (5.25, 27.75), (0.45, 16.43), (0.45, 21.25), (10.05, 27.75)]},
    'P03': {'linhas': [[(5.25, 10.6), (5.25, 25.0)], [(5.25, 16.6), (0.45, 16.6)], [(5.25, 21.25), (0.45, 21.25)], [(5.25, 16.6), (8.4, 16.6)]],
            'alertas': [(5.25, 10.6), (5.25, 16.6), (5.25, 21.25), (5.25, 22.6), (0.45, 16.6), (0.45, 21.25), (8.4, 16.6), (5.25, 25.0)]},
}

LARGURAS = {
    'P01': [('120', 1.20, (5.25, 23.0), 'Passagem para o refeitório')],
    'P02': [('090', 0.90, (5.25, 13.0), 'Passagem estreita entre a Copa e o Arquivo (rota com piso tátil)'),
            ('085', 0.85, (0.0, 16.43), 'Porta da Sala de reunião (vão livre)'),
            ('150', 1.50, (9.75, 13.0), 'Passagem larga pelos Escritórios (rota alternativa)'),
            ('150B', 1.50, (8.25, 27.75), 'Corredor até a rampa')],
    'P03': [('180', 1.80, (5.25, 23.0), 'Saída para o terraço')],
}


# ------------------------------------------------------------------ grade: espaços → paredes e lajes
def grade(espacos):
    g = -np.ones((NX, NZ), dtype=np.int32)
    for n, e in enumerate(espacos):
        for (x0, x1, z0, z1) in e['rects']:
            i0, i1 = round((x0 - XMIN) / CEL), round((x1 - XMIN) / CEL)
            k0, k1 = round((z0 - ZMIN) / CEL), round((z1 - ZMIN) / CEL)
            g[i0:i1, k0:k1] = n
    return g


def estilo(espacos, a, b):
    if a == b:
        return None
    ea = espacos[a] if a >= 0 else None
    eb = espacos[b] if b >= 0 else None
    if ea and eb and ea['grupo'] == eb['grupo']:
        return None
    if ea is None or eb is None:
        e = ea or eb
        return {'terraco': 'parapeito', 'anexo': 'vidro'}.get(e['cat'], 'externa')
    for x, y in ((ea, eb), (eb, ea)):
        if x['vidro_hall'] and y['grupo'] == 'hall':
            return 'vidro'
    return 'parede'


def em_abertura(portas, ori, pos, a, b):
    for p in portas:
        if p[0] == ori and abs(p[1] - pos) < 1e-6 and p[2] - 1e-6 <= a and b <= p[3] + 1e-6:
            return p
    return None


def paredes(no_paredes, espacos, portas, base):
    g = grade(espacos)
    trechos = []  # (ori, pos, a, b, estilo)
    for ori in ('v', 'h'):
        n_linhas = NX if ori == 'v' else NZ
        for i in range(1, n_linhas):
            pos = (XMIN if ori == 'v' else ZMIN) + i * CEL
            atual, ini = None, 0
            n_cel = NZ if ori == 'v' else NX
            for k in range(n_cel + 1):
                s = None
                if k < n_cel:
                    a_, b_ = (g[i - 1, k], g[i, k]) if ori == 'v' else (g[k, i - 1], g[k, i])
                    s = estilo(espacos, a_, b_)
                    c0 = (ZMIN if ori == 'v' else XMIN) + k * CEL
                    if s and em_abertura(portas, ori, pos, c0, c0 + CEL):
                        s = None
                if s != atual:
                    if atual:
                        c0 = (ZMIN if ori == 'v' else XMIN)
                        trechos.append((ori, round(pos, 3), round(c0 + ini * CEL, 3), round(c0 + k * CEL, 3), atual))
                    atual, ini = s, k
    malha = no_paredes.malha
    for ori, pos, a, b, s in trechos:
        esp = {'parede': T, 'externa': T + 0.05, 'vidro': 0.03, 'parapeito': 0.03}[s]
        alt = 1.1 if s == 'parapeito' else ALT
        # fecha os cantos: estende meia espessura, menos onde encosta numa porta
        ea = 0 if em_abertura(portas, ori, pos, a - CEL, a) else 0.08
        eb = 0 if em_abertura(portas, ori, pos, b, b + CEL) else 0.08
        if s in ('vidro', 'parapeito'):
            ea = eb = 0
        material = {'parede': 'parede', 'externa': 'parede_externa', 'vidro': 'vidro', 'parapeito': 'vidro'}[s]
        if ori == 'v':
            malha.caixa(material, pos - esp / 2, pos + esp / 2, base, base + alt, a - ea, b + eb)
        else:
            malha.caixa(material, a - ea, b + eb, base, base + alt, pos - esp / 2, pos + esp / 2)
        if s in ('vidro', 'parapeito'):  # perfis de alumínio: em cima, embaixo e a cada 1,5 m
            topo = base + alt
            for y0, y1 in ((base, base + 0.06), (topo - 0.05, topo)):
                if ori == 'v':
                    malha.caixa('caixilho', pos - 0.03, pos + 0.03, y0, y1, a, b)
                else:
                    malha.caixa('caixilho', a, b, y0, y1, pos - 0.03, pos + 0.03)
            n = max(1, round((b - a) / 1.5))
            for j in range(n + 1):
                c = a + (b - a) * j / n
                if ori == 'v':
                    malha.caixa('caixilho', pos - 0.03, pos + 0.03, base, topo, c - 0.025, c + 0.025)
                else:
                    malha.caixa('caixilho', c - 0.025, c + 0.025, base, topo, pos - 0.03, pos + 0.03)
    return g, trechos


def lado_da_sala(espacos, g, ori, pos, meio):
    """Para que lado da linha fica a sala (não o hall): +1 ou -1."""
    def esp(x, z):
        i, k = int((x - XMIN) / CEL), int((z - ZMIN) / CEL)
        n = g[i, k]
        return espacos[n] if n >= 0 else None
    if ori == 'v':
        mais, menos = esp(pos + 0.3, meio), esp(pos - 0.3, meio)
    else:
        mais, menos = esp(meio, pos + 0.3), esp(meio, pos - 0.3)
    if mais and mais['grupo'] != 'hall':
        return 1
    if menos and menos['grupo'] != 'hall':
        return -1
    return 1


def portas_geometria(no, espacos, g, portas, base):
    m = no.malha
    for ori, pos, a, b, tipo, nome in portas:
        w = b - a
        topo = base + 2.1
        # verga sobre o vão (até a laje de cima)
        if ori == 'v':
            m.caixa('parede', pos - T / 2, pos + T / 2, topo, base + ALT, a, b)
        else:
            m.caixa('parede', a, b, topo, base + ALT, pos - T / 2, pos + T / 2)
        if tipo == 'vao':
            continue
        # batentes
        for c in (a, b - 0.05):
            if ori == 'v':
                m.caixa('caixilho', pos - T / 2 - 0.01, pos + T / 2 + 0.01, base, topo, c, c + 0.05)
            else:
                m.caixa('caixilho', c, c + 0.05, base, topo, pos - T / 2 - 0.01, pos + T / 2 + 0.01)
        if ori == 'v':
            m.caixa('caixilho', pos - T / 2 - 0.01, pos + T / 2 + 0.01, topo, topo + 0.05, a, b)
        else:
            m.caixa('caixilho', a, b, topo, topo + 0.05, pos - T / 2 - 0.01, pos + T / 2 + 0.01)
        if tipo in ('porta', 'corta_fogo'):
            s = lado_da_sala(espacos, g, ori, pos, (a + b) / 2)
            folha = 'porta_corta_fogo' if tipo == 'corta_fogo' else 'porta'
            larg = w - 0.1
            if ori == 'v':   # aberta a 90°, encostada no batente de início
                m.caixa(folha, pos + s * 0.02, pos + s * (0.02 + larg), base + 0.01, base + 2.05, a + 0.05, a + 0.09)
            else:
                m.caixa(folha, a + 0.05, a + 0.09, base + 0.01, base + 2.05, pos + s * 0.02, pos + s * (0.02 + larg))
        elif tipo in ('vidro', 'vidro_duplo'):  # portas de correr abertas, encostadas ao lado do vão
            for (c0, c1) in ((a - w / 2, a), (b, b + w / 2)) if tipo == 'vidro_duplo' else ((b, b + w),):
                if ori == 'v':
                    m.caixa('vidro', pos + 0.1, pos + 0.13, base, topo, c0, c1)
                else:
                    m.caixa('vidro', c0, c1, base, topo, pos + 0.1, pos + 0.13)


def retangulos(mascara):
    """Junta células em retângulos (gulosa), para a laje sair com poucas caixas."""
    usado = np.zeros_like(mascara, dtype=bool)
    out = []
    nx, nz = mascara.shape
    for k in range(nz):
        i = 0
        while i < nx:
            if mascara[i, k] and not usado[i, k]:
                i1 = i
                while i1 < nx and mascara[i1, k] and not usado[i1, k]:
                    i1 += 1
                k1 = k + 1
                while k1 < nz and mascara[i:i1, k1].all() and not usado[i:i1, k1].any():
                    k1 += 1
                usado[i:i1, k:k1] = True
                out.append((XMIN + i * CEL, XMIN + i1 * CEL, ZMIN + k * CEL, ZMIN + k1 * CEL))
                i = i1
            else:
                i += 1
    return out


def lajes(no, espacos, g, aberturas, base, cobertura=False):
    abert = np.zeros((NX, NZ), dtype=bool)
    for (x0, x1, z0, z1) in aberturas:
        abert[round((x0 - XMIN) / CEL):round((x1 - XMIN) / CEL), round((z0 - ZMIN) / CEL):round((z1 - ZMIN) / CEL)] = True
    for n, e in enumerate(espacos):
        if cobertura and e['cat'] == 'terraco':
            continue
        masc = (g == n) & ~abert
        for (x0, x1, z0, z1) in retangulos(masc):
            no.malha.caixa('laje' if cobertura else e['piso'], x0, x1, base - LAJE, base, z0, z1)


# ------------------------------------------------------------------ piso tátil
def faixa_direcional(m, p0, p1, y):
    (x0, z0), (x1, z1) = p0, p1
    L = math.hypot(x1 - x0, z1 - z0)
    if L < 0.05:
        return
    ang = math.atan2(z1 - z0, x1 - x0)
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    m.caixa_girada('tatil', cx, cz, y + 0.001, y + 0.004, L, 0.40, ang)
    px, pz = -math.sin(ang), math.cos(ang)
    for off in (-0.135, -0.045, 0.045, 0.135):   # quatro frisos no sentido de caminhar (NBR 16537)
        m.caixa_girada('tatil', cx + px * off, cz + pz * off, y + 0.004, y + 0.009, max(0.02, L - 0.04), 0.03, ang)


def area_alerta(m, cx, cz, y, w=0.8, d=0.8):
    m.caixa('tatil', cx - w / 2, cx + w / 2, y + 0.001, y + 0.004, cz - d / 2, cz + d / 2)
    nx, nz = max(1, round(w / 0.1)), max(1, round(d / 0.1))
    for i in range(nx):
        for k in range(nz):
            x = cx - w / 2 + (i + 0.5) * w / nx
            z = cz - d / 2 + (k + 0.5) * d / nz
            m.caixa('tatil', x - 0.015, x + 0.015, y + 0.004, y + 0.009, z - 0.015, z + 0.015, faces=('cima', 'l0', 'l1', 'l2', 'l3'))


def piso_tatil(no, andar, base, extras_alerta):
    t = TATIL[andar]
    d = no.filho(f'{P}{andar}PISOTATIL_DIRECIONAL', {'tipo': 'piso_tatil_direcional', 'categoria': 'PISO_TATIL',
                                                     'trechos': [[list(p) for p in l] for l in t['linhas']],
                                                     'rotulo': None})
    for linha in t['linhas']:
        for p0, p1 in zip(linha, linha[1:]):
            faixa_direcional(d.malha, p0, p1, base)
    if t.get('anel'):
        cx, cz, r = t['anel']
        n = 40
        pts = [(cx + r * math.cos(2 * math.pi * i / n), cz + r * math.sin(2 * math.pi * i / n)) for i in range(n + 1)]
        for p0, p1 in zip(pts, pts[1:]):
            faixa_direcional(d.malha, p0, p1, base)
        d.extras['anel'] = {'centro': [cx, cz], 'raio_m': r, 'nota': 'contorna o canteiro da Área central'}
    a = no.filho(f'{P}{andar}PISOTATIL_ALERTA', {'tipo': 'piso_tatil_alerta', 'categoria': 'PISO_TATIL', 'areas': []})
    for (x, z) in t['alertas']:
        area_alerta(a.malha, x, z, base)
        a.extras['areas'].append([x, z, 0.8, 0.8])
    for (x, z, w, dd) in extras_alerta:
        area_alerta(a.malha, x, z, base, w, dd)
        a.extras['areas'].append([x, z, w, dd])


# ------------------------------------------------------------------ escadas
def corrimao(m, pts, r=0.022):
    for p0, p1 in zip(pts, pts[1:]):
        m.cilindro('corrimao', p0, p1, r, lados=8, tampas=False)
    for p in (pts[0], pts[-1]):
        m.esfera('corrimao', p, r, seg=6, aneis=4)


def placa_braille(m, p, sentido):
    """Placa com braille embaixo do corrimão, no começo e no fim (indica andar e sentido)."""
    x, y, z = p
    if sentido == 'z':
        m.caixa('braille_placa', x - 0.03, x + 0.03, y - 0.07, y - 0.035, z - 0.06, z + 0.06)
        for i in range(2):
            for k in range(3):
                m.caixa('braille_ponto', x - 0.036, x - 0.03, y - 0.06 + i * 0.012, y - 0.054 + i * 0.012, z - 0.03 + k * 0.025, z - 0.024 + k * 0.025)
                m.caixa('braille_ponto', x + 0.03, x + 0.036, y - 0.06 + i * 0.012, y - 0.054 + i * 0.012, z - 0.03 + k * 0.025, z - 0.024 + k * 0.025)
    else:
        m.caixa('braille_placa', x - 0.06, x + 0.06, y - 0.07, y - 0.035, z - 0.03, z + 0.03)


def lance(m, x0, x1, z_ini, sentido, base, n=10, espelho=0.15, piso=0.28):
    """Lance de escada: n degraus subindo no sentido (+1 = para o sul, -1 = para o norte)."""
    for i in range(n):
        za, zb = z_ini + sentido * i * piso, z_ini + sentido * (i + 1) * piso
        topo = base + (i + 1) * espelho
        m.caixa('degrau', x0, x1, topo - 0.32, topo, za, zb)
        borda_z = za if sentido > 0 else za - 0.05 * 0  # faixa contrastante na borda do degrau (NBR 9050)
        if sentido > 0:
            m.caixa('borda_degrau', x0 + 0.02, x1 - 0.02, topo - 0.004, topo + 0.002, za, za + 0.05)
            m.caixa('borda_degrau', x0 + 0.02, x1 - 0.02, topo - 0.05, topo - 0.004, za - 0.002, za + 0.003)
        else:
            m.caixa('borda_degrau', x0 + 0.02, x1 - 0.02, topo - 0.004, topo + 0.002, za - 0.05, za)
            m.caixa('borda_degrau', x0 + 0.02, x1 - 0.02, topo - 0.05, topo - 0.004, za - 0.003, za + 0.002)
        del borda_z


def corrimaos_do_lance(m, xs, z_ini, sentido, base, alturas, braille, n=10, espelho=0.15, piso=0.28):
    z_fim = z_ini + sentido * (n - 1) * piso
    for x in xs:
        for h in alturas:
            pts = [(x, base + espelho + h, z_ini - sentido * 0.30), (x, base + espelho + h, z_ini),
                   (x, base + n * espelho + h, z_fim), (x, base + n * espelho + h, z_fim + sentido * 0.30)]
            corrimao(m, pts)
            if braille:
                placa_braille(m, pts[0], 'z')
                placa_braille(m, pts[-1], 'z')
        # suportes
        for j in range(4):
            zz = z_ini + (z_fim - z_ini) * j / 3
            frac = (zz - z_ini) / (z_fim - z_ini)
            y = base + espelho + (n - 1) * espelho * frac
            m.cilindro('corrimao', (x, y, zz), (x, y + max(alturas), zz), 0.012, lados=6)


def escada(no_andar, andar, base, qual):
    """Escada em U entre este andar e o de cima (dois lances de 10 degraus de 15 cm × 28 cm)."""
    braille = qual == 'B'
    if qual == 'A':
        lanes = ((10.65, 12.35), (12.65, 14.35)); z1, s1 = 9.4, -1; z2, s2 = 6.6, 1
        patamar = (10.5, 14.5, 5.0, 6.6); nucleo = (12.425, 12.575, 6.6, 9.4)
    else:
        lanes = ((-1.85, -0.15), (-3.85, -2.15)); z1, s1 = 22.0, 1; z2, s2 = 24.8, -1
        patamar = (-4.0, 0.0, 24.8, 26.3); nucleo = (-2.075, -1.925, 22.0, 24.8)
    no = no_andar.filho(f'{P}{andar}ESCADA_{qual}', {
        'tipo': 'escada', 'categoria': 'ESCADA', 'equipamento': f'ESC_{qual}', 'de': andar, 'para': f'P0{int(andar[2]) + 1}',
        'braille': braille, 'corrimao': 'duplo (0,70 m e 0,92 m), dos dois lados, com placas em braille' if braille else 'simples (0,92 m), de um lado, sem braille',
        'degraus': 20, 'espelho_m': 0.15, 'piso_m': 0.28,
        'rotulo': f'Escada {qual} — ' + ('com braille' if braille else 'sem braille'),
        'info': ('Escada B: corrimão duplo dos dois lados e placas em braille no começo e no fim de cada corrimão. '
                 'É a escada ligada ao piso tátil.') if braille else
                ('Escada A: corrimão simples, sem braille e sem piso tátil até a porta. Fica mais perto da entrada.')})
    m = no.malha
    lance(m, *lanes[0], z1, s1, base)
    lance(m, *lanes[1], z2, s2, base + 1.5)
    x0, x1, pz0, pz1 = patamar
    m.caixa('piso_escada', x0, x1, base + 1.5 - 0.2, base + 1.5, pz0, pz1)
    m.caixa('parede', nucleo[0], nucleo[1], base, base + ALT, nucleo[2], nucleo[3])
    if braille:
        alt = (0.70, 0.92)
        corrimaos_do_lance(m, (lanes[0][0] + 0.06, lanes[0][1] - 0.06), z1, s1, base, alt, True)
        corrimaos_do_lance(m, (lanes[1][0] + 0.06, lanes[1][1] - 0.06), z2, s2, base + 1.5, alt, True)
    else:
        externo0 = lanes[0][0] + 0.06 if qual == 'A' else lanes[0][1] - 0.06
        externo1 = lanes[1][1] - 0.06 if qual == 'A' else lanes[1][0] + 0.06
        corrimaos_do_lance(m, (externo0,), z1, s1, base, (0.92,), False)
        corrimaos_do_lance(m, (externo1,), z2, s2, base + 1.5, (0.92,), False)
    return no


def alertas_escadas(andar):
    """Áreas de alerta no patamar do andar: antes do primeiro degrau (subida) e na chegada (descida)."""
    out = []
    if andar != 'P03':   # sobe daqui
        out += [((10.65 + 12.35) / 2, 9.65, 1.7, 0.4), ((-1.85 - 0.15) / 2, 21.75, 1.7, 0.4)]
    if andar != 'P01':   # chega aqui
        out += [((12.65 + 14.35) / 2, 9.65, 1.7, 0.4), ((-3.85 - 2.15) / 2, 21.75, 1.7, 0.4)]
    return out


# ------------------------------------------------------------------ rampa (anexo a leste)
XW, XE = (17.575, 19.175), (19.325, 20.925)
NUCLEO_RAMPA = (19.175, 19.325)


def y_raia(raia, z):
    if raia == 'W':
        if z >= 24.0: return 0.0
        if z >= 15.0: return (24.0 - z) / 9.0 * 0.75
        if z >= 13.5: return 0.75
        if z >= 4.5: return 0.75 + (13.5 - z) / 9.0 * 0.75
        return 1.5
    if z <= 4.5: return 1.5
    if z <= 13.5: return 1.5 + (z - 4.5) / 9.0 * 0.75
    if z <= 15.0: return 2.25
    if z <= 24.0: return 2.25 + (z - 15.0) / 9.0 * 0.75
    return 3.0


def rampa(no_andar, andar, base):
    no = no_andar.filho(f'{P}{andar}RAMPA_1', {
        'tipo': 'rampa', 'categoria': 'RAMPA', 'de': andar, 'para': f'P0{int(andar[2]) + 1}', 'inclinacao_pct': 8.33,
        'largura_m': 1.60, 'segmentos': 4, 'comprimento_segmento_m': 9.0, 'desnivel_segmento_m': 0.75, 'patamar_m': 1.5,
        'rotulo': 'Rampa i = 8,33%',
        'info': 'Rampa em ziguezague: 4 trechos de 9 m (sobem 0,75 m cada) com patamares de 1,5 m; corrimão duplo dos dois lados; '
                'piso tátil de alerta no começo e no fim. Liga os três andares, inclusive o 3º, onde o elevador não chega.'})
    m = no.malha
    segs = [('W', 24.0, 15.0), ('W', 13.5, 4.5), ('E', 4.5, 13.5), ('E', 15.0, 24.0)]
    for raia, za, zb in segs:
        x0, x1 = XW if raia == 'W' else XE
        ya, yb = base + y_raia(raia, za), base + y_raia(raia, zb)
        m.hexa('rampa', [(x0, ya - 0.2, za), (x1, ya - 0.2, za), (x1, yb - 0.2, zb), (x0, yb - 0.2, zb),
                         (x0, ya, za), (x1, ya, za), (x1, yb, zb), (x0, yb, zb)])
    m.caixa('piso_rampa', XW[0], XW[1], base + 0.55, base + 0.75, 13.5, 15.0)      # patamar intermediário (oeste)
    m.caixa('piso_rampa', XE[0], XE[1], base + 2.05, base + 2.25, 13.5, 15.0)      # patamar intermediário (leste)
    m.caixa('piso_rampa', 17.5, 21.0, base + 1.3, base + 1.5, 3.0, 4.5)            # patamar de retorno (norte)
    m.caixa('parede', NUCLEO_RAMPA[0], NUCLEO_RAMPA[1], base, base + ALT, 4.5, 24.0)
    # corrimãos duplos dos dois lados, acompanhando o piso
    zs_w = [24.3, 24.0, 15.0, 13.5, 4.5]
    zs_e = [4.5, 13.5, 15.0, 24.0, 24.3]
    for h in (0.70, 0.92):
        corrimao(m, [(XW[1] - 0.05, base + y_raia('W', z) + h, z) for z in zs_w])
        corrimao(m, [(XE[0] + 0.05, base + y_raia('E', z) + h, z) for z in zs_e])
        externo = ([(XW[0] + 0.05, base + y_raia('W', z) + h, z) for z in zs_w + [3.1]] +
                   [(XE[1] - 0.05, base + 1.5 + h, 3.1)] + [(XE[1] - 0.05, base + y_raia('E', z) + h, z) for z in zs_e])
        corrimao(m, externo)
    for z in (21.0, 18.0, 12.0, 9.0, 6.0):
        for x, r in ((XW[0] + 0.05, 'W'), (XW[1] - 0.05, 'W'), (XE[0] + 0.05, 'E'), (XE[1] - 0.05, 'E')):
            y = base + y_raia(r, z)
            m.cilindro('corrimao', (x, y, z), (x, y + 0.92, z), 0.015, lados=6)
    return no


def alertas_rampa(andar):
    out = []
    if andar != 'P03':
        out.append(((XW[0] + XW[1]) / 2, 24.3, 1.6, 0.4))
    if andar != 'P01':
        out.append(((XE[0] + XE[1]) / 2, 24.3, 1.6, 0.4))
    return out


# ------------------------------------------------------------------ elevadores
ELEVADORES = [(1, 6.8, 'P01'), (2, 10.8, 'P02')]   # número, centro z da porta, andar onde a cabine está


def elevadores(no_andar, andar, base, mats_fora):
    if andar == 'P03':
        return
    for num, zc, onde in ELEVADORES:
        ext = {'tipo': 'porta_elevador', 'categoria': 'ELEVADOR', 'equipamento': f'ELEV_0{num}', 'andares': ['P01', 'P02'],
               'rotulo': f'Elevador {num} (1º e 2º andar)',
               'info': f'Elevador {num}: atende o 1º e o 2º andar. Cabine 1,60 × 2,15 m, porta de 0,90 m, botões com braille '
                       'e tela com o andar escrito. Para o 3º andar: rampa ou escadas.'}
        no = no_andar.filho(f'{P}{andar}ELEVADOR_{num}', ext)
        m = no.malha
        z0, z1 = zc - 0.45, zc + 0.45
        for c0, c1 in ((z0, zc), (zc, z1)):   # portas de pavimento fechadas
            m.caixa('elevador', -0.06, 0.0, base, base + 2.1, c0 + 0.005, c1 - 0.005)
        m.caixa('tela_escura', 0.0, 0.03, base + 2.2, base + 2.42, zc - 0.25, zc + 0.25)     # tela com o andar
        m.caixa('botao', 0.0, 0.03, base + 0.9, base + 1.25, z1 + 0.25, z1 + 0.4)           # botoeira
        m.caixa('luz_chamada', 0.03, 0.04, base + 1.05, base + 1.11, z1 + 0.30, z1 + 0.35)
        if andar == onde:   # cabine parada neste andar
            c = no.filho(f'{P}{andar}CABINE_E{num}', {'tipo': 'cabine_elevador', 'equipamento': f'ELEV_0{num}'})
            cm = c.malha
            cm.caixa('elevador_interno', -2.35, -0.15, base, base + 0.05, zc - 0.8, zc + 0.8)
            cm.caixa('elevador_interno', -2.4, -2.35, base, base + 2.3, zc - 0.8, zc + 0.8)
            for s in (-1, 1):
                cm.caixa('elevador_interno', -2.4, -0.15, base, base + 2.3, zc + s * 0.8 - (0.05 if s > 0 else 0), zc + s * 0.8 + (0.05 if s < 0 else 0))
            cm.caixa('elevador_interno', -2.4, -0.15, base + 2.3, base + 2.35, zc - 0.85, zc + 0.85)
            cm.cilindro('corrimao', (-2.3, base + 0.9, zc - 0.7), (-2.3, base + 0.9, zc + 0.7), 0.02, lados=8)
            cm.caixa('tela_escura', -0.25, -0.2, base + 1.4, base + 1.7, zc + 0.55, zc + 0.75)
        # "Fora de serviço": escondido de início; o visualizador (e depois o app) liga e desliga
        fora = no.filho(f'{P}{andar}INTERDICAO_E{num}', {
            'tipo': 'elevador_fora_de_servico', 'equipamento': f'ELEV_0{num}', 'estado_inicial': 'oculto',
            'info': f'Elevador {num} fora de serviço: rotas sem escada para o outro andar passam a usar a rampa.'})
        fm = fora.malha
        for zz in (z0 - 0.35, z1 + 0.35):
            fm.cilindro('metal_escuro', (0.75, base, zz), (0.75, base + 1.0, zz), 0.03, lados=8)
            fm.cilindro('metal_escuro', (0.75, base, zz), (0.75, base + 0.02, zz), 0.16, lados=12)
        for y in (base + 0.55, base + 0.95):
            fm.caixa('interdicao', 0.72, 0.78, y, y + 0.08, z0 - 0.35, z1 + 0.35)
        fm.caixa('metal_escuro', 0.95, 0.99, base, base + 1.25, zc - 0.03, zc + 0.03)
        fm.quad_textura(mats_fora, [(1.0, base + 1.0, zc + 0.25), (1.0, base + 1.0, zc - 0.25),
                                    (1.0, base + 1.62, zc - 0.25), (1.0, base + 1.62, zc + 0.25)])
        fm.caixa('interdicao', 0.0, 0.04, base + 2.2, base + 2.42, zc - 0.25, zc + 0.25)


# ------------------------------------------------------------------ mobiliário e plantas
def planta(m, x, z, y, r=0.3, alt=1.0):
    m.cilindro('vaso', (x, y, z), (x, y + 0.45, z), r * 0.7, lados=10, r_topo=r * 0.85)
    m.esfera('planta', (x, y + 0.45 + alt * 0.4, z), r * 1.15, seg=8, aneis=5, achatar=alt * 0.9)


def mesa(m, x, z, y, w=1.2, d=0.8, alt=0.75, cadeiras=True, mat_tampo='madeira'):
    m.caixa(mat_tampo, x - w / 2, x + w / 2, y + alt - 0.04, y + alt, z - d / 2, z + d / 2)
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.caixa('metal_escuro', x + sx * (w / 2 - 0.06) - 0.025, x + sx * (w / 2 - 0.06) + 0.025, y, y + alt - 0.04,
                    z + sz * (d / 2 - 0.06) - 0.025, z + sz * (d / 2 - 0.06) + 0.025)
    if cadeiras:
        for dz in (-1, 1):
            for dx in ((-w / 4, w / 4) if w >= 1.1 else (0,)):
                cadeira(m, x + dx, z + dz * (d / 2 + 0.3), y, frente=-dz)


def cadeira(m, x, z, y, frente=1):
    m.caixa('estofado', x - 0.22, x + 0.22, y + 0.42, y + 0.47, z - 0.22, z + 0.22)
    m.caixa('estofado', x - 0.22, x + 0.22, y + 0.47, y + 0.9, z - frente * 0.22 - 0.03, z - frente * 0.22 + 0.03)
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.caixa('metal_escuro', x + sx * 0.19 - 0.015, x + sx * 0.19 + 0.015, y, y + 0.42, z + sz * 0.19 - 0.015, z + sz * 0.19 + 0.015)


def estante(m, x0, x1, z0, z1, y, alt=1.8):
    m.caixa('mobilia', x0, x1, y, y + 0.05, z0, z1)
    m.caixa('mobilia', x0, x1, y + alt - 0.04, y + alt, z0, z1)
    for k in range(1, 4):
        yy = y + alt * k / 4
        m.caixa('madeira', x0, x1, yy - 0.02, yy, z0, z1)
    for xx in (x0, x1 - 0.03):
        m.caixa('mobilia', xx, xx + 0.03, y, y + alt, z0, z1)


def sanitario(m, x0, x1, z0, z1, y, porta_lado):
    """Bacia com barras de apoio e lavatório (sanitário acessível simplificado)."""
    bx, bz = x1 - 0.45, z0 + 0.5
    m.caixa('louca', bx - 0.2, bx + 0.2, y, y + 0.46, bz - 0.35, bz + 0.3)
    m.caixa('louca', bx - 0.25, bx + 0.25, y + 0.46, y + 0.85, bz - 0.5, bz - 0.35)
    m.cilindro('corrimao', (x1 - 0.05, y + 0.75, bz - 0.4), (x1 - 0.05, y + 0.75, bz + 0.5), 0.02, lados=8)
    m.cilindro('corrimao', (bx - 0.4, y + 0.75, z0 + 0.05), (bx + 0.35, y + 0.75, z0 + 0.05), 0.02, lados=8)
    lx, lz = x0 + 0.8, z1 - 0.3
    m.caixa('louca', lx - 0.3, lx + 0.3, y + 0.78, y + 0.86, lz - 0.25, lz + 0.25)
    del porta_lado


# ------------------------------------------------------------------ pontos de referência (instruções visuais)
def totem(no_andar, andar, id_, x, z, base, normal, textura, info, rotulo, instrucoes):
    no = no_andar.filho(f'{P}{andar}REFERENCIA_{id_}', {
        'tipo': 'ponto_referencia', 'categoria': 'REFERENCIA', 'publico': ['deficiencia_auditiva', 'todos'],
        'rotulo': rotulo, 'info': info, 'instrucoes': instrucoes, 'posicao': [x, z]})
    m = no.malha
    ang = math.atan2(normal[1], normal[0]) + math.pi / 2
    m.caixa_girada('totem', x, z, base, base + 1.95, 0.72, 0.24, ang)
    m.caixa_girada('metal_escuro', x, z, base, base + 0.04, 0.9, 0.42, ang)
    nx, nz = normal
    tx, tz = nz, -nx   # direita de quem olha a tela de frente
    fx, fz = x + nx * 0.125, z + nz * 0.125
    w, y0, y1 = 0.30, base + 0.82, base + 1.85
    m.quad_textura(textura, [(fx - tx * w, y0, fz - tz * w), (fx + tx * w, y0, fz + tz * w),
                             (fx + tx * w, y1, fz + tz * w), (fx - tx * w, y1, fz - tz * w)])
    m.caixa('estrobo', fx - 0.05, fx + 0.05, base + 2.0, base + 2.08, fz - 0.05, fz + 0.05)
    return no


def painel_parede(no_andar, andar, id_, ori, pos, a, b, y0, y1, normal_sinal, textura, info, rotulo, instrucoes, estrobo=True):
    """Tela na parede: ori 'v' (parede em x = pos) ou 'h' (parede em z = pos), de a a b; olha para o lado normal_sinal."""
    no = no_andar.filho(f'{P}{andar}REFERENCIA_{id_}', {
        'tipo': 'ponto_referencia', 'categoria': 'REFERENCIA', 'publico': ['deficiencia_auditiva', 'todos'],
        'rotulo': rotulo, 'info': info, 'instrucoes': instrucoes})
    m = no.malha
    nx, nz = (normal_sinal, 0.0) if ori == 'v' else (0.0, normal_sinal)
    rx, rz = nz, -nx                      # direita de quem olha a tela de frente
    c = (a + b) / 2
    w = abs(b - a) / 2
    cx, cz = (pos, c) if ori == 'v' else (c, pos)
    sup = 0.115                            # passa da face da parede mais grossa (externa: 0,10 m)
    fx, fz = cx + nx * (sup + 0.012), cz + nz * (sup + 0.012)
    bx0, bx1 = sorted((cx + nx * 0.06, cx + nx * (sup + 0.01)))
    bz0, bz1 = sorted((cz + nz * 0.06, cz + nz * (sup + 0.01)))
    if ori == 'v':
        m.caixa('metal_escuro', bx0, bx1, y0 - 0.04, y1 + 0.04, c - w - 0.04, c + w + 0.04)
    else:
        m.caixa('metal_escuro', c - w - 0.04, c + w + 0.04, y0 - 0.04, y1 + 0.04, bz0, bz1)
    m.quad_textura(textura, [(fx - rx * w, y0, fz - rz * w), (fx + rx * w, y0, fz + rz * w),
                             (fx + rx * w, y1, fz + rz * w), (fx - rx * w, y1, fz - rz * w)])
    no.extras['posicao'] = [cx, cz]
    if estrobo:
        m.caixa('estrobo', fx - 0.05, fx + 0.05, y1 + 0.12, y1 + 0.2, fz - 0.05, fz + 0.05)
    return no


# ------------------------------------------------------------------ obstáculos (para testes de rotas alternativas)
def cone(m, x, z, y):
    m.cilindro('obstaculo', (x, y + 0.03, z), (x, y + 0.7, z), 0.15, lados=10, r_topo=0.02)
    m.caixa('obstaculo', x - 0.2, x + 0.2, y, y + 0.03, z - 0.2, z + 0.2)
    m.cilindro('obstaculo_branco', (x, y + 0.35, z), (x, y + 0.47, z), 0.105, lados=10, r_topo=0.085, tampas=False)


def barreira(m, x0, z0, x1, z1, y):
    cone(m, x0, z0, y); cone(m, x1, z1, y)
    for h, mt in ((0.62, 'obstaculo'), (0.66, 'obstaculo_branco')):
        m.cilindro(mt, (x0, y + h, z0), (x1, y + h, z1), 0.025, lados=6)


def placa_piso_molhado(m, x, z, y):
    m.hexa('aviso_amarelo', [(x - 0.15, y, z - 0.18), (x + 0.15, y, z - 0.18), (x + 0.15, y, z - 0.14), (x - 0.15, y, z - 0.14),
                             (x - 0.15, y + 0.62, z - 0.01), (x + 0.15, y + 0.62, z - 0.01), (x + 0.15, y + 0.62, z + 0.01), (x - 0.15, y + 0.62, z + 0.01)])
    m.hexa('aviso_amarelo', [(x - 0.15, y, z + 0.14), (x + 0.15, y, z + 0.14), (x + 0.15, y, z + 0.18), (x - 0.15, y, z + 0.18),
                             (x - 0.15, y + 0.62, z - 0.01), (x + 0.15, y + 0.62, z - 0.01), (x + 0.15, y + 0.62, z + 0.01), (x - 0.15, y + 0.62, z + 0.01)])


def obstaculos(no_andar, andar, base):
    lista = {
        'P01': [('01', 'Carrinho de limpeza e placa de piso molhado sobre o piso tátil entre a Entrada e a Área central', (5.25, 8.0), True, 0.0),
                ('02', 'Caixas de entrega na frente da Loja A, sobre o fim do piso tátil', (1.25, 16.5), True, 0.0),
                ('03', 'Mesa fora do lugar na passagem de 1,20 m do refeitório', (5.25, 23.55), True, 0.0),
                ('04', 'Obra: acesso à rampa fechado no 1º andar', (11.75, 22.45), False, 0.0),
                ('05', 'Escada B fechada para manutenção (porta no hall)', (0.85, 21.25), True, 0.0)],
        'P02': [('01', 'Vaso de planta dentro da passagem estreita de 0,90 m', (5.25, 13.0), True, 0.0),
                ('02', 'Escada de manutenção no corredor de 1,50 m até a rampa', (8.25, 27.75), True, 0.0),
                ('03', 'Rampa entre o 2º e o 3º andar interditada para limpeza (patamar intermediário)', (18.375, 14.25), False, 0.75)],
        'P03': [('01', 'Fila do evento sobre o cruzamento do piso tátil', (5.25, 16.6), True, 0.0),
                ('02', 'Cadeiras empilhadas na saída de 1,80 m para o terraço', (5.25, 23.6), True, 0.0)],
    }[andar]
    for id_, desc, (x, z), no_tatil, dy in lista:
        y = base + dy
        no = no_andar.filho(f'{P}{andar}OBSTACULO_{id_}', {
            'tipo': 'obstaculo', 'estado_inicial': 'oculto', 'descricao': desc, 'sobre_piso_tatil': no_tatil,
            'posicao': [x, z], 'andar': andar, 'info': desc + '. Ligue para testar uma rota alternativa.'})
        m = no.malha
        if andar == 'P01' and id_ == '01':
            m.caixa('obstaculo', x - 0.3, x + 0.3, y + 0.15, y + 0.95, z - 0.45, z + 0.45)
            m.caixa('metal_escuro', x - 0.3, x + 0.3, y + 0.95, y + 1.0, z - 0.5, z + 0.5)
            for sx in (-1, 1):
                for sz in (-1, 1):
                    m.cilindro('metal_escuro', (x + sx * 0.22 - 0.03, y + 0.06, z + sz * 0.38), (x + sx * 0.22 + 0.03, y + 0.06, z + sz * 0.38), 0.06, lados=8)
            placa_piso_molhado(m, x + 0.75, z - 0.6, y)
        elif id_ in ('02',) and andar == 'P01':
            for (dx, dz, h) in ((0, 0, 0), (0.05, 0.1, 0.45), (0.5, -0.3, 0)):
                m.caixa('caixa', x + dx - 0.25, x + dx + 0.25, y + h, y + h + 0.45, z + dz - 0.3, z + dz + 0.3)
        elif andar == 'P01' and id_ == '03':
            mesa(m, x, z, y, w=1.2, d=0.8, cadeiras=False)
            cadeira(m, x + 0.8, z, y, frente=-1)
        elif andar == 'P01' and id_ == '04':
            barreira(m, 10.85, z, 13.3, z, y)
            m.caixa('aviso_amarelo', 11.8, 12.3, y + 0.75, y + 1.15, z - 0.02, z + 0.02)
        elif andar == 'P01' and id_ == '05':
            barreira(m, x, 20.45, x, 22.05, y)
            m.caixa('interdicao', x - 0.02, x + 0.02, y + 0.75, y + 1.15, 21.0, 21.5)
        elif andar == 'P02' and id_ == '01':
            planta(m, x, z, y, r=0.32, alt=1.3)
        elif andar == 'P02' and id_ == '02':
            for sx in (-1, 1):
                m.caixa('metal_escuro', x - 0.3, x + 0.3, y, y + 1.8, z + sx * 0.25 - 0.03, z + sx * 0.25 + 0.03)
            for k in range(6):
                m.caixa('metal_escuro', x - 0.3 + k * 0.1, x - 0.27 + k * 0.1, y + 0.3 * k, y + 0.3 * k + 0.04, z - 0.25, z + 0.25)
            cone(m, x - 0.9, z, y); cone(m, x + 0.9, z, y)
        elif andar == 'P02' and id_ == '03':
            barreira(m, XW[0] + 0.15, z, XW[1] - 0.15, z, y)
            barreira(m, XE[0] + 0.15, z, XE[1] - 0.15, z, base + 2.25)
            no.extras['posicao_y'] = dy
        elif andar == 'P03' and id_ == '01':
            for (dx, dz) in ((-0.9, -0.9), (0.9, -0.9), (-0.9, 0.9), (0.9, 0.9)):
                m.cilindro('metal_escuro', (x + dx, y, z + dz), (x + dx, y + 0.95, z + dz), 0.03, lados=8)
                m.cilindro('metal_escuro', (x + dx, y, z + dz), (x + dx, y + 0.02, z + dz), 0.17, lados=12)
            for (a, b) in (((-0.9, -0.9), (0.9, -0.9)), ((-0.9, 0.9), (0.9, 0.9))):
                m.cilindro('estofado', (x + a[0], y + 0.9, z + a[1]), (x + b[0], y + 0.9, z + b[1]), 0.025, lados=6)
            for k, (dx, dz) in enumerate(((-0.35, 0.0), (0.3, 0.1))):   # duas pessoas na fila (formas simples)
                m.cilindro('estofado', (x + dx, y, z + dz), (x + dx, y + 1.3, z + dz), 0.2, lados=10)
                m.esfera('mobilia', (x + dx, y + 1.5, z + dz), 0.13, seg=8, aneis=5)
        elif andar == 'P03' and id_ == '02':
            for k in range(6):
                cadeira(m, x - 0.35 + (k % 2) * 0.7, z + (0.0 if k < 2 else (0.5 if k < 4 else 1.0)), y + 0.05 * (k // 2) * 0)
    return lista


# ------------------------------------------------------------------ texturas das telas
def texturas(espacos_por_andar):
    tx = {}
    tx['fora'] = mat_textura('tela_fora_de_servico', paineis.fora_de_servico())
    tx['saida'] = mat_textura('placa_saida', paineis.saida())
    A, V, AM = paineis.AZUL, paineis.VERMELHO, (168, 95, 0)
    tx['recepcao'] = mat_textura('placa_recepcao', paineis.placa('RECEPÇÃO', ['Atendimento por escrito e em Libras.', 'Toque no balcão: a luz azul acende.'], 'info'))
    tx['elevadores'] = mat_textura('tela_elevadores', paineis.totem_texto('ELEVADORES 1 E 2', 'elevador', [
        ('elevador', 'Vão até o 2º andar. A tela em cima da porta mostra o andar escrito.', A),
        ('rampa', '3º andar: use a rampa (porta ao lado do sanitário) ou as escadas.', A),
        ('alerta', 'Elevador parado? A tela fica vermelha com "FORA DE SERVIÇO".', V)], 'Dúvidas: Recepção, logo ao lado da entrada.'))
    tx['avisos1'] = mat_textura('tela_avisos_p01', paineis.totem_texto('AVISOS E ORIENTAÇÕES', 'tela', [
        ('luz', 'Alarme de incêndio: estas luzes piscam em vermelho. Siga as placas verdes SAÍDA.', V),
        ('escada', 'Escada B: corrimão com braille e piso tátil até a porta.', A),
        ('cadeira', 'Sem degraus: rampa no fundo do hall, à direita.', A),
        ('garfo', 'Refeitório: siga o piso tátil para o sul.', A)], 'Todo aviso falado também aparece nesta tela.'))
    tx['cardapio'] = mat_textura('tela_cardapio', paineis.totem_texto('CARDÁPIO DO DIA', 'garfo', [
        ('garfo', '1  Prato do dia: arroz, feijão, frango e salada', A),
        ('garfo', '2  Prato vegetariano: legumes e grão-de-bico', A),
        ('garfo', '3  Sopa do dia', A),
        ('escrita', 'Aponte o número no balcão. Senha na tela quando o prato ficar pronto.', AM)]))
    tx['rampa'] = mat_textura('placa_rampa', paineis.placa('RAMPA  i = 8,33%', ['Liga o 1º, o 2º e o 3º andar.', 'Patamar a cada 9 m · corrimão duplo.'], 'rampa'))
    tx['senhas'] = mat_textura('tela_senhas', paineis.totem_texto('SENHAS', 'tela', [
        ('tela', 'Senha A 027  →  Guichê 2', A),
        ('tela', 'Senha A 026  →  Guichê 1', (90, 99, 110)),
        ('luz', 'Quando sua senha aparecer, a luz azul do guichê pisca.', A),
        ('escrita', 'Atendimento por escrito e em Libras em todos os guichês.', A)]))
    tx['estreita'] = mat_textura('tela_passagem_estreita', paineis.totem_texto('PASSAGEM ESTREITA', 'alerta', [
        ('alerta', 'Adiante: passagem de 0,90 m de largura, com piso tátil.', AM),
        ('cadeira', 'Cadeira de rodas larga ou carrinho: passe pelos Escritórios (1,50 m), à esquerda de quem vem do norte.', A),
        ('escada', 'Escada B e Sala de reunião: depois da passagem.', A)], cor=AM))
    tx['eventos'] = mat_textura('tela_eventos', paineis.totem_texto('SALA DE EVENTOS', 'pessoas', [
        ('tela', 'Legenda ao vivo no telão durante todo o evento.', A),
        ('mao', 'Intérprete de Libras na frente do palco, à esquerda.', A),
        ('cadeira', 'Lugares para cadeira de rodas na primeira fila.', A)]))
    tx['terraco'] = mat_textura('tela_terraco', paineis.totem_texto('TERRAÇO', 'info', [
        ('alerta', 'Piso de madeira: escorrega quando chove.', AM),
        ('cadeira', 'Saída de 1,80 m, sem degrau.', A),
        ('rampa', 'Rampa para descer: porta à esquerda, no fundo do terraço.', A)]))
    for andar, nome, _ in ANDARES:
        esp = [dict(e) for e in espacos_por_andar[andar] if e['cat'] != 'anexo']
        for e in esp:
            e['cat'] = e['cat']
        aqui = {'P01': (8.3, 3.0), 'P02': (2.6, 9.0), 'P03': (8.0, 13.0)}[andar]
        linhas = [l for l in TATIL[andar]['linhas']]
        if TATIL[andar].get('anel'):
            cx, cz, r = TATIL[andar]['anel']
            linhas = linhas + [[(cx + r * math.cos(t / 20 * math.pi), cz + r * math.sin(t / 20 * math.pi)) for t in range(41)]]
        notas = {'P01': ['Elevadores 1 e 2: até o 2º andar.', 'Escada B: corrimão com braille.', 'Rampa: 1º, 2º e 3º andar.'],
                 'P02': ['Passagem estreita (0,90 m) entre Copa e Arquivo.', 'Passagem larga: pelos Escritórios.', 'Rampa: corredor ao sul.'],
                 'P03': ['Sem elevador neste andar.', 'Rampa: pelo Coworking.', 'Escada B: corrimão com braille.']}[andar]
        tx[f'mapa_{andar}'] = mat_textura(f'tela_mapa_{andar}', paineis.mapa_andar(f'MAPA — {nome.upper()}', esp, aqui, linhas, notas, (-7.2, 17.7, -0.2, 28.7)))
    return tx


# ------------------------------------------------------------------ cada andar
def rotulos_espacos(no, andar, espacos, base):
    for e in espacos:
        if not e['rotulo']:
            continue
        x0, x1, z0, z1 = max(e['rects'], key=lambda r: (r[1] - r[0]) * (r[3] - r[2]))
        no.filho(f'{P}{andar}ESPACO_{e["id"][:12]}', {'tipo': 'espaco', 'nome': e['nome'], 'rotulo': e['nome'],
                                                       'retangulos': [list(r) for r in e['rects']]},
                 posicao=[(x0 + x1) / 2, base + 2.4, (z0 + z1) / 2])


def mobilia(no, andar, base, tx):
    m = no.filho(f'{P}{andar}MOBILIA_GERAL', {'tipo': 'mobiliario'}).malha
    y = base
    if andar == 'P01':
        # recepção: balcão com parte baixa para cadeira de rodas (0,75 m) e luz de chamada
        m.caixa('balcao', 1.4, 2.6, y, y + 1.05, 2.4, 4.6)
        m.caixa('balcao', 2.6, 2.9, y, y + 0.75, 3.0, 4.0)
        m.caixa('luz_chamada', 2.6, 2.75, y + 0.75, y + 0.8, 3.75, 3.9)
        m.caixa('tela_escura', 2.35, 2.4, y + 1.05, y + 1.3, 2.9, 3.3)
        cadeira(m, 0.9, 3.5, y, frente=1)
        # área central: canteiro redondo com bancos
        cx, cz, _ = ANEL
        m.cilindro('vaso', (cx, y, cz), (cx, y + 0.45, cz), 1.5, lados=28)
        m.esfera('planta', (cx, y + 0.9, cz), 1.1, seg=12, aneis=6, achatar=0.8)
        planta(m, cx, cz, y + 0.45, r=0.4, alt=2.2)
        for k in range(4):
            a = math.pi / 4 + k * math.pi / 2
            m.caixa_girada('madeira', cx + 2.0 * math.cos(a), cz + 2.0 * math.sin(a), y + 0.42, y + 0.47, 1.2, 0.4, a + math.pi / 2)
        # refeitório: mesas fora do caminho do piso tátil, balcão ao sul
        for (x, z) in ((2.2, 24.6), (8.3, 24.6), (2.2, 26.4), (8.3, 26.4)):
            mesa(m, x, z, y, w=1.4, d=0.8)
        m.caixa('balcao', 3.8, 6.7, y, y + 0.9, 27.6, 28.35)
        m.caixa('balcao', 4.6, 5.9, y, y + 0.75, 27.35, 27.6)
        estante(m, -6.8, -6.4, 14.3, 18.7, y); estante(m, -4.5, -2.5, 15.6, 16.0, y, 1.4); estante(m, -4.5, -2.5, 17.2, 17.6, y, 1.4)
        estante(m, 17.0, 17.35, 14.3, 18.7, y); m.caixa('balcao', 12.0, 13.6, y, y + 1.0, 14.4, 15.0)
        sanitario(m, 13.6, 17.4, 19.1, 22.9, y, 'oeste')
        for (x, z) in ((0.5, 0.6), (9.9, 0.6), (9.9, 12.3), (0.5, 22.4), (9.9, 22.4)):
            planta(m, x, z, y)
    elif andar == 'P02':
        for k, x in enumerate((1.6, 4.2, 6.8)):   # guichês
            m.caixa('balcao', x - 1.0, x + 1.0, y, y + 0.75 if k == 0 else y + 1.05, 0.6, 1.3)
            cadeira(m, x, 2.0, y, frente=-1)
            m.caixa('luz_chamada', x - 0.08, x + 0.08, y + 1.9, y + 2.0, 1.2, 1.3)
        for k in range(5):
            cadeira(m, 1.3 + k * 0.6, 4.6, y, frente=-1)
        planta(m, 9.9, 5.4, y); planta(m, 0.5, 5.4, y)
        for (x, z) in ((7.5, 15.5), (9.5, 15.5), (11.5, 15.5), (7.5, 18.6), (9.5, 18.6), (11.5, 18.6)):
            mesa(m, x, z, y, w=1.4, d=0.7, cadeiras=False, mat_tampo='mobilia')
            cadeira(m, x, z + 0.6, y, frente=-1)
        mesa(m, -2.5, 16.5, y, w=2.4, d=1.1)
        for (x, z) in ((7.4, 22.2), (9.2, 22.2), (7.4, 23.9), (9.2, 23.9), (7.4, 25.6), (9.2, 25.6)):
            mesa(m, x, z, y, w=1.2, d=0.5, cadeiras=False, mat_tampo='mobilia')
            cadeira(m, x, z + 0.5, y, frente=-1)
        m.caixa('balcao', 0.2, 2.6, y, y + 0.9, 13.3, 13.85)
        estante(m, 6.0, 8.6, 13.4, 13.85, y)
        sanitario(m, 13.6, 17.4, 14.1, 18.9, y, 'norte')
        for (x, z) in ((0.5, 6.6), (9.9, 11.5), (0.5, 27.9)):
            planta(m, x, z, y)
    else:
        m.caixa('palco', 1.0, 9.5, y, y + 0.4, 0.4, 2.6)
        m.caixa('tela_escura', 2.5, 8.0, y + 1.3, y + 2.6, 0.2, 0.26)
        for r in range(4):
            for c in range(8):
                if c in (3, 4):
                    continue   # corredor central de 1,2 m até o palco
                cadeira(m, 1.4 + c * 1.1, 4.4 + r * 1.3, y, frente=-1)
        for (x, z) in ((8.0, 18.5), (11.5, 18.5), (8.0, 21.2), (11.5, 21.2)):
            mesa(m, x, z, y, w=1.6, d=0.9)
        for (x, z) in ((-2.5, 16.0), (-2.5, 18.0)):
            mesa(m, x, z, y, w=1.6, d=0.8)
        sanitario(m, 13.6, 17.4, 14.1, 18.9, y, 'norte')
        estante(m, 14.0, 17.0, 22.4, 22.8, y)
        for (x, z) in ((2.2, 25.2), (8.3, 25.2), (2.2, 27.4), (8.3, 27.4)):   # terraço: mesas com guarda-sol
            mesa(m, x, z, y, w=0.9, d=0.9)
            m.cilindro('metal_escuro', (x, y, z), (x, y + 2.3, z), 0.025, lados=6)
            m.cilindro('guarda_sol', (x, y + 1.95, z), (x, y + 2.4, z), 1.15, lados=12, r_topo=0.05)
        for (x, z) in ((0.5, 23.5), (9.9, 23.5), (0.5, 28.0), (9.9, 28.0), (0.5, 12.6)):
            planta(m, x, z, y)


def sinalizacao(no, andar, base, tx):
    m = no.filho(f'{P}{andar}SINALIZACAO_SAIDA', {'tipo': 'sinalizacao', 'info': 'Placas SAÍDA (verdes) acima das portas das escadas.'}).malha
    y0, y1 = base + 2.2, base + 2.42
    # Escada A (porta no lado sul da caixa da escada, z = 10.8): placa voltada para o hall (+z)
    zz = 10.8 + T / 2 + 0.01
    m.quad_textura(tx['saida'], [(11.55, y0, zz), (12.15, y0, zz), (12.15, y1, zz), (11.55, y1, zz)])
    # Escada B (porta em x = 0, olhando para +x)
    xx = T / 2 + 0.01
    m.quad_textura(tx['saida'], [(xx, y0, 21.55), (xx, y0, 20.95), (xx, y1, 20.95), (xx, y1, 21.55)])
    if andar == 'P01':
        zz = T / 2 + 0.035
        m.quad_textura(tx['saida'], [(4.95, y0, zz), (5.55, y0, zz), (5.55, y1, zz), (4.95, y1, zz)])


def referencias(no, andar, base, tx):
    if andar == 'P01':
        painel_parede(no, andar, 'RECEPCAO', 'v', 0.0, 2.3, 4.7, base + 1.75, base + 2.35, 1, tx['recepcao'],
                      'Recepção: atendimento por escrito e em Libras; luz azul de chamada no balcão (parte baixa a 0,75 m).',
                      'Recepção', ['Atendimento por escrito e em Libras', 'Toque no balcão: a luz azul acende'])
        totem(no, andar, 'MAPA', 8.3, 3.0, base, (-1, 0), tx['mapa_P01'], 'Mapa do prédio e diretório do 1º andar, com "Você está aqui" e o piso tátil.',
              'Mapa do prédio', ['Você está aqui: entrada', 'Elevadores até o 2º andar', 'Escada B com braille', 'Rampa para os 3 andares'])
        painel_parede(no, andar, 'ELEVADORES', 'v', 0.0, 8.35, 9.25, base + 1.0, base + 2.0, 1, tx['elevadores'],
                      'Elevadores 1 e 2: só até o 2º andar. Para o 3º: rampa ou escadas. Tela vermelha = fora de serviço.',
                      'Elevadores — aviso', ['Vão até o 2º andar', '3º andar: rampa ou escadas'])
        totem(no, andar, 'AVISOS', 2.4, 19.7, base, (1, 0), tx['avisos1'], 'Avisos e orientações: alarme com luz vermelha, Escada B com braille, rampa.',
              'Avisos e orientações', ['Alarme: luzes vermelhas piscam', 'Siga as placas verdes SAÍDA'])
        painel_parede(no, andar, 'CARDAPIO', 'h', 28.5, 5.85, 4.65, base + 1.25, base + 2.25, -1, tx['cardapio'],
                      'Cardápio do refeitório com números para apontar e senha na tela.', 'Cardápio', ['Aponte o número no balcão'])
    elif andar == 'P02':
        totem(no, andar, 'MAPA', 2.6, 9.0, base, (-1, 0), tx['mapa_P02'], 'Mapa do 2º andar na chegada dos elevadores.',
              'Mapa do prédio', ['Você está aqui: elevadores', 'Passagem estreita adiante'])
        painel_parede(no, andar, 'SENHAS', 'h', 0.0, 6.4, 8.6, base + 1.6, base + 2.6, 1, tx['senhas'],
                      'Painel de senhas dos Serviços administrativos: senha e guichê na tela, luz azul pisca no guichê.',
                      'Senhas (atendimento visual)', ['Senha e guichê na tela', 'Luz azul no guichê chamado'])
        painel_parede(no, andar, 'PASSAGEM', 'h', 12.0, 4.5, 3.6, base + 1.1, base + 2.1, -1, tx['estreita'],
                      'Aviso antes da passagem estreita de 0,90 m, com a alternativa de 1,50 m pelos Escritórios.',
                      'Aviso: passagem estreita', ['Adiante: 0,90 m', 'Alternativa: Escritórios (1,50 m)'])
    else:
        totem(no, andar, 'MAPA', 8.0, 13.0, base, (-1, 0), tx['mapa_P03'], 'Mapa do 3º andar: sem elevador; rampa pelo Coworking.',
              'Mapa do prédio', ['Sem elevador neste andar', 'Rampa pelo Coworking'])
        painel_parede(no, andar, 'EVENTOS', 'h', 12.0, 6.6, 7.6, base + 1.1, base + 2.1, 1, tx['eventos'],
                      'Sala de eventos: legenda ao vivo no telão e intérprete de Libras.', 'Sala de eventos — acessibilidade',
                      ['Legenda ao vivo', 'Intérprete de Libras'])
        painel_parede(no, andar, 'TERRACO', 'h', 23.0, 3.6, 2.6, base + 1.1, base + 2.1, -1, tx['terraco'],
                      'Terraço: piso de madeira escorrega na chuva; saída de 1,80 m sem degrau.', 'Terraço — aviso',
                      ['Piso escorrega na chuva', 'Saída de 1,80 m'])
    if andar in ('P01', 'P02', 'P03'):
        painel_parede(no, andar, 'RAMPA', 'h', 28.5, 13.9, 12.9, base + 1.3, base + 1.95, -1, tx['rampa'],
                      'Rampa i = 8,33% entre os três andares.', None, ['Liga os 3 andares'], estrobo=False)


def marcadores_largura(no, andar, base):
    for id_, w, (x, z), desc in LARGURAS[andar]:
        no.filho(f'{P}{andar}LARGURAMIN_{id_}', {'tipo': 'largura_minima', 'largura_m': w, 'descricao': desc,
                                                  'rotulo': f'{w:.2f} m'.replace('.', ','), 'info': f'{desc}: largura livre de {w:.2f} m.'.replace('.', ',', 1)},
                 posicao=[x, base + 1.0, z])


def andar_no(andar, nome, base, tx):
    esp = ESPACOS[andar]
    no = No(f'{P}{andar}', {'tipo': 'andar', 'andar': andar, 'nome': nome, 'altura_m': base, 'altura_andar_m': ALT})
    no.filho(f'{P}{andar}ROTULO_ANDAR', {'tipo': 'rotulo_andar', 'rotulo': nome}, posicao=[-7.5, base + 1.5, 1.0])
    pa = no.filho(f'{P}{andar}PAREDE_GERAL', {'tipo': 'paredes'})
    g, trechos = paredes(pa, esp, PORTAS[andar], base)
    portas_geometria(no.filho(f'{P}{andar}PORTA_GERAL', {'tipo': 'portas', 'portas': [
        {'nome': p[5], 'tipo': p[4], 'linha': p[0], 'pos': p[1], 'de': p[2], 'ate': p[3], 'largura_m': round(p[3] - p[2], 2)} for p in PORTAS[andar]]}),
        esp, g, PORTAS[andar], base)
    lajes(no.filho(f'{P}{andar}PISO_LAJE', {'tipo': 'laje'}), esp, g, ABERTURAS_LAJE[andar], base)
    piso_tatil(no, andar, base, alertas_escadas(andar) + alertas_rampa(andar) +
               ([(0.25, 6.8, 0.4, 1.2), (0.25, 10.8, 0.4, 1.2)] if andar != 'P03' else []))
    if andar != 'P03':
        escada(no, andar, base, 'A')
        escada(no, andar, base, 'B')
        rampa(no, andar, base)
    elevadores(no, andar, base, tx['fora'])
    mobilia(no, andar, base, tx)
    referencias(no, andar, base, tx)
    sinalizacao(no, andar, base, tx)
    obst = obstaculos(no, andar, base)
    marcadores_largura(no, andar, base)
    rotulos_espacos(no, andar, esp, base)
    no.extras['espacos'] = [{'id': f'{P}{andar}ESPACO_{e["id"][:12]}', 'nome': e['nome'], 'retangulos': e['rects']} for e in esp]
    no.extras['obstaculos'] = [f'{P}{andar}OBSTACULO_{o[0]}' for o in obst]
    if andar == 'P03':   # cobertura (escondida no visualizador; fecha o prédio para quem abrir o .glb)
        cob = no.filho(f'{P}{andar}COBERTURA_GERAL', {'tipo': 'cobertura', 'estado_inicial': 'oculto'})
        lajes(cob, esp, g, [], base + ALT, cobertura=True)
    return no


def main():
    os.makedirs(SAIDA, exist_ok=True)
    tx = texturas(ESPACOS)
    meta = {
        'tipo': 'predio', 'local': 'predio-comercial-teste', 'nome': 'Prédio comercial de testes do Navi', 'versao': '1.0',
        'gerado': '2026-10-29', 'unidade': 'metro', 'eixos': 'X para leste, Y para cima, Z para o sul (o y da planta); origem no canto noroeste do bloco central',
        'altura_andar_m': ALT, 'fonte': 'Planta de testes enviada pela equipe em 29/10/2026 (3 andares), com ajustes descritos no LEIA-ME',
        'nomes': '{PREDIO}{ANDAR}{CATEGORIA}_{ID}, PREDIO = PCT',
        'equipamentos': [
            {'id': 'ELEV_01', 'tipo': 'elevador', 'andares': ['P01', 'P02'], 'nos': ['PCTP01ELEVADOR_1', 'PCTP02ELEVADOR_1'], 'interdicao': ['PCTP01INTERDICAO_E1', 'PCTP02INTERDICAO_E1']},
            {'id': 'ELEV_02', 'tipo': 'elevador', 'andares': ['P01', 'P02'], 'nos': ['PCTP01ELEVADOR_2', 'PCTP02ELEVADOR_2'], 'interdicao': ['PCTP01INTERDICAO_E2', 'PCTP02INTERDICAO_E2']},
            {'id': 'ESC_A', 'tipo': 'escada', 'andares': ['P01', 'P02', 'P03'], 'braille': False, 'nos': ['PCTP01ESCADA_A', 'PCTP02ESCADA_A']},
            {'id': 'ESC_B', 'tipo': 'escada', 'andares': ['P01', 'P02', 'P03'], 'braille': True, 'nos': ['PCTP01ESCADA_B', 'PCTP02ESCADA_B']},
            {'id': 'RAMPA_1', 'tipo': 'rampa', 'andares': ['P01', 'P02', 'P03'], 'inclinacao_pct': 8.33, 'nos': ['PCTP01RAMPA_1', 'PCTP02RAMPA_1']}],
        'testes': {
            'rota_tatil_longa': 'Entrada → Escada B pelo piso tátil (contorna a Área central): cerca de 29 m; em linha reta, cerca de 21 m; a Escada A, sem braille e sem piso tátil, fica a 11 m da entrada.',
            'larguras_minimas': '1,20 m (refeitório), 0,90 m (passagem do 2º andar), 0,85 m (porta da Sala de reunião), 1,50 m (alternativas), 1,80 m (terraço)',
            'elevadores': 'Só até o 2º andar: o 3º andar sem degrau depende da rampa.'}}
    andares = [andar_no(a, n, b, tx) for a, n, b in ANDARES]
    saidas = {}
    raiz = No(f'{P}_PREDIO', meta)
    raiz.filhos = andares
    saidas['predio-teste.glb'] = escrever_glb(os.path.join(SAIDA, 'predio-teste.glb'), raiz, M, 'Prédio comercial de testes')
    for no in andares:
        r = No(f'{P}_PREDIO', dict(meta, recorte=no.nome))
        r.filhos = [no]
        nome = f'predio-teste-{no.nome[-3:].lower()}.glb'
        saidas[nome] = escrever_glb(os.path.join(SAIDA, nome), r, M, f'Prédio comercial de testes — {no.extras["nome"]}')
    with open(os.path.join(SAIDA, 'resumo.json'), 'w', encoding='utf-8') as f:
        json.dump({k: f'{v / 1024 / 1024:.2f} MB' for k, v in saidas.items()} | {'vertices': raiz.contar_vertices()}, f, ensure_ascii=False, indent=2)
    for k, v in saidas.items():
        print(f'{k}: {v / 1024 / 1024:.2f} MB')
    print('vértices:', raiz.contar_vertices())


if __name__ == '__main__':
    main()
