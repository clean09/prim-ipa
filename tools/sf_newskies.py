"""Neue Sektorhimmel (v4.6) aus vorhandenen, bereits angepassten NASA-Platten: gespiegelt/zugeschnitten und mit
eigener Farbabbildung neu getönt. Aufruf: python tools/sf_newskies.py"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageOps

IMG = Path(__file__).resolve().parent.parent / 'public' / 'sf' / 'img'
rng = np.random.default_rng(11)
hexrgb = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float32) / 255
MIDNIGHT, IVORY, GOLD = hexrgb('#07060f'), hexrgb('#efe3c8'), hexrgb('#e8c070')

def gradient_map(lum, stops):
    out = np.zeros(lum.shape + (3,), np.float32)
    for (p0, c0), (p1, c1) in zip(stops, stops[1:]):
        m = (lum >= p0) & (lum <= p1)
        t = ((lum[m] - p0) / max(1e-6, p1 - p0))[:, None]
        out[m] = c0 * (1 - t) + c1 * t
    return out

# neu: (Quelle, Mittelton, Spiegeln, Zuschnitt-Zoom)
NEW = {'werft': ('guertel', '#8a7a6a', 'h', 1.25), 'riff': ('orion', '#3aa088', 'v', 1.15),
       'tiefsee': ('frost', '#2a5a9a', 'hv', 1.3), 'sturm': ('pulsar', '#7a4ab0', 'v', 1.2)}
for key, (src, mid, flip, zoom) in NEW.items():
    im = Image.open(IMG / f'sky_{src}.jpg').convert('RGB')
    if 'h' in flip: im = ImageOps.mirror(im)
    if 'v' in flip: im = ImageOps.flip(im)
    w, h = im.size; cw, ch = int(w / zoom), int(h / zoom)
    im = im.crop(((w - cw) // 3, (h - ch) // 2, (w - cw) // 3 + cw, (h - ch) // 2 + ch)).resize((w, h), Image.LANCZOS)
    a = np.asarray(im, np.float32) / 255
    lum = np.clip(a @ np.array([0.299, 0.587, 0.114], np.float32) * 1.15, 0, 1)
    m = hexrgb(mid)
    col = gradient_map(lum, [(0, MIDNIGHT), (0.35, MIDNIGHT * 0.4 + m * 0.6), (0.72, m * 0.55 + GOLD * 0.45), (1, IVORY)])
    col += rng.normal(0, 0.016, col.shape[:2])[..., None]
    Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8)).save(IMG / f'sky_{key}.jpg', quality=72, optimize=True, progressive=True)
    print(key, (IMG / f'sky_{key}.jpg').stat().st_size)
