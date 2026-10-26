import re, sys
src = open(sys.argv[1]).read()
PRE = 'html:not(.contraste) '
def prefixar(sel):
    out = []
    for s in sel.split(','):
        s = s.strip()
        if not s: continue
        if s.startswith(':root') or s.startswith('html') or s.startswith('from') or s.startswith('to') or re.match(r'^\d+%', s):
            out.append(s)
        else:
            out.append(PRE + s)
    return ', '.join(out)
def processar(t, dentro_keyframes=False):
    res, i = [], 0
    while i < len(t):
        j = t.find('{', i)
        if j < 0: res.append(t[i:]); break
        cab = t[i:j]
        # comentários antes do seletor
        com = ''
        while '/*' in cab and '*/' in cab:
            a = cab.index('/*'); b = cab.index('*/', a) + 2
            com += cab[a:b] + '\n'; cab = cab[:a] + cab[b:]
        # achar fim do bloco
        prof, k = 1, j + 1
        while prof:
            if t[k] == '{': prof += 1
            elif t[k] == '}': prof -= 1
            k += 1
        corpo = t[j+1:k-1]
        c = cab.strip()
        if c.startswith('@media') or c.startswith('@supports'):
            res.append(com + c + ' {' + processar(corpo) + '}\n')
        elif c.startswith('@keyframes') or dentro_keyframes:
            res.append(com + c + ' {' + corpo + '}\n')
        else:
            res.append(com + prefixar(c) + ' {' + corpo + '}\n')
        i = k
    return ''.join(res)
open(sys.argv[2], 'w').write(processar(src))
