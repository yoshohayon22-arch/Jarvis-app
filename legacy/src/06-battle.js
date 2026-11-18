<script>
"use strict";
/* =====================================================================
   BATAILLE TACTIQUE — grille de 5 secteurs, 3 phases, un ordre par unité.
   Générique : le personnage fournit ses unités (battleSetup) et récupère
   les pertes (battleApply). Servira aussi aux duels.
   ===================================================================== */
const BATTLE = {
  B: null,
  ORDERS: { attaquer: { label: "Attaquer", hint: "Frappe fort, s’expose davantage." }, tenir: { label: "Tenir", hint: "Défend sa position ; profite du terrain." }, contourner: { label: "Contourner", hint: "Manœuvre cette phase, frappe de flanc à la suivante." }, reserve: { label: "Réserve", hint: "Hors du feu, reprend du moral ; entre fraîche plus tard." } },
  TERR: { plaine: { label: "Plaine", def: 0 }, colline: { label: "Hauteur", def: .25 }, village: { label: "Village", def: .3 }, bois: { label: "Bois", def: .15 }, riviere: { label: "Ruisseau", def: .1, river: true } },

  start(s, b, title, cb){
    const ch = GAME.ch(s); const set = ch.battleSetup ? ch.battleSetup(s, b) : null;
    if (!set || !set.mine.length || !b.need) { cb(GAME.quickBattle(s, b)); return; }
    const terrKeys = ["plaine", "plaine", "plaine", "colline", "village", "bois", "riviere"];
    const terr = Array.from({ length: 5 }, () => ({ mine: terrKeys[Math.floor(Math.random() * terrKeys.length)], foe: terrKeys[Math.floor(Math.random() * terrKeys.length)] }));
    const cols = n => n >= 5 ? [2, 1, 3, 0, 4] : n === 4 ? [1, 2, 3, 0] : n === 3 ? [2, 1, 3] : n === 2 ? [1, 3] : [2];
    const place = (arr, side) => arr.map((u, i) => ({ ...u, side, id: side + i, col: cols(Math.min(arr.length, 5))[i % 5], row: i >= 5 ? "back" : "front", order: "tenir", men0: u.men, routed: false, fresh: false, flankNext: false, flanking: false }));
    BATTLE.B = { s, b, title, cb, phase: 0, terr, mine: place(set.mine, "m"), foes: place(set.foes, "f"), sel: null, texts: [], changeLeft: 99, over: null, unitLabel: set.unitLabel || "hommes" };
    BATTLE.render();
  },
  quick(){ const B = BATTLE.B; BATTLE.close(); B.cb(GAME.quickBattle(B.s, B.b)); },
  close(){ overlay().innerHTML = ""; UI.modalOpen = false; BATTLE.B = null; },

  q: u => (.6 + u.moral / 125) * (.75 + (u.supply ?? 60) / 400) * (u.skill || 1),
  alive: arr => arr.filter(u => !u.routed),
  total: arr => arr.reduce((t, u) => t + (u.routed ? u.men * .5 : u.men), 0),

  foeOrders(B){
    for (const u of BATTLE.alive(B.foes)) {
      const facing = BATTLE.alive(B.mine).filter(m => m.col === u.col).reduce((t, m) => t + m.men, 0);
      const r = Math.random(); const agg = (B.b.base < .45 ? .6 : .42) + (u.men > facing * 1.3 ? .2 : 0) - (u.moral < 40 ? .25 : 0);
      u.order = r < agg ? "attaquer" : r < agg + .08 && B.phase < 2 ? "contourner" : "tenir";
    }
  },

  resolve(){
    const B = BATTLE.B; if (!B || B.over) return;
    BATTLE.foeOrders(B);
    const all = [...B.mine, ...B.foes];
    // Manœuvres de flanc lancées à la phase précédente
    for (const u of BATTLE.alive(all)) { u.flanking = false; if (u.flankNext) { const foe = BATTLE.alive(u.side === "m" ? B.foes : B.mine); const near = foe.filter(f => Math.abs(f.col - u.col) === 1).sort((a, b) => Math.abs(a.col - 2) - Math.abs(b.col - 2))[0] || foe.sort((a, b) => Math.abs(a.col - u.col) - Math.abs(b.col - u.col))[0]; if (near) u.col = near.col; u.row = "front"; u.flanking = true; u.flankNext = false; u.order = "attaquer"; } }
    for (const u of BATTLE.alive(all)) if (u.order === "attaquer" && u.row === "back") u.row = "front";
    const atk = (u, river) => { let m = u.flanking ? 1.7 : u.order === "attaquer" ? 1.25 : u.order === "tenir" ? .8 : u.order === "contourner" ? .3 : 0; if (u.fresh && u.order === "attaquer") m *= 1.3; if (u.row === "back") m *= .45; if (river && (u.order === "attaquer" || u.flanking)) m *= .8; return u.men * BATTLE.q(u) * m; };
    const taken = (u, t) => { let m = u.flanking ? .6 : u.order === "attaquer" ? 1.15 : u.order === "tenir" ? .75 * (1 - BATTLE.TERR[t].def) : u.order === "contourner" ? .5 : .15; if (u.row === "back") m *= .45; return m; };
    const K = .085; const facts = []; const before = { m: BATTLE.total(B.mine), f: BATTLE.total(B.foes) };
    const spill = { m: 0, f: 0 };
    for (let c = 0; c < 5; c++) {
      const M = BATTLE.alive(B.mine).filter(u => u.col === c), F = BATTLE.alive(B.foes).filter(u => u.col === c);
      const river = BATTLE.TERR[B.terr[c].mine].river || BATTLE.TERR[B.terr[c].foe].river;
      const aM = M.reduce((t, u) => t + atk(u, river), 0), aF = F.reduce((t, u) => t + atk(u, river), 0);
      const hit = (units, dmg, t) => { const tot = units.reduce((x, u) => x + u.men, 0); for (const u of units) { const loss = Math.min(u.men * .6, dmg * (u.men / tot) * taken(u, t)); u.men -= loss; u.moral -= loss / Math.max(1, u.men + loss) * 110; u._loss = (u._loss || 0) + loss; } };
      if (M.length && F.length) { hit(F, aM * K, B.terr[c].foe); hit(M, aF * K, B.terr[c].mine); for (const u of M) if (aM > aF) u.moral += 4; for (const u of F) if (aF > aM) u.moral += 4; }
      else if (M.length && !F.length && aM > 0 && M.some(u => u.order === "attaquer" || u.flanking)) { spill.f += aM * .5; facts.push(`Secteur ${c + 1} : percée de ${M[0].name}, personne en face.`); for (const u of BATTLE.alive(B.foes)) u.moral -= 5; }
      else if (F.length && !M.length && aF > 0 && F.some(u => u.order === "attaquer" || u.flanking)) { spill.m += aF * .5; facts.push(`Secteur ${c + 1} : l’ennemi perce, aucun de vos corps ne tient ce secteur.`); for (const u of BATTLE.alive(B.mine)) u.moral -= 5; }
    }
    for (const side of ["m", "f"]) if (spill[side] > 0) { const units = BATTLE.alive(side === "m" ? B.mine : B.foes); const tot = units.reduce((x, u) => x + u.men, 0); for (const u of units) { const loss = Math.min(u.men * .3, spill[side] * K * (u.men / tot)); u.men -= loss; u.moral -= loss / Math.max(1, u.men + loss) * 110; } }
    for (const u of BATTLE.alive(all)) {
      if (u.order === "reserve") { u.moral = Math.min(100, u.moral + 8); u.fresh = true; } else u.fresh = false;
      if (u.order === "contourner" && !u.flanking) u.flankNext = true;
      u.moral = clamp(u.moral, 0, 100);
      if (u.moral <= 15 || u.men <= u.men0 * .12) { u.routed = true; u.men *= .8; facts.push(`${u.name} ${u.side === "m" ? "(à vous)" : "(ennemi)"} se débande.`); }
    }
    B.phase++;
    const lostM = before.m - BATTLE.total(B.mine), lostF = before.f - BATTLE.total(B.foes);
    for (const u of BATTLE.alive(B.mine)) if (u.flanking) facts.push(`${u.name} tombe sur le flanc ennemi dans le secteur ${u.col + 1}.`);
    const txt = `Phase ${B.phase} : vous perdez environ ${BATTLE.fmt(lostM, B)} ; l’ennemi en perd ${BATTLE.fmt(lostF, B)}. ${facts.join(" ")}`;
    B.texts.push({ phase: B.phase, txt, ai: null });
    B.changeLeft = 1;
    const mAlive = BATTLE.alive(B.mine).length, fAlive = BATTLE.alive(B.foes).length;
    if (B.phase >= 3 || !mAlive || !fAlive) {
      const m0 = B.mine.reduce((t, u) => t + u.men0, 0), f0 = B.foes.reduce((t, u) => t + u.men0, 0);
      const lm = 1 - BATTLE.total(B.mine) / m0, lf = 1 - BATTLE.total(B.foes) / f0;
      const win = !fAlive ? true : !mAlive ? false : lf > lm * 1.05;
      B.over = { win, lossPct: lm, mineLost: m0 - BATTLE.total(B.mine), foeLost: f0 - BATTLE.total(B.foes) };
    }
    AUDIO.sfx("cannon");
    const entry = B.texts[B.texts.length - 1];
    if (AI.usable()) AI.narrate(B.s, `Bataille : ${B.b.name}. ${txt}\nVos unités : ${B.mine.map(u => `${u.name} (${u.chief || ""}) ordre ${u.order}${u.routed ? ", en déroute" : ""}`).join(" ; ")}.${B.over ? ` Issue : ${B.over.win ? "victoire" : "défaite"} du joueur.` : ""}`).then(t => { if (t && BATTLE.B === B) { entry.ai = t; BATTLE.render(); } }).catch(() => {});
    BATTLE.render();
  },
  fmt: (k, B) => B.unitLabel === "hommes" ? `${Math.max(0, Math.round(k * 1000)).toLocaleString("fr-FR")} hommes` : `${Math.max(0, Math.round(k))} ${B.unitLabel}`,

  render(){
    const B = BATTLE.B; if (!B) return; UI.modalOpen = true;
    const cell = (side, row, c) => {
      const arr = side === "m" ? B.mine : B.foes; const u = arr.find(x => x.col === c && x.row === row && !x.routed);
      const t = row === "front" ? BATTLE.TERR[B.terr[c][side === "m" ? "mine" : "foe"]] : null;
      const unit = u ? `<button class="bt-unit ${side} ${B.sel === u.id ? "sel" : ""}" data-unit="${u.id}" ${side === "f" ? "disabled" : ""}>
          <b>${esc(u.name)}</b><span>${esc(u.chief || "")}</span><span class="num">${Math.round(u.men * (B.unitLabel === "hommes" ? 1000 : 1)).toLocaleString("fr-FR")}</span>
          <span class="bar"><i class="lvl-${u.moral < 30 ? "bad" : u.moral < 50 ? "warn" : "good"}" style="width:${u.moral}%"></i></span>
          ${side === "m" ? `<em>${BATTLE.ORDERS[u.order].label}${u.flankNext ? " →" : ""}</em>` : ""}</button>` : "";
      return `<div class="bt-cell ${side} ${row} ${t ? "t-" + B.terr[c][side === "m" ? "mine" : "foe"] : ""}" data-cell="${side}|${row}|${c}">${t ? `<small>${t.label}</small>` : ""}${unit}</div>`;
    };
    const rows = [["f", "back"], ["f", "front"], ["m", "front"], ["m", "back"]].map(([sd, rw]) => Array.from({ length: 5 }, (_, c) => cell(sd, rw, c)).join("")).join("");
    const sel = B.mine.find(u => u.id === B.sel);
    const canOrder = !B.over && sel && !sel.routed && !sel.flankNext && (B.phase === 0 || B.changeLeft > 0);
    const last = B.texts[B.texts.length - 1];
    const routedM = B.mine.filter(u => u.routed), routedF = B.foes.filter(u => u.routed);
    overlay().innerHTML = `<div class="overlay" role="dialog" aria-modal="true" aria-label="Bataille"><div class="modal wide"><div class="modal-body bt">
      <div class="ev-kind"><span class="k hist">Bataille</span><span class="label">${B.over ? "Terminée" : B.phase === 0 ? "Déploiement" : `Phase ${B.phase} sur 3 jouée`}</span></div>
      <h2>${esc(B.title || B.b.name)}</h2>
      <div class="bt-forces"><span>Vous : <b class="num">${BATTLE.fmt(BATTLE.alive(B.mine).reduce((t, u) => t + u.men, 0), B)}</b></span><span>Ennemi : <b class="num">${BATTLE.fmt(BATTLE.alive(B.foes).reduce((t, u) => t + u.men, 0), B)}</b></span></div>
      <div class="bt-grid">${rows}</div>
      ${routedM.length || routedF.length ? `<p class="muted ui" style="margin:0;font-size:.85rem">En déroute : ${[...routedM.map(u => u.name + " (à vous)"), ...routedF.map(u => u.name + " (ennemi)")].map(esc).join(", ")}</p>` : ""}
      ${last ? `<div class="realbox"><b>${esc(last.ai || last.txt)}</b>${last.ai ? `<br><span class="ui" style="font-size:.82rem">${esc(last.txt)}</span>` : ""}</div>` : `<p class="muted" style="margin:0">Touchez une de vos unités, puis une case de vos deux lignes pour la placer. Donnez un ordre à chacune. Une unité seule dans un secteur face au vide peut percer ; un secteur laissé vide peut être percé.</p>`}
      ${!B.over ? `<div class="bt-orders">${sel ? `<span class="label">${esc(sel.name)}${B.phase > 0 ? ` · ${B.changeLeft > 0 ? "vous pouvez changer un ordre" : "ordre déjà changé pour cette phase"}` : ""}</span>` : `<span class="label">${B.phase > 0 && B.changeLeft > 0 ? "Vous pouvez changer un ordre : touchez une unité" : "Touchez une unité pour lui donner un ordre"}</span>`}
        <div class="bt-ord">${Object.entries(BATTLE.ORDERS).map(([k, o]) => `<button class="btn ${sel && sel.order === k ? "primary" : ""}" data-order="${k}" ${canOrder ? "" : "disabled"} title="${esc(o.hint)}">${o.label}</button>`).join("")}</div>
        ${sel ? `<span class="muted ui" style="font-size:.85rem">${esc(BATTLE.ORDERS[sel.order].hint)}</span>` : ""}</div>` : ""}
      <div class="row">${B.over ? `<span class="verdict ${B.over.win ? "win" : "loss"}" style="margin-right:auto">${B.over.win ? "Victoire" : "Défaite"}</span><button class="btn primary" id="bt-end">Continuer</button>`
        : `${B.phase === 0 ? `<button class="btn ghost" id="bt-quick">Déléguer à l’état-major</button>` : ""}<button class="btn primary" id="bt-go">${B.phase === 0 ? "Engager la bataille" : `Lancer la phase ${B.phase + 1}`}</button>`}</div>
    </div></div></div>`;
    const ov = $(".overlay");
    $$("[data-unit]", ov).forEach(b => b.onclick = e => { e.stopPropagation(); B.sel = b.dataset.unit; AUDIO.sfx("click"); BATTLE.render(); });
    $$("[data-cell]", ov).forEach(c => c.onclick = () => { const [sd, rw, col] = c.dataset.cell.split("|"); if (sd !== "m" || B.phase !== 0 || !B.sel) return; const u = B.mine.find(x => x.id === B.sel); const other = B.mine.find(x => x.col === +col && x.row === rw && x !== u); if (other) { other.col = u.col; other.row = u.row; } u.col = +col; u.row = rw; BATTLE.render(); });
    $$("[data-order]", ov).forEach(b => b.onclick = () => { const u = B.mine.find(x => x.id === B.sel); if (!u || u.order === b.dataset.order) return; u.order = b.dataset.order; if (B.phase > 0) B.changeLeft--; AUDIO.sfx("click"); BATTLE.render(); });
    const go = $("#bt-go", ov); if (go) go.onclick = () => BATTLE.resolve();
    const qk = $("#bt-quick", ov); if (qk) qk.onclick = () => BATTLE.quick();
    const end = $("#bt-end", ov); if (end) end.onclick = () => { const res = B.over; const ch = GAME.ch(B.s); if (ch.battleApply) ch.battleApply(B.s, B); AUDIO.sfx(res.win ? "victory" : "defeat"); const cb = B.cb; BATTLE.close(); cb(res); };
  }
};

/* Napoléon : ses corps deviennent les unités de la bataille */
(function(){
  const N = CHARACTERS.napoleon;
  N.battleSetup = (s, b) => {
    const reg = b.region; const R = id => N.map.regions.find(r => r.id === id);
    let cs = s.corps.filter(c => c.men >= 1 && (reg ? (c.loc === reg || (R(reg) && R(reg).adj.includes(c.loc))) : c.loc !== "espagne"));
    if (!cs.length) cs = s.corps.filter(c => c.men >= 1);
    cs = [...cs].sort((a, b2) => b2.men - a.men).slice(0, 5);
    if (!cs.length) return null;
    const cap = b.need * 1.15 / cs.length;
    const mine = cs.map(c => ({ ref: c.id, name: c.name.replace("Division ", "Div. ").replace("Réserve de cavalerie", "Cavalerie").replace("Armée d", "A. d"), chief: N.marshalName(c.marshal), men: Math.min(c.men, cap), moral: c.moral, supply: c.supply, skill: N.marshal(c.marshal).skill * (1 + (s.stats.fatigue > 70 ? -.05 : .05)) }));
    const E = b.need * clamp(.6 / b.base, .8, 1.9); const n = clamp(Math.round(E / 22), 3, 5);
    const names = { autriche: "Autrichiens", russie: "Russes", prusse: "Prussiens", angleterre: "Britanniques", espagne: "Espagnols", italie: "Piémontais", ottoman: "Ottomans", allemagne: "Impériaux", naples: "Napolitains", suede: "Suédois" };
    const who = names[b.foe] || names[reg] || "Coalisés"; const wings = ["Centre", "Aile gauche", "Aile droite", "Avant-garde", "Réserve"];
    const foes = Array.from({ length: n }, (_, i) => ({ name: wings[i], chief: who, men: E / n * (i === 0 ? 1.2 : .95), moral: b.base < .45 ? 68 : 58, supply: 65, skill: b.base < .4 ? 1.08 : 1 }));
    return { mine, foes, unitLabel: "hommes" };
  };
  N.battleApply = (s, B) => { for (const u of B.mine) { const c = s.corps.find(x => x.id === u.ref); if (!c) continue; c.men = Math.max(.5, c.men - (u.men0 - u.men) - (u.routed ? u.men * .15 : 0)); c.moral = clamp(u.moral + (B.over.win ? 12 : -4), 5, 100); } N.sync(s); };
})();
</script>
