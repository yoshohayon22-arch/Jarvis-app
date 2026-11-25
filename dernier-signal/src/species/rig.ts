import * as THREE from 'three';
import type { Joint, Body } from './sdf';

// Squelettes (bipède, quadrupède) et animations procédurales : repos qui respire,
// marche, course, et postures d'émotion qui se mélangent en douceur.

type V3 = [number, number, number];

export interface BipedSpec {
  H: number;               // taille (m)
  legs: 'plante' | 'digitigrade';
  hipW: number; shW: number;
  arm: number;             // longueur du bras (fraction de H)
  neck: number;            // longueur du cou (m)
  lean?: number;           // buste penché vers l'avant (m)
}

export function bipedJoints(s: BipedSpec) {
  const H = s.H, hipY = H * (s.legs === 'digitigrade' ? 0.5 : 0.49);
  const chestY = hipY + 0.22 * H, shY = hipY + 0.285 * H, neckY = hipY + 0.31 * H;
  const lean = s.lean ?? 0;
  const J: Joint[] = [
    { name: 'hips', parent: null, p: [0, hipY, 0] },
    { name: 'spine', parent: 'hips', p: [0, hipY + 0.1 * H, -0.015 + lean * 0.4] },
    { name: 'chest', parent: 'spine', p: [0, chestY, lean * 0.8] },
    { name: 'neck', parent: 'chest', p: [0, neckY, 0.01 + lean] },
    { name: 'head', parent: 'neck', p: [0, neckY + s.neck, 0.04 + lean * 1.3] },
  ];
  const up = s.arm * H * 0.47, fo = s.arm * H * 0.43;
  for (const [n, x] of [['L', 1], ['R', -1]] as const) {
    J.push(
      { name: 'clav' + n, parent: 'chest', p: [x * 0.03, shY - 0.01, lean * 0.9] },
      { name: 'arm' + n, parent: 'clav' + n, p: [x * s.shW, shY, lean * 0.9 - 0.01] },
      { name: 'fore' + n, parent: 'arm' + n, p: [x * (s.shW + 0.05), shY - up, lean * 0.6 - 0.03] },
      { name: 'hand' + n, parent: 'fore' + n, p: [x * (s.shW + 0.08), shY - up - fo, lean * 0.6 + 0.03] },
      { name: 'thigh' + n, parent: 'hips', p: [x * s.hipW, hipY, 0] },
    );
    if (s.legs === 'plante') J.push(
      { name: 'shin' + n, parent: 'thigh' + n, p: [x * s.hipW * 0.95, hipY * 0.52, 0.025] },
      { name: 'foot' + n, parent: 'shin' + n, p: [x * s.hipW * 0.9, 0.085, -0.02] },
      { name: 'toe' + n, parent: 'foot' + n, p: [x * s.hipW * 0.9, 0.03, 0.14] },
    );
    else J.push(
      { name: 'shin' + n, parent: 'thigh' + n, p: [x * s.hipW, hipY * 0.6, 0.13] },
      { name: 'foot' + n, parent: 'shin' + n, p: [x * s.hipW * 0.95, hipY * 0.24, -0.1] },
      { name: 'toe' + n, parent: 'foot' + n, p: [x * s.hipW * 0.95, 0.035, 0.07] },
    );
  }
  const P = Object.fromEntries(J.map((j) => [j.name, j.p])) as Record<string, V3>;
  return { joints: J, P, hipY };
}

export interface QuadSpec { L: number; hip: number; sh: number; w: number; neck: number; neckRise: number; tail: number; tailDrop?: number }

export function quadJoints(s: QuadSpec) {
  const z0 = -s.L / 2, z1 = s.L / 2;
  const J: Joint[] = [
    { name: 'pelvis', parent: null, p: [0, s.hip, z0] },
    { name: 'spine', parent: 'pelvis', p: [0, (s.hip + s.sh) / 2 + 0.02, 0] },
    { name: 'chest', parent: 'spine', p: [0, s.sh, z1 * 0.85] },
    { name: 'neck', parent: 'chest', p: [0, s.sh + 0.03, z1 + 0.02] },
    { name: 'head', parent: 'neck', p: [0, s.sh + s.neckRise, z1 + s.neck] },
  ];
  let prev = 'pelvis';
  for (let i = 1; i <= 4; i++) {
    const f = i / 4;
    J.push({ name: 'tail' + i, parent: prev, p: [0, s.hip - (s.tailDrop ?? 0.12) * f * f - 0.02, z0 - s.tail * (i - 1) / 4 - 0.04] });
    prev = 'tail' + i;
  }
  for (const [n, x] of [['L', 1], ['R', -1]] as const) {
    J.push(
      { name: 'sh' + n, parent: 'chest', p: [x * s.w, s.sh - 0.04, z1 * 0.82] },
      { name: 'elb' + n, parent: 'sh' + n, p: [x * s.w * 1.05, s.sh * 0.55, z1 * 0.72] },
      { name: 'wri' + n, parent: 'elb' + n, p: [x * s.w * 1.05, s.sh * 0.14, z1 * 0.8] },
      { name: 'paw' + n, parent: 'wri' + n, p: [x * s.w * 1.05, 0.025, z1 * 0.8 + 0.05] },
      { name: 'hip' + n, parent: 'pelvis', p: [x * s.w * 0.95, s.hip - 0.04, z0 + 0.04] },
      { name: 'knee' + n, parent: 'hip' + n, p: [x * s.w, s.hip * 0.58, z0 + 0.17] },
      { name: 'hock' + n, parent: 'knee' + n, p: [x * s.w, s.hip * 0.27, z0 - 0.06] },
      { name: 'hpaw' + n, parent: 'hock' + n, p: [x * s.w, 0.025, z0 - 0.01] },
    );
  }
  const P = Object.fromEntries(J.map((j) => [j.name, j.p])) as Record<string, V3>;
  return { joints: J, P };
}

// ---------- animation ----------
export type Action = 'repos' | 'marche' | 'course';
export type Emotion = 'calme' | 'colere' | 'joie' | 'tristesse' | 'respect' | 'menace';

interface Posture { spine: number; chest: number; neck: number; head: number; armOut: number; armFwd: number; bounce: number; crouch: number }
const POSTURE: Record<Emotion, Posture> = {
  calme: { spine: 0, chest: 0, neck: 0, head: 0, armOut: 0, armFwd: 0, bounce: 0, crouch: 0 },
  colere: { spine: 0.12, chest: 0.08, neck: 0.1, head: 0.12, armOut: 0.22, armFwd: -0.1, bounce: 0, crouch: 0.15 },
  joie: { spine: -0.06, chest: -0.06, neck: -0.08, head: -0.16, armOut: 0.1, armFwd: 0, bounce: 1, crouch: 0 },
  tristesse: { spine: 0.18, chest: 0.12, neck: 0.22, head: 0.3, armOut: -0.04, armFwd: -0.05, bounce: 0, crouch: 0.08 },
  respect: { spine: 0.32, chest: 0.12, neck: 0.15, head: 0.25, armOut: -0.12, armFwd: -0.45, bounce: 0, crouch: 0.05 },
  menace: { spine: 0.08, chest: 0.12, neck: 0.25, head: 0.2, armOut: 0.2, armFwd: 0, bounce: 0, crouch: 0.6 },
};

interface AnimState { phase: number; walk: number; run: number; post: Posture; t: number; look: number; lookT: number }

function st(body: Body): AnimState {
  return (body.mesh.userData.anim ??= { phase: 0, walk: 0, run: 0, post: { ...POSTURE.calme }, t: 0, look: 0, lookT: 0 });
}
function blendPosture(s: AnimState, e: Emotion, k: number) {
  const target = POSTURE[e];
  for (const key of Object.keys(target) as (keyof Posture)[]) s.post[key] += (target[key] - s.post[key]) * k;
}
const R = (b: THREE.Bone | undefined, x: number, y = 0, z = 0) => { if (b) b.rotation.set(x, y, z); };

export function animateBiped(body: Body, action: Action, emotion: Emotion, dt: number, digi: boolean) {
  const s = st(body), B = body.bones;
  s.t += dt;
  const k = 1 - Math.exp(-dt * 4);
  s.walk += ((action === 'repos' ? 0 : 1) - s.walk) * k;
  s.run += ((action === 'course' ? 1 : 0) - s.run) * k;
  blendPosture(s, emotion, 1 - Math.exp(-dt * 3));
  const freq = 1.75 + s.run * 1.3;
  s.phase += dt * Math.PI * 2 * freq * Math.max(0.15, s.walk) * (s.walk > 0.02 ? 1 : 0);
  const p = s.phase, w = s.walk, r = s.run, P = s.post;
  // regard qui se promène au repos
  s.lookT -= dt; if (s.lookT < 0) { s.lookT = 1.8 + Math.random() * 3; s.look = (Math.random() - 0.5) * 0.9; }
  const lookY = THREE.MathUtils.lerp(0, 1, 1 - w) * s.look;
  const breath = Math.sin(s.t * 1.6) * 0.025;
  const bounce = P.bounce * Math.abs(Math.sin(s.t * 4.2)) * 0.035 * (1 - w);
  // bassin
  const hips = B.hips, restY = body.rest.hips.y;
  hips.position.y = restY - P.crouch * 0.08 - w * (0.02 + r * 0.04) + w * Math.abs(Math.cos(p)) * (0.025 + r * 0.03) + bounce;
  hips.position.x = Math.sin(p) * 0.025 * w * (1 - r);
  R(hips, r * 0.12 + P.spine * 0.3, Math.sin(p) * 0.08 * w, Math.sin(p) * 0.04 * w);
  R(B.spine, P.spine * 0.6 + breath * 0.3 + r * 0.06, -Math.sin(p) * 0.12 * w, 0);
  R(B.chest, P.chest - breath, -Math.sin(p) * 0.06 * w + lookY * 0.2, 0);
  R(B.neck, P.neck - r * 0.1, lookY * 0.35, 0);
  R(B.head, P.head - r * 0.12 + Math.sin(s.t * 0.7) * 0.03 * (1 - w), lookY * 0.5, Math.sin(s.t * 0.5) * 0.04 * (1 - w));
  for (const [n, sg] of [['L', 1], ['R', -1]] as const) {
    const ph = p + (sg < 0 ? Math.PI : 0);
    const amp = 0.38 + r * 0.42;
    const thigh = -Math.sin(ph) * amp * w;
    const swing = Math.max(0, Math.cos(ph));
    const knee = w * (0.12 + swing * (0.75 + r * 0.6)) + P.crouch * 0.4;
    R(B['thigh' + n], thigh - P.crouch * 0.3, 0, sg * 0.02);
    R(B['shin' + n], (digi ? 1 : 1) * knee, 0, 0);
    R(B['foot' + n], -(thigh + knee) * 0.75 + w * Math.max(0, -Math.cos(ph)) * 0.35 * (digi ? -0.6 : 1), 0, 0);
    R(B['toe' + n], w * Math.max(0, Math.sin(ph)) * 0.3, 0, 0);
    // bras : balancement opposé aux jambes, ou posture d'émotion
    const arm = Math.sin(ph) * (0.3 + r * 0.55) * w;
    R(B['clav' + n], 0, 0, sg * (P.armOut * 0.2 - breath * 0.4));
    R(B['arm' + n], arm + P.armFwd + breath * 0.2, 0, sg * (0.1 + P.armOut + bounce * 2));
    R(B['fore' + n], -(0.25 + r * 0.9 + Math.max(0, -arm) * 0.4) + P.armFwd * 0.8, 0, 0);
    R(B['hand' + n], 0.1 + Math.sin(s.t * 1.1 + sg) * 0.04, 0, -sg * 0.1);
  }
}

export function animateQuad(body: Body, action: Action, emotion: Emotion, dt: number) {
  const s = st(body), B = body.bones;
  s.t += dt;
  const k = 1 - Math.exp(-dt * 4);
  s.walk += ((action === 'repos' ? 0 : 1) - s.walk) * k;
  s.run += ((action === 'course' ? 1 : 0) - s.run) * k;
  blendPosture(s, emotion, 1 - Math.exp(-dt * 3));
  const freq = 1.5 + s.run * 1.4;
  s.phase += dt * Math.PI * 2 * freq * (s.walk > 0.02 ? 1 : 0);
  const p = s.phase, w = s.walk, r = s.run, P = s.post;
  s.lookT -= dt; if (s.lookT < 0) { s.lookT = 1.5 + Math.random() * 2.5; s.look = (Math.random() - 0.5) * 1.0; }
  const lookY = (1 - w) * s.look;
  const breath = Math.sin(s.t * (2.2 + P.crouch * 3)) * 0.02;
  // galop : le dos se plie et se déplie
  const flex = Math.sin(p) * 0.14 * r;
  B.pelvis.position.y = body.rest.pelvis.y - P.crouch * 0.1 + w * Math.abs(Math.sin(p * (r > 0.5 ? 1 : 2))) * (0.015 + r * 0.04);
  R(B.pelvis, flex * 0.6 + P.crouch * 0.05, Math.sin(p) * 0.05 * w * (1 - r), 0);
  R(B.spine, -flex - breath, Math.sin(p) * 0.04 * w * (1 - r), 0);
  R(B.chest, flex * 0.5 + breath + P.crouch * 0.12, 0, 0);
  R(B.neck, P.neck + r * 0.15 + Math.sin(p * 2) * 0.04 * w, lookY * 0.5, 0);
  R(B.head, P.head - r * 0.1 - Math.sin(p * 2) * 0.05 * w, lookY * 0.5, Math.sin(s.t * 0.6) * 0.05 * (1 - w));
  for (let i = 1; i <= 4; i++) R(B['tail' + i], -0.05 + Math.sin(p * 0.5 - i * 0.6) * 0.04 * (1 - r) + (P.crouch > 0.3 ? 0.08 : -0.03) - r * 0.05, Math.sin(s.t * (1.2 + w * 2) - i * 0.7) * (0.18 + w * 0.1), 0);
  const legs: [string, string, string, string, number][] = r > 0.5
    ? [['shL', 'elbL', 'wriL', 'pawL', 0], ['shR', 'elbR', 'wriR', 'pawR', 0.12], ['hipL', 'kneeL', 'hockL', 'hpawL', 0.55], ['hipR', 'kneeR', 'hockR', 'hpawR', 0.65]]
    : [['shL', 'elbL', 'wriL', 'pawL', 0], ['shR', 'elbR', 'wriR', 'pawR', 0.5], ['hipL', 'kneeL', 'hockL', 'hpawL', 0.75], ['hipR', 'kneeR', 'hockR', 'hpawR', 0.25]];
  for (const [a, b, c, d, off] of legs) {
    const ph = p + off * Math.PI * 2;
    const front = a.startsWith('sh');
    const amp = (0.35 + r * 0.45) * w;
    const up = -Math.sin(ph) * amp;
    const swing = Math.max(0, Math.cos(ph)) * w;
    if (front) {
      R(B[a], up - P.crouch * 0.25, 0, 0);
      R(B[b], -swing * (0.9 + r * 0.5) + P.crouch * 0.5, 0, 0);
      R(B[c], swing * (1.1 + r * 0.6) - up * 0.4, 0, 0);
      R(B[d], -swing * 0.4, 0, 0);
    } else {
      R(B[a], up + P.crouch * 0.35, 0, 0);
      R(B[b], swing * (0.8 + r * 0.4) - P.crouch * 0.4, 0, 0);
      R(B[c], -swing * (1.0 + r * 0.5) + P.crouch * 0.3 - up * 0.3, 0, 0);
      R(B[d], swing * 0.5, 0, 0);
    }
  }
}
