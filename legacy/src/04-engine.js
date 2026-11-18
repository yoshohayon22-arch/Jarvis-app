<script>
"use strict";
/* =====================================================================
   MOTEUR — temps, effets, batailles, santé, mort, événements
   ===================================================================== */
const MONTHS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const parseD = d => { const [y, m, dd] = d.split("-").map(Number); return { y, m, d: dd || 1 }; };
const fmtD = (y, m, d) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const frDate = d => { const p = parseD(d); return `${p.d === 1 ? "1er" : p.d} ${MONTHS[p.m - 1]} ${p.y}`; };
const frMonth = d => { const p = parseD(d); return `${MONTHS[p.m - 1]} ${p.y}`; };
const addMonths = (d, n) => { const p = parseD(d); let m = p.m - 1 + n; const y = p.y + Math.floor(m / 12); m = ((m % 12) + 12) % 12; return fmtD(y, m + 1, Math.min(p.d, 28)); };
const yearsBetween = (a, b) => { const A = parseD(a), B = parseD(b); let y = B.y - A.y; if (B.m < A.m || (B.m === A.m && B.d < A.d)) y--; return y; };
const pickW = arr => { const tot = arr.reduce((t, x) => t + (x.w || 1), 0); let r = Math.random() * tot; for (const x of arr) { r -= (x.w || 1); if (r <= 0) return x; } return arr[arr.length - 1]; };

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

  newGame(charId, startId, slot){
    const ch = CHARACTERS[charId]; const st = ch.starts.find(x => x.id === startId) || ch.starts[0];
    const stats = {}; for (const d of ch.stats) stats[d.id] = st.stats[d.id] ?? 50;
    const rel = {}; for (const r of ch.relations) rel[r.id] = st.rel?.[r.id] ?? r.start ?? 0;
    const done = {}; for (const id of (st.done || [])) done[id] = "pre";
    const s = {
      v: 1, char: charId, mode: "carriere", slot, startId: st.id, startDate: st.date, date: st.date,
      stats, prev: { ...stats }, rel, flags: { ...(st.flags || {}) }, rank: st.rank, scene: st.scene, place: st.place,
      family: { spouse: st.family?.spouse || null, spouseName: null, exSpouses: [...(st.family?.exSpouses || [])], children: [...(st.family?.children || [])], heir: null },
      conditions: [], cooldowns: {}, done, history: [], log: [], deadRel: {},
      counters: { battlesWon: 0, battlesLost: 0, reforms: 0, treaties: 0, months: 0, maxDep: stats.departements || 0, popSum: 0, ...(st.counters || {}) },
      nextRandomIn: 2, recentRandom: [], dead: null, pending: null, speed: 0, savedAt: null
    };
    // Relations déjà disparues avant la date de départ
    for (const r of ch.relations) if (r.dies && r.dies.date <= s.date) s.deadRel[r.id] = r.dies.date;
    GAME.log(s, `${st.title}. ${st.summary}`, "key");
    return s;
  },

  log(s, t, tone = ""){ s.log.unshift({ d: s.date, t, tone }); if (s.log.length > 90) s.log.length = 90; },

  /* Applique un bloc d’effets. Renvoie la liste des variations pour l’affichage. */
  applyFx(s, fx, out = { deltas: {}, rels: {}, notes: [], death: null }){
    if (!fx) return out;
    const ch = GAME.ch(s);
    if (fx.set) for (const [k, v] of Object.entries(fx.set)) { const d = GAME.statDef(s, k); if (!d) continue; const nv = clamp(v, d.min, d.max); out.deltas[k] = (out.deltas[k] || 0) + (nv - s.stats[k]); s.stats[k] = nv; }
    if (fx.s) for (const [k, v] of Object.entries(fx.s)) { const d = GAME.statDef(s, k); if (!d || typeof v !== "number" || !isFinite(v)) continue; const nv = clamp(s.stats[k] + v, d.min, d.max); out.deltas[k] = (out.deltas[k] || 0) + (nv - s.stats[k]); s.stats[k] = nv; }
    if (fx.r) for (const [k, v] of Object.entries(fx.r)) { if (!(k in s.rel) || !GAME.relAlive(s, k) || typeof v !== "number") continue; const nv = clamp(s.rel[k] + v, -100, 100); out.rels[k] = (out.rels[k] || 0) + (nv - s.rel[k]); s.rel[k] = nv; }
    if (fx.spouseRel && s.family.spouse) { const k = s.family.spouse; const nv = clamp(s.rel[k] + fx.spouseRel, -100, 100); out.rels[k] = (out.rels[k] || 0) + (nv - s.rel[k]); s.rel[k] = nv; }
    if (fx.f) Object.assign(s.flags, fx.f);
    if (fx.c) for (const [k, v] of Object.entries(fx.c)) s.counters[k] = (s.counters[k] || 0) + v;
    if (fx.rank && fx.rank !== s.rank) { s.rank = fx.rank; out.notes.push(`Nouveau titre : ${GAME.rankLabel(s)}`); }
    if (fx.scene) s.scene = fx.scene;
    if (fx.place) s.place = fx.place;
    if ("spouse" in fx) { if (fx.ex) { s.family.exSpouses.push(fx.ex); } s.family.spouse = fx.spouse; s.family.spouseName = fx.spouseName || null; if (fx.spouse || fx.spouseName) out.notes.push(`Mariage : ${fx.spouseName || GAME.relDef(s, fx.spouse).name}`); else if (fx.ex) out.notes.push("Divorce prononcé"); }
    if (fx.child) { s.family.children.push({ name: fx.child.name, born: s.date }); out.notes.push(`Naissance : ${fx.child.name}`); }
    if (fx.heir) { s.family.heir = fx.heir; out.notes.push(`Héritier désigné : ${fx.heir}`); }
    if (fx.danger && !out.death) { const p = clamp(+fx.danger.p || 0, 0, .3); if (Math.random() < p) out.death = { type: fx.danger.type || "accident", cause: fx.danger.cause || "Mort brutale." }; }
    if (fx.gamble) { const g = fx.gamble; const v = s.rel[g.rel] ?? 0; const p = clamp(.35 + (v - g.threshold) / 120, .05, .9); const ok = Math.random() < p; out.notes.push(g[ok ? "win" : "loss"].txt); out.gambleOk = ok; GAME.applyFx(s, g[ok ? "win" : "loss"], out); }
    return out;
  },

  /* Bataille : probabilité selon le plan choisi, le moral, la loyauté, les effectifs et la fatigue */
  battle(s, b, out){
    const st = s.stats;
    let p = b.base + (st.moral - 60) * .003 + (st.loyaute - 55) * .0015 - Math.max(0, st.fatigue - 60) * .002;
    if (b.need) p += clamp((st.armee - b.need) / b.need * .15, -.25, .12);
    p = clamp(p, .04, .95);
    const win = Math.random() < p;
    out.battle = { name: b.name, win, p };
    s.counters[win ? "battlesWon" : "battlesLost"]++;
    const res = win ? b.win : b.loss;
    if (res) { GAME.applyFx(s, res, out); if (res.txt) out.notes.unshift(res.txt); }
    const risk = b.risk ?? .006;
    if (!out.death && Math.random() < risk * (win ? 1 : 2.2)) out.death = { type: "bataille", cause: `Tué à la bataille de ${b.name}.` };
    return out;
  },

  /* Avance d’une unité de temps */
  tick(s){
    const ch = GAME.ch(s);
    s.prev = { ...s.stats };
    s.date = addMonths(s.date, ch.unit.months);
    s.counters.months++;
    const p = parseD(s.date);
    const h = {
      age: GAME.age(s), month: p.m - 1,
      add: (k, v) => { const d = GAME.statDef(s, k); if (d) s.stats[k] = clamp(s.stats[k] + v, d.min, d.max); },
      drift: (k, target, rate) => { const d = GAME.statDef(s, k); if (d) s.stats[k] = clamp(s.stats[k] + (target - s.stats[k]) * rate, d.min, d.max); },
      condition: (id, name, sev) => { if (!s.conditions.find(c => c.id === id)) { s.conditions.push({ id, name, sev, since: s.date }); GAME.log(s, `Santé : ${name}.`, "bad"); } },
      hasCondition: id => !!s.conditions.find(c => c.id === id)
    };
    const msgs = ch.tick.call(ch, s, h) || [];
    for (const m of msgs) GAME.log(s, m.t, m.tone);
    // Maladies en cours
    for (const c of [...s.conditions]) {
      s.stats.sante = clamp(s.stats.sante - c.sev, 0, 100);
      if (c.id === "cancer") c.sev = Math.min(4, c.sev + .045);
      if (c.id === "typhus" && Math.random() < .3) { s.conditions = s.conditions.filter(x => x !== c); GAME.log(s, "Vous vous remettez du typhus.", "good"); }
    }
    // Cooldowns
    for (const k of Object.keys(s.cooldowns)) { s.cooldowns[k]--; if (s.cooldowns[k] <= 0) delete s.cooldowns[k]; }
    // Relations : décès, entrées dans la vie du personnage
    for (const r of ch.relations) {
      if (!s.deadRel[r.id] && r.dies && r.dies.date <= s.date && (!r.dies.cond || r.dies.cond(s))) {
        s.deadRel[r.id] = s.date; GAME.log(s, `${r.name} : ${r.dies.cause}.`, "bad");
        if (s.family.spouse === r.id) { s.family.spouse = null; GAME.log(s, "Vous voilà veuf.", "bad"); s.stats.stress = clamp(s.stats.stress + 12, 0, 100); }
      }
    }
    if (p.m === parseD(ch.born).m) GAME.log(s, `Vous avez ${GAME.age(s)} ans.`);
    s.counters.maxDep = Math.max(s.counters.maxDep || 0, s.stats.departements || 0);
    s.counters.popSum = (s.counters.popSum || 0) + s.stats.popularite;
    return GAME.mortality(s);
  },

  mortality(s){
    const ch = GAME.ch(s); const age = GAME.age(s); const st = s.stats;
    const worst = [...s.conditions].filter(c => c.sev >= .5).sort((a, b) => b.sev - a.sev)[0];
    if (st.sante <= 0) return { type: "maladie", cause: worst ? `Emporté par la maladie (${worst.name.toLowerCase()}), à ${age} ans.` : `Mort d’épuisement, le corps usé par les campagnes, à ${age} ans.` };
    const condLoad = s.conditions.reduce((t, c) => t + c.sev, 0);
    const nat = .00035 * Math.exp(.088 * (age - 40)) * (1 + Math.max(0, 65 - st.sante) / 14) + condLoad * .0012;
    const plot = ch.plotHazard ? ch.plotHazard(s) : 0;
    const acc = .00012;
    const r = Math.random();
    if (age >= 99 || r < nat) {
      if (age >= 72) return { type: "vieillesse", cause: `Mort de vieillesse, à ${age} ans.` };
      return { type: "maladie", cause: worst ? `Emporté par la maladie (${worst.name.toLowerCase()}), à ${age} ans.` : `Foudroyé par une attaque d’apoplexie, à ${age} ans.` };
    }
    if (r < nat + plot) return { type: "assassinat", cause: ch.plotCause ? ch.plotCause(s) : "Assassiné." };
    if (r < nat + plot + acc) return { type: "accident", cause: "Mort dans un accident de voiture, les chevaux s’étant emballés." };
    return null;
  },

  /* Événement historique dû à la date courante */
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
    if (!pool.length) return null;
    return pickW(pool);
  }
};

/* =====================================================================
   STOCKAGE — chaque lecture et écriture est protégée par try/catch
   ===================================================================== */
const STORE = {
  key: n => `legacy.slot.${n}`,
  read(n){ try { const raw = localStorage.getItem(STORE.key(n)); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } },
  write(n, s){ try { s.savedAt = new Date().toISOString(); localStorage.setItem(STORE.key(n), JSON.stringify(s)); return true; } catch (e) { return false; } },
  remove(n){ try { localStorage.removeItem(STORE.key(n)); return true; } catch (e) { return false; } },
  getSetting(k, def){ try { const v = localStorage.getItem("legacy.set." + k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } },
  setSetting(k, v){ try { localStorage.setItem("legacy.set." + k, JSON.stringify(v)); } catch (e) {} },
  valid(s){ return s && typeof s === "object" && s.v === 1 && CHARACTERS[s.char] && typeof s.date === "string" && s.stats && s.rel && s.family; }
};

/* =====================================================================
   IA — événements générés en direct par Claude, avec secours écrits
   ===================================================================== */
const AI = {
  sample: null, downloads: null, available: false, status: "init", note: "Connexion…",
  ready: null, pending: null, ctl: null, failures: 0,
  enabled: STORE.getSetting("ai", true),
  tier: STORE.getSetting("tier", "default"),

  async init(){
    try {
      if (window.claude && typeof window.claude.use === "function") {
        const [smp, dl] = await Promise.all([window.claude.use("sample").catch(() => null), window.claude.use("downloads").catch(() => null)]);
        AI.sample = smp; AI.downloads = dl;
      }
    } catch (e) { AI.sample = null; }
    AI.available = !!AI.sample;
    AI.setStatus(AI.available ? "idle" : "off", AI.available ? "Claude prêt à écrire les dépêches" : "IA indisponible ici : événements écrits");
  },
  setStatus(st, note){ AI.status = st; AI.note = note; UI.updateAIStatus && UI.updateAIStatus(); },
  usable(){ return AI.available && AI.enabled && AI.failures < 4; },

  buildPrompt(s){
    const ch = GAME.ch(s); const y = parseD(s.date).y;
    const statLines = ch.stats.map(d => `- ${d.id} (${d.label}) = ${Math.round(s.stats[d.id])}${d.fmt ? ` [${d.fmt(s.stats[d.id])}]` : " /100"} ; variation max par choix : ±${d.aiMax}${d.bad === "high" ? " ; une hausse est mauvaise" : ""}`).join("\n");
    const rels = ch.relations.filter(r => GAME.relAlive(s, r.id)).map(r => `- ${r.id} : ${r.name}, ${r.role} — relation ${Math.round(s.rel[r.id])} (${GAME.relStatusLabel[GAME.relStatus(s.rel[r.id])]})`).join("\n");
    const hist = s.history.slice(-8).map(h => `- ${frMonth(h.date)} — ${h.title} : ${h.choice}${h.outcome ? ` → ${h.outcome}` : ""}`).join("\n") || "- (début de partie)";
    const diverg = s.history.filter(h => h.kind === "hist" && h.hist === false).map(h => `- ${h.title} : le joueur a choisi « ${h.choice} » au lieu de ce qui s’est réellement passé.`).join("\n") || "- Aucune : l’Histoire suit son cours réel.";
    const next = ch.events.find(e => !s.done[e.id] && e.date > s.date);
    const fam = [s.family.spouse ? `conjoint : ${GAME.relDef(s, s.family.spouse).name}` : s.family.spouseName ? `conjoint : ${s.family.spouseName}` : "pas de conjoint", s.family.children.length ? `enfants : ${s.family.children.map(c => c.name).join(", ")}` : "pas d’enfant", s.family.heir ? `héritier : ${s.family.heir}` : ""].filter(Boolean).join(" ; ");
    const flags = Object.entries(s.flags).filter(([k, v]) => v).map(([k]) => k).join(", ");
    return `Tu es le moteur narratif de « Legacy », un simulateur de vie historique sérieux et réaliste, entièrement en français.

PERSONNAGE : ${ch.aiBrief}
DATE : ${frDate(s.date)} — ${GAME.age(s)} ans — ${GAME.rankLabel(s)} — lieu : ${s.place}
CONTEXTE RÉEL DE L’ÉPOQUE :
- ${y} : ${ch.eraNotes[y] || "(pas de repère)"}
- ${y + 1} : ${ch.eraNotes[y + 1] || "(pas de repère)"}
${next ? `PROCHAIN GRAND ÉVÉNEMENT HISTORIQUE (géré à part, ne le raconte pas) : ${next.title}, ${frMonth(next.date)}.` : ""}
BIFURCATIONS DE L’HISTOIRE DANS CETTE PARTIE :
${diverg}
Indicateurs de situation : ${flags || "aucun"}

JAUGES ACTUELLES :
${statLines}

RELATIONS VIVANTES (de -100 ennemi à +100 allié) :
${rels}

FAMILLE : ${fam}
SANTÉ : ${s.conditions.length ? s.conditions.map(c => c.name).join(", ") : "pas de maladie déclarée"}

DÉCISIONS RÉCENTES :
${hist}

CONSIGNES :
- Écris UN événement de la vie de ce personnage, plausible à cette date et dans cette situation précise : politique, militaire, diplomatique, économique, administratif, familial, santé. Varie les thèmes et ne répète pas les décisions récentes.
- Appuie-toi sur des faits, des lieux, des institutions et des personnes réels de l’époque. Si les choix du joueur ont changé l’Histoire, fais réagir le monde de façon crédible.
- Texte de 3 à 5 phrases, au présent, en vouvoyant le personnage (« vous »). Ton sobre de récit historique, sans emphase.
- ${ch.aiRules.join("\n- ")}
- Entre 2 et 4 choix, avec de vrais compromis. Aucun choix ne doit être parfait. Effets proportionnés : la plupart entre 2 et 8 points.
- Dans « effets », utilise uniquement les identifiants de jauges listés, en respectant les variations max.
- Dans « relations », utilise uniquement les identifiants listés ci-dessus (variation entre -25 et +25).
- « danger » est facultatif : seulement si le choix expose physiquement le personnage (probabilité de 0.01 à 0.08 et une cause de mort courte).
- « resume » : une phrase qui décrit la conséquence immédiate.

RÉPONDS UNIQUEMENT par un objet JSON, sans texte autour, de cette forme exacte :
{"titre":"…","lieu":"…","texte":"…","personnages":["id_relation_ou_nom"],"choix":[{"texte":"…","effets":{"popularite":-4,"tresor":30},"relations":{"talleyrand":6},"danger":null,"resume":"…"}]}`;
  },

  validate(o, s){
    const ch = GAME.ch(s);
    if (!o || typeof o !== "object") throw new Error("pas un objet");
    const title = String(o.titre || "").trim(), text = String(o.texte || "").trim();
    if (title.length < 3 || text.length < 60) throw new Error("titre ou texte manquant");
    if (!Array.isArray(o.choix) || o.choix.length < 2) throw new Error("choix manquants");
    const relIds = ch.relations.map(r => r.id);
    const findRel = k => { const key = String(k).toLowerCase(); return relIds.find(id => id === key) || ch.relations.find(r => r.name.toLowerCase().includes(key) || key.includes(r.id))?.id; };
    const choices = o.choix.slice(0, 4).map(c => {
      const t = String(c.texte || "").trim(); if (!t) throw new Error("choix vide");
      const sfx = {}; for (const [k, v] of Object.entries(c.effets || {})) { const d = ch.stats.find(x => x.id === k); const n = Number(v); if (d && isFinite(n) && n !== 0) sfx[k] = clamp(Math.round(n), -d.aiMax, d.aiMax); }
      const rfx = {}; for (const [k, v] of Object.entries(c.relations || {})) { const id = findRel(k); const n = Number(v); if (id && isFinite(n) && n !== 0 && GAME.relAlive(s, id)) rfx[id] = clamp(Math.round(n), -25, 25); }
      const fx = { s: sfx, r: rfx };
      if (c.danger && typeof c.danger === "object" && Number(c.danger.p ?? c.danger.proba) > 0) fx.danger = { p: clamp(Number(c.danger.p ?? c.danger.proba), 0, .08), type: String(c.danger.type || "accident"), cause: String(c.danger.cause || "Mort brutale.").slice(0, 160) };
      return { t: t.slice(0, 200), res: String(c.resume || "").slice(0, 260), fx };
    });
    if (choices.length < 2) throw new Error("moins de deux choix");
    const people = (Array.isArray(o.personnages) ? o.personnages : []).slice(0, 6).map(p => { const id = findRel(p); return id || String(p).slice(0, 40); });
    return { id: "ai-" + Date.now().toString(36), title: title.slice(0, 90), place: String(o.lieu || s.place).slice(0, 80), text: text.slice(0, 1100), people, choices, scene: s.scene, forDate: s.date };
  },

  async generate(s){
    if (!AI.usable()) throw new Error("indisponible");
    const ctl = new AbortController(); AI.ctl = ctl;
    const timer = setTimeout(() => ctl.abort(), 75000);
    AI.setStatus("busy", "Claude rédige la prochaine dépêche…");
    try {
      const raw = await AI.sample.json(AI.buildPrompt(s), { modelTier: AI.tier, signal: ctl.signal });
      const ev = AI.validate(raw, s);
      AI.failures = 0; AI.setStatus("ok", "Dépêche prête");
      return ev;
    } catch (e) {
      const code = e && e.code;
      if (code === "not_granted" || code === "sampling_disabled" || code === "capability_disabled" || code === "not_declared") { AI.available = false; AI.setStatus("off", "IA refusée : événements écrits"); }
      else { AI.failures++; AI.setStatus("off", code === "cancelled" ? "Délai dépassé : événement écrit" : "Réponse invalide : événement écrit"); }
      throw e;
    } finally { clearTimeout(timer); if (AI.ctl === ctl) AI.ctl = null; }
  },

  prefetch(s){
    if (!AI.usable() || AI.pending || AI.ready) return;
    const snap = JSON.parse(JSON.stringify(s)); const tok = AI.tok;
    const p = AI.generate(snap).then(ev => { if (tok === AI.tok) { ev.rank = snap.rank; AI.ready = ev; } return tok === AI.tok ? ev : null; }).catch(() => null).finally(() => { if (AI.pending === p) AI.pending = null; });
    AI.pending = p;
  },
  /* Une dépêche préparée à l’avance n’est utilisée que si la situation n’a pas basculé entre-temps */
  take(s){ const e = AI.ready; AI.ready = null; if (!e) return null; if (e.rank !== s.rank || addMonths(e.forDate, 8) < s.date) return null; return e; },
  tok: 0,
  reset(){ AI.tok++; AI.ready = null; if (AI.ctl) AI.ctl.abort(); AI.pending = null; }
};
</script>
