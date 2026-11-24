// Sauvegarde automatique (localStorage) à chaque point de contrôle.

export interface SaveData {
  v: 1;
  cp: string;
  flags: Record<string, boolean>;
  logs: string[]; holos: string[]; clues: string[];
  visited: string[];
  objective: string;
  playTime: number;
  updated: number;
}

const KEY = 'dernier-signal:save';

export function newSave(): SaveData {
  return { v: 1, cp: 'A', flags: {}, logs: [], holos: [], clues: [], visited: ['A'], objective: 'wake', playTime: 0, updated: Date.now() };
}
export function loadSave(): SaveData | null {
  try { const s = localStorage.getItem(KEY); if (!s) return null; const d = JSON.parse(s) as SaveData; return d.v === 1 ? d : null; } catch { return null; }
}
export function writeSave(d: SaveData) {
  d.updated = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* stockage plein ou bloqué */ }
}
export function clearSave() { try { localStorage.removeItem(KEY); } catch { /* */ } }

// Options (indépendantes de la partie)
export interface Options {
  preset: string; resScale: number; shadows: 'low' | 'high'; volumetric: boolean; particles: number; bloom: boolean; fps: boolean;
  music: number; sfx: number; sensitivity: number; invertY: boolean; voices: boolean; speech: number;
}
const OKEY = 'dernier-signal:options';
export function loadOptions(defaults: Options): Options {
  try { const s = localStorage.getItem(OKEY); if (s) return { ...defaults, ...JSON.parse(s) }; } catch { /* */ }
  return defaults;
}
export function saveOptions(o: Options) { try { localStorage.setItem(OKEY, JSON.stringify(o)); } catch { /* */ } }
