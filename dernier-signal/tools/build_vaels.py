"""Fabrique les corps des Vaëls à partir du corps humain de MakeHuman (CC0).

Étapes : musculature et corpulence (cibles MakeHuman), squelette simplifié pour les
animations du jeu, proportions extraterrestres (membres, cou, pointe des pieds), crâne
resculpté (sans nez ni oreilles humaines, grands yeux, museau), bras ramenés le long du corps.
Sortie : public/assets/species/<id>.json (géométrie, os, poids, motifs lumineux ; données binaires en base64).

Usage : python3 -I tools/build_vaels.py <dossier des fichiers MakeHuman>
Fichiers attendus (dépôt makehumancommunity/makehuman, makehuman/data/) : 3dobjs/base.obj,
rigs/default.mhskel, rigs/default_weights.mhw, targets/macrodetails/universal-*.target.
"""
import json, sys, os
import numpy as np

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'assets', 'species')

# ---------- chargement ----------
V, F, groups, cur = [], [], {}, None
for l in open(os.path.join(SRC, 'base.obj')):
    if l.startswith('v '): V.append([float(x) for x in l.split()[1:4]])
    elif l.startswith('g '): cur = l.split()[1]
    elif l.startswith('f '):
        f = [int(x.split('/')[0]) - 1 for x in l.split()[1:]]
        F.append(f); groups.setdefault(cur, []).append(len(F) - 1)
V0 = np.array(V, dtype=np.float64)
skel = json.load(open(os.path.join(SRC, 'default.mhskel')))
W = json.load(open(os.path.join(SRC, 'default_weights.mhw')))['weights']

def target(name):
    d = np.zeros_like(V0)
    for l in open(os.path.join(SRC, name + '.target')):
        if l.startswith('#') or not l.strip(): continue
        p = l.split(); d[int(p[0])] = [float(p[1]), float(p[2]), float(p[3])]
    return d

# ---------- correspondance des os MakeHuman → os du jeu ----------
def mine(b):
    if b in ('root', 'spine05') or b.startswith('pelvis'): return 'hips'
    if b in ('spine04', 'spine03'): return 'spine'
    if b in ('spine02', 'spine01') or b.startswith('breast'): return 'chest'
    if b.startswith('neck'): return 'neck'
    if b == 'head': return 'head'
    side = 'L' if b.endswith('.L') else 'R' if b.endswith('.R') else ''
    base = b[:-2] if side else b
    m = {'clavicle': 'clav', 'shoulder01': 'arm', 'upperarm01': 'arm', 'upperarm02': 'arm', 'lowerarm01': 'fore', 'lowerarm02': 'fore',
         'wrist': 'hand', 'upperleg01': 'thigh', 'upperleg02': 'thigh', 'lowerleg01': 'shin', 'lowerleg02': 'shin', 'foot': 'foot'}
    if base in m: return m[base] + side
    if base.startswith(('metacarpal', 'finger')): return 'hand' + side
    if base.startswith('toe'): return 'toe' + side
    par = skel['bones'][b]['parent']
    return mine(par) if par else 'hips'

ORDER = ['hips', 'spine', 'chest', 'neck', 'head']
for s in 'LR': ORDER += ['clav' + s, 'arm' + s, 'fore' + s, 'hand' + s, 'thigh' + s, 'shin' + s, 'foot' + s, 'toe' + s]
PARENT = {'hips': None, 'spine': 'hips', 'chest': 'spine', 'neck': 'chest', 'head': 'neck'}
for s in 'LR':
    PARENT.update({'clav' + s: 'chest', 'arm' + s: 'clav' + s, 'fore' + s: 'arm' + s, 'hand' + s: 'fore' + s,
                   'thigh' + s: 'hips', 'shin' + s: 'thigh' + s, 'foot' + s: 'shin' + s, 'toe' + s: 'foot' + s})
HEADS = {'hips': 'spine05', 'spine': 'spine04', 'chest': 'spine02', 'neck': 'neck01', 'head': 'head'}
for s in 'LR':
    HEADS.update({'clav' + s: 'clavicle.' + s, 'arm' + s: 'upperarm01.' + s, 'fore' + s: 'lowerarm01.' + s, 'hand' + s: 'wrist.' + s,
                  'thigh' + s: 'upperleg01.' + s, 'shin' + s: 'lowerleg01.' + s, 'foot' + s: 'foot.' + s, 'toe' + s: 'toe3-1.' + s})
CHILD = {'hips': 'spine', 'spine': 'chest', 'chest': 'neck', 'neck': 'head'}
for s in 'LR': CHILD.update({'clav' + s: 'arm' + s, 'arm' + s: 'fore' + s, 'fore' + s: 'hand' + s, 'thigh' + s: 'shin' + s, 'shin' + s: 'foot' + s, 'foot' + s: 'toe' + s})
BI = {b: i for i, b in enumerate(ORDER)}

def rot(axis, a):
    c, s = np.cos(a), np.sin(a)
    if axis == 'x': return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
    if axis == 'y': return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])

def build(d):
    V = V0.copy()
    for t, w in d['targets'].items(): V += target(t) * w
    body = groups['body']
    used = sorted({i for fi in body for i in F[fi]})
    remap = {v: i for i, v in enumerate(used)}
    P = V[used].copy()
    tris = []
    for fi in body:
        a, b, c, e = [remap[i] for i in F[fi]]
        tris += [a, b, c, a, c, e]
    n = len(used)
    # poids regroupés sur les os du jeu
    Wm = np.zeros((n, len(ORDER)))
    for b, lst in W.items():
        k = BI[mine(b)]
        for vi, w in lst:
            if vi in remap: Wm[remap[vi], k] += w
    Wm /= np.maximum(Wm.sum(1, keepdims=True), 1e-9)
    # poitrine aplatie (le corps de base de MakeHuman en a une légère)
    flat = d.get('flatChest', 0.0)
    if flat:
        for side in 'LR':
            bw = np.zeros(len(V))
            for vi, w in W['breast.' + side]: bw[vi] = w
            c = V[skel['joints'][skel['bones']['breast.' + side]['head']]].mean(0)
            V[:, 2] -= np.clip(bw * 1.6, 0, 1) * flat * np.clip(V[:, 2] - c[2] + 0.12, 0, None)
            P[:, 2] = V[used][:, 2]
    J = {b: V[skel['joints'][skel['bones'][HEADS[b]]['head']]].mean(0) for b in ORDER}
    eyeR = np.ptp(V[[i for fi in groups['helper-l-eye'] for i in F[fi]]], 0).max() / 2
    eyes = [V[[i for fi in groups['joint-l-eye'] for i in F[fi]]].mean(0), V[[i for fi in groups['joint-r-eye'] for i in F[fi]]].mean(0)]

    # ---------- crâne resculpté (repère de la tête, avant la pose) ----------
    hw = Wm[:, BI['head']] + 0.6 * Wm[:, BI['neck']] * 0
    H = J['head']
    L = P - H
    sculpt = d.get('head', {})
    hm = np.clip((hw - 0.25) / 0.6, 0, 1)                      # influence : seulement le crâne et le visage
    sm = lambda x, a, b: np.clip((x - a) / (b - a), 0, 1) ** 2 * (3 - 2 * np.clip((x - a) / (b - a), 0, 1))
    x, y, z = L[:, 0].copy(), L[:, 1].copy(), L[:, 2].copy()
    ax = np.abs(x)
    if sculpt.get('noEars', True):                           # oreilles humaines rentrées dans le crâne
        ear = sm(ax, 0.58, 0.7) * (1 - sm(np.abs(y - 0.25), 0.45, 0.7)) * (1 - sm(np.abs(z + 0.05), 0.4, 0.6))
        x = np.sign(x) * (ax - (ax - 0.58) * ear * 0.92)
        ax = np.abs(x)
    if sculpt.get('noNose', True):                           # pas de nez saillant : visage lisse
        nose = (1 - sm(ax, 0.12, 0.3)) * sm(y, -0.15, -0.02) * (1 - sm(y, 0.42, 0.55)) * sm(z, 1.0, 1.2)
        z = z - (z - 1.05) * nose * 0.85
    big = sculpt.get('eyes', 1.0)
    if big != 1.0:                                           # orbites agrandies
        for e in eyes:
            el = e - H
            dv = np.stack([x, y, z], 1) - el
            r = np.linalg.norm(dv, axis=1)
            k = (1 - sm(r, 0.0, 0.42)) * (big - 1)
            x, y, z = x + dv[:, 0] * k, y + dv[:, 1] * k * 0.8, z + dv[:, 2] * k * 0.3
        ax = np.abs(x)
    cr = sculpt.get('cranium', (1.0, 1.0, 0.0))              # (étirement vertical, largeur, recul vers l'arrière)
    up = sm(y, 0.35, 1.2)
    y = y + (y - 0.35).clip(0) * (cr[0] - 1)
    x = x * (1 + up * (cr[1] - 1))
    z = z - up * cr[2]
    sn = sculpt.get('snout', 0.0)                            # museau : bas du visage avancé
    if sn:
        mz = sm(z, 0.6, 1.2) * (1 - sm(y, 0.25, 0.5)) * sm(y, -0.75, -0.35) + sm(z, 0.6, 1.2) * (1 - sm(y, -0.35, -0.2)) * sm(y, -0.75, -0.35) * 0
        mz = sm(z, 0.55, 1.15) * (1 - sm(y, 0.2, 0.45)) * sm(y, -0.8, -0.5)
        z = z + mz * sn
        x = x * (1 - mz * 0.35)
    jaw = sculpt.get('jaw', 1.0)                              # mâchoire plus étroite
    lowf = 1 - sm(y, -0.4, 0.1)
    x = x * (1 + lowf * (jaw - 1))
    L2 = np.stack([x, y, z], 1)
    P = P + (L2 - L) * hm[:, None]

    # ---------- proportions et pose de repos ----------
    S = d.get('scale', {}); Rl = d.get('pose', {})
    G, Rw, Hn = {}, {}, {}
    def dir_of(b):
        if b in CHILD: v = J[CHILD[b]] - J[b]
        elif b.startswith('hand'): v = J[b] - J['fore' + b[-1]]
        elif b.startswith('toe'): v = np.array([0, 0, 1.0])
        else: v = np.array([0, 1.0, 0])
        return v / np.linalg.norm(v)
    mats = {}
    for b in ORDER:
        sL, sT = S.get(b, (1.0, 1.0))
        dd = dir_of(b)
        Sm = np.eye(3) * sT + (sL - sT) * np.outer(dd, dd)
        R = np.eye(3)
        for ax_, a in Rl.get(b, {}).items(): R = R @ rot(ax_, a)
        p = PARENT[b]
        Rw[b] = (Rw[p] if p else np.eye(3)) @ R
        Hn[b] = J[b] if not p else Hn[p] + Rw[p] @ mats[p][1] @ (J[b] - J[p])
        mats[b] = (Rw[b], Sm)
    out = np.zeros_like(P)
    for b in ORDER:
        Rb, Sm = mats[b]
        out += Wm[:, [BI[b]]] * ((P - J[b]) @ (Rb @ Sm).T + Hn[b])
    P = out
    eyesN = [Hn['head'] + mats['head'][0] @ mats['head'][1] @ (e - J['head']) for e in eyes]
    # au sol, mis à l'échelle (MakeHuman est en décimètres)
    minY = P[:, 1].min()
    k = d['height'] / (P[:, 1].max() - minY)
    def T(v): return ((v - np.array([0, minY, 0])) * k).tolist()
    P = (P - np.array([0, minY, 0])) * k
    joints = [{'name': b, 'parent': PARENT[b], 'p': T(Hn[b])} for b in ORDER]
    # zones de motifs lumineux : bras, dos, jambes ; peu sur le ventre et le visage
    gl = np.zeros(n)
    zone = {'hips': 0.3, 'spine': 0.5, 'chest': 0.5, 'neck': 0.8, 'head': 0.5}
    for s in 'LR': zone.update({'clav' + s: 0.7, 'arm' + s: 0.9, 'fore' + s: 0.95, 'hand' + s: 0.25, 'thigh' + s: 0.75, 'shin' + s: 0.9, 'foot' + s: 0.3, 'toe' + s: 0.1})
    for b, v in zone.items(): gl += Wm[:, BI[b]] * v
    back = (P[:, 2] < np.interp(P[:, 1], [0, 3], [0, 0])).astype(float)
    trunk = Wm[:, BI['spine']] + Wm[:, BI['chest']]
    gl = np.clip(gl + trunk * (back * 0.45 - (1 - back) * 0.15), 0, 1)
    # 4 influences max
    idx = np.argsort(-Wm, axis=1)[:, :4]
    wts = np.take_along_axis(Wm, idx, 1); wts /= wts.sum(1, keepdims=True)
    # binaire : positions f32, index u16, os u8×4, poids u8×4, motifs u8
    blob = P.astype(np.float32).tobytes() + np.array(tris, dtype=np.uint16).tobytes() + idx.astype(np.uint8).tobytes() + np.round(wts * 255).astype(np.uint8).tobytes() + np.round(gl * 255).astype(np.uint8).tobytes()
    import base64
    meta = {'id': d['id'], 'verts': n, 'tris': len(tris) // 3, 'joints': joints, 'eyes': [T(e) for e in eyesN], 'eyeR': float(eyeR * k * sculpt.get('eyes', 1.0)), 'scale': k,
            'source': 'MakeHuman base mesh, skeleton and targets (CC0 1.0)', 'data': base64.b64encode(blob).decode('ascii')}
    json.dump(meta, open(os.path.join(OUT, d['id'] + '.json'), 'w'))
    print(d['id'], n, 'sommets', len(tris) // 3, 'triangles', 'taille', round(P[:, 1].max(), 2), 'm')

# ---------- les quatre peuples ----------
ARMS_DOWN = lambda a=0.62: {'armL': {'z': -a}, 'armR': {'z': a}, 'foreL': {'x': 0.15}, 'foreR': {'x': 0.15}}
def tiptoe(a=0.95):
    p = {}
    for s in 'LR': p['foot' + s] = {'x': a}; p['toe' + s] = {'x': -a * 0.8}
    return p
VAELS = [
    {'id': 'cervide', 'height': 1.98,
     'targets': {'universal-male-young-averagemuscle-minweight': 1.2, 'universal-male-young-maxmuscle-averageweight': 0.5}, 'flatChest': 1.0,
     'head': {'noEars': True, 'noNose': True, 'eyes': 1.15, 'cranium': (1.05, 0.95, 0.1), 'snout': 0.55, 'jaw': 0.8},
     'scale': {'neck': (1.4, 0.85), 'armL': (1.06, 0.95), 'armR': (1.06, 0.95), 'foreL': (1.08, 0.9), 'foreR': (1.08, 0.9), 'thighL': (1.06, 0.95), 'thighR': (1.06, 0.95), 'shinL': (1.08, 0.9), 'shinR': (1.08, 0.9)},
     'pose': ARMS_DOWN()},
    {'id': 'veilleur', 'height': 1.93,
     'targets': {'universal-male-young-maxmuscle-averageweight': 1.35}, 'flatChest': 1.0,
     'head': {'noEars': True, 'noNose': True, 'eyes': 1.35, 'cranium': (1.25, 1.05, 0.25), 'jaw': 0.85},
     'scale': {'neck': (1.25, 1.0), 'armL': (1.05, 1.0), 'armR': (1.05, 1.0), 'foreL': (1.05, 1.0), 'foreR': (1.05, 1.0), 'hips': (1.0, 0.86), 'thighL': (1.02, 0.92), 'thighR': (1.02, 0.92), 'chest': (1.0, 1.08)},
     'pose': ARMS_DOWN(0.58)},
    {'id': 'echassier', 'height': 2.1,
     'targets': {'universal-male-young-averagemuscle-minweight': 1.5, 'universal-male-young-minmuscle-minweight': 0.4}, 'flatChest': 1.0,
     'head': {'noEars': True, 'noNose': True, 'eyes': 1.1, 'cranium': (0.95, 0.9, 0.15), 'snout': 0.75, 'jaw': 0.75},
     'scale': {'neck': (1.5, 0.8), 'armL': (1.3, 0.85), 'armR': (1.3, 0.85), 'foreL': (1.35, 0.85), 'foreR': (1.35, 0.85), 'handL': (1.3, 0.9), 'handR': (1.3, 0.9),
               'thighL': (1.1, 0.85), 'thighR': (1.1, 0.85), 'shinL': (1.25, 0.8), 'shinR': (1.25, 0.8), 'footL': (1.7, 0.85), 'footR': (1.7, 0.85), 'spine': (1.05, 0.85), 'chest': (1.0, 0.88)},
     'pose': {**ARMS_DOWN(0.66), **tiptoe(1.0), 'spine': {'x': 0.12}, 'neck': {'x': 0.1}, 'head': {'x': -0.15}}},
    {'id': 'sylphe', 'height': 2.05,
     'targets': {'universal-male-young-minmuscle-minweight': 1.4}, 'flatChest': 1.0,
     'head': {'noEars': True, 'noNose': True, 'eyes': 1.45, 'cranium': (1.3, 0.95, 0.45), 'jaw': 0.7},
     'scale': {'neck': (1.9, 0.75), 'armL': (1.1, 0.8), 'armR': (1.1, 0.8), 'foreL': (1.15, 0.8), 'foreR': (1.15, 0.8), 'handL': (1.2, 0.85), 'handR': (1.2, 0.85),
               'thighL': (1.15, 0.8), 'thighR': (1.15, 0.8), 'shinL': (1.25, 0.75), 'shinR': (1.25, 0.75), 'footL': (1.9, 0.75), 'footR': (1.9, 0.75), 'chest': (1.0, 0.85), 'spine': (1.08, 0.8), 'hips': (1.0, 0.85)},
     'pose': {**ARMS_DOWN(0.7), **tiptoe(1.1)}},
]
os.makedirs(OUT, exist_ok=True)
for d in VAELS: build(d)
