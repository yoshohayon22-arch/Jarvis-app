import { ASSET_ROOT } from "../render/assets";
import { ambienceMix, musicFor, spatial, speechPattern, type AmbienceInput, type AmbienceLayer, type MusicTrack } from "./mix";

export interface AudioSettings {
  /** Master volume, 0–1. */
  volume: number;
  music: boolean;
}

export type Voice = "male_standard" | "male_deep" | "female_standard" | "female_light";

interface Loop {
  gain: GainNode;
  source: AudioBufferSourceNode | null;
  loading: boolean;
}

const AMBIENCE: Record<AmbienceLayer, string> = { day: "amb_day", birds: "amb_birds", night: "amb_night", crowd: "amb_crowd", pub: "amb_pub" };
const MUSIC: Record<MusicTrack, string> = { market: "music_market", inn: "music_inn", explore: "music_explore" };

/**
 * All the game's sound: one-shots (steps, blows, voices, spells), ambience
 * layers and music, mixed with the Web Audio API. Everything is optional: a
 * missing file or a blocked audio context never breaks the game.
 */
export class AudioEngine {
  settings: AudioSettings = { volume: 0.8, music: true };
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();
  private readonly loops = new Map<string, Loop>();
  private track: MusicTrack | null = null;
  private listener = { x: 0, z: 0, rightX: 1, rightZ: 0 };
  /** Sounds played since start (debug and tests). */
  played = 0;

  /** Must be called from a user gesture (browsers keep audio locked until then). */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.applyVolume();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === "running";
  }

  applyVolume(): void {
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(Math.max(0, Math.min(1, this.settings.volume)), this.ctx.currentTime, 0.05);
  }

  /** Pause menu, hidden tab: silence without losing the loops. */
  setPaused(paused: boolean): void {
    if (!this.ctx) return;
    if (paused && this.ctx.state === "running") void this.ctx.suspend();
    else if (!paused && this.ctx.state === "suspended") void this.ctx.resume();
  }

  setListener(x: number, z: number, rightX: number, rightZ: number): void {
    this.listener = { x, z, rightX, rightZ };
  }

  private load(name: string): Promise<AudioBuffer | null> {
    let p = this.buffers.get(name);
    if (!p) {
      const ctx = this.ctx;
      p = ctx
        ? fetch(`${ASSET_ROOT}audio/${name}.ogg`)
            .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
            .then((b) => ctx.decodeAudioData(b))
            .catch(() => null)
        : Promise.resolve(null);
      this.buffers.set(name, p);
    }
    return p;
  }

  /** Warm the cache so the first blow is not silent. */
  preload(names: readonly string[]): void {
    for (const n of names) void this.load(n);
  }

  /** Plays a one-shot. `at` places it in the world (distance attenuation and stereo). */
  play(name: string, opts: { volume?: number; rate?: number; delay?: number; at?: { x: number; z: number } } = {}): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || ctx.state !== "running") return;
    let gain = opts.volume ?? 1;
    let pan = 0;
    if (opts.at) {
      const s = spatial(opts.at.x - this.listener.x, opts.at.z - this.listener.z, this.listener.rightX, this.listener.rightZ);
      gain *= s.gain;
      pan = s.pan;
    }
    if (gain <= 0.01) return;
    this.played++;
    void this.load(name).then((buffer) => {
      if (!buffer || ctx.state !== "running") return;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = opts.rate ?? 1;
      const g = ctx.createGain();
      g.gain.value = gain;
      let node: AudioNode = g;
      if (pan !== 0 && typeof ctx.createStereoPanner === "function") {
        const p = ctx.createStereoPanner();
        p.pan.value = pan;
        g.connect(p);
        node = p;
      }
      src.connect(g);
      node.connect(master);
      src.start(ctx.currentTime + (opts.delay ?? 0));
    });
  }

  /** One of several takes of the same sound, with a slight pitch variation. */
  playVariant(base: string, count: number, opts: { volume?: number; at?: { x: number; z: number }; rate?: number } = {}): void {
    const i = 1 + Math.floor(Math.random() * count);
    this.play(`${base}_${i}`, { ...opts, rate: (opts.rate ?? 1) * (0.94 + Math.random() * 0.12) });
  }

  /** A person "speaking": a few voice blips, as long as the line. */
  speak(voice: Voice, text: string, at?: { x: number; z: number }, volume = 0.7): void {
    for (const b of speechPattern(text, text.length * 31 + voice.length)) this.play(`voice_${voice}_${b.index}`, { volume, rate: b.rate, delay: b.at, at });
  }

  private loop(name: string): Loop | null {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return null;
    let l = this.loops.get(name);
    if (!l) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(master);
      l = { gain, source: null, loading: false };
      this.loops.set(name, l);
    }
    return l;
  }

  private setLoop(name: string, target: number, fade = 1.2): void {
    const ctx = this.ctx;
    const l = this.loop(name);
    if (!ctx || !l) return;
    l.gain.gain.setTargetAtTime(target, ctx.currentTime, fade / 3);
    if (target > 0.01 && !l.source && !l.loading) {
      l.loading = true;
      void this.load(name).then((buffer) => {
        l.loading = false;
        if (!buffer || l.source) return;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        src.connect(l.gain);
        src.start();
        l.source = src;
      });
    }
  }

  /** Call a few times per second with what surrounds the hero. */
  updateAmbience(input: AmbienceInput): void {
    if (!this.ready) return;
    const mix = ambienceMix(input);
    for (const [layer, file] of Object.entries(AMBIENCE) as [AmbienceLayer, string][]) this.setLoop(file, mix[layer] * 0.5);
    const want = this.settings.music ? musicFor(input) : null;
    if (want !== this.track) this.track = want;
    for (const [track, file] of Object.entries(MUSIC) as [MusicTrack, string][]) this.setLoop(file, track === this.track ? 0.22 : 0, 3);
  }

  get currentTrack(): MusicTrack | null {
    return this.track;
  }
}
