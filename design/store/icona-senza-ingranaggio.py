import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi
src=Image.open('/home/user/diario-auto/docs/play-store/icona-512.png').convert('RGB')
a=np.asarray(src).astype(float); H,W,_=a.shape
yy,xx=np.mgrid[0:H,0:W]
band=(xx<34)|(xx>W-34)|(yy<34)|(yy>H-34)
A=np.c_[xx[band],yy[band],xx[band]*yy[band],np.ones(band.sum())]
bg=np.zeros_like(a)
for c in range(3):
    k,*_=np.linalg.lstsq(A,a[...,c][band],rcond=None)
    bg[...,c]=k[0]*xx+k[1]*yy+k[2]*xx*yy+k[3]
dist=np.abs(a-bg).sum(axis=2)
near=dist<38
lab,n=ndi.label(near)
bgreg=np.isin(lab,np.unique(np.r_[lab[0,:],lab[-1,:],lab[:,0],lab[:,-1]]))&near
fg=~bgreg
fg[372:,:]=False          # via l'ingranaggio
fg=ndi.binary_opening(fg,iterations=1)
alpha=ndi.gaussian_filter(fg.astype(float),0.7)
ys,xs=np.where(fg); box=(xs.min()-3,ys.min()-3,xs.max()+4,ys.max()+4); print(box)
rgba=np.dstack([a,alpha*255]).astype(np.uint8)
grp=Image.fromarray(rgba,'RGBA').crop(box)
def make(scale,S=1024):
    base=Image.fromarray(np.clip(bg,0,255).astype(np.uint8)).resize((S,S),Image.BICUBIC).convert('RGBA')
    f=S/512*scale
    g=grp.resize((round(grp.width*f),round(grp.height*f)),Image.LANCZOS)
    # ombra leggera sotto
    base.alpha_composite(g,((S-g.width)//2,(S-g.height)//2+round(6*S/512)))
    return base
if __name__=='__main__':
    import sys
    for sc in (1.0,1.12,1.2):
        make(sc).save(f'icon-new-{sc}.png')
