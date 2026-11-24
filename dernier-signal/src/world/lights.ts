import * as THREE from 'three';

// Réserve de lumières : un nombre FIXE de lumières ponctuelles est attribué en continu
// aux sources les plus proches du joueur. Le nombre ne change jamais → pas de recompilation
// des shaders, et des dizaines de néons peuvent « éclairer » sans coût.

export interface LightSource {
  pos: THREE.Vector3;
  color: THREE.Color;
  intensity: number;
  range: number;
  room: string;
  /** Niveau actuel 0-1 (piloté par l'énergie, les clignotements…). */
  level: number;
  kind?: 'neon' | 'emergency' | 'screen' | 'fire' | 'spark';
  phase: number;
}

export class LightPool {
  lights: THREE.PointLight[] = [];
  sources: LightSource[] = [];
  private assigned: (LightSource | null)[] = [];
  private fade: number[] = [];

  constructor(scene: THREE.Scene, count: number) {
    for (let i = 0; i < count; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 6, 2);
      l.castShadow = false;
      scene.add(l);
      this.lights.push(l);
      this.assigned.push(null);
      this.fade.push(0);
    }
  }

  add(pos: THREE.Vector3, color: THREE.ColorRepresentation, intensity: number, range: number, room: string, kind: LightSource['kind'] = 'neon', level = 1): LightSource {
    const s: LightSource = { pos: pos.clone(), color: new THREE.Color(color), intensity, range, room, level, kind, phase: Math.random() * 100 };
    this.sources.push(s);
    return s;
  }

  update(focus: THREE.Vector3, dt: number, visibleRooms: Set<string>) {
    const scored: { s: LightSource; v: number }[] = [];
    for (const s of this.sources) {
      if (s.level <= 0.01 || !visibleRooms.has(s.room)) continue;
      const d2 = s.pos.distanceToSquared(focus);
      scored.push({ s, v: (s.intensity * s.level) / (1 + d2 / (s.range * s.range)) });
    }
    scored.sort((a, b) => b.v - a.v);
    const want = new Set(scored.slice(0, this.lights.length).map((x) => x.s));
    // libérer les lumières dont la source n'est plus voulue (fondu sortant)
    for (let i = 0; i < this.lights.length; i++) {
      const a = this.assigned[i];
      if (a && !want.has(a)) { this.fade[i] = Math.max(0, this.fade[i] - dt * 4); if (this.fade[i] === 0) this.assigned[i] = null; }
      else if (a) { want.delete(a); this.fade[i] = Math.min(1, this.fade[i] + dt * 3); }
    }
    for (const s of want) {
      const i = this.assigned.findIndex((a) => a === null);
      if (i < 0) break;
      this.assigned[i] = s; this.fade[i] = 0;
    }
    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i], s = this.assigned[i];
      if (!s) { l.intensity = 0; continue; }
      l.position.copy(s.pos); l.color.copy(s.color); l.distance = s.range * 2.2;
      l.intensity = s.intensity * s.level * this.fade[i];
    }
  }
}
