"""Icona dall'immagine design/store/icona-sorgente-1254.png (versione senza scritta: tachimetro, auto e libretto).
Rigenera tutte le icone: python3 design/store/applica-icona-v2.py (dalla cartella del progetto)."""
import base64, glob, io
import numpy as np
from PIL import Image, ImageDraw

src = np.asarray(Image.open('design/store/icona-sorgente-1254.png').convert('RGB')).astype(int)
H, W, _ = src.shape
# angoli bianchi della cornice arrotondata -> blu scuro, così non spuntano mai
yy, xx = np.mgrid[0:H, 0:W]
corner = (src.min(axis=2) > 235) & (((xx < 260) | (xx > W - 260)) & ((yy < 260) | (yy > H - 260)))
src[corner] = (10, 45, 120)
BOX = (190, 55, 1064, 929)  # tachimetro, auto e libretto, senza la scritta
side = BOX[2] - BOX[0]
cx, cy = (BOX[0] + BOX[2]) / 2, (BOX[1] + BOX[3]) / 2

NAVY = (10, 45, 120)

def square(scale_visible):
    """Quadrato in cui il ritaglio BOX occupa la frazione `scale_visible` del lato; il margine attorno è blu
    scuro con i bordi del ritaglio allungati e sfumati (così la scritta "Diario Auto" non rientra mai)."""
    from PIL import ImageFilter
    core = Image.fromarray(src[BOX[1]:BOX[3], BOX[0]:BOX[2]].astype('uint8'))
    if scale_visible >= 1:
        return core
    full = int(round(side / scale_visible)); pad = (full - side) // 2
    stretched = Image.fromarray(np.pad(np.asarray(core), ((pad, full - side - pad), (pad, full - side - pad), (0, 0)), mode='edge'))
    blurred = stretched.filter(ImageFilter.GaussianBlur(full * 0.03))
    out = Image.blend(blurred, Image.new('RGB', (full, full), NAVY), 0.55)
    out.paste(core, (pad, pad))
    return out

icon = square(1.0)                 # l'icona vera e propria (BOX a tutto lato)
adaptive = square(72 / 108)        # Android adattiva: si vede il cerchio centrale di 72 dp su 108
maskable = square(0.8)             # web "maskable": zona sicura dell'80%

R = 'android/app/src/main/res/'
for d, s, f in [('ldpi', 36, 81), ('mdpi', 48, 108), ('hdpi', 72, 162), ('xhdpi', 96, 216), ('xxhdpi', 144, 324), ('xxxhdpi', 192, 432)]:
    p = f'{R}mipmap-{d}/'
    adaptive.resize((f, f), Image.LANCZOS).save(p + 'ic_launcher_background.png')
    Image.new('RGBA', (f, f), (0, 0, 0, 0)).save(p + 'ic_launcher_foreground.png')
    for name in ('ic_launcher.png', 'ic_launcher_round.png'):
        alpha = Image.open(p + name).convert('RGBA').getchannel('A')
        new = icon.resize((s, s), Image.LANCZOS).convert('RGBA'); new.putalpha(alpha); new.save(p + name)

icon.resize((512, 512), Image.LANCZOS).save('public/icons/icon-512.png')
icon.resize((192, 192), Image.LANCZOS).save('public/icons/icon-192.png')
icon.resize((180, 180), Image.LANCZOS).save('public/icons/apple-touch-icon.png')
icon.resize((512, 512), Image.LANCZOS).save('docs/play-store/icona-512.png')
maskable.resize((512, 512), Image.LANCZOS).save('public/icons/icon-maskable-512.png')
maskable.resize((192, 192), Image.LANCZOS).save('public/icons/icon-maskable-192.png')
fav = icon.resize((32, 32), Image.LANCZOS).convert('RGBA'); fav.putalpha(Image.open('public/favicon-32.png').convert('RGBA').getchannel('A')); fav.save('public/favicon-32.png')
buf = io.BytesIO(); icon.resize((192, 192), Image.LANCZOS).save(buf, 'PNG')
open('public/icon.svg', 'w').write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><image width="192" height="192" href="data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode() + '"/></svg>\n')

# Schermata di avvio (Android vecchi): l'icona arrotondata al centro su fondo scuro
for f in glob.glob(f'{R}drawable*/splash.png'):
    old = Image.open(f).convert('RGB'); w, h = old.size
    bg = Image.new('RGB', (w, h), old.getpixel((2, 2)))
    s = int(min(w, h) * 0.2)
    ic = icon.resize((s, s), Image.LANCZOS).convert('RGBA')
    m = Image.new('L', (s, s), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=255)
    bg.paste(ic, ((w - s) // 2, (h - s) // 2), m); bg.save(f)
