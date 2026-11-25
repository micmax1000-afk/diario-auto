"""Icone dell'app a partire da design/store/icona-finale-1024.png (tachimetro e libretto, tutto in tonalità di blu
con il tachimetro giallo; ottenuta come spiegato in design/store/senza-auto/LEGGIMI.txt).
Rigenera tutte le icone: python3 design/store/applica-icona.py (dalla cartella del progetto)."""
import base64, glob, io
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

master = Image.open('design/store/icona-finale-1024.png').convert('RGB')

def square(scale_visible):
    """Quadrato in cui il disegno occupa la frazione `scale_visible` del lato; il margine attorno prolunga i bordi
    (sfumatura blu) e li sfoca, così continua in modo naturale."""
    if scale_visible >= 1:
        return master
    full = int(round(1024 / scale_visible)); pad = (full - 1024) // 2
    ext = Image.fromarray(np.pad(np.asarray(master), ((pad, full - 1024 - pad), (pad, full - 1024 - pad), (0, 0)), mode='edge'))
    out = ext.filter(ImageFilter.GaussianBlur(full * 0.03))
    out.paste(master, (pad, pad))
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
