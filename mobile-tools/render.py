import math
from PIL import Image, ImageDraw, ImageFont
from maps import *
F=lambda n: ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',n)
cache={}
def img(p,w,h):
    k=(p,w,h)
    if k not in cache: cache[k]=Image.open(p).convert('RGBA').resize((max(1,w),max(1,h)),Image.LANCZOS)
    return cache[k]
L={
 'portrait':dict(W=390,H=844,K=2,ins=(47,0,34,0),s=48.75,org=(0,62.875),
   hud=[('Top HUD bar: gold · lives · wave · speed · pause',(0,47,390,64),(40,30,60)),
        ('Bottom bar: next-wave text + Start wave',(0,746,390,98),(40,30,60))],
   sheet=('Bottom sheet (open on tap)',(0,480,390,364)),
   btns=[('icon_gold',(8,63,32,32)),('icon_heart',(96,63,32,32)),('icon_wave',(176,63,32,32)),
         ('B:1x',(282,55,48,48)),('B:II',(334,55,48,48)),('B:Start wave',(206,754,176,48))]),
 'landscape':dict(W=844,H=390,K=2,ins=(0,47,21,47),s=662/15,org=(47,8),
   hud=[('Top HUD',(47,0,662,52),(40,30,60)),('Right rail',(709,0,135,390),(40,30,60))],
   sheet=('Detail card',(497,236,204,125)),
   btns=[('icon_gold',(55,10,32,32)),('icon_heart',(151,10,32,32)),('icon_skull',(247,10,32,32)),
         ('B:1x',(600,2,48,48)),('B:II',(652,2,48,48)),
         *[('slot',(725,8+60*i,56,56)) for i in range(5)],('B:Build',(721,308,76,56))]),
 'square':dict(W=1024,H=1024,K=1,ins=(0,0,0,0),s=1024/11,org=(0,0),
   hud=[('Top HUD (portrait layout x1.5)',(0,0,1024,93),(40,30,60)),('Bottom bar',(0,931,1024,93),(40,30,60))],
   sheet=('Bottom sheet (open on tap)',(0,560,1024,464)),
   btns=[('icon_gold',(16,22,48,48)),('icon_heart',(150,22,48,48)),('icon_wave',(280,22,48,48)),
         ('B:1x',(872,16,64,64)),('B:II',(948,16,64,64)),('B:Start wave',(760,946,248,64))]),
}
def render(n):
    v,l=V[n],L[n]; K=l['K']; s=l['s']*K; ox,oy=l['org'][0]*K,l['org'][1]*K
    W,H=l['W']*K,l['H']*K; im=Image.new('RGBA',(W,H),'#000'); d=ImageDraw.Draw(im)
    c0,c1=math.floor(-ox/s),math.ceil((W-ox)/s); r0,r1=math.floor(-oy/s),math.ceil((H-oy)/s)
    P=dict(zip(v['path'],path_tiles(v))); S=set(v['spots'])
    tw=math.ceil(s)+1
    for r in range(r0,r1):
        for c in range(c0,c1):
            x,y=int(ox+c*s),int(oy+r*s)
            t=P.get((c,r),grass(c,r)); im.alpha_composite(img(f'{PACK}/tiles/{t}.png',tw,tw),(x,y))
    for r in range(r0,r1):
        for c in range(c0,c1):
            x,y=ox+c*s,oy+r*s
            if (c,r) in S: im.alpha_composite(img(f'{PACK}/towers/build_spot.png',tw,tw),(int(x),int(y)))
            dd=decor(v,c,r)
            if dd and (c,r) not in P:
                o=Image.open(f'{PACK}/decor/{dd}.png'); w,h=int(o.width*s/128),int(o.height*s/128)
                im.alpha_composite(img(f'{PACK}/decor/{dd}.png',w,h),(int(x+s/2-w/2),int(y+s-h)))
    ov=Image.new('RGBA',im.size,(0,0,0,0)); od=ImageDraw.Draw(ov)
    # dim edge fill
    gx0,gy0,gx1,gy1=ox,oy,ox+v['cols']*s,oy+v['rows']*s
    for rect in [(0,0,W,gy0),(0,gy1,W,H),(0,gy0,gx0,gy1),(gx1,gy0,W,gy1)]:
        if rect[2]>rect[0] and rect[3]>rect[1]: od.rectangle(rect,fill=(0,0,0,70))
    for c in range(v['cols']+1): od.line([(ox+c*s,gy0),(ox+c*s,gy1)],fill=(255,255,255,90),width=1)
    for r in range(v['rows']+1): od.line([(gx0,oy+r*s),(gx1,oy+r*s)],fill=(255,255,255,90),width=1)
    od.rectangle((gx0,gy0,gx1,gy1),outline=(255,255,255,230),width=2*K)
    for i,(c,r) in enumerate(v['path']):
        od.text((ox+c*s+3,oy+r*s+2),str(i+1),font=F(9*K),fill=(255,255,255,255),stroke_width=2,stroke_fill='black')
    for (c,r) in S: od.rectangle((ox+c*s+3,oy+r*s+3,ox+(c+1)*s-3,oy+(r+1)*s-3),outline=(80,200,255,255),width=2*K)
    for lab,(c,r),col in [('SPAWN',v['path'][0],(60,220,60,255)),('EXIT',v['path'][-1],(230,60,60,255))]:
        od.rectangle((ox+c*s,oy+r*s,ox+(c+1)*s,oy+(r+1)*s),outline=col,width=3*K)
        od.text((ox+c*s+2,oy+(r+1)*s-12*K),lab,font=F(8*K),fill=col,stroke_width=2,stroke_fill='black')
    for lab,(x,y,w,h),col in l['hud']:
        od.rectangle((x*K,y*K,(x+w)*K,(y+h)*K),fill=col+(200,),outline=(242,222,176,255),width=K)
    x,y,w,h=l['sheet'][1]; od.rectangle((x*K,y*K,(x+w)*K,(y+h)*K),outline=(255,240,120,255),width=2*K)
    od.text((x*K+6*K,y*K+4*K),l['sheet'][0],font=F(11*K),fill=(255,240,120,255),stroke_width=2,stroke_fill='black')
    im.alpha_composite(ov); d=ImageDraw.Draw(im)
    for a,(x,y,w,h) in l['btns']:
        X,Y,Wd,Hd=x*K,y*K,w*K,h*K
        if a.startswith('B:'):
            im.alpha_composite(img(f'{UI}/button/button_normal.png',Wd,Hd),(X,Y))
            d.text((X+Wd/2,Y+Hd/2),a[2:],font=F(14*K),fill='#f2deb0',anchor='mm',stroke_width=2,stroke_fill='black')
        elif a=='slot': im.alpha_composite(img(f'{UI}/slot/slot_normal.png',Wd,Hd),(X,Y))
        else: im.alpha_composite(img(f'{UI}/icon/{a}.png',Wd,Hd),(X,Y))
    for lab,(x,y,w,h),col in l['hud']:
        d.text((x*K+(w*K)/2,(y+h)*K-7*K),lab,font=F(9*K),fill='#f2deb0',anchor='mb',stroke_width=2,stroke_fill='black')
    t,r_,b,lf=l['ins']
    for rect in [(0,0,W,t*K),(0,H-b*K,W,H),(0,0,lf*K,H),(W-r_*K,0,W,H)]:
        if rect[2]>rect[0] and rect[3]>rect[1]: d.rectangle(rect,outline=(255,80,200),width=K)
    d.text((W/2,H-3*K),f'{n} {l["W"]}x{l["H"]} CSS · {v["cols"]}x{v["rows"]} · tile {l["s"]:.2f}px · pink=safe-area inset · dim=edge fill',font=F(8*K),fill='white',anchor='mb',stroke_width=2,stroke_fill='black')
    im.convert('RGB').save(f'/workspace/td-game/wireframe-{n}.png')
for n in V: render(n)
