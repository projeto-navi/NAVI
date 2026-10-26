import json, base64, numpy as np, cv2
B='/mnt/user-data/outputs/site-acessivel/js/'
def carregar(f):
    s=open(B+f).read(); return json.loads(s[s.index('=')+1:].rstrip().rstrip(';'))
D=carregar('dados.js'); L=carregar('dados3d.js')['lajes']
PASSO=6; W,H=1920//PASSO+1, 1080//PASSO+1
out={}
for f in ['1','2']:
    S=1/PASSO
    m=np.zeros((H,W),np.uint8)
    pts=lambda poly: (np.array(poly,np.float32)*S).round().astype(np.int32)
    for l in L[f]:
        cv2.fillPoly(m,[pts(l['ext'])],255)
        for h in l['buracos']: cv2.fillPoly(m,[pts(h)],0)
    for poly in D['plantas'][f]: cv2.fillPoly(m,[pts(poly)],0)
    for p in D['places']:
        if str(p['piso'])!=f: continue
        if p['cat']=='entrada':
            r=((p['x']*S,p['y']*S),(p['w']*S,p['h']*S),p['r']); cv2.fillPoly(m,[cv2.boxPoints(r).round().astype(np.int32)],255)
    for i,j in D['grafo'][f]:   # garante que a malha original continua conectada
        cv2.circle(m,(round((i*30+15)*S),round((j*30+15)*S)),2,255,-1)
    q=np.zeros_like(m)
    for p in D['places']:
        if str(p['piso'])!=f or p['cat']!='quiosque': continue
        r=((p['x']*S,p['y']*S),((p['w']+4)*S,(p['h']+4)*S),p['r']); cv2.fillPoly(q,[cv2.boxPoints(r).round().astype(np.int32)],255)
    livre=((m>0)&(q==0)).astype(np.uint8)
    dist=cv2.distanceTransform(livre,cv2.DIST_L2,5)*PASSO   # folga até a parede ou quiosque, em unidades da planta
    c=np.clip(dist,2,255).astype(np.uint8)
    c[(m>0)&(q>0)]=1     # quiosque: só passa se não houver outro jeito
    c[m==0]=0            # parede/loja/fora do piso: bloqueado
    # componentes: nós do grafo devem cair na mesma área caminhável
    n,lab=cv2.connectedComponents((c>0).astype(np.uint8))
    comps={}
    for i,j in D['grafo'][f]:
        x,y=round((i*30+15)*S),round((j*30+15)*S)
        comps[lab[y,x]]=comps.get(lab[y,x],0)+1
    print(f,'livres',int((m>0).sum()),'componentes dos nós',comps)
    out[f]=base64.b64encode(c.tobytes()).decode()
    vis=cv2.applyColorMap(cv2.normalize(c,None,0,255,cv2.NORM_MINMAX),cv2.COLORMAP_VIRIDIS); vis[c==0]=0; vis[c==1]=(0,0,200)
    cv2.imwrite('/tmp/claude-0/s/malha%s.png'%f,cv2.resize(vis,(W*2,H*2),interpolation=cv2.INTER_NEAREST))
open(B+'malha.js','w').write('/* Malha fina dos corredores: distância de cada ponto até a parede ou quiosque mais próximo (unidades da planta, máx. 255). Gerada da mesma planta do mapa. */\nwindow.NAVI_MALHA='+json.dumps({'passo':PASSO,'larg':W,'alt':H,'folga':out},separators=(',',':'))+';\n')
import os; print(os.path.getsize(B+'malha.js'))
