import * as THREE from 'three';
import { Builder, bcyl, rbox, lathe } from '../robots/parts';
import * as M from '../robots/materials';

// Socles tournants et décor du showroom.

export class Pedestal extends THREE.Group {
  turntable = new THREE.Group();
  ringMat: THREE.MeshBasicMaterial;
  labelMat: THREE.MeshBasicMaterial;
  readonly topY = 0.2;
  constructor(letter: string, caption = `PROTOTYPE  ${letter}`) {
    super();
    const B = new Builder();
    const dark = M.steel(0x1c1e22, { rough: 0.5, wear: 0.1, scratches: 0.08, dirt: 0.2 });
    const satin = M.steel(0x3a3d43, { rough: 0.3, wear: 0.05 });
    const tread = M.treadPlate(0x34373c, 2.2);
    B.add(this, dark, bcyl(0.66, 0.05, 0.012, 72), [0, 0.025, 0]);
    B.add(this, satin, bcyl(0.6, 0.1, 0.02, 72), [0, 0.1, 0]);
    B.add(this, dark, lathe([[0.62, 0.0], [0.63, 0.005], [0.63, 0.015], [0.62, 0.02]], 72), [0, 0.05, 0]);
    // vis périphériques
    const head = M.steel(0x8c9097, { rough: 0.3 });
    const slot = M.rubber(0x050505);
    const list = [];
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; list.push({ p: [Math.sin(a) * 0.64, 0.051, Math.cos(a) * 0.64] as [number, number, number], r: [-Math.PI / 2, 0, 0] as [number, number, number] }); }
    B.screws(this, head, slot, list);
    // plateau tournant
    this.turntable.position.y = this.topY - 0.03;
    this.add(this.turntable);
    const top = new THREE.Mesh(bcyl(0.55, 0.035, 0.01, 72), tread);
    top.position.y = 0.0; top.receiveShadow = true; top.castShadow = true;
    this.turntable.add(top);
    B.add(this.turntable, satin, new THREE.TorusGeometry(0.552, 0.008, 10, 96), [0, 0.0, 0], [Math.PI / 2, 0, 0]);
    // anneau lumineux
    this.ringMat = M.glow(0x47d6ff, 1.6);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.605, 0.006, 10, 128), this.ringMat);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.145; this.add(ring);
    // plaque frontale
    B.add(this, dark, rbox(0.36, 0.075, 0.03, 0.01), [0, 0.1, 0.6], [0, 0, 0]);
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff'; g.font = '600 64px "Barlow Condensed", Arial Narrow, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(caption, 256, 68, 480);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    this.labelMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: new THREE.Color(0.6, 1.6, 2.2), depthWrite: false });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.075), this.labelMat);
    label.position.set(0, 0.1, 0.6155); this.add(label);
    B.build();
  }
  setFocus(f: number, t: number) {
    const k = 1.2 + f * (2.2 + Math.sin(t * 2.5) * 0.6);
    this.ringMat.color.setRGB(0.28, 0.84, 1).multiplyScalar(k);
    this.labelMat.color.setRGB(0.6, 1.6, 2.2).multiplyScalar(0.6 + f * 0.8);
  }
}

/** Cyclorama sombre en arc + bandes lumineuses verticales (donnent des reflets). */
export function createBackdrop() {
  const g = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x0b0d11, roughness: 0.85, metalness: 0.2 });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 9, 96, 1, true, Math.PI * 0.62, Math.PI * 0.76), wallMat);
  wall.material.side = THREE.BackSide;
  wall.position.set(0, 4.5, 2.0);
  wall.receiveShadow = true;
  g.add(wall);
  const strip = M.glow(0x3fa8d8, 1.35);
  const warm = M.glow(0xffb070, 0.9);
  for (let i = 0; i < 11; i++) {
    const a = Math.PI * 0.66 + (i / 10) * Math.PI * 0.68;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 5.5, 0.05), i % 5 === 2 ? warm : strip);
    m.position.set(Math.sin(a) * 10.85, 3.2, 2.0 + Math.cos(a) * 10.85);
    g.add(m);
  }
  // rail lumineux au sol le long du mur
  const rail = new THREE.Mesh(new THREE.TorusGeometry(10.7, 0.02, 8, 160, Math.PI * 0.76), M.glow(0x2f8fc0, 1.8));
  rail.rotation.x = Math.PI / 2; rail.rotation.z = -Math.PI * 0.88; rail.position.set(0, 0.03, 2.0);
  g.add(rail);
  return g;
}
