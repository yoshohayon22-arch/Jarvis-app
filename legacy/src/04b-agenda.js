<script>
"use strict";
/* =====================================================================
   AGENDA — la semaine du personnage, jour par jour.
   Chaque semaine : 3 ou 4 rendez-vous (fixes, prises de parole, écrits par
   Claude ou tirés de la banque du personnage), plus les grands moments
   historiques et les matchs, placés à leur jour.
   ===================================================================== */
const AGENDA = {
  WD: ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."],
  WDL: ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"],
  wd(date){ const p = parseD(date); const t = new Date(Date.UTC(2000, p.m - 1, p.d)); t.setUTCFullYear(p.y); return t.getUTCDay(); },
  today: s => addDays(s.date, s.day || 0),
  dayOfWd(s, wd){ for (let d = 0; d < 7; d++) if (AGENDA.wd(addDays(s.date, d)) === wd) return d; return 0; },
  dayLabel(s, d){ const dt = addDays(s.date, d); return `${AGENDA.WDL[AGENDA.wd(dt)]} ${parseD(dt).d}`; },
  pick: a => a[Math.floor(Math.random() * a.length)],
  ok(s, e){ try { return !e.cond || !!e.cond(s); } catch (err) { return false; } },
  clone: o => JSON.parse(JSON.stringify(o)),
  /* Atténue les effets d’un événement pensé pour être rare */
  scaleFx(fx, k){
    const c = AGENDA.clone(fx || {});
    for (const key of ["s", "r"]) if (c[key]) for (const x in c[key]) if (typeof c[key][x] === "number") { const v = c[key][x] * k; c[key][x] = Math.abs(v) >= 1 ? Math.round(v) : Math.round(v * 100) / 100; }
    if (typeof c.opinion === "number") c.opinion *= k;
    return c;
  },
  /* Effets d’un rendez-vous : atténués, et de plus en plus faibles près des extrêmes */
  K: .32,
  tune(s, fx, k){
    const c = AGENDA.scaleFx(fx, k ?? AGENDA.K);
    if (c.roll) for (const w of ["win", "loss"]) if (c.roll[w]) c.roll[w] = AGENDA.tune(s, c.roll[w], k);
    if (c.s) for (const x in c.s) { const d = GAME.statDef(s, x); const v = s.stats[x]; if (!d || typeof c.s[x] !== "number" || d.min !== 0 || d.max !== 100) continue;
      const good = d.bad === "high" ? c.s[x] < 0 : c.s[x] > 0; const room = d.bad === "high" ? v : 100 - v;
      if (good) c.s[x] = Math.round(c.s[x] * clamp((room - 15) / 45, .03, 1) * 100) / 100; }
    if (typeof c.opinion === "number" && c.opinion > 0) { const st = GAME.ch(s).mainGauges(s)[0]; if (st && st.v > 60) c.opinion *= clamp((100 - st.v) / 40, .05, 1); }
    return c;
  },
  soften(ev, k){ const e = AGENDA.clone(ev); for (const c of e.choices || []) if (c.fx) c.fx = AGENDA.scaleFx(c.fx, k); return e; },
  build(r, v){ return { id: `rdv-${r.id}-${v.id}`, title: v.title ? `${r.title} : ${v.title}` : r.title, text: v.text, people: v.people || r.people || [], scene: v.scene || r.scene, place: v.place || r.place, choices: AGENDA.clone(v.choices) }; },
  paroleChoices: () => [
    { t: "Préparer avec soin, rester mesuré", res: "Un propos maîtrisé, sans faux pas. On le reprend sans passion.", fx: { opinion: 1, s: { stress: 1 } } },
    { t: "Improviser et frapper fort", res: "Vous parlez sans notes.", fx: { roll: { p: .55, win: { opinion: 3, txt: "Le ton direct plaît : on ne parle que de ça." }, loss: { opinion: -3, txt: "Une formule malheureuse fait le tour des journaux." } } } },
    { t: "Annuler au dernier moment", res: "On s’interroge un peu sur votre silence.", fx: { opinion: -.5, s: { stress: -2 } } }
  ],

  plan(s, forced = []){
    const ch = GAME.ch(s); const items = []; const taken = {};
    const recent = s.rdvRecent || (s.rdvRecent = []);
    const remember = id => { recent.push(id); if (recent.length > 40) recent.shift(); };
    const free = pref => {
      if (pref != null && !taken[pref]) return pref;
      const order = pref != null ? [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6].map(o => pref + o).filter(d => d >= 0 && d < 7) : [1, 2, 3, 4, 5, 6, 0].sort(() => Math.random() - .5);
      for (const d of order) if (!taken[d]) return d;
      return pref ?? 1;
    };
    const add = (it, pref) => { const d = free(pref); taken[d] = (taken[d] || 0) + 1; items.push({ ...it, day: d, uid: `${s.week}-${items.length}`, done: false }); };
    for (const f of forced) add(f, f.pref);
    const target = 3 + (Math.random() < .5 ? 1 : 0) + forced.filter(f => f.kind === "saison").length;
    // 1. Rendez-vous fixes
    for (const r of (ch.recurring || [])) {
      if (items.length >= target) break;
      if (!AGENDA.ok(s, r) || (s.week + (r.phase || 0)) % (r.every || 1)) continue;
      const vs = r.variants.filter(v => AGENDA.ok(s, v)); if (!vs.length) continue;
      const fresh = vs.filter(v => !recent.includes(`${r.id}:${v.id}`)); const v = AGENDA.pick(fresh.length ? fresh : vs); remember(`${r.id}:${v.id}`);
      add({ kind: "rdv", src: "fixe", icon: r.icon || "•", title: r.title, ev: AGENDA.build(r, v) }, AGENDA.dayOfWd(s, r.wd));
    }
    // 2. Une prise de parole, une semaine sur deux environ
    if (items.length < target && Math.random() < .5) {
      const types = ch.speech.filter(t => AGENDA.ok(s, t));
      if (types.length) { const tp = AGENDA.pick(types); const pr = (ch.paroleRdv || {})[tp.id] || {};
        add({ kind: "parole", src: "parole", type: tp.id, icon: "✒", title: pr.title || tp.label, ev: { id: `parole-${tp.id}-${s.week}`, title: pr.title || tp.label, text: `${pr.text || ""} ${tp.hint}`.trim(), people: [], scene: s.scene, choices: AGENDA.paroleChoices() } }, null); }
    }
    // 3. Un rendez-vous écrit par Claude, s’il est prêt
    if (items.length < target && typeof AI !== "undefined" && AI.usable()) { const ev = AI.take(s); if (ev) add({ kind: "rdv", src: "ai", icon: "✦", title: ev.title, ev: AGENDA.soften(ev, .6) }, null); }
    // 4. La banque du personnage, et parfois une dépêche plus rare
    let guard = 0;
    while (items.length < target && guard++ < 12) {
      const pool = (ch.rdv || []).filter(e => AGENDA.ok(s, e) && !recent.includes(e.id) && !items.some(i => i.ev && i.ev.id === e.id));
      let e = null, src = "ecrit";
      if (!pool.length || Math.random() < .22) { const rf = GAME.pickFallback(s); if (rf && !items.some(i => i.ev && i.ev.id === rf.id)) { e = AGENDA.soften(rf, .55); src = "dep"; s.recentRandom.push(rf.id); if (s.recentRandom.length > 6) s.recentRandom.shift(); } }
      if (!e && pool.length) { e = AGENDA.clone(pickW(pool)); remember(e.id); }
      if (!e) { if (!pool.length) break; continue; }
      add({ kind: "rdv", src, icon: e.icon || "•", title: e.title, ev: e }, null);
    }
    items.sort((a, b) => a.day - b.day);
    s.agenda = items; s.agendaWeek = s.week;
    return items;
  },
  next(s){ return (s.agenda || []).find(i => !i.done && i.day <= (s.day || 0)); },
  upcoming(s){ return (s.agenda || []).find(i => !i.done); },
  mark(s, ev, how){ const it = (s.agenda || []).find(i => !i.done && i.ev && i.ev.id === ev.id); if (it) it.done = how || "fait"; return it; },

  /* Déléguer : une issue moyenne, et la personne concernée peut le prendre mal */
  delegate(s, ev, kind){
    const out = { deltas: {}, rels: {}, notes: [], death: null };
    if (kind === "parole") { out.notes.push("Un proche parle à votre place ; personne n’en retient grand-chose."); GAME.applyFx(s, { opinion: -.5 }, out); return out; }
    const cs = (ev.choices || []).filter(c => !c.battle && !c.match);
    if (cs.length) { const c = AGENDA.pick(cs); out.notes.push(`Vous déléguez. Votre représentant choisit : « ${c.t} ».${c.res ? " " + c.res : ""}`); GAME.applyFx(s, AGENDA.tune(s, c.fx || {}, AGENDA.K * .6), out); }
    const r = {}; for (const p of ev.people || []) if (GAME.relDef(s, p) && GAME.relAlive(s, p)) r[p] = -2;
    if (Object.keys(r).length) { GAME.applyFx(s, { r }, out); out.notes.push("Votre absence a été remarquée."); }
    GAME.applyFx(s, { s: { stress: -1 } }, out);
    return out;
  }
};
</script>
