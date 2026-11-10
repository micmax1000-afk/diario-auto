"""Rigenera le immagini delle auto: python3 design/recolor/genera.py (dalla cartella del progetto)."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import cars2 as C
C.CARS = C.R.CARS = 'design/cars-source/'
OUT = 'src/assets/cars/'
VIVI = ['rosso', 'arancione', 'giallo', 'verde', 'blu', 'viola']
solo = sys.argv[1:]  # facoltativo: solo alcune carrozzerie
for b in C.KIND:
    if solo and b not in solo: continue
    for c in (['bianco', 'argento', 'grigio', 'nero'] + VIVI):
        if C.KIND[b] != 'neutral' or c in VIVI or not solo:
            C.recolor(b, c).save(f'{OUT}{b}-{c}.webp', 'WEBP', quality=82, method=6)
