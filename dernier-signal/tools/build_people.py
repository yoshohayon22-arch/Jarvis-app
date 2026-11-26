"""Fabrique les personnages « statues de métal » à partir de MakeHuman (CC0).

Sorties (public/assets/people/) :
  human.json   corps humain de base + formes (homme, femme, enfant, ancien, musclé, corpulent)
               + expressions du visage (neutre… réflexion), formes de bouche pour la parole, clignements
  vael-1.json, vael-2.json, vael-3.json   les trois formes de Vaëls (mêmes expressions)
Chaque fichier : géométrie, squelette simplifié du jeu, poids, et pour chaque forme les écarts de
position des sommets, des articulations et des yeux (entiers 16 bits, encodés en base64).

Usage : python3 -I tools/build_people.py <dossier des fichiers MakeHuman>
(base.obj, default.mhskel, default_weights.mhw, cibles macrodetails universal-*.target)
"""
import json, sys, os, base64
import numpy as np

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'assets', 'people')

# ---------- chargement ----------
V, F, groups, cur = [], [], {}, None
for l in open(os.path.join(SRC, 'base.obj')):
    if l.startswith('v '): V.append([float(x) for x in l.split()[1:4]])
    elif l.startswith('g '): cur = l.split()[1]
    elif l.startswith('f '):
        F.append([int(x.split('/')[0]) - 1 for x in l.split()[1:]]); groups.setdefault(cur, []).append(len(F) - 1)
V0 = np.array(V, dtype=np.float64)
skel = json.load(open(os.path.join(SRC, 'default.mhskel')))
W = json.load(open(os.path.join(SRC, 'default_weights.mhw')))['weights']
JN = lambda V, j: V[skel['joints'][j]].mean(0)
BH = lambda V, b: JN(V, skel['bones'][b]['head'])

_tcache = {}
def target(name):
    if name not in _tcache:
        d = np.zeros_like(V0)
        for l in open(os.path.join(SRC, name + '.target')):
            if l.startswith('#') or not l.strip(): continue
            p = l.split(); d[int(p[0])] = [float(p[1]), float(p[2]), float(p[3])]
        _tcache[name] = d
    return _tcache[name]
T = lambda g, a, m='averagemuscle', w='averageweight': f'universal-{g}-{a}-{m}-{w}'
# sexe et âge : cibles « race » de MakeHuman (moyenne des trois)
def RACE(g, a, w=1.0): return {f'{r}-{g}-{a}': w / 3 for r in ('african', 'asian', 'caucasian')}
def mix(*ds):
    out = {}
    for d in ds:
        for k, v in d.items(): out[k] = out.get(k, 0) + v
    return out
NEUTRAL = mix(RACE('male', 'young', 0.5), RACE('female', 'young', 0.5))
ZERO_YOUNG = {k: 0 for k in NEUTRAL}

# ---------- squelette du jeu ----------
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
    PARENT.update({'clav' + s: 'chest', 'arm' + s: 'clav' + s, 'fore' + s: 'arm' + s, 'hand' + s: 'fore' + s, 'thigh' + s: 'hips', 'shin' + s: 'thigh' + s, 'foot' + s: 'shin' + s, 'toe' + s: 'foot' + s})
HEADS = {'hips': 'spine05', 'spine': 'spine04', 'chest': 'spine02', 'neck': 'neck01', 'head': 'head'}
for s in 'LR':
    HEADS.update({'clav' + s: 'clavicle.' + s, 'arm' + s: 'upperarm01.' + s, 'fore' + s: 'lowerarm01.' + s, 'hand' + s: 'wrist.' + s, 'thigh' + s: 'upperleg01.' + s, 'shin' + s: 'lowerleg01.' + s, 'foot' + s: 'foot.' + s, 'toe' + s: 'toe3-1.' + s})
CHILD = {'hips': 'spine', 'spine': 'chest', 'chest': 'neck', 'neck': 'head'}
for s in 'LR': CHILD.update({'clav' + s: 'arm' + s, 'arm' + s: 'fore' + s, 'fore' + s: 'hand' + s, 'thigh' + s: 'shin' + s, 'shin' + s: 'foot' + s, 'foot' + s: 'toe' + s})
BI = {b: i for i, b in enumerate(ORDER)}

body = groups['body']
USED = sorted({i for fi in body for i in F[fi]})
REMAP = {v: i for i, v in enumerate(USED)}
N = len(USED)
TRIS = []
for fi in body:
    a, b, c, e = [REMAP[i] for i in F[fi]]
    TRIS += [a, b, c, a, c, e]
WM = np.zeros((N, len(ORDER)))
for b, lst in W.items():
    k = BI[mine(b)]
    for vi, w in lst:
        if vi in REMAP: WM[REMAP[vi], k] += w
WM /= np.maximum(WM.sum(1, keepdims=True), 1e-9)
EYEG = [[i for fi in groups['joint-l-eye'] for i in F[fi]], [i for fi in groups['joint-r-eye'] for i in F[fi]]]
EYER = np.ptp(V0[[i for fi in groups['helper-l-eye'] for i in F[fi]]], 0).max() / 2

def rot(axis, a):
    c, s = np.cos(a), np.sin(a)
    if axis == 'x': return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
    if axis == 'y': return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])

# ---------- expressions : transformations des os du visage (repère MakeHuman, décimètres) ----------
# chaque entrée : os → (translation [x,y,z], rotation {axe: angle}) ; les côtés gauches sont recopiés en miroir.
def mirror(d):
    out = dict(d)
    for b, (t, r) in d.items():
        if b.endswith('.L'):
            rb = b[:-2] + '.R'
            if rb not in out: out[rb] = ([-t[0], t[1], t[2]], {k: (-v if k in 'yz' else v) for k, v in r.items()})
    return out
E = {
    'sourire': mirror({'levator05.L': ([0.06, 0.09, -0.03], {}), 'oris03.L': ([0.03, 0.03, -0.01], {}), 'oris07.L': ([0.03, 0.02, -0.01], {}),
                       'risorius03.L': ([0.02, 0.06, 0.01], {}), 'orbicularis04.L': ([0, 0.025, 0], {}), 'oculi01.L': ([0, 0.01, 0], {})}),
    'colere': mirror({'oculi01.L': ([-0.02, -0.06, 0.02], {'z': -0.18}), 'levator06.L': ([0, 0.025, 0], {}), 'levator05.L': ([0.01, -0.03, 0], {}),
                      'orbicularis03.L': ([0, 0, 0], {'x': 0.12}), 'oris05': ([0, 0.015, 0.01], {}), 'oris01': ([0, -0.01, 0.01], {})}),
    'tristesse': mirror({'oculi01.L': ([0, 0.02, 0], {'z': 0.22}), 'levator05.L': ([0.01, -0.06, 0], {}), 'oris07.L': ([0, -0.02, 0], {}),
                         'orbicularis03.L': ([0, 0, 0], {'x': 0.1}), 'jaw': ([0, 0, 0], {'x': 0.03})}),
    'peur': mirror({'oculi01.L': ([0, 0.08, 0], {'z': 0.12}), 'orbicularis03.L': ([0, 0, 0], {'x': -0.12}), 'levator05.L': ([0.05, -0.02, -0.01], {}),
                    'oris07.L': ([0.03, -0.02, 0], {}), 'jaw': ([0, 0, 0], {'x': 0.1})}),
    'surprise': mirror({'oculi01.L': ([0, 0.1, 0], {}), 'orbicularis03.L': ([0, 0, 0], {'x': -0.15}), 'orbicularis04.L': ([0, -0.01, 0], {}),
                        'jaw': ([0, 0, 0], {'x': 0.3}), 'oris03.L': ([-0.02, 0, 0.01], {}), 'oris07.L': ([-0.02, 0, 0.01], {})}),
    'degout': mirror({'levator06.L': ([0, 0.05, 0], {}), 'oris05': ([0, 0.04, 0], {}), 'oculi01.L': ([0, -0.035, 0], {'z': -0.08}),
                      'orbicularis04.L': ([0, 0.03, 0], {}), 'levator05.L': ([0, 0.02, 0], {}), 'oris01': ([0, 0.02, 0.02], {})}),
    'reflexion': {'oculi01.L': ([0, 0.06, 0], {}), 'oculi01.R': ([0, -0.03, 0], {}), 'levator05.R': ([-0.03, 0.03, 0], {}), 'oris03.R': ([-0.02, 0.01, 0], {}),
                  'orbicularis04.L': ([0, 0.02, 0], {}), 'orbicularis04.R': ([0, 0.02, 0], {})},
    # bouche pour la parole
    'v_a': {'jaw': ([0, 0, 0], {'x': 0.28}), 'oris05': ([0, 0.015, 0], {})},
    'v_o': mirror({'jaw': ([0, 0, 0], {'x': 0.16}), 'oris03.L': ([-0.04, 0, 0.04], {}), 'oris07.L': ([-0.04, 0, 0.04], {}), 'levator05.L': ([-0.03, 0, 0.02], {}), 'oris05': ([0, 0, 0.03], {}), 'oris01': ([0, 0, 0.03], {})}),
    'v_e': mirror({'jaw': ([0, 0, 0], {'x': 0.1}), 'levator05.L': ([0.05, 0.01, -0.02], {}), 'oris03.L': ([0.03, 0, 0], {}), 'oris07.L': ([0.03, 0, 0], {})}),
    'v_m': {'oris05': ([0, -0.025, 0.005], {}), 'oris01': ([0, 0.03, 0.005], {})},
    'cligne_g': {'orbicularis03.L': ([0, 0, 0], {'x': 0.55}), 'orbicularis04.L': ([0, 0.01, 0], {'x': -0.08})},
    'cligne_d': {'orbicularis03.R': ([0, 0, 0], {'x': 0.55}), 'orbicularis04.R': ([0, 0.01, 0], {'x': -0.08})},
}

def face_delta(V, expr):
    """Déplacement des sommets pour une expression (cinématique des os du visage, poids MakeHuman)."""
    bones = skel['bones']
    order, seen = [], set()
    def visit(b):
        if b in seen: return
        p = bones[b]['parent']
        if p: visit(p)
        seen.add(b); order.append(b)
    for b in bones: visit(b)
    M = {}
    for b in order:
        p = bones[b]['parent']
        R = np.eye(3); t = np.zeros(3)
        if b in expr:
            tt, rr = expr[b]
            for ax, a in rr.items(): R = R @ rot(ax, a)
            t = np.array(tt, dtype=float)
        h = BH(V, b)
        local = (R, h - R @ h + t)                  # rotation autour de la tête de l'os puis translation
        if p:
            Rp, tp = M[p]; M[b] = (Rp @ local[0], Rp @ local[1] + tp)
        else: M[b] = local
    D = np.zeros_like(V)
    for b, lst in W.items():
        if b not in M: continue
        R, t = M[b]
        if np.allclose(R, np.eye(3)) and np.allclose(t, 0): continue
        idx = np.array([i for i, _ in lst]); w = np.array([w for _, w in lst])[:, None]
        D[idx] += w * ((V[idx] @ R.T + t) - V[idx])
    return D

# ---------- une variante : corps, proportions, crâne, pose ----------
def sm(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

def variant(d):
    V = V0.copy()
    for t, w in d.get('targets', {}).items(): V += target(t) * w
    flat = d.get('flatChest', 0.0)
    if flat:
        for side in 'LR':
            bw = np.zeros(len(V))
            for vi, w in W['breast.' + side]: bw[vi] = w
            c = BH(V, 'breast.' + side)
            V[:, 2] -= np.clip(bw * 1.6, 0, 1) * flat * np.clip(V[:, 2] - c[2] + 0.12, 0, None)
    for e, w in d.get('expr', {}).items(): V += face_delta(V, E[e]) * w
    P = V[USED].copy()
    J = {b: BH(V, HEADS[b]) for b in ORDER}
    eyes = [V[g].mean(0) for g in EYEG]
    # crâne et visage (repère de la tête)
    s = d.get('head', {})
    if s:
        H = J['head']; L = P - H
        hm = np.clip((WM[:, BI['head']] - 0.25) / 0.6, 0, 1)
        x, y, z = L[:, 0].copy(), L[:, 1].copy(), L[:, 2].copy(); ax = np.abs(x)
        if s.get('noEars'):
            ear = sm(ax, 0.58, 0.7) * (1 - sm(np.abs(y - 0.25), 0.45, 0.7)) * (1 - sm(np.abs(z + 0.05), 0.4, 0.6))
            x = np.sign(x) * (ax - (ax - 0.58) * ear * 0.92); ax = np.abs(x)
        if s.get('noNose'):
            nose = (1 - sm(ax, 0.12, 0.3)) * sm(y, -0.15, -0.02) * (1 - sm(y, 0.42, 0.55)) * sm(z, 1.0, 1.2)
            z = z - (z - 1.05) * nose * s.get('noNose')
        big = s.get('eyes', 1.0)
        if big != 1.0:
            for e in eyes:
                el = e - H; dv = np.stack([x, y, z], 1) - el; r = np.linalg.norm(dv, axis=1)
                k = (1 - sm(r, 0.0, 0.42)) * (big - 1)
                x, y, z = x + dv[:, 0] * k, y + dv[:, 1] * k * 0.8, z + dv[:, 2] * k * 0.3
            ax = np.abs(x)
        cr = s.get('cranium', (1.0, 1.0, 0.0))
        up = sm(y, 0.35, 1.2)
        y = y + (y - 0.35).clip(0) * (cr[0] - 1); x = x * (1 + up * (cr[1] - 1)); z = z - up * cr[2]
        crest = s.get('crest', 0.0)                              # crête sagittale vers l'arrière
        if crest:
            mid = 1 - sm(ax, 0.0, 0.18)
            back = sm(-z + 0.2, 0.0, 1.0) * sm(y, 0.6, 1.3)
            z = z - mid * back * crest; y = y + mid * back * crest * 0.35
        sn = s.get('snout', 0.0)
        if sn:
            mz = sm(z, 0.55, 1.15) * (1 - sm(y, 0.2, 0.45)) * sm(y, -0.8, -0.5)
            z = z + mz * sn; x = x * (1 - mz * 0.35)
        jaw = s.get('jaw', 1.0); lowf = 1 - sm(y, -0.4, 0.1); x = x * (1 + lowf * (jaw - 1))
        L2 = np.stack([x, y, z], 1); P = P + (L2 - L) * hm[:, None]
    # proportions et pose de repos (bras le long du corps)
    S = d.get('scale', {}); Rl = d.get('pose', {})
    def dir_of(b):
        if b in CHILD: v = J[CHILD[b]] - J[b]
        elif b.startswith('hand'): v = J[b] - J['fore' + b[-1]]
        elif b.startswith('toe'): v = np.array([0, 0, 1.0])
        else: v = np.array([0, 1.0, 0])
        return v / np.linalg.norm(v)
    Rw, Hn, mats = {}, {}, {}
    for b in ORDER:
        sL, sT = S.get(b, (1.0, 1.0)); dd = dir_of(b)
        Sm = np.eye(3) * sT + (sL - sT) * np.outer(dd, dd)
        R = np.eye(3)
        for ax_, a in Rl.get(b, {}).items(): R = R @ rot(ax_, a)
        p = PARENT[b]
        Rw[b] = (Rw[p] if p else np.eye(3)) @ R
        Hn[b] = J[b] if not p else Hn[p] + Rw[p] @ mats[p][1] @ (J[b] - J[p])
        mats[b] = (Rw[b], Sm)
    out = np.zeros_like(P)
    for b in ORDER:
        Rb, Sm = mats[b]; out += WM[:, [BI[b]]] * ((P - J[b]) @ (Rb @ Sm).T + Hn[b])
    eyesN = [Hn['head'] + mats['head'][0] @ mats['head'][1] @ (e - J['head']) for e in eyes]
    joints = np.array([Hn[b] for b in ORDER])
    minY = out[:, 1].min()
    g = np.array([0, minY, 0])
    return out - g, joints - g, np.array(eyesN) - g

ARMS = lambda a=0.62: {'armL': {'z': -a}, 'armR': {'z': a}, 'foreL': {'x': 0.15}, 'foreR': {'x': 0.15}}

def q16(a, s):
    return np.clip(np.round(a / s), -32767, 32767).astype(np.int16)

def export(name, base, forms, height, extra=None):
    """base, forms : descriptions de variantes ; chaque forme est exportée comme écart à la base."""
    P0, J0, E0 = variant(base)
    k = height / (P0[:, 1].max())
    out = {'name': name, 'verts': N, 'tris': len(TRIS) // 3, 'scale': k, 'eyeR': float(EYER * k * base.get('head', {}).get('eyes', 1.0)),
           'bones': [{'name': b, 'parent': PARENT[b]} for b in ORDER], 'joints': (J0 * k).round(5).tolist(), 'eyes': (E0 * k).round(5).tolist(),
           'source': 'MakeHuman base mesh hm08, default skeleton, weights, macro targets (CC0 1.0) — tools/build_people.py'}
    pos = (P0 * k).astype(np.float32)
    idx = np.argsort(-WM, axis=1)[:, :4]
    wts = np.take_along_axis(WM, idx, 1); wts /= wts.sum(1, keepdims=True)
    out['data'] = base64.b64encode(pos.tobytes() + np.array(TRIS, dtype=np.uint16).tobytes() + idx.astype(np.uint8).tobytes() + np.round(wts * 255).astype(np.uint8).tobytes()).decode()
    morphs = []
    for fname, fd in forms.items():
        P, J, Eye = variant({**base, **fd, 'targets': {**base.get('targets', {}), **fd.get('targets', {})}, 'expr': fd.get('expr', {})})
        dP = (P - P0) * k
        sel = np.where(np.abs(dP).max(1) > 1e-4)[0].astype(np.uint16)
        sc = max(float(np.abs(dP[sel]).max()) / 32000, 1e-7) if len(sel) else 1e-7
        morphs.append({'name': fname, 'n': int(len(sel)), 'scale': sc, 'joints': ((J - J0) * k).round(5).tolist(), 'eyes': ((Eye - E0) * k).round(5).tolist(),
                       'data': base64.b64encode(sel.tobytes() + q16(dP[sel], sc).tobytes()).decode()})
        print(f'  {name}/{fname}: {len(sel)} sommets')
    out['morphs'] = morphs
    if extra: out.update(extra)
    os.makedirs(OUT, exist_ok=True)
    json.dump(out, open(os.path.join(OUT, name + '.json'), 'w'))
    print(name, 'écrit', round(os.path.getsize(os.path.join(OUT, name + '.json')) / 1e6, 2), 'Mo')

FACE = {e: {'expr': {e: 1.0}} for e in E}

# ---------- humains ----------
HUMAN_BASE = {'targets': NEUTRAL, 'pose': ARMS(0.6)}
export('human', HUMAN_BASE, {
    'homme': {'targets': mix(ZERO_YOUNG, RACE('male', 'young'))},
    'femme': {'targets': mix(ZERO_YOUNG, RACE('female', 'young'))},
    'enfant': {'targets': mix(ZERO_YOUNG, RACE('male', 'child', 0.5), RACE('female', 'child', 0.5))},
    'ancien': {'targets': mix(ZERO_YOUNG, RACE('male', 'old', 0.5), RACE('female', 'old', 0.5))},
    'muscle': {'targets': {T('male', 'young', 'maxmuscle'): 0.5, T('female', 'young', 'maxmuscle'): 0.5}},
    'corpulent': {'targets': {T('male', 'young', 'averagemuscle', 'maxweight'): 0.5, T('female', 'young', 'averagemuscle', 'maxweight'): 0.5}},
    'mince': {'targets': {T('male', 'young', 'averagemuscle', 'minweight'): 0.5, T('female', 'young', 'averagemuscle', 'minweight'): 0.5}},
    **FACE,
}, 1.74)

# ---------- Vaëls : trois formes nouvelles ----------
def tiptoe(a=0.95):
    p = {}
    for s in 'LR': p['foot' + s] = {'x': a}; p['toe' + s] = {'x': -a * 0.8}
    return p
VAELS = {
    # 1 · la Lyre : très grande et fine, long cou, crâne étiré en crête, sur la pointe des pieds, longue queue
    'vael-1': ({'targets': {T('male', 'young', 'minmuscle', 'minweight'): 1.3}, 'flatChest': 1.0,
                'head': {'noEars': True, 'noNose': 0.9, 'eyes': 1.35, 'cranium': (1.1, 0.9, 0.15), 'crest': 0.55, 'jaw': 0.72},
                'scale': {'neck': (1.9, 0.75), 'armL': (1.12, 0.82), 'armR': (1.12, 0.82), 'foreL': (1.18, 0.8), 'foreR': (1.18, 0.8), 'handL': (1.3, 0.85), 'handR': (1.3, 0.85),
                          'thighL': (1.15, 0.82), 'thighR': (1.15, 0.82), 'shinL': (1.3, 0.75), 'shinR': (1.3, 0.75), 'footL': (1.9, 0.75), 'footR': (1.9, 0.75), 'chest': (1.0, 0.86), 'spine': (1.1, 0.8), 'hips': (1.0, 0.86)},
                'pose': {**ARMS(0.68), **tiptoe(1.1)}}, 2.2, {'tail': [0.95, 0.05]}),
    # 2 · le Faune : puissant et félin, jambes à talon relevé, museau court, grandes oreilles couchées, queue
    'vael-2': ({'targets': {T('male', 'young', 'maxmuscle', 'minweight'): 1.0}, 'flatChest': 1.0,
                'head': {'noEars': True, 'noNose': 0.7, 'eyes': 1.2, 'cranium': (1.0, 0.95, 0.1), 'snout': 0.5, 'jaw': 0.85},
                'scale': {'neck': (1.35, 0.95), 'armL': (1.05, 0.95), 'armR': (1.05, 0.95), 'foreL': (1.1, 0.92), 'foreR': (1.1, 0.92), 'thighL': (1.08, 1.02), 'thighR': (1.08, 1.02),
                          'shinL': (1.18, 0.85), 'shinR': (1.18, 0.85), 'footL': (1.6, 0.85), 'footR': (1.6, 0.85), 'chest': (1.0, 1.06), 'hips': (1.0, 0.9)},
                'pose': {**ARMS(0.6), **tiptoe(0.85)}}, 1.95, {'tail': [0.7, 0.07], 'ears': True}),
    # 3 · l'Oracle : grand crâne en dôme, deux paires d'yeux, très longs bras, pieds à plat, voûté
    'vael-3': ({'targets': {T('male', 'young', 'averagemuscle', 'minweight'): 1.2}, 'flatChest': 1.0,
                'head': {'noEars': True, 'noNose': 1.0, 'eyes': 1.15, 'cranium': (1.45, 1.12, 0.3), 'jaw': 0.7},
                'scale': {'neck': (1.4, 0.85), 'armL': (1.3, 0.85), 'armR': (1.3, 0.85), 'foreL': (1.35, 0.82), 'foreR': (1.35, 0.82), 'handL': (1.45, 0.88), 'handR': (1.45, 0.88),
                          'thighL': (1.05, 0.9), 'thighR': (1.05, 0.9), 'shinL': (1.1, 0.85), 'shinR': (1.1, 0.85), 'chest': (1.0, 0.92), 'spine': (1.05, 0.88)},
                'pose': {**ARMS(0.55), 'spine': {'x': 0.1}, 'neck': {'x': 0.12}, 'head': {'x': -0.12}}}, 2.0, {'fourEyes': True}),
}
for name, (base, h, extra) in VAELS.items():
    export(name, base, FACE, h, extra)
