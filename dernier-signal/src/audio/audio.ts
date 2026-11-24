import * as THREE from 'three';

// Son entièrement généré avec la Web Audio API : nappes d'ambiance, bruitages
// spatialisés en 3D et voix des journaux (synthèse vocale du navigateur).
// Le contexte audio ne démarre qu'après le premier toucher/clic (contrainte Safari).

export type Surface = 'metal' | 'grate' | 'concrete';

export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  music!: GainNode;
  sfx!: GainNode;
  private reverb!: ConvolverNode;
  private reverbSend!: GainNode;
  private noiseBuf!: AudioBuffer;
  private ambience: Ambience | null = null;
  private loops = new Map<string, { gain: GainNode; stop: () => void; panner?: PannerNode }>();
  volumes = { master: 0.9, music: 0.7, sfx: 0.9 };

  /** À appeler depuis un geste utilisateur. */
  unlock() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC({ latencyHint: 'interactive' });
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3.5; comp.attack.value = 0.01; comp.release.value = 0.25;
    comp.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.gain.value = this.volumes.master; this.master.connect(comp);
    this.music = ctx.createGain(); this.music.gain.value = this.volumes.music; this.music.connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.gain.value = this.volumes.sfx; this.sfx.connect(this.master);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(3.2, 2.6);
    this.reverbSend = ctx.createGain(); this.reverbSend.gain.value = 0.35;
    this.reverbSend.connect(this.reverb); this.reverb.connect(this.master);
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // iOS : jouer un son vide débloque la sortie
    const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start();
  }

  /** Vrai si le son est réellement audible (contexte créé et en marche). */
  get running() { return !!this.ctx && this.ctx.state === 'running'; }

  /** Crée ou relance le contexte audio (après une coupure : manette Bluetooth, appel, mise en veille…). */
  ensure() {
    if (!this.ctx) { this.unlock(); return; }
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => { /* attend un vrai geste */ });
  }

  setVolumes(v: Partial<typeof this.volumes>) {
    Object.assign(this.volumes, v);
    if (!this.ctx) return;
    this.master.gain.value = this.volumes.master; this.music.gain.value = this.volumes.music; this.sfx.gain.value = this.volumes.sfx;
  }

  private impulse(seconds: number, decay: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < 300 ? i / 300 : 1);
    }
    return buf;
  }

  updateListener(cam: THREE.Camera) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const p = cam.getWorldPosition(new THREE.Vector3());
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const u = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    const t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setTargetAtTime(p.x, t, 0.02); l.positionY.setTargetAtTime(p.y, t, 0.02); l.positionZ.setTargetAtTime(p.z, t, 0.02);
      l.forwardX.setTargetAtTime(f.x, t, 0.02); l.forwardY.setTargetAtTime(f.y, t, 0.02); l.forwardZ.setTargetAtTime(f.z, t, 0.02);
      l.upX.setTargetAtTime(u.x, t, 0.02); l.upY.setTargetAtTime(u.y, t, 0.02); l.upZ.setTargetAtTime(u.z, t, 0.02);
    } else {
      (l as unknown as { setPosition: (...a: number[]) => void }).setPosition(p.x, p.y, p.z);
      (l as unknown as { setOrientation: (...a: number[]) => void }).setOrientation(f.x, f.y, f.z, u.x, u.y, u.z);
    }
  }

  private panner(pos: THREE.Vector3, ref = 1.5, max = 30) {
    const p = this.ctx!.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = ref; p.maxDistance = max; p.rolloffFactor = 1.3;
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; }
    else (p as unknown as { setPosition: (...a: number[]) => void }).setPosition(pos.x, pos.y, pos.z);
    return p;
  }

  /** Branche une sortie : spatialisée si pos fournie, + départ réverb. */
  private out(node: AudioNode, pos?: THREE.Vector3, wet = 0.3, ref = 1.5) {
    let last: AudioNode = node;
    if (pos) { const p = this.panner(pos, ref); node.connect(p); last = p; }
    last.connect(this.sfx);
    if (wet > 0) { const g = this.ctx!.createGain(); g.gain.value = wet; last.connect(g); g.connect(this.reverbSend); }
    return last;
  }

  private noise(dur: number) {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noiseBuf; s.loop = true;
    s.loopStart = Math.random(); s.start(0, Math.random() * 1.5, dur + 0.1);
    return s;
  }

  private env(g: GainNode, a: number, peak: number, d: number, t = this.ctx!.currentTime) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  // ---------- bruitages ----------
  step(surface: Surface, pos?: THREE.Vector3, heavy = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const n = this.noise(0.12);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.value = surface === 'grate' ? 2400 + Math.random() * 600 : surface === 'concrete' ? 900 : 1500 + Math.random() * 400;
    f.Q.value = surface === 'grate' ? 6 : 2;
    const g = ctx.createGain(); this.env(g, 0.003, 0.22 * heavy, surface === 'grate' ? 0.09 : 0.06);
    n.connect(f); f.connect(g);
    // petit « clank » métallique
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.value = surface === 'grate' ? 520 + Math.random() * 80 : 180 + Math.random() * 40;
    const og = ctx.createGain(); this.env(og, 0.002, 0.06 * heavy, 0.08);
    o.connect(og); o.start(t); o.stop(t + 0.12);
    const mix = ctx.createGain(); g.connect(mix); og.connect(mix);
    this.out(mix, pos, 0.25);
  }

  land(pos?: THREE.Vector3, power = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
    const g = ctx.createGain(); this.env(g, 0.004, 0.5 * power, 0.22);
    o.connect(g); o.start(t); o.stop(t + 0.3);
    this.out(g, pos, 0.4);
    this.step('metal', pos, 1.6 * power);
  }

  jump(pos?: THREE.Vector3) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const n = this.noise(0.15);
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1200;
    const g = ctx.createGain(); this.env(g, 0.01, 0.12, 0.12);
    n.connect(f); f.connect(g); this.out(g, pos, 0.2);
    this.servo(pos, 0.6);
  }

  /** Petit moteur d'articulation. */
  servo(pos?: THREE.Vector3, amt = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const f0 = 380 + Math.random() * 200;
    o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * 1.5, t + 0.12);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    const g = ctx.createGain(); this.env(g, 0.01, 0.03 * amt, 0.13);
    o.connect(lp); lp.connect(g); o.start(t); o.stop(t + 0.2);
    this.out(g, pos, 0.1);
  }

  /** Bips expressifs du robot. */
  beep(kind: 'ok' | 'question' | 'sad' | 'alert' | 'happy' | 'boot', pos?: THREE.Vector3) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const seqs: Record<string, [number, number, number][]> = {
      ok: [[880, 0, 0.07], [1320, 0.08, 0.09]],
      question: [[700, 0, 0.08], [760, 0.09, 0.06], [1100, 0.16, 0.14]],
      sad: [[900, 0, 0.12], [640, 0.13, 0.22]],
      alert: [[1500, 0, 0.06], [1500, 0.1, 0.06], [1500, 0.2, 0.06]],
      happy: [[990, 0, 0.06], [1320, 0.07, 0.06], [1760, 0.14, 0.1]],
      boot: [[220, 0, 0.18], [330, 0.2, 0.18], [440, 0.4, 0.18], [880, 0.62, 0.3]],
    };
    const t0 = ctx.currentTime + 0.01;
    const mix = ctx.createGain(); mix.gain.value = 1;
    for (const [f, at, d] of seqs[kind]) {
      const o = ctx.createOscillator(); o.type = 'square';
      o.frequency.setValueAtTime(f, t0 + at);
      o.frequency.exponentialRampToValueAtTime(f * (kind === 'sad' ? 0.94 : 1.03), t0 + at + d);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
      const g = ctx.createGain(); this.env(g, 0.005, 0.05, d, t0 + at);
      o.connect(lp); lp.connect(g); g.connect(mix);
      o.start(t0 + at); o.stop(t0 + at + d + 0.05);
    }
    this.out(mix, pos, 0.25);
  }

  door(pos: THREE.Vector3, open = true) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const n = this.noise(1.2);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(open ? 300 : 900, t); f.frequency.linearRampToValueAtTime(open ? 900 : 300, t + 0.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.08);
    g.gain.setValueAtTime(0.35, t + 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    n.connect(f); f.connect(g);
    this.out(g, pos, 0.5, 2.5);
    // impact de fin de course
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(90, t + 0.85); o.frequency.exponentialRampToValueAtTime(40, t + 1.1);
    const og = ctx.createGain(); this.env(og, 0.005, 0.6, 0.35, t + 0.85);
    o.connect(og); o.start(t + 0.85); o.stop(t + 1.3);
    this.out(og, pos, 0.6, 2.5);
    // sifflement pneumatique
    const h = this.noise(0.5); const hf = ctx.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = 5000;
    const hg = ctx.createGain(); this.env(hg, 0.02, 0.12, 0.4);
    h.connect(hf); hf.connect(hg); this.out(hg, pos, 0.3, 2.5);
  }

  spark(pos: THREE.Vector3, power = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const n = this.noise(0.4);
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
    const g = ctx.createGain(); g.gain.value = 0;
    // crépitements
    for (let i = 0; i < 10; i++) {
      const at = t + Math.random() * 0.3;
      g.gain.setValueAtTime(0.4 * power * Math.random(), at);
      g.gain.setValueAtTime(0, at + 0.008 + Math.random() * 0.01);
    }
    n.connect(f); f.connect(g); this.out(g, pos, 0.3, 2);
  }

  zap(pos: THREE.Vector3) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 60;
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 120.5;
    const n = this.noise(0.6); const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 3000; nf.Q.value = 0.7;
    const g = ctx.createGain(); this.env(g, 0.005, 0.5, 0.5);
    o.connect(g); o2.connect(g); n.connect(nf); nf.connect(g);
    o.start(t); o2.start(t); o.stop(t + 0.6); o2.stop(t + 0.6);
    this.out(g, pos, 0.4, 3);
  }

  powerUp() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(30, t); o.frequency.exponentialRampToValueAtTime(60, t + 2.5);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(80, t); lp.frequency.exponentialRampToValueAtTime(1400, t + 2.2); lp.frequency.exponentialRampToValueAtTime(200, t + 4);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 1.8); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.2);
    o.connect(lp); lp.connect(g); o.start(t); o.stop(t + 4.3);
    this.out(g, undefined, 0.5);
    // chocs de relais
    for (let i = 0; i < 5; i++) setTimeout(() => this.land(undefined, 0.7), 900 + i * 380);
  }

  scan() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(400, t); o.frequency.exponentialRampToValueAtTime(2200, t + 0.5); o.frequency.exponentialRampToValueAtTime(900, t + 1.3);
    const g = ctx.createGain(); this.env(g, 0.02, 0.12, 1.2);
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 3;
    const lfo = ctx.createGain(); lfo.gain.value = 40; o2.connect(lfo); lfo.connect(o.frequency);
    o.connect(g); o.start(t); o2.start(t); o.stop(t + 1.4); o2.stop(t + 1.4);
    this.out(g, undefined, 0.8);
  }

  discovery() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain(); this.env(g, 0.02, 0.07, 2.2, t + i * 0.09);
      o.connect(g); o.start(t + i * 0.09); o.stop(t + 2.6);
      this.out(g, undefined, 0.9);
    });
    this.ambience?.swell();
  }

  reboot() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(800, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.6);
    const g = ctx.createGain(); this.env(g, 0.005, 0.2, 0.6);
    o.connect(g); o.start(t); o.stop(t + 0.7);
    this.out(g, undefined, 0.3);
    setTimeout(() => this.beep('boot'), 900);
  }

  ui(kind: 'move' | 'ok' | 'back' = 'ok') {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.value = kind === 'move' ? 1200 : kind === 'ok' ? 1600 : 800;
    const g = ctx.createGain(); this.env(g, 0.003, 0.05, 0.06);
    o.connect(g); o.start(t); o.stop(t + 0.1);
    g.connect(this.sfx);
  }

  // ---------- boucles (jetpack, vapeur, bourdonnement) ----------
  loop(id: string, kind: 'jet' | 'steam' | 'hum' | 'arc' | 'alarm', pos?: THREE.Vector3, vol = 1) {
    if (!this.ctx || this.loops.has(id)) return;
    const ctx = this.ctx;
    const gain = ctx.createGain(); gain.gain.value = 0;
    const nodes: AudioScheduledSourceNode[] = [];
    if (kind === 'jet' || kind === 'steam') {
      const n = ctx.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
      const f = ctx.createBiquadFilter(); f.type = kind === 'jet' ? 'lowpass' : 'highpass';
      f.frequency.value = kind === 'jet' ? 900 : 2600;
      const f2 = ctx.createBiquadFilter(); f2.type = 'peaking'; f2.frequency.value = kind === 'jet' ? 220 : 6000; f2.gain.value = 6;
      n.connect(f); f.connect(f2); f2.connect(gain); n.start(); nodes.push(n);
    } else if (kind === 'hum') {
      for (const [fr, a] of [[50, 0.5], [100, 0.25], [150, 0.12], [400, 0.02]]) {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = fr;
        const g = ctx.createGain(); g.gain.value = a; o.connect(g); g.connect(gain); o.start(); nodes.push(o);
      }
    } else if (kind === 'arc') {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 100;
      const n = ctx.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 0.6;
      const g1 = ctx.createGain(); g1.gain.value = 0.25; o.connect(g1); g1.connect(gain);
      n.connect(f); f.connect(gain); o.start(); n.start(); nodes.push(o, n);
    } else if (kind === 'alarm') {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 620;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 1.1;
      const lg = ctx.createGain(); lg.gain.value = 160; lfo.connect(lg); lg.connect(o.frequency);
      const g = ctx.createGain(); g.gain.value = 0.25; o.connect(g); g.connect(gain); o.start(); lfo.start(); nodes.push(o, lfo);
    }
    const last = this.out(gain, pos, 0.35, kind === 'hum' ? 4 : 1.5);
    this.loops.set(id, { gain, stop: () => nodes.forEach((n) => { try { n.stop(); } catch { /* */ } }), panner: last instanceof PannerNode ? last : undefined });
    this.setLoop(id, vol);
  }
  setLoop(id: string, vol: number, time = 0.08) {
    const l = this.loops.get(id);
    if (l && this.ctx) l.gain.gain.setTargetAtTime(vol, this.ctx.currentTime, time);
  }
  moveLoop(id: string, pos: THREE.Vector3) {
    const p = this.loops.get(id)?.panner;
    if (p?.positionX && this.ctx) { const t = this.ctx.currentTime; p.positionX.setTargetAtTime(pos.x, t, 0.03); p.positionY.setTargetAtTime(pos.y, t, 0.03); p.positionZ.setTargetAtTime(pos.z, t, 0.03); }
  }
  stopLoop(id: string) {
    const l = this.loops.get(id);
    if (!l || !this.ctx) return;
    l.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    setTimeout(() => l.stop(), 600);
    this.loops.delete(id);
  }

  // ---------- musique ----------
  startAmbience(zone: 'station' | 'menu') {
    if (!this.ctx) return;
    this.ambience?.stop();
    this.ambience = new Ambience(this.ctx, this.music, this.reverbSend, this.noiseBuf, zone);
  }
  setTension(v: number) { this.ambience?.setTension(v); }
  setPowered(v: boolean) { this.ambience?.setPowered(v); }
}

/** Nappe spatiale lente : accords suspendus, filtre qui respire, tintements métalliques lointains. */
class Ambience {
  private ctx: AudioContext;
  private out: GainNode;
  private filter: BiquadFilterNode;
  private nodes: AudioScheduledSourceNode[] = [];
  private timer = 0;
  private powered = false;
  private dead = false;
  constructor(ctx: AudioContext, music: GainNode, send: GainNode, noise: AudioBuffer, zone: 'station' | 'menu') {
    this.ctx = ctx;
    this.out = ctx.createGain(); this.out.gain.value = 0;
    this.out.gain.setTargetAtTime(zone === 'menu' ? 0.5 : 0.42, ctx.currentTime, 3);
    this.filter = ctx.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 500; this.filter.Q.value = 0.8;
    this.filter.connect(this.out); this.out.connect(music);
    const wet = ctx.createGain(); wet.gain.value = 0.9; this.out.connect(wet); wet.connect(send);
    // accord : ré mineur suspendu, très grave → froid et métallique
    const notes = zone === 'menu' ? [73.42, 110, 146.83, 220, 329.63] : [55, 82.41, 110, 164.81, 246.94];
    notes.forEach((f, i) => {
      for (const det of [-6, 5]) {
        const o = ctx.createOscillator(); o.type = i < 2 ? 'sawtooth' : 'triangle';
        o.frequency.value = f; o.detune.value = det + (Math.random() - 0.5) * 4;
        const g = ctx.createGain(); g.gain.value = (i < 2 ? 0.05 : 0.035) / (1 + i * 0.3);
        // respiration lente de chaque voix
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.03 + Math.random() * 0.06;
        const lg = ctx.createGain(); lg.gain.value = g.gain.value * 0.8; lfo.connect(lg); lg.connect(g.gain);
        o.connect(g); g.connect(this.filter); o.start(); lfo.start(); this.nodes.push(o, lfo);
      }
    });
    const flfo = ctx.createOscillator(); flfo.frequency.value = 0.025;
    const flg = ctx.createGain(); flg.gain.value = 260; flfo.connect(flg); flg.connect(this.filter.frequency); flfo.start(); this.nodes.push(flfo);
    // souffle d'air (ventilation)
    const n = ctx.createBufferSource(); n.buffer = noise; n.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 420; nf.Q.value = 0.5;
    const ng = ctx.createGain(); ng.gain.value = 0.035; n.connect(nf); nf.connect(ng); ng.connect(this.out); n.start(); this.nodes.push(n);
    this.timer = window.setInterval(() => this.ping(), 4200);
  }
  private ping() {
    if (this.dead || Math.random() < 0.35) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const base = [440, 587.33, 659.25, 880, 1174.66][Math.floor(Math.random() * 5)] * (this.powered ? 1 : 0.5);
    for (const m of [1, 2.76, 5.4]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = base * m;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.025 / m, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5 / m);
      o.connect(g); g.connect(this.out); o.start(t); o.stop(t + 4);
    }
  }
  setTension(v: number) { this.filter.Q.setTargetAtTime(0.8 + v * 6, this.ctx.currentTime, 1); }
  setPowered(v: boolean) { this.powered = v; this.filter.frequency.setTargetAtTime(v ? 900 : 500, this.ctx.currentTime, 2); }
  swell() {
    const t = this.ctx.currentTime;
    this.filter.frequency.cancelScheduledValues(t);
    this.filter.frequency.setTargetAtTime(2400, t, 0.8);
    this.filter.frequency.setTargetAtTime(this.powered ? 900 : 500, t + 4, 3);
  }
  stop() {
    this.dead = true; clearInterval(this.timer);
    this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 1);
    setTimeout(() => this.nodes.forEach((n) => { try { n.stop(); } catch { /* */ } }), 5000);
  }
}

// ---------- voix ----------
export interface VoiceProfile { pitch: number; rate: number; prefer: 'f' | 'm'; }

export class Voices {
  private voices: SpeechSynthesisVoice[] = [];
  enabled = 'speechSynthesis' in window;
  constructor() {
    if (!this.enabled) return;
    const load = () => { this.voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('fr')); };
    load();
    speechSynthesis.onvoiceschanged = load;
  }
  private pick(p: VoiceProfile, index: number) {
    if (!this.voices.length) return undefined;
    const fem = /amelie|amélie|audrey|aurelie|marie|julie|hortense|denise|celine|léa|lea|female|femme|virginie|chantal|sylvie/i;
    const male = /thomas|nicolas|henri|paul|daniel|mathieu|jacques|claude|male|homme|guillaume|antoine/i;
    const pool = this.voices.filter((v) => (p.prefer === 'f' ? fem : male).test(v.name));
    const list = pool.length ? pool : this.voices;
    return list[index % list.length];
  }
  /** Lit une réplique ; résout quand elle est terminée (ou après une durée estimée). */
  speak(text: string, p: VoiceProfile, index: number, volume = 1): { done: Promise<void>; cancel: () => void } {
    const est = 600 + text.length * 62 / p.rate;
    if (!this.enabled) return { done: new Promise((r) => setTimeout(r, est)), cancel: () => {} };
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    const v = this.pick(p, index); if (v) u.voice = v;
    u.pitch = p.pitch; u.rate = p.rate; u.volume = volume;
    let resolve!: () => void;
    const done = new Promise<void>((r) => { resolve = r; });
    let finished = false;
    const fin = () => { if (!finished) { finished = true; resolve(); } };
    u.onend = fin; u.onerror = fin;
    // garde-fou : certains navigateurs n'envoient jamais « onend »
    setTimeout(fin, est * 1.8 + 1500);
    speechSynthesis.speak(u);
    return { done, cancel: () => { speechSynthesis.cancel(); fin(); } };
  }
  stop() { if (this.enabled) speechSynthesis.cancel(); }
}
