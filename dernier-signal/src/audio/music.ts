// Musique générative adaptative : accords tenus (nappes), notes pincées façon
// kalimba en FM, cloches lointaines, basse douce, écho ping-pong et grande
// réverbération. L'humeur change avec le lieu et l'heure ; le passage se fait
// au changement d'accord suivant, sans coupure.

export type Mood = 'menu' | 'station' | 'day' | 'night' | 'hq';

interface MoodDef {
  /** Accords en notes MIDI : la première est la basse. */
  chords: number[][];
  bpm: number;
  /** Probabilité d'une note pincée par demi-temps. */
  pluck: number;
  /** Probabilité d'une cloche par mesure. */
  bell: number;
  /** Fréquence de coupure de la nappe (Hz). */
  cut: number;
  pad: number;
  /** Notes de passage autorisées (classes de hauteur). */
  scale: number[];
  /** Registre de la mélodie. */
  lo: number; hi: number;
}

const MOODS: Record<Mood, MoodDef> = {
  // écran titre : ré mineur, mélancolique mais ouvert
  menu: {
    chords: [[38, 50, 57, 60, 64, 65], [34, 46, 53, 57, 62, 65], [41, 53, 57, 60, 64, 67], [36, 48, 55, 62, 64, 67]],
    bpm: 66, pluck: 0.22, bell: 0.25, cut: 1500, pad: 1, scale: [2, 4, 5, 7, 9, 0], lo: 69, hi: 86,
  },
  // station et épave : froid, suspendu, presque immobile
  station: {
    chords: [[38, 50, 57, 62, 64], [34, 46, 53, 58, 64], [31, 43, 50, 53, 57, 58], [33, 45, 50, 52, 57]],
    bpm: 54, pluck: 0.07, bell: 0.4, cut: 900, pad: 0.9, scale: [2, 5, 7, 9], lo: 62, hi: 81,
  },
  // vallée de jour : ré lydien, chaud et lumineux
  day: {
    chords: [[38, 50, 54, 57, 61, 64], [35, 47, 50, 54, 57, 64], [31, 43, 50, 54, 59, 61], [33, 45, 50, 52, 57, 59]],
    bpm: 72, pluck: 0.32, bell: 0.15, cut: 2200, pad: 0.85, scale: [2, 4, 6, 8, 9, 11, 1], lo: 66, hi: 88,
  },
  // vallée de nuit : si mineur, clairsemé, cloches de verre
  night: {
    chords: [[35, 47, 50, 54, 57, 61], [31, 43, 50, 54, 59, 62], [28, 40, 47, 50, 54, 55], [30, 42, 49, 52, 54, 61]],
    bpm: 58, pluck: 0.12, bell: 0.5, cut: 1100, pad: 0.8, scale: [11, 1, 2, 4, 6, 7, 9], lo: 71, hi: 90,
  },
  // intérieur de la capsule : intime, étouffé
  hq: {
    chords: [[38, 50, 57, 60, 64], [41, 53, 57, 60, 65], [34, 46, 53, 57, 62], [36, 48, 55, 60, 62]],
    bpm: 60, pluck: 0.14, bell: 0.2, cut: 750, pad: 0.75, scale: [2, 4, 5, 7, 9, 0], lo: 64, hi: 79,
  },
};

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class Score {
  private ctx: BaseAudioContext;
  private out: GainNode;
  private padBus: GainNode;
  private padFilter: BiquadFilterNode;
  private leadBus: GainNode;
  private delayIn: GainNode;
  private verb: ConvolverNode;
  private verbIn: GainNode;
  private timer = 0;
  private dead = false;
  private mood: Mood;
  private next: Mood;
  private chordIdx = 0;
  private nextChordAt = 0;
  private nextStep = 0;
  private stepN = 0;
  private melody = 74;
  private padVoices: { stop: (t: number) => void }[] = [];
  private tension = 0;
  private powered = true;
  private brightness = 1;

  /** manual : pas de minuterie (rendu hors ligne, tests). */
  constructor(ctx: BaseAudioContext, dest: AudioNode, mood: Mood, manual = false) {
    this.ctx = ctx; this.mood = this.next = mood;
    const t = ctx.currentTime;
    this.out = ctx.createGain(); this.out.gain.value = 0; this.out.gain.setTargetAtTime(2, t, 2.5);
    this.out.connect(dest);

    // grande réverbération (queue sombre de 6 s)
    this.verb = ctx.createConvolver(); this.verb.buffer = this.impulse(6, 3.2);
    this.verbIn = ctx.createGain(); this.verbIn.gain.value = 1;
    const verbOut = ctx.createGain(); verbOut.gain.value = 0.55;
    this.verbIn.connect(this.verb); this.verb.connect(verbOut); verbOut.connect(this.out);

    // écho ping-pong (gauche/droite), filtré
    this.delayIn = ctx.createGain(); this.delayIn.gain.value = 1;
    const beat = 60 / MOODS[mood].bpm;
    const dl = ctx.createDelay(3), dr = ctx.createDelay(3);
    dl.delayTime.value = beat * 0.75; dr.delayTime.value = beat * 0.75;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2600;
    const merge = ctx.createChannelMerger(2);
    this.delayIn.connect(tone); tone.connect(dl); dl.connect(dr); dr.connect(fb); fb.connect(dl);
    dl.connect(merge, 0, 0); dr.connect(merge, 0, 1);
    const dOut = ctx.createGain(); dOut.gain.value = 0.32; merge.connect(dOut); dOut.connect(this.out); dOut.connect(this.verbIn);

    // nappe : filtre commun qui respire lentement
    this.padFilter = ctx.createBiquadFilter(); this.padFilter.type = 'lowpass'; this.padFilter.Q.value = 0.6;
    this.padFilter.frequency.value = MOODS[mood].cut;
    const breath = ctx.createOscillator(); breath.frequency.value = 0.045;
    const bg = ctx.createGain(); bg.gain.value = 220; breath.connect(bg); bg.connect(this.padFilter.detune); breath.start();
    this.padBus = ctx.createGain(); this.padBus.gain.value = 1;
    const padHp = ctx.createBiquadFilter(); padHp.type = 'highpass'; padHp.frequency.value = 140; padHp.Q.value = 0.5;
    this.padBus.connect(padHp); padHp.connect(this.padFilter);
    const padDry = ctx.createGain(); padDry.gain.value = 0.7; this.padFilter.connect(padDry); padDry.connect(this.out);
    const padWet = ctx.createGain(); padWet.gain.value = 0.8; this.padFilter.connect(padWet); padWet.connect(this.verbIn);

    // voix pincées et cloches
    this.leadBus = ctx.createGain(); this.leadBus.gain.value = 1;
    const ld = ctx.createGain(); ld.gain.value = 0.8; this.leadBus.connect(ld); ld.connect(this.out);
    const lw = ctx.createGain(); lw.gain.value = 0.7; this.leadBus.connect(lw); lw.connect(this.verbIn);
    const le = ctx.createGain(); le.gain.value = 0.6; this.leadBus.connect(le); le.connect(this.delayIn);

    this.nextChordAt = t + 0.2; this.nextStep = t + 0.2;
    if (!manual) this.timer = window.setInterval(() => this.tick(), 90);
  }

  private impulse(sec: number, decay: number) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const k = i / len;
        const a = 0.15 + k * 0.8; // la queue s'assombrit avec le temps
        lp += ((Math.random() * 2 - 1) - lp) * (1 - a);
        d[i] = lp * Math.pow(1 - k, decay) * (i < 400 ? i / 400 : 1);
      }
    }
    return buf;
  }

  setMood(m: Mood) {
    if (m === this.next) return;
    this.next = m;
    // la couleur change tout de suite, l'harmonie au prochain accord
    this.applyFilter(4);
  }
  getMood() { return this.next; }
  setTension(v: number) { this.tension = v; }
  setPowered(v: boolean) { this.powered = v; this.applyFilter(3); }
  private applyFilter(time: number) {
    const def = MOODS[this.next];
    const cut = def.cut * (this.powered ? 1 : 0.6) * this.brightness;
    this.padFilter.frequency.setTargetAtTime(cut, this.ctx.currentTime, time);
  }

  /** Ouverture lumineuse (découverte) : le filtre s'ouvre et un arpège monte. */
  swell() {
    const t = this.ctx.currentTime, def = MOODS[this.next];
    this.padFilter.frequency.cancelScheduledValues(t);
    this.padFilter.frequency.setTargetAtTime(Math.min(5000, def.cut * 2.6), t, 0.6);
    this.applyFilterLater(4.5);
    const ch = def.chords[this.chordIdx % def.chords.length];
    const tones = ch.slice(1).map((n) => n + 12).sort((a, b) => a - b);
    tones.forEach((n, i) => this.pluck(n, t + 0.05 + i * 0.13, 0.12, 0.3 + i * 0.12));
  }
  private applyFilterLater(delay: number) { window.setTimeout(() => !this.dead && this.applyFilter(3), delay * 1000); }

  private tick() {
    if (this.dead) return;
    this.scheduleUntil(this.ctx.currentTime + 0.25);
  }
  /** Programme tous les événements jusqu'à l'instant T (dans l'ordre du temps). */
  scheduleUntil(T: number) {
    for (;;) {
      if (this.nextChordAt <= this.nextStep && this.nextChordAt < T) this.chord(this.nextChordAt);
      else if (this.nextStep < T) this.stepAt(this.nextStep);
      else break;
    }
  }

  private chord(t: number) {
    if (this.next !== this.mood) { this.mood = this.next; this.chordIdx = 0; } else this.chordIdx++;
    const def = MOODS[this.mood];
    const beat = 60 / def.bpm;
    const len = beat * 16; // quatre mesures
    const ch = def.chords[this.chordIdx % def.chords.length];
    // relâche l'ancienne nappe en même temps que la nouvelle monte
    for (const v of this.padVoices) v.stop(t + 1.5);
    this.padVoices = [];
    ch.forEach((n, i) => this.padVoices.push(i === 0 ? this.bass(n, t, def.pad) : this.padNote(n, t, def.pad / (1 + i * 0.25))));
    this.nextChordAt = t + len;
    // la mélodie se recentre sur une note de l'accord
    const targets = ch.slice(1).flatMap((n) => [n + 12, n + 24]).filter((n) => n >= def.lo && n <= def.hi);
    if (targets.length) this.melody = targets.reduce((a, b) => (Math.abs(b - this.melody) < Math.abs(a - this.melody) ? b : a));
  }

  private padNote(m: number, t: number, amp: number) {
    const ctx = this.ctx, f = mtof(m);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03 * amp, t + 3.5);
    g.connect(this.padBus);
    const oscs: OscillatorNode[] = [];
    for (const [type, det, a] of [['sawtooth', -7, 0.6], ['sawtooth', 6, 0.6], ['triangle', 0, 1]] as [OscillatorType, number, number][]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det + (Math.random() - 0.5) * 3;
      const og = ctx.createGain(); og.gain.value = a; o.connect(og); og.connect(g);
      // vibrato très lent (chorus naturel)
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.1 + Math.random() * 0.15;
      const lg = ctx.createGain(); lg.gain.value = 4; lfo.connect(lg); lg.connect(o.detune);
      o.start(t); lfo.start(t); oscs.push(o, lfo);
    }
    return {
      stop: (at: number) => {
        g.gain.cancelScheduledValues(at); g.gain.setTargetAtTime(0.0001, at, 1.6);
        oscs.forEach((o) => o.stop(at + 8));
      },
    };
  }

  private bass(m: number, t: number, amp: number) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(m);
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = mtof(m + 12);
    const g2 = ctx.createGain(); g2.gain.value = 0.55; o2.connect(g2);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.04 * amp, t + 2.5);
    o.connect(g); g2.connect(g); g.connect(this.out);
    o.start(t); o2.start(t);
    return { stop: (at: number) => { g.gain.cancelScheduledValues(at); g.gain.setTargetAtTime(0.0001, at, 1.2); o.stop(at + 7); o2.stop(at + 7); } };
  }

  private stepAt(t: number) {
    const def = MOODS[this.mood];
    const half = 30 / def.bpm;
    this.nextStep = t + half;
    const n = this.stepN++;
    const bar = n % 8 === 0;
    // impulsion basse en cas de tension (station)
    if (this.tension > 0.05 && n % 2 === 0) this.pulse(t, def);
    // mélodie : marche aléatoire douce, phrases avec respirations
    const phrasePos = n % 32;
    const rest = phrasePos >= 26; // fin de phrase : silence
    const accent = n % 4 === 0 ? 1.4 : 1;
    if (!rest && Math.random() < def.pluck * accent) {
      this.melody = this.walk(this.melody, def);
      const swing = n % 2 ? half * 0.08 : 0;
      this.pluck(this.melody, t + swing, 0.13 + Math.random() * 0.06, 1.6 + Math.random());
      // parfois une tierce ou quinte en écho
      if (Math.random() < 0.18) this.pluck(this.melody - (Math.random() < 0.5 ? 5 : 7), t + swing + half * 0.5, 0.06, 1.4);
    }
    if (bar && Math.random() < def.bell) {
      const ch = def.chords[this.chordIdx % def.chords.length];
      this.bell(ch[1 + Math.floor(Math.random() * (ch.length - 1))] + 24, t + Math.random() * half);
    }
  }

  private walk(cur: number, def: MoodDef) {
    const ch = def.chords[this.chordIdx % def.chords.length].map((n) => ((n % 12) + 12) % 12);
    const ok = (m: number) => m >= def.lo && m <= def.hi && (ch.includes(m % 12) || def.scale.includes(m % 12));
    const steps = [-5, -3, -2, -1, 1, 2, 3, 4, 5, 7, -7];
    const w = [1, 2, 4, 2, 2, 4, 2, 1, 1, 0.5, 0.5];
    for (let tries = 0; tries < 12; tries++) {
      let r = Math.random() * w.reduce((a, b) => a + b), i = 0;
      while ((r -= w[i]) > 0) i++;
      const c = cur + steps[i];
      // préfère les notes de l'accord sur les temps forts
      if (ok(c) && (ch.includes(c % 12) || Math.random() < 0.45)) return c;
    }
    return Math.min(def.hi, Math.max(def.lo, cur));
  }

  /** Note pincée en synthèse FM (entre kalimba et vibraphone). */
  private pluck(m: number, t: number, amp: number, dec: number) {
    const ctx = this.ctx, f = mtof(m);
    const car = ctx.createOscillator(); car.type = 'sine'; car.frequency.value = f;
    const mod = ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = f * 3.01;
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.35);
    mod.connect(mg); mg.connect(car.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    const pan = ctx.createStereoPanner(); pan.pan.value = (Math.random() - 0.5) * 0.9;
    car.connect(g); g.connect(pan); pan.connect(this.leadBus);
    car.start(t); mod.start(t); car.stop(t + dec + 0.1); mod.stop(t + dec + 0.1);
  }

  /** Cloche lointaine aux partiels inharmoniques. */
  private bell(m: number, t: number) {
    const ctx = this.ctx, f = mtof(m);
    const pan = ctx.createStereoPanner(); pan.pan.value = (Math.random() - 0.5) * 1.4;
    pan.connect(this.leadBus);
    for (const [r, a, d] of [[1, 0.05, 5], [2.76, 0.022, 3], [5.4, 0.012, 1.8], [8.93, 0.006, 1]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * r;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(pan); o.start(t); o.stop(t + d + 0.1);
    }
  }

  private pulse(t: number, def: MoodDef) {
    const ctx = this.ctx, ch = def.chords[this.chordIdx % def.chords.length];
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(ch[0] + 12);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4;
    lp.frequency.setValueAtTime(900 * (0.5 + this.tension), t); lp.frequency.exponentialRampToValueAtTime(120, t + 0.25);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07 * this.tension, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(lp); lp.connect(g); g.connect(this.out); g.connect(this.delayIn);
    o.start(t); o.stop(t + 0.35);
  }

  stop() {
    this.dead = true; clearInterval(this.timer);
    const t = this.ctx.currentTime;
    this.out.gain.setTargetAtTime(0, t, 1.2);
    for (const v of this.padVoices) v.stop(t);
    window.setTimeout(() => this.out.disconnect(), 9000);
  }
}
