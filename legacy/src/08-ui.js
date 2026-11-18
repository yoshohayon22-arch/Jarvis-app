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
  modalOpen: false, resumeSpeed: 1, currentEvent: null, currentKind: null, tab: "carte", panel: null, mapSel: null, pinSel: null, armed: null,
  feedOpen: STORE.getSetting("feedOpen", false), keys: {}, busyUntil: 0,

  toast(msg){ const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); },
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
          <p class="muted">Vous jouez jusqu’à la mort du personnage. Le temps avance d’une semaine toutes les six secondes environ ; rien ne peut être annulé.</p></div>
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
    UI.panel = (ch.panels.find(p => p.cond(s)) || ch.panels[0]).id;
    UI.buildGame(); AUDIO.theme(ch.audio);
    if (fresh) { UI.save(); AI.prefetch(s); }
    if (s.pending) { UI.restorePending(); return; }
    const due = GAME.dueHistorical(s);
    if (due) UI.showEvent(due, "hist"); else if (fresh) LOOP.setSpeed(1);
  },
  restorePending(){
    const s = GAME.s, p = s.pending, ch = GAME.ch(s); let ev = null;
    if (p.kind === "hist") ev = ch.events.find(e => e.id === p.id); else if (p.kind === "ecrit") ev = ch.randomEvents.find(e => e.id === p.id); else if (p.ev) ev = p.ev;
    s.pending = null; if (ev) UI.showEvent(ev, p.kind);
  },

  buildGame(){
    const s = GAME.s, ch = GAME.ch(s);
    const gauge = d => `<div class="gauge" data-stat="${d.id}" title="${esc(d.hint || "")}"><div class="top"><span class="name">${esc(d.label)}</span><span class="val"><span class="v"></span><span class="trend"></span></span></div><span class="bar"><i></i></span></div>`;
    const groups = Object.entries(ch.groups).map(([g, label]) => `<div class="panel"><h2>${esc(label)}</h2><div class="gauges">${ch.stats.filter(d => d.group === g).map(gauge).join("")}</div>${g === "vie" ? `<div id="conds" style="margin-top:6px"></div>` : ""}</div>`).join("");
    const m = ch.map;
    app().innerHTML = `
      <header class="topbar"><div class="topbar-in">
        <div class="who"><h1>${esc(ch.short)}</h1><span class="rank" id="rank"></span></div>
        <div class="clock"><span class="date" id="date"></span><span class="age" id="age"></span></div>
        <div class="speed" role="group" aria-label="Vitesse du temps"><button data-speed="0" title="Pause (espace)" aria-label="Pause">❚❚</button><button data-speed="1">x1</button><button data-speed="2">x2</button><button data-speed="4">x4</button></div>
        <div class="agir"><button class="btn primary" id="b-agir">Agir</button><span class="count" id="agir-count"></span></div>
        <button class="icon-btn" id="b-music" aria-pressed="${AUDIO.musicOn}" title="Musique">Musique</button>
        <button class="icon-btn" id="b-sfx" aria-pressed="${AUDIO.sfxOn}" title="Bruitages">Sons</button>
        <button class="icon-btn" id="b-menu" title="Parties, réglages, quitter">Menu</button>
      </div><div class="tick-bar"><i id="tickbar"></i></div></header>
      <main class="game" data-tab="${UI.tab}">
        <section class="col col-left" aria-label="Jauges">
          <div class="panel idcard"><div id="portrait"></div><div><div class="place" id="place"></div><span class="status" id="status"></span></div></div>
          ${groups}
          <div class="panel"><h2>Finances</h2><div class="mini" id="mini"></div></div>
        </section>
        <section class="col col-mid" aria-label="Carte et fil d’actualité">
          <div class="mapbox"><div id="map" style="width:100%;height:100%"></div>
            <div class="map-legend">${Object.entries(m.statusLabel).map(([k, l]) => `<span><i class="st-${k}" style="background:currentColor"></i>${esc(l)}</span>`).join("")}</div>
            <div id="map-info"></div></div>
          <div class="feed ${UI.feedOpen ? "" : "closed"}" id="feed"><button class="feed-h" id="feed-h" aria-expanded="${UI.feedOpen}"><span class="label">Fil d’actualité</span><span class="last" id="feed-last"></span><span class="chev" id="feed-chev"></span></button><div class="feed-list" id="feed-list"></div></div>
        </section>
        <section class="col col-right" aria-label="Panneaux de gestion"><div class="ptabs" role="tablist" id="ptabs"></div><div class="pbody" id="pbody" role="tabpanel"></div></section>
      </main>
      <nav class="tabs" aria-label="Sections"><button data-tab="carte">Carte</button><button data-tab="jauges">Jauges</button><button data-tab="gestion">Gestion</button></nav>`;
    // La légende reprend les couleurs de la carte
    $$(".map-legend i").forEach(i => { i.style.background = ""; });
    $$("[data-speed]").forEach(b => b.onclick = () => { AUDIO.sfx("click"); LOOP.setSpeed(+b.dataset.speed); });
    $("#b-agir").onclick = () => UI.actionModal();
    $("#b-music").onclick = e => { AUDIO.setMusic(!AUDIO.musicOn); e.currentTarget.setAttribute("aria-pressed", AUDIO.musicOn); };
    $("#b-sfx").onclick = e => { AUDIO.setSfx(!AUDIO.sfxOn); e.currentTarget.setAttribute("aria-pressed", AUDIO.sfxOn); AUDIO.sfx("click"); };
    $("#b-menu").onclick = () => UI.menuModal();
    $$(".tabs [data-tab]").forEach(b => b.onclick = () => { UI.tab = b.dataset.tab; $(".game").dataset.tab = UI.tab; UI.updateTabs(); window.scrollTo(0, 0); });
    $("#feed-h").onclick = () => { UI.feedOpen = !UI.feedOpen; STORE.setSetting("feedOpen", UI.feedOpen); $("#feed").classList.toggle("closed", !UI.feedOpen); $("#feed-h").setAttribute("aria-expanded", UI.feedOpen); UI.updateFeed(true); };
    const map = $("#map");
    const mapClick = e => { const pin = e.target.closest("[data-marker]"), rg = e.target.closest("[data-region]"); if (pin) { UI.pinSel = UI.pinSel === pin.dataset.marker ? null : pin.dataset.marker; AUDIO.sfx("click"); UI.updateMap(true); return; } if (rg) { AUDIO.sfx("click"); if (UI.pinSel) { const id = UI.pinSel; UI.pinSel = null; UI.act("corps_move", id, rg.dataset.region); } UI.mapSel = rg.dataset.region; UI.updateMap(true); } };
    map.addEventListener("click", mapClick); map.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); mapClick(e); } });
    $("#map-info").addEventListener("click", e => { const b = e.target.closest("[data-mi]"); if (!b) return; const [act, arg] = b.dataset.mi.split("|"); if (act === "close") { UI.mapSel = null; UI.updateMap(true); } else if (act === "panel") { UI.panel = arg; UI.tab = "gestion"; $(".game").dataset.tab = UI.tab; UI.updateTabs(); UI.renderPanel(true); } else UI.act(act, arg); });
    $("#map-info").addEventListener("change", e => { const sl = e.target.closest("[data-send]"); if (sl && sl.value) UI.act("corps_move", sl.value, sl.dataset.send); });
    // Panneaux : délégation d’événements
    const pb = $("#pbody");
    pb.addEventListener("pointerdown", () => { UI.busyUntil = Date.now() + 2500; });
    pb.addEventListener("input", e => { const r = e.target.closest("input[type=range]"); if (!r) return; UI.busyUntil = Date.now() + 2500; const lab = r.closest(".ctl").querySelector(".ctl-top b"); const c = UI.ctlById[r.dataset.cid]; if (lab && c) lab.textContent = c.fmt ? c.fmt(+r.value) : r.value; });
    pb.addEventListener("change", e => { const el = e.target.closest("[data-cid]"); if (!el) return; const c = UI.ctlById[el.dataset.cid]; if (!c) return; UI.busyUntil = 0; if (el.tagName === "SELECT" && el.value === "" ) return; UI.act(c.act, c.arg, el.value); });
    pb.addEventListener("click", e => { const b = e.target.closest("button[data-cid]"); if (!b || b.disabled) return; const c = UI.ctlById[b.dataset.cid]; if (!c) return; if (c.confirm && UI.armed !== c.act + "|" + c.arg) { UI.armed = c.act + "|" + c.arg; UI.renderPanel(true); return; } UI.armed = null; UI.busyUntil = 0; UI.act(c.act, c.arg); const r = e.target.closest(".rel"); });
    pb.addEventListener("click", e => { const b = e.target.closest(".rel"); if (!b) return; const d = b.querySelector(".rel-detail"); d.hidden = !d.hidden; UI.busyUntil = Date.now() + 8000; });
    $("#ptabs").addEventListener("click", e => { const b = e.target.closest("[data-panel]"); if (!b) return; UI.panel = b.dataset.panel; UI.armed = null; AUDIO.sfx("click"); UI.renderPanel(true); });
    UI.keys = {}; UI.lastPortraitAge = -1;
    UI.updateTabs(); UI.update(true); UI.updateAIStatus();
  },
  updateTabs(){ $$(".tabs [data-tab]").forEach(b => b.setAttribute("aria-pressed", b.dataset.tab === UI.tab)); },

  level(d, v){
    if (d.warn !== undefined && d.bad === "low") return v <= d.danger ? "bad" : v < d.warn ? "warn" : "good";
    if (d.bad === "high") return v >= 70 ? "bad" : v >= 45 ? "warn" : "good";
    return v < 25 ? "bad" : v < 45 ? "warn" : "good";
  },

  update(force){
    const s = GAME.s; if (!s || !$("#date")) return;
    const ch = GAME.ch(s);
    $("#date").textContent = frDate(s.date); $("#age").textContent = `${GAME.age(s)} ans · semaine ${s.week + 1}`; $("#rank").textContent = GAME.rankLabel(s);
    $$("[data-speed]").forEach(b => b.setAttribute("aria-pressed", +b.dataset.speed === s.speed));
    const can = GAME.canAct(s); $("#b-agir").classList.toggle("primary", can); $("#agir-count").innerHTML = `Action libre<b>${can ? "1 / 1 disponible" : "0 / 1 · la semaine prochaine"}</b>`;
    const age = GAME.age(s); if (Math.abs(age - UI.lastPortraitAge) >= 2) { $("#portrait").innerHTML = ch.portrait(s); UI.lastPortraitAge = age; }
    $("#place").textContent = s.place; $("#status").textContent = GAME.power(s) === 0 ? "Exil" : s.flags.atWar ? "En guerre" : "En paix";
    for (const d of ch.stats) {
      const el = $(`[data-stat="${d.id}"]`); if (!el) continue;
      const v = s.stats[d.id], pv = s.prev[d.id] ?? v;
      el.querySelector(".v").textContent = d.fmt ? d.fmt(v) : Math.round(v);
      const diff = v - pv; const tr = el.querySelector(".trend"); const good = d.bad === "high" ? diff < 0 : diff > 0;
      if (Math.abs(diff) >= (d.fmt ? .5 : .12)) { tr.textContent = diff > 0 ? "▲" : "▼"; tr.className = "trend " + (good ? "up" : "down"); } else { tr.textContent = ""; tr.className = "trend"; }
      const lo = d.barMin ?? Math.max(0, d.min), hi = d.barMax ?? d.max;
      const bar = el.querySelector(".bar i"); bar.style.width = (clamp((v - lo) / (hi - lo), 0, 1) * 100).toFixed(1) + "%"; bar.className = "lvl-" + UI.level(d, v);
    }
    const cd = $("#conds"); if (cd) cd.innerHTML = s.conditions.map(c => `<span class="cond-chip">${esc(c.name)}</span>`).join("");
    if (ch.budget) { const b = ch.budget(s); $("#mini").innerHTML = `<div><span>Recettes par mois</span><span class="num">+${b.R.toFixed(1)}</span></div><div><span>Dépenses par mois</span><span class="num">−${b.D.toFixed(1)}</span></div><div><span>Solde</span><span class="num" style="color:var(--${b.solde >= 0 ? "good" : "bad"})">${b.solde >= 0 ? "+" : "−"}${Math.abs(b.solde).toFixed(1)} M F</span></div>${s.dette ? `<div><span>Dette</span><span class="num">${Math.round(s.dette)} M F</span></div>` : ""}`; }
    UI.updateMap(force); UI.updateFeed(force); UI.renderPanel(force);
  },

  updateMap(force){
    const s = GAME.s, ch = GAME.ch(s), m = ch.map;
    const key = JSON.stringify([m.regions.map(r => m.status(s, r.id)), m.markers(s).map(k => [k.id, k.region, k.moving]), UI.mapSel, UI.pinSel]);
    if (!force && key === UI.keys.map) { if (UI.mapSel) UI.mapInfo(); return; } UI.keys.map = key;
    $("#map").innerHTML = ART.map(ch, s, UI.mapSel, UI.pinSel); UI.mapInfo();
  },
  mapInfo(){
    const s = GAME.s, ch = GAME.ch(s), id = UI.mapSel, box = $("#map-info");
    if (UI.pinSel && !id) { const c = s.corps.find(x => x.id === UI.pinSel); box.innerHTML = c ? `<div class="map-info"><b class="ui">${esc(c.name)} · ${esc(ch.marshalName(c.marshal))} · ${Math.round(c.men)} 000 h.</b><span class="note">Touchez une région pour y envoyer ce corps.</span></div>` : ""; return; }
    if (!id) { if (box.innerHTML) box.innerHTML = ""; return; }
    const r = m => ch.map.regions.find(x => x.id === m); const reg = r(id); const st = ch.map.status(s, id); const c = s.pays[id];
    const here = s.corps.filter(x => x.loc === id && !x.dest), coming = s.corps.filter(x => x.dest === id);
    const others = s.corps.filter(x => (x.dest || x.loc) !== id);
    const blocked = ch.canEnter(s, id);
    const html = `<div class="map-info"><button class="x" data-mi="close" aria-label="Fermer">×</button>
      <h3>${esc(reg.name)} <span class="chip ${st === "home" ? "allie" : st}">${esc(ch.map.statusLabel[st])}</span></h3>
      ${c ? `<span class="note">Relation ${Math.round(c.rel)} · armée estimée ${Math.round(c.armee)} 000 h.${st === "guerre" ? ` · avantage militaire ${Math.round(c.ws || 0)}` : ""}</span>` : ""}
      <span class="note">${here.length ? "Sur place : " + here.map(x => `${esc(x.name)} (${Math.round(x.men)} 000)`).join(", ") : "Aucun de vos corps sur place."}${coming.length ? " En marche : " + coming.map(x => esc(x.name)).join(", ") + "." : ""}</span>
      <div class="ops">
        ${others.length && GAME.power(s) >= 1 ? (blocked ? `<span class="note">${esc(blocked)}</span>` : `<select class="sel" data-send="${id}" style="width:auto;flex:1" aria-label="Envoyer un corps"><option value="">Envoyer un corps ici…</option>${others.map(x => `<option value="${x.id}">${esc(x.name)} — ${Math.round(x.men)} 000 h.</option>`).join("")}</select>`) : ""}
        ${c && st === "guerre" && !reg.sea && s.corps.some(x => !x.dest && (x.loc === id || reg.adj.includes(x.loc))) ? `<button class="btn small primary" data-mi="offensive|${id}">Lancer l’offensive</button>` : ""}
        ${c && GAME.power(s) >= 2 ? `<button class="btn small" data-mi="panel|diplomatie">Diplomatie</button>` : ""}
      </div></div>`;
    if (UI.keys.info !== html) { box.innerHTML = html; UI.keys.info = html; }
  },

  updateFeed(force){
    const s = GAME.s; const f0 = s.feed[0]; const key = s.feed.length + "|" + (f0 ? f0.d + f0.title + f0.text : "") + UI.feedOpen;
    if (!force && key === UI.keys.feed) return; UI.keys.feed = key;
    $("#feed-last").textContent = f0 ? `${f0.title || f0.text}` : ""; $("#feed-chev").textContent = UI.feedOpen ? "Replier ▾" : "Déplier ▴";
    if (UI.feedOpen) $("#feed-list").innerHTML = `<div class="ai-status" id="ai-status"></div>` + s.feed.slice(0, 60).map(n => `<div class="news ${n.tone}"><span class="m">${esc(frDate(n.d))} · ${esc(n.src)}</span>${n.title ? `<b>${esc(n.title)}</b>` : ""}${n.text ? `<span>${esc(n.text)}</span>` : ""}</div>`).join("");
    UI.updateAIStatus();
  },
  updateAIStatus(){
    const el = $("#ai-status"); if (!el) return;
    const cls = !AI.enabled ? "off" : AI.status === "busy" ? "busy" : !AI.available ? "off" : "ok";
    el.innerHTML = `<span class="dot ${cls}"></span><span>${esc(!AI.enabled ? "IA désactivée dans les réglages" : AI.note)}</span>`;
  },

  /* ---------------- Panneaux de gestion ---------------- */
  renderPanel(force){
    const s = GAME.s, ch = GAME.ch(s); const pb = $("#pbody"); if (!pb) return;
    const tabs = [...ch.panels.filter(p => { try { return p.cond(s); } catch (e) { return false; } }), { id: "_rel", label: "Relations" }];
    if (!tabs.some(t => t.id === UI.panel)) UI.panel = tabs[0].id;
    const tk = tabs.map(t => t.id).join() + UI.panel;
    if (tk !== UI.keys.tabs) { UI.keys.tabs = tk; $("#ptabs").innerHTML = tabs.map(t => `<button role="tab" data-panel="${t.id}" aria-selected="${t.id === UI.panel}">${esc(t.label)}</button>`).join(""); }
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
        case "slider": { const id = reg(c); return `<div class="ctl"><div class="ctl-top"><label for="${id}">${esc(c.label)}</label><b>${esc(c.fmt ? c.fmt(c.val) : c.val)}</b></div><input type="range" id="${id}" data-cid="${id}" min="${c.min}" max="${c.max}" step="${c.step}" value="${c.val}">${c.note ? `<span class="note">${esc(c.note)}</span>` : ""}</div>`; }
        case "select": { const id = reg(c); return `<div class="ctl"><div class="ctl-top"><label for="${id}">${esc(c.label)}</label></div><select id="${id}" data-cid="${id}" ${c.dis ? "disabled" : ""}>${c.options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(c.val) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>${c.dis && typeof c.dis === "string" ? `<span class="note">${esc(c.dis)}</span>` : c.note ? `<span class="note">${esc(c.note)}</span>` : ""}</div>`; }
        case "btn": { const id = reg(c); const armed = UI.armed === c.act + "|" + c.arg; return `<button class="pbtn ${armed ? "arm" : ""}" data-cid="${id}" ${c.dis ? "disabled" : ""}><b>${armed ? "Confirmer ?" : esc(c.label)}</b><span>${esc(typeof c.dis === "string" ? c.dis : c.cost || "")}</span></button>`; }
        case "row": return `<div class="rowc ${c.done ? "done" : ""}"><div class="rt"><b>${esc(c.title)}</b>${c.badge ? `<span class="chip ${c.badge[1]}">${esc(c.badge[0])}</span>` : ""}</div>${c.sub ? `<div class="rs">${esc(c.sub)}</div>` : ""}${c.rel !== undefined ? relbar(c.rel) : ""}${(c.meters || []).map(meter).join("")}${c.ctrls && c.ctrls.length ? `<div class="rc">${c.ctrls.map(ctl).join("")}</div>` : ""}</div>`;
      }
      return "";
    };
    let html;
    if (UI.panel === "_rel") {
      const known = ch.relations.filter(r => GAME.relKnown(s, r.id)); const alive = known.filter(r => !s.deadRel[r.id]), dead = known.filter(r => s.deadRel[r.id]);
      html = [...alive, ...dead].map(r => { const v = s.rel[r.id]; const st = s.deadRel[r.id] ? "mort" : GAME.relStatus(v); return `<button class="rel ${s.deadRel[r.id] ? "dead" : ""}"><span class="n">${esc(r.name)}${s.deadRel[r.id] ? " †" : ""}</span><span class="chip ${st}">${GAME.relStatusLabel[st]}</span><span class="ro">${esc(r.role)}</span>${relbar(v)}<span class="rel-detail" hidden>${esc(r.bio)}</span></button>`; }).join("");
    } else { let blocks = []; try { blocks = ch.panels.find(p => p.id === UI.panel).blocks(s); } catch (e) { blocks = [{ k: "info", html: "Ce panneau n’est pas disponible pour le moment." }]; } html = blocks.map(ctl).join(""); }
    if (html !== UI.keys.panel) { const top = pb.scrollTop; pb.innerHTML = html; pb.scrollTop = top; UI.keys.panel = html; }
  },

  /* Exécute un réglage ou un bouton de panneau */
  act(act, arg, val){
    const s = GAME.s, ch = GAME.ch(s); if (!s || s.dead || (UI.modalOpen && act !== "corps_move")) return;
    let res = {}; try { res = ch.act(s, act, arg, val) || {}; } catch (e) { res = { msg: "Impossible pour le moment.", tone: "bad" }; }
    ch.sync && ch.sync(s);
    if (res.msg) { GAME.news(s, { src: res.src || "Carnet", text: res.msg, tone: res.tone || "" }); UI.toast(res.msg); }
    AUDIO.sfx(res.sfx || (res.tone === "bad" ? "error" : act === "pol" ? "" : "click"));
    UI.save(); UI.update(true);
    if (res.battle) UI.fieldBattle(res.battle);
  },

  /* Bataille lancée depuis la carte ou la diplomatie */
  fieldBattle(o){
    const s = GAME.s; if (s.speed > 0) UI.resumeSpeed = s.speed; LOOP.setSpeed(0);
    BATTLE.start(s, o.battle, o.title, res => {
      const out = { deltas: {}, rels: {}, notes: [], death: null }; GAME.battleOutcome(s, o.battle, res, out);
      GAME.news(s, { src: GAME.ch(s).newsSources(s)[0], title: `${res.win ? "Victoire" : "Revers"} : ${o.battle.name}`, text: out.notes.join(" "), tone: res.win ? "good" : "bad" });
      s.history.push({ date: s.date, id: "bat-" + s.week, kind: "bataille", title: o.title, choice: "Offensive ordonnée", hist: null, histExists: false, outcome: `${res.win ? "Victoire" : "Défaite"} — ${o.battle.name}` });
      if (out.death) s.deathPending = out.death; UI.save();
      const ov = UI.openModal(`<div class="outcome"><div class="ev-kind"><span class="k">Bataille</span></div><h2>${esc(o.title)}</h2><div class="verdict ${res.win ? "win" : "loss"}">${res.win ? "Victoire" : "Défaite"}</div><p class="ev-text">${out.notes.map(esc).join(" ")}</p><div class="deltas">${UI.deltaChips(out)}</div><div class="row"><button class="btn primary" id="cont">Reprendre le cours du temps</button></div></div>`, { scene: "bataille" });
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
  actionModal(){
    const s = GAME.s, ch = GAME.ch(s); if (!s || s.dead || UI.modalOpen) return;
    const was = UI.pause(); AUDIO.sfx("paper");
    const types = ch.speech.filter(t => !t.cond || t.cond(s));
    const A = UI.draft && UI.draft.char === s.char ? UI.draft : (UI.draft = { char: s.char, type: types[0].id, target: "", text: "" });
    if (!types.some(t => t.id === A.type)) A.type = types[0].id;
    A.advice = null; A.msg = null; A.busy = null;
    const resume = () => { UI.closeModal(); UI.update(true); if (was || UI.resumeSpeed) LOOP.setSpeed(was || UI.resumeSpeed); };
    const render = () => {
      const tp = types.find(t => t.id === A.type); const can = GAME.canAct(s); const adv = ch.advisor(s);
      const targets = ch.relations.filter(r => GAME.relAlive(s, r.id));
      const ov = UI.openModal(`
        <div class="ev-kind"><span class="k hist">Action libre</span><span class="label">${esc(frDate(s.date))} · ${can ? "1 action disponible cette semaine" : "action de la semaine déjà utilisée"}</span></div>
        <h2>Que faites-vous ?</h2>
        <div class="types" role="group" aria-label="Type d’action">${types.map(t => `<button data-type="${t.id}" aria-pressed="${t.id === A.type}">${esc(t.label)}</button>`).join("")}</div>
        <span class="note">${esc(tp.hint)} Le temps est en pause. Une action envoyée est définitive.</span>
        ${tp.target ? `<div class="ctl"><div class="ctl-top"><label for="a-target">Destinataire</label></div><select id="a-target" class="sel"><option value="">Quelqu’un d’autre (nommez-le dans le texte)</option>${targets.map(r => `<option value="${esc(r.name)}" ${A.target === r.name ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select></div>` : ""}
        <textarea class="write" id="a-text" maxlength="1500" placeholder="${esc(tp.ph)}" aria-label="Votre action" ${A.busy ? "disabled" : ""}>${esc(A.text)}</textarea>
        ${A.busy ? `<div class="loading" style="grid-template-columns:auto 1fr;align-items:center"><div class="quill" aria-hidden="true"></div><span>${esc(A.busy)}</span></div>` : ""}
        ${A.msg ? `<div class="refusal" role="alert"><b>${esc(A.msg.title)}</b><br>${esc(A.msg.text)}</div>` : ""}
        ${A.advice ? `<div class="advice"><div class="label">Avis de ${esc(A.advice.name)}, ${esc(A.advice.role)} · reconstitution</div><div>${esc(A.advice.avis)}</div>
          ${A.advice.risques.length ? `<h4>Risques</h4><ul>${A.advice.risques.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}${A.advice.effets.length ? `<h4>Effets probables</h4><ul>${A.advice.effets.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}${A.advice.alternatives.length ? `<h4>Autres voies</h4><ul>${A.advice.alternatives.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div>` : ""}
        ${!AI.usable() ? `<div class="refusal"><b>Claude n’est pas disponible dans cette vue.</b><br>L’action libre et le conseiller ont besoin de Claude pour calculer les répercussions. Les panneaux de gestion, eux, fonctionnent toujours.</div>` : ""}
        <div class="row"><button class="btn ghost" id="a-close" ${A.busy ? "disabled" : ""}>Fermer sans agir</button><button class="btn" id="a-advise" ${A.busy || !AI.usable() ? "disabled" : ""}>Demander conseil à ${esc(adv.name)}</button><button class="btn primary" id="a-go" style="font-size:1rem;padding:.6em 2em" ${A.busy || !can || !AI.usable() ? "disabled" : ""}>Agir</button></div>`, { wide: true });
      const ta = $("#a-text", ov); ta.oninput = () => { A.text = ta.value; };
      if (!A.busy) setTimeout(() => { try { ta.focus({ preventScroll: true }); ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) {} }, 30);
      const tg = $("#a-target", ov); if (tg) tg.onchange = () => { A.target = tg.value; };
      $$("[data-type]", ov).forEach(b => b.onclick = () => { A.type = b.dataset.type; A.msg = null; render(); });
      $("#a-close", ov).onclick = resume;
      const need = () => { if (A.text.trim().length < 12) { A.msg = { title: "Écrivez d’abord votre action.", text: "Quelques phrases suffisent : ce que vous ordonnez, dites ou écrivez, et à qui." }; render(); return false; } return true; };
      $("#a-advise", ov).onclick = async () => { if (!need()) return; A.msg = null; A.busy = `${adv.name} réfléchit à votre projet…`; render(); try { A.advice = await AI.advise(s, { type: A.type, target: A.target, text: A.text.trim() }); AUDIO.sfx("notify"); } catch (e) { A.msg = { title: `${adv.name} n’a pas pu répondre.`, text: "Vous pouvez redemander, ou agir sans son avis. Votre action n’est pas consommée." }; } A.busy = null; if (GAME.s === s && UI.modalOpen) render(); };
      $("#a-go", ov).onclick = async () => {
        if (!need() || !GAME.canAct(s)) return; A.msg = null; A.busy = "Les courriers partent. Claude calcule les répercussions…"; render();
        const act = { type: A.type, target: A.target, text: A.text.trim() }; let res = null;
        try { res = await AI.evaluateAction(s, act); } catch (e) { A.busy = null; A.msg = { title: "Claude n’a pas pu répondre, après deux essais.", text: "Votre action n’est pas consommée : vous pouvez la renvoyer telle quelle dans un instant." }; AUDIO.sfx("error"); if (GAME.s === s) render(); return; }
        if (GAME.s !== s) return; A.busy = null;
        if (!res.valide) { A.msg = { title: "Action impossible : elle n’est pas consommée.", text: res.raison }; AUDIO.sfx("error"); render(); return; }
        UI.applyAction(act, res, resume);
      };
    };
    render();
  },

  applyAction(act, res, resume){
    const s = GAME.s, ch = GAME.ch(s); const tp = ch.speech.find(x => x.id === act.type);
    const out = GAME.applyFx(s, res.fx);
    const jid = "j" + s.journal.length + "-" + s.week;
    for (const d of res.differes) s.deferred.push({ date: addDays(s.date, d.weeks * 7), title: d.title, text: d.text, fx: d.fx, from: jid });
    for (const n of [...res.news].reverse()) GAME.news(s, { src: n.src, title: n.title, text: n.text, kind: "action" });
    s.journal.push({ id: jid, d: s.date, type: act.type, typeLabel: tp.label, target: act.target || "", text: act.text, resume: res.resume, importance: res.importance, deltas: out.deltas, news: res.news.map(n => n.title), suites: [] });
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
      <div class="row"><button class="btn primary" id="cont">Reprendre le cours du temps</button></div>`, { wide: true });
    $("#cont", ov).onclick = resume;
  },

  /* ---------------- Décisions imposées ---------------- */
  showEvent(ev, kind){
    const s = GAME.s;
    if (s.speed > 0) UI.resumeSpeed = s.speed; LOOP.setSpeed(0);
    UI.currentEvent = ev; UI.currentKind = kind;
    s.pending = { kind, id: ev.id, ev: kind === "hist" || kind === "ecrit" ? null : ev };
    const people = (ev.people || []).map(p => { const r = GAME.relDef(s, p); return r ? r.name : p; }).filter(Boolean);
    const kindLabel = kind === "hist" ? "Moment historique" : kind === "ai" ? "Dépêche · écrite par Claude" : kind === "guerre" ? "Alerte" : "Dépêche";
    AUDIO.sfx(kind === "guerre" ? "drum" : "event");
    const ov = UI.openModal(`
      <div class="ev-kind"><span class="k ${kind === "hist" ? "hist" : ""}">${kindLabel}</span><span class="label">${esc(frDate(kind === "hist" && ev.date && ev.date.slice(0, 7) === s.date.slice(0, 7) ? ev.date : s.date))} · ${esc(ev.place || s.place)}</span></div>
      <h2>${esc(ev.title)}</h2><p class="ev-text">${esc(ev.text)}</p>
      ${people.length ? `<div class="people">${people.map(p => `<span>${esc(p)}</span>`).join("")}</div>` : ""}
      <div class="choices">${ev.choices.map((c, i) => `<button class="choice" data-choice="${i}">${esc(c.t)}${c.battle ? `<small>Bataille : ${esc(c.battle.name)}</small>` : ""}</button>`).join("")}</div>`, { scene: ev.scene || s.scene });
    $$("[data-choice]", ov).forEach(b => b.onclick = () => UI.choose(+b.dataset.choice));
  },

  choose(i){
    const s = GAME.s, ev = UI.currentEvent, kind = UI.currentKind; if (!ev) return;
    const c = ev.choices[i]; UI.currentEvent = null; AUDIO.sfx("click");
    const out = { deltas: {}, rels: {}, notes: [], death: null };
    if (ev.pre) GAME.applyFx(s, ev.pre, out);
    GAME.applyFx(s, c.fx, out);
    const finish = () => {
      if (kind === "hist" || (kind === "ecrit" && ev.once)) s.done[ev.id] = kind;
      if (kind === "ecrit") { s.recentRandom.push(ev.id); if (s.recentRandom.length > 6) s.recentRandom.shift(); }
      const outcome = out.battle ? `${out.battle.win ? "Victoire" : "Défaite"} — ${out.battle.name}` : (c.res || "");
      s.history.push({ date: s.date, id: ev.id, kind, title: ev.title, choice: c.t, hist: kind === "hist" ? !!c.hist : null, histExists: kind === "hist" ? ev.choices.some(x => x.hist) : false, outcome });
      if (s.history.length > 500) s.history.splice(0, s.history.length - 500);
      GAME.news(s, { src: "Carnet", title: ev.title, text: `${c.t}.${out.battle ? ` ${out.battle.win ? "Victoire" : "Défaite"} : ${out.battle.name}.` : ""}`, tone: kind === "hist" ? "key" : out.battle ? (out.battle.win ? "good" : "bad") : "" });
      s.pending = null; if (out.death) s.deathPending = out.death; UI.save();
      const real = kind === "hist" && ev.real ? `<div class="realbox"><b>Dans l’Histoire :</b> ${esc(ev.real)}${ev.anecdote ? `<br><i>${esc(ev.anecdote)}</i>` : ""}</div>` : "";
      const verdict = out.battle ? `<div class="verdict ${out.battle.win ? "win" : "loss"}">${out.battle.win ? "Victoire" : "Défaite"} · ${esc(out.battle.name)}</div>` : "";
      const ov = UI.openModal(`<div class="outcome">
        <div class="ev-kind"><span class="k ${kind === "hist" ? "hist" : ""}">${kind === "hist" ? (c.hist ? "Comme dans l’Histoire" : "L’Histoire bifurque") : "Conséquences"}</span></div>
        <h2>${esc(ev.title)}</h2>${verdict}
        <p class="ev-text">${esc(c.res || "")}${out.notes.length ? " " + out.notes.map(esc).join(" ") : ""}</p>
        <div class="deltas">${UI.deltaChips(out)}</div>${real}
        <div class="row"><button class="btn primary" id="cont">${out.death ? "Continuer…" : "Reprendre le cours du temps"}</button></div></div>`, { scene: s.scene });
      $("#cont", ov).onclick = () => UI.afterEvent();
    };
    if (c.battle) { const b = { ...c.battle, region: c.battle.region || ev.region }; UI.closeModal(); BATTLE.start(s, b, ev.title, res => { GAME.battleOutcome(s, b, res, out); finish(); }); }
    else finish();
  },

  afterEvent(){
    const s = GAME.s; UI.closeModal(); UI.update(true);
    if (s.deathPending) { const d = s.deathPending; delete s.deathPending; UI.die(d); return; }
    const due = GAME.dueHistorical(s);
    if (due) { UI.showEvent(due, "hist"); return; }
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

  /* Les rivaux avancent leurs plans : par Claude si possible, sinon par le jeu */
  async rivalsTurn(){
    const s = GAME.s; let news = null;
    if (AI.usable()) { try { news = await AI.rivals(s); } catch (e) { news = null; } }
    if (GAME.s !== s || s.dead) return;
    if (!news) news = GAME.rivalsScripted(s);
    if (news && news.length) { AUDIO.sfx("notify"); UI.toast(news[0].title); UI.save(); UI.update(true); }
  },

  die(death){
    const s = GAME.s; const ch = GAME.ch(s);
    LOOP.stop(); AI.reset(); AUDIO.stopTheme(); AUDIO.sfx("death");
    s.dead = { date: s.date, age: GAME.age(s), cause: death.cause, type: death.type };
    GAME.news(s, { src: "Carnet", title: "Mort", text: death.cause, tone: "bad" }); UI.save();
    const ov = UI.openModal(`<div class="outcome"><div class="label">${esc(frDate(s.date))} · ${esc(s.place)}</div>
      <h2 style="font-size:2rem">${esc(ch.name)} est mort</h2><p class="ev-text">${esc(death.cause)}</p>
      <p class="muted">${s.dead.age} ans. ${esc(GAME.rankLabel(s))}. La partie est terminée.</p>
      <div class="row"><button class="btn primary" id="to-end">Toi contre l’Histoire</button></div></div>`, { scene: s.scene });
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
      const you = h ? `<span class="tag ${h.hist ? "same" : "diff"}">${h.hist ? "Comme dans l’Histoire" : "Tu as changé l’Histoire"}</span><div><b>${esc(h.choice)}</b></div><div class="muted">${esc(h.outcome)} · ${esc(frMonth(h.date))}</div>`
        : `<span class="tag none">N’a pas eu lieu ainsi</span><div class="muted">Dans ta partie, le cours des choses avait déjà bifurqué${s.done[e.id] === "panel" ? " : tu l’as décidé toi-même depuis tes panneaux" : ""}.</div>`;
      rows.push(`<div class="frise-row"><div class="when">${esc(frMonth(e.date))}</div><div class="you"><h3>${esc(e.title)}</h3>${you}</div>
        <div class="real">${isReal ? `<div class="label" style="margin-bottom:4px">Ce qui s’est vraiment passé</div>${histChoice ? `<div><b>${esc(histChoice.t)}</b></div>` : ""}<div>${esc(e.real)}</div>${e.anecdote ? `<div class="anec">${esc(e.anecdote)}</div>` : ""}` : `<div class="muted">${esc(e.real || "Cet épisode n’existe que dans ta version de l’Histoire.")}</div>`}</div></div>`);
    }
    const rd = ch.realDeath;
    rows.push(`<div class="frise-row"><div class="when">Fin</div><div class="you"><h3>Ta mort</h3><div><b>${s.dead ? esc(frDate(s.dead.date)) : "—"}</b>, à ${s.dead ? s.dead.age : GAME.age(s)} ans</div><div class="muted">${esc(s.dead ? s.dead.cause : "")} ${esc(s.place)}.</div></div>
      <div class="real"><div class="label" style="margin-bottom:4px">Sa mort réelle</div><div><b>${esc(frDate(rd.date))}</b>, à ${rd.age} ans, ${esc(rd.place)}.</div><div class="anec">${esc(rd.cause)}</div></div></div>`);
    const top = [...s.journal].sort((a, b) => (b.importance || 1) - (a.importance || 1) || b.d.localeCompare(a.d)).slice(0, 8).sort((a, b) => a.d.localeCompare(b.d));
    app().innerHTML = `<div class="wrap"><div class="label" style="margin-top:10px">Toi contre l’Histoire</div>
      <section class="end-hero"><div class="portrait">${ch.portrait(s)}</div>
        <div style="display:grid;gap:10px;min-width:0"><div class="muted ui">${esc(ch.name)} · ${esc(frDate(ch.born))} – ${esc(frDate(deathDate))}</div>
          <div class="legend-title">${esc(legend.title)}</div><p class="epitaph">${esc(legend.text)}</p>
          <div class="title-actions" style="margin-top:4px"><button class="btn primary" id="again">Nouvelle partie</button><button class="btn" id="exp">Exporter la partie</button><button class="btn ghost" id="home">Menu principal</button></div></div></section>
      <div class="vs">
        <div><small>Âge à la mort</small><b>${s.dead ? s.dead.age : GAME.age(s)} ans</b><small>Réalité : ${rd.age} ans</small></div>
        <div><small>Batailles</small><b>${s.counters.battlesWon} V · ${s.counters.battlesLost} D</b><small>Sur toute la vie</small></div>
        <div><small>Territoire maximal</small><b>${Math.round(s.counters.maxDep || 0)} dép.</b><small>Réalité : 130 en 1811</small></div>
        <div><small>Années au pouvoir</small><b>${Math.round((s.counters.powerWeeks || 0) / 52)} ans</b><small>Réalité : 15 ans, plus les Cent-Jours</small></div>
        <div><small>Fidélité à l’Histoire</small><b>${fidelity} %</b><small>${same} choix sur ${histChoices.length} comme le vrai ${esc(ch.short)}</small></div>
        <div><small>Actions libres</small><b>${s.journal.length}</b><small>Écrites de ta main</small></div>
      </div>
      ${top.length ? `<h2 style="font-size:1.3rem;margin-top:8px">Tes actions les plus marquantes</h2><div style="display:grid;gap:12px;margin:10px 0 22px">${top.map(j => `<div class="news key"><span class="m">${esc(frDate(j.d))} · ${esc(j.typeLabel)}${j.target ? " à " + esc(j.target) : ""}</span><b>${esc(j.resume)}</b><span class="muted">« ${esc(j.text.length > 260 ? j.text.slice(0, 260) + "…" : j.text)} »</span>${j.suites && j.suites.length ? `<span class="note">Suites : ${j.suites.map(q => esc(q.t)).join(" ; ")}</span>` : ""}</div>`).join("")}</div>` : ""}
      <h2 style="font-size:1.3rem;margin-top:8px">La frise comparée</h2>
      <div class="frise"><div class="frise-h label"><span>Date</span><span>Toi</span><span>L’Histoire</span></div>${rows.join("")}</div></div>`;
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
  timer: null, ms: { 1: 6000, 2: 3000, 4: 1500 },
  setSpeed(n){
    const s = GAME.s; if (!s) return;
    if (s.dead) n = 0;
    if (n > 0 && UI.modalOpen) return;
    s.speed = n; if (n > 0) UI.resumeSpeed = n;
    LOOP.schedule();
    $$("[data-speed]").forEach(b => b.setAttribute("aria-pressed", +b.dataset.speed === s.speed));
  },
  stop(){ clearTimeout(LOOP.timer); LOOP.timer = null; const tb = $("#tickbar"); if (tb) { tb.style.transition = "none"; tb.style.width = "0"; } },
  schedule(){
    clearTimeout(LOOP.timer); LOOP.timer = null;
    const s = GAME.s; const tb = $("#tickbar");
    if (!s || s.speed <= 0 || UI.modalOpen || s.dead) { if (tb) { tb.style.transition = "none"; tb.style.width = "0"; } return; }
    const ms = LOOP.ms[s.speed] || 6000;
    if (tb) { tb.style.transition = "none"; tb.style.width = "0"; void tb.offsetWidth; tb.style.transition = `width ${ms}ms linear`; tb.style.width = "100%"; }
    LOOP.timer = setTimeout(LOOP.step, ms);
  },
  step(){
    const s = GAME.s; if (!s || s.dead || UI.modalOpen || s.speed <= 0) return;
    const ch = GAME.ch(s);
    const { death, fired } = GAME.tick(s);
    if (fired.length) { AUDIO.sfx("notify"); UI.toast(fired[0].d.title); }
    UI.update(); UI.save();
    if (death) { UI.die(death); return; }
    const due = GAME.dueHistorical(s);
    if (due) { UI.showEvent(due, "hist"); return; }
    const off = ch.enemyMove ? ch.enemyMove(s) : null;
    if (off) { UI.showEvent(off, "guerre"); return; }
    if (--s.nextRivalIn <= 0) { s.nextRivalIn = 10 + Math.floor(Math.random() * 5); UI.rivalsTurn(); }
    s.nextRandomIn--;
    if (s.nextRandomIn <= 3) AI.prefetch(s);
    if (s.nextRandomIn <= 0) { s.nextRandomIn = 13 + Math.floor(Math.random() * 5); if (s.speed > 0) UI.resumeSpeed = s.speed; UI.randomEvent(); return; }
    LOOP.schedule();
  }
};

document.addEventListener("visibilitychange", () => { const s = GAME.s; if (document.hidden && s && s.speed > 0 && !UI.modalOpen) { UI.resumeSpeed = s.speed; LOOP.setSpeed(0); UI.save(); } });
document.addEventListener("keydown", e => {
  const s = GAME.s; if (!s || s.dead || UI.modalOpen || !$("#date")) return;
  if (e.target.closest("input,textarea,select")) return;
  if (e.code === "Space") { e.preventDefault(); LOOP.setSpeed(s.speed > 0 ? 0 : (UI.resumeSpeed || 1)); }
  else if (e.key === "1") LOOP.setSpeed(1); else if (e.key === "2") LOOP.setSpeed(2); else if (e.key === "3") LOOP.setSpeed(4);
  else if (e.key === "a" || e.key === "A") { e.preventDefault(); UI.actionModal(); }
});

UI.title();
AI.init();
</script>
