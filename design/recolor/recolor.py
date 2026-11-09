import numpy as np, colorsys
from PIL import Image
CARS='design/cars-source/'
def hsv(a):
    mx=a.max(axis=2); mn=a.min(axis=2); d=mx-mn
    h=np.zeros_like(mx); m=d>1e-6
    r,g,b=a[...,0],a[...,1],a[...,2]
    h=np.where(m&(mx==r),((g-b)/(d+1e-9))%6,h); h=np.where(m&(mx==g),(b-r)/(d+1e-9)+2,h); h=np.where(m&(mx==b),(r-g)/(d+1e-9)+4,h)
    return (h/6)%1, np.where(mx>0,d/(mx+1e-9),0), mx
def rgb(h,s,v):
    h=h%1; i=np.floor(h*6).astype(int)%6; f=h*6-np.floor(h*6)
    p=v*(1-s); q=v*(1-f*s); t=v*(1-(1-f)*s)
    r=np.choose(i,[v,q,p,p,t,v]); g=np.choose(i,[t,v,v,q,p,p]); b=np.choose(i,[p,p,t,v,v,q])
    return np.stack([r,g,b],axis=2)
def smooth(x,a,b): t=np.clip((x-a)/(b-a),0,1); return t*t*(3-2*t)
def paint_mask(a,alpha,kind):
    h,s,v=hsv(a)
    if kind=='color':
        return smooth(s,0.22,0.42)*(alpha>0.5)
    # auto grigie/bianche: carrozzeria = zona chiara e poco satura, lontana dalle parti scure; si esclude la fascia bassa (ruote)
    H,W=alpha.shape; yy,xx=np.mgrid[0:H,0:W]
    body=(alpha>0.5)&(s<0.30)&(v>0.38)
    ys,xs=np.where(alpha>0.5)
    top,bot=ys.min(),ys.max(); y=(yy-top)/(bot-top+1)
    wheelzone=(y>0.58)&((np.abs(xx-W*0.26)<W*0.14)|(np.abs(xx-W*0.74)<W*0.14)|(np.abs(xx-W*0.50)<W*0.30))
    return smooth(v,0.38,0.52)*body*(~wheelzone)
TARGETS={'rosso':(0.0,0.85,0.80),'arancione':(0.07,0.88,0.92),'giallo':(0.14,0.90,0.95),'verde':(0.38,0.72,0.55),'blu':(0.60,0.85,0.78),'viola':(0.77,0.60,0.62),'bianco':(0.0,0.0,0.96),'argento':(0.0,0.0,0.74),'grigio':(0.0,0.0,0.45),'nero':(0.0,0.0,0.14)}
def recolor(path,kind,name):
    im=Image.open(path).convert('RGBA'); arr=np.asarray(im).astype(float)/255; a=arr[...,:3]; alpha=arr[...,3]
    M=paint_mask(a,alpha,kind); h,s,v=hsv(a)
    th,ts,tv=TARGETS[name]
    sel=M>0.5
    ref=np.median(v[sel]) if sel.any() else 0.7
    nv=np.clip(v*(tv/ref),0,1) if name!='bianco' else np.clip(0.55+0.5*v,0,1)
    if name=='nero': nv=np.clip(0.05+0.35*(v/ref)*0.55,0,1)
    ns=np.clip(ts*(1-0.65*smooth(v,0.88,1.0)),0,1) if ts>0 else np.zeros_like(v)
    new=rgb(np.full_like(v,th),ns,nv)
    out=a*(1-M[...,None])+new*M[...,None]
    return Image.fromarray(np.dstack([np.clip(out,0,1),alpha]).__mul__(255).astype(np.uint8),'RGBA')
if __name__=='__main__':
    rows=[('citycar','color'),('suv','neutral'),('sedan','color'),('hatchback','neutral')]
    names=['rosso','arancione','giallo','verde','blu','viola','bianco','argento','grigio','nero']
    cw,ch=250,170
    sheet=Image.new('RGBA',(cw*5,ch*2*len(rows)//1),(244,241,234,255))
    sheet=Image.new('RGBA',(cw*5,ch*2*len(rows)),(244,241,234,255))
    for r,(car,kind) in enumerate(rows):
        for i,n in enumerate(names):
            t=recolor(CARS+car+'.webp',kind,n); t.thumbnail((cw-10,ch-10))
            sheet.paste(t,((i%5)*cw+5,(r*2+i//5)*ch+5),t)
    sheet.convert('RGB').save('recolor-test.png')
