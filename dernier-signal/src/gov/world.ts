// Monde 3D du prototype : terrain, balise, forêt sacrée, lac, bâtiments, habitants.
// Volontairement simple (formes stylisées), le réalisme viendra après validation du gameplay.
import * as THREE from 'three';
import { BUILDINGS, GROUPS, type BuildingId, type GroupId } from './content';
import { GROVE, BEACON, LAKE, MAP, type Building, type Citizen, type Sim } from './sim';

export function heightAt(x: number, z: number) {
  let h = 1.1 * Math.sin(x * 0.05) * Math.cos(z * 0.045) + 0.5 * Math.sin(x * 0.13 + z * 0.07) + 0.25 * Math.cos(z * 0.21 - x * 0.05);
  const dl = Math.hypot(x - LAKE.x, z - LAKE.z);
  if (dl < LAKE.r + 8) { const k = 1 - Math.max(0, (dl - LAKE.r * 0.5) / (LAKE.r * 0.5 + 8)); h -= 3.2 * k * k * (3 - 2 * k); }
  const db = Math.hypot(x - BEACON.x, z - BEACON.z);
  if (db < 10) h = h * (db / 10) + 0.4 * (1 - db / 10);
  // falaises au bord de la vallée
  const e = Math.max(Math.abs(x), Math.abs(z)) - (MAP - 14);
  if (e > 0) h += e * e * 0.12 + Math.sin(x * 0.3 + z * 0.2) * e * 0.2;
  return h;
}

const glowMat = (c: number, k = 2.5) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(c), emissiveIntensity: k, roughness: 1 });

export class World {
  root = new THREE.Group();
  terrain: THREE.Mesh;
  water: THREE.Mesh;
  sun = new THREE.DirectionalLight(0xffe2c0, 2);
  hemi = new THREE.HemisphereLight(0x8fb0c8, 0x10140f, 0.5);
  stars: THREE.Points;
  moons = new THREE.Group();
  beaconVeins: THREE.MeshStandardMaterial;
  beaconLight = new THREE.PointLight(0xa070ff, 30, 40, 1.6);
  plantGlow: THREE.MeshStandardMaterial[] = [];
  buildingMeshes = new Map<number, THREE.Group>();
  agents = new Map<number, Agent>();
  fires: THREE.PointLight[] = [];
  r12?: THREE.Object3D;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene, shadows: boolean) {
    this.scene = scene;
    scene.add(this.root);
    // terrain
    const N = 140, S = MAP * 2 + 20;
    const g = new THREE.PlaneGeometry(S, S, N, N); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = heightAt(x, z);
      pos.setY(i, h);
      const rock = Math.max(0, Math.min(1, (Math.max(Math.abs(x), Math.abs(z)) - (MAP - 16)) / 8));
      const grove = Math.max(0, 1 - Math.hypot(x - GROVE.x, z - GROVE.z) / (GROVE.r + 4));
      const n = 0.5 + 0.5 * Math.sin(x * 0.7) * Math.cos(z * 0.6);
      c.setRGB(0.075 + n * 0.03, 0.12 + n * 0.04 + grove * 0.05, 0.095 + grove * 0.06).lerp(new THREE.Color(0.11, 0.1, 0.1), rock);
      if (h < -1.2) c.lerp(new THREE.Color(0.04, 0.05, 0.05), 0.6);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    this.terrain = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
    this.terrain.receiveShadow = true;
    this.root.add(this.terrain);
    // lac
    this.water = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r + 4, 64), new THREE.MeshStandardMaterial({ color: 0x04121a, roughness: 0.06, metalness: 0.4 }));
    this.water.rotation.x = -Math.PI / 2; this.water.position.set(LAKE.x, -1.35, LAKE.z);
    this.root.add(this.water);
    // lumières
    this.sun.castShadow = shadows;
    this.sun.shadow.mapSize.setScalar(1024);
    const sc = this.sun.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 10; sc.far = 260;
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target, this.hemi);
    // ciel nocturne
    const sp = new Float32Array(2400 * 3);
    for (let i = 0; i < 2400; i++) { const v = new THREE.Vector3().randomDirection(); v.y = Math.abs(v.y) * 0.95 + 0.05; v.normalize().multiplyScalar(600); sp.set([v.x, v.y, v.z], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    scene.add(this.stars);
    for (const [x, y, z, r, col2] of [[-260, 220, -380, 26, 0xdfe6ff], [180, 160, -420, 14, 0xffd9c8]] as const) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16), new THREE.MeshBasicMaterial({ color: col2, fog: false, transparent: true }));
      m.position.set(x, y, z); this.moons.add(m);
    }
    scene.add(this.moons);
    // balise
    const obsidian = new THREE.MeshStandardMaterial({ color: 0x0b0c10, roughness: 0.22, metalness: 0.6 });
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 2.6, 16, 6), obsidian);
    spire.position.set(BEACON.x, heightAt(0, 0) + 8, BEACON.z); spire.castShadow = true; this.root.add(spire);
    this.beaconVeins = glowMat(0x9a6bff, 3);
    for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(2.3 - i * 0.38, 0.05, 6, 6), this.beaconVeins); t.rotation.x = Math.PI / 2; t.position.set(0, heightAt(0, 0) + 1.5 + i * 3, 0); this.root.add(t); }
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2, r = 4 + (i % 3);
      const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.5 + (i % 2) * 0.4, 0), new THREE.MeshStandardMaterial({ color: 0x1a1030, emissive: 0x7b4dff, emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.2 }));
      cr.position.set(Math.cos(a) * r, heightAt(Math.cos(a) * r, Math.sin(a) * r) + 0.4, Math.sin(a) * r); cr.scale.y = 2; cr.rotation.set(0.2 * i, i, 0.3);
      this.root.add(cr);
    }
    this.beaconLight.position.set(0, heightAt(0, 0) + 6, 0); this.root.add(this.beaconLight);
    // forêt sacrée : arbres-mères
    const bark = new THREE.MeshStandardMaterial({ color: 0x12100e, roughness: 0.9 });
    const canopy = new THREE.MeshStandardMaterial({ color: 0x07140f, emissive: 0x1fd3a0, emissiveIntensity: 0.6, roughness: 0.8 });
    this.plantGlow.push(canopy);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4, r = (i % 3) * 5 + 3;
      const x = GROVE.x + Math.cos(a) * r, z = GROVE.z + Math.sin(a) * r, h = heightAt(x, z), s = 1 + (i % 3) * 0.35;
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * s, 0.8 * s, 9 * s, 8), bark); tr.position.set(x, h + 4.5 * s, z); tr.castShadow = true; this.root.add(tr);
      for (let k = 0; k < 4; k++) { const cn = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2 * s - k * 0.3, 1), canopy); cn.position.set(x + Math.sin(k * 2.1) * 1.6 * s, h + 8.5 * s + k * 0.9, z + Math.cos(k * 2.1) * 1.6 * s); cn.castShadow = true; this.root.add(cn); }
    }
    // végétation bioluminescente dispersée (instanciée)
    const pg = new THREE.ConeGeometry(0.18, 0.9, 5);
    for (const [colr, count] of [[0x2cffb0, 260], [0xb25cff, 140]] as const) {
      const m = glowMat(colr, 1.2); this.plantGlow.push(m);
      const im = new THREE.InstancedMesh(pg, m, count); const mm = new THREE.Matrix4();
      let n = 0;
      for (let i = 0; i < count * 3 && n < count; i++) {
        const nearGrove = Math.random() < 0.45;
        const x = nearGrove ? GROVE.x + (Math.random() - 0.5) * GROVE.r * 2.4 : (Math.random() - 0.5) * MAP * 1.8;
        const z = nearGrove ? GROVE.z + (Math.random() - 0.5) * GROVE.r * 2.4 : (Math.random() - 0.5) * MAP * 1.8;
        if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 1 || Math.hypot(x, z) < 8) continue;
        const s = 0.5 + Math.random() * 1.2;
        mm.compose(new THREE.Vector3(x, heightAt(x, z) + 0.4 * s, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4)), new THREE.Vector3(s, s, s));
        im.setMatrixAt(n++, mm);
      }
      im.count = n; this.root.add(im);
    }
    // épaves près du camp des Forgés
    const rust = new THREE.MeshStandardMaterial({ color: 0x4a3a30, roughness: 0.75, metalness: 0.55 });
    const white = new THREE.MeshStandardMaterial({ color: 0xbfbcb5, roughness: 0.5, metalness: 0.3 });
    const cap = new THREE.Mesh(new THREE.LatheGeometry([[0, 2.4], [0.7, 2.2], [1.25, 1.2], [1.4, 0.2], [1.35, 0], [0, 0]].map(([a, b]) => new THREE.Vector2(a, b)), 24), white);
    cap.position.set(26, heightAt(26, -2) - 0.3, -2); cap.rotation.set(0.5, 0.3, 1.1); cap.castShadow = true; this.root.add(cap);
    for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(3 + i % 3, 0.25, 2 + (i % 2) * 2), rust); const x = 22 + (i % 3) * 3.5, z = -16 + Math.floor(i / 3) * 4.5; p.position.set(x, heightAt(x, z) + 0.4, z); p.rotation.set(0.3 * i, i, 0.5); p.castShadow = true; this.root.add(p); }
  }

  /** Lumière du jour et de la nuit : h = heure (0-24), night = longue nuit en cours. */
  setTime(h: number, longNight: boolean, t: number, target: THREE.Vector3) {
    const dayK = longNight ? 0 : Math.max(0, Math.sin(((h - 6) / 14) * Math.PI));
    const night = 1 - Math.min(1, dayK * 1.6);
    const a = ((h - 6) / 14) * Math.PI;
    this.sun.position.set(target.x + Math.cos(a) * 80, 20 + Math.max(0.15, Math.sin(a)) * 90, target.z + 40);
    this.sun.target.position.copy(target);
    this.sun.color.setRGB(1, 0.82 + dayK * 0.12, 0.7 + dayK * 0.2).lerp(new THREE.Color(0.55, 0.65, 1), night);
    this.sun.intensity = 0.45 + dayK * 3.6;
    this.hemi.intensity = 0.3 + dayK * 1.0;
    this.hemi.color.setRGB(0.35, 0.45, 0.6).lerp(new THREE.Color(0.55, 0.7, 0.8), dayK);
    const bg = new THREE.Color(0.012, 0.018, 0.04).lerp(new THREE.Color(0.13, 0.19, 0.25), dayK);
    (this.scene.background as THREE.Color).copy(bg);
    (this.scene.fog as THREE.Fog).color.copy(bg);
    (this.stars.material as THREE.PointsMaterial).opacity = night * 0.9;
    for (const m of this.moons.children) ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.25 + night * 0.75;
    this.stars.position.copy(target); this.moons.position.copy(target);
    for (const m of this.plantGlow) m.emissiveIntensity = (m === this.plantGlow[0] ? 0.35 : 0.7) + night * 1.6;
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.3);
    this.beaconVeins.emissiveIntensity = 1.5 + pulse * 2.5;
    this.beaconLight.intensity = 10 + night * 40 + pulse * 10;
    for (const f of this.fires) f.intensity = (6 + night * 18) * (0.85 + Math.random() * 0.3);
  }

  // ---------- bâtiments ----------
  makeBuilding(def: BuildingId): THREE.Group {
    const d = BUILDINGS[def];
    const g = new THREE.Group(); const body = new THREE.Group(); body.name = 'body'; g.add(body);
    const metal = new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.55, metalness: 0.7 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x24272b, roughness: 0.6, metalness: 0.6 });
    const weave = new THREE.MeshStandardMaterial({ color: 0x3a3424, roughness: 0.95 });
    const leaf = new THREE.MeshStandardMaterial({ color: 0x14261c, roughness: 0.9 });
    const cy = glowMat(0x5fe6ff, 2.6), gr = glowMat(0x7dffb0, 2.2), gold = glowMat(0xffc860, 2.4);
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true; body.add(m); return m; };
    switch (def) {
      case 'generateur': add(new THREE.CylinderGeometry(1.2, 1.4, 2.6, 12), metal, 0, 1.3, 0); add(new THREE.TorusGeometry(1.25, 0.08, 6, 24), cy, 0, 2.2, 0, Math.PI / 2); add(new THREE.TorusGeometry(1.3, 0.08, 6, 24), cy, 0, 1.0, 0, Math.PI / 2); add(new THREE.CylinderGeometry(0.2, 0.2, 1.4, 8), dark, 0.7, 3.2, 0); break;
      case 'atelier': add(new THREE.BoxGeometry(3.6, 2, 3), metal, 0, 1, 0); add(new THREE.BoxGeometry(3.9, 0.15, 3.3), dark, 0, 2.1, 0, 0, 0, 0.08); add(new THREE.BoxGeometry(1.4, 1.4, 0.05), cy, 0, 0.9, 1.53); add(new THREE.BoxGeometry(0.2, 3.2, 0.2), dark, 1.6, 1.6, -1.2); add(new THREE.BoxGeometry(2.4, 0.15, 0.15), dark, 0.6, 3.2, -1.2); break;
      case 'abri': add(new THREE.CylinderGeometry(1.4, 1.4, 2.8, 14, 1, false, 0, Math.PI), metal, 0, 0, 0, 0, 0, Math.PI / 2).position.y = 0.05; add(new THREE.BoxGeometry(0.06, 0.5, 0.9), cy, 1.41, 0.6, 0); break;
      case 'foreuse': { add(new THREE.CylinderGeometry(0.15, 0.15, 4.2, 6), dark, -0.8, 2.1, -0.8); add(new THREE.CylinderGeometry(0.15, 0.15, 4.2, 6), dark, 0.8, 2.1, -0.8); add(new THREE.CylinderGeometry(0.15, 0.15, 4.2, 6), dark, 0, 2.1, 0.9); const dr = add(new THREE.ConeGeometry(0.5, 1.6, 8), metal, 0, 1.2, 0, Math.PI); dr.name = 'drill'; add(new THREE.SphereGeometry(0.25, 12, 8), glowMat(0xb07bff, 3), 0, 4.3, 0); break; }
      case 'hutte': add(new THREE.ConeGeometry(1.5, 2.6, 9, 1, true), weave, 0, 1.3, 0); add(new THREE.ConeGeometry(1.55, 1.2, 9, 1, true), leaf, 0, 2.2, 0); add(new THREE.SphereGeometry(0.18, 10, 8), gr, 0, 2.75, 0); add(new THREE.BoxGeometry(0.6, 1, 0.05), gold, 0, 0.5, 1.22); break;
      case 'jardin': for (let i = 0; i < 14; i++) { const x = (i % 5 - 2) * 0.9, z = (Math.floor(i / 5) - 1) * 1.2; add(new THREE.SphereGeometry(0.25 + (i % 3) * 0.08, 8, 6), i % 2 ? gr : gold, x, 0.3, z); } add(new THREE.BoxGeometry(5, 0.12, 4), leaf, 0, 0.06, 0); break;
      case 'source': add(new THREE.TorusGeometry(1, 0.3, 6, 12), new THREE.MeshStandardMaterial({ color: 0x2a2c2a, roughness: 0.9 }), 0, 0.25, 0, Math.PI / 2); add(new THREE.CircleGeometry(0.85, 20), new THREE.MeshStandardMaterial({ color: 0x0a2430, roughness: 0.05, metalness: 0.3, emissive: 0x0a4060, emissiveIntensity: 0.6 }), 0, 0.3, 0, -Math.PI / 2); add(new THREE.CylinderGeometry(0.1, 0.1, 1.4, 6), metal, 1.1, 0.7, 0); break;
      case 'guerisseur': add(new THREE.SphereGeometry(1.4, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), weave, 0, 0, 0); add(new THREE.SphereGeometry(0.3, 10, 8), gold, 0, 1.55, 0); add(new THREE.BoxGeometry(0.6, 0.9, 0.05), gr, 0, 0.45, 1.36); break;
      case 'feu': { for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; add(new THREE.DodecahedronGeometry(0.35, 0), new THREE.MeshStandardMaterial({ color: 0x3a3836, roughness: 0.9 }), Math.cos(a) * 1.6, 0.2, Math.sin(a) * 1.6); } add(new THREE.ConeGeometry(0.5, 1.2, 7), glowMat(0xff8a30, 4), 0, 0.6, 0); const pl = new THREE.PointLight(0xff9a40, 14, 18, 1.6); pl.position.y = 1.4; body.add(pl); this.fires.push(pl); break; }
    }
    void d; void GROUPS;
    return g;
  }

  addBuilding(b: Building) {
    const g = this.makeBuilding(b.def);
    g.position.set(b.x, heightAt(b.x, b.z), b.z); g.rotation.y = b.rot;
    g.userData.id = b.id;
    // échafaudage pendant la construction
    const d = BUILDINGS[b.def];
    const sc = new THREE.Mesh(new THREE.BoxGeometry(d.size, d.height, d.size), new THREE.MeshBasicMaterial({ color: 0xffd36a, wireframe: true, transparent: true, opacity: 0.5 }));
    sc.position.y = d.height / 2; sc.name = 'scaffold'; g.add(sc);
    this.root.add(g); this.buildingMeshes.set(b.id, g);
    return g;
  }
  syncBuildings(sim: Sim, t: number) {
    for (const b of sim.buildings) {
      const g = this.buildingMeshes.get(b.id) ?? this.addBuilding(b);
      const body = g.getObjectByName('body')!; const sc = g.getObjectByName('scaffold')!;
      body.scale.y = 0.08 + 0.92 * b.progress; sc.visible = b.progress < 1;
      body.rotation.z = b.damaged ? 0.18 : 0; body.position.y = b.damaged ? -0.25 : 0;
      const drill = g.getObjectByName('drill'); if (drill && !b.damaged && b.staffed) drill.rotation.y = t * 6;
    }
  }

  // ---------- habitants ----------
  syncAgents(sim: Sim, dt: number, t: number, speed: number, emotion: Record<GroupId, number>) {
    const alive = new Set<number>();
    for (const c of sim.citizens) {
      alive.add(c.id);
      let a = this.agents.get(c.id);
      if (!a) { a = new Agent(c, this.root); this.agents.set(c.id, a); const home = sim.buildings.find((b) => b.id === c.home); if (home) a.obj.position.set(home.x + (Math.random() - 0.5) * 3, 0, home.z + (Math.random() - 0.5) * 3); }
      a.update(sim, c, dt, t, speed, emotion[c.group]);
    }
    for (const [id, a] of this.agents) if (!alive.has(id)) { a.obj.removeFromParent(); this.agents.delete(id); }
  }
}

/** Habitant : un petit Forgé ou un Vaël stylisé (motifs lumineux selon l'émotion). */
class Agent {
  obj = new THREE.Group();
  private target = new THREE.Vector3();
  private retarget = 0;
  private glow: THREE.MeshStandardMaterial;
  private group: GroupId;
  constructor(c: Citizen, parent: THREE.Object3D) {
    this.group = c.group;
    if (c.group === 'forges') {
      const big = c.name === 'Ancre' ? 1.3 : 1;
      const m = new THREE.MeshStandardMaterial({ color: 0x6d7076, roughness: 0.5, metalness: 0.7 });
      this.glow = glowMat(0x5fe6ff, 3);
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.38), m); b.position.y = 0.55; b.castShadow = true;
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.34), m); h.position.y = 0.98; h.castShadow = true;
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.02), this.glow); e.position.set(0, 1.0, 0.18);
      for (const x of [-0.14, 0.14]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.32, 0.14), m); l.position.set(x, 0.16, 0); l.name = 'leg'; this.obj.add(l); }
      this.obj.add(b, h, e); this.obj.scale.setScalar(big);
    } else {
      const skin = new THREE.MeshStandardMaterial({ color: 0x0f1614, roughness: 0.45, metalness: 0.05 });
      this.glow = glowMat(0x4fb6ff, 2.2);
      const big = c.name === 'Ysalé' ? 1.1 : 0.9 + Math.random() * 0.2;
      const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.85, 4, 10), skin); b.position.y = 0.95; b.castShadow = true;
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), skin); h.scale.set(0.9, 1.35, 1); h.position.y = 1.72; h.castShadow = true;
      for (const y of [0.75, 1.05, 1.35]) { const s = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.018, 4, 16), this.glow); s.rotation.x = Math.PI / 2 + 0.25; s.position.y = y; this.obj.add(s); }
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.02), this.glow); eye.position.set(0, 1.76, 0.15);
      for (const x of [-0.07, 0.07]) { const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.5, 3, 6), skin); l.position.set(x, 0.3, 0); l.name = 'leg'; this.obj.add(l); }
      this.obj.add(b, h, eye); this.obj.scale.setScalar(big);
    }
    this.obj.userData.citizen = c.id;
    parent.add(this.obj);
  }
  update(sim: Sim, c: Citizen, dt: number, t: number, speed: number, emo: number) {
    this.retarget -= dt * Math.max(0.5, speed);
    const workHours = c.group === 'forges' ? (sim.time >= sim.forgesStopUntil && !(sim.flags.reposNuit && !sim.isDay) && sim.loyal.forges > 15) : sim.isDay && sim.loyal.racines > 15;
    if (this.retarget <= 0) {
      this.retarget = 3 + Math.random() * 5;
      const job = sim.buildings.find((b) => b.id === c.job);
      const home = sim.buildings.find((b) => b.id === c.home);
      const fire = !sim.isDay ? sim.buildings.find((b) => b.def === 'feu' && b.progress >= 1) : undefined;
      const spot = workHours && job ? job : fire && Math.random() < 0.7 ? fire : home ?? job;
      const base = spot ? new THREE.Vector3(spot.x, 0, spot.z) : new THREE.Vector3(c.group === 'forges' ? 18 : -16, 0, c.group === 'forges' ? -8 : 8);
      const r = spot ? BUILDINGS[spot.def].size * 0.5 + 1.2 : 4;
      const a = Math.random() * Math.PI * 2;
      this.target.set(base.x + Math.cos(a) * r, 0, base.z + Math.sin(a) * r);
    }
    const p = this.obj.position;
    const d = new THREE.Vector3(this.target.x - p.x, 0, this.target.z - p.z);
    const dist = d.length();
    const v = (this.group === 'forges' ? 1.6 : 1.3) * Math.min(4, Math.max(speed, 0)) * dt;
    const moving = dist > 0.2 && speed > 0;
    if (moving) { d.normalize(); p.addScaledVector(d, Math.min(dist, v)); this.obj.rotation.y = Math.atan2(d.x, d.z); }
    p.y = heightAt(p.x, p.z);
    const legs = this.obj.children.filter((o) => o.name === 'leg');
    legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(t * 9 * Math.max(1, speed * 0.7) + i * Math.PI) * 0.5 : 0; });
    // émotion des Vaëls : bleu calme, rouge colère, or joie
    if (this.group === 'racines') {
      const calm = new THREE.Color(0x4fb6ff), anger = new THREE.Color(0xff3a28), joy = new THREE.Color(0xffc040);
      const col = emo < 0 ? calm.clone().lerp(anger, Math.min(1, -emo)) : calm.clone().lerp(joy, Math.min(1, emo));
      this.glow.emissive.copy(col);
      this.glow.emissiveIntensity = 1.6 + Math.sin(t * 3 + c.id) * 0.4 + (emo < -0.5 ? Math.sin(t * 12) * 0.6 : 0);
    } else {
      this.glow.emissiveIntensity = workHours ? 3 : 0.8;
    }
  }
}
