import numpy as np, math
from PIL import Image, ImageFilter, ImageDraw
from scipy import ndimage as ndi
d=np.asarray(Image.open('duo-pad.png').convert('RGB')).astype(int)
H,W,_=d.shape; yy,xx=np.mgrid[0:H,0:W]
R,G,B=d[...,0],d[...,1],d[...,2]
amber=(R>190)&(G>120)&(B<140); white=(d.min(axis=2)>205)
book=np.load('m_book.npy'); pen=np.load('m_pen.npy')
gauge=(amber|(white&(yy<450)&(xx>100)&(xx<1160)))&(yy<450)
gauge&=~((xx>235)&(xx<965)&(yy>292)&~amber)
gauge&=~((xx>1100)&(yy>330))
lab,n=ndi.label(ndi.binary_dilation(gauge,iterations=2)); sz=ndi.sum(gauge,lab,range(1,n+1))
gauge=np.isin(lab,[1+i for i,s in enumerate(sz) if s>400])
gauge=ndi.binary_dilation(gauge,iterations=2)
# cerchio dell'arco (minimi quadrati sui pixel gialli dell'arco, esclusa la lancetta)
am=amber&~((xx>700)&(yy<330)&(yy>150)&(xx<920)&False)
ay,ax=np.where(amber&(yy<440)&~((xx>745)&(xx<905)&(yy>185)&(yy<305)))
A_=np.c_[2*ax,2*ay,np.ones(len(ax))]; b_=ax**2+ay**2
sol=np.linalg.lstsq(A_,b_,rcond=None)[0]; ccx,ccy=sol[0],sol[1]; rr=np.sqrt(sol[2]+ccx**2+ccy**2)
print('cerchio arco',ccx,ccy,rr)
dist=np.sqrt((xx-ccx)**2+(yy-ccy)**2)
ang=np.degrees(np.arctan2(ccy-yy,xx-ccx))
ring=(dist>rr-95)&(dist<505)&(ang>22)&(ang<164)
pump=(abs(xx-627)<90)&(yy>140)&(yy<290)
gauge=gauge&(ring|pump)
# lancetta: asse dai pixel gialli nella zona alta
nm=amber&(xx>750)&(xx<900)&(yy>185)&(yy<300)
ys,xs=np.where(nm); pts=np.c_[xs,ys].astype(float); c=pts.mean(axis=0); u,s,vt=np.linalg.svd(pts-c); dirv=vt[0]
if dirv[1]>0: dirv=-dirv
print('lancetta centro',c,'dir',dirv)
t=(627-c[0])/dirv[0]*(-1)  # punto sull'asse x=627 scendendo lungo la lancetta
hub=(c[0]-dirv[0]*(c[0]-627)/dirv[0]*(-1) if False else 627, c[1]+(627-c[0])/dirv[0]*dirv[1])
print('perno',hub)
OFF=160; CW=W+2*OFF
def grad(h):
    y=np.linspace(0,1,h)[:,None,None]**1.15
    top=np.array([8,34,102]);bot=np.array([30,100,222])
    return np.repeat((top+(bot-top)*y),CW,axis=1)
canvas=Image.fromarray(grad(H+2*OFF).astype('uint8'))
def layer(mask,dy,soft=1.2):
    m=Image.fromarray((mask*255).astype('uint8')).filter(ImageFilter.GaussianBlur(soft))
    return Image.fromarray(d.astype('uint8')),m
DY_BOOK=int(__import__('sys').argv[1]) if len(__import__('sys').argv)>1 else 150
img,m=layer(gauge,0); canvas.paste(img,(OFF,OFF),m)
# lancetta prolungata fino al perno + perno
dr=ImageDraw.Draw(canvas)
nx=c[0]+dirv[0]*80; ny=c[1]+dirv[1]*80
bx,by=hub
amb=(255,184,31)
import math
n0=np.array([-dirv[1],dirv[0]])
def P(x,y): return (x+OFF,y+OFF)
# triangolo: punta alta (dal gruppo giallo) → base larga sul perno
tip=(c[0]+dirv[0]*0,c[1]+dirv[1]*0)
poly=[P(*(c+dirv*65)),P(bx+n0[0]*13,by+n0[1]*13),P(bx-n0[0]*13,by-n0[1]*13)]
dr.polygon(poly,fill=amb)
dr.ellipse([bx+OFF-30,by+OFF-30,bx+OFF+30,by+OFF+30],fill=(255,255,255)); dr.ellipse([bx+OFF-13,by+OFF-13,bx+OFF+13,by+OFF+13],fill=(26,86,210))
# libro + penna spostati in su
for mask in (book,pen):
    img,m=layer(mask,0,1.5); canvas.paste(img,(OFF,OFF-DY_BOOK),m)
canvas.save('senza-auto-full.png')
print(canvas.size)
