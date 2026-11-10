"""Rigenera tutte le icone dall'originale con l'ingranaggio (design/store/icona-originale-512.png): python3 design/store/applica-icona.py"""
import base64, io, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
src = Image.open('design/store/icona-originale-512.png').convert('RGB')
a = np.asarray(src).astype(float); H, W, _ = a.shape
yy, xx = np.mgrid[0:H, 0:W]
band = (xx < 34) | (xx > W - 34) | (yy < 34) | (yy > H - 34)
A = np.c_[xx[band], yy[band], xx[band] * yy[band], np.ones(band.sum())]
bg = np.zeros_like(a)
for c in range(3):
    k, *_ = np.linalg.lstsq(A, a[..., c][band], rcond=None)
    bg[..., c] = k[0] * xx + k[1] * yy + k[2] * xx * yy + k[3]
near = np.abs(a - bg).sum(axis=2) < 38
lab, n = ndi.label(near)
fg = ~(np.isin(lab, np.unique(np.r_[lab[0, :], lab[-1, :], lab[:, 0], lab[:, -1]])) & near)
fg[372:, :] = False  # via l'ingranaggio
fg = ndi.binary_opening(fg, iterations=1)
alpha = ndi.gaussian_filter(fg.astype(float), 0.7)
ys, xs = np.where(fg); box = (xs.min() - 3, ys.min() - 3, xs.max() + 4, ys.max() + 4)
grp = Image.fromarray(np.dstack([a, alpha * 255]).astype(np.uint8), 'RGBA').crop(box)
BG = Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8))

def art(S, frac, dx=-0.009, dy=-0.004, background=True):
    """Icona SxS: il gruppo auto+agenda largo frac*S, appena spostato in alto a sinistra per bilanciare l'agenda."""
    K = 4
    base = BG.resize((S * K, S * K), Image.BICUBIC).convert('RGBA') if background else Image.new('RGBA', (S * K, S * K), (0, 0, 0, 0))
    w = round(S * K * frac); g = grp.resize((w, round(w * grp.height / grp.width)), Image.LANCZOS)
    base.alpha_composite(g, ((S * K - g.width) // 2 + round(dx * S * K), (S * K - g.height) // 2 + round(dy * S * K)))
    return base.resize((S, S), Image.LANCZOS)

R = 'android/app/src/main/res/'
for d, s, f in [('ldpi', 36, 81), ('mdpi', 48, 108), ('hdpi', 72, 162), ('xhdpi', 96, 216), ('xxhdpi', 144, 324), ('xxxhdpi', 192, 432)]:
    p = f'{R}mipmap-{d}/'
    art(f, 0.535, background=False).save(p + 'ic_launcher_foreground.png')
    BG.resize((f, f), Image.BICUBIC).save(p + 'ic_launcher_background.png')
    for name in ('ic_launcher.png', 'ic_launcher_round.png'):
        old = Image.open(p + name).convert('RGBA')
        new = art(s, 0.80); new.putalpha(old.getchannel('A')); new.save(p + name)
full = lambda S: art(S, 0.84).convert('RGB')
full(512).save('public/icons/icon-512.png'); full(192).save('public/icons/icon-192.png'); full(180).save('public/icons/apple-touch-icon.png')
full(512).save('docs/play-store/icona-512.png')
art(512, 0.60).convert('RGB').save('public/icons/icon-maskable-512.png'); art(192, 0.60).convert('RGB').save('public/icons/icon-maskable-192.png')
fav = art(32, 0.86); fav.putalpha(Image.open('public/favicon-32.png').convert('RGBA').getchannel('A')); fav.save('public/favicon-32.png')
buf = io.BytesIO(); full(192).save(buf, 'PNG')
open('public/icon.svg', 'w').write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><image width="192" height="192" href="data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode() + '"/></svg>\n')
