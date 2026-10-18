"""STERNENFALL-Assets an den Jugendstil-Look anpassen.

Eingabe: Ordner mit Rohbildern (NASA-Fotos je Sektor, Poly-Haven-Texturen), Ausgabe: public/sf/img.
Weltraumfotos → Farbverlaufs-Abbildung (Mitternacht → Sektorfarbe → Elfenbein/Gold), etwas Originalfarbe,
Kontrastkurve, leichte Tonwerttrennung (Druckgrafik-Anmutung), Korn, Vignette. Texturen → Messing, Pergament, Ornament.
Aufruf: python tools/sf_assets.py <rohordner>
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / 'public' / 'sf' / 'img'
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(7)

hexrgb = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float32) / 255

# Sektorfarbe = Mitteltöne der Abbildung
SECTOR = {'guertel': '#b07a48', 'frost': '#4f9ac0', 'orion': '#b0508f', 'pulsar': '#5a70c8',
          'horizont': '#8a4a9a', 'kern': '#d0703c', 'rand': '#3a8a9a', 'hub': '#4a6aa0'}
MIDNIGHT, IVORY, GOLD = hexrgb('#07060f'), hexrgb('#efe3c8'), hexrgb('#e8c070')


def gradient_map(lum, stops):
    """lum 0..1 → Farbe entlang der Stützstellen [(pos, rgb), …]."""
    out = np.zeros(lum.shape + (3,), np.float32)
    for (p0, c0), (p1, c1) in zip(stops, stops[1:]):
        m = (lum >= p0) & (lum <= p1)
        t = ((lum[m] - p0) / max(1e-6, p1 - p0))[:, None]
        out[m] = c0 * (1 - t) + c1 * t
    return out


def vignette(h, w, strength):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt(((x - w / 2) / (w / 2)) ** 2 + ((y - h / 2) / (h / 2)) ** 2)
    return np.clip(1 - strength * np.clip(d - 0.45, 0, None) ** 1.6, 0, 1)[..., None]


def space_plate(key):
    im = Image.open(SRC / f'{key}.jpg').convert('RGB')
    im.thumbnail((900, 900), Image.LANCZOS)
    if min(im.size) < 700:                                   # kleine Vorlagen weich hochziehen
        im = im.resize((im.width * 900 // max(im.size), im.height * 900 // max(im.size)), Image.BICUBIC).filter(ImageFilter.GaussianBlur(1.2))
    a = np.asarray(im, np.float32) / 255
    lum = a @ np.array([0.299, 0.587, 0.114], np.float32)
    lum = np.clip((lum - 0.02) / 0.9, 0, 1) ** 0.85             # Schwarzpunkt, leicht aufhellen
    lum = 0.5 - 0.5 * np.cos(np.pi * lum)                    # S-Kurve
    mid = hexrgb(SECTOR[key])
    mapped = gradient_map(lum, [(0, MIDNIGHT), (0.38, MIDNIGHT * 0.4 + mid * 0.6), (0.72, mid * 0.5 + GOLD * 0.5), (1, IVORY)])
    col = mapped * 0.78 + a * 0.22                           # etwas echte Farbe behalten
    col = np.round(col * 28) / 28 * 0.35 + col * 0.65         # Hauch Tonwerttrennung (Druck)
    col *= vignette(*col.shape[:2], 1.1)
    col += rng.normal(0, 0.018, col.shape[:2])[..., None]    # Korn
    Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8)).save(OUT / f'sky_{key}.jpg', quality=72, optimize=True, progressive=True)


def texture(name, out, stops, size, contrast=1.0, highpass=0):
    im = Image.open(SRC / f'{name}.jpg').convert('L').resize((size, size), Image.LANCZOS)
    a = np.asarray(im, np.float32) / 255
    if highpass:                                            # grobe Flecken entfernen, Struktur betonen
        blur = np.asarray(im.filter(ImageFilter.GaussianBlur(highpass)), np.float32) / 255
        a = np.clip(0.5 + (a - blur) * 2.2, 0, 1)
    a = np.clip(0.5 + (a - a.mean()) / (4 * a.std() + 1e-6) * contrast, 0, 1)   # auf Streuung normieren (flache Vorlagen)
    col = gradient_map(a, [(p, hexrgb(c)) for p, c in stops])
    Image.fromarray((col * 255).astype(np.uint8)).save(OUT / f'{out}.jpg', quality=78, optimize=True, progressive=True)


for k in SECTOR:
    space_plate(k)
# Gealtertes Messing (Reaktor), Pergament (Logbuch, Geschichte), dunkles Ornament (Kartenrücken, Rahmen)
texture('tex_brass', 'brass', [(0, '#1e1308'), (0.35, '#5a3c18'), (0.62, '#a8803a'), (0.85, '#d8b060'), (1, '#f6dc96')], 512, contrast=1.0)
texture('tex_paper', 'paper', [(0, '#a88a5c'), (0.45, '#d8c49c'), (0.75, '#e9dcc0'), (1, '#f6eedc')], 512, contrast=0.9, highpass=18)
texture('tex_ornament', 'ornament', [(0, '#0b0a14'), (0.5, '#16132a'), (0.8, '#2a2340'), (1, '#4a3c2a')], 384, contrast=0.8)
for f in sorted(OUT.iterdir()):
    print(f.name, f.stat().st_size // 1024, 'KB')
