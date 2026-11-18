<script>
"use strict";
/* =====================================================================
   MOTEUR — temps (semaine), effets, santé, mort, événements, mémoire
   ===================================================================== */
const SAVE_VERSION = 3;
const MONTHS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const parseD = d => { const [y, m, dd] = String(d).split("-").map(Number); return { y, m: m || 1, d: dd || 1 }; };
const fmtD = (y, m, d) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const frDate = d => { const p = parseD(d); return `${p.d === 1 ? "1er" : p.d} ${MONTHS[p.m - 1]} ${p.y}`; };
const frMonth = d => { const p = parseD(d); return `${MONTHS[p.m - 1]} ${p.y}`; };
const addDays = (d, n) => { const p = parseD(d); const t = new Date(Date.UTC(2000, p.m - 1, p.d)); t.setUTCFullYear(p.y); t.setUTCDate(t.getUTCDate() + n); return fmtD(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); };
const addMonths = (d, n) => { const p = parseD(d); let m = p.m - 1 + n; const y = p.y + Math.floor(m / 12); m = ((m % 12) + 12) % 12; return fmtD(y, m + 1, Math.min(p.d, 28)); };
const yearsBetween = (a, b) => { const A = parseD(a), B = parseD(b); let y = B.y - A.y; if (B.m < A.m || (B.m === A.m && B.d < A.d)) y--; return y; };
const pickW = arr => { const tot = arr.reduce((t, x) => t + (x.w || 1), 0); let r = Math.random() * tot; for (const x of arr) { r -= (x.w || 1); if (r <= 0) return x; } return arr[arr.length - 1]; };
const WEEK = 7 / 30.4375;   // fraction de mois écoulée en une semaine

const GAME = {
  s: null,
  ch: s => CHARACTERS[(s || GAME.s).char],
  age: s => yearsBetween(GAME.ch(s).born, s.date),
  power: s => (GAME.ch(s).ranks[s.rank] || { power: 0 }).power,
  rankLabel: s => (GAME.ch(s).ranks[s.rank] || { label: s.rank }).label,
  statDef: (s, id) => GAME.ch(s).stats.find(x => x.id === id),
  relDef: (s, id) => GAME.ch(s).relations.find(x => x.id === id),
  relKnown: (s, id) => { const r = GAME.relDef(s, id); return !!r && r.from <= s.date; },
  relAlive: (s, id) => GAME.relKnown(s, id) && !s.deadRel[id],
  hasHeir: s => s.family.children.length > 0 || !!s.family.heir,
  relStatus: v => v >= 40 ? "allie" : v >= -15 ? "neutre" : v >= -50 ? "rival" : "ennemi",
  relStatusLabel: { allie: "Allié", neutre: "Neutre", rival: "Rival", ennemi: "Ennemi", mort: "Décédé" },
  canAct: s => !s.dead && s.actionWeek !== s.week,

  newGame(charId, startId, slot){
    const ch = CHARACTERS[charId]; const st = ch.starts.find(x => x.id === startId) || ch.starts[0];
    const stats = {}; for (const d of ch.stats) stats[d.id] = st.stats[d.id] ?? 50;
    const rel = {}; for (const r of ch.relations) rel[r.id] = st.rel?.[r.id] ?? r.start ?? 0;
    const done = {}; for (const e of ch.events) if (e.date < st.date) done[e.id] = "pre"; for (const id of (st.done || [])) done[id] = "pre";
    const s = {
      v: SAVE_VERSION, char: charId, mode: "carriere", slot, startId: st.id, startDate: st.date, date: st.date, week: 0,
      stats, prev: { ...stats }, rel, flags: { ...(st.flags || {}) }, rank: st.rank, scene: st.scene, place: st.place,
      family: { spouse: st.family?.spouse || null, spouseName: null, exSpouses: [...(st.family?.exSpouses || [])], children: [...(st.family?.children || [])], heir: null },
      conditions: [], done, history: [], feed: [], journal: [], deferred: [], deadRel: {},
      counters: { battlesWon: 0, battlesLost: 0, reforms: 0, treaties: 0, weeks: 0, maxDep: stats.departements || 0, popSum: 0, powerWeeks: 0, ...(st.counters || {}) },
      nextRandomIn: 6, nextRivalIn: 8, nextMailIn: 3, recentRandom: [], actionWeek: -1, corr: {}, corrQueue: [], fin: [], where: null, feedN: 0, dead: null, pending: null, speed: 0, savedAt: null
    };
    for (const r of ch.relations) if (r.dies && r.dies.date <= s.date) s.deadRel[r.id] = r.dies.date;
    if (ch.setup) ch.setup(s, st.id, false);
    GAME.news(s, { src: "Carnet", title: st.title, text: st.summary, tone: "key" });
    return s;
  },

  /* Fil d’actualité : articles, dépêches et notes */
  news(s, it){
    const ch = GAME.ch(s); const src = it.src || "Carnet";
    const cat = it.cat || (ch.newsCat ? ch.newsCat(src) : "sys");
    let ton = { favorable: "fav", hostile: "hos", neutre: "neu", fav: "fav", hos: "hos", neu: "neu" }[String(it.ton || "").toLowerCase()] || (cat === "sys" ? "" : "neu");
    // Effet visible de l’article sur l’opinion, en France ou à l’étranger
    let fx = null;
    if (cat !== "sys" && ton && ton !== "neu" && s.stats.popularite !== undefined) {
      const sign = ton === "fav" ? 1 : -1;
      if (cat === "etr") { const v = -sign * .4; s.stats.coalition = clamp(s.stats.coalition + v, 0, 100); fx = { k: "étranger", v: sign * .4 }; }
      else { const v = sign * (cat === "rum" ? .6 : 1); s.stats.popularite = clamp(s.stats.popularite + v, 0, 100); fx = { k: "France", v }; }
    }
    s.feed.unshift({ d: s.date, src, title: it.title || "", text: it.text || "", tone: it.tone || "", kind: it.kind || "", cat, ton, fx });
    s.feedN = (s.feedN || 0) + 1; if (s.feed.length > 220) s.feed.length = 220;
  },
  log(s, t, tone = "", src){ GAME.news(s, { src: src || "Carnet", text: t, tone }); },

  /* Applique un bloc d’effets. Renvoie les variations pour l’affichage. */
  applyFx(s, fx, out = { deltas: {}, rels: {}, notes: [], death: null }){
    if (!fx) return out;
    const ch = GAME.ch(s); const hooks = ch.statHooks || {};
    const setStat = (k, nv) => { const d = GAME.statDef(s, k); if (!d) return; const before = s.stats[k]; if (hooks[k]) { hooks[k].set(s, clamp(nv, d.min, d.max)); ch.sync && ch.sync(s); } else s.stats[k] = clamp(nv, d.min, d.max); out.deltas[k] = (out.deltas[k] || 0) + (s.stats[k] - before); };
    const addStat = (k, v) => { const d = GAME.statDef(s, k); if (!d || typeof v !== "number" || !isFinite(v) || !v) return; const before = s.stats[k]; if (hooks[k]) { hooks[k].add(s, v); ch.sync && ch.sync(s); } else s.stats[k] = clamp(before + v, d.min, d.max); out.deltas[k] = (out.deltas[k] || 0) + (s.stats[k] - before); };
    if (fx.preset && ch.applyPreset) ch.applyPreset(s, fx.preset, false);
    if (fx.set) for (const [k, v] of Object.entries(fx.set)) setStat(k, v);
    if (fx.s) for (const [k, v] of Object.entries(fx.s)) addStat(k, v);
    if (fx.r) for (const [k, v] of Object.entries(fx.r)) { if (!(k in s.rel) || !GAME.relAlive(s, k) || typeof v !== "number") continue; const nv = clamp(s.rel[k] + v, -100, 100); out.rels[k] = (out.rels[k] || 0) + (nv - s.rel[k]); s.rel[k] = nv; }
    if (fx.spouseRel && s.family.spouse) { const k = s.family.spouse; const nv = clamp(s.rel[k] + fx.spouseRel, -100, 100); out.rels[k] = (out.rels[k] || 0) + (nv - s.rel[k]); s.rel[k] = nv; }
    if (fx.pays && s.pays) for (const [k, o] of Object.entries(fx.pays)) { const c = s.pays[k]; if (!c || !o) continue; if (o.statut && o.statut !== c.statut) { c.statut = o.statut; if (o.statut !== "guerre") c.ws = 0; out.notes.push(`${ch.regionName(k)} : ${ch.map.statusLabel[o.statut].toLowerCase()}.`); } if (typeof o.rel === "number") c.rel = clamp(c.rel + o.rel, -100, 100); if (typeof o.armee === "number") c.armee = Math.max(0, c.armee + o.armee); if (typeof o.ws === "number") c.ws = clamp((c.ws || 0) + o.ws, -100, 100); if (typeof o.pression === "number") c.pression = clamp((c.pression || 0) + o.pression, 0, 100); }
    if (fx.paysAll && s.pays) for (const c of Object.values(s.pays)) if (c.statut === "guerre") { c.statut = fx.paysAll; c.ws = 0; }
    if (fx.moveCorps && s.corps) for (const c of s.corps) if (c.loc !== "espagne" || fx.moveCorps === "espagne" || s.corps.length <= 3) { c.loc = fx.moveCorps; c.dest = null; c.eta = null; }
    if (fx.moveCorps) s.where = fx.moveCorps; else if (fx.place && (fx.scene === "palais" || fx.scene === "paris")) s.where = "france";
    if (fx.thr && s.thrones) Object.assign(s.thrones, fx.thr);
    if (typeof fx.depot === "number" && "depot" in s) s.depot = Math.max(0, s.depot + fx.depot);
    if (fx.f) Object.assign(s.flags, fx.f);
    if (fx.c) for (const [k, v] of Object.entries(fx.c)) s.counters[k] = (s.counters[k] || 0) + v;
    if (fx.rank && fx.rank !== s.rank) { s.rank = fx.rank; out.notes.push(`Nouveau titre : ${GAME.rankLabel(s)}.`); }
    if (fx.scene) s.scene = fx.scene;
    if (fx.place) s.place = fx.place;
    if ("spouse" in fx) { if (fx.ex) s.family.exSpouses.push(fx.ex); s.family.spouse = fx.spouse; s.family.spouseName = fx.spouseName || null; if (fx.spouse || fx.spouseName) out.notes.push(`Mariage : ${fx.spouseName || GAME.relDef(s, fx.spouse).name}.`); else if (fx.ex) out.notes.push("Divorce prononcé."); }
    if (fx.child) { s.family.children.push({ name: fx.child.name, born: s.date }); out.notes.push(`Naissance : ${fx.child.name}.`); }
    if (fx.heir) { s.family.heir = fx.heir; out.notes.push(`Héritier désigné : ${fx.heir}.`); }
    if (fx.danger && !out.death) { const p = clamp(+fx.danger.p || 0, 0, .3); if (Math.random() < p) out.death = { type: fx.danger.type || "accident", cause: fx.danger.cause || "Mort brutale." }; }
    if (fx.gamble) { const g = fx.gamble; const v = s.rel[g.rel] ?? 0; const p = clamp(.35 + (v - g.threshold) / 120, .05, .9); const ok = Math.random() < p; out.notes.push(g[ok ? "win" : "loss"].txt); GAME.applyFx(s, g[ok ? "win" : "loss"], out); }
    ch.sync && ch.sync(s);
    return out;
  },

  /* Résolution rapide d’une bataille (quand le joueur délègue) */
  quickBattle(s, b){
    const st = s.stats;
    let p = b.base + (st.moral - 60) * .003 + (st.loyaute - 55) * .0015 - Math.max(0, st.fatigue - 60) * .002;
    if (b.need) p += clamp((st.armee - b.need) / b.need * .15, -.25, .12);
    const win = Math.random() < clamp(p, .04, .95);
    return { win, lossPct: win ? .08 + Math.random() * .08 : .15 + Math.random() * .15, quick: true };
  },
  /* Applique l’issue d’une bataille (tactique ou rapide) */
  battleOutcome(s, b, res, out){
    out.battle = { name: b.name, win: res.win };
    s.counters[res.win ? "battlesWon" : "battlesLost"]++;
    s.lastBattle = { name: b.name, win: res.win, week: s.week, used: false };
    const r = res.win ? b.win : b.loss;
    if (r) { const copy = JSON.parse(JSON.stringify(r)); if (!res.quick && copy.s && copy.s.armee < 0) delete copy.s.armee; GAME.applyFx(s, copy, out); if (r.txt) out.notes.unshift(r.txt); }
    if (res.quick && s.corps) { for (const c of s.corps) if (c.loc !== "espagne" || b.region === "espagne") c.men *= 1 - res.lossPct * .5; GAME.ch(s).sync(s); }
    const risk = b.risk ?? .006;
    if (!out.death && Math.random() < risk * (res.win ? 1 : 2.2)) out.death = { type: "bataille", cause: `Tué à la bataille de ${b.name}.` };
    return out;
  },

  /* Avance d’une semaine */
  tick(s){
    const ch = GAME.ch(s);
    s.prev = { ...s.stats };
    s.date = addDays(s.date, ch.unit.days || 7);
    s.week++; s.counters.weeks++;
    const p = parseD(s.date); const dt = WEEK;
    const h = {
      age: GAME.age(s), month: p.m - 1, dt,
      add: (k, v) => { const d = GAME.statDef(s, k); if (!d) return; const hk = ch.statHooks && ch.statHooks[k]; if (hk) hk.add(s, v * dt); else s.stats[k] = clamp(s.stats[k] + v * dt, d.min, d.max); },
      drift: (k, target, rate) => { const d = GAME.statDef(s, k); if (d) s.stats[k] = clamp(s.stats[k] + (target - s.stats[k]) * rate * dt, d.min, d.max); },
      chance: pm => Math.random() < pm * dt,
      fx: fx => GAME.applyFx(s, fx),
      condition: (id, name, sev) => { if (!s.conditions.find(c => c.id === id)) { s.conditions.push({ id, name, sev, since: s.date }); GAME.log(s, `Santé : ${name}.`, "bad"); } },
      hasCondition: id => !!s.conditions.find(c => c.id === id)
    };
    const msgs = ch.tick.call(ch, s, h) || [];
    for (const m of msgs) GAME.log(s, m.t, m.tone, m.src);
    for (const c of [...s.conditions]) {
      s.stats.sante = clamp(s.stats.sante - c.sev * dt, 0, 100);
      if (c.id === "cancer") c.sev = Math.min(4, c.sev + .045 * dt);
      if (c.id === "typhus" && Math.random() < .3 * dt) { s.conditions = s.conditions.filter(x => x !== c); GAME.log(s, "Vous vous remettez du typhus.", "good"); }
    }
    for (const r of ch.relations) {
      if (!s.deadRel[r.id] && r.dies && r.dies.date <= s.date && (!r.dies.cond || r.dies.cond(s))) {
        s.deadRel[r.id] = s.date; GAME.log(s, `${r.name} : ${r.dies.cause}.`, "bad");
        if (s.family.spouse === r.id) { s.family.spouse = null; GAME.log(s, "Vous voilà veuf.", "bad"); s.stats.stress = clamp(s.stats.stress + 12, 0, 100); }
      }
    }
    // Conséquences différées arrivées à échéance
    const fired = [];
    for (const d of [...s.deferred]) if (d.date <= s.date) { s.deferred = s.deferred.filter(x => x !== d); const o = GAME.applyFx(s, d.fx); GAME.news(s, { src: d.src || "Conséquence", title: d.title, text: d.text, tone: "key", kind: "differe" }); const j = s.journal.find(x => x.id === d.from); if (j) (j.suites = j.suites || []).push({ d: s.date, t: d.title }); fired.push({ d, o }); }
    // Finances : un relevé par mois pour le graphique
    if (ch.budget && s.week % 4 === 0) { const bu = ch.budget(s); s.fin.push({ d: s.date, t: s.stats.tresor, R: bu.R, D: bu.D }); if (s.fin.length > 14) s.fin.shift(); }
    // Courrier : lettres arrivées chez leur destinataire, réponses arrivées chez vous
    const arrived = [], mail = [];
    for (const [id, th] of Object.entries(s.corr)) for (const m of th) if (m.me && m.arrive && !m.asked && m.arrive <= s.date) { m.asked = true; arrived.push({ id, m }); }
    for (const q of [...s.corrQueue]) if (q.at <= s.date) { s.corrQueue = s.corrQueue.filter(x => x !== q); if (!GAME.relAlive(s, q.id)) continue; (s.corr[q.id] = s.corr[q.id] || []).push({ d: s.date, me: false, t: q.t, unread: true }); if (q.rel) GAME.applyFx(s, { r: { [q.id]: q.rel } }); mail.push(q); }
    const b = parseD(ch.born); if (p.m === b.m && p.d >= b.d && p.d < b.d + 7) GAME.log(s, `Vous avez ${GAME.age(s)} ans.`);
    ch.sync && ch.sync(s);
    s.counters.maxDep = Math.max(s.counters.maxDep || 0, s.stats.departements || 0);
    s.counters.popSum = (s.counters.popSum || 0) + (s.stats.popularite || 0);
    if (GAME.power(s) >= 2) s.counters.powerWeeks = (s.counters.powerWeeks || 0) + 1;
    return { death: GAME.mortality(s, dt), fired, arrived, mail };
  },

  mortality(s, dt){
    const ch = GAME.ch(s); const age = GAME.age(s); const st = s.stats;
    const worst = [...s.conditions].filter(c => c.sev >= .5).sort((a, b) => b.sev - a.sev)[0];
    if (st.sante <= 0) return { type: "maladie", cause: worst ? `Emporté par la maladie (${worst.name.toLowerCase()}), à ${age} ans.` : `Mort d’épuisement, le corps usé, à ${age} ans.` };
    const condLoad = s.conditions.reduce((t, c) => t + c.sev, 0);
    const nat = (.00035 * Math.exp(.088 * (age - 40)) * (1 + Math.max(0, 65 - st.sante) / 14) + condLoad * .0012) * dt;
    const plot = (ch.plotHazard ? ch.plotHazard(s) : 0) * dt;
    const acc = .00012 * dt;
    const r = Math.random();
    if (age >= 99 || r < nat) {
      if (age >= 72) return { type: "vieillesse", cause: `Mort de vieillesse, à ${age} ans.` };
      return { type: "maladie", cause: worst ? `Emporté par la maladie (${worst.name.toLowerCase()}), à ${age} ans.` : `Foudroyé par une attaque d’apoplexie, à ${age} ans.` };
    }
    if (r < nat + plot) return { type: "assassinat", cause: ch.plotCause ? ch.plotCause(s) : "Assassiné." };
    if (r < nat + plot + acc) return { type: "accident", cause: "Mort dans un accident de voiture, les chevaux s’étant emballés." };
    return null;
  },

  dueHistorical(s){
    const ch = GAME.ch(s);
    for (const e of ch.events) {
      if (s.done[e.id]) continue;
      const until = e.until || addMonths(e.date, 4);
      if (e.date <= s.date && s.date <= until) { let ok = true; try { ok = !e.cond || !!e.cond(s); } catch (err) { ok = false; } if (ok) return e; }
    }
    return null;
  },
  pickFallback(s){
    const ch = GAME.ch(s);
    const pool = ch.randomEvents.filter(e => { if (e.once && s.done[e.id]) return false; if (s.recentRandom.includes(e.id)) return false; try { return !e.cond || e.cond(s); } catch (err) { return false; } });
    return pool.length ? pickW(pool) : null;
  },

  /* Rivaux : progression écrite d’avance, utilisée quand l’IA ne répond pas */
  rivalsScripted(s){
    const ch = GAME.ch(s); const out = [];
    const r = ch.rivals[Math.floor(Math.random() * ch.rivals.length)]; const v = s.rivals[r.id]; const plan = r.plans[v.i % r.plans.length];
    v.prog = clamp(v.prog + 18 + Math.round(Math.random() * 22), 0, 100);
    if (v.prog >= 100) {
      GAME.applyFx(s, plan.done); out.push({ src: ch.newsSources(s)[1], title: plan.title, text: `${r.name} est parvenu à ses fins : ${plan.plan.toLowerCase()}.`, tone: "bad", kind: "rival" });
      if (plan.war && s.pays[r.id] && s.pays[r.id].statut === "paix" && s.pays[r.id].rel <= plan.war) { GAME.applyFx(s, { pays: { [r.id]: { statut: "guerre", rel: -20 } }, s: { coalition: 8 } }); out.push({ src: ch.newsSources(s)[0], title: `${ch.regionName(r.id)} déclare la guerre`, text: "Les ambassadeurs ont demandé leurs passeports. Les armées sont en marche.", tone: "bad", kind: "rival" }); }
      v.i++; v.prog = 0; v.plan = r.plans[v.i % r.plans.length].plan;
    } else out.push({ src: ch.newsSources(s)[Math.min(4, ch.newsSources(s).length - 1)], title: plan.news[Math.floor(Math.random() * plan.news.length)], text: "", kind: "rival" });
    for (const n of out) GAME.news(s, n);
    return out;
  }
};

/* =====================================================================
   STOCKAGE — try/catch partout, format versionné et migration
   ===================================================================== */
const STORE = {
  key: n => `legacy.slot.${n}`,
  read(n){ try { const raw = localStorage.getItem(STORE.key(n)); return raw ? STORE.migrate(JSON.parse(raw)) : null; } catch (e) { return null; } },
  write(n, s){ try { s.savedAt = new Date().toISOString(); localStorage.setItem(STORE.key(n), JSON.stringify(s)); return true; } catch (e) { return false; } },
  remove(n){ try { localStorage.removeItem(STORE.key(n)); return true; } catch (e) { return false; } },
  getSetting(k, def){ try { const v = localStorage.getItem("legacy.set." + k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } },
  setSetting(k, v){ try { localStorage.setItem("legacy.set." + k, JSON.stringify(v)); } catch (e) {} },
  valid(s){ return !!s && typeof s === "object" && s.v === SAVE_VERSION && !!CHARACTERS[s.char] && typeof s.date === "string" && !!s.stats && !!s.rel && !!s.family && Array.isArray(s.feed); },
  /* Migre une sauvegarde d’un format antérieur vers le format courant. Renvoie null si elle est illisible. */
  migrate(s){
    try {
      if (!s || typeof s !== "object") return null;
      if (s.state && !s.char) s = s.state;
      if (!CHARACTERS[s.char] || !s.stats || !s.rel || !s.family) return null;
      if (!s.v || s.v < 2) {
        // v1 : tour mensuel, actions à délai, journal simple
        const ch = CHARACTERS[s.char];
        s.week = Math.round((s.counters?.months || 0) * 4.35);
        s.counters = { battlesWon: 0, battlesLost: 0, reforms: 0, treaties: 0, ...(s.counters || {}) };
        s.counters.weeks = s.week; s.counters.powerWeeks = Math.round((s.counters.powerMonths || 0) * 4.35); s.counters.popSum = (s.counters.popSum || 0) * 4.35;
        s.feed = (s.log || []).map(l => ({ d: l.d, src: "Carnet", title: "", text: l.t, tone: l.tone || "", kind: "" }));
        delete s.log; delete s.cooldowns;
        s.journal = []; s.deferred = []; s.actionWeek = -1; s.nextRandomIn = 6; s.nextRivalIn = 8; s.recentRandom = s.recentRandom || []; s.pending = null;
        s.history = s.history || []; s.done = s.done || {}; s.deadRel = s.deadRel || {}; s.conditions = s.conditions || []; s.flags = s.flags || {};
        for (const d of ch.stats) if (typeof s.stats[d.id] !== "number") s.stats[d.id] = 50;
        for (const r of ch.relations) if (typeof s.rel[r.id] !== "number") s.rel[r.id] = r.start || 0;
        if (ch.setup) ch.setup(s, null, true);
        s.v = 2;
        GAME.news(s, { src: "Carnet", title: "Partie reprise", text: "Cette partie vient d’une version précédente du jeu. Elle a été convertie : le temps avance désormais à la semaine.", tone: "key" });
      }
      if (s.v < 3) {
        // v2 : interface à panneaux ; v3 ajoute la correspondance, le relevé des finances et les ordres aux corps
        const ch = CHARACTERS[s.char];
        for (const r of ch.relations) if (typeof s.rel[r.id] !== "number") s.rel[r.id] = r.start || 0;
        for (const r of ch.relations) if (r.dies && r.dies.date <= s.date && !s.deadRel[r.id] && (!r.dies.cond || r.dies.cond(s))) s.deadRel[r.id] = r.dies.date;
        s.corr = s.corr || {}; s.corrQueue = s.corrQueue || []; s.fin = s.fin || []; s.where = s.where || null; s.nextMailIn = s.nextMailIn || 3; s.feedN = s.feed.length;
        if (ch.defaultPol) s.pol = { ...ch.defaultPol, ...(s.pol || {}) };
        for (const c of (s.corps || [])) c.stance = c.stance || "marche";
        for (const n of s.feed) { n.cat = n.cat || (ch.newsCat ? ch.newsCat(n.src) : "sys"); n.ton = n.ton || (n.cat === "sys" ? "" : "neu"); }
        s.v = 3;
      }
      return s;
    } catch (e) { return null; }
  }
};
</script>
