<script>
"use strict";
/* =====================================================================
   INTERFACE
   ===================================================================== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const app = () => $("#app");
const overlay = () => $("#overlay-root");

const UI = {
  modalOpen: false, resumeSpeed: 1, currentEvent: null, currentKind: null, lastLogKey: "", lastScene: "", tab: "empire",

  toast(msg){ const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2400); },
  setTheme(theme){ document.body.className = theme || ""; },

  /* ---------------- Écran titre ---------------- */
  title(){
    LOOP.stop(); GAME.s = null; UI.setTheme(""); UI.closeModal();
    const latest = [1, 2, 3].map(n => ({ n, s: STORE.read(n) })).filter(x => STORE.valid(x.s)).sort((a, b) => (b.s.savedAt || "").localeCompare(a.s.savedAt || ""))[0];
    app().innerHTML = `<div class="wrap">
      <section class="title-hero">
        <div class="logo">LEGACY</div>
        <p class="tagline">Vivez la vie d’une personnalité réelle, de ses débuts à sa mort. Gérez son pouvoir, sa santé, ses alliances — et réécrivez l’Histoire, si vous l’osez.</p>
      </section>
      <div class="modes" role="group" aria-label="Mode de jeu">
        <button class="mode" aria-pressed="true">Mode carrière</button>
        <button class="mode" disabled title="Disponible à l’étape 3">Scénarios courts <span class="soon">bientôt</span></button>
      </div>
      <div class="roster">${ROSTER.map(r => {
        const ch = CHARACTERS[r.id];
        if (ch) return `<button class="card-char" data-char="${ch.id}" style="--art:${ch.art}"><div class="art">${ch.portrait(null)}</div><div class="body"><h3>${esc(ch.name)}</h3><div class="role">${esc(ch.role)}</div><div class="label">${ch.starts.length} points de départ · 1 ${ch.unit.label} par tour</div></div></button>`;
        return `<div class="card-char locked" style="--art:${r.art}" aria-disabled="true"><span class="badge">Étape 2</span><div class="art">${ART.placeholder(r.letter, r.c1, r.c2)}</div><div class="body"><h3>${esc(r.name)}</h3><div class="role">${esc(r.role)}</div><div class="label">En préparation</div></div></div>`;
      }).join("")}</div>
      <div class="title-actions">
        ${latest ? `<button class="btn primary" id="continue">Continuer · ${esc(CHARACTERS[latest.s.char].short)}, ${esc(frMonth(latest.s.date))}</button>` : ""}
        <button class="btn" id="open-saves">Sauvegardes et import</button>
        <button class="btn ghost" id="open-settings">Réglages</button>
      </div>
      <p class="disclaimer">Simulation historique. Les événements générés par l’IA sont des reconstitutions plausibles : aucune parole inventée n’y est présentée comme une citation réelle. Portraits et décors sont des illustrations stylisées.</p>
    </div>`;
    $$("[data-char]").forEach(b => b.onclick = () => UI.setup(b.dataset.char));
    if (latest) $("#continue").onclick = () => UI.loadGame(latest.s);
    $("#open-saves").onclick = () => UI.savesModal();
    $("#open-settings").onclick = () => UI.settingsModal();
  },

  /* ---------------- Choix du point de départ ---------------- */
  setup(charId){
    const ch = CHARACTERS[charId]; UI.setTheme(ch.theme);
    let pick = ch.starts[0].id;
    const free = [1, 2, 3].find(n => !STORE.valid(STORE.read(n))) || 1;
    app().innerHTML = `<div class="wrap">
      <button class="btn ghost small" id="back">← Retour</button>
      <div class="setup">
        <div class="portrait-lg">${ch.portrait(null)}
          <h2 style="margin-top:10px">${esc(ch.name)}</h2>
          <p class="muted ui">Né le ${frDate(ch.born)} à ${esc(ch.birthplace)}</p>
          <p class="muted" style="font-size:.95rem">${esc(ch.realTimeline)}</p>
        </div>
        <div style="display:grid;gap:14px;min-width:0">
          <div><div class="label">Mode carrière</div><h2 style="font-size:1.5rem">Choisissez l’année de départ</h2>
          <p class="muted">Vous jouerez jusqu’à la mort du personnage. Le temps avance d’un ${ch.unit.label} par tour et se met en pause à chaque événement.</p></div>
          <div class="starts" role="radiogroup" aria-label="Année de départ">${ch.starts.map(st => `
            <button class="start" role="radio" data-start="${st.id}" aria-pressed="${st.id === pick}" aria-checked="${st.id === pick}">
              <span class="yr">${st.year}</span><h3>${esc(st.title)}</h3><span class="muted">${esc(st.summary)}</span>
            </button>`).join("")}</div>
          <div class="slot-pick"><label class="label" for="slot-sel">Emplacement de sauvegarde</label>
            <select id="slot-sel">${[1, 2, 3].map(n => { const s = STORE.read(n); return `<option value="${n}" ${n === free ? "selected" : ""}>Emplacement ${n}${STORE.valid(s) ? ` (écrasera ${esc(CHARACTERS[s.char].short)}, ${esc(frMonth(s.date))})` : " (libre)"}</option>`; }).join("")}</select>
          </div>
          <div><button class="btn primary" id="begin">Commencer la partie</button></div>
        </div>
      </div></div>`;
    $("#back").onclick = () => UI.title();
    $$("[data-start]").forEach(b => b.onclick = () => { pick = b.dataset.start; $$("[data-start]").forEach(x => { x.setAttribute("aria-pressed", x === b); x.setAttribute("aria-checked", x === b); }); });
    $("#begin").onclick = () => { const s = GAME.newGame(charId, pick, +$("#slot-sel").value); UI.loadGame(s, true); };
  },

  /* ---------------- Partie ---------------- */
  loadGame(s, fresh = false){
    AI.reset(); GAME.s = s; s.speed = 0; UI.resumeSpeed = 1;
    UI.setTheme(GAME.ch(s).theme);
    if (s.dead) { UI.endScreen(); return; }
    UI.buildGame();
    if (fresh) { STORE.write(s.slot, s); AI.prefetch(s); }
    if (s.pending) { UI.restorePending(); return; }
    const due = GAME.dueHistorical(s);
    if (due) UI.showEvent(due, "hist"); else if (fresh) LOOP.setSpeed(1);
  },

  restorePending(){
    const s = GAME.s, p = s.pending, ch = GAME.ch(s);
    let ev = null;
    if (p.kind === "hist") ev = ch.events.find(e => e.id === p.id);
    else if (p.kind === "ecrit") ev = ch.randomEvents.find(e => e.id === p.id);
    else if (p.kind === "ai") ev = p.ai;
    s.pending = null;
    if (ev) UI.showEvent(ev, p.kind); else LOOP.setSpeed(0);
  },

  buildGame(){
    const s = GAME.s, ch = GAME.ch(s);
    const gauge = d => `<div class="gauge" data-stat="${d.id}"><div class="top"><span class="name">${esc(d.label)}</span><span class="val"><span class="v"></span><span class="trend"></span></span></div><div class="bar"><i></i><span class="ticks"></span></div><div class="hint">${esc(d.hint || "")}</div></div>`;
    app().innerHTML = `
      <header class="topbar"><div class="topbar-in">
        <div class="who"><h1><span class="full">${esc(ch.name)}</span><span class="short">${esc(ch.short)}</span></h1><span class="rank" id="rank"></span></div>
        <div class="clock"><span class="date" id="date"></span><span class="age" id="age"></span></div>
        <div class="speed" role="group" aria-label="Vitesse du temps">
          <button data-speed="0" title="Pause (espace)">❚❚</button><button data-speed="1" title="Vitesse normale">x1</button><button data-speed="2" title="Vitesse rapide">x2</button><button data-speed="4" title="Vitesse très rapide">x4</button>
        </div>
        <div class="menu-btns"><button class="btn small" id="b-save"><span class="full">Sauvegardes</span><span class="short">Sauver</span></button><button class="btn small ghost" id="b-set"><span class="full">Réglages</span><span class="short">Options</span></button><button class="btn small ghost" id="b-menu">Menu</button></div>
      </div><div class="tick-bar"><i id="tickbar"></i></div></header>
      <main class="game" data-tab="${UI.tab}">
        <section class="col col-left" aria-label="Vie privée">
          <div class="panel vie"><div class="portrait" id="portrait"></div>
            <h2 style="margin-top:12px">${esc(ch.groups.vie)}</h2>
            <div class="gauges">${ch.stats.filter(d => d.group === "vie").map(gauge).join("")}</div>
            <div id="conds" style="margin-top:8px"></div>
            <dl class="facts" id="facts"></dl>
          </div>
        </section>
        <section class="col col-mid" aria-label="Tableau de bord">
          <div class="scene" id="scene"><div class="cap"><span class="place" id="place"></span><span class="status" id="status"></span></div></div>
          <div class="panel"><h2>${esc(ch.groups.empire)}</h2><div class="gauges">${ch.stats.filter(d => d.group !== "vie").map(gauge).join("")}</div></div>
          <div class="panel"><h2>Décisions</h2><p class="muted ui" style="margin:-4px 0 10px;font-size:.88rem">Utilisables à tout moment, même en pause. Chaque décision demande un délai avant d’être reprise.</p><div class="actions" id="actions"></div></div>
        </section>
        <section class="col col-right" aria-label="Relations et journal">
          <div class="panel"><h2>Relations</h2><div class="rels" id="rels"></div></div>
          <div class="panel"><h2>Journal</h2><div class="ai-status" id="ai-status"></div><div class="log" id="log" style="margin-top:10px"></div></div>
        </section>
      </main>
      <nav class="tabs" aria-label="Sections">
        <button data-tab="empire">Empire</button><button data-tab="vie">Vie privée</button><button data-tab="monde">Relations</button>
      </nav>`;
    $$("[data-speed]").forEach(b => b.onclick = () => LOOP.setSpeed(+b.dataset.speed));
    $("#b-save").onclick = () => UI.savesModal();
    $("#b-set").onclick = () => UI.settingsModal();
    $("#b-menu").onclick = () => { if (GAME.s && !GAME.s.dead) STORE.write(GAME.s.slot, GAME.s); UI.title(); };
    $$("[data-tab]").forEach(b => b.onclick = () => { UI.tab = b.dataset.tab; $(".game").dataset.tab = UI.tab; UI.updateTabs(); window.scrollTo(0, 0); });
    $("#actions").innerHTML = ch.actions.map(a => `<button class="act" data-act="${a.id}"><b>${esc(a.label)}</b><span>${esc(a.desc)}</span><em></em></button>`).join("");
    $$("[data-act]").forEach(b => b.onclick = () => UI.doAction(b.dataset.act));
    $("#rels").addEventListener("click", e => { const b = e.target.closest(".rel"); if (!b) return; const d = b.querySelector(".rel-detail"); d.hidden = !d.hidden; b.setAttribute("aria-expanded", !d.hidden); });
    UI.lastScene = ""; UI.lastLogKey = ""; UI.lastRelKey = ""; UI.lastPortraitAge = -1;
    UI.updateTabs(); UI.update(); UI.updateAIStatus();
  },
  updateTabs(){ $$(".tabs [data-tab]").forEach(b => b.setAttribute("aria-pressed", b.dataset.tab === UI.tab)); },

  level(d, v){
    if (d.warn !== undefined && d.bad === "low") return v <= d.danger ? "bad" : v < d.warn ? "warn" : "good";
    if (d.bad === "high") return v >= 70 ? "bad" : v >= 45 ? "warn" : "good";
    return v < 25 ? "bad" : v < 45 ? "warn" : "good";
  },

  update(){
    const s = GAME.s; if (!s || !$("#date")) return;
    const ch = GAME.ch(s);
    $("#date").textContent = frDate(s.date);
    $("#age").textContent = `${GAME.age(s)} ans`;
    $("#rank").textContent = GAME.rankLabel(s);
    $$("[data-speed]").forEach(b => b.setAttribute("aria-pressed", +b.dataset.speed === s.speed));
    const age = GAME.age(s);
    if (Math.abs(age - UI.lastPortraitAge) >= 2) { $("#portrait").innerHTML = ch.portrait(s); UI.lastPortraitAge = age; }
    if (UI.lastScene !== s.scene) { $("#scene").insertAdjacentHTML("afterbegin", ART.scene(s.scene)); const svgs = $$("#scene > svg"); svgs.slice(1).forEach(x => x.remove()); UI.lastScene = s.scene; }
    $("#place").textContent = s.place;
    $("#status").textContent = GAME.power(s) === 0 ? "Exil" : s.flags.atWar ? "En guerre" : "En paix";
    for (const d of ch.stats) {
      const el = $(`[data-stat="${d.id}"]`); if (!el) continue;
      const v = s.stats[d.id], pv = s.prev[d.id] ?? v;
      el.querySelector(".v").textContent = d.fmt ? d.fmt(v) : Math.round(v);
      const diff = v - pv; const tr = el.querySelector(".trend");
      const good = d.bad === "high" ? diff < 0 : diff > 0;
      if (Math.abs(diff) >= (d.fmt ? 1 : .5)) { tr.textContent = diff > 0 ? " ▲" : " ▼"; tr.className = "trend " + (good ? "up" : "down"); } else { tr.textContent = ""; tr.className = "trend"; }
      const lo = d.barMin ?? Math.max(0, d.min), hi = d.barMax ?? d.max;
      const bar = el.querySelector(".bar i"); bar.style.width = (clamp((v - lo) / (hi - lo), 0, 1) * 100).toFixed(1) + "%"; bar.className = "lvl-" + UI.level(d, v);
    }
    $("#conds").innerHTML = s.conditions.map(c => `<span class="cond-chip">${esc(c.name)}</span>`).join("");
    const fam = s.family;
    const spouse = fam.spouse ? GAME.relDef(s, fam.spouse).name : fam.spouseName || "—";
    $("#facts").innerHTML = [
      ["Né le", frDate(ch.born)],
      ["Conjoint", spouse],
      fam.exSpouses.length ? ["Ex-conjoint", fam.exSpouses.map(id => GAME.relDef(s, id)?.name || id).join(", ")] : null,
      ["Enfants", fam.children.length ? fam.children.map(c => `${c.name} (${parseD(c.born).y})`).join(" ; ") : "Aucun enfant légitime"],
      ["Héritier", fam.heir || (fam.children[0] ? fam.children[0].name.split(",")[0] : "Aucun")],
      ["Batailles", `${s.counters.battlesWon} victoires · ${s.counters.battlesLost} défaites`]
    ].filter(Boolean).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd style="margin:0;text-align:right">${esc(v)}</dd></div>`).join("");
    for (const a of ch.actions) {
      const b = $(`[data-act="${a.id}"]`); if (!b) continue;
      let ok = true; try { ok = a.cond(s); } catch (e) { ok = false; }
      b.hidden = !ok;
      const cd = s.cooldowns[a.id] || 0;
      b.disabled = cd > 0 || !!s.dead || UI.modalOpen;
      b.querySelector("em").textContent = cd > 0 ? `Disponible dans ${cd} ${ch.unit.label}` : "";
    }
    UI.updateRels(); UI.updateLog();
  },

  updateRels(){
    const s = GAME.s, ch = GAME.ch(s);
    const known = ch.relations.filter(r => GAME.relKnown(s, r.id));
    const key = known.map(r => r.id + (s.deadRel[r.id] ? "x" : "")).join(",");
    if (key !== UI.lastRelKey) {
      const alive = known.filter(r => !s.deadRel[r.id]), dead = known.filter(r => s.deadRel[r.id]);
      $("#rels").innerHTML = [...alive, ...dead].map(r => `<button class="rel ${s.deadRel[r.id] ? "dead" : ""}" data-rel="${r.id}" aria-expanded="false">
        <span class="n">${esc(r.name)}${s.deadRel[r.id] ? " †" : ""}</span><span class="chip"></span>
        <span class="ro">${esc(r.role)}</span><span class="bar2"><i></i></span>
        <span class="rel-detail" hidden>${esc(r.bio)}${s.deadRel[r.id] ? ` Décès : ${esc(frMonth(s.deadRel[r.id]))}.` : ""}</span></button>`).join("");
      UI.lastRelKey = key;
    }
    for (const r of known) {
      const el = $(`[data-rel="${r.id}"]`); if (!el) continue;
      const v = s.rel[r.id]; const st = s.deadRel[r.id] ? "mort" : GAME.relStatus(v);
      const chip = el.querySelector(".chip"); chip.className = "chip " + st; chip.textContent = GAME.relStatusLabel[st];
      const bar = el.querySelector(".bar2 i"); const w = Math.abs(v) / 2;
      bar.style.left = (v >= 0 ? 50 : 50 - w) + "%"; bar.style.width = w + "%";
      bar.style.background = v >= 40 ? "var(--good)" : v >= -15 ? "var(--muted)" : v >= -50 ? "var(--warn)" : "var(--bad)";
    }
  },

  updateLog(){
    const s = GAME.s; const key = s.log.length + "|" + (s.log[0] && s.log[0].t) + "|" + (s.log[0] && s.log[0].d);
    if (key === UI.lastLogKey) return; UI.lastLogKey = key;
    $("#log").innerHTML = s.log.slice(0, 40).map(l => `<div class="log-item ${l.tone}"><span class="d">${esc(frMonth(l.d))}</span><span>${esc(l.t)}</span></div>`).join("");
  },

  updateAIStatus(){
    const el = $("#ai-status"); if (!el) return;
    const cls = !AI.enabled ? "off" : AI.status === "busy" ? "busy" : (AI.status === "off" || !AI.available) ? "off" : "ok";
    el.innerHTML = `<span class="dot ${cls}"></span><span>${esc(!AI.enabled ? "Événements IA désactivés : dépêches écrites" : AI.note)}</span>`;
  },

  doAction(id){
    const s = GAME.s, ch = GAME.ch(s); const a = ch.actions.find(x => x.id === id);
    if (!a || s.cooldowns[id] || s.dead || UI.modalOpen) return;
    const out = GAME.applyFx(s, a.fx);
    s.cooldowns[id] = a.cd;
    GAME.log(s, `${a.label}. ${UI.deltaText(out)}`, "");
    UI.update();
  },

  deltaText(out){
    const s = GAME.s; const parts = [];
    for (const [k, v] of Object.entries(out.deltas)) { const d = GAME.statDef(s, k); if (Math.abs(v) < .5) continue; parts.push(`${d.label} ${v > 0 ? "+" : ""}${Math.round(v)}`); }
    for (const [k, v] of Object.entries(out.rels)) { if (!v) continue; parts.push(`${GAME.relDef(s, k).name.split(" (")[0]} ${v > 0 ? "+" : ""}${Math.round(v)}`); }
    return parts.join(", ");
  },

  deltaChips(out){
    const s = GAME.s; const chips = [];
    for (const [k, v] of Object.entries(out.deltas)) { const d = GAME.statDef(s, k); if (Math.abs(v) < .5) continue; const good = d.bad === "high" ? v < 0 : v > 0; chips.push(`<span class="${good ? "p" : "m"}">${esc(d.label)} ${v > 0 ? "+" : ""}${Math.round(v)}</span>`); }
    for (const [k, v] of Object.entries(out.rels)) { if (!v) continue; chips.push(`<span class="${v > 0 ? "p" : "m"}">${esc(GAME.relDef(s, k).name)} ${v > 0 ? "+" : ""}${Math.round(v)}</span>`); }
    return chips.join("");
  },

  /* ---------------- Fenêtres ---------------- */
  openModal(html, { scene = null, onClose = null, dismissable = false } = {}){
    UI.modalOpen = true;
    overlay().innerHTML = `<div class="overlay" role="dialog" aria-modal="true"><div class="modal">${scene ? `<div class="scene">${ART.scene(scene)}</div>` : ""}<div class="modal-body">${html}</div></div></div>`;
    const ov = $(".overlay");
    if (dismissable) ov.addEventListener("click", e => { if (e.target === ov) { UI.closeModal(); onClose && onClose(); } });
    const first = ov.querySelector("button"); first && first.focus({ preventScroll: true });
    UI.update();
    return ov;
  },
  closeModal(){ overlay().innerHTML = ""; UI.modalOpen = false; if (GAME.s && $("#date")) UI.update(); },

  showEvent(ev, kind){
    const s = GAME.s; const ch = GAME.ch(s);
    if (s.speed > 0) UI.resumeSpeed = s.speed;
    LOOP.setSpeed(0, true);
    UI.currentEvent = ev; UI.currentKind = kind;
    s.pending = { kind, id: ev.id, ai: kind === "ai" ? ev : null };
    const people = (ev.people || []).map(p => { const r = GAME.relDef(s, p); return r ? r.name : p; }).filter(Boolean);
    const kindLabel = kind === "hist" ? "Moment historique" : kind === "ai" ? "Dépêche · écrite par Claude" : "Dépêche";
    const ov = UI.openModal(`
      <div class="ev-kind"><span class="k ${kind === "hist" ? "hist" : ""}">${kindLabel}</span><span class="label">${esc(frDate(kind === "hist" && ev.date && ev.date.slice(0, 7) === s.date.slice(0, 7) ? ev.date : s.date))} · ${esc(ev.place || s.place)}</span></div>
      <h2>${esc(ev.title)}</h2>
      <p class="ev-text">${esc(ev.text)}</p>
      ${people.length ? `<div class="people">${people.map(p => `<span>${esc(p)}</span>`).join("")}</div>` : ""}
      <div class="choices">${ev.choices.map((c, i) => `<button class="choice" data-choice="${i}">${esc(c.t)}${c.battle ? `<small>Bataille : ${esc(c.battle.name)}</small>` : ""}</button>`).join("")}</div>
    `, { scene: ev.scene || s.scene });
    $$("[data-choice]", ov).forEach(b => b.onclick = () => UI.choose(+b.dataset.choice));
  },

  choose(i){
    const s = GAME.s, ev = UI.currentEvent, kind = UI.currentKind; if (!ev) return;
    const c = ev.choices[i];
    const out = { deltas: {}, rels: {}, notes: [], death: null };
    if (ev.pre) GAME.applyFx(s, ev.pre, out);
    GAME.applyFx(s, c.fx, out);
    if (c.battle) GAME.battle(s, c.battle, out);
    if (kind === "hist" || (kind === "ecrit" && ev.once)) s.done[ev.id] = kind;
    if (kind === "ecrit") { s.recentRandom.push(ev.id); if (s.recentRandom.length > 6) s.recentRandom.shift(); }
    const outcome = out.battle ? `${out.battle.win ? "Victoire" : "Défaite"} — ${out.battle.name}` : (c.res || "");
    s.history.push({ date: s.date, id: ev.id, kind, title: ev.title, choice: c.t, hist: kind === "hist" ? !!c.hist : null, histExists: kind === "hist" ? ev.choices.some(x => x.hist) : false, outcome });
    if (s.history.length > 400) s.history.splice(0, s.history.length - 400);
    GAME.log(s, `${ev.title} : ${c.t}.${out.battle ? ` ${out.battle.win ? "Victoire" : "Défaite"} (${out.battle.name}).` : ""}`, kind === "hist" ? "key" : out.battle ? (out.battle.win ? "good" : "bad") : "");
    s.pending = null; UI.currentEvent = null;
    if (out.death) s.deathPending = out.death;
    STORE.write(s.slot, s);
    const real = kind === "hist" && ev.real ? `<div class="realbox"><b>Dans l’Histoire :</b> ${esc(ev.real)}${ev.anecdote ? `<br><i>${esc(ev.anecdote)}</i>` : ""}</div>` : "";
    const verdict = out.battle ? `<div class="verdict ${out.battle.win ? "win" : "loss"}">${out.battle.win ? "Victoire" : "Défaite"} · ${esc(out.battle.name)}</div>` : "";
    const ov = UI.openModal(`<div class="outcome">
      <div class="ev-kind"><span class="k ${kind === "hist" ? "hist" : ""}">${kind === "hist" ? (c.hist ? "Comme dans l’Histoire" : "L’Histoire bifurque") : "Conséquences"}</span></div>
      <h2>${esc(ev.title)}</h2>
      ${verdict}
      <p class="ev-text">${esc(c.res || "")}${out.notes.length ? " " + out.notes.map(esc).join(" ") : ""}</p>
      <div class="deltas">${UI.deltaChips(out)}</div>
      ${real}
      <div class="row"><button class="btn primary" id="cont">${out.death ? "Continuer…" : "Reprendre le cours du temps"}</button></div>
    </div>`, { scene: s.scene });
    $("#cont", ov).onclick = () => UI.afterEvent();
  },

  afterEvent(){
    const s = GAME.s; UI.closeModal();
    if (s.deathPending) { const d = s.deathPending; delete s.deathPending; UI.die(d); return; }
    const due = GAME.dueHistorical(s);
    if (due) { UI.showEvent(due, "hist"); return; }
    AI.prefetch(s);
    LOOP.setSpeed(UI.resumeSpeed || 1);
  },

  async randomEvent(){
    const s = GAME.s;
    s.nextRandomIn = 3 + Math.floor(Math.random() * 3);
    if (AI.usable()) {
      let ev = AI.take(s);
      if (!ev) {
        if (!AI.pending) AI.prefetch(s);
        if (AI.pending) ev = await UI.waitForAI();
        if (ev) ev = AI.take(s);
      }
      if (ev && GAME.s === s && !s.dead) { UI.showEvent(ev, "ai"); return; }
    }
    if (GAME.s !== s || s.dead) return;
    const fb = GAME.pickFallback(s);
    if (fb) UI.showEvent(fb, "ecrit"); else { UI.closeModal(); LOOP.setSpeed(UI.resumeSpeed || 1); }
  },

  waitForAI(){
    const s = GAME.s;
    if (s.speed > 0) UI.resumeSpeed = s.speed;
    LOOP.setSpeed(0, true);
    return new Promise(resolve => {
      let done = false;
      const finish = v => { if (done) return; done = true; resolve(v); };
      const ov = UI.openModal(`<div class="loading"><div class="quill" aria-hidden="true"></div><div class="label">${esc(frDate(s.date))}</div><h2>Un courrier arrive…</h2>
        <p class="muted">Claude rédige la dépêche à partir de votre situation, de vos relations et de vos décisions passées. Cela prend en général quelques secondes.</p>
        <div class="row" style="justify-content:flex-start"><button class="btn" id="skip-ai">Ne pas attendre : dépêche écrite</button></div></div>`, { scene: s.scene });
      $("#skip-ai", ov).onclick = () => finish(null);
      AI.pending.then(ev => finish(ev ? true : null), () => finish(null));
    }).then(ok => ok ? AI.ready : null);
  },

  die(death){
    const s = GAME.s; const ch = GAME.ch(s);
    LOOP.stop(); AI.reset();
    s.dead = { date: s.date, age: GAME.age(s), cause: death.cause, type: death.type };
    GAME.log(s, death.cause, "bad");
    STORE.write(s.slot, s);
    const ov = UI.openModal(`<div class="outcome">
      <div class="label">${esc(frDate(s.date))} · ${esc(s.place)}</div>
      <h2 style="font-size:2rem">${esc(ch.name)} est mort</h2>
      <p class="ev-text">${esc(death.cause)}</p>
      <p class="muted">${s.dead.age} ans. ${esc(GAME.rankLabel(s))}.</p>
      <div class="row"><button class="btn primary" id="to-end">Toi contre l’Histoire</button></div></div>`, { scene: s.scene });
    $("#to-end", ov).onclick = () => { UI.closeModal(); UI.endScreen(); };
  },

  /* ---------------- Fin de partie : « Toi contre l’Histoire » ---------------- */
  endScreen(){
    const s = GAME.s, ch = GAME.ch(s); LOOP.stop(); UI.setTheme(ch.theme);
    const months = Math.max(1, s.counters.months);
    const c = { ...s.counters, avgPop: (s.counters.popSum || 0) / months };
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
      const you = h ? `<span class="tag ${h.hist ? "same" : isReal ? "diff" : "diff"}">${h.hist ? "Comme dans l’Histoire" : "Tu as changé l’Histoire"}</span><div><b>${esc(h.choice)}</b></div><div class="muted">${esc(h.outcome)} · ${esc(frMonth(h.date))}</div>`
        : `<span class="tag none">N’a pas eu lieu</span><div class="muted">Dans ta partie, le cours des choses avait déjà bifurqué.</div>`;
      rows.push(`<div class="frise-row"><div class="when">${esc(frMonth(e.date))}</div>
        <div class="you"><h3>${esc(e.title)}</h3>${you}</div>
        <div class="real">${isReal ? `<div class="label" style="margin-bottom:4px">Ce qui s’est vraiment passé</div>${histChoice ? `<div><b>${esc(histChoice.t)}</b></div>` : ""}<div>${esc(e.real)}</div>${e.anecdote ? `<div class="anec">${esc(e.anecdote)}</div>` : ""}` : `<div class="muted">${esc(e.real || "Cet épisode n’existe que dans ta version de l’Histoire.")}</div>`}</div></div>`);
    }
    const rd = ch.realDeath;
    rows.push(`<div class="frise-row"><div class="when">Fin</div>
      <div class="you"><h3>Ta mort</h3><div><b>${s.dead ? esc(frDate(s.dead.date)) : "—"}</b>, à ${s.dead ? s.dead.age : GAME.age(s)} ans</div><div class="muted">${esc(s.dead ? s.dead.cause : "")} ${esc(s.place)}.</div></div>
      <div class="real"><div class="label" style="margin-bottom:4px">Sa mort réelle</div><div><b>${esc(frDate(rd.date))}</b>, à ${rd.age} ans, ${esc(rd.place)}.</div><div class="anec">${esc(rd.cause)}</div></div></div>`);
    const others = s.history.filter(h => h.kind !== "hist").slice(-14).reverse();
    const powerYears = Math.round((s.counters.powerMonths || 0) / 12);
    app().innerHTML = `<div class="wrap">
      <div class="label" style="margin-top:10px">Toi contre l’Histoire</div>
      <section class="end-hero"><div class="portrait">${ch.portrait(s)}</div>
        <div style="display:grid;gap:10px;min-width:0"><div class="muted ui">${esc(ch.name)} · ${esc(frDate(ch.born))} – ${esc(s.dead ? frDate(s.dead.date) : frDate(s.date))}</div>
          <div class="legend-title">${esc(legend.title)}</div><p class="epitaph">${esc(legend.text)}</p>
          <div class="title-actions" style="margin-top:4px"><button class="btn primary" id="again">Nouvelle partie</button><button class="btn" id="exp">Exporter la partie</button><button class="btn ghost" id="home">Menu principal</button></div>
        </div></section>
      <div class="vs">
        <div><small>Âge à la mort</small><b>${s.dead ? s.dead.age : GAME.age(s)} ans</b><small>Réalité : ${rd.age} ans</small></div>
        <div><small>Batailles</small><b>${s.counters.battlesWon} V · ${s.counters.battlesLost} D</b><small>Sur toute la vie</small></div>
        <div><small>Territoire maximal</small><b>${Math.round(s.counters.maxDep || 0)} dép.</b><small>Réalité : 130 en 1811</small></div>
        <div><small>Années au pouvoir</small><b>${powerYears} ans</b><small>Réalité : 15 ans (1799-1814), plus les Cent-Jours</small></div>
        <div><small>Fidélité à l’Histoire</small><b>${fidelity} %</b><small>${same} choix sur ${histChoices.length} comme le vrai ${esc(ch.short)}</small></div>
      </div>
      <h2 style="font-size:1.3rem;margin-top:8px">La frise comparée</h2>
      <div class="frise"><div class="frise-h label"><span>Date</span><span>Toi</span><span>L’Histoire</span></div>${rows.join("")}</div>
      ${others.length ? `<h2 style="font-size:1.1rem;margin-top:24px">Tes autres décisions</h2><div class="log" style="max-height:none;margin-top:10px">${others.map(h => `<div class="log-item"><span class="d">${esc(frMonth(h.date))}${h.kind === "ai" ? " · dépêche IA" : ""}</span><span><b>${esc(h.title)}</b> — ${esc(h.choice)}</span></div>`).join("")}</div>` : ""}
    </div>`;
    $("#again").onclick = () => UI.setup(s.char);
    $("#home").onclick = () => UI.title();
    $("#exp").onclick = () => UI.exportGame(s);
    window.scrollTo(0, 0);
  },

  /* ---------------- Sauvegardes, export, import ---------------- */
  savesModal(){
    const s = GAME.s;
    const wasSpeed = s && s.speed; if (s && s.speed > 0) { UI.resumeSpeed = s.speed; LOOP.setSpeed(0, true); }
    const render = () => {
      const slots = [1, 2, 3].map(n => ({ n, d: STORE.read(n) }));
      const ov = UI.openModal(`<h2>Sauvegardes</h2>
        <p class="muted ui" style="margin:0">La partie est sauvegardée automatiquement après chaque événement et tous les six mois de jeu${s ? `, dans l’emplacement ${s.slot}` : ""}.</p>
        <div class="slots">${slots.map(({ n, d }) => { const ok = STORE.valid(d); return `<div class="slot"><div class="meta"><b>Emplacement ${n}${s && s.slot === n ? " · partie en cours" : ""}</b>
          <div>${ok ? `${esc(CHARACTERS[d.char].short)} · ${esc(frDate(d.date))} · ${yearsBetween(CHARACTERS[d.char].born, d.date)} ans${d.dead ? " · partie terminée" : ""}` : "Vide"}</div></div>
          <div class="ops">${ok ? `<button class="btn small" data-load="${n}">Charger</button>` : ""}${s && !s.dead ? `<button class="btn small" data-save="${n}">Sauver ici</button>` : ""}${ok ? `<button class="btn small ghost" data-del="${n}">Effacer</button>` : ""}</div></div>`; }).join("")}</div>
        <div class="setting"><span>Exporter la partie en cours en fichier JSON</span><button class="btn small" id="exp" ${s ? "" : "disabled"}>Exporter</button></div>
        <div class="setting" style="display:grid;gap:8px;justify-content:stretch"><span>Importer une sauvegarde (fichier .json ou texte collé)</span>
          <input type="file" id="imp-file" accept=".json,application/json">
          <textarea class="json" id="imp-text" placeholder="…ou collez ici le contenu JSON d’une sauvegarde" aria-label="Contenu JSON de la sauvegarde"></textarea>
          <div class="row"><button class="btn small" id="imp-go">Importer et jouer</button></div></div>
        <div class="row"><button class="btn primary" id="close">Fermer</button></div>`, { dismissable: true, onClose: () => { if (GAME.s && !GAME.s.dead && wasSpeed) LOOP.setSpeed(UI.resumeSpeed); } });
      $$("[data-load]", ov).forEach(b => b.onclick = () => { const d = STORE.read(+b.dataset.load); if (STORE.valid(d)) { d.slot = +b.dataset.load; UI.closeModal(); UI.loadGame(d); } });
      $$("[data-save]", ov).forEach(b => b.onclick = () => { s.slot = +b.dataset.save; UI.toast(STORE.write(s.slot, s) ? `Partie sauvegardée dans l’emplacement ${s.slot}` : "Sauvegarde impossible : stockage du navigateur indisponible. Utilisez l’export."); render(); });
      $$("[data-del]", ov).forEach(b => b.onclick = () => { if (b.dataset.confirm) { STORE.remove(+b.dataset.del); render(); } else { b.dataset.confirm = "1"; b.textContent = "Confirmer ?"; } });
      $("#exp", ov).onclick = () => s && UI.exportGame(s);
      $("#imp-file", ov).onchange = e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { $("#imp-text", ov).value = String(rd.result); }; rd.readAsText(f); };
      $("#imp-go", ov).onclick = () => { let d = null; try { d = JSON.parse($("#imp-text", ov).value); } catch (e) {} if (d && d.state) d = d.state; if (!STORE.valid(d)) { UI.toast("Ce fichier n’est pas une sauvegarde Legacy valide."); return; } d.slot = [1, 2, 3].includes(d.slot) ? d.slot : 1; STORE.write(d.slot, d); UI.closeModal(); UI.loadGame(d); UI.toast(`Sauvegarde importée dans l’emplacement ${d.slot}`); };
      $("#close", ov).onclick = () => { UI.closeModal(); if (GAME.s && !GAME.s.dead && wasSpeed) LOOP.setSpeed(UI.resumeSpeed); };
    };
    render();
  },

  async exportGame(s){
    const json = JSON.stringify({ game: "Legacy", exportedAt: new Date().toISOString(), state: s }, null, 1);
    const name = `legacy-${s.char}-${s.date}.json`;
    if (AI.downloads) { try { await AI.downloads.save({ filename: name, data: json }); UI.toast("Fichier de sauvegarde proposé au téléchargement"); return; } catch (e) { if (e && e.code === "declined") return; } }
    const ov = UI.openModal(`<h2>Exporter la partie</h2><p class="muted">Copiez ce texte et conservez-le dans un fichier « ${esc(name)} ». Vous pourrez le recoller dans « Importer ».</p>
      <textarea class="json" id="exp-text" readonly aria-label="Sauvegarde au format JSON">${esc(json)}</textarea>
      <div class="row"><button class="btn" id="copy">Copier</button><button class="btn primary" id="close">Fermer</button></div>`, { dismissable: true });
    $("#copy", ov).onclick = () => { const ta = $("#exp-text", ov); navigator.clipboard?.writeText(json).then(() => UI.toast("Copié dans le presse-papiers"), () => { ta.select(); UI.toast("Sélectionné : copiez avec Ctrl+C"); }) || (ta.select()); };
    $("#close", ov).onclick = () => { UI.closeModal(); if (GAME.s && GAME.s.dead && !$("#date")) UI.endScreen(); };
  },

  settingsModal(){
    const s = GAME.s; const wasSpeed = s && s.speed; if (s && s.speed > 0) { UI.resumeSpeed = s.speed; LOOP.setSpeed(0, true); }
    const ov = UI.openModal(`<h2>Réglages</h2>
      <div class="setting"><label for="set-ai">Événements générés par Claude</label><select id="set-ai"><option value="1" ${AI.enabled ? "selected" : ""}>Activés</option><option value="0" ${!AI.enabled ? "selected" : ""}>Désactivés (dépêches écrites)</option></select></div>
      <div class="setting"><label for="set-tier">Rédaction de l’IA</label><select id="set-tier"><option value="quick" ${AI.tier === "quick" ? "selected" : ""}>Rapide</option><option value="default" ${AI.tier === "default" ? "selected" : ""}>Soignée</option><option value="complex" ${AI.tier === "complex" ? "selected" : ""}>Approfondie (plus lente)</option></select></div>
      <p class="muted ui" style="font-size:.88rem;margin:0">${esc(AI.available ? "Claude est disponible dans cette vue. Chaque dépêche utilise votre compte Claude." : "Claude n’est pas disponible dans cette vue : le jeu utilise ses événements écrits à l’avance.")} Raccourcis : espace = pause, 1/2/3 = vitesses.</p>
      <div class="row"><button class="btn primary" id="close">Fermer</button></div>`, { dismissable: true, onClose: () => { if (GAME.s && !GAME.s.dead && wasSpeed) LOOP.setSpeed(UI.resumeSpeed); } });
    $("#set-ai", ov).onchange = e => { AI.enabled = e.target.value === "1"; AI.failures = 0; STORE.setSetting("ai", AI.enabled); if (!AI.enabled) AI.reset(); UI.updateAIStatus(); };
    $("#set-tier", ov).onchange = e => { AI.tier = e.target.value; STORE.setSetting("tier", AI.tier); };
    $("#close", ov).onclick = () => { UI.closeModal(); if (GAME.s && !GAME.s.dead && wasSpeed) LOOP.setSpeed(UI.resumeSpeed); };
  }
};

/* =====================================================================
   BOUCLE DE TEMPS — pause, x1, x2, x4
   ===================================================================== */
const LOOP = {
  timer: null, ms: { 1: 2200, 2: 1100, 4: 520 },
  setSpeed(n, silent = false){
    const s = GAME.s; if (!s) return;
    if (s.dead) n = 0;
    if (n > 0 && UI.modalOpen) return;
    s.speed = n; if (n > 0) UI.resumeSpeed = n;
    LOOP.schedule(); UI.update();
  },
  stop(){ clearTimeout(LOOP.timer); LOOP.timer = null; const tb = $("#tickbar"); if (tb) { tb.style.transition = "none"; tb.style.width = "0"; } },
  schedule(){
    clearTimeout(LOOP.timer); LOOP.timer = null;
    const s = GAME.s; const tb = $("#tickbar");
    if (!s || s.speed <= 0 || UI.modalOpen || s.dead) { if (tb) { tb.style.transition = "none"; tb.style.width = "0"; } return; }
    const ms = LOOP.ms[s.speed] || 2200;
    if (tb) { tb.style.transition = "none"; tb.style.width = "0"; void tb.offsetWidth; tb.style.transition = `width ${ms}ms linear`; tb.style.width = "100%"; }
    LOOP.timer = setTimeout(LOOP.step, ms);
  },
  step(){
    const s = GAME.s; if (!s || s.dead || UI.modalOpen || s.speed <= 0) return;
    const death = GAME.tick(s);
    if (GAME.power(s) >= 2) s.counters.powerMonths = (s.counters.powerMonths || 0) + 1;
    UI.update();
    if (death) { UI.die(death); return; }
    if (s.counters.months % 6 === 0) STORE.write(s.slot, s);
    const due = GAME.dueHistorical(s);
    if (due) { UI.showEvent(due, "hist"); return; }
    s.nextRandomIn--;
    if (s.nextRandomIn <= 2) AI.prefetch(s);
    if (s.nextRandomIn <= 0) { if (s.speed > 0) UI.resumeSpeed = s.speed; UI.randomEvent(); return; }
    LOOP.schedule();
  }
};

/* Pause automatique quand l’onglet est masqué ; raccourcis clavier */
document.addEventListener("visibilitychange", () => { const s = GAME.s; if (document.hidden && s && s.speed > 0 && !UI.modalOpen) { UI.resumeSpeed = s.speed; LOOP.setSpeed(0); STORE.write(s.slot, s); } });
document.addEventListener("keydown", e => {
  const s = GAME.s; if (!s || s.dead || UI.modalOpen || !$("#date")) return;
  if (e.target.closest("input,textarea,select")) return;
  if (e.code === "Space") { e.preventDefault(); LOOP.setSpeed(s.speed > 0 ? 0 : (UI.resumeSpeed || 1)); }
  else if (e.key === "1") LOOP.setSpeed(1); else if (e.key === "2") LOOP.setSpeed(2); else if (e.key === "3") LOOP.setSpeed(4);
});

/* Démarrage */
UI.title();
AI.init();
</script>
