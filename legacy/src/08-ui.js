<script>
"use strict";
/* =====================================================================
   INTERFACE — générique : tout ce qui est propre à un personnage
   (panneaux, carte, types de parole, conseillers) vient de ses données.
   ===================================================================== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const app = () => $("#app");
const overlay = () => $("#overlay-root");

const UI = {
  modalOpen: false, resumeSpeed: 1, currentEvent: null, currentKind: null, view: "general", subtab: null, pressCat: "tous", contact: null, ord: { corps: null, dest: null }, mapSel: null, armed: null, ctlById: {},
  feedOpen: STORE.getSetting("feedOpen", false), keys: {}, busyUntil: 0,

  toast(msg){ for (const old of $$(".toast")) old.hidden = true; const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); },
  setTheme(theme, inGame){ document.body.className = (theme || "") + (inGame ? " in-game" : ""); },
  save(){ const s = GAME.s; if (s) STORE.write(s.slot, s); },

  /* ---------------- Écran titre ---------------- */
  title(){
    LOOP.stop(); AUDIO.stopTheme(); GAME.s = null; UI.setTheme("", false); UI.closeModal();
    const latest = [1, 2, 3].map(n => ({ n, s: STORE.read(n) })).filter(x => STORE.valid(x.s)).sort((a, b) => (b.s.savedAt || "").localeCompare(a.s.savedAt || ""))[0];
    app().innerHTML = `<div class="wrap">
      <section class="title-hero"><div class="logo">LEGACY</div>
        <p class="tagline">Vivez la vie d’une personnalité, de ses débuts à sa mort. Gouvernez par vos réglages, agissez par vos propres mots, et voyez le monde vous répondre.</p></section>
      <div class="roster">${ROSTER.map(r => {
        const ch = CHARACTERS[r.id];
        if (ch) return `<button class="card-char" data-char="${ch.id}" style="--art:${ch.art}"><div class="art">${ch.portrait(null)}</div><div class="body"><h3>${esc(ch.name)}</h3><div class="role">${esc(ch.role)}</div><div class="label">${ch.starts.length} points de départ</div></div></button>`;
        return `<div class="card-char locked" style="--art:${r.art}" aria-disabled="true"><span class="badge">Bientôt</span><div class="art">${r.noFigure ? ART.plain(r.c1, r.c2) : ART.placeholder(r.letter, r.c1, r.c2)}</div><div class="body"><h3>${esc(r.name)}</h3><div class="role">${esc(r.role)}</div><div class="label">En préparation</div></div></div>`;
      }).join("")}</div>
      <div class="title-actions">
        ${latest ? `<button class="btn primary" id="continue">Continuer · ${esc(CHARACTERS[latest.s.char].short)}, ${esc(frMonth(latest.s.date))}</button>` : ""}
        <button class="btn" id="open-saves">Parties sauvegardées</button><button class="btn ghost" id="open-settings">Réglages</button>
      </div>
      <p class="disclaimer">Simulation. Les textes écrits par l’IA sont des reconstitutions plausibles : aucune parole inventée n’y est présentée comme une citation réelle. Portraits, cartes et décors sont des illustrations stylisées. Musique et bruitages sont synthétisés par le jeu.</p>
    </div>`;
    $$("[data-char]").forEach(b => b.onclick = () => { AUDIO.sfx("click"); UI.setup(b.dataset.char); });
    if (latest) $("#continue").onclick = () => UI.loadGame(latest.s);
    $("#open-saves").onclick = () => UI.savesModal();
    $("#open-settings").onclick = () => UI.settingsModal();
  },

  setup(charId){
    const ch = CHARACTERS[charId]; UI.setTheme(ch.theme, false);
    let pick = ch.starts[0].id;
    const free = [1, 2, 3].find(n => !STORE.valid(STORE.read(n))) || 1;
    app().innerHTML = `<div class="wrap"><button class="btn ghost small" id="back">← Retour</button>
      <div class="setup"><div class="portrait-lg">${ch.portrait(null)}<h2 style="margin-top:10px">${esc(ch.name)}</h2>
          <p class="muted ui">Né le ${frDate(ch.born)} à ${esc(ch.birthplace)}</p><p class="muted" style="font-size:.95rem">${esc(ch.realTimeline)}</p></div>
        <div style="display:grid;gap:14px;min-width:0">
          <div><div class="label">Mode carrière</div><h2 style="font-size:1.5rem">Choisissez l’année de départ</h2>
          <p class="muted">Vous jouez jusqu’à la mort du personnage. C’est vous qui faites avancer le temps : jour par jour, ou directement jusqu’au prochain rendez-vous de votre agenda (3 ou 4 par semaine). Rien ne peut être annulé.${ch.fiction ? " Personnage de fiction : le récit des livres est résumé avec nos propres mots, sans citation ni image tirée des films." : ch.realStatus ? " Personne réelle et vivante : le jeu s’appuie sur des faits publics, et tout ce qui s’en écarte est de la fiction." : ""}</p></div>
          <div class="starts" role="radiogroup" aria-label="Année de départ">${ch.starts.map(st => `<button class="start" role="radio" data-start="${st.id}" aria-pressed="${st.id === pick}" aria-checked="${st.id === pick}"><span class="yr">${st.year}</span><h3>${esc(st.title)}</h3><span class="muted">${esc(st.summary)}</span></button>`).join("")}</div>
          <div class="slot-pick"><label class="label" for="slot-sel">Emplacement de sauvegarde</label>
            <select id="slot-sel" class="sel" style="width:auto">${[1, 2, 3].map(n => { const s = STORE.read(n); return `<option value="${n}" ${n === free ? "selected" : ""}>Emplacement ${n}${STORE.valid(s) ? ` (remplacera ${esc(CHARACTERS[s.char].short)}, ${esc(frMonth(s.date))})` : " (libre)"}</option>`; }).join("")}</select></div>
          <div><button class="btn primary" id="begin">Commencer la partie</button></div>
        </div></div></div>`;
    $("#back").onclick = () => UI.title();
    $$("[data-start]").forEach(b => b.onclick = () => { pick = b.dataset.start; $$("[data-start]").forEach(x => { x.setAttribute("aria-pressed", x === b); x.setAttribute("aria-checked", x === b); }); });
    $("#begin").onclick = () => { const s = GAME.newGame(charId, pick, +$("#slot-sel").value); UI.loadGame(s, true); };
  },

  /* ---------------- Partie ---------------- */
  loadGame(s, fresh = false){
    AI.reset(); GAME.s = s; s.speed = 0; UI.resumeSpeed = 1; UI.mapSel = null; UI.pinSel = null; UI.armed = null;
    const ch = GAME.ch(s);
    if (s.dead) { UI.endScreen(); return; }
    UI.setTheme(ch.theme, true);
    UI.view = "general"; UI.subtab = null; UI.contact = null;
    UI.buildGame(); AUDIO.theme(ch.audio);
    if (fresh) { UI.save(); AI.prefetch(s); }
    if (!s.agenda || s.agendaWeek !== s.week) { const due = GAME.dueHistorical(s); AGENDA.plan(s, due ? [{ kind: "hist", icon: "★", title: due.title, evId: due.id, pref: s.day || 0 }] : []); UI.update(true); UI.save(); }
    if (s.pending) { UI.restorePending(); return; }
    if (UI.openDay()) return;
    if (fresh) LOOP.setSpeed(1);
  },
  restorePending(){
    const s = GAME.s, p = s.pending, ch = GAME.ch(s); let ev = null;
    if (p.kind === "hist") ev = ch.events.find(e => e.id === p.id); else if (p.kind === "ecrit") ev = ch.randomEvents.find(e => e.id === p.id); else if (p.ev) ev = p.ev;
    s.pending = null; if (ev) UI.showEvent(ev, p.kind);
  },

  ICONS: {
    general: `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 16h22M16 5c-5 4-5 18 0 22M16 5c5 4 5 18 0 22" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
    armee: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 4v24M9 5h15l-4 5 4 5H9" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`,
    presse: `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="6" width="22" height="20" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 11h14M9 16h6M9 21h6M19 16h4v5h-4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    finances: `<svg viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="16" cy="9" rx="9" ry="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 9v7c0 2.2 4 4 9 4s9-1.8 9-4V9M7 16v7c0 2.2 4 4 9 4s9-1.8 9-4v-7" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
    ballon: `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 10.5l5 3.6-1.9 5.9h-6.2L11 14.1zM16 5v5.5M26.5 13l-5.5 1.1M22.5 25l-3.4-5M9.5 25l3.4-5M5.5 13l5.5 1.1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
    corr: `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="8" width="24" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 10l11 8 11-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`
  },
  VIEWS: [["general", "Vue générale"], ["armee", "Armée"], ["presse", "Presse"], ["finances", "Finances"], ["corr", "Correspondance"]],

  buildGame(){
    const s = GAME.s, ch = GAME.ch(s);
    s.seen = s.seen || { feedN: s.feedN || 0, armee: "" };
    app().innerHTML = `
      <header class="topbar"><div class="topbar-in">
        <div class="who"><h1>${esc(ch.short)}</h1><span class="rank" id="rank"></span></div>
        <div class="clock"><span class="date" id="date"></span><span class="age" id="age"></span></div>
        <div class="advance" role="group" aria-label="Faire avancer le temps"><button class="btn" id="b-day" title="Jour suivant (espace)">Jour suivant</button><button class="btn primary" id="b-next" title="Prochain rendez-vous (Entrée)">Prochain rendez-vous</button></div>
        <button class="icon-btn" id="b-music" aria-pressed="${AUDIO.musicOn}" title="Musique">Musique</button>
        <button class="icon-btn" id="b-sfx" aria-pressed="${AUDIO.sfxOn}" title="Bruitages">Sons</button>
        <button class="icon-btn" id="b-menu" title="Parties, réglages, quitter">Menu</button>
      </div><div class="cal" id="cal" role="list" aria-label="Agenda de la semaine"></div><div class="cal-next" id="cal-next"></div><div class="tick-bar"><i id="tickbar"></i></div></header>
      <div class="shell">
        <nav class="rail" id="rail" aria-label="Fenêtres">${ch.views.map(({ id, label, icon }) => `<button data-view="${id}" aria-pressed="false">${UI.ICONS[icon]}<span>${label}</span><i class="badge-dot" hidden></i></button>`).join("")}</nav>
        <main class="view" id="view"></main>
      </div>`;
    $("#b-day").onclick = () => { AUDIO.sfx("click"); LOOP.advance("day"); }; $("#b-next").onclick = () => { AUDIO.sfx("click"); LOOP.advance("next"); };
    $("#cal").addEventListener("click", e => { const b = e.target.closest("[data-rv]"); if (b) UI.calClick(b.dataset.rv); });
    $("#b-music").onclick = e => { AUDIO.setMusic(!AUDIO.musicOn); e.currentTarget.setAttribute("aria-pressed", AUDIO.musicOn); };
    $("#b-sfx").onclick = e => { AUDIO.setSfx(!AUDIO.sfxOn); e.currentTarget.setAttribute("aria-pressed", AUDIO.sfxOn); AUDIO.sfx("click"); };
    $("#b-menu").onclick = () => UI.menuModal();
    $("#rail").addEventListener("click", e => { const b = e.target.closest("[data-view]"); if (b) { AUDIO.sfx("click"); UI.setView(b.dataset.view); } });
    // Délégation : tout ce qui se passe dans la fenêtre active
    const v = $("#view");
    v.addEventListener("pointerdown", e => { if (e.target.closest("#pbody")) UI.busyUntil = Date.now() + 2500; });
    v.addEventListener("input", e => { const r = e.target.closest("input[type=range]"); if (!r) return; UI.busyUntil = Date.now() + 2500; const c = UI.ctlById[r.dataset.cid]; if (!c) return; const box = r.closest(".ctl"); box.querySelector(".ctl-top b").textContent = c.fmt ? c.fmt(+r.value) : r.value; if (c.live) box.querySelector(".note").textContent = c.live(+r.value); });
    v.addEventListener("change", e => {
      const el = e.target.closest("[data-cid]"); if (el) { const c = UI.ctlById[el.dataset.cid]; if (!c) return; UI.busyUntil = 0; if (el.tagName === "SELECT" && el.value === "") return; UI.act(c.act, c.arg, el.value); return; }
    });
    v.addEventListener("click", e => {
      const b = e.target.closest("button[data-cid]");
      if (b) { if (b.disabled) return; const c = UI.ctlById[b.dataset.cid]; if (!c) return; if (c.confirm && UI.armed !== c.act + "|" + c.arg) { UI.armed = c.act + "|" + c.arg; UI.renderPanel(true); return; } UI.armed = null; UI.busyUntil = 0; UI.act(c.act, c.arg); return; }
      const t = e.target.closest("[data-do]"); if (t) { const [a, x, y] = t.dataset.do.split("|"); UI.doView(a, x, y); return; }
      const pick = e.target.closest("[data-pick]"); if (pick) { UI.pickCorps(pick.dataset.pick); return; }
      const rel = e.target.closest(".rel"); if (rel) { const d = rel.querySelector(".rel-detail"); if (d) d.hidden = !d.hidden; }
    });
    v.addEventListener("click", e => { if (!e.target.closest("#map")) return; UI.mapClick(e); });
    v.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.closest("#map")) { e.preventDefault(); UI.mapClick(e); } });
    v.addEventListener("focusin", e => { if (e.target.id === "msg") { UI.mailPaused = UI.pause() || UI.mailPaused || 0; } });
    v.addEventListener("focusout", e => { if (e.target.id === "msg") setTimeout(() => { if (document.activeElement && document.activeElement.id === "send") return; UI.mailResume(); }, 150); });
    v.addEventListener("pointermove", e => { const c = e.target.closest("#chart svg"); if (c) UI.chartHover(e, c); });
    v.addEventListener("pointerout", e => { if (e.target.closest("#chart") && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest("#chart"))) UI.chartHover(null); });
    UI.lastPortraitAge = -1; UI.ord = { corps: null, dest: null };
    UI.setView(UI.view || "general");
    UI.updateAIStatus();
  },

  kind(view){ const v = GAME.ch().views.find(x => x.id === (view || UI.view)); return v ? v.kind : "general"; },
  setView(view){
    const s = GAME.s, ch = GAME.ch(s); if (!ch.views.some(v => v.id === view)) view = "general"; UI.view = view; UI.keys = {}; UI.armed = null; UI.mapSel = null; UI.ord = { corps: null, dest: null };
    const legend = `<div class="map-legend" id="map-legend"></div>${ch.maps ? `<div class="map-switch">${ch.maps.map((m, i) => `<button data-do="mapsw|${i}">${esc(m.label)}</button>`).join("")}</div>` : ""}`; if (ch.maps && !(UI.mapIdx < ch.maps.length)) UI.mapIdx = 0;
    const html = {
      general: `<div class="vw"><div class="vcol grow"><div class="mapbox"><div id="map" class="mapfit"></div>${legend}<div id="map-info"></div></div>
          <div class="panel upcoming"><h2>À venir</h2><div id="upcoming"></div></div></div>
        <div class="vcol side"><div class="panel"><div class="idrow"><div id="portrait"></div><div><div class="place" id="place"></div><span class="status" id="status"></span></div></div><div class="gauges" id="mainG" style="margin-top:10px"></div><div class="facts4" id="facts"></div><div id="conds"></div><div id="g-alerts"></div></div>
          <div class="subtabs" id="subtabs" role="tablist"></div><div class="pbody panel" id="pbody"></div></div></div>`,
      ops: `<div class="vw"><div class="vcol grow"><div class="mapbox"><div id="map" class="mapfit"></div>${legend}<div id="order-sheet"></div></div></div>
        <div class="vcol side"><div id="alerts"></div><div class="pbody panel" id="pbody"></div></div></div>`,
      presse: `<div class="vw"><div class="vcol grow"><div class="panel"><h2>Opinion publique</h2><div class="gauges two" id="opinion"></div></div><div class="chips" id="pcats"></div><div class="panel scroll" id="press"></div></div>
        <div class="vcol side"><div class="pbody panel" id="pbody"></div></div></div>`,
      finances: `<div class="vw"><div class="vcol grow scrolly"><div id="alerts"></div><div class="panel"><div class="kpi four" id="fkpi"></div><h2 style="margin-top:12px">${esc(ch.fin ? ch.fin.chartTitle : "")}</h2><div id="chart"></div></div><div class="two-col" id="ftables"></div></div>
        <div class="vcol side"><div class="pbody panel" id="pbody"></div></div></div>`,
      board: `<div class="vw"><div class="vcol grow scrolly" id="board"></div><div class="vcol side"><div id="alerts"></div><div class="pbody panel" id="pbody"></div></div></div>`,
      corr: `<div class="vw corr"><div class="vcol contacts panel" id="contacts"></div><div class="vcol grow panel convo"><div class="conv-h" id="conv-h"></div><div class="conv" id="conv"></div>
          <div class="composer"><textarea id="msg" rows="2" maxlength="1200" placeholder="Écrivez votre lettre…" aria-label="Votre lettre"></textarea><button class="btn primary" id="send">Envoyer</button></div></div></div>`
    }[UI.kind(view)];
    $("#view").innerHTML = html; $("#view").dataset.view = view;
    $$("#rail [data-view]").forEach(b => b.setAttribute("aria-pressed", b.dataset.view === view));
    if (UI.kind(view) === "corr") { $("#send").onclick = () => UI.sendMail(); if (!UI.contact || !GAME.relKnown(s, UI.contact)) UI.contact = ch.contactGroups.flatMap(g => g[1]).find(id => GAME.relAlive(s, id)); }
    if (UI.kind(view) === "presse") s.seen.feedN = s.feedN;
    if (UI.kind(view) === "ops") s.seen.armee = (ch.alerts(s).armee || []).join("|");
    if (view === "general") UI.flagGeneral = false;
    UI.lastPortraitAge = -1;
    UI.update(true);
  },

  level(d, v){
    if (d.warn !== undefined && d.bad === "low") return v <= d.danger ? "bad" : v < d.warn ? "warn" : "good";
    if (d.bad === "high") return v >= 70 ? "bad" : v >= 45 ? "warn" : "good";
    return v < 25 ? "bad" : v < 45 ? "warn" : "good";
  },
  put(id, html){ const el = $("#" + id); if (!el) return false; if (UI.keys[id] === html) return false; el.innerHTML = html; UI.keys[id] = html; return true; },
  alertBox: list => list.length ? `<div class="alert" role="alert">${list.map(a => `<div>${esc(a)}</div>`).join("")}</div>` : "",

  update(force){
    const s = GAME.s; if (!s || !$("#date")) return;
    const ch = GAME.ch(s); if (force) UI.keys = {};
    const today = AGENDA.today(s); $("#date").textContent = frDate(today); $("#age").textContent = `${GAME.age(s)} ans · ${AGENDA.WDL[AGENDA.wd(today)]}`;
    UI.renderCal(); $("#rank").textContent = GAME.rankLabel(s);
    $$("[data-speed]").forEach(b => b.setAttribute("aria-pressed", +b.dataset.speed === s.speed));
    const al = ch.alerts(s);
    // Pastilles rouges
    const unread = Object.values(s.corr).reduce((t, th) => t + th.filter(m => m.unread).length, 0);
    const newsNew = s.feed.slice(0, Math.max(0, (s.feedN || 0) - (s.seen.feedN || 0))).some(n => n.ton === "hos" || n.kind === "rival" || n.kind === "differe");
    const flags = ch.badges(s, { al, unread, newsNew, view: UI.view, flagGeneral: UI.flagGeneral });
    $$("#rail [data-view]").forEach(b => { const d = b.querySelector(".badge-dot"); const on = !!flags[b.dataset.view]; d.hidden = !on; d.textContent = b.dataset.view === "corr" && unread ? unread : ""; });
    const view = UI.kind();
    if (view === "general" || view === "ops") UI.updateMap(force);
    if (view === "general") {
      const age = GAME.age(s); if (Math.abs(age - UI.lastPortraitAge) >= 2) { $("#portrait").innerHTML = ch.portrait(s); UI.lastPortraitAge = age; }
      $("#place").textContent = s.place; $("#status").textContent = ch.statusLabel(s);
      UI.put("mainG", ch.mainGauges(s).map(g => { const d = { bad: g.bad || "low" }; return `<div class="gauge"><div class="top"><span class="name">${esc(g.label)}</span><span class="val">${Math.round(g.v)}</span></div><span class="bar"><i class="lvl-${UI.level(d, g.v)}" style="width:${clamp(g.v, 0, 100)}%"></i></span></div>`; }).join(""));
      UI.put("facts", ch.sideFacts(s).map(([l, v]) => `<div><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join(""));
      UI.put("conds", s.conditions.map(c => `<span class="cond-chip">${esc(c.name)}</span>`).join(""));
      UI.put("g-alerts", UI.alertBox(al.general));
      const up = ch.upcoming(s);
      UI.put("upcoming", up.length ? up.map(u => `<div class="up"><span class="when">${u.approx ? "vers " + esc(frMonth(u.d)) : esc(frDate(u.d))}</span><span class="what"><small>${esc(u.k)}</small>${esc(u.t)}</span></div>`).join("") : `<span class="note">Rien d’annoncé pour l’instant. Les conséquences de vos actions et les mouvements en cours apparaîtront ici.</span>`);
    }
    if (view === "ops") { UI.put("alerts", UI.alertBox(al.armee)); UI.orderSheet(); }
    if (view === "board") { UI.put("alerts", UI.alertBox(al[UI.view] || [])); UI.put("board", ch.boards[UI.view](s)); }
    if (view === "presse") UI.updatePress();
    if (view === "finances") UI.updateFinances(al);
    if (view === "corr") UI.updateCorr(); else UI.renderPanel(force);
  },

  updateMap(force){
    const s = GAME.s, ch = GAME.ch(s), m = UI.curMap(ch); if (!$("#map")) return;
    UI.put("map-legend", Object.entries(m.statusLabel).map(([k, l]) => `<span><i class="st-${k}"></i>${esc(l)}</span>`).join("")); $$(".map-switch button").forEach((b, i) => b.setAttribute("aria-pressed", i === (UI.mapIdx || 0)));
    const key = JSON.stringify([m.regions.map(r => m.status(s, r.id)), m.markers(s).map(k => [k.id, k.region, k.moving]), UI.mapSel, UI.ord.corps, UI.ord.dest, UI.mapIdx]);
    if (key !== UI.keys.map) { UI.keys.map = key; $("#map").innerHTML = ART.map(ch, s, UI.kind() === "ops" ? UI.ord.dest : UI.mapSel, UI.ord.corps, m); }
    if (UI.view === "general") UI.mapInfo();
  },
  mapClick(e){
    const s = GAME.s, ch = GAME.ch(s); const pin = e.target.closest("[data-marker]"), rg = e.target.closest("[data-region]");
    if (pin) { AUDIO.sfx("click"); if (UI.kind() !== "ops") { const ops = ch.views.find(v => v.kind === "ops"); if (ops) { UI.ord = { corps: pin.dataset.marker, dest: null }; UI.setViewKeep(ops.id); return; } const mk = UI.curMap(ch).markers(s).find(k => k.id === pin.dataset.marker); UI.mapSel = mk ? mk.region : null; UI.update(); return; }
      // Un corps est déjà choisi : toucher un autre pion désigne sa région comme destination
      if (UI.ord.corps && UI.ord.corps !== pin.dataset.marker) { const o = s.corps.find(x => x.id === pin.dataset.marker); if (o) { UI.ord.dest = o.dest || o.loc; UI.update(); return; } }
      UI.pickCorps(pin.dataset.marker); return; }
    if (!rg) return; AUDIO.sfx("click");
    if (UI.kind() === "ops") { if (!UI.ord.corps) { UI.toast("Touchez d’abord un corps d’armée."); return; } UI.ord.dest = rg.dataset.region; UI.update(); return; }
    UI.mapSel = UI.mapSel === rg.dataset.region ? null : rg.dataset.region; UI.update();
  },
  curMap(ch){ return ch.maps ? ch.maps[UI.mapIdx || 0] : ch.map; },
  setViewKeep(view){ const o = UI.ord; UI.setView(view); UI.ord = o; UI.update(true); },
  pickCorps(id){ AUDIO.sfx("click"); UI.ord = UI.ord.corps === id ? { corps: null, dest: null } : { corps: id, dest: null }; UI.update(true); if (UI.ord.corps && window.innerWidth <= 960) window.scrollTo({ top: 0, behavior: "smooth" }); },
  orderSheet(){
    const s = GAME.s, ch = GAME.ch(s); const c = s.corps.find(x => x.id === UI.ord.corps);
    if (!c) { UI.ord = { corps: null, dest: null }; UI.put("order-sheet", `<div class="sheet hint">1. Touchez un corps (pion ou carte de droite) · 2. Touchez une destination · 3. Choisissez l’ordre</div>`); return; }
    if (!UI.ord.dest) { UI.put("order-sheet", `<div class="sheet"><b class="ui">${esc(c.name)} · ${esc(ch.marshalName(c.marshal))} · ${Math.round(c.men)} 000 h.</b><span class="note">Touchez une destination sur la carte (ou la région où il se trouve pour un ordre sur place).</span><div class="ops"><button class="btn small ghost" data-do="ordcancel">Annuler</button></div></div>`); return; }
    const to = UI.ord.dest, wk = ch.travel(c, to), st = ch.map.status(s, to);
    UI.put("order-sheet", `<div class="sheet"><b class="ui">${esc(c.name)} → ${esc(ch.regionName(to))} <span class="chip ${st === "home" ? "allie" : st}">${esc(ch.map.statusLabel[st])}</span></b>
      <span class="note">${wk ? `Trajet : environ ${wk} semaines.` : "Déjà sur place."}${s.pays[to] && st === "guerre" ? ` Armée ennemie estimée : ${Math.round(s.pays[to].armee)} 000 h.` : ""}</span>
      <div class="ord4">${ch.orders.map(o => `<button class="btn ${o.id === "attaquer" ? "primary" : ""}" data-do="order|${o.id}" title="${esc(o.hint)}">${esc(o.label)}</button>`).join("")}</div>
      <div class="ops"><button class="btn small ghost" data-do="ordcancel">Annuler</button></div></div>`);
  },
  doView(a, x, y){
    const s = GAME.s;
    if (a === "mapsw") { UI.mapIdx = +x; UI.mapSel = null; AUDIO.sfx("click"); UI.update(true); return; }
    if (a === "act") { UI.act(x, y); return; }
    if (a === "char") { const ch = GAME.ch(s); if (ch.doView) ch.doView(s, x, y); return; }
    if (a === "ordcancel") { UI.ord = { corps: null, dest: null }; UI.update(true); }
    else if (a === "order") { const o = UI.ord; UI.ord = { corps: null, dest: null }; UI.act("order", o.corps, x + "|" + o.dest); }
    else if (a === "subtab") { UI.subtab = x; UI.armed = null; AUDIO.sfx("click"); UI.keys.subtabs = null; UI.renderPanel(true); }
    else if (a === "pcat") { UI.pressCat = x; AUDIO.sfx("click"); UI.update(true); }
    else if (a === "contact") { UI.contact = x; AUDIO.sfx("click"); UI.update(true); const c = $("#conv"); if (c) c.scrollTop = c.scrollHeight; }
    else if (a === "mapclose") { UI.mapSel = null; UI.update(); }
    else if (a === "goto") { UI.subtab = x; UI.keys.subtabs = null; UI.renderPanel(true); }
    else if (a === "offensive") UI.act("offensive", x);
  },
  mapInfo(){ const s = GAME.s, ch = GAME.ch(s); UI.put("map-info", UI.mapSel ? ch.mapInfo(s, UI.mapSel) : ""); },

  updatePress(){
    const s = GAME.s, ch = GAME.ch(s); const cat = UI.pressCat || "tous"; s.seen.feedN = s.feedN;
    UI.put("opinion", ch.opinions(s).map(([l, v]) => `<div class="gauge"><div class="top"><span class="name">${l}</span><span class="val">${Math.round(v)} / 100 · ${v >= 65 ? "favorable" : v >= 40 ? "partagée" : "hostile"}</span></div><span class="bar"><i class="lvl-${v < 30 ? "bad" : v < 50 ? "warn" : "good"}" style="width:${v}%"></i></span></div>`).join(""));
    UI.put("pcats", ch.pressCats.map(([k, l]) => `<button data-do="pcat|${k}" aria-pressed="${k === cat}">${esc(l)}</button>`).join(""));
    const items = s.feed.filter(n => cat === "tous" ? n.cat !== "sys" : n.cat === cat).slice(0, 70);
    UI.put("press", `<div class="ai-status" id="ai-status"></div>` + (items.length ? items.map(n => `<article class="art ${n.ton || ""}"><div class="m">${esc(frDate(n.d))} · ${esc(n.src)}</div>${n.title ? `<h3>${esc(n.title)}</h3>` : ""}${n.text ? `<p>${esc(n.text)}</p>` : ""}
      ${n.ton ? `<div class="tags"><span class="ton ${n.ton}">${ch.tonLabel[n.ton]}</span>${n.fx ? `<span class="fxo">Opinion ${esc({ France: "en France", "étranger": "à l’étranger" }[n.fx.k] || n.fx.k)} ${n.fx.v > 0 ? "+" : "−"}${String(Math.abs(n.fx.v)).replace(".", ",")}</span>` : `<span class="fxo">Sans effet sur l’opinion</span>`}</div>` : ""}</article>`).join("") : `<span class="note">Aucun article dans cette rubrique pour l’instant.</span>`));
    UI.updateAIStatus();
  },

  updateFinances(al){
    const s = GAME.s, ch = GAME.ch(s); const b = ch.budget(s); const f = v => `${v < 0 ? "−" : ""}${Math.abs(Math.round(v)).toLocaleString("fr-FR")} ${ch.fin.unit}`;
    UI.put("alerts", UI.alertBox(al[UI.view] || al.finances || []));
    UI.put("fkpi", ch.fin.kpis(s, b, f).map(([l, v]) => `<div><small>${l}</small><b>${v}</b></div>`).join(""));
    const tbl = (title, rows, sign) => `<div class="panel"><h2>${title}</h2><div class="tbl">${rows.map(([l, v]) => `<div><span>${esc(l)}</span><span>${sign}${v.toFixed(1).replace(".", ",")}</span></div>`).join("")}<div class="tot"><span>Total</span><span>${sign}${rows.reduce((t, x) => t + x[1], 0).toFixed(1).replace(".", ",")}</span></div></div></div>`;
    UI.put("ftables", tbl("Revenus par mois", b.rec, "+") + tbl("Dépenses par mois", b.dep, "−"));
    // Graphique : une seule série (le Trésor), ligne fine, grille discrète, survol avec valeur
    const pts = [...s.fin.slice(-12), { d: s.date, t: s.stats[ch.fin.stat] }];
    if (pts.length < 3) { UI.put("chart", `<span class="note">Le relevé se construit mois après mois : revenez dans quelques semaines.</span>`); return; }
    const W = 640, H = 190, L = 54, R = 14, T = 12, B = 26; const vals = pts.map(p => p.t); let lo = Math.min(0, ...vals), hi = Math.max(0, ...vals); if (hi - lo < 50) hi = lo + 50; const pad = (hi - lo) * .08; hi += pad; if (lo < 0) lo -= pad;
    const X = i => L + i * (W - L - R) / (pts.length - 1), Y = v => T + (hi - v) / (hi - lo) * (H - T - B);
    const step = (() => { const raw = (hi - lo) / 4; const m = Math.pow(10, Math.floor(Math.log10(raw))); return [1, 2, 5, 10].map(k => k * m).find(k => k >= raw); })();
    const ticks = []; for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
    UI.chartData = { pts, X, Y, W, H, L, R, T, B };
    UI.put("chart", `<div class="chartbox"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ch.fin.chartTitle)} : de ${Math.round(vals[0])} à ${Math.round(vals[vals.length - 1])}">
      ${ticks.map(v => `<line class="grid ${v === 0 ? "zero" : ""}" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${L - 8}" y="${Y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`).join("")}
      ${pts.map((p, i) => (i % 3 === 0 && pts.length - 1 - i >= 2) || i === pts.length - 1 ? `<text class="ax" x="${X(i)}" y="${H - 6}" text-anchor="${i === pts.length - 1 ? "end" : i === 0 ? "start" : "middle"}">${esc(MONTHS[parseD(p.d).m - 1].slice(0, 4))} ${String(parseD(p.d).y).slice(2)}</text>` : "").join("")}
      <polyline class="line" points="${pts.map((p, i) => `${X(i).toFixed(1)},${Y(p.t).toFixed(1)}`).join(" ")}"/>
      <circle class="end" cx="${X(pts.length - 1)}" cy="${Y(vals[vals.length - 1])}" r="4.5"/>
      <g id="ch-hover" hidden><line class="cross" y1="${T}" y2="${H - B}"/><circle class="end" r="4.5"/></g></svg><div class="tip" id="ch-tip" hidden></div></div>`);
  },
  chartHover(e, svg){
    const g = $("#ch-hover"), tip = $("#ch-tip"); if (!g || !tip) return; const D = UI.chartData;
    if (!e || !D) { g.hidden = true; tip.hidden = true; return; }
    const r = svg.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * D.W; const i = clamp(Math.round((x - D.L) / ((D.W - D.L - D.R) / (D.pts.length - 1))), 0, D.pts.length - 1); const p = D.pts[i];
    g.hidden = false; g.querySelector("line").setAttribute("x1", D.X(i)); g.querySelector("line").setAttribute("x2", D.X(i)); g.querySelector("circle").setAttribute("cx", D.X(i)); g.querySelector("circle").setAttribute("cy", D.Y(p.t));
    tip.hidden = false; tip.textContent = `${frMonth(p.d)} : ${Math.round(p.t)} ${GAME.ch().fin.unit}`; tip.style.left = clamp(D.X(i) / D.W * 100, 12, 88) + "%";
  },

  /* ---------------- Correspondance ---------------- */
  avatar(name, grp){ const ini = name.replace(/\(.*\)/, "").split(/[\s-]+/).filter(w => /^[A-ZÉÈÀ]/.test(w)).map(w => w[0]).slice(0, 2).join(""); return `<span class="ava g${grp}" aria-hidden="true">${esc(ini)}</span>`; },
  updateCorr(){
    const s = GAME.s, ch = GAME.ch(s);
    const list = ch.contactGroups.map(([g, ids], gi) => { const rows = ids.filter(id => GAME.relKnown(s, id)).map(id => { const r = GAME.relDef(s, id), th = s.corr[id] || [], last = th[th.length - 1], un = th.filter(m => m.unread).length, dead = !!s.deadRel[id];
        return `<button class="contact ${id === UI.contact ? "on" : ""} ${dead ? "dead" : ""}" data-do="contact|${id}">${UI.avatar(r.name, gi)}<span class="cn"><b>${esc(r.name)}${dead ? " †" : ""}</b><small>${esc(r.role)}</small><span class="lm">${last ? esc((last.me ? "Vous : " : "") + last.t) : "Aucun échange"}</span></span>${un ? `<i class="badge-dot">${un}</i>` : ""}</button>`; }).join(""); return rows ? `<div class="blk-h">${esc(g)}</div>${rows}` : ""; }).join("");
    UI.put("contacts", list);
    const id = UI.contact; if (!id) return; const r = GAME.relDef(s, id), th = s.corr[id] || [], dead = !!s.deadRel[id]; const days = ch.mailDays(s, id); const v = s.rel[id];
    let touched = false; for (const m of th) if (m.unread) { m.unread = false; touched = true; }
    const gi = ch.contactGroups.findIndex(g => g[1].includes(id));
    UI.put("conv-h", `${UI.avatar(r.name, gi)}<div><b>${esc(r.name)}</b><small>${esc(r.role)} · ${esc(ch.regionName(ch.contactLoc(s, id)))} · ${dead ? "décédé" : days ? `courrier : ${days} jours` : "auprès de vous : réponse immédiate"}</small></div><span class="chip ${dead ? "mort" : GAME.relStatus(v)}">${dead ? "Décédé" : GAME.relStatusLabel[GAME.relStatus(v)] + " · " + Math.round(v)}</span>`);
    const left = d => Math.max(1, Math.round((new Date(d) - new Date(s.date)) / 864e5));
    const waiting = s.corrQueue.some(q => q.id === id) || UI.typing === id;
    const html = (th.length ? th.map(m => `<div class="bub ${m.me ? "me" : "them"}"><p>${esc(m.t)}</p><small>${esc(frDate(m.d))}${m.me ? (m.arrive && m.arrive > s.date ? ` · en route, arrivée prévue dans ${left(m.arrive)} jour${left(m.arrive) > 1 ? "s" : ""}` : " · remise") : ""}</small></div>`).join("") : `<div class="note" style="text-align:center;padding:20px">Aucune lettre échangée avec ${esc(r.name)}. ${esc(r.bio)}</div>`)
      + (waiting ? `<div class="bub them wait"><p>${UI.typing === id ? "écrit sa réponse…" : "Sa réponse est en route."}</p></div>` : "");
    if (UI.put("conv", html) || touched) { const c = $("#conv"); c.scrollTop = c.scrollHeight; }
    const ta = $("#msg"), sb = $("#send"); ta.disabled = dead; sb.disabled = dead; ta.placeholder = dead ? `${r.name} n’est plus.` : `Écrivez à ${r.name}…${days ? ` Votre lettre mettra ${days} jours.` : ""}`;
  },
  mailResume(){ if (UI.mailPaused) { const w = UI.mailPaused; UI.mailPaused = 0; if (!UI.modalOpen) LOOP.setSpeed(w); } },
  sendMail(){
    const s = GAME.s, ch = GAME.ch(s), id = UI.contact, ta = $("#msg"); const t = ta.value.trim();
    if (!id || !GAME.relAlive(s, id)) return; if (t.length < 3) { UI.toast("Écrivez d’abord votre lettre."); return; }
    const days = ch.mailDays(s, id); const m = { d: s.date, me: true, t: t.slice(0, 1200) }; if (days) m.arrive = addDays(s.date, days); else m.asked = true;
    (s.corr[id] = s.corr[id] || []).push(m); if (s.corr[id].length > 300) s.corr[id].shift();
    ta.value = ""; ta.blur(); AUDIO.sfx("paper"); UI.save(); UI.update(true); UI.mailResume();
    if (!days) UI.fetchReply(id, 0); else UI.toast(`Lettre partie : arrivée prévue dans ${days} jours.`);
  },
  /* La personne a reçu la lettre : sa réponse est écrite (par Claude si possible), puis voyage */
  async fetchReply(id, days){
    const s = GAME.s, ch = GAME.ch(s); let rep = null;
    if (!days) { UI.typing = id; UI.update(true); }
    if (AI.usable()) { try { rep = await AI.reply(s, id); } catch (e) { rep = null; } }
    if (GAME.s !== s) return; if (UI.typing === id) UI.typing = null;
    if (!rep) rep = { t: ch.mailFallback(s, id), rel: 0 };
    if (!GAME.relAlive(s, id)) return;
    if (days) s.corrQueue.push({ id, t: rep.t, rel: rep.rel, at: addDays(s.date, days) });
    else { s.corr[id].push({ d: s.date, me: false, t: rep.t, unread: !(UI.kind() === "corr" && UI.contact === id) }); if (rep.rel) GAME.applyFx(s, { r: { [id]: rep.rel } }); AUDIO.sfx("notify"); }
    UI.save(); UI.update(true);
  },
  /* Un contact écrit de lui-même */
  async mailTurn(){
    const s = GAME.s, ch = GAME.ch(s); let m = null;
    if (AI.usable()) { try { m = await AI.mail(s); } catch (e) { m = null; } }
    if (GAME.s !== s || s.dead) return;
    if (!m) { const pool = ch.mailScripts.filter(x => GAME.relAlive(s, x.id) && !(s.corr[x.id] || []).some(y => y.t === x.t)); if (!pool.length) return; m = pool[Math.floor(Math.random() * pool.length)]; }
    (s.corr[m.id] = s.corr[m.id] || []).push({ d: s.date, me: false, t: m.t, unread: true });
    AUDIO.sfx("notify"); UI.toast(`Lettre de ${GAME.relDef(s, m.id).name}`); UI.save(); UI.update();
  },

  /* ---------------- Panneaux de gestion ---------------- */
  renderPanel(force){
    const s = GAME.s, ch = GAME.ch(s); const pb = $("#pbody"); if (!pb) return;
    let pid = ch.windows[UI.view];
    if (UI.view === "general") {
      const tabs = [...ch.windows.general.map(id => ch.panels.find(p => p.id === id)).filter(p => { try { return p && p.cond(s); } catch (e) { return false; } }), { id: "_rel", label: "Relations" }];
      if (!tabs.some(t => t.id === UI.subtab)) UI.subtab = tabs[0].id; pid = UI.subtab;
      UI.put("subtabs", tabs.map(t => `<button role="tab" data-do="subtab|${t.id}" aria-selected="${t.id === pid}">${esc(t.label)}</button>`).join(""));
    }
    if (!force && (Date.now() < UI.busyUntil || (document.activeElement && pb.contains(document.activeElement) && ["SELECT", "INPUT"].includes(document.activeElement.tagName)))) return;
    UI.ctlById = {}; let n = 0; const reg = c => { const id = "k" + (n++); UI.ctlById[id] = c; return id; };
    const meter = ([l, v]) => `<div class="meter"><span>${esc(l)}</span><span class="bar"><i class="lvl-${v < 30 ? "bad" : v < 50 ? "warn" : "good"}" style="width:${clamp(v, 0, 100)}%"></i></span><span class="num">${Math.round(v)}</span></div>`;
    const relbar = v => { const w = Math.abs(v) / 2; return `<span class="relbar"><i style="left:${v >= 0 ? 50 : 50 - w}%;width:${w}%;background:var(--${v >= 40 ? "good" : v >= -15 ? "muted" : v >= -50 ? "warn" : "bad"})"></i></span>`; };
    const ctl = c => {
      if (!c) return "";
      switch (c.k) {
        case "h": return `<div class="blk-h" style="margin-top:6px">${esc(c.text)}</div>`;
        case "info": return `<div class="note">${c.html}</div>`;
        case "kpi": return `<div class="kpi">${c.items.map(([l, v]) => `<div><small>${esc(l)}</small><b>${esc(v)}</b></div>`).join("")}</div>`;
        case "table": return `<div><div class="blk-h">${esc(c.title)}</div><div class="tbl">${c.rows.map(([l, v]) => `<div><span>${esc(l)}</span><span>${esc(v)}</span></div>`).join("")}</div></div>`;
        case "slider": { const id = reg(c); return `<div class="ctl"><div class="ctl-top"><label for="${id}">${esc(c.label)}</label><b>${esc(c.fmt ? c.fmt(c.val) : c.val)}</b></div><input type="range" id="${id}" data-cid="${id}" min="${c.min}" max="${c.max}" step="${c.step}" value="${c.val}"><span class="note">${esc(c.live ? c.live(c.val) : c.note || "")}</span></div>`; }
        case "select": { const id = reg(c); return `<div class="ctl"><div class="ctl-top"><label for="${id}">${esc(c.label)}</label></div><select id="${id}" data-cid="${id}" ${c.dis ? "disabled" : ""}>${c.options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(c.val) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>${c.dis && typeof c.dis === "string" ? `<span class="note">${esc(c.dis)}</span>` : c.note ? `<span class="note">${esc(c.note)}</span>` : ""}</div>`; }
        case "btn": { const id = reg(c); const armed = UI.armed === c.act + "|" + c.arg; return `<button class="pbtn ${armed ? "arm" : ""}" data-cid="${id}" ${c.dis ? "disabled" : ""}><b>${armed ? "Confirmer ?" : esc(c.label)}</b><span>${esc(typeof c.dis === "string" ? c.dis : c.cost || "")}</span></button>`; }
        case "row": return `<div class="rowc ${c.done ? "done" : ""} ${c.pick ? "pick" : ""} ${c.pick && c.pick === UI.ord.corps ? "on" : ""}" ${c.pick ? `data-pick="${c.pick}" tabindex="0" role="button"` : ""}><div class="rt"><b>${esc(c.title)}</b>${c.badge ? `<span class="chip ${c.badge[1]}">${esc(c.badge[0])}</span>` : ""}</div>${c.sub ? `<div class="rs">${esc(c.sub)}</div>` : ""}${(c.alerts || []).map(a => `<span class="warn-chip">${esc(a)}</span>`).join("")}${c.rel !== undefined ? relbar(c.rel) : ""}${(c.meters || []).map(meter).join("")}${c.ctrls && c.ctrls.length ? `<div class="rc">${c.ctrls.map(ctl).join("")}</div>` : ""}</div>`;
      }
      return "";
    };
    let html;
    if (pid === "_rel") {
      const known = ch.relations.filter(r => GAME.relKnown(s, r.id)); const alive = known.filter(r => !s.deadRel[r.id]), dead = known.filter(r => s.deadRel[r.id]);
      html = [...alive, ...dead].map(r => { const v = s.rel[r.id]; const st = s.deadRel[r.id] ? "mort" : GAME.relStatus(v); return `<button class="rel ${s.deadRel[r.id] ? "dead" : ""}"><span class="n">${esc(r.name)}${s.deadRel[r.id] ? " †" : ""}</span><span class="chip ${st}">${GAME.relStatusLabel[st]}</span><span class="ro">${esc(r.role)}</span>${relbar(v)}<span class="rel-detail" hidden>${esc(r.bio)}</span></button>`; }).join("");
    } else { let blocks = []; try { blocks = ch.panels.find(p => p.id === pid).blocks(s); const nb = blocks.filter(c => !(c && c.k === "btn" && (c.act === "write" || c.act === "write_article"))); if (nb.length < blocks.length) { nb.push({ k: "info", html: "Vos prises de parole (interviews, discours, messages…) se font désormais lors des rendez-vous de votre agenda." }); blocks = nb; } } catch (e) { blocks = [{ k: "info", html: "Ce panneau n’est pas disponible pour le moment." }]; } html = blocks.map(ctl).join(""); }
    if (html !== UI.keys.panel) { const top = pb.scrollTop; pb.innerHTML = html; pb.scrollTop = top; UI.keys.panel = html; }
  },
  updateAIStatus(){
    const el = $("#ai-status"); if (!el) return;
    const cls = !AI.enabled ? "off" : AI.status === "busy" ? "busy" : !AI.available ? "off" : "ok";
    el.innerHTML = `<span class="dot ${cls}"></span><span>${esc(!AI.enabled ? "IA désactivée dans les réglages" : AI.note)}</span>`;
  },

  /* Exécute un réglage ou un bouton de panneau */
  act(act, arg, val){
    const s = GAME.s, ch = GAME.ch(s); if (!s || s.dead || UI.modalOpen) return;
    if (act === "write_article") { UI.actionModal("article"); return; }
    if (act === "write") { UI.actionModal(arg); return; }
    let res = {}; try { res = ch.act(s, act, arg, val) || {}; } catch (e) { res = { msg: "Impossible pour le moment.", tone: "bad" }; }
    ch.sync && ch.sync(s);
    if (res.msg) { GAME.news(s, { src: res.src || "Carnet", text: res.msg, tone: res.tone || "" }); UI.toast(res.msg); } else if (res.toast) UI.toast(res.toast);
    AUDIO.sfx(res.sfx || (res.tone === "bad" ? "error" : act === "pol" ? "" : "click"));
    UI.save(); UI.update(true);
    if (res.battle) UI.fieldBattle(res.battle);
  },

  /* Bataille lancée depuis la carte ou la diplomatie */
  fieldBattle(o){
    const s = GAME.s; if (s.speed > 0) UI.resumeSpeed = s.speed; LOOP.setSpeed(0);
    BATTLE.start(s, o.battle, o.title, res => {
      const out = { deltas: {}, rels: {}, notes: [], death: null }; GAME.battleOutcome(s, o.battle, res, out);
      GAME.news(s, { src: "Carnet", title: `${res.win ? "Victoire" : "Revers"} : ${o.battle.name}`, text: out.notes.join(" "), tone: res.win ? "good" : "bad" }); if (GAME.ch(s).press) GAME.ch(s).press(s, "bataille", out.battle);
      s.history.push({ date: s.date, id: "bat-" + s.week, kind: "bataille", title: o.title, choice: "Offensive ordonnée", hist: null, histExists: false, outcome: `${res.win ? "Victoire" : "Défaite"} — ${o.battle.name}` });
      if (out.death) s.deathPending = out.death; UI.save();
      const ov = UI.openModal(`<div class="outcome"><div class="ev-kind"><span class="k">Bataille</span></div><h2>${esc(o.title)}</h2><div class="verdict ${res.win ? "win" : "loss"}">${res.win ? "Victoire" : "Défaite"}</div><p class="ev-text">${out.notes.map(esc).join(" ")}</p><div class="deltas">${UI.deltaChips(out)}</div><div class="row"><button class="btn primary" id="cont">Continuer</button></div></div>`, { scene: "bataille" });
      $("#cont", ov).onclick = () => UI.afterEvent();
    });
  },

  deltaChips(out){
    const s = GAME.s; const chips = [];
    for (const [k, v] of Object.entries(out.deltas)) { const d = GAME.statDef(s, k); if (Math.abs(v) < .5) continue; const good = d.bad === "high" ? v < 0 : v > 0; chips.push(`<span class="${good ? "p" : "m"}">${esc(d.label)} ${v > 0 ? "+" : ""}${Math.round(v)}</span>`); }
    for (const [k, v] of Object.entries(out.rels)) { if (!v) continue; chips.push(`<span class="${v > 0 ? "p" : "m"}">${esc(GAME.relDef(s, k).name)} ${v > 0 ? "+" : ""}${Math.round(v)}</span>`); }
    return chips.join("");
  },

  /* ---------------- Fenêtres ---------------- */
  openModal(html, { scene = null, onClose = null, dismissable = false, wide = false } = {}){
    UI.modalOpen = true;
    overlay().innerHTML = `<div class="overlay" role="dialog" aria-modal="true"><div class="modal ${wide ? "wide" : ""}">${scene ? `<div class="scene">${ART.scene(scene)}</div>` : ""}<div class="modal-body">${html}</div></div></div>`;
    const ov = $(".overlay");
    if (dismissable) ov.addEventListener("click", e => { if (e.target === ov) { UI.closeModal(); onClose && onClose(); } });
    return ov;
  },
  closeModal(){ overlay().innerHTML = ""; UI.modalOpen = false; },
  pause(){ const s = GAME.s; if (!s) return 0; const was = s.speed; if (was > 0) { UI.resumeSpeed = was; LOOP.setSpeed(0); } return was; },

  /* ---------------- Action libre écrite ---------------- */
  actionModal(preType, opts = {}){
    const s = GAME.s, ch = GAME.ch(s); if (!s || s.dead || UI.modalOpen) return;
    const was = UI.pause(); AUDIO.sfx("paper"); const R = opts.rdv || null;
    let types = ch.speech.filter(t => !t.cond || t.cond(s));
    if (R) { const t0 = AI.tp(s, preType); types = [t0.id === "__rdv" ? { ...t0, hint: "Décrivez ce que vous dites ou faites pendant ce rendez-vous, et à qui.", ph: "Ex. : Je demande à voir les comptes moi-même avant de décider, et je convoque le responsable pour demain…" } : t0]; }
    const A = UI.draft && UI.draft.char === s.char && UI.draft.rdvId === (R ? R.id : null) ? UI.draft : (UI.draft = { char: s.char, rdvId: R ? R.id : null, type: types[0].id, target: "", text: "" });
    if (preType && types.some(t => t.id === preType)) A.type = preType;
    if (!types.some(t => t.id === A.type)) A.type = types[0].id;
    A.advice = null; A.msg = null; A.busy = null; A.itw = null;
    const resume = R ? () => { AGENDA.mark(s, R, "fait"); UI.save(); UI.afterEvent(); } : () => { UI.closeModal(); UI.update(true); if (was || UI.resumeSpeed) LOOP.setSpeed(was || UI.resumeSpeed); };
    const back = R ? () => { UI.closeModal(); UI.showEvent(R, opts.kind || "rdv"); } : resume;
    const render = () => {
      const tp = types.find(t => t.id === A.type) || types[0]; const can = R ? true : GAME.canAct(s); const adv = ch.advisor(s);
      const targets = ch.relations.filter(r => GAME.relAlive(s, r.id));
      const ov = UI.openModal(`
        <div class="ev-kind"><span class="k hist">${R ? esc(tp.label) : "Action libre"}</span><span class="label">${esc(frDate(AGENDA.today(s)))}${R ? "" : ` · ${can ? "1 action disponible cette semaine" : "action de la semaine déjà utilisée"}`}</span></div>
        <h2>${R ? esc(R.title) : "Que faites-vous ?"}</h2>
        ${R ? `<p class="ev-text" style="margin:0">${esc(R.text)}</p>` : `<div class="types" role="group" aria-label="Type d’action">${types.map(t => `<button data-type="${t.id}" aria-pressed="${t.id === A.type}">${esc(t.label)}</button>`).join("")}</div>`}
        <span class="note">${esc(tp.hint)} Le temps est en pause. Une action envoyée est définitive.</span>
        ${tp.target ? `<div class="ctl"><div class="ctl-top"><label for="a-target">Destinataire</label></div><select id="a-target" class="sel"><option value="">Quelqu’un d’autre (nommez-le dans le texte)</option>${targets.map(r => `<option value="${esc(r.name)}" ${A.target === r.name ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select></div>` : ""}
        ${tp.flow === "interview" ? (A.itw ? `<div class="advice"><div class="label">${esc(A.itw.media)} · interview</div>${A.itw.questions.map((q, i) => `<div class="ctl"><div class="ctl-top"><label for="a-q${i}">${esc(q)}</label></div><textarea class="write" style="min-height:70px" id="a-q${i}" data-q="${i}" maxlength="600" placeholder="Votre réponse…" ${A.busy ? "disabled" : ""}>${esc(A.itw.answers[i] || "")}</textarea></div>`).join("")}</div>` : `<div class="advice"><div>Un journaliste vous posera deux ou trois questions. Vos réponses forment l’action de la semaine.</div><div class="row" style="justify-content:flex-start"><button class="btn" id="a-itw" ${A.busy || !AI.usable() ? "disabled" : ""}>Commencer l’interview</button></div></div>`) : `<textarea class="write" id="a-text" maxlength="1500" placeholder="${esc(tp.ph)}" aria-label="Votre action" ${A.busy ? "disabled" : ""}>${esc(A.text)}</textarea>`}
        ${tp.photo ? `<div class="ctl"><div class="ctl-top"><label for="a-photo">Photo ou vidéo jointe (décrivez-la)</label></div><input class="sel" id="a-photo" maxlength="200" value="${esc(A.photo || "")}" placeholder="Ex. : moi à l’entraînement, torse nu, sourire, pouce levé"></div>` : ""}
        ${A.busy ? `<div class="loading" style="grid-template-columns:auto 1fr;align-items:center"><div class="quill" aria-hidden="true"></div><span>${esc(A.busy)}</span></div>` : ""}
        ${A.msg ? `<div class="refusal" role="alert"><b>${esc(A.msg.title)}</b><br>${esc(A.msg.text)}</div>` : ""}
        ${A.advice ? `<div class="advice"><div class="label">Avis de ${esc(A.advice.name)}, ${esc(A.advice.role)} · reconstitution</div><div>${esc(A.advice.avis)}</div>
          ${A.advice.risques.length ? `<h4>Risques</h4><ul>${A.advice.risques.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}${A.advice.effets.length ? `<h4>Effets probables</h4><ul>${A.advice.effets.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}${A.advice.alternatives.length ? `<h4>Autres voies</h4><ul>${A.advice.alternatives.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div>` : ""}
        ${!AI.usable() ? `<div class="refusal"><b>Claude n’est pas disponible dans cette vue.</b><br>L’action libre et le conseiller ont besoin de Claude pour calculer les répercussions. Les panneaux de gestion, eux, fonctionnent toujours.</div>` : ""}
        <div class="row"><button class="btn ghost" id="a-close" ${A.busy ? "disabled" : ""}>${R ? "Revenir aux choix" : "Fermer sans agir"}</button><button class="btn" id="a-advise" ${A.busy || !AI.usable() ? "disabled" : ""}>Demander conseil à ${esc(adv.name)}</button><button class="btn primary" id="a-go" style="font-size:1rem;padding:.6em 2em" ${A.busy || !can || !AI.usable() ? "disabled" : ""}>Agir</button></div>`, { wide: true });
      const ta = $("#a-text", ov) || { value: "", focus(){}, setSelectionRange(){} }; ta.oninput = () => { A.text = ta.value; };
      const ph = $("#a-photo", ov); if (ph) ph.oninput = () => { A.photo = ph.value; };
      $$("[data-q]", ov).forEach(q => q.oninput = () => { A.itw.answers[+q.dataset.q] = q.value; });
      const ib = $("#a-itw", ov); if (ib) ib.onclick = async () => { A.msg = null; A.busy = "Le journaliste prépare ses questions…"; render(); try { A.itw = await AI.interview(s); A.itw.answers = []; } catch (e) { A.msg = { title: "L’interview n’a pas pu commencer.", text: "Réessayez dans un instant. Votre action n’est pas consommée." }; } A.busy = null; if (GAME.s === s && UI.modalOpen) render(); };
      if (!A.busy) setTimeout(() => { try { ta.focus({ preventScroll: true }); ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) {} }, 30);
      const tg = $("#a-target", ov); if (tg) tg.onchange = () => { A.target = tg.value; };
      $$("[data-type]", ov).forEach(b => b.onclick = () => { A.type = b.dataset.type; A.msg = null; render(); });
      $("#a-close", ov).onclick = back;
      const compose = () => tp.flow === "interview" ? (A.itw ? `Interview accordée à ${A.itw.media}.\n` + A.itw.questions.map((q, i) => `Question : ${q}\nRéponse : ${(A.itw.answers[i] || "(pas de réponse)").trim()}`).join("\n") : "") : A.text.trim() + (tp.photo && A.photo ? `\n[Photo ou vidéo jointe : ${A.photo.trim()}]` : "");
      const need = () => { if (tp.flow === "interview") { if (!A.itw || !A.itw.answers.some(a => a && a.trim().length > 3)) { A.msg = { title: "Répondez d’abord aux questions.", text: "Lancez l’interview, puis répondez à au moins une question." }; render(); return false; } return true; } if (A.text.trim().length < 12) { A.msg = { title: "Écrivez d’abord votre action.", text: "Quelques phrases suffisent : ce que vous ordonnez, dites ou écrivez, et à qui." }; render(); return false; } return true; };
      $("#a-advise", ov).onclick = async () => { if (!need()) return; A.msg = null; A.busy = `${adv.name} réfléchit à votre projet…`; render(); try { A.advice = await AI.advise(s, { type: A.type, target: A.target, text: compose(), rdv: R }); AUDIO.sfx("notify"); } catch (e) { A.msg = { title: `${adv.name} n’a pas pu répondre.`, text: "Vous pouvez redemander, ou agir sans son avis. Votre action n’est pas consommée." }; } A.busy = null; if (GAME.s === s && UI.modalOpen) render(); };
      $("#a-go", ov).onclick = async () => {
        if (!need() || !GAME.canAct(s)) return; A.msg = null; A.busy = "Les courriers partent. Claude calcule les répercussions…"; render();
        const act = { type: A.type, target: A.target, text: compose(), rdv: R }; let res = null;
        try { res = await AI.evaluateAction(s, act); } catch (e) { A.busy = null; A.msg = { title: "Claude n’a pas pu répondre, après deux essais.", text: "Votre action n’est pas consommée : vous pouvez la renvoyer telle quelle dans un instant." }; AUDIO.sfx("error"); if (GAME.s === s) render(); return; }
        if (GAME.s !== s) return; A.busy = null;
        if (!res.valide) { A.msg = { title: "Action impossible : elle n’est pas consommée.", text: res.raison }; AUDIO.sfx("error"); render(); return; }
        UI.applyAction(act, res, resume);
      };
    };
    render();
  },

  applyAction(act, res, resume){
    const s = GAME.s, ch = GAME.ch(s); const tp = AI.tp(s, act.type);
    const out = GAME.applyFx(s, res.fx);
    const jid = "j" + s.journal.length + "-" + s.week;
    for (const d of res.differes) s.deferred.push({ date: addDays(s.date, d.weeks * 7), title: d.title, text: d.text, fx: d.fx, from: jid });
    for (const n of [...res.news].reverse()) GAME.news(s, { src: n.src, title: n.title, text: n.text, kind: "action", ton: n.ton });
    s.journal.push({ id: jid, d: AGENDA.today(s), type: act.type, typeLabel: act.rdv ? `${tp.label} (${act.rdv.title})` : tp.label, target: act.target || "", text: act.text, resume: res.resume, importance: res.importance, deltas: out.deltas, news: res.news.map(n => n.title), suites: [] });
    s.actionWeek = s.week; UI.draft = null; UI.save();
    AUDIO.sfx(act.type === "discours" ? "crowd" : "notify");
    const ov = UI.openModal(`
      <div class="ev-kind"><span class="k hist">${esc(tp.label)}</span><span class="label">${esc(frDate(s.date))}</span></div>
      <h2>Le monde réagit</h2><p class="ev-text">${esc(res.resume)}</p>
      <div class="deltas">${UI.deltaChips(out) || `<span>Aucun effet immédiat mesurable</span>`}</div>
      <div class="res-grid">
        <div><h4>Dans la presse</h4>${res.news.map(n => `<div class="news"><span class="m">${esc(n.src)}</span><b>${esc(n.title)}</b><span>${esc(n.text)}</span></div>`).join("<div style='height:8px'></div>")}</div>
        <div>${res.reactions.length ? `<h4>Réactions</h4>${res.reactions.map(r => `<div class="comment"><small>${esc(r.nom)}${r.relation ? ` · relation ${r.relation > 0 ? "+" : ""}${r.relation}` : ""}</small>${esc(r.reaction)}</div>`).join("")}` : ""}
          ${res.comments.length ? `<h4 style="margin-top:10px">${esc(ch.publicLabel)}</h4>${res.comments.map(c => `<div class="comment">${c.qui ? `<small>${esc(c.qui)}</small>` : ""}${esc(c.texte)}</div>`).join("")}` : ""}</div>
      </div>
      ${res.differes.length ? `<p class="later">${res.differes.length === 1 ? "Une autre conséquence se fera" : `${res.differes.length} autres conséquences se feront`} sentir plus tard.</p>` : ""}
      <div class="row"><button class="btn primary" id="cont">${UI.contLabel()}</button></div>`, { wide: true });
    $("#cont", ov).onclick = resume;
  },

  /* ---------------- Agenda de la semaine ---------------- */
  contLabel(){ const s = GAME.s; const n = AGENDA.next(s); return n ? "Rendez-vous suivant" : "Continuer"; },
  renderCal(){
    const s = GAME.s; if (!s || !$("#cal")) return; const items = s.agenda || []; const d0 = s.day || 0;
    const cells = Array.from({ length: 7 }, (_, d) => { const dt = addDays(s.date, d); const its = items.filter(i => i.day === d);
      return `<div class="cd ${d === d0 ? "today" : d < d0 ? "past" : ""}" role="listitem"><span class="cw">${AGENDA.WD[AGENDA.wd(dt)]} <b>${parseD(dt).d}</b></span>${its.map(i => `<button class="rv k-${i.kind} ${i.done ? "done" : ""}" data-rv="${i.uid}" title="${esc(i.title)}"><span class="ic" aria-hidden="true">${i.done ? (i.done === "delegue" ? "↷" : "✓") : esc(i.icon || "•")}</span><span class="tt">${esc(i.title)}</span></button>`).join("")}</div>`; }).join("");
    UI.put("cal", cells);
    const nx = AGENDA.upcoming(s); UI.put("cal-next", nx ? `<b>${esc(AGENDA.dayLabel(s, nx.day))}</b> · ${esc(nx.title)}` : `<span>Plus de rendez-vous cette semaine</span>`);
  },
  calClick(uid){
    const s = GAME.s; const it = (s.agenda || []).find(i => i.uid === uid); if (!it || UI.modalOpen) return;
    if (!it.done && it.day <= (s.day || 0)) { UI.openItem(it); return; }
    const txt = it.done ? `${it.done === "delegue" ? "Délégué" : "Fait"} : ${it.title}` : `${AGENDA.dayLabel(s, it.day)} : ${it.title}${it.ev && it.ev.text ? " — " + it.ev.text.slice(0, 110) + (it.ev.text.length > 110 ? "…" : "") : ""}`;
    UI.toast(txt);
  },
  openDay(){ const s = GAME.s; if (!s || s.dead || UI.modalOpen) return false; const it = AGENDA.next(s); if (!it) return false; UI.openItem(it); return true; },
  openItem(it){
    const s = GAME.s, ch = GAME.ch(s); if (s.speed > 0) UI.resumeSpeed = s.speed; LOOP.setSpeed(0); UI.update();
    if (it.kind === "hist") { it.done = "fait"; const ev = ch.events.find(e => e.id === it.evId); if (ev && !s.done[ev.id]) UI.showEvent(ev, "hist"); else UI.afterEvent(); return; }
    if (it.kind === "match") { it.done = "fait"; UI.save(); UI.playMatch(it.m); return; }
    if (it.kind === "saison") { it.done = "fait"; UI.showEvent(it.ev, "saison"); return; }
    UI.rdvAdvice = null; UI.showEvent(it.ev, it.kind === "parole" ? "parole" : "rdv");
  },
  async adviseRdv(ev, kind){
    const s = GAME.s; UI.rdvAdvice = { id: ev.id, busy: true }; UI.closeModal(); UI.showEvent(ev, kind);
    try { const a = await AI.advise(s, { type: "__rdv", text: "Comment aborder ce rendez-vous ? Que me conseillez-vous de faire ?", rdv: ev }); UI.rdvAdvice = { id: ev.id, ...a }; AUDIO.sfx("notify"); }
    catch (e) { UI.rdvAdvice = { id: ev.id, err: "Le conseiller n’a pas pu répondre. Vous pouvez décider sans son avis." }; }
    if (GAME.s === s && UI.currentEvent && UI.currentEvent.id === ev.id) { UI.closeModal(); UI.showEvent(ev, kind); }
  },
  delegateRdv(ev, kind){
    const s = GAME.s; UI.currentEvent = null; AUDIO.sfx("click");
    const out = AGENDA.delegate(s, ev, kind); AGENDA.mark(s, ev, "delegue"); s.pending = null; UI.save();
    GAME.news(s, { src: "Carnet", title: ev.title, text: "Rendez-vous délégué.", tone: "" });
    const ov = UI.openModal(`<div class="outcome"><div class="ev-kind"><span class="k">Délégué</span></div><h2>${esc(ev.title)}</h2>
      <p class="ev-text">${out.notes.map(esc).join(" ")}</p><div class="deltas">${UI.deltaChips(out)}</div>
      <div class="row"><button class="btn primary" id="cont">${UI.contLabel()}</button></div></div>`, { scene: ev.scene || s.scene });
    $("#cont", ov).onclick = () => UI.afterEvent();
  },

  /* ---------------- Décisions imposées ---------------- */
  showEvent(ev, kind){
    const s = GAME.s;
    if (s.speed > 0) UI.resumeSpeed = s.speed; LOOP.setSpeed(0);
    UI.currentEvent = ev; UI.currentKind = kind;
    s.pending = { kind, id: ev.id, ev: kind === "hist" || kind === "ecrit" ? null : ev };
    const people = (ev.people || []).map(p => { const r = GAME.relDef(s, p); return r ? r.name : p; }).filter(Boolean);
    const it = (kind === "rdv" || kind === "parole") ? (s.agenda || []).find(i => !i.done && i.ev && i.ev.id === ev.id) : null;
    const kindLabel = kind === "hist" ? (GAME.ch(s).histLabel || "Moment historique") : kind === "ai" ? "Dépêche · écrite par Claude" : kind === "guerre" ? "Alerte" : kind === "saison" ? "Carrière" : kind === "parole" ? "Prise de parole" : kind === "rdv" ? (it && it.src === "ai" ? "Rendez-vous · écrit par Claude" : it && it.src === "fixe" ? "Rendez-vous habituel" : "Rendez-vous") : "Dépêche";
    const adv = GAME.ch(s).advisor(s); const advice = UI.rdvAdvice && UI.rdvAdvice.id === ev.id ? UI.rdvAdvice : null;
    const extra = it ? `<div class="rdv-extra">${AI.usable() ? `<button class="btn" id="rv-free">${kind === "parole" ? "Écrire mes propres mots" : "Répondre avec mes mots"}</button><button class="btn ghost" id="rv-adv" ${advice && advice.busy ? "disabled" : ""}>Conseil de ${esc(adv.name)}</button>` : ""}${(ev.choices || []).some(c => !c.battle && !c.match) || kind === "parole" ? `<button class="btn ghost" id="rv-del">${kind === "parole" ? "Laisser un proche parler" : "Déléguer"}</button>` : ""}</div>
      ${advice ? `<div class="advice"><div class="label">Avis de ${esc(adv.name)} · reconstitution</div>${advice.busy ? `<div>${esc(adv.name)} réfléchit…</div>` : advice.err ? `<div>${esc(advice.err)}</div>` : `<div>${esc(advice.avis)}</div>${advice.risques.length ? `<h4>Risques</h4><ul>${advice.risques.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}${advice.alternatives.length ? `<h4>Autres voies</h4><ul>${advice.alternatives.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}`}</div>` : ""}` : "";
    AUDIO.sfx(kind === "guerre" ? "drum" : "event");
    const ov = UI.openModal(`
      <div class="ev-kind"><span class="k ${kind === "hist" ? "hist" : ""}">${kindLabel}</span><span class="label">${esc(it ? AGENDA.dayLabel(s, it.day) : frDate(kind === "hist" && ev.date && ev.date.slice(0, 7) === s.date.slice(0, 7) ? ev.date : AGENDA.today(s)))} · ${esc(ev.place || s.place)}</span></div>
      <h2>${esc(ev.title)}</h2><p class="ev-text">${esc(ev.text)}</p>
      ${people.length ? `<div class="people">${people.map(p => `<span>${esc(p)}</span>`).join("")}</div>` : ""}
      <div class="choices">${ev.choices.map((c, i) => `<button class="choice" data-choice="${i}">${esc(c.t)}${c.battle ? `<small>${GAME.ch(s).fiction ? "Duel" : "Bataille"} : ${esc(c.battle.name)}</small>` : ""}${c.match ? `<small>Match à jouer</small>` : ""}</button>`).join("")}</div>${extra}`, { scene: ev.scene || s.scene });
    $$("[data-choice]", ov).forEach(b => b.onclick = () => UI.choose(+b.dataset.choice));
    const fb = $("#rv-free", ov); if (fb) fb.onclick = () => { UI.closeModal(); UI.actionModal(kind === "parole" ? it.type : "__rdv", { rdv: ev, kind }); };
    const ab = $("#rv-adv", ov); if (ab) ab.onclick = () => UI.adviseRdv(ev, kind);
    const db = $("#rv-del", ov); if (db) db.onclick = () => UI.delegateRdv(ev, kind);
  },

  choose(i){
    const s = GAME.s, ev = UI.currentEvent, kind = UI.currentKind; if (!ev) return;
    const c = ev.choices[i]; UI.currentEvent = null; AUDIO.sfx("click");
    const out = { deltas: {}, rels: {}, notes: [], death: null };
    if (ev.pre) GAME.applyFx(s, ev.pre, out);
    GAME.applyFx(s, kind === "rdv" || kind === "parole" ? AGENDA.tune(s, c.fx) : c.fx, out);
    const finish = () => {
      if (kind === "hist" || (kind === "ecrit" && ev.once)) s.done[ev.id] = kind;
      if (kind === "rdv" || kind === "parole") AGENDA.mark(s, ev, "fait");
      if (kind === "saison") { s.pending = null; UI.save(); UI.closeModal(); const nx = GAME.ch(s).week ? GAME.ch(s).week(s, true) : null; if (nx && nx.event) { UI.showEvent(nx.event, "saison"); return; } if (nx && nx.match) { UI.playMatch(nx.match); return; } UI.afterEvent(); return; }
      if (kind === "ecrit") { s.recentRandom.push(ev.id); if (s.recentRandom.length > 6) s.recentRandom.shift(); }
      const outcome = out.battle ? `${out.battle.win ? "Victoire" : "Défaite"} — ${out.battle.name}` : (c.res || "");
      s.history.push({ date: s.date, id: ev.id, kind, title: ev.title, choice: c.t, hist: kind === "hist" ? !!c.hist : null, histExists: kind === "hist" ? ev.choices.some(x => x.hist) : false, outcome });
      if (s.history.length > 500) s.history.splice(0, s.history.length - 500);
      GAME.news(s, { src: "Carnet", title: ev.title, text: `${c.t}.${out.battle ? ` ${out.battle.win ? "Victoire" : "Défaite"} : ${out.battle.name}.` : ""}`, tone: kind === "hist" ? "key" : out.battle ? (out.battle.win ? "good" : "bad") : "" });
      const chx = GAME.ch(s); if (chx.press) { if (out.battle) chx.press(s, "bataille", out.battle); else chx.press(s, "evenement", { title: ev.title, res: c.res, hist: kind === "hist" }); }
      s.pending = null; if (out.death) s.deathPending = out.death; UI.save();
      const real = kind === "hist" && ev.real ? `<div class="realbox"><b>${chx.fiction ? "Dans les livres" : "Dans la réalité"} :</b> ${esc(ev.real)}${ev.anecdote ? `<br><i>${esc(ev.anecdote)}</i>` : ""}</div>` : "";
      const verdict = out.battle ? `<div class="verdict ${out.battle.win ? "win" : "loss"}">${out.battle.win ? "Victoire" : out.battle.draw ? "Match nul" : "Défaite"} · ${esc(out.battle.name)}</div>` : "";
      const ov = UI.openModal(`<div class="outcome">
        <div class="ev-kind"><span class="k ${kind === "hist" ? "hist" : ""}">${kind === "hist" ? (c.hist ? "Comme dans la réalité" : "Ton histoire bifurque") : "Conséquences"}</span></div>
        <h2>${esc(ev.title)}</h2>${verdict}
        <p class="ev-text">${esc(c.res || "")}${out.notes.length ? " " + out.notes.map(esc).join(" ") : ""}</p>
        <div class="deltas">${UI.deltaChips(out)}</div>${real}
        <div class="row"><button class="btn primary" id="cont">${out.death ? "Continuer…" : UI.contLabel()}</button></div></div>`, { scene: s.scene });
      $("#cont", ov).onclick = () => UI.afterEvent();
    };
    if (c.match) { UI.closeModal(); MATCH.start(s, c.match, res => { const chm = GAME.ch(s); const r = chm.applyMatch(s, c.match, res); out.battle = { name: c.match.title, win: r.win, draw: r.draw }; const o = r.win ? c.match.win : r.draw ? (c.match.draw || c.match.loss) : c.match.loss; if (o) { GAME.applyFx(s, o, out); if (o.txt) out.notes.unshift(o.txt); } out.notes.unshift(r.line); finish(); }); }
    else if (c.battle) { const b = { ...c.battle, region: c.battle.region || ev.region }; UI.closeModal(); BATTLE.start(s, b, ev.title, res => { GAME.battleOutcome(s, b, res, out); finish(); }); }
    else finish();
  },

  afterEvent(){
    const s = GAME.s; UI.closeModal(); UI.update(true);
    if (s.deathPending) { const d = s.deathPending; delete s.deathPending; UI.die(d); return; }
    if (UI.openDay()) return;
    LOOP.setSpeed(UI.resumeSpeed || 1);
  },

  async randomEvent(){
    const s = GAME.s;
    if (AI.usable()) {
      let ev = AI.take(s);
      if (!ev) { if (!AI.pending) AI.prefetch(s); if (AI.pending && await UI.waitForAI()) ev = AI.take(s); }
      if (ev && GAME.s === s && !s.dead) { UI.showEvent(ev, "ai"); return; }
    }
    if (GAME.s !== s || s.dead) return;
    const fb = GAME.pickFallback(s);
    if (fb) UI.showEvent(fb, "ecrit"); else { UI.closeModal(); LOOP.setSpeed(UI.resumeSpeed || 1); }
  },
  waitForAI(){
    const s = GAME.s; if (s.speed > 0) UI.resumeSpeed = s.speed; LOOP.setSpeed(0);
    return new Promise(resolve => {
      let done = false; const finish = v => { if (done) return; done = true; resolve(v); };
      const ov = UI.openModal(`<div class="loading"><div class="quill" aria-hidden="true"></div><div class="label">${esc(frDate(s.date))}</div><h2>Un courrier arrive…</h2>
        <p class="muted">Claude rédige la dépêche à partir de votre situation et de vos actions passées.</p>
        <div class="row" style="justify-content:flex-start"><button class="btn" id="skip-ai">Ne pas attendre</button></div></div>`, { scene: s.scene });
      $("#skip-ai", ov).onclick = () => finish(false);
      AI.pending.then(ev => finish(!!ev), () => finish(false));
    });
  },

  /* Un match joué en direct, hors événement */
  playMatch(m){
    const s = GAME.s, ch = GAME.ch(s); if (s.speed > 0) UI.resumeSpeed = s.speed; LOOP.setSpeed(0);
    MATCH.start(s, m, res => { ch.applyMatch(s, m, res); UI.save(); UI.update(true); const next = ch.week ? ch.week(s, true) : null; if (next && next.event) { UI.showEvent(next.event, "saison"); return; } if (next && next.match) { UI.playMatch(next.match); return; } UI.afterEvent(); });
  },

  /* Les rivaux avancent leurs plans : par Claude si possible, sinon par le jeu */
  async rivalsTurn(){
    const s = GAME.s; let news = null;
    if (AI.usable()) { try { news = await AI.rivals(s); } catch (e) { news = null; } }
    if (GAME.s !== s || s.dead) return;
    if (!news) news = GAME.rivalsScripted(s);
    if (news && news.length) { AUDIO.sfx("notify"); UI.toast(news[0].title); UI.flagGeneral = true; UI.save(); UI.update(); }
  },

  die(death){
    const s = GAME.s; const ch = GAME.ch(s);
    LOOP.stop(); AI.reset(); AUDIO.stopTheme(); AUDIO.sfx("death");
    s.dead = { date: s.date, age: GAME.age(s), cause: death.cause, type: death.type };
    GAME.news(s, { src: "Carnet", title: "Mort", text: death.cause, tone: "bad" }); UI.save();
    const ov = UI.openModal(`<div class="outcome"><div class="label">${esc(frDate(s.date))} · ${esc(s.place)}</div>
      <h2 style="font-size:2rem">${esc(ch.name)} est mort</h2><p class="ev-text">${esc(death.cause)}</p>
      <p class="muted">${s.dead.age} ans. ${esc(GAME.rankLabel(s))}. La partie est terminée.</p>
      <div class="row"><button class="btn primary" id="to-end">${ch.fiction ? "Toi contre les livres" : "Toi contre l’Histoire"}</button></div></div>`, { scene: s.scene });
    $("#to-end", ov).onclick = () => { UI.closeModal(); UI.endScreen(); };
  },

  /* ---------------- Fin : « Toi contre l’Histoire » ---------------- */
  endScreen(){
    const s = GAME.s, ch = GAME.ch(s); LOOP.stop(); UI.setTheme(ch.theme, false);
    const weeks = Math.max(1, s.counters.weeks);
    const c = { ...s.counters, avgPop: (s.counters.popSum || 0) / weeks };
    const legend = ch.legends.find(l => { try { return l.cond(s, c); } catch (e) { return false; } }) || ch.legends[ch.legends.length - 1];
    const deathDate = s.dead ? s.dead.date : s.date;
    const histChoices = s.history.filter(h => h.kind === "hist" && h.histExists);
    const same = histChoices.filter(h => h.hist).length;
    const fidelity = histChoices.length ? Math.round(same / histChoices.length * 100) : 100;
    const rows = [];
    for (const e of ch.events) {
      if (e.date < s.startDate || s.done[e.id] === "pre") continue;
      const h = [...s.history].reverse().find(x => x.id === e.id);
      const isReal = e.choices.some(x => x.hist);
      if (!h && (!isReal || e.date > deathDate)) continue;
      const histChoice = e.choices.find(x => x.hist);
      const you = h ? `<span class="tag ${h.hist ? "same" : "diff"}">${h.hist ? (ch.fiction ? "Comme dans les livres" : "Comme dans l’Histoire") : (ch.fiction ? "Tu as changé le récit" : "Tu as changé l’Histoire")}</span><div><b>${esc(h.choice)}</b></div><div class="muted">${esc(h.outcome)} · ${esc(frMonth(h.date))}</div>`
        : `<span class="tag none">N’a pas eu lieu ainsi</span><div class="muted">Dans ta partie, le cours des choses avait déjà bifurqué${s.done[e.id] === "panel" ? " : tu l’as décidé toi-même depuis tes panneaux" : ""}.</div>`;
      rows.push(`<div class="frise-row"><div class="when">${esc(frMonth(e.date))}</div><div class="you"><h3>${esc(e.title)}</h3>${you}</div>
        <div class="real">${isReal ? `<div class="label" style="margin-bottom:4px">${ch.fiction ? "Ce qui se passe dans les livres" : "Ce qui s’est vraiment passé"}</div>${histChoice ? `<div><b>${esc(histChoice.t)}</b></div>` : ""}<div>${esc(e.real)}</div>${e.anecdote ? `<div class="anec">${esc(e.anecdote)}</div>` : ""}` : `<div class="muted">${esc(e.real || "Cet épisode n’existe que dans ta version.")}</div>`}</div></div>`);
    }
    const rd = ch.realDeath;
    rows.push(`<div class="frise-row"><div class="when">Fin</div><div class="you"><h3>Ta mort</h3><div><b>${s.dead ? esc(frDate(s.dead.date)) : "—"}</b>, à ${s.dead ? s.dead.age : GAME.age(s)} ans</div><div class="muted">${esc(s.dead ? s.dead.cause : "")} ${esc(s.place)}.</div></div>
      <div class="real">${rd ? `<div class="label" style="margin-bottom:4px">Sa mort réelle</div><div><b>${esc(frDate(rd.date))}</b>, à ${rd.age} ans, ${esc(rd.place)}.</div><div class="anec">${esc(rd.cause)}</div>` : `<div class="label" style="margin-bottom:4px">${esc(ch.realStatus.title)}</div><div>${esc(ch.realStatus.text)}</div>`}</div></div>`);
    const top = [...s.journal].sort((a, b) => (b.importance || 1) - (a.importance || 1) || b.d.localeCompare(a.d)).slice(0, 8).sort((a, b) => a.d.localeCompare(b.d));
    app().innerHTML = `<div class="wrap"><div class="label" style="margin-top:10px">${ch.fiction ? "Toi contre les livres" : "Toi contre l’Histoire"}</div>
      <section class="end-hero"><div class="portrait">${ch.portrait(s)}</div>
        <div style="display:grid;gap:10px;min-width:0"><div class="muted ui">${esc(ch.name)} · ${esc(frDate(ch.born))} – ${esc(frDate(deathDate))}</div>
          <div class="legend-title">${esc(legend.title)}</div><p class="epitaph">${esc(legend.text)}</p>
          <div class="title-actions" style="margin-top:4px"><button class="btn primary" id="again">Nouvelle partie</button><button class="btn" id="exp">Exporter la partie</button><button class="btn ghost" id="home">Menu principal</button></div></div></section>
      <div class="vs">${[...ch.endTiles(s, { fidelity, same, total: histChoices.length }), ["Actions libres", s.journal.length, "Écrites de ta main"]].map(([l, v, sub]) => `<div><small>${esc(l)}</small><b>${esc(v)}</b><small>${esc(sub)}</small></div>`).join("")}</div>
      ${top.length ? `<h2 style="font-size:1.3rem;margin-top:8px">Tes actions les plus marquantes</h2><div style="display:grid;gap:12px;margin:10px 0 22px">${top.map(j => `<div class="news key"><span class="m">${esc(frDate(j.d))} · ${esc(j.typeLabel)}${j.target ? " à " + esc(j.target) : ""}</span><b>${esc(j.resume)}</b><span class="muted">« ${esc(j.text.length > 260 ? j.text.slice(0, 260) + "…" : j.text)} »</span>${j.suites && j.suites.length ? `<span class="note">Suites : ${j.suites.map(q => esc(q.t)).join(" ; ")}</span>` : ""}</div>`).join("")}</div>` : ""}
      <h2 style="font-size:1.3rem;margin-top:8px">La frise comparée</h2>
      <div class="frise"><div class="frise-h label"><span>Date</span><span>Toi</span><span>${ch.fiction ? "Les livres" : ch.realStatus ? "La réalité" : "L’Histoire"}</span></div>${rows.join("")}</div></div>`;
    $("#again").onclick = () => UI.setup(s.char); $("#home").onclick = () => UI.title(); $("#exp").onclick = () => UI.exportGame(s);
    window.scrollTo(0, 0);
  },

  /* ---------------- Menu, parties, export, import, réglages ---------------- */
  menuModal(){
    const was = UI.pause(); const back = () => { UI.closeModal(); if (was) LOOP.setSpeed(was); };
    const ov = UI.openModal(`<h2>Menu</h2><p class="muted ui" style="margin:0">La partie est enregistrée en continu dans l’emplacement ${GAME.s.slot}. Rien ne peut être annulé.</p>
      <div style="display:grid;gap:8px"><button class="btn" id="m-saves">Parties, export et import</button><button class="btn" id="m-set">Réglages</button><button class="btn" id="m-quit">Quitter vers le menu principal</button><button class="btn primary" id="m-back">Reprendre</button></div>`, { dismissable: true, onClose: () => { if (was) LOOP.setSpeed(was); } });
    $("#m-back", ov).onclick = back; $("#m-saves", ov).onclick = () => UI.savesModal(was); $("#m-set", ov).onclick = () => UI.settingsModal(was);
    $("#m-quit", ov).onclick = () => { UI.save(); UI.title(); };
  },
  savesModal(was){
    const s = GAME.s; const close = () => { UI.closeModal(); if (GAME.s && !GAME.s.dead && was) LOOP.setSpeed(was); };
    const render = () => {
      const slots = [1, 2, 3].map(n => ({ n, d: STORE.read(n) }));
      const ov = UI.openModal(`<h2>Parties sauvegardées</h2>
        <p class="muted ui" style="margin:0">Trois emplacements, trois parties différentes. Chaque partie s’enregistre toute seule, en continu : il n’existe pas de retour en arrière.</p>
        <div class="slots">${slots.map(({ n, d }) => { const ok = STORE.valid(d); return `<div class="slot"><div class="meta"><b>Emplacement ${n}${s && s.slot === n ? " · partie en cours" : ""}</b>
          <div>${ok ? `${esc(CHARACTERS[d.char].short)} · ${esc(frDate(d.date))} · ${yearsBetween(CHARACTERS[d.char].born, d.date)} ans${d.dead ? " · partie terminée" : ""}` : "Vide"}</div></div>
          <div class="ops">${ok && !(s && s.slot === n) ? `<button class="btn small" data-load="${n}">Jouer</button>` : ""}${ok && !(s && s.slot === n) ? `<button class="btn small ghost" data-del="${n}">Effacer</button>` : ""}</div></div>`; }).join("")}</div>
        <div class="setting"><span>Exporter la partie en cours en fichier JSON</span><button class="btn small" id="exp" ${s ? "" : "disabled"}>Exporter</button></div>
        <div class="setting" style="display:grid;gap:8px;justify-content:stretch"><span>Importer une partie (fichier .json ou texte collé). Les anciennes versions sont converties.</span>
          <input type="file" id="imp-file" accept=".json,application/json" style="min-height:44px">
          <textarea class="json" id="imp-text" placeholder="…ou collez ici le contenu JSON d’une sauvegarde" aria-label="Contenu JSON de la sauvegarde"></textarea>
          <div class="ctl"><div class="ctl-top"><label for="imp-slot">Emplacement d’arrivée</label></div><select id="imp-slot" class="sel">${[1, 2, 3].map(n => `<option value="${n}" ${s && s.slot === n ? "disabled" : ""}>Emplacement ${n}${s && s.slot === n ? " (partie en cours)" : STORE.valid(slots[n - 1].d) ? " (sera remplacé)" : " (libre)"}</option>`).join("")}</select></div>
          <div class="row"><button class="btn small" id="imp-go">Importer et jouer</button></div></div>
        <div class="row"><button class="btn primary" id="close">Fermer</button></div>`, { dismissable: true, onClose: () => { if (GAME.s && !GAME.s.dead && was) LOOP.setSpeed(was); } });
      $$("[data-load]", ov).forEach(b => b.onclick = () => { const d = STORE.read(+b.dataset.load); if (STORE.valid(d)) { if (s) UI.save(); d.slot = +b.dataset.load; UI.closeModal(); UI.loadGame(d); } });
      $$("[data-del]", ov).forEach(b => b.onclick = () => { if (b.dataset.confirm) { STORE.remove(+b.dataset.del); render(); } else { b.dataset.confirm = "1"; b.textContent = "Confirmer ?"; } });
      $("#exp", ov).onclick = () => s && UI.exportGame(s);
      $("#imp-file", ov).onchange = e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { $("#imp-text", ov).value = String(rd.result); }; rd.readAsText(f); };
      $("#imp-go", ov).onclick = () => { let d = null; try { d = STORE.migrate(JSON.parse($("#imp-text", ov).value)); } catch (e) {} if (!STORE.valid(d)) { UI.toast("Ce fichier n’est pas une sauvegarde Legacy lisible."); return; } if (s) UI.save(); d.slot = +$("#imp-slot", ov).value; STORE.write(d.slot, d); UI.closeModal(); UI.loadGame(d); UI.toast(`Partie importée dans l’emplacement ${d.slot}`); };
      $("#close", ov).onclick = close;
    };
    render();
  },
  async exportGame(s){
    const json = JSON.stringify({ game: "Legacy", format: SAVE_VERSION, exportedAt: new Date().toISOString(), state: s }, null, 1);
    const name = `legacy-${s.char}-${s.date}.json`;
    if (AI.downloads) { try { await AI.downloads.save({ filename: name, data: json }); UI.toast("Fichier de sauvegarde proposé au téléchargement"); return; } catch (e) { if (e && e.code === "declined") return; } }
    const ended = !$("#date");
    const ov = UI.openModal(`<h2>Exporter la partie</h2><p class="muted">Copiez ce texte et gardez-le dans un fichier « ${esc(name)} ». Vous pourrez le recoller dans « Importer ».</p>
      <textarea class="json" id="exp-text" readonly aria-label="Sauvegarde au format JSON">${esc(json)}</textarea>
      <div class="row"><button class="btn" id="copy">Copier</button><button class="btn primary" id="close">Fermer</button></div>`, { dismissable: true });
    $("#copy", ov).onclick = () => { const ta = $("#exp-text", ov); const fb = () => { ta.select(); UI.toast("Texte sélectionné : copiez-le"); }; try { navigator.clipboard.writeText(json).then(() => UI.toast("Copié dans le presse-papiers"), fb); } catch (e) { fb(); } };
    $("#close", ov).onclick = () => UI.closeModal();
  },
  settingsModal(was){
    const close = () => { UI.closeModal(); if (GAME.s && !GAME.s.dead && was) LOOP.setSpeed(was); };
    const ov = UI.openModal(`<h2>Réglages</h2>
      <div class="setting"><label for="set-music">Musique d’ambiance</label><select id="set-music" class="sel" style="width:auto"><option value="1" ${AUDIO.musicOn ? "selected" : ""}>Activée</option><option value="0" ${!AUDIO.musicOn ? "selected" : ""}>Coupée</option></select></div>
      <div class="setting"><label for="set-sfx">Bruitages</label><select id="set-sfx" class="sel" style="width:auto"><option value="1" ${AUDIO.sfxOn ? "selected" : ""}>Activés</option><option value="0" ${!AUDIO.sfxOn ? "selected" : ""}>Coupés</option></select></div>
      <div class="setting"><label for="set-ai">Claude (actions libres, conseiller, dépêches, rivaux)</label><select id="set-ai" class="sel" style="width:auto"><option value="1" ${AI.enabled ? "selected" : ""}>Activé</option><option value="0" ${!AI.enabled ? "selected" : ""}>Désactivé</option></select></div>
      <div class="setting"><label for="set-tier">Rédaction de l’IA</label><select id="set-tier" class="sel" style="width:auto"><option value="quick" ${AI.tier === "quick" ? "selected" : ""}>Rapide</option><option value="default" ${AI.tier === "default" ? "selected" : ""}>Soignée</option><option value="complex" ${AI.tier === "complex" ? "selected" : ""}>Approfondie (plus lente)</option></select></div>
      <p class="muted ui" style="font-size:.88rem;margin:0">${esc(AI.available ? "Claude est disponible dans cette vue ; chaque appel utilise votre compte Claude." : "Claude n’est pas disponible dans cette vue : les panneaux, la carte, les batailles et les dépêches écrites à l’avance restent jouables.")} Clavier : espace = pause, 1, 2, 3 = vitesses, A = agir.</p>
      <div class="row"><button class="btn primary" id="close">Fermer</button></div>`, { dismissable: true, onClose: () => { if (GAME.s && !GAME.s.dead && was) LOOP.setSpeed(was); } });
    $("#set-music", ov).onchange = e => { AUDIO.setMusic(e.target.value === "1"); const b = $("#b-music"); if (b) b.setAttribute("aria-pressed", AUDIO.musicOn); };
    $("#set-sfx", ov).onchange = e => { AUDIO.setSfx(e.target.value === "1"); const b = $("#b-sfx"); if (b) b.setAttribute("aria-pressed", AUDIO.sfxOn); };
    $("#set-ai", ov).onchange = e => { AI.enabled = e.target.value === "1"; AI.failures = 0; STORE.setSetting("ai", AI.enabled); if (!AI.enabled) AI.reset(); UI.updateAIStatus(); };
    $("#set-tier", ov).onchange = e => { AI.tier = e.target.value; STORE.setSetting("tier", AI.tier); };
    $("#close", ov).onclick = close;
  }
};

/* =====================================================================
   BOUCLE DE TEMPS — une semaine toutes les 6 secondes à x1 (≈ 5 min par an)
   ===================================================================== */
const LOOP = {
  /* Le temps n’avance que quand le joueur le demande : un jour, ou jusqu’au prochain rendez-vous.
     setSpeed(0) interrompt une avance en cours ; setSpeed(n > 0) la reprend seulement si elle n’est pas terminée. */
  timer: null, target: null, ms: { 1: 140, 2: 140, 4: 140 },
  advance(mode){ const s = GAME.s; if (!s || s.dead || UI.modalOpen) return; LOOP.target = mode; s.speed = 1; LOOP.step(); },
  setSpeed(n){
    const s = GAME.s; if (!s) return;
    if (s.dead) n = 0;
    if (n > 0 && UI.modalOpen) return;
    if (n <= 0) LOOP.target = null;
    s.speed = n > 0 && LOOP.target ? 1 : 0;
    LOOP.schedule();
  },
  stop(){ clearTimeout(LOOP.timer); LOOP.timer = null; const tb = $("#tickbar"); if (tb) { tb.style.transition = "none"; tb.style.width = "0"; } },
  schedule(){
    clearTimeout(LOOP.timer); LOOP.timer = null;
    const s = GAME.s; const tb = $("#tickbar");
    if (!s || s.speed <= 0 || UI.modalOpen || s.dead) { if (tb) { tb.style.transition = "none"; tb.style.width = "0"; } return; }
    if (!LOOP.target) { s.speed = 0; return; }
    LOOP.timer = setTimeout(LOOP.step, LOOP.ms[1]);
  },
  step(){
    const s = GAME.s; if (!s || s.dead || UI.modalOpen || s.speed <= 0) return;
    if (!s.agenda || s.agendaWeek !== s.week) AGENDA.plan(s);
    s.day = (s.day || 0) + 1;
    if (s.day >= 7) { LOOP.weekEnd(); return; }
    UI.update(); UI.save();
    if (UI.openDay()) return;
    if (LOOP.target === "day") LOOP.setSpeed(0); else LOOP.schedule();
  },
  weekEnd(){
    const s = GAME.s; const ch = GAME.ch(s); s.day = 0;
    const { death, fired, arrived, mail } = GAME.tick(s);
    if (fired.length) { AUDIO.sfx("notify"); UI.toast(fired[0].d.title); UI.flagGeneral = true; }
    for (const a of arrived) UI.fetchReply(a.id, ch.mailDays(s, a.id) || 3);
    if (mail.length) { AUDIO.sfx("notify"); UI.toast(`Lettre de ${GAME.relDef(s, mail[0].id).name}`); }
    UI.update(); UI.save();
    if (death) { UI.die(death); return; }
    const forced = []; let hold = false;
    const due = GAME.dueHistorical(s);
    if (due) forced.push({ kind: "hist", icon: "★", title: due.title, evId: due.id, pref: 1 + Math.floor(Math.random() * 3) });
    if (ch.week) { const w = ch.week(s); if (w && w.hold) hold = true; else if (w && w.event) forced.push({ kind: "saison", icon: "◆", title: w.event.title, ev: w.event, pref: 0 }); else if (w && w.match) forced.push({ kind: "match", icon: "◎", title: w.match.title, m: w.match, pref: AGENDA.dayOfWd(s, 6) }); }
    AGENDA.plan(s, forced); UI.update(true); UI.save();
    if (AI.usable()) AI.prefetch(s);
    if (hold) return;
    const mt = ch.meet ? ch.meet(s) : null;
    if (mt) { UI.fieldBattle(mt); return; }
    if (--s.nextMailIn <= 0) { s.nextMailIn = 5 + Math.floor(Math.random() * 5); UI.mailTurn(); }
    const off = ch.enemyMove ? ch.enemyMove(s) : null;
    if (off) { UI.showEvent(off, "guerre"); return; }
    if (--s.nextRivalIn <= 0) { s.nextRivalIn = 10 + Math.floor(Math.random() * 5); UI.rivalsTurn(); }
    if (UI.openDay()) return;
    if (LOOP.target === "day") LOOP.setSpeed(0); else LOOP.schedule();
  }
};

document.addEventListener("visibilitychange", () => { const s = GAME.s; if (document.hidden && s && s.speed > 0 && !UI.modalOpen) { UI.resumeSpeed = s.speed; LOOP.setSpeed(0); UI.save(); } });
document.addEventListener("keydown", e => {
  const s = GAME.s; if (!s || s.dead || UI.modalOpen || !$("#date")) return;
  if (e.target.closest("input,textarea,select")) return;
  if (e.code === "Space") { e.preventDefault(); LOOP.advance("day"); }
  else if (e.key === "Enter") { e.preventDefault(); LOOP.advance("next"); }
});

UI.title();
AI.init();
</script>
