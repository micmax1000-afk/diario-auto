import numpy as np
from PIL import Image, ImageFilter
SRC='sorgente.png'
def duotone():
    a=np.asarray(Image.open(SRC).convert('RGB')).astype(float)/255
    H,W,_=a.shape; yy,xx=np.mgrid[0:H,0:W]
    corner=(a.min(axis=2)>0.92)&(((xx<260)|(xx>W-260))&((yy<260)|(yy>H-260)))
    a[corner]=(10/255,45/255,120/255)
    mx=a.max(axis=2); mn=a.min(axis=2); d=mx-mn+1e-9; s=d/(mx+1e-9)
    r,g,b=a[...,0],a[...,1],a[...,2]
    h=np.where(mx==r,((g-b)/d)%6,np.where(mx==g,(b-r)/d+2,(r-g)/d+4))*60
    L=0.299*r+0.587*g+0.114*b
    xs=[0,0.35,0.7,1.0]; cs=np.array([(4,22,70),(18,70,190),(70,150,255),(255,255,255)],dtype=float)/255
    t=np.clip((L-0.05)/0.9,0,1); base=np.stack([np.interp(t,xs,cs[:,c]) for c in range(3)],axis=-1)
    acc=((s>0.45)&(yy<440)&(mx>0.35)&((h<170)|(h>=330))).astype(float)
    accm=np.asarray(Image.fromarray((acc*255).astype('uint8')).filter(ImageFilter.GaussianBlur(1.2))).astype(float)/255
    amber=np.array([1.0,0.72,0.12]); tone=np.clip(0.55+0.7*L,0,1.15)[...,None]
    out=base*(1-accm[...,None])+np.clip(amber[None,None,:]*tone,0,1)*accm[...,None]
    return Image.fromarray((np.clip(out,0,1)*255).astype('uint8'))
def crop(img,cx,cy=492,side=874):
    x0=int(round(cx-side/2)); y0=int(round(cy-side/2))
    return img.crop((x0,y0,x0+side,y0+side)).resize((1024,1024),Image.LANCZOS)
if __name__=='__main__':
    d=duotone(); d.save('duo-full.png')
    for cx in (627,610,600):
        crop(d,cx).save(f'duo-c{cx}.png')
