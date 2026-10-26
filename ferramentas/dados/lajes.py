import json, re, sys, numpy as np, cv2, math
src = open('/mnt/user-data/outputs/site-acessivel/js/dados.js').read()
D = json.loads(src[src.index('=')+1:].rstrip().rstrip(';'))
out = {}
dbg = []
for f in ['1','2']:
    m = np.zeros((1100, 1960), np.uint8)
    for i,j in D['grafo'][f]:
        cv2.circle(m, (i*30+15, j*30+15), 30, 255, -1)
    for poly in D['plantas'][f]:
        cv2.fillPoly(m, [np.array(poly, np.int32)], 255)
    for p in D['places']:
        if str(p['piso']) != f or p['cat'] not in ('quiosque','entrada'): continue
        rect = ((p['x'], p['y']), (p['w']+6, p['h']+6), p['r'])
        cv2.fillPoly(m, [cv2.boxPoints(rect).astype(np.int32)], 255)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41)))
    m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    cs, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    lajes = []
    for k, c in enumerate(cs):
        if hier[0][k][3] != -1: continue
        if cv2.contourArea(c) < 400: continue
        ext = cv2.approxPolyDP(c, 2.5, True)[:,0,:].tolist()
        holes = []
        ch = hier[0][k][2]
        while ch != -1:
            if cv2.contourArea(cs[ch]) > 300:
                holes.append(cv2.approxPolyDP(cs[ch], 2.5, True)[:,0,:].tolist())
            ch = hier[0][ch][0]
        lajes.append({'ext': ext, 'buracos': holes})
    out[f] = lajes
    print(f, len(lajes), [len(l['ext']) for l in lajes], [len(l['buracos']) for l in lajes])
    vis = cv2.cvtColor(m, cv2.COLOR_GRAY2BGR); cv2.imwrite('/tmp/claude-0/s/laje%s.png' % f, vis)
open('/mnt/user-data/outputs/site-acessivel/js/dados3d.js','w').write('/* Lajes dos pisos para a vista 3D — geradas da mesma planta do mapa 2D. */\nwindow.NAVI_3D=' + json.dumps({'lajes': out}, separators=(',',':')) + ';\n')
