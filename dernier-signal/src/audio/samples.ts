// Banque de sons enregistrés (bruitages générés avec ElevenLabs, interface Kenney CC0).
// Chargés après le premier toucher ; tant qu'un son n'est pas prêt, le moteur
// joue sa version synthétique.

export const SAMPLE_NAMES = [
  'amb_day', 'amb_night', 'amb_forest', 'river', 'wreck_fire', 'capsule_int', 'station_amb',
  'step_grass', 'step_dirt', 'step_metal', 'step_grate',
  'land', 'jump', 'door', 'spark', 'steam', 'jet', 'powerup', 'holo_open', 'holo_close',
  'ui_move', 'ui_ok', 'ui_back',
] as const;
export type SampleName = typeof SAMPLE_NAMES[number];

/** Découpage des enregistrements de pas : [début (s), durée (s), niveau relatif]. */
export const STEP_SLICES: Record<string, [number, number, number][]> = {
  step_dirt: [[0.3829, 0.2356, 0.96], [0.6225, 0.3528, 0.85], [0.9453, 0.2657, 0.93], [1.181, 0.3386, 0.93], [1.4896, 0.2822, 1.0], [1.7418, 0.3558, 1.0], [2.0677, 0.2468, 0.98], [2.2844, 0.3062, 0.98], [2.5607, 0.3208, 0.88], [2.8515, 0.2763, 0.88], [3.0978, 0.2858, 0.66], [3.3537, 0.3057, 0.97], [3.6294, 0.3199, 0.97], [3.9271, 0.2665, 0.89], [4.1637, 0.3099, 0.89]],
  step_grass: [[0.4098, 0.38, 0.67], [0.7672, 0.3665, 0.96], [1.1037, 0.3635, 0.98], [1.4373, 0.3541, 0.98], [1.7614, 0.3563, 0.79], [2.0878, 0.3488, 0.58], [2.4578, 0.3236, 0.99], [2.7514, 0.3717, 0.81], [3.0932, 0.3375, 1.0], [3.4007, 0.3629, 0.87], [3.7336, 0.3017, 0.87], [4.0054, 0.3208, 0.83], [4.2962, 0.3587, 0.83]],
  step_grate: [[0.7446, 0.38, 0.36], [1.1769, 0.38, 0.38], [1.6104, 0.38, 0.31], [2.0007, 0.38, 0.69], [2.4159, 0.38, 0.62], [2.8369, 0.38, 0.83], [3.2759, 0.38, 0.41], [3.6805, 0.38, 1.0], [4.1359, 0.379, 0.31]],
  step_metal: [[0.3276, 0.38, 0.49], [1.7905, 0.38, 0.75], [2.4926, 0.38, 0.49], [3.1402, 0.38, 0.46], [4.5427, 0.38, 1.0]],
};

export class SampleBank {
  private buffers = new Map<string, AudioBuffer>();
  /** Bornes de boucle sans le silence ajouté par l'encodage MP3. */
  private trims = new Map<string, [number, number]>();
  private loading = false;
  constructor(private ctx: AudioContext, private base: string) {}

  get(name: string) { return this.buffers.get(name); }
  trim(name: string) { return this.trims.get(name); }

  /** Charge tous les sons (en parallèle, sans bloquer le jeu). Les ambiances d'abord. */
  load(first: readonly string[] = []) {
    if (this.loading) return;
    this.loading = true;
    const order = [...first, ...SAMPLE_NAMES.filter((n) => !first.includes(n))];
    for (const n of order) this.fetchOne(n);
  }

  private async fetchOne(name: string) {
    try {
      const res = await fetch(this.base + name + '.mp3');
      if (!res.ok) return;
      const data = await res.arrayBuffer();
      const buf = await new Promise<AudioBuffer>((ok, ko) => this.ctx.decodeAudioData(data, ok, ko));
      this.buffers.set(name, buf);
      this.trims.set(name, this.findTrim(buf));
    } catch { /* le son synthétique reste utilisé */ }
  }

  private findTrim(buf: AudioBuffer): [number, number] {
    const d = buf.getChannelData(0), eps = 2e-4;
    let a = 0, b = d.length - 1;
    while (a < d.length && Math.abs(d[a]) < eps) a++;
    while (b > a && Math.abs(d[b]) < eps) b--;
    return [a / buf.sampleRate, (b + 1) / buf.sampleRate];
  }
}
