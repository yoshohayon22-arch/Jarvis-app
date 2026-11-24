// Préréglages de qualité : détection automatique + surcharge par l'utilisateur (localStorage).

export type PresetId = 'econome' | 'equilibre' | 'haut' | 'ultra';

export interface Quality {
  id: PresetId;
  label: string;
  pixelRatio: number;      // multiplicateur de résolution de rendu (max)
  shadowMap: number;       // taille des cartes d'ombre
  textureRes: '1k' | '2k';
  reflections: 'off' | 'low' | 'high'; // reflets planaires
  reflectionScale: number; // fraction de la résolution écran
  ao: 'off' | 'performance' | 'medium';
  bloom: boolean;
  volumetric: boolean;     // cônes de lumière / brouillard
  particles: number;       // multiplicateur de densité
  chromatic: boolean;
  robotLights: boolean;    // lumières ponctuelles des yeux
}

export const PRESETS: Record<PresetId, Quality> = {
  econome: {
    id: 'econome', label: 'Économe', pixelRatio: 1, shadowMap: 512, textureRes: '1k',
    reflections: 'off', reflectionScale: 0.3, ao: 'off', bloom: true, volumetric: false,
    particles: 0.35, chromatic: false, robotLights: false,
  },
  equilibre: {
    id: 'equilibre', label: 'Équilibré', pixelRatio: 1.25, shadowMap: 1024, textureRes: '1k',
    reflections: 'low', reflectionScale: 0.35, ao: 'performance', bloom: true, volumetric: true,
    particles: 0.5, chromatic: false, robotLights: false,
  },
  haut: {
    id: 'haut', label: 'Haut', pixelRatio: 1.75, shadowMap: 2048, textureRes: '2k',
    reflections: 'high', reflectionScale: 0.5, ao: 'medium', bloom: true, volumetric: true,
    particles: 0.8, chromatic: true, robotLights: true,
  },
  ultra: {
    id: 'ultra', label: 'Ultra', pixelRatio: 2, shadowMap: 4096, textureRes: '2k',
    reflections: 'high', reflectionScale: 0.6, ao: 'medium', bloom: true, volumetric: true,
    particles: 1, chromatic: true, robotLights: true,
  },
};

export function isTouchDevice(): boolean {
  const ua = navigator.userAgent;
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return iPadOS || /iPad|iPhone|iPod|Android|Mobile/.test(ua);
}

function gpuName(): string {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
  } catch { return ''; }
}

export function detectPreset(): PresetId {
  if (isTouchDevice()) return 'equilibre';
  const gpu = gpuName().toLowerCase();
  // Cartes intégrées modestes → Haut ; le reste (Apple M, NVIDIA, AMD récentes) → Ultra.
  if (/intel|uhd|iris|mali|adreno|swiftshader|llvmpipe/.test(gpu)) return 'haut';
  return 'ultra';
}

const KEY = 'dernier-signal:quality';

const BOOT = 'dernier-signal:booting';
/** Vrai si le lancement précédent n'est jamais arrivé au bout (plantage graphique probable). */
export let recoveredFromCrash = false;

export function loadQuality(): Quality {
  // Sur iPad, premier lancement prudent : « Économe » tant que l'utilisateur n'a rien choisi.
  let id: PresetId = isTouchDevice() ? 'econome' : detectPreset();
  try {
    const saved = localStorage.getItem(KEY) as PresetId | null;
    if (saved && saved in PRESETS) id = saved;
    if (localStorage.getItem(BOOT)) { recoveredFromCrash = true; id = 'econome'; }
    localStorage.setItem(BOOT, String(Date.now()));
  } catch { /* stockage indisponible */ }
  return { ...PRESETS[id] };
}

/** À appeler une fois l'écran titre affiché sans problème. */
export function bootSucceeded() { try { localStorage.removeItem(BOOT); } catch { /* */ } }

export function saveQuality(id: PresetId) {
  try { localStorage.setItem(KEY, id); } catch { /* ignore */ }
}
