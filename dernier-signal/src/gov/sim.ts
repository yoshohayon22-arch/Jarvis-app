// Simulation du mode gouverneur (prototype) : ressources, habitants, relations, conseil.
// Une « heure de jeu » est l'unité de temps ; tout est sauvegardé en JSON.
import { BUILDINGS, DECISIONS, LATER, GROUPS, type BuildingId, type GroupId, type Res } from './content';

export interface Building { id: number; def: BuildingId; x: number; z: number; rot: number; progress: number; damaged: boolean; paused: boolean; staffed: number; }
export interface Citizen { id: number; group: GroupId; name: string; home: number | null; job: number | null; }
export type RelKey = 'confiance' | 'peur' | 'rancune' | 'dette';
export interface Note { text: string; sub?: string; crisis?: boolean; }

export const GROVE = { x: -40, z: 26, r: 17 };
export const BEACON = { x: 0, z: 0 };
export const LAKE = { x: 34, z: 30, r: 15 };
export const MAP = 80;

const FORGE_NAMES = ['Ancre', 'Rivet', 'Boulon', 'Étai', 'Clé', 'Soudure', 'Jante', 'Écrou', 'Alliage', 'Pivot', 'Grue', 'Tôle'];
const VAEL_NAMES = ['Ysalé', 'Ouren', 'Lysse', 'Tamé', 'Ivro', 'Sénia', 'Arhu', 'Néa', 'Ilvé', 'Moru', 'Kessa', 'Oria', 'Fénu', 'Liam', 'Sorr', 'Véla'];

export class Sim {
  time = 8;                      // heures écoulées (jour 1, 8 h)
  res: Record<Res, number> = { energie: 20, metal: 32, nourriture: 30, eau: 28, medicaments: 4, cristaux: 1 };
  delta: Record<Res, number> = { energie: 0, metal: 0, nourriture: 0, eau: 0, medicaments: 0, cristaux: 0 };
  /** ce que chaque groupe ressent envers l'autre */
  rel: Record<GroupId, Record<RelKey, number>> = {
    forges: { confiance: 35, peur: 10, rancune: 0, dette: 0 },
    racines: { confiance: 20, peur: 45, rancune: 5, dette: 0 },
  };
  loyal: Record<GroupId, number> = { forges: 80, racines: 45 };
  moral: Record<GroupId, number> = { forges: 65, racines: 55 };
  prodMul = { forges: 1, jardin: 1 };
  flags: Record<string, boolean> = {};
  buildings: Building[] = [];
  citizens: Citizen[] = [];
  nextId = 1;
  decisions: Record<string, string> = {};
  pending: { day: number; key: string }[] = [];
  forgesStopUntil = 0;
  longNightUntil = 0;
  tension = 0; paix = 50;
  private tensionHours = 0;
  private growthAcc = 0;
  shortage: Partial<Record<Res, boolean>> = {};
  history: string[] = [];
  /** notifications à afficher (vidées par l'interface) */
  notes: Note[] = [];
  /** conséquence différée qui attend d'être montrée */
  laterQueue: string[] = [];

  static fresh() {
    const s = new Sim();
    const b = (def: BuildingId, x: number, z: number, rot = 0) => s.addBuilding(def, x, z, rot, true);
    b('generateur', 16, -6); b('abri', 21, -11, 0.4);
    b('hutte', -16, 8, 0.2); b('hutte', -21, 3, -0.5); b('jardin', -12, 14, 0.1);
    for (let i = 0; i < 3; i++) s.addCitizen('forges');
    for (let i = 0; i < 6; i++) s.addCitizen('racines');
    s.assignHomes();
    return s;
  }

  get day() { return Math.floor(this.time / 24) + 1; }
  get hour() { return this.time % 24; }
  get isDay() { const h = this.hour; return h >= 6 && h < 20 && this.time >= this.longNightUntil; }
  get season() { return this.time < this.longNightUntil ? 'Longue nuit' : 'Saison sèche'; }
  pop(g: GroupId) { return this.citizens.filter((c) => c.group === g).length; }
  capacity(g: GroupId) { return this.buildings.filter((b) => b.progress >= 1 && !b.damaged && BUILDINGS[b.def].group === g).reduce((a, b) => a + (BUILDINGS[b.def].capacity ?? 0), 0); }
  has(def: BuildingId) { return this.buildings.some((b) => b.def === def && b.progress >= 1); }
  mutual() { return (this.rel.forges.confiance + this.rel.racines.confiance) / 2; }
  unlocked(def: BuildingId) { return def !== 'feu' || this.mutual() >= 55; }

  addRel(from: GroupId, k: RelKey, v: number) { this.rel[from][k] = clamp(this.rel[from][k] + v); }

  addBuilding(def: BuildingId, x: number, z: number, rot: number, done = false) {
    const b: Building = { id: this.nextId++, def, x, z, rot, progress: done ? 1 : 0, damaged: false, paused: false, staffed: 0 };
    this.buildings.push(b);
    return b;
  }
  addCitizen(g: GroupId) {
    const used = new Set(this.citizens.map((c) => c.name));
    const pool = g === 'forges' ? FORGE_NAMES : VAEL_NAMES;
    const name = pool.find((n) => !used.has(n)) ?? `${pool[0]}-${this.nextId}`;
    const c: Citizen = { id: this.nextId++, group: g, name, home: null, job: null };
    this.citizens.push(c);
    return c;
  }
  assignHomes() {
    for (const g of ['forges', 'racines'] as GroupId[]) {
      const homes = this.buildings.filter((b) => b.progress >= 1 && !b.damaged && BUILDINGS[b.def].group === g && BUILDINGS[b.def].capacity);
      const load = new Map<number, number>();
      for (const c of this.citizens.filter((c) => c.group === g)) {
        const h = homes.find((b) => (load.get(b.id) ?? 0) < (BUILDINGS[b.def].capacity ?? 0));
        c.home = h ? h.id : null;
        if (h) load.set(h.id, (load.get(h.id) ?? 0) + 1);
      }
    }
  }
  assignJobs() {
    for (const c of this.citizens) c.job = null;
    for (const b of this.buildings) b.staffed = 0;
    for (const b of this.buildings) {
      const d = BUILDINGS[b.def];
      if (!d.workers || b.progress < 1 || b.damaged || b.paused || d.group === 'commun') continue;
      for (const c of this.citizens) {
        if (b.staffed >= d.workers) break;
        if (c.group === d.group && c.job === null) { c.job = b.id; b.staffed++; }
      }
    }
  }

  canAfford(def: BuildingId) { return Object.entries(BUILDINGS[def].cost).every(([r, v]) => this.res[r as Res] >= (v as number)); }
  pay(cost: Partial<Record<Res, number>>) { for (const [r, v] of Object.entries(cost)) this.res[r as Res] -= v as number; }

  /** Vérifie un emplacement ; renvoie un message d'erreur ou null. */
  placementIssue(def: BuildingId, x: number, z: number) {
    const d = BUILDINGS[def];
    if (Math.abs(x) > MAP - 6 || Math.abs(z) > MAP - 6) return 'Trop loin du camp';
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + d.size * 0.5) return 'Dans le lac';
    if (Math.hypot(x - BEACON.x, z - BEACON.z) < 6 + d.size * 0.5) return 'Trop près de la balise';
    if (d.nearBeacon && Math.hypot(x - BEACON.x, z - BEACON.z) > d.nearBeacon) return 'Doit être près de la balise';
    for (const b of this.buildings) { const o = BUILDINGS[b.def]; if (Math.hypot(b.x - x, b.z - z) < (o.size + d.size) * 0.5 + 0.6) return 'Trop près d\'un autre bâtiment'; }
    return null;
  }
  inGrove(x: number, z: number) { return Math.hypot(x - GROVE.x, z - GROVE.z) < GROVE.r; }

  build(def: BuildingId, x: number, z: number, rot: number) {
    this.pay(BUILDINGS[def].cost);
    const b = this.addBuilding(def, x, z, rot);
    if (this.inGrove(x, z) && BUILDINGS[def].group !== 'racines') {
      this.addRel('racines', 'rancune', 15); this.addRel('racines', 'confiance', -10); this.loyal.racines = clamp(this.loyal.racines - 8);
      this.notes.push({ text: 'Le Clan des Racines est en colère', sub: 'Vous avez bâti dans la forêt sacrée.', crisis: true });
    }
    this.history.push(`Jour ${this.day} : construction · ${BUILDINGS[def].name}`);
    return b;
  }
  buildForge() {
    if (this.res.metal < 15 || this.res.energie < 10 || this.pop('forges') >= this.capacity('forges')) return false;
    this.res.metal -= 15; this.res.energie -= 10;
    const c = this.addCitizen('forges'); this.assignHomes();
    this.notes.push({ text: `Nouveau Forgé : ${c.name}`, sub: 'Assemblé avec les pièces des épaves.' });
    return true;
  }
  repair(b: Building) { if (this.res.metal < 5) return false; this.res.metal -= 5; b.damaged = false; return true; }
  gift(g: GroupId) {
    if (this.res.cristaux < 1) return false;
    this.res.cristaux -= 1; this.loyal[g] = clamp(this.loyal[g] + 8); this.moral[g] = clamp(this.moral[g] + 5);
    return true;
  }

  schedule(day: number, key: string) { this.pending.push({ day, key }); }
  stopForges(h: number) { this.forgesStopUntil = Math.max(this.forgesStopUntil, this.time) + h; }
  damage(def: BuildingId) {
    const b = this.buildings.find((x) => x.def === def && x.progress >= 1 && !x.damaged) ?? this.buildings.find((x) => BUILDINGS[x.def].group === 'forges' && x.progress >= 1 && !x.damaged);
    if (b) b.damaged = true;
  }
  sickness(n: number) {
    if (this.res.medicaments >= n) { this.res.medicaments -= n; return; }
    const lost = Math.ceil((n - this.res.medicaments) / 4); this.res.medicaments = 0;
    for (let i = 0; i < lost; i++) {
      const idx = this.citizens.findIndex((c) => c.group === 'racines' && c.name !== 'Ysalé');
      if (idx >= 0) { this.notes.push({ text: `${this.citizens[idx].name} est mort de froid`, sub: 'Le clan porte le deuil.', crisis: true }); this.citizens.splice(idx, 1); }
    }
    this.moral.racines = clamp(this.moral.racines - 15);
  }

  /** Décision du conseil en attente (la plus ancienne non traitée). */
  dueDecision() { return DECISIONS.find((d) => !this.decisions[d.id] && (this.day > d.day || (this.day === d.day && this.hour >= 9))); }
  nextCouncil() { return DECISIONS.find((d) => !this.decisions[d.id]); }

  choose(decisionId: string, optionId: string) {
    const d = DECISIONS.find((x) => x.id === decisionId)!;
    const o = d.options.find((x) => x.id === optionId)!;
    o.apply(this);
    this.decisions[decisionId] = optionId;
    if (decisionId === 'nuit') this.longNightUntil = this.time + 60;
    for (const g of ['forges', 'racines'] as GroupId[]) this.loyal[g] = clamp(this.loyal[g]);
    for (const r of Object.keys(this.res) as Res[]) this.res[r] = Math.max(0, this.res[r]);
    this.history.push(`Jour ${this.day} · ${d.title} : ${o.label}`);
  }

  /** Avance d'une heure de jeu. */
  tick() {
    this.time += 1;
    const before = { ...this.res };
    this.assignJobs();
    const forgesWork = this.time >= this.forgesStopUntil && !(this.flags.reposNuit && !this.isDay) && this.loyal.forges > 15;
    const racinesWork = this.loyal.racines > 15;
    // production
    for (const b of this.buildings) {
      const d = BUILDINGS[b.def];
      if (b.progress < 1) { b.progress = Math.min(1, b.progress + 1 / (2 + d.size)); if (b.progress >= 1) { this.notes.push({ text: `${d.name} terminé` }); this.assignHomes(); } continue; }
      if (!d.prod || b.damaged || b.paused || !d.workers) continue;
      if (d.group === 'forges' && !forgesWork) continue;
      if (d.group === 'racines' && !racinesWork) continue;
      if (d.dayOnly && !this.isDay) continue;
      const ratio = b.staffed / d.workers;
      if (ratio <= 0) continue;
      const mul = (d.group === 'forges' ? this.prodMul.forges : 1) * (b.def === 'jardin' ? this.prodMul.jardin : 1) * (0.6 + 0.4 * this.moral[d.group as GroupId] / 100);
      // ne tourne que si les entrées sont disponibles
      const inputs = Object.entries(d.prod).filter(([, v]) => (v as number) < 0);
      if (inputs.some(([r, v]) => this.res[r as Res] < -(v as number) * ratio)) continue;
      for (const [r, v] of Object.entries(d.prod)) this.res[r as Res] += (v as number) * ratio * ((v as number) > 0 ? mul : 1);
    }
    // consommation des habitants
    const nf = this.pop('forges'), nr = this.pop('racines');
    this.res.energie -= nf * 0.4;
    this.res.nourriture -= nr * 0.25;
    this.res.eau -= nr * 0.15;
    if (!this.isDay && this.time < this.longNightUntil) this.res.energie -= 0.5; // chauffage pendant la longue nuit
    // pénuries
    this.shortage = {};
    for (const r of ['energie', 'nourriture', 'eau'] as Res[]) if (this.res[r] < 0) { this.res[r] = 0; this.shortage[r] = true; }
    if (this.shortage.energie) { this.moral.forges = clamp(this.moral.forges - 2.5); }
    if (this.shortage.nourriture || this.shortage.eau) { this.moral.racines = clamp(this.moral.racines - 3); this.loyal.racines = clamp(this.loyal.racines - 0.6); }
    // humeur qui revient lentement
    for (const g of ['forges', 'racines'] as GroupId[]) {
      const short = g === 'forges' ? this.shortage.energie : (this.shortage.nourriture || this.shortage.eau);
      if (!short) this.moral[g] = clamp(this.moral[g] + (62 - this.moral[g]) * 0.03);
    }
    // feu commun : la nuit, on se rassemble
    if (this.has('feu') && !this.isDay) { this.addRel('forges', 'confiance', 0.35); this.addRel('racines', 'confiance', 0.35); this.addRel('racines', 'peur', -0.3); this.moral.racines = clamp(this.moral.racines + 0.3); }
    // relations qui s'apaisent ou s'enveniment
    for (const g of ['forges', 'racines'] as GroupId[]) { this.addRel(g, 'rancune', -0.04); this.addRel(g, 'peur', -0.03); }
    for (const b of this.buildings) if (this.inGrove(b.x, b.z) && BUILDINGS[b.def].group !== 'racines') this.addRel('racines', 'rancune', 0.12);
    // croissance du clan
    this.growthAcc += 1;
    if (this.growthAcc >= 12) {
      this.growthAcc = 0;
      if (this.res.nourriture > 15 && this.res.eau > 8 && this.moral.racines > 45 && nr < this.capacity('racines')) {
        const c = this.addCitizen('racines'); this.assignHomes();
        this.notes.push({ text: `Une famille rejoint le clan : ${c.name}`, sub: 'Le Clan des Racines grandit.' });
      }
    }
    // tension et paix
    const avg = (k: RelKey) => (this.rel.forges[k] + this.rel.racines[k]) / 2;
    const shortN = (this.shortage.energie ? 1 : 0) + (this.shortage.nourriture ? 1 : 0) + (this.shortage.eau ? 1 : 0);
    const target = clamp(avg('rancune') * 0.9 + avg('peur') * 0.35 + shortN * 14 + Math.max(0, 45 - Math.min(this.loyal.forges, this.loyal.racines)) * 0.6);
    this.tension += (target - this.tension) * 0.15;
    this.paix = clamp(avg('confiance') * 0.6 + (this.loyal.forges + this.loyal.racines) / 2 * 0.35 - this.tension * 0.45 + 22);
    if (this.tension > 70) {
      this.tensionHours++;
      if (this.tensionHours >= 14) { this.tensionHours = 0; this.incident(); }
    } else this.tensionHours = Math.max(0, this.tensionHours - 1);
    for (const g of ['forges', 'racines'] as GroupId[]) if (this.loyal[g] <= 15 && this.hour === 8) this.notes.push({ text: `${GROUPS[g].name} ne travaillent plus`, sub: 'Leur loyauté envers R-12 est trop basse.', crisis: true });
    // conséquences différées
    for (const p of this.pending.filter((p) => this.day >= p.day && this.hour >= 10)) { this.laterQueue.push(p.key); }
    this.pending = this.pending.filter((p) => !(this.day >= p.day && this.hour >= 10));
    for (const r of Object.keys(this.res) as Res[]) this.delta[r] = this.delta[r] * 0.7 + (this.res[r] - before[r]) * 0.3;
  }

  applyLater(key: string) { LATER[key].apply(this); this.history.push(`Jour ${this.day} · ${LATER[key].title}`); }

  private incident() {
    const r = Math.random();
    if (r < 0.5) {
      const b = this.buildings.filter((x) => x.progress >= 1 && !x.damaged && BUILDINGS[x.def].group !== 'commun');
      const t = b[Math.floor(Math.random() * b.length)];
      if (t) { t.damaged = true; this.notes.push({ text: 'Sabotage', sub: `${BUILDINGS[t.def].name} a été endommagé pendant la nuit. Réparez-le (5 métal).`, crisis: true }); }
    } else {
      this.stopForges(8);
      this.notes.push({ text: 'Bagarre au camp', sub: 'Des Vaëls et des Forgés se sont affrontés. Les ateliers s\'arrêtent quelques heures.', crisis: true });
      this.addRel('racines', 'peur', 6); this.addRel('forges', 'rancune', 4);
    }
  }

  // ---------- sauvegarde ----------
  toJSON() {
    const { notes: _n, ...rest } = this as unknown as Record<string, unknown>;
    void _n;
    return rest;
  }
  static load(json: string) {
    const s = new Sim();
    Object.assign(s, JSON.parse(json));
    s.notes = [];
    return s;
  }
}

export function clamp(v: number, a = 0, b = 100) { return Math.max(a, Math.min(b, v)); }
