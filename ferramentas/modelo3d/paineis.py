"""Navi — imagens das telas e placas do prédio de testes (pontos de referência com instruções visuais).

Pensadas para quem não ouve: tudo o que um aviso sonoro diria está escrito, com pictograma e seta.
"""
import io
import math

from PIL import Image, ImageDraw, ImageFont

FONTE = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FONTE_B = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
AZUL, TINTA, AMARELO, BRANCO = (11, 79, 168), (13, 27, 42), (242, 194, 0), (255, 255, 255)
VERMELHO, VERDE, CINZA = (214, 40, 40), (27, 138, 60), (226, 231, 237)


def f(t, negrito=False):
    return ImageFont.truetype(FONTE_B if negrito else FONTE, t)


def png(img):
    b = io.BytesIO()
    img.save(b, 'PNG', optimize=True)
    return b.getvalue()


def quebrar(d, texto, fonte, largura):
    linhas, atual = [], ''
    for p in texto.split():
        t = (atual + ' ' + p).strip()
        if d.textlength(t, font=fonte) <= largura:
            atual = t
        else:
            if atual:
                linhas.append(atual)
            atual = p
    if atual:
        linhas.append(atual)
    return linhas


def texto_bloco(d, x, y, texto, fonte, largura, cor=TINTA, entre=1.25):
    for linha in quebrar(d, texto, fonte, largura):
        d.text((x, y), linha, font=fonte, fill=cor)
        y += int(fonte.size * entre)
    return y


# ---------- pictogramas desenhados (não dependem de glifos da fonte) ----------
def picto(d, nome, cx, cy, r, cor=BRANCO):
    w = max(3, r // 7)
    if nome == 'info':
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=cor, width=w)
        d.ellipse([cx - w, cy - r * 0.55 - w, cx + w, cy - r * 0.55 + w], fill=cor)
        d.rectangle([cx - w, cy - r * 0.25, cx + w, cy + r * 0.6], fill=cor)
    elif nome == 'mao':  # Libras: mão aberta
        d.rounded_rectangle([cx - r * 0.45, cy - r * 0.1, cx + r * 0.45, cy + r * 0.8], radius=r // 4, fill=cor)
        for i, dx in enumerate([-0.36, -0.12, 0.12, 0.36]):
            alt = [0.75, 0.95, 0.9, 0.7][i]
            d.rounded_rectangle([cx + dx * r - r * 0.09, cy - alt * r, cx + dx * r + r * 0.09, cy], radius=r // 10, fill=cor)
        d.polygon([(cx - r * 0.45, cy + r * 0.25), (cx - r * 0.85, cy - r * 0.15), (cx - r * 0.72, cy - r * 0.28), (cx - r * 0.4, cy - r * 0.02)], fill=cor)
    elif nome == 'escrita':  # lápis
        d.polygon([(cx - r * 0.7, cy + r * 0.7), (cx - r * 0.5, cy + r * 0.2), (cx + r * 0.45, cy - r * 0.75),
                   (cx + r * 0.75, cy - r * 0.45), (cx - r * 0.2, cy + r * 0.5)], fill=cor)
    elif nome == 'luz':  # luz que pisca
        d.ellipse([cx - r * 0.38, cy - r * 0.38, cx + r * 0.38, cy + r * 0.38], fill=cor)
        for k in range(8):
            a = k * math.pi / 4
            d.line([(cx + math.cos(a) * r * 0.55, cy + math.sin(a) * r * 0.55), (cx + math.cos(a) * r * 0.95, cy + math.sin(a) * r * 0.95)], fill=cor, width=w)
    elif nome == 'elevador':
        d.rectangle([cx - r * 0.7, cy - r * 0.9, cx + r * 0.7, cy + r * 0.9], outline=cor, width=w)
        d.polygon([(cx - r * 0.35, cy - r * 0.15), (cx, cy - r * 0.6), (cx + r * 0.35, cy - r * 0.15)], fill=cor)
        d.polygon([(cx - r * 0.35, cy + r * 0.15), (cx, cy + r * 0.6), (cx + r * 0.35, cy + r * 0.15)], fill=cor)
    elif nome == 'escada':
        pts = [(cx - r, cy + r * 0.8)]
        for i in range(4):
            x = cx - r + i * r * 0.5
            y = cy + r * 0.8 - (i + 1) * r * 0.4
            pts += [(x, y), (x + r * 0.5, y)]
        pts += [(cx + r, cy + r * 0.8)]
        d.polygon(pts, fill=cor)
    elif nome == 'rampa':
        d.polygon([(cx - r, cy + r * 0.7), (cx + r, cy + r * 0.7), (cx + r, cy - r * 0.3)], fill=cor)
    elif nome == 'cadeira':  # símbolo de acesso simplificado
        d.ellipse([cx - r * 0.2, cy - r * 0.95, cx + r * 0.15, cy - r * 0.6], fill=cor)
        d.line([(cx - r * 0.05, cy - r * 0.55), (cx - r * 0.05, cy + r * 0.05), (cx + r * 0.45, cy + r * 0.05), (cx + r * 0.65, cy + r * 0.6)], fill=cor, width=w + 2)
        d.arc([cx - r * 0.75, cy - r * 0.2, cx + r * 0.35, cy + r * 0.9], 30, 300, fill=cor, width=w + 1)
    elif nome == 'garfo':
        d.rectangle([cx - r * 0.45, cy - r * 0.2, cx - r * 0.3, cy + r * 0.9], fill=cor)
        for dx in (-0.6, -0.38, -0.16):
            d.rectangle([cx + dx * r, cy - r * 0.9, cx + dx * r + r * 0.08, cy - r * 0.2], fill=cor)
        d.rectangle([cx - r * 0.62, cy - r * 0.3, cx - r * 0.1, cy - r * 0.15], fill=cor)
        d.ellipse([cx + r * 0.15, cy - r * 0.9, cx + r * 0.55, cy - r * 0.1], fill=cor)
        d.rectangle([cx + r * 0.29, cy - r * 0.2, cx + r * 0.42, cy + r * 0.9], fill=cor)
    elif nome == 'alerta':
        d.polygon([(cx, cy - r), (cx + r, cy + r * 0.8), (cx - r, cy + r * 0.8)], outline=cor, width=w)
        d.rectangle([cx - w * 0.6, cy - r * 0.35, cx + w * 0.6, cy + r * 0.3], fill=cor)
        d.ellipse([cx - w * 0.8, cy + r * 0.45, cx + w * 0.8, cy + r * 0.62], fill=cor)
    elif nome == 'pessoas':
        for dx in (-0.5, 0, 0.5):
            d.ellipse([cx + dx * r - r * 0.17, cy - r * 0.7, cx + dx * r + r * 0.17, cy - r * 0.36], fill=cor)
            d.rounded_rectangle([cx + dx * r - r * 0.25, cy - r * 0.3, cx + dx * r + r * 0.25, cy + r * 0.6], radius=r // 6, fill=cor)
    elif nome == 'tela':
        d.rounded_rectangle([cx - r * 0.9, cy - r * 0.6, cx + r * 0.9, cy + r * 0.5], radius=r // 8, outline=cor, width=w)
        d.rectangle([cx - r * 0.1, cy + r * 0.5, cx + r * 0.1, cy + r * 0.8], fill=cor)
        d.text((cx - r * 0.55, cy - r * 0.42), 'Aa', font=f(int(r * 0.7), True), fill=cor)


def cabecalho(d, W, titulo, icone, cor=AZUL, alt=150):
    d.rectangle([0, 0, W, alt], fill=cor)
    picto(d, icone, 75, alt // 2, 46)
    linhas = quebrar(d, titulo, f(44, True), W - 165)
    y = alt // 2 - len(linhas) * 26
    for l in linhas:
        d.text((140, y), l, font=f(44, True), fill=BRANCO)
        y += 52


def linha_item(d, x, y, W, icone, texto, cor_icone=AZUL, tam=30):
    d.rounded_rectangle([x, y, x + 72, y + 72], radius=12, fill=cor_icone)
    picto(d, icone, x + 36, y + 36, 26)
    return max(y + 84, texto_bloco(d, x + 92, y + 6, texto, f(tam), W - x - 120) + 14)


def totem_texto(titulo, icone, itens, rodape=None, cor=AZUL):
    """Tela de totem (512 × 896): cabeçalho com pictograma e itens com ícone + texto curto."""
    W, H = 512, 896
    img = Image.new('RGB', (W, H), BRANCO)
    d = ImageDraw.Draw(img)
    cabecalho(d, W, titulo, icone, cor)
    y = 178
    for icone_i, texto, cor_i in itens:
        y = linha_item(d, 24, y, W, icone_i, texto, cor_i)
    if rodape:
        d.rectangle([0, H - 96, W, H], fill=TINTA)
        texto_bloco(d, 24, H - 84, rodape, f(26, True), W - 48, BRANCO)
    return png(img)


def placa(titulo, linhas, icone, W=1024, H=256, cor=AZUL):
    img = Image.new('RGB', (W, H), cor)
    d = ImageDraw.Draw(img)
    picto(d, icone, H // 2, H // 2, int(H * 0.32))
    d.text((H, 30), titulo, font=f(58, True), fill=BRANCO)
    y = 108
    for l in linhas:
        d.text((H, y), l, font=f(34), fill=BRANCO)
        y += 44
    return png(img)


def fora_de_servico():
    W, H = 512, 640
    img = Image.new('RGB', (W, H), BRANCO)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 210], fill=VERMELHO)
    picto(d, 'elevador', 90, 105, 60)
    d.line([(30, 175), (150, 35)], fill=BRANCO, width=12)
    d.text((175, 45), 'FORA DE', font=f(54, True), fill=BRANCO)
    d.text((175, 112), 'SERVIÇO', font=f(54, True), fill=BRANCO)
    y = texto_bloco(d, 28, 240, 'Este elevador está parado.', f(38, True), W - 56)
    y = texto_bloco(d, 28, y + 14, 'Para subir: rampa (1º → 2º → 3º) ou escadas A e B.', f(34), W - 56)
    texto_bloco(d, 28, y + 14, 'Precisa de ajuda? Recepção no 1º andar.', f(30), W - 56, AZUL)
    return png(img)


def saida():
    W, H = 512, 192
    img = Image.new('RGB', (W, H), VERDE)
    d = ImageDraw.Draw(img)
    d.text((40, 38), 'SAÍDA', font=f(96, True), fill=BRANCO)
    d.polygon([(380, 60), (450, 96), (380, 132)], fill=BRANCO)
    d.rectangle([330, 84, 385, 108], fill=BRANCO)
    return png(img)


def mapa_andar(titulo, espacos, aqui, tatil, destaque_nomes, limites):
    """Mapa do prédio na tela do totem: salas do andar, piso tátil e 'Você está aqui'."""
    W, H = 512, 896
    img = Image.new('RGB', (W, H), BRANCO)
    d = ImageDraw.Draw(img)
    cabecalho(d, W, titulo, 'info')
    x0, x1, z0, z1 = limites
    area = (24, 170, W - 24, 640)
    esc = min((area[2] - area[0]) / (x1 - x0), (area[3] - area[1]) / (z1 - z0))
    ox = area[0] + ((area[2] - area[0]) - (x1 - x0) * esc) / 2
    oz = area[1] + ((area[3] - area[1]) - (z1 - z0) * esc) / 2
    P = lambda x, z: (ox + (x - x0) * esc, oz + (z - z0) * esc)
    for e in espacos:
        for (a, b, c, dd) in e['rects']:
            cor = {'escada': (205, 214, 226), 'shaft': (205, 214, 226), 'rampa': (205, 214, 226)}.get(e.get('cat'), (238, 242, 246))
            if e['grupo'] == 'hall':
                cor = (250, 250, 250)
            d.rectangle([*P(a, c), *P(b, dd)], fill=cor, outline=(116, 129, 143), width=2)
    for linha in tatil:
        d.line([P(*p) for p in linha], fill=AMARELO, width=5)
    for e in espacos:
        if e.get('curto'):
            a, b, c, dd = e['rects'][0]
            cx, cz = P((a + b) / 2, (c + dd) / 2)
            t = e['curto']
            fo = f(15, True)
            w = d.textlength(t, font=fo)
            d.text((cx - w / 2, cz - 9), t, font=fo, fill=TINTA)
    ax, az = P(*aqui)
    d.ellipse([ax - 13, az - 13, ax + 13, az + 13], fill=VERMELHO, outline=BRANCO, width=3)
    y = 660
    d.ellipse([28, y + 4, 50, y + 26], fill=VERMELHO)
    d.text((62, y), 'Você está aqui', font=f(28, True), fill=TINTA)
    d.line([(26, y + 58), (54, y + 58)], fill=AMARELO, width=8)
    d.text((62, y + 42), 'Piso tátil', font=f(26), fill=TINTA)
    y += 92
    for t in destaque_nomes:
        y = texto_bloco(d, 26, y, t, f(24), W - 52) + 2
    return png(img)
