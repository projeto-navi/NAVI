"""Copia o visualizador para modelos/predio-teste/index.html, com o esqueleto HTML (o Artifact põe o seu ao publicar)."""
import os
AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, '..', '..', 'modelos', 'predio-teste', 'index.html')
corpo = open(os.path.join(AQUI, 'visualizador.html'), encoding='utf-8').read()
html = ('<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<style>[hidden]{display:none!important} body{margin:0}</style>\n</head>\n<body>\n' + corpo + '\n</body>\n</html>\n')
open(SAIDA, 'w', encoding='utf-8').write(html)
print('modelos/predio-teste/index.html')
