"""Kingsroad mobile variants: data, checks, asset derivation, decor plan, wireframes."""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont
ROOT='/workspace'; PACK=f'{ROOT}/game-art/td-pack'; UI=f'{ROOT}/game-art/td-ui-v4/2x'

def walk(start, *wps):
    p=[start]
    for (x,y) in wps:
        cx,cy=p[-1]
        while (cx,cy)!=(x,y):
            cx+= (x>cx)-(x<cx); cy+= (y>cy)-(y<cy); p.append((cx,cy))
    return p

V={
 'portrait': dict(cols=8, rows=15, hud_rows=[0,14], spawn_dir='W', exit_dir='E',
   path=walk((0,2),(5,2),(5,5),(1,5),(1,8),(5,8),(5,11),(7,11)),
   spots=[(1,3),(4,3),(6,3),(3,4),(0,6),(2,6),(4,6),(3,7),(0,9),(3,9),(6,9),(4,10),(4,12),(6,12)],
   fixed={(0,1):'signpost',(7,12):'fence'}),
 'landscape': dict(cols=15, rows=8, hud_rows=[0,7], spawn_dir='W', exit_dir='E',
   path=walk((0,2),(4,2),(4,5),(8,5),(8,2),(11,2),(11,5),(13,5),(13,4),(14,4)),
   spots=[(2,1),(2,3),(3,4),(5,3),(6,4),(6,6),(7,6),(9,4),(9,6),(10,1),(10,3),(12,3),(12,4),(12,6)],
   fixed={(0,1):'signpost',(14,5):'fence'}),
 'square': dict(cols=11, rows=11, hud_rows=[0,10], spawn_dir='W', exit_dir='E',
   path=walk((0,2),(3,2),(3,7),(6,7),(6,3),(8,3),(8,8),(10,8)),
   spots=[(2,1),(5,2),(9,2),(4,3),(2,4),(4,5),(5,5),(7,5),(9,5),(2,7),(9,7),(5,8),(7,8),(9,9)],
   fixed={(0,1):'signpost',(10,9):'fence'}),
}
D={'N':(0,-1),'S':(0,1),'E':(1,0),'W':(-1,0)}
def dirto(a,b):
    d=(b[0]-a[0],b[1]-a[1]); return [k for k,v in D.items() if v==d][0]
TILE={frozenset('EW'):'dirt_path_straight_h',frozenset('NS'):'dirt_path_straight_v',
      frozenset('SW'):'dirt_path_corner_sw',frozenset('NE'):'dirt_path_corner_ne',
      frozenset('NW'):'dirt_path_corner_nw',frozenset('SE'):'dirt_path_corner_se'}
def path_tiles(v):
    p=v['path']; out=[]
    for i,t in enumerate(p):
        a = v['spawn_dir'] if i==0 else dirto(t,p[i-1])
        b = v['exit_dir'] if i==len(p)-1 else dirto(t,p[i+1])
        out.append(TILE[frozenset(a+b)])
    return out

CYC=['tree_1','bush_1',None,'rock_1','flowers','tree_2',None,'bush_2','rock_2','tree_3']
EDGE=['tree_1','tree_3','bush_2','tree_2','rock_3',None]
LOW={'tree_1':'flowers','tree_2':'bush_1','tree_3':'bush_2'}
def grass(c,r): return f'grass_{(c*7+r*3)%3+1}'
def decor(v,c,r):
    P=set(v['path']); S=set(v['spots'])
    if (c,r) in P or (c,r) in S: return None
    if (c,r) in v['fixed']: return v['fixed'][(c,r)]
    inside = 0<=c<v['cols'] and 0<=r<v['rows']
    if not inside: return EDGE[(c*5+r*3)%6]
    d=CYC[(c*5+r*3)%10]
    near=any((c+dx,r+dy) in P|S for dx in(-1,0,1) for dy in(-1,0,1))
    if near and d: d=LOW.get(d,d)
    return d

def check(name,v):
    p,s,C,R=v['path'],v['spots'],v['cols'],v['rows']; res=[]
    ok=lambda k,b: res.append((k,bool(b)))
    ok('contiguous (orthogonal steps)', all(abs(a[0]-b[0])+abs(a[1]-b[1])==1 for a,b in zip(p,p[1:])))
    ok(f'length {len(p)} in 23..27', 23<=len(p)<=27)
    ok('no repeated path tile', len(set(p))==len(p))
    ok('path in bounds', all(0<=x<C and 0<=y<R for x,y in p))
    ok('path avoids HUD rows', all(y not in v['hud_rows'] for x,y in p))
    ok('spawn/exit on map edge', p[0][0]==0 and p[-1][0]==C-1)
    ok(f'spot count {len(s)}==14 (unique)', len(s)==14 and len(set(s))==14)
    ok('spots in bounds & not HUD rows', all(0<=x<C and 0<=y<R and y not in v['hud_rows'] for x,y in s))
    ok('spots off path', not set(s)&set(p))
    ok('spots 8-adjacent to path', all(any((x+dx,y+dy) in set(p) for dx in(-1,0,1) for dy in(-1,0,1)) for x,y in s))
    ok('path tile assets exist', all(os.path.exists(f'{PACK}/tiles/{t}.png') for t in path_tiles(v)))
    ok('decor assets exist', all(os.path.exists(f'{PACK}/decor/{decor(v,c,r)}.png') for c in range(-2,C+2) for r in range(-2,R+2) if decor(v,c,r)))
    return res

if __name__=='__main__':
    allok=True
    for n,v in V.items():
        print(f'== {n} {v["cols"]}x{v["rows"]}')
        for k,b in check(n,v): print(('PASS ' if b else 'FAIL ')+k); allok&=b
        print('path', ' '.join(f'({x},{y})' for x,y in v['path']))
        # run-length tile assets
        pt=path_tiles(v); runs=[]
        for t,a in zip(v['path'],pt):
            if runs and runs[-1][1]==a and 'straight' in a: runs[-1][0].append(t)
            else: runs.append([[t],a])
        for ts,a in runs: print('  ',' '.join(f'({x},{y})' for x,y in ts),'->',a)
        print('spots', ' '.join(f'({x},{y})' for x,y in v['spots']))
        key={None:'.','tree_1':'T','tree_2':'Y','tree_3':'A','bush_1':'b','bush_2':'B','rock_1':'r','rock_2':'R','rock_3':'K','flowers':'f','signpost':'S','fence':'F'}
        P=set(v['path']);S=set(v['spots'])
        for r in range(v['rows']):
            print('  '+' '.join('#' if (c,r) in P else 'O' if (c,r) in S else key[decor(v,c,r)] for c in range(v['cols'])))
    print('ALL PASS' if allok else 'SOME FAIL'); sys.exit(0 if allok else 1)
