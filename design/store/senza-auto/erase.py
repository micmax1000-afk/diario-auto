import numpy as np
from PIL import Image, ImageFilter, ImageDraw
from scipy import ndimage as ndi
d=np.asarray(Image.open('duo-pad.png').convert('RGB')).astype(int)
H,W,_=d.shape; yy,xx=np.mgrid[0:H,0:W]
R,G,B=d[...,0],d[...,1],d[...,2]
amber=(R>190)&(G>120)&(B<140)
white=(d.min(axis=2)>205)
# --- libro: le due pagine bianche (componenti grandi sotto y=600), allargate al bordo blu e riempite
bk=white&(yy>600)
lab,n=ndi.label(ndi.binary_closing(bk,iterations=6)); sizes=ndi.sum(bk,lab,range(1,n+1))
keep=[1+i for i in np.argsort(sizes)[-2:]]
book=np.isin(lab,keep)
book=ndi.binary_closing(book,iterations=18)
book=ndi.binary_fill_holes(book)
book=ndi.binary_dilation(book,iterations=26)&(yy>560)
book=ndi.binary_fill_holes(book)
# --- penna: poligono manuale (angolo basso a destra)
pen=Image.new('L',(W,H),0); ImageDraw.Draw(pen).polygon([(1125,640),(1175,700),(930,945),(835,905)],fill=255)
pen=np.asarray(pen)>0
# --- tachimetro: arco giallo, tacche e pompa bianche, bordo bianco (solo parte alta)
gauge=(amber|(white&(yy<450)&(xx>100)&(xx<1160)))&(yy<450)
gauge=ndi.binary_dilation(gauge,iterations=2)
# nuvole bianche a destra: fuori dal tachimetro
gauge&=~((xx>1100)&(yy>330))
out=np.zeros((H,W,3),dtype='uint8')
out[...,0]=255*book; out[...,1]=255*gauge; out[...,2]=255*pen
Image.fromarray(out).resize((627,627)).save('maschere.png')
np.save('m_book.npy',book); np.save('m_pen.npy',pen); np.save('m_gauge.npy',gauge)
