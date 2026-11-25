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
  aoHalf?: boolean;        // occlusion ambiante calculée à demi-résolution
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

const ORDER: PresetId[] = ['econome', 'equilibre', 'haut', 'ultra'];
/** Préréglage qui a fait planter le lancement précédent (pour le signaler au joueur). */
export let crashedPreset: PresetId | null = null;

/**
 * Sur iPad, la mémoire graphique est partagée et limitée : au-delà, iPadOS coupe la 3D de la page
 * (et la bloque jusqu'à la réouverture de l'app). On garde l'esprit de chaque préréglage, mais avec
 * un nombre de pixels calculés plafonné et des ombres au plus en 2048.
 */
const TOUCH_PIXELS: Record<PresetId, number> = { econome: 1.3e6, equilibre: 1.9e6, haut: 2.5e6, ultra: 3.1e6 };
export function fitToDevice(q: Quality): Quality {
  if (!isTouchDevice()) return q;
  const css = Math.max(1, innerWidth * innerHeight);
  const pr = Math.sqrt(TOUCH_PIXELS[q.id] / css);
  q.pixelRatio = Math.max(1, Math.min(q.pixelRatio, Math.round(pr * 20) / 20));
  q.shadowMap = Math.min(q.shadowMap, 2048);
  q.reflectionScale = Math.min(q.reflectionScale, 0.45);
  q.aoHalf = true;
  return q;
}

export function loadQuality(): Quality {
  // Sur iPad, premier lancement prudent : « Économe » tant que l'utilisateur n'a rien choisi.
  let id: PresetId = isTouchDevice() ? 'econome' : detectPreset();
  try {
    const saved = localStorage.getItem(KEY) as PresetId | null;
    if (saved && saved in PRESETS) id = saved;
    if (localStorage.getItem(BOOT) || localStorage.getItem(CRASH)) {
      localStorage.removeItem(CRASH);
      // le lancement précédent a planté : ce lancement-ci en Économe, et le réglage choisi
      // descend d'un cran pour de bon (sinon on replanterait au lancement suivant)
      recoveredFromCrash = true;
      if (id !== 'econome') { crashedPreset = id; localStorage.setItem(KEY, ORDER[ORDER.indexOf(id) - 1]); }
      id = 'econome';
    }
    localStorage.setItem(BOOT, String(Date.now()));
  } catch { /* stockage indisponible */ }
  return fitToDevice({ ...PRESETS[id] });
}

/** Message affiché quand le navigateur refuse la 3D (souvent après un plantage dû à un réglage trop gourmand). */
export function gpuBlockedHelp(): string {
  return isTouchDevice()
    ? 'L’iPad a coupé la 3D, sans doute parce qu’un réglage graphique demandait trop de mémoire. Ferme complètement l’application Claude (balaie-la vers le haut dans le sélecteur d’apps), puis rouvre le jeu : il redémarrera en qualité Économe.'
    : 'Le navigateur a coupé la 3D, sans doute après un plantage. Ferme cet onglet ou redémarre le navigateur, puis rouvre le jeu : il redémarrera en qualité Économe.';
}

/** À appeler une fois l'écran titre affiché sans problème (et avant un rechargement voulu). */
export function bootSucceeded() { try { localStorage.removeItem(BOOT); } catch { /* */ } }
const CRASH = 'dernier-signal:crashed';
/** La 3D a été coupée en cours de partie : le prochain lancement descendra la qualité. */
export function markCrash() { try { localStorage.setItem(CRASH, '1'); } catch { /* */ } }
// quitter une page normalement (lien, autre écran) n'est pas un plantage
addEventListener('pagehide', () => bootSucceeded());

/** Surveille la perte de la 3D : on la note comme plantage, puis on recharge en qualité réduite. */
export function watchContextLoss(canvas: HTMLCanvasElement, show: (msg: string) => void) {
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    markCrash();
    show('La 3D a été coupée (mémoire graphique pleine) — redémarrage en qualité réduite…');
    setTimeout(() => location.reload(), 1500);
  });
}

export function saveQuality(id: PresetId) {
  try { localStorage.setItem(KEY, id); } catch { /* ignore */ }
}
