"""Convertit une image Radiance .hdr (RGBE) en PNG RGBA sans perte : R, G, B = mantisses, A = exposant.
Le jeu décode l'image sur la carte graphique (src/core/textures.ts). Le service d'artefacts ne sert pas les .hdr.
Usage : python3 -I tools/hdr_to_png.py entree.hdr sortie.png
"""
import sys
import numpy as np
from PIL import Image

def read_hdr(path):
    data = open(path, 'rb').read()
    pos = 0
    while True:  # en-tête jusqu'à la ligne vide
        end = data.index(b'\n', pos); line = data[pos:end]; pos = end + 1
        if line == b'': break
    end = data.index(b'\n', pos); dims = data[pos:end].split(); pos = end + 1
    h, w = int(dims[1]), int(dims[3])
    out = np.zeros((h, w, 4), np.uint8)
    for y in range(h):
        if data[pos] == 2 and data[pos + 1] == 2 and (data[pos + 2] << 8 | data[pos + 3]) == w:  # RLE moderne
            pos += 4
            for c in range(4):
                x = 0
                while x < w:
                    n = data[pos]; pos += 1
                    if n > 128:
                        n -= 128; out[y, x:x + n, c] = data[pos]; pos += 1
                    else:
                        out[y, x:x + n, c] = np.frombuffer(data, np.uint8, n, pos); pos += n
                    x += n
        else:  # non compressé
            out[y] = np.frombuffer(data, np.uint8, w * 4, pos).reshape(w, 4); pos += w * 4
    return out

Image.fromarray(read_hdr(sys.argv[1]), 'RGBA').save(sys.argv[2], optimize=True)
