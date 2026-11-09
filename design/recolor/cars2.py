import numpy as np
from PIL import Image, ImageFilter
import recolor as R
CARS=R.CARS
# --- come riconoscere la vernice, per carrozzeria
KIND={'citycar':'color','convertible':'color','coupe':'color','mpv':'color','sedan':'color','suvlarge':'dark',
      'hatchback':'neutral','pickup':'neutral','premium':'neutral','suv':'neutral','van':'neutral','wagon':'neutral'}
LO_HI={'citycar':(0.22,0.42),'convertible':(0.22,0.42),'coupe':(0.22,0.42),'sedan':(0.22,0.42),'mpv':(0.16,0.34),'suvlarge':(0.12,0.26)}
def clean(mask):
    # toglie i puntini isolati e ammorbidisce il bordo
    m=Image.fromarray((np.clip(mask,0,1)*255).astype(np.uint8))
    m=m.filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.GaussianBlur(1.1))
    return np.asarray(m).astype(float)/255
def paint_mask(body,a,alpha):
    h,s,v=R.hsv(a)
    if body=='suvlarge':
        M=R.smooth(s,0.05,0.12)*R.smooth(h,0.20,0.27)*(1-R.smooth(h,0.50,0.56))*R.smooth(v,0.04,0.09)*(alpha>0.5)
        return clean(M)*(alpha>0.5)
    if KIND[body] in('color','dark'):
        lo,hi=LO_HI[body]
        M=R.smooth(s,lo,hi)*(alpha>0.5)*R.smooth(v,0.10,0.22)       # i vetri molto scuri restano com'erano
        return clean(M)*(alpha>0.5)
    if VIVID: return neutral_mask_vivid(BODYNOW,a,alpha,h,s,v)
    return neutral_mask(a,alpha,h,s,v)
def wheels(alpha,v):
    H,W=alpha.shape; op=alpha>0.5
    dark=(v<0.22)&op; dark[:int(H*0.45)]=False
    col=np.convolve(dark.sum(axis=0).astype(float),np.ones(21)/21,mode='same')
    out=[]
    c=col.copy()
    for _ in range(2):
        x=int(np.argmax(c)); lo,hi=max(0,x-int(W*0.13)),min(W,x+int(W*0.13)); c[lo:hi]=0
        sub=dark[:,max(0,x-int(W*0.06)):x+int(W*0.06)]; ys=np.where(sub.any(axis=1))[0]
        y=float(np.mean(ys[ys>H*0.45])) if (ys>H*0.45).any() else H*0.8
        r=max(12.0,(ys.max()-ys.min())/2.0 if len(ys) else W*0.09)
        out.append((x,y,min(r,W*0.085)))
    return out
from scipy import ndimage as ndi
def main_part(M,r=3):
    # tiene solo il pezzo grande (la vernice): i riflessi sui vetri e i cerchi restano com'erano
    b=M>0.5
    e=ndi.binary_erosion(b,iterations=r)
    lab,n=ndi.label(e)
    if n==0: return M
    sizes=ndi.sum(e,lab,range(1,n+1)); keep=np.isin(lab,1+np.where(sizes>=0.22*sizes.max())[0])
    keep=ndi.binary_dilation(keep,iterations=r+2)&b
    keep=ndi.binary_dilation(keep,iterations=1)
    return M*ndi.gaussian_filter(keep.astype(float),0.8)
VIVID=False
BODYNOW=''
import excl
def neutral_mask_vivid(body,a,alpha,h,s,v):
    lo,hi=(0.12,0.24) if body=='premium' else (0.17,0.30)
    b=(alpha>0.5)&(s<0.30)&(v>lo)
    M=clean(R.smooth(v,lo,hi)*b)*(alpha>0.5)
    return M*(1-excl.zone(body,(alpha.shape[1],alpha.shape[0])))
def neutral_mask(a,alpha,h,s,v):
    H,W=alpha.shape; yy,xx=np.mgrid[0:H,0:W]
    body=(alpha>0.5)&(s<0.30)&(v>0.30)
    lo,hi=((0.12,0.24) if BODYNOW=='premium' else (0.17,0.30)) if VIVID else (0.30,0.44)
    body=(alpha>0.5)&(s<0.30)&(v>(lo if VIVID else 0.30))
    M=R.smooth(v,lo,hi)*body
    for (x,y,r) in wheels(alpha,v):
        d=np.sqrt(((xx-x)/(r*1.28))**2+((yy-y)/(r*1.28))**2)
        M=M*((R.smooth(d,0.75,0.9) if BODYNOW=='premium' else R.smooth(d,0.52,0.64)) if VIVID else np.where(v>0.62,1.0,R.smooth(d,0.80,0.95)))
    M=clean(M)*(alpha>0.5)
    return main_part(M,3) if VIVID else M
NEUTRAL={'bianco':('w',0.97),'argento':('g',0.74),'grigio':('g',0.34),'nero':('b',0.13)}
COLOR=R.TARGETS
def recolor(body,name):
    im=Image.open(CARS+body+'.webp').convert('RGBA'); arr=np.asarray(im).astype(float)/255; a=arr[...,:3]; alpha=arr[...,3]
    global VIVID,BODYNOW
    BODYNOW=body
    VIVID = name not in NEUTRAL
    M=paint_mask(body,a,alpha); h,s,v=R.hsv(a)
    sel=M>0.5; ref=float(np.median(v[sel])) if sel.any() else 0.7
    if name in NEUTRAL:
        kind,tv=NEUTRAL[name]
        rel=np.clip(v/ref,0,1.6)
        if kind!='w': rel=np.where(rel>1,1+0.3*(rel-1),rel)
        if kind=='w': nv=np.clip(0.62+0.38*np.clip(rel,0,1.3)/1.3*1.0,0,1)
        elif kind=='b': nv=np.clip(0.06+0.10*rel,0,0.5)
        else: nv=np.clip(tv*rel,0,1)
        ns=np.zeros_like(v); nh=np.zeros_like(v)
    else:
        th,ts,tv=COLOR[name]; rel=np.clip(v/ref,0,1.6)
        nv=np.clip(tv*rel,0,1); ns=np.clip(ts*(1-0.65*R.smooth(v,0.88,1.0)),0,1); nh=np.full_like(v,th)
    new=R.rgb(nh,ns,nv)
    out=a*(1-M[...,None])+new*M[...,None]
    return Image.fromarray((np.dstack([np.clip(out,0,1),alpha])*255).astype(np.uint8),'RGBA')
if __name__=='__main__':
    import sys
    names=['bianco','argento','grigio','nero']
    bodies=['mpv','suvlarge','citycar','suv']
    cw,ch=300,200
    sheet=Image.new('RGBA',(cw*4,ch*len(bodies)),(244,241,234,255))
    for r,b in enumerate(bodies):
        for i,n in enumerate(names):
            t=recolor(b,n); t.thumbnail((cw-10,ch-10)); sheet.paste(t,(i*cw+5,r*ch+5),t)
    sheet.convert('RGB').save('cars2-test.png')
