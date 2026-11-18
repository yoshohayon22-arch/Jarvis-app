<script>
"use strict";
/* =====================================================================
   MATCH EN DIRECT — un résumé qui défile, avec 2 à 3 actions clés où le
   joueur décide. Générique : le personnage fournit les situations
   (moments), ses qualités (matchSkill) et la force des équipes (xg).
   ===================================================================== */
const MATCH = {
  M: null,
  FLAVOR: ["Le match démarre sur un rythme élevé.", "Longue séquence de possession au milieu de terrain.", "Corner, repoussé par la défense.", "Le public pousse, les duels se durcissent.", "Faute au milieu de terrain, carton jaune.", "Frappe lointaine, largement au-dessus.", "Le gardien sort loin de sa ligne pour dégager.", "Changement tactique : le bloc recule de dix mètres.", "Hors-jeu signalé de justesse.", "Les deux équipes se neutralisent."],

  start(s, m, cb){
    const ch = GAME.ch(s);
    if (m.final) { m.ko = true; if (m.comp === "cl") m.stage = "f"; }
    if (!ch.plays(s, m)) { cb(ch.simulate(s, m)); return; }
    const x = ch.xg(s, m, true); const pois = l => { let L = Math.exp(-Math.max(0, l)), k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return k - 1; };
    const ev = []; const mins = new Set(); const minute = () => { let t; do { t = 3 + Math.floor(Math.random() * 86); } while (mins.has(t)); mins.add(t); return t; };
    for (let i = 0, n = pois(x.mine * (1 - x.share) * .9); i < n; i++) ev.push({ min: minute(), type: "for" });
    for (let i = 0, n = pois(x.opp); i < n; i++) ev.push({ min: minute(), type: "against" });
    for (let i = 0, n = pois(x.mine * x.share * .3); i < n; i++) ev.push({ min: minute(), type: "mine" });
    const K = m.final ? 3 : 2 + (Math.random() < .5 ? 1 : 0); const pool = [...ch.moments].sort(() => Math.random() - .5).filter((mo, i, arr) => !mo.pen || Math.random() < .35).slice(0, K);
    for (const mo of pool) ev.push({ min: minute(), type: "moment", mo });
    for (let i = 0; i < 4; i++) ev.push({ min: minute(), type: "flavor", txt: MATCH.FLAVOR[Math.floor(Math.random() * MATCH.FLAVOR.length)] });
    ev.sort((a, b) => a.min - b.min);
    const me = m.comp === "nat" || m.comp === "tour" ? "Portugal" : ch.rankLabel(s).split(" · ")[0];
    MATCH.M = { s, m, cb, ev, i: 0, gf: 0, ga: 0, goals: 0, assists: 0, bonus: 0, miss: 0, lines: [], wait: null, done: false, me, timer: null, tab: undefined, min: 0 };
    UI.modalOpen = true; AUDIO.sfx("whistle"); MATCH.push(0, `Coup d’envoi. ${m.title}.`, "");
    MATCH.render(); MATCH.run();
  },
  push(min, txt, cls){ MATCH.M.lines.push({ min, txt, cls }); },
  run(){ const M = MATCH.M; if (!M) return; clearTimeout(M.timer); M.timer = setTimeout(MATCH.step, M.fast ? 140 : 950); },
  step(){
    const M = MATCH.M; if (!M || M.wait || M.done) return;
    if (M.i >= M.ev.length) return MATCH.end();
    const e = M.ev[M.i++]; M.min = e.min;
    if (e.type === "for") { M.gf++; MATCH.push(e.min, `But pour ${M.me} ! Un coéquipier conclut une belle action collective.`, "goal"); AUDIO.sfx("goal"); }
    else if (e.type === "against") { M.ga++; MATCH.push(e.min, `But pour ${M.m.opp}. La défense est prise à défaut.`, "bad"); AUDIO.sfx("error"); }
    else if (e.type === "mine") { M.gf++; M.goals++; MATCH.push(e.min, `But ! Vous surgissez au premier poteau et trompez le gardien.`, "goal"); AUDIO.sfx("goal"); }
    else if (e.type === "flavor") MATCH.push(e.min, e.txt, "");
    else { M.wait = e; M.fast = false; MATCH.push(e.min, e.mo.txt, "key"); AUDIO.sfx("event"); }
    MATCH.render(); if (!M.wait) MATCH.run();
  },
  choose(k){
    const M = MATCH.M; if (!M || !M.wait) return; const e = M.wait, o = e.mo.opts[k], s = M.s, ch = GAME.ch(s); M.wait = null;
    const p = clamp(o.base + (ch.matchSkill(s, o.sk) - 78) / 110 + (s.stats.forme - 60) / 260 - (M.m.O - 80) / 190 - Math.max(0, s.stats.fatigue - 50) / 350, .04, .95);
    const ok = Math.random() < p;
    if (ok && o.goal) { M.gf++; M.goals++; M.bonus += o.bonus || 0; MATCH.push(e.min, `${o.label} : but ! Le stade explose.`, "goal"); AUDIO.sfx("goal"); }
    else if (ok && o.assist) { if (Math.random() < .72) { M.gf++; M.assists++; MATCH.push(e.min, `${o.label} : votre coéquipier n’a plus qu’à pousser le ballon au fond. Passe décisive.`, "goal"); AUDIO.sfx("goal"); } else MATCH.push(e.min, `${o.label} : l’offrande est parfaite, mais votre coéquipier manque le cadre.`, ""); }
    else if (ok) MATCH.push(e.min, `${o.label} : le ballon est conservé, l’action se poursuit.`, "");
    else { M.miss++; MATCH.push(e.min, e.mo.pen ? `${o.label} : le gardien a plongé du bon côté. Penalty manqué.` : o.goal ? `${o.label} : ${["le gardien détourne du bout des gants.", "le ballon frôle le poteau.", "le défenseur revient et contre."][Math.floor(Math.random() * 3)]}` : `${o.label} : la passe est interceptée.`, "bad"); if (o.goal && !e.mo.pen && e.mo.opts.some(z => z.assist)) M.selfish = (M.selfish || 0) + 1; }
    MATCH.render(); MATCH.run();
  },
  end(){
    const M = MATCH.M; const m = M.m; M.done = true; AUDIO.sfx("whistle");
    MATCH.push(90, `Coup de sifflet final : ${M.me} ${M.gf}-${M.ga} ${m.opp}.`, "");
    if (M.gf === M.ga && m.ko && (m.final || m.comp === "tour" || m.comp === "cup")) { const mine = Math.random() < .78; M.tab = Math.random() < .5 + (m.T - m.O) / 200 + (mine ? .1 : -.14); MATCH.push(120, `Prolongation sans but, puis tirs au but. Vous ${mine ? "transformez" : "manquez"} le vôtre. ${M.tab ? "Victoire au bout de la séance !" : "La séance tourne en faveur de l’adversaire."}`, M.tab ? "goal" : "bad"); }
    const win = M.tab !== undefined ? M.tab : M.gf > M.ga; AUDIO.sfx(win ? "crowd" : M.gf === M.ga ? "click" : "defeat");
    MATCH.render();
  },
  finish(){ const M = MATCH.M; if (!M) return; clearTimeout(M.timer); const res = { gf: M.gf, ga: M.ga, goals: M.goals, assists: M.assists, played: true, bonus: M.bonus - M.miss * .15, selfish: (M.selfish || 0) >= 2, tab: M.tab }; const cb = M.cb; MATCH.M = null; overlay().innerHTML = ""; UI.modalOpen = false; cb(res); },

  render(){
    const M = MATCH.M; if (!M) return; const m = M.m; const w = M.wait;
    overlay().innerHTML = `<div class="overlay" role="dialog" aria-modal="true" aria-label="Match"><div class="modal wide"><div class="scene">${ART.scene("stade")}</div><div class="modal-body mt">
      <div class="ev-kind"><span class="k hist">${m.big || m.final ? "Grand match" : "Match"}</span><span class="label">${esc(m.title)}</span></div>
      <div class="mt-score"><span class="team">${esc(M.me)}</span><b class="num">${M.gf} – ${M.ga}</b><span class="team">${esc(m.opp)}</span></div>
      <div class="mt-clock"><span class="num">${M.done ? "Terminé" : M.min + "’"}</span><span>Vous : ${M.goals} but${M.goals > 1 ? "s" : ""}, ${M.assists} passe${M.assists > 1 ? "s" : ""} décisive${M.assists > 1 ? "s" : ""}</span></div>
      <div class="mt-feed" id="mt-feed">${M.lines.map(l => `<div class="mt-line ${l.cls}"><span class="num">${l.min}’</span><span>${esc(l.txt)}</span></div>`).join("")}</div>
      ${w ? `<div class="mt-choice"><span class="label">À vous de jouer</span><div class="mt-opts">${w.mo.opts.map((o, i) => `<button class="btn ${i === 0 ? "primary" : ""}" data-mo="${i}">${esc(o.label)}</button>`).join("")}</div></div>` : ""}
      <div class="row">${M.done ? `<button class="btn primary" id="mt-end">Continuer</button>` : w ? "" : `<button class="btn ghost" id="mt-fast">${M.fast ? "Vitesse normale" : "Accélérer jusqu’à la prochaine action"}</button>`}</div>
    </div></div></div>`;
    const f = $("#mt-feed"); if (f) f.scrollTop = f.scrollHeight;
    $$("[data-mo]").forEach(b => b.onclick = () => MATCH.choose(+b.dataset.mo));
    const e = $("#mt-end"); if (e) e.onclick = () => MATCH.finish();
    const fb = $("#mt-fast"); if (fb) fb.onclick = () => { M.fast = !M.fast; MATCH.render(); MATCH.run(); };
  }
};
</script>
