<script>
"use strict";
/* =====================================================================
   SON — musique d’ambiance et bruitages entièrement synthétisés (Web Audio).
   Aucune musique existante : chaque thème est engendré à partir d’une gamme,
   d’un tempo et d’un style décrits dans les données du personnage.
   ===================================================================== */
const AUDIO = {
  ctx: null, music: null, fx: null, timer: null, step: 0, next: 0, spec: null, phrase: null,
  musicOn: STORE.getSetting("music", true), sfxOn: STORE.getSetting("sfx", true),

  ensure(){
    if (AUDIO.ctx) { if (AUDIO.ctx.state === "suspended") AUDIO.ctx.resume().catch(() => {}); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
      AUDIO.ctx = new AC();
      AUDIO.music = AUDIO.ctx.createGain(); AUDIO.music.gain.value = AUDIO.musicOn ? .5 : 0; AUDIO.music.connect(AUDIO.ctx.destination);
      AUDIO.fx = AUDIO.ctx.createGain(); AUDIO.fx.gain.value = AUDIO.sfxOn ? .6 : 0; AUDIO.fx.connect(AUDIO.ctx.destination);
      return true;
    } catch (e) { return false; }
  },
  setMusic(on){ AUDIO.musicOn = on; STORE.setSetting("music", on); if (AUDIO.ctx) AUDIO.music.gain.setTargetAtTime(on ? .5 : 0, AUDIO.ctx.currentTime, .2); if (on) AUDIO.theme(AUDIO.spec); },
  setSfx(on){ AUDIO.sfxOn = on; STORE.setSetting("sfx", on); if (AUDIO.ctx) AUDIO.fx.gain.setTargetAtTime(on ? .6 : 0, AUDIO.ctx.currentTime, .05); },

  tone(dest, { f = 440, f2 = null, t = 0, d = .2, type = "sine", g = .2, a = .005 }){
    const c = AUDIO.ctx, o = c.createOscillator(), v = c.createGain(); const t0 = c.currentTime + t;
    o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
    v.gain.setValueAtTime(0, t0); v.gain.linearRampToValueAtTime(g, t0 + a); v.gain.exponentialRampToValueAtTime(.0008, t0 + d);
    o.connect(v); v.connect(dest); o.start(t0); o.stop(t0 + d + .05);
  },
  noise(dest, { t = 0, d = .2, g = .2, freq = 1000, q = .7, type = "lowpass", a = .003 }){
    const c = AUDIO.ctx; const len = Math.max(1, Math.floor(c.sampleRate * d)); const buf = c.createBuffer(1, len, c.sampleRate); const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = freq; fl.Q.value = q; const v = c.createGain(); const t0 = c.currentTime + t;
    v.gain.setValueAtTime(0, t0); v.gain.linearRampToValueAtTime(g, t0 + a); v.gain.exponentialRampToValueAtTime(.0008, t0 + d);
    src.connect(fl); fl.connect(v); v.connect(dest); src.start(t0);
  },

  /* Bruitages */
  sfx(name){
    if (!AUDIO.sfxOn || !AUDIO.ensure()) return; const d = AUDIO.fx, T = o => AUDIO.tone(d, o), Nz = o => AUDIO.noise(d, o);
    try {
      switch (name) {
        case "click": T({ f: 720, f2: 520, d: .05, g: .12, type: "triangle" }); break;
        case "paper": Nz({ d: .18, g: .12, freq: 3200, type: "highpass" }); Nz({ t: .09, d: .12, g: .08, freq: 2400, type: "bandpass" }); break;
        case "notify": T({ f: 660, d: .16, g: .14 }); T({ f: 990, t: .12, d: .26, g: .12 }); break;
        case "event": T({ f: 392, d: .5, g: .12, type: "triangle" }); T({ f: 587, t: .18, d: .6, g: .1, type: "triangle" }); Nz({ d: .25, g: .05, freq: 1800, type: "bandpass" }); break;
        case "cannon": Nz({ d: .9, g: .5, freq: 320 }); T({ f: 90, f2: 32, d: .7, g: .5 }); Nz({ t: .28, d: .7, g: .22, freq: 220 }); T({ f: 70, f2: 30, t: .28, d: .6, g: .25 }); break;
        case "crowd": for (let i = 0; i < 6; i++) Nz({ t: i * .12, d: 1.1, g: .07, freq: 700 + Math.random() * 900, q: 1.4, type: "bandpass", a: .25 }); break;
        case "drum": [0, .11, .22, .4].forEach((t, i) => Nz({ t, d: .09, g: i === 3 ? .28 : .16, freq: 1900, q: 1.2, type: "bandpass" })); break;
        case "victory": [0, 4, 7, 12].forEach((n, i) => T({ f: 293.66 * Math.pow(2, n / 12), t: i * .14, d: .5, g: .16, type: "triangle" })); break;
        case "defeat": [7, 3, 0, -5].forEach((n, i) => T({ f: 220 * Math.pow(2, n / 12), t: i * .22, d: .7, g: .14, type: "triangle" })); break;
        case "error": T({ f: 150, d: .16, g: .14, type: "square" }); break;
        case "whistle": T({ f: 2300, d: .22, g: .1, type: "square" }); T({ f: 2500, t: .02, d: .22, g: .06, type: "square" }); T({ f: 2300, t: .34, d: .5, g: .1, type: "square" }); break;
        case "goal": for (let i = 0; i < 8; i++) Nz({ t: i * .08, d: 1.6, g: .09, freq: 600 + Math.random() * 1200, q: 1.2, type: "bandpass", a: .12 }); T({ f: 392, d: .25, g: .1, type: "triangle" }); T({ f: 523, t: .12, d: .25, g: .1, type: "triangle" }); T({ f: 659, t: .24, d: .5, g: .12, type: "triangle" }); break;
        case "death": T({ f: 110, d: 2.4, g: .2, type: "triangle" }); T({ f: 130.8, t: .05, d: 2.4, g: .12 }); Nz({ d: 1.6, g: .05, freq: 300 }); break;
      }
    } catch (e) {}
  },

  /* Musique : boucle engendrée à partir de la description du thème */
  theme(spec){
    AUDIO.spec = spec || AUDIO.spec; clearInterval(AUDIO.timer); AUDIO.timer = null;
    if (!AUDIO.spec || !AUDIO.musicOn || !AUDIO.ensure()) return;
    const sp = AUDIO.spec; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // Une phrase de 32 temps, fixée une fois pour que le thème soit reconnaissable
    let deg = 4; AUDIO.phrase = Array.from({ length: 32 }, (_, i) => { if (i % 8 === 7) return null; if (rnd() < .28) return null; deg = clamp(deg + Math.round((rnd() - .5) * 4), 0, 9); if (i % 16 === 14) deg = 4; if (i === 30) deg = 0; return deg; });
    AUDIO.step = 0; AUDIO.next = AUDIO.ctx.currentTime + .1;
    const beat = 60 / sp.tempo, six = beat / 4;
    const note = d => sp.root * Math.pow(2, (sp.scale[d % sp.scale.length] + 12 * Math.floor(d / sp.scale.length)) / 12);
    AUDIO.timer = setInterval(() => {
      if (!AUDIO.ctx || AUDIO.ctx.state !== "running" || !AUDIO.musicOn) return;
      while (AUDIO.next < AUDIO.ctx.currentTime + .35) {
        const st = AUDIO.step, t = AUDIO.next - AUDIO.ctx.currentTime, bar = Math.floor(st / 16), pos = st % 16, m = AUDIO.music;
        if (sp.style === "marche") {
          if ([0, 4, 6, 7, 8, 12, 14, 15].includes(pos)) AUDIO.noise(m, { t, d: .07, g: pos % 8 === 0 ? .09 : .045, freq: 2100, q: 1.1, type: "bandpass" });
          if (pos === 0) { AUDIO.tone(m, { f: sp.root / 2, t, d: beat * 3.8, g: .09, type: "triangle", a: .08 }); AUDIO.tone(m, { f: sp.root / 2 * (bar % 4 === 2 ? 1.335 : 1.498), t, d: beat * 3.8, g: .05, a: .1 }); }
          if (pos === 0 || pos === 8) AUDIO.noise(m, { t, d: .22, g: .08, freq: 130 });
        }
        if (sp.style === "stade") {
          if (pos % 4 === 0) { AUDIO.tone(m, { f: 120, f2: 45, t, d: .16, g: .16 }); }
          if (pos % 4 === 2) AUDIO.noise(m, { t, d: .04, g: .03, freq: 7000, type: "highpass" });
          if (pos === 4 || pos === 12) AUDIO.noise(m, { t, d: .1, g: .05, freq: 1800, q: .9, type: "bandpass" });
          if ([0, 3, 6, 10].includes(pos)) AUDIO.tone(m, { f: sp.root / 2 * Math.pow(2, sp.scale[[0, 0, 3, 2][Math.floor(bar / 2) % 4]] / 12), t, d: six * 2.4, g: .09, type: "sawtooth", a: .01 });
          if (bar % 8 >= 4 && pos % 2 === 0) { const dg = AUDIO.phrase[(bar * 8 + pos / 2) % 32]; if (dg !== null && dg !== undefined) AUDIO.tone(m, { f: note(dg % 8), t, d: six * 1.6, g: .028, type: "square", a: .005 }); }
        }
        if (sp.style !== "stade" && pos % 4 === 0 && bar % 16 < 8) { const dg = AUDIO.phrase[(bar % 8) * 4 + pos / 4]; if (dg !== null && dg !== undefined) AUDIO.tone(m, { f: note(dg) * 2, t, d: beat * 1.7, g: .055, type: "triangle", a: .03 }); }
        AUDIO.step++; AUDIO.next += six;
      }
    }, 110);
  },
  stopTheme(){ clearInterval(AUDIO.timer); AUDIO.timer = null; }
};
/* Les navigateurs n’autorisent le son qu’après un geste : on démarre au premier toucher */
document.addEventListener("pointerdown", () => { if (AUDIO.ensure() && AUDIO.spec && !AUDIO.timer && AUDIO.musicOn) AUDIO.theme(); }, { passive: true });
</script>
