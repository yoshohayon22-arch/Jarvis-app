<script>
"use strict";
/* =====================================================================
   NAPOLÉON — organisation en cinq fenêtres : Vue générale, Armée, Presse,
   Finances, Correspondance. Ordres aux corps, curseurs à effet direct,
   presse d’époque, contacts et courriers. Toujours en données.
   ===================================================================== */
(function(){
const N = CHARACTERS.napoleon;
const P = s => GAME.power(s);
const M = v => `${Math.round(v)} M F`;
const sg = (v, d = 1) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(d).replace(".", ",")}`;
const REG = id => N.map.regions.find(r => r.id === id);
const once = (s, id) => s.wk[id] === s.week ? "Déjà fait cette semaine" : false;
const pay = (s, n) => s.stats.tresor < n ? `Il faut ${M(n)}` : false;

Object.assign(N.defaultPol, { recrut: 0, marine: 1, cour: 1 });

/* ---------------- Jauges composées et alertes ---------------- */
N.stability = s => clamp(Math.round(100 - s.stats.complot * .6 - Math.max(0, 50 - s.stats.popularite) * .5 - Math.max(0, 50 - s.stats.loyaute) * .35 - (s.stats.tresor < 0 ? 10 : 0)), 0, 100);
N.opinionAbroad = s => { const ks = ["angleterre", "autriche", "russie", "prusse", "espagne", "allemagne", "italie"]; const avg = ks.reduce((t, k) => t + s.pays[k].rel, 0) / ks.length; return clamp(Math.round(50 + avg * .45 - (s.stats.coalition - 50) * .25), 0, 100); };
N.mainGauges = s => [
  { label: "Popularité en France", v: s.stats.popularite }, { label: "Stabilité de l’Empire", v: N.stability(s) },
  { label: `Santé · ${GAME.age(s)} ans`, v: s.stats.sante }, { label: "Loyauté des maréchaux", v: s.stats.loyaute },
  { label: "Menace de coalition", v: s.stats.coalition, bad: "high" }
];
N.sideFacts = s => [["Territoire", `${Math.round(s.stats.departements)} dép.`], ["Risque de complot", Math.round(s.stats.complot)], ["Fatigue", Math.round(s.stats.fatigue)], ["Stress", Math.round(s.stats.stress)]];
N.corpsAlerts = (s, c) => { const a = []; if (c.supply < 35) a.push("Manque de vivres"); if (c.moral < 40) a.push("Moral bas"); const r = REG(c.loc); const near = [c.loc, ...(r ? r.adj : [])].find(k => s.pays[k] && s.pays[k].statut === "guerre" && s.pays[k].armee >= 30 && k !== "angleterre"); if (near && !c.dest) a.push(`Ennemi proche : ${N.regionName(near)}`); return a; };
N.alerts = s => {
  const b = N.budget(s); const out = { armee: [], finances: [], general: [] };
  for (const c of s.corps) for (const a of N.corpsAlerts(s, c)) out.armee.push(`${c.name} : ${a}`);
  if (P(s) >= 1) { if (s.stats.tresor < 0) out.finances.push("Le Trésor est vide : la faillite menace."); else if (b.solde < 0 && s.stats.tresor / -b.solde < 6) out.finances.push(`À ce rythme, le Trésor sera vide dans ${Math.max(1, Math.round(s.stats.tresor / -b.solde))} mois.`); if (s.dette > 400) out.finances.push("La dette dépasse 400 millions : les banquiers s’inquiètent."); }
  if (s.stats.complot >= 65) out.general.push("La police signale des conjurations sérieuses."); if (s.stats.sante < 35) out.general.push("Votre santé décline dangereusement.");
  return out;
};
/* « À venir » : ce que l’on sait déjà de l’avenir */
N.upcoming = s => {
  const out = [];
  for (const d of s.deferred) out.push({ d: d.date, t: d.title, k: "Conséquence attendue" });
  for (const c of s.corps) if (c.dest) out.push({ d: c.eta, t: `${c.name} arrive : ${N.regionName(c.dest)}${c.stance === "attaque" ? " (attaque à l’arrivée)" : ""}`, k: "Mouvement" });
  for (const w of N.works) { const pr = s.projects[w.id]; if (pr && pr.left > 0) out.push({ d: addDays(s.date, Math.round(pr.left / [.5, 1, 1.6][s.pol.travaux] * 7)), t: `Fin du chantier : ${w.label}`, k: "Grands travaux" }); }
  for (const q of (s.corrQueue || [])) out.push({ d: q.at, t: `Réponse attendue : ${GAME.relDef(s, q.id).name}`, k: "Courrier" });
  for (const [id, th] of Object.entries(s.corr || {})) for (const m of th) if (m.me && m.arrive && m.arrive > s.date) out.push({ d: m.arrive, t: `Votre lettre parvient à ${GAME.relDef(s, id).name}`, k: "Courrier" });
  if (s.flags.remarried && !s.flags.sonBorn && (s.family.spouse || s.family.spouseName)) out.push({ d: addDays(s.date, 120), t: "Une naissance est espérée à la cour", k: "Famille", approx: true });
  if (s.pol.espions) for (const r of N.rivals) { const v = s.rivals[r.id]; if (v.prog >= 60) out.push({ d: addDays(s.date, Math.round((100 - v.prog) * 1.2) + 7), t: `${r.name} : ${v.plan.charAt(0).toLowerCase() + v.plan.slice(1)}`, k: "Renseignement", approx: true }); }
  if (s.dette > 0) out.push({ d: addDays(s.date, 30), t: `Intérêts de la dette : ${(s.dette * .005).toFixed(1).replace(".", ",")} M F par mois`, k: "Finances", approx: true });
  return out.sort((a, b) => a.d.localeCompare(b.d)).slice(0, 12);
};

/* ---------------- Budget mensuel détaillé ---------------- */
N.budget = s => {
  const st = s.stats, p = s.pol, r = N.ranks[s.rank] || { income: 0 }, pw = P(s), L = s.laws;
  const rec = [], dep = [];
  if (pw === 0) { rec.push(["Pension et revenus de l’exil", s.rank === "prisonnier" ? .2 : .6]); dep.push(["Maison et domestiques", s.rank === "prisonnier" ? .2 : .5]); }
  else {
    const mult = (1 + (L.prefets ? .03 : 0) + (L.cadastre ? .04 : 0) + (L.banque ? .02 : 0)) * (s.eco / 100) * (pw >= 2 ? N.minister(s, "tresor") : 1);
    const vassaux = Object.values(s.pays).filter(x => x.statut === "vassal" || x.statut === "occupe").length;
    rec.push([pw >= 2 ? "Impôts directs" : "Caisse de l’armée", st.departements * .55 * (.7 + st.popularite / 200) * r.income * (p.impots / 100) * mult]);
    if (pw >= 2) { rec.push(["Droits indirects (droits réunis)", [0, 6, 11][p.droits]]); rec.push(["Douanes" + (p.blocus === 1 ? " et licences" : ""), [2, 5, 8][p.douanes] * (p.blocus === 2 ? .35 : p.blocus === 1 ? 1.4 : 1)]); }
    rec.push(["Tributs des pays vaincus", p.contrib * (pw >= 2 ? vassaux * 1.4 : vassaux * 3)]);
    dep.push(["Armée : solde et entretien", st.armee * (pw >= 2 ? .085 : .02) * (p.solde / 100)]);
    if (s.flags.atWar) dep.push(["Armée : dépenses de campagne", st.armee * (pw >= 2 ? .035 : .01)]);
    dep.push(["Armée : ravitaillement", st.armee * .012 * [.6, 1, 1.5][p.rav] * (pw >= 2 ? 1 : .3)]);
    if (p.recrut && pw >= 2) dep.push(["Contingents étrangers", [0, 3, 7][p.recrut]]);
    if (pw >= 2) {
      dep.push(["Marine", [0, 4, 9, 16][p.marine]]);
      const tr = N.works.filter(w => s.projects[w.id] && s.projects[w.id].left > 0).reduce((t, w) => t + w.cost / w.weeks * 4.35 * [.5, 1, 1.6][p.travaux], 0); if (tr) dep.push(["Grands travaux", tr]);
      dep.push([s.rank === "empereur" ? "Cour impériale" : "Maison du Premier consul", [1, 3, 6][p.cour] * (s.rank === "empereur" ? 1 : .5)]);
      dep.push(["Administration", st.departements * .045]);
      dep.push(["Police" + (p.espions ? " et espions" : ""), [0, 3, 7, 12][p.police] + (p.espions ? 4 : 0)]); dep.push(["Presse et propagande", [0, 2, 5, 9][p.propag]]);
      if (p.pain) dep.push(["Prix du pain", 3]); if (p.industrie) dep.push(["Aides à l’industrie", [0, 4, 8][p.industrie]]);
      if (s.dette > 0) dep.push(["Intérêts de la dette", s.dette * .005]);
    }
  }
  const R = rec.reduce((t, x) => t + x[1], 0), D = dep.reduce((t, x) => t + x[1], 0);
  return { rec, dep, R, D, solde: R - D };
};

/* ---------------- Compléments de simulation ---------------- */
const baseTick = N.tick;
N.tick = function(s, h){
  const out = baseTick.call(this, s, h) || []; const p = s.pol, pw = P(s);
  if (pw >= 2) {
    if (p.recrut) { const vas = Object.entries(s.pays).filter(([k, c]) => c.statut === "vassal" || c.statut === "allie"); if (vas.length) { s.depot += [0, 3, 6][p.recrut] * h.dt; for (const [k, c] of vas) c.rel = clamp(c.rel - [0, .25, .6][p.recrut] * h.dt, -100, 100); } }
    const a = s.pays.angleterre; if (a.statut === "guerre") a.pression = clamp((a.pression || 0) + [-.3, 0, .15, .35][p.marine] * h.dt, 0, 100);
    h.add("loyaute", [-.5, 0, .35][p.cour]); h.add("popularite", [.1, 0, -.15][p.cour]);
  }
  for (const c of s.corps) { if (c.stance === "repos" && !c.dest) { const st = N.map.status(s, c.loc); if (st !== "guerre") { c.moral = clamp(c.moral + 3 * h.dt, 0, 100); c.supply = clamp(c.supply + 4 * h.dt, 0, 100); } } }
  return out;
};
/* Rencontre : un corps qui a l’ordre d’attaquer et se trouve en pays ennemi engage le combat */
N.meet = s => { const c = s.corps.find(x => x.stance === "attaque" && !x.dest && s.pays[x.loc] && s.pays[x.loc].statut === "guerre" && s.pays[x.loc].armee >= 5); if (!c) return null; for (const x of s.corps) if (x.loc === c.loc && x.stance === "attaque") x.stance = "defense"; return N.offensive(s, c.loc); };
const baseEnemy = N.enemyMove;
N.enemyMove = s => { const e = baseEnemy(s); if (!e) return null; const there = s.corps.filter(c => c.loc === e.region && !c.dest); const b = e.choices[0].battle; if (there.some(c => c.stance === "defense")) { b.base = .66; e.text += " Vos corps en défense sur place ont eu le temps de se retrancher."; } else if (there.length && there.every(c => c.stance === "repos")) { b.base = .46; e.text += " Vos troupes au repos sont surprises dans leurs cantonnements."; } return e; };

/* ---------------- Ordres et réglages ---------------- */
N.orders = [
  { id: "marcher", label: "Marcher", hint: "Se rendre sur place et y stationner." }, { id: "attaquer", label: "Attaquer", hint: "Marcher à l’ennemi et livrer bataille à l’arrivée." },
  { id: "defendre", label: "Défendre", hint: "Se retrancher : avantage si l’ennemi attaque." }, { id: "reposer", label: "Se reposer", hint: "Refaire le moral et les vivres, en pays ami." }
];
N.stanceLabel = { marche: "En position", attaque: "Ordre d’attaque", defense: "En défense", repos: "Au repos" };
N.travel = (c, to) => c.loc === to ? 0 : (REG(to).sea || REG(c.loc).sea ? 6 : N.path(c.loc, to) * 2);
const baseAct = N.act;
N.act = (s, act, arg, val) => {
  const st = s.stats; const fx = o => GAME.applyFx(s, o); const corps = () => s.corps.find(c => c.id === arg);
  switch (act) {
    case "order": { const c = corps(); const [kind, to] = String(val).split("|"); if (!c) return {};
      const stance = { marcher: "marche", attaquer: "attaque", defendre: "defense", reposer: "repos" }[kind];
      if (kind === "attaquer" && !(s.pays[to] && s.pays[to].statut === "guerre")) return { msg: `${N.regionName(to)} n’est pas en guerre avec vous : il n’y a personne à attaquer.`, tone: "bad" };
      if (kind === "reposer" && s.pays[to] && s.pays[to].statut === "guerre") return { msg: "On ne se repose pas en pays ennemi.", tone: "bad" };
      if (to !== c.loc) { const why = N.canEnter(s, to); if (why) return { msg: why, tone: "bad" }; c.dest = to; c.eta = addDays(s.date, N.travel(c, to) * 7); } else { c.dest = null; c.eta = null; }
      c.stance = stance;
      if (kind === "attaquer" && to === c.loc) return { battle: N.offensive(s, to), sfx: "drum" };
      return { msg: `${c.name} : ${N.orders.find(o => o.id === kind).label.toLowerCase()}, ${N.regionName(to)}${c.dest ? ` (arrivée vers le ${frDate(c.eta)})` : ""}.`, sfx: "drum" }; }
    case "corps_merge": { const c = corps(); const o = s.corps.filter(x => x !== c && x.loc === c.loc && !x.dest && !c.dest).sort((a, b) => a.men - b.men)[0]; if (!o) return { msg: "Aucun autre corps au même endroit.", tone: "bad" }; if (s.corps.length <= 3) return { msg: "Il faut garder au moins trois corps.", tone: "bad" }; const tot = c.men + o.men; c.moral = (c.moral * c.men + o.moral * o.men) / tot; c.supply = (c.supply * c.men + o.supply * o.men) / tot; c.men = tot; s.corps = s.corps.filter(x => x !== o); return { msg: `${o.name} est fondu dans ${c.name}.` }; }
    case "corps_split": { const c = corps(); if (s.corps.length >= 6) return { msg: "Six corps au maximum.", tone: "bad" }; if (c.men < 20) return { msg: "Ce corps est trop faible pour être divisé.", tone: "bad" }; const free = N.marshalsFree(s).sort((a, b) => b.skill - a.skill)[0]; const half = c.men / 2; c.men = half; s.corps.push({ id: "c" + Date.now().toString(36), name: `Corps de ${free ? free.name : "réserve"}`, marshal: free ? free.id : "?", men: half, moral: c.moral, supply: c.supply, loc: c.loc, dest: c.dest, eta: c.eta, stance: c.stance }); return { msg: `${c.name} est divisé en deux.` }; }
    case "corps_cycle": { const c = corps(); const list = N.marshalsFree(s).sort((a, b) => b.skill - a.skill); if (!list.length) return { msg: "Aucun autre chef disponible.", tone: "bad" }; const cur = N.marshal(c.marshal).skill; const next = list.find(m => m.skill < cur) || list[0]; c.marshal = next.id; return { msg: `${c.name} : commandement confié à ${next.name}.` }; }
    case "impot_exc": s.wk["exc" + parseD(s.date).y] = s.week; fx({ s: { tresor: 60, popularite: -6, complot: 2 } }); N.press(s, "impot"); return { msg: "Impôt exceptionnel : 60 millions levés d’urgence.", src: "Le Moniteur universel", sfx: "paper" };
    case "article_cmd": st.tresor -= 6; s.wk.article = s.week; N.press(s, "commande"); return { sfx: "paper" };
    case "bulletin": { const r = baseAct(s, act, arg, val); N.press(s, "bulletin"); return { sfx: r.sfx }; }
    case "law": { const r = baseAct(s, act, arg, val); N.press(s, "loi", N.laws.find(l => l.id === arg)); return { sfx: r.sfx, toast: r.msg }; }
  }
  return baseAct(s, act, arg, val);
};

/* ---------------- Presse : sources, tons, articles qui réagissent ---------------- */
N.newsSources = s => P(s) === 0 ? ["The Times (Londres)", "Journal des débats", "Rumeur de Longwood"] : ["Le Moniteur universel", "Journal des débats", "Gazette de France", "Journal de Paris", "Le Publiciste", "The Times (Londres)", "The Morning Chronicle (Londres)", "Gazette de Vienne", "Gazette de Saint-Pétersbourg", "Gazette de Berlin", "Rumeur des faubourgs", "Rumeur des provinces", "Rapport de police"];
N.newsCat = src => { const x = String(src || "").toLowerCase(); if (/carnet|conséquence/.test(x)) return "sys"; if (/rumeur|bruit|police|on dit|salon/.test(x)) return "rum"; if (/times|chronicle|london|londres|vienne|wiener|pétersbourg|petersbourg|berlin|madrid|gazeta|courier|anglais|morning|allgemeine|rome/.test(x)) return "etr"; return "fr"; };
N.pressCats = [["tous", "Tout"], ["fr", "Presse française"], ["etr", "Presse étrangère"], ["rum", "Rumeurs"], ["sys", "Carnet"]];
N.tonLabel = { fav: "Favorable", neu: "Neutre", hos: "Hostile" };
const A = (src, ton, title, text) => ({ src, ton, title, text });
N.press = (s, kind, d) => {
  const cens = s.pol.censure || 0, pw = P(s); let arts = [];
  const fr = (ton, title, text) => cens >= 2 && ton === "hos" ? A("Rumeur des faubourgs", "hos", title, text + " Les journaux, eux, n’en disent rien.") : A(cens >= 3 ? "Le Moniteur universel" : ["Journal des débats", "Gazette de France", "Journal de Paris", "Le Publiciste"][Math.floor(Math.random() * 4)], ton, title, text);
  if (kind === "bataille") {
    if (d.win) arts = [A("Le Moniteur universel", "fav", `Victoire : ${d.name}`, "L’ennemi est en retraite. L’armée a montré sa valeur accoutumée."), A("The Times (Londres)", "hos", `Nouveau carnage sur le continent`, `On annonce une affaire sanglante : ${d.name}. Le prix payé par la France est tu par ses gazettes.`)];
    else arts = [fr("hos", `Mauvaises nouvelles de l’armée`, `On parle à mots couverts d’un revers : ${d.name}. Les familles attendent les listes.`), A("Gazette de Vienne", "hos", `Les Français battus : ${d.name}`, "L’invincibilité de leurs armes n’est plus qu’une légende."), ...(cens >= 1 ? [A("Le Moniteur universel", "neu", "Mouvements de l’armée", "L’armée a pris de nouvelles positions, conformément aux ordres.")] : [])];
  } else if (kind === "loi") arts = [A("Le Moniteur universel", "fav", d.label, d.note), fr(Math.random() < .5 ? "neu" : "fav", "Une mesure commentée dans les salons", "Les notables approuvent l’ordre ; quelques voix regrettent les libertés d’hier.")];
  else if (kind === "impot") arts = [fr("hos", "L’impôt exceptionnel fait gronder", "Dans les campagnes, les percepteurs sont reçus fraîchement."), A("The Morning Chronicle (Londres)", "hos", "Le Trésor français aux abois", "Un gouvernement qui lève des taxes d’urgence n’est pas un gouvernement prospère.")];
  else if (kind === "bulletin") arts = [A("Bulletin de la Grande Armée", "fav", `Le Bulletin célèbre ${s.lastBattle ? s.lastBattle.name : "l’armée"}`, "Lu dans les mairies, affiché aux portes des églises, commenté dans les cafés.")];
  else if (kind === "commande") arts = [A(["Journal de Paris", "Journal des débats", "Le Publiciste"][Math.floor(Math.random() * 3)], "fav", ["Le gouvernement veille au bonheur public", "Tableau de la prospérité nationale", "Ce que la France doit à son chef"][Math.floor(Math.random() * 3)], "Un article inspiré en haut lieu, que les lecteurs avertis reconnaissent à son style.")];
  else if (kind === "evenement") arts = [d.hist ? A(pw >= 2 ? "Le Moniteur universel" : "Journal de Paris", "neu", d.title, d.res || "") : fr("neu", d.title, d.res || ""), ...(Math.random() < .6 ? [A(["The Times (Londres)", "Gazette de Vienne", "Gazette de Saint-Pétersbourg"][Math.floor(Math.random() * 3)], "hos", `Vu de l’étranger : ${d.title.toLowerCase()}`, "Les cours d’Europe observent et prennent note.")] : [])];
  for (const a of arts.reverse()) GAME.news(s, a);
  return arts;
};

/* ---------------- Panneaux : effets des curseurs en direct ---------------- */
const levels = (...names) => v => names[v];
const live = (id, label, min, max, step, fmt, extra) => s => ({ k: "slider", act: "pol", arg: id, label, min, max, step, val: s.pol[id], fmt,
  live: v => { const old = s.pol[id]; const b0 = N.budget(s); s.pol[id] = +v; const b1 = N.budget(s); const ex = extra ? extra(s, +v) : ""; s.pol[id] = old; const d = b1.solde - b0.solde; return `Solde mensuel ${sg(b1.solde)} M F${Math.abs(d) >= .05 ? ` (${sg(d)})` : ""}${ex ? " · " + ex : ""}`; } });
const recMonth = s => [0, 4, 8, 14, 24][s.pol.conscription] * (P(s) >= 2 ? 1 : .12) * Math.min(1, s.stats.departements / 100) + (P(s) >= 2 ? [0, 3, 6][s.pol.recrut] : 0);
const in3 = s => `effectif dans 3 mois ≈ ${Math.round((s.stats.armee + recMonth(s) * 3) * .985)} 000`;
const oldPanel = id => N.panels.find(p => p.id === id);
const O = { lois: oldPanel("lois"), dip: oldPanel("diplomatie"), police: oldPanel("police"), travaux: oldPanel("travaux"), famille: oldPanel("famille"), presse: oldPanel("presse"), eco: oldPanel("economie") };
const cut = (arr, from, to) => { const i = arr.findIndex(c => c && c.k === "h" && c.text === from); const j = to ? arr.findIndex(c => c && c.k === "h" && c.text === to) : arr.length; return i < 0 ? [] : arr.slice(i, j < 0 ? arr.length : j); };

N.panels = [
  { id: "armee", label: "Armée", cond: s => true, blocks: s => {
    if (!s.corps.length) return [{ k: "info", html: "Vous ne commandez plus aucune troupe." }];
    const rows = s.corps.map((c, i) => { const al = N.corpsAlerts(s, c); const same = s.corps.some(x => x !== c && x.loc === c.loc && !x.dest && !c.dest);
      return { k: "row", pick: c.id, title: `${i + 1}. ${c.name}`, badge: [N.marshalName(c.marshal), "neutre"], sub: `${Math.round(c.men)} 000 h. · ${N.regionName(c.loc)}${c.dest ? ` → ${N.regionName(c.dest)}, vers le ${frDate(c.eta)}` : ""} · ${N.stanceLabel[c.stance || "marche"]}`,
        meters: [["Moral", c.moral], ["Ravitaillement", c.supply]], alerts: al,
        ctrls: [{ k: "btn", act: "corps_cycle", arg: c.id, label: "Changer de maréchal" }, { k: "btn", act: "corps_merge", arg: c.id, label: "Fusionner", dis: (!same && "Aucun corps voisin") || (s.corps.length <= 3 && "3 corps au minimum") }, { k: "btn", act: "corps_split", arg: c.id, label: "Diviser", dis: (s.corps.length >= 6 && "6 corps au maximum") || (c.men < 20 && "Trop faible") }, { k: "btn", act: "corps_plus", arg: c.id, label: "+10 000", dis: s.depot < 1 && "Dépôts vides" }] }; });
    return [{ k: "kpi", items: [["Sous les armes", `${Math.round(s.stats.armee)} 000`], ["Aux dépôts", `${Math.round(s.depot)} 000`], ["Moral moyen", Math.round(s.stats.moral)], ["Corps", `${s.corps.length}/6`]] },
      { k: "info", html: "Touchez un corps, puis une destination sur la carte, puis choisissez l’ordre." }, ...rows,
      { k: "btn", act: "corps_new", label: "Former un nouveau corps", cost: "15 000 hommes des dépôts", dis: (s.corps.length >= 6 && "6 corps au maximum") || (s.depot < 15 && "Dépôts insuffisants") },
      { k: "h", text: "Recrutement et intendance" },
      live("conscription", "Niveau de conscription", 0, 4, 1, levels("Suspendue", "Légère", "Normale", "Forte", "Levée en masse"), (s, v) => `popularité ${["+0,3", "0", "−0,4", "−1", "−2,2"][v]}/mois · ${in3(s)}`)(s),
      ...(P(s) >= 2 ? [live("recrut", "Recrutement de contingents étrangers", 0, 2, 1, levels("Aucun", "Alliés sollicités", "Alliés pressurés"), (s, v) => `fidélité des alliés ${["stable", "en baisse", "en forte baisse"][v]} · ${in3(s)}`)(s)] : []),
      live("solde", "Budget militaire (solde)", 80, 125, 5, v => v + " %", (s, v) => `moral visé ${Math.round(58 + (v - 100) * .5)}`)(s),
      live("rav", "Priorité au ravitaillement", 0, 2, 1, levels("Vivre sur le pays", "Convois réguliers", "Magasins abondants"), (s, v) => `vivres visés ${[40, 65, 88][v]} %`)(s)]; } },
  { id: "lois", label: "Lois et décrets", cond: s => P(s) >= 2, blocks: s => { const b = O.lois.blocks(s); const on = b.filter(x => x.done), off = b.filter(x => x.k === "row" && !x.done); return [{ k: "h", text: `En vigueur (${on.length})` }, ...(on.length ? on : [{ k: "info", html: "Aucune loi promulguée pour l’instant." }]), { k: "h", text: "À promulguer" }, ...off]; } },
  { id: "diplomatie", label: "Diplomatie et traités", cond: s => P(s) >= 2, blocks: s => { const b = O.dip.blocks(s); return [...cut(b, "Puissances", "Ministres"), ...cut(b, "Ce que préparent vos rivaux")]; } },
  { id: "nominations", label: "Nominations", cond: s => P(s) >= 2, blocks: s => [...cut(O.dip.blocks(s), "Ministres", "Ce que préparent vos rivaux"), ...(P(s) >= 3 ? [{ k: "h", text: "Trônes de famille" }, ...O.famille.blocks(s).filter(c => c.act === "throne")] : [])] },
  { id: "police", label: "Police et espionnage", cond: s => P(s) >= 2, blocks: s => O.police.blocks(s) },
  { id: "travaux", label: "Grands travaux", cond: s => P(s) >= 2, blocks: s => O.travaux.blocks(s) },
  { id: "famille", label: "Famille et succession", cond: s => true, blocks: s => O.famille.blocks(s).filter(c => c.act !== "throne").map(c => c.k === "h" ? { k: "h", text: "Succession" } : c) },
  { id: "presse", label: "Presse", cond: s => true, blocks: s => P(s) < 2 ? [{ k: "btn", act: "write_article", label: "Écrire un article", cost: "Compte comme l’action de la semaine" }, { k: "info", html: "Vous n’avez pas encore la main sur les journaux." }] : [
    live("censure", "Niveau de censure", 0, 3, 1, levels("Presse libre (73 titres)", "Presse surveillée", "13 journaux à Paris", "4 journaux à Paris"), (s, v) => ["les critiques s’impriment librement", "les critiques s’adoucissent", "les critiques deviennent des rumeurs · complots +", "seul le Moniteur parle · complots ++, l’étranger se moque"][v])(s),
    live("propag", "Budget de propagande", 0, 3, 1, levels("Aucun", "Modeste", "Soutenu", "Massif"), (s, v) => `popularité visée +${[0, 2, 4, 6][v]}`)(s),
    { k: "btn", act: "write_article", label: "Écrire un article vous-même", cost: "Compte comme l’action de la semaine" },
    { k: "btn", act: "bulletin", label: "Commander un Bulletin de la Grande Armée", cost: "Après une bataille", dis: (!s.lastBattle || s.lastBattle.used || s.week - s.lastBattle.week > 8) && "Aucune bataille récente" },
    { k: "btn", act: "article_cmd", label: "Commander un article de propagande", cost: "6 M F", dis: once(s, "article") || pay(s, 6) },
    { k: "btn", act: "fete", label: "Te Deum et fête publique", cost: "15 M F", dis: pay(s, 15) },
    { k: "btn", act: "tableau", label: "Commander un tableau pour le Salon", cost: "8 M F, une fois par an", dis: once(s, "tab" + parseD(s.date).y) || pay(s, 8) }] },
  { id: "finances", label: "Finances", cond: s => true, blocks: s => {
    const pw = P(s), y = parseD(s.date).y; const pop = (s2, v, k) => `popularité visée ${sg(k(v))}`;
    if (pw === 0) return [{ k: "info", html: "En exil, vous vivez de votre pension." }];
    const out = [{ k: "h", text: "Recettes" }];
    if (pw >= 2) out.push(live("impots", "Impôts directs", 80, 130, 5, v => v + " %", (s, v) => `popularité visée ${sg(-(v - 100) * .35)}`)(s), live("droits", "Droits indirects (alcool, tabac, sel)", 0, 2, 1, levels("Supprimés", "Modérés", "Élevés"), (s, v) => `popularité visée ${sg(-[0, 1.5, 3][v])}`)(s), live("douanes", "Tarif douanier", 0, 2, 1, levels("Bas", "Moyen", "Prohibitif"), (s, v) => v === 2 ? "protège les manufactures, freine le commerce" : "")(s));
    out.push(live("contrib", "Tributs des pays vaincus", 0, 3, 1, levels("Aucun", "Modérés", "Lourds", "Écrasants"), (s, v) => `fidélité des vassaux ${["en hausse", "stable", "en baisse", "en chute"][v]} · menace de coalition ${sg(v * .12 - .12, 2)}/mois`)(s));
    if (pw >= 2) out.push({ k: "h", text: "Grandes dépenses" },
      live("marine", "Marine", 0, 3, 1, levels("Désarmée", "Entretien", "Constructions", "Grand programme naval"), (s, v) => ["l’Angleterre respire", "", "pression sur Londres", "forte pression sur Londres"][v])(s),
      live("cour", s.rank === "empereur" ? "Train de la cour" : "Train de maison", 0, 2, 1, levels("Austère", "Convenable", "Fastueux"), (s, v) => ["les grands dignitaires murmurent", "", "dignitaires comblés, peuple agacé"][v])(s),
      live("travaux", "Rythme des grands travaux", 0, 2, 1, levels("Ralenti", "Normal", "Accéléré"))(s),
      { k: "h", text: "Mesures" },
      { k: "btn", act: "emprunt", label: "Emprunter 100 millions", cost: "110 à rembourser, intérêts mensuels" },
      { k: "btn", act: "rembourser", label: "Rembourser la dette", cost: M(Math.min(100, s.dette)), dis: (s.dette <= 0 && "Aucune dette") || pay(s, Math.min(100, s.dette)) },
      { k: "btn", act: "impot_exc", label: "Lever un impôt exceptionnel", cost: "+60 M F, popularité −6, une fois par an", dis: s.wk["exc" + y] !== undefined && "Déjà levé cette année", confirm: true },
      { k: "select", act: "tribut", label: "Exiger un tribut de 30 millions", val: "", options: [["", "Choisir un pays soumis…"], ...Object.entries(s.pays).filter(([k, c]) => (c.statut === "vassal" || c.statut === "occupe") && s.wk["trib" + k + y] === undefined).map(([k]) => [k, N.regionName(k)])], note: "La relation avec ce pays baisse de 15." },
      { k: "btn", act: "biens", label: "Vendre des domaines nationaux", cost: "+40 M F, une fois par an", dis: s.wk["biens" + y] !== undefined && "Déjà fait cette année" },
      { k: "h", text: "Économie et Blocus" }, ...O.eco.blocks(s).filter(c => c.k !== "kpi" && c.arg !== "douanes"));
    return out; } }
];
/* Répartition des panneaux dans les fenêtres */
N.windows = { general: ["lois", "diplomatie", "nominations", "police", "travaux", "famille"], armee: "armee", presse: "presse", finances: "finances" };
const tr = N.act; N.act = (s, act, arg, val) => act === "tribut" ? tr(s, act, arg || val, val) : tr(s, act, arg, val);

/* ---------------- Parole : l’article remplace la lettre (les lettres passent par la Correspondance) ---------------- */
N.speech = N.speech.filter(t => t.id !== "lettre");
N.speech.push({ id: "article", label: "Article de presse", hint: "Un article que vous écrivez ou dictez, publié sans signature dans un journal.", ph: "Ex. : Un article pour le Journal des débats, qui explique pourquoi la paix avec l’Autriche sert le commerce français…" });

/* ---------------- Correspondance : où se trouve chacun, qui il est ---------------- */
N.persona = {
  josephine: "tendre, mondaine, dépensière, inquiète de son rang et du sort de ses enfants Eugène et Hortense ; redoute le divorce", marielouise: "jeune, réservée, élevée à la cour de Vienne, attachée à son père, peu politique",
  letizia: "austère, économe, corse jusqu’au bout des ongles ; se soucie de la famille, se méfie de la fortune ; écrit simplement", talleyrand: "feutré, ironique, cynique ; défend l’équilibre européen, la modération et ses propres intérêts ; ne dit jamais tout",
  fouche: "froid, précis, renseigné sur tout ; ancien jacobin ; rend service et se rend indispensable", berthier: "méthodique, dévoué, anxieux ; parle logistique, effectifs, ordres de marche",
  murat: "panache, vanité, bravoure ; réclame des honneurs et un trône", ney: "bouillant, direct, susceptible sur l’honneur", davout: "sévère, exact, incorruptible ; rapports brefs et précis",
  massena: "rusé, intéressé par l’argent, grand soldat un peu las", lannes: "franc, familier, courageux ; ose contredire", soult: "organisé, ambitieux, prudent dans ses formules",
  cambaceres: "juriste prudent, légaliste, attentif à l’opinion des notables ; gouverne Paris en votre absence", joseph: "aimable, cultivé, conciliant ; aîné qui supporte mal d’obéir à son cadet",
  lucien: "indépendant, républicain, fier ; refuse de se soumettre pour sa vie privée", louis: "mélancolique, susceptible, scrupuleux ; défend ses sujets contre vos exigences", jerome: "léger, dépensier, affectueux ; demande de l’argent",
  pauline: "frivole, drôle, très attachée à vous", caroline: "ambitieuse, calculatrice, défend les intérêts de Murat et les siens", elisa: "autoritaire, sérieuse, fière de bien administrer",
  eugene: "loyal, modeste, appliqué ; fils respectueux", hortense: "douce, artiste, malheureuse en ménage", pie7: "doux dans la forme, inflexible sur les droits de l’Église ; parle en pasteur",
  alexandre: "charmeur, mystique, changeant ; se voit en arbitre de l’Europe ; flatte puis se dérobe", francois: "prudent, bureaucrate, patient ; défend sa maison avant tout", metternich: "brillant, vaniteux, calculateur ; cherche l’équilibre des puissances",
  pitt: "austère, déterminé, parle au nom des intérêts britanniques ; ne correspond que par voie officielle", wellington: "laconique, froid, professionnel ; répond en soldat, par voie officielle"
};
N.contactGroups = [["Famille", ["josephine", "marielouise", "letizia", "joseph", "lucien", "louis", "jerome", "pauline", "caroline", "elisa", "eugene", "hortense"]], ["Gouvernement", ["talleyrand", "fouche", "cambaceres"]], ["Armée", ["berthier", "murat", "ney", "davout", "massena", "lannes", "soult"]], ["Souverains et étrangers", ["alexandre", "francois", "metternich", "pie7", "pitt", "wellington"]]];
N.where = s => s.rank === "prisonnier" ? "sainte-helene" : s.rank === "exilam" ? "amerique" : s.rank === "elbe" ? "elbe" : (s.where || "france");
N.whereName = s => ({ "sainte-helene": "Sainte-Hélène", amerique: "États-Unis", elbe: "île d’Elbe" }[N.where(s)] || N.regionName(N.where(s)));
N.contactLoc = (s, id) => {
  const fix = { alexandre: "russie", francois: "autriche", metternich: "autriche", pie7: "naples", pitt: "angleterre", wellington: s.date >= "1808-08-01" ? "espagne" : "angleterre", lucien: s.date >= "1804-04-01" ? "naples" : "france", elisa: s.date >= "1805-03-01" ? "italie" : "france" };
  if (fix[id]) return fix[id];
  const c = s.corps.find(x => x.marshal === id); if (c) return c.loc;
  if (id === "berthier" && P(s) >= 1) return N.where(s);
  const th = Object.entries(s.thrones || {}).find(([k, who]) => who === id || (id === "caroline" && who === "murat")); if (th) return th[0];
  if (id === "eugene" && s.date >= "1805-06-01") return "italie";
  if (id === "josephine" && s.rank === "general" && s.date < "1796-07-01") return "france";
  return "france";
};
/* Délai d’un courrier, en jours, selon la distance */
N.mailDays = (s, id) => { const a = N.where(s), b = N.contactLoc(s, id); if (a === b) return 0; if (a === "sainte-helene" || a === "amerique") return 70; if (a === "elbe") return 8; const seaB = REG(b) && REG(b).sea, seaA = REG(a) && REG(a).sea; if (seaA || seaB) return a === "egypte" || b === "egypte" ? 40 : 9; return Math.max(3, N.path(a, b) * 4); };
N.mailScripts = [
  { id: "josephine", t: "Mon ami, la Malmaison est bien vide sans toi. Les fournisseurs me pressent encore ; ne te fâche pas, je t’en prie, et écris-moi." }, { id: "letizia", t: "Mon fils, tes frères dépensent sans compter. Mets de l’argent de côté : rien ne dure, et il faudra peut-être un jour donner du pain à tous ces rois." },
  { id: "talleyrand", t: "Il me revient de plusieurs cours que l’on s’inquiète de nos accroissements. Un geste de modération, placé à propos, vaudrait une armée." }, { id: "fouche", t: "Rien de grave à Paris. Quelques bavards dans les salons du faubourg Saint-Germain ; je les fais suivre. Souhaitez-vous que j’aille plus loin ?" },
  { id: "berthier", t: "Les états de situation sont à jour. Plusieurs corps manquent de souliers et de fourgons ; je sollicite vos ordres pour les magasins." }, { id: "murat", t: "La cavalerie brûle de se signaler. J’ose rappeler à Votre Majesté les promesses faites à sa sœur et à moi." },
  { id: "joseph", t: "Mon cher frère, on m’obéit mal ici et l’on me compare à toi. Laisse-moi gouverner à ma manière, avec douceur." }, { id: "cambaceres", t: "Le Conseil a expédié les affaires courantes. Les notables approuvent l’ordre, mais trouvent l’impôt lourd ; je crois devoir vous le dire." },
  { id: "davout", t: "Mon corps est en ordre. Discipline rétablie, maraudeurs punis. J’attends vos instructions." }, { id: "pauline", t: "Tu ne m’écris plus ! Dis-moi que tu te portes bien et que tu penses un peu à ta sœur." }
];
N.mailFallback = (s, id) => { const v = s.rel[id] || 0; return v >= 40 ? "J’ai bien reçu votre lettre et j’y donnerai suite avec tout le zèle que vous me connaissez." : v >= -15 ? "Votre lettre m’est parvenue. Je prends note de ce que vous m’écrivez et vous répondrai plus au long." : "J’ai lu votre lettre. Vous comprendrez que je réserve ma réponse."; };
})();
</script>
