<script>
"use strict";
/* =====================================================================
   NAPOLÉON — systèmes de la version 2 : carte, corps d’armée, politiques,
   panneaux de gestion, types de parole, conseillers, rivaux, budget.
   Tout est décrit en données ; le moteur et l’interface sont génériques.
   ===================================================================== */
(function(){
const N = CHARACTERS.napoleon;
const P = s => GAME.power(s);
const M = v => `${Math.round(v)} M F`;

/* ---------------- Carte de l’Europe (stylisée) ---------------- */
N.map = {
  title: "Europe", viewBox: "135 12 890 722",
  home: "france",
  regions: [
    { id: "france", name: "France", pts: "330,300 400,285 450,300 480,330 475,380 490,430 470,470 420,480 380,500 330,490 315,430 290,380 280,340", c: [390, 395], adj: ["espagne", "hollande", "allemagne", "suisse", "italie"] },
    { id: "angleterre", name: "Royaume-Uni", pts: "300,150 345,120 370,170 400,235 385,275 330,285 300,265 320,215 295,190", c: [345, 225], adj: [], sea: true },
    { id: "espagne", name: "Espagne", pts: "220,500 330,495 380,505 390,540 350,600 300,640 240,640 215,590", c: [300, 565], adj: ["france", "portugal"] },
    { id: "portugal", name: "Portugal", pts: "175,520 218,503 213,590 238,642 185,640 170,580", c: [194, 580], adj: ["espagne"] },
    { id: "hollande", name: "Hollande et Belgique", pts: "405,282 430,245 475,235 480,280 452,297", c: [450, 268], adj: ["france", "allemagne"] },
    { id: "allemagne", name: "États allemands", pts: "480,250 560,240 583,300 572,362 520,380 482,372 487,330 455,300 482,282", c: [525, 315], adj: ["france", "hollande", "prusse", "autriche", "suisse", "danemark"] },
    { id: "danemark", name: "Danemark", pts: "500,170 530,165 540,225 505,235", c: [520, 200], adj: ["allemagne"] },
    { id: "prusse", name: "Prusse", pts: "562,238 700,215 722,260 662,300 586,300", c: [640, 262], adj: ["allemagne", "autriche", "pologne"] },
    { id: "pologne", name: "Pologne", pts: "665,302 725,263 792,282 792,352 702,372 662,347", c: [730, 320], adj: ["prusse", "autriche", "russie"] },
    { id: "autriche", name: "Autriche", pts: "577,364 587,304 660,305 658,349 700,375 792,356 802,420 722,452 642,442 582,420", c: [680, 405], adj: ["allemagne", "prusse", "pologne", "italie", "suisse", "ottoman"] },
    { id: "suisse", name: "Suisse", pts: "482,376 520,384 572,366 578,400 496,412", c: [530, 393], adj: ["france", "allemagne", "autriche", "italie"] },
    { id: "italie", name: "Italie du Nord", pts: "478,440 496,415 578,404 600,432 592,472 545,482 500,462", c: [540, 445], adj: ["france", "suisse", "autriche", "naples"] },
    { id: "naples", name: "Rome et Naples", pts: "547,486 592,476 642,540 682,592 652,612 620,570 580,542", c: [612, 545], adj: ["italie"] },
    { id: "russie", name: "Russie", pts: "730,110 1010,90 1010,420 806,416 796,282 728,258 705,215", c: [890, 250], adj: ["pologne", "ottoman", "suede"] },
    { id: "suede", name: "Suède", pts: "520,40 620,30 660,110 600,170 560,150 540,100", c: [590, 95], adj: ["russie"] },
    { id: "ottoman", name: "Empire ottoman", pts: "646,446 722,456 802,425 885,440 902,520 822,560 762,602 702,560 662,500", c: [780, 505], adj: ["autriche", "russie", "egypte"] },
    { id: "egypte", name: "Égypte", pts: "770,655 905,648 912,722 765,722", c: [838, 690], adj: ["ottoman"], sea: true }
  ],
  statusLabel: { home: "Territoire français", guerre: "En guerre", paix: "En paix", allie: "Allié", vassal: "État vassal", occupe: "Occupé", annexe: "Annexé" },
  status(s, id){ return id === "france" ? "home" : (s.pays[id] ? s.pays[id].statut : "paix"); },
  markers(s){ return s.corps.map((c, i) => ({ id: c.id, region: c.dest || c.loc, moving: !!c.dest, label: String(i + 1), title: `${c.name} — ${N.marshalName(c.marshal)} — ${Math.round(c.men)} 000 h.` })); }
};
const REG = id => N.map.regions.find(r => r.id === id);
N.regionName = id => (REG(id) || { name: id }).name;
/* Distance en étapes entre deux régions (les îles ne sont atteintes que par mer) */
N.path = (a, b) => { if (a === b) return 0; const seen = { [a]: 0 }; const q = [a]; while (q.length) { const x = q.shift(); for (const y of (REG(x)?.adj || [])) if (!(y in seen)) { seen[y] = seen[x] + 1; if (y === b) return seen[y]; q.push(y); } } return 9; };

/* ---------------- Maréchaux et généraux ---------------- */
N.marshals = [
  { id: "massena", name: "Masséna", skill: 1.2, from: "1796", until: "1814" }, { id: "augereau", name: "Augereau", skill: 1.0, from: "1796", until: "1814" },
  { id: "serurier", name: "Sérurier", skill: .95, from: "1796", until: "1799" }, { id: "kleber", name: "Kléber", skill: 1.15, from: "1796", until: "1800-06" },
  { id: "desaix", name: "Desaix", skill: 1.2, from: "1796", until: "1800-06" }, { id: "moreau", name: "Moreau", skill: 1.15, from: "1796", until: "1804" },
  { id: "brune", name: "Brune", skill: .9, from: "1796", until: "1807" }, { id: "lannes", name: "Lannes", skill: 1.2, from: "1797", until: "1809-05" },
  { id: "murat", name: "Murat", skill: 1.1, from: "1796", until: "1815-10", rel: "murat" }, { id: "davout", name: "Davout", skill: 1.3, from: "1798", until: "1823", rel: "davout" },
  { id: "bernadotte", name: "Bernadotte", skill: 1.0, from: "1798", until: "1810-08" }, { id: "soult", name: "Soult", skill: 1.15, from: "1800", until: "1830" },
  { id: "ney", name: "Ney", skill: 1.1, from: "1801", until: "1815-12", rel: "ney" }, { id: "marmont", name: "Marmont", skill: 1.05, from: "1800", until: "1814-04" },
  { id: "mortier", name: "Mortier", skill: 1.0, from: "1804", until: "1830" }, { id: "bessieres", name: "Bessières", skill: 1.05, from: "1804", until: "1813-05" },
  { id: "oudinot", name: "Oudinot", skill: 1.0, from: "1805", until: "1830" }, { id: "eugene", name: "Eugène de Beauharnais", skill: 1.05, from: "1805", until: "1824" },
  { id: "poniatowski", name: "Poniatowski", skill: 1.05, from: "1807", until: "1813-10" }, { id: "suchet", name: "Suchet", skill: 1.2, from: "1808", until: "1826" },
  { id: "gouvion", name: "Gouvion-Saint-Cyr", skill: 1.1, from: "1808", until: "1830" }, { id: "macdonald", name: "Macdonald", skill: 1.0, from: "1809", until: "1830" },
  { id: "grouchy", name: "Grouchy", skill: .95, from: "1809", until: "1830" }, { id: "drouot", name: "Drouot", skill: 1.05, from: "1813", until: "1830" }
];
N.marshal = id => N.marshals.find(m => m.id === id) || { id, name: "un général de division", skill: .9 };
N.marshalName = id => N.marshal(id).name;
N.marshalsFree = s => N.marshals.filter(m => m.from <= s.date && s.date < m.until && (!m.rel || GAME.relAlive(s, m.rel)) && !s.corps.some(c => c.marshal === m.id));

/* ---------------- Situations de départ : corps, pays, politiques ---------------- */
const C = (name, marshal, men, loc, moral = 60, supply = 60) => ({ name, marshal, men, loc, moral, supply });
const pays = (o) => { const base = {}; for (const r of N.map.regions) if (r.id !== "france") base[r.id] = { statut: "paix", rel: 0, armee: 30, ws: 0 }; for (const [k, v] of Object.entries(o)) Object.assign(base[k], v); return base; };
N.presets = {
  "1796": { corps: [C("Division Masséna", "massena", 14, "france", 35, 30), C("Division Augereau", "augereau", 12, "france", 35, 30), C("Division Sérurier", "serurier", 12, "france", 35, 30)], depot: 0,
    pays: pays({ angleterre: { statut: "guerre", rel: -60, armee: 60 }, autriche: { statut: "guerre", rel: -50, armee: 220 }, italie: { statut: "guerre", rel: -30, armee: 60 }, naples: { statut: "guerre", rel: -30, armee: 30 }, portugal: { statut: "guerre", rel: -30, armee: 25 }, allemagne: { statut: "guerre", rel: -20, armee: 80 }, hollande: { statut: "vassal", rel: 20, armee: 15 }, espagne: { rel: 10, armee: 90 }, prusse: { rel: 5, armee: 180 }, russie: { rel: -15, armee: 300 }, ottoman: { rel: 5, armee: 150 }, suede: { armee: 40 }, danemark: { armee: 25 }, pologne: { armee: 0, rel: 30 }, suisse: { armee: 10 }, egypte: { armee: 25, rel: 0 } }) },
  "1799": { corps: [C("Armée du Rhin", "moreau", 100, "allemagne"), C("Armée d’Italie", "massena", 45, "italie", 45, 40), C("Armée de Hollande", "brune", 40, "hollande"), C("Armée de réserve", "lannes", 45, "france")], depot: 70,
    pays: pays({ angleterre: { statut: "guerre", rel: -65, armee: 80 }, autriche: { statut: "guerre", rel: -55, armee: 250 }, russie: { statut: "guerre", rel: -45, armee: 320 }, naples: { statut: "guerre", rel: -40, armee: 30 }, ottoman: { statut: "guerre", rel: -40, armee: 150 }, portugal: { statut: "guerre", rel: -30, armee: 25 }, italie: { statut: "guerre", rel: -10, armee: 70 }, allemagne: { statut: "guerre", rel: -20, armee: 80 }, hollande: { statut: "vassal", rel: 20, armee: 15 }, suisse: { statut: "vassal", rel: 10, armee: 10 }, espagne: { statut: "allie", rel: 30, armee: 90 }, prusse: { rel: 5, armee: 190 }, suede: { armee: 40 }, danemark: { armee: 25 }, pologne: { armee: 0, rel: 30 }, egypte: { statut: "occupe", armee: 20 } }) },
  "1804": { corps: [C("IIIe corps", "davout", 70, "france", 75, 75), C("IVe corps", "soult", 80, "france", 75, 75), C("VIe corps", "ney", 60, "france", 72, 75), C("Ve corps", "lannes", 50, "france", 72, 75), C("Réserve de cavalerie", "murat", 40, "france", 74, 70), C("Armée d’Italie", "massena", 60, "italie", 65, 65)], depot: 90,
    pays: pays({ angleterre: { statut: "guerre", rel: -70, armee: 90 }, autriche: { rel: -25, armee: 260 }, russie: { rel: -30, armee: 330 }, prusse: { rel: 0, armee: 200 }, espagne: { statut: "allie", rel: 30, armee: 90 }, hollande: { statut: "vassal", rel: 15, armee: 15 }, suisse: { statut: "vassal", rel: 15, armee: 10 }, italie: { statut: "vassal", rel: 30, armee: 25 }, naples: { rel: -20, armee: 30 }, allemagne: { rel: 10, armee: 70 }, portugal: { rel: -15, armee: 25 }, ottoman: { rel: 5, armee: 150 }, suede: { rel: -15, armee: 40 }, danemark: { rel: 10, armee: 25 }, pologne: { armee: 0, rel: 40 }, egypte: { armee: 25 } }) },
  "1812": { corps: [C("Ier corps", "davout", 110, "pologne", 68, 65), C("IIIe corps", "ney", 70, "pologne", 66, 62), C("IVe corps", "eugene", 80, "pologne", 62, 60), C("Réserve de cavalerie", "murat", 60, "pologne", 66, 55), C("IIe corps", "oudinot", 70, "prusse", 62, 60), C("Armée d’Espagne", "soult", 200, "espagne", 50, 45)], depot: 90,
    pays: pays({ angleterre: { statut: "guerre", rel: -75, armee: 110 }, espagne: { statut: "guerre", rel: -60, armee: 120 }, portugal: { statut: "guerre", rel: -50, armee: 60 }, autriche: { statut: "allie", rel: 15, armee: 250 }, prusse: { statut: "allie", rel: -25, armee: 80 }, danemark: { statut: "allie", rel: 20, armee: 25 }, allemagne: { statut: "vassal", rel: 15, armee: 90 }, italie: { statut: "vassal", rel: 30, armee: 40 }, naples: { statut: "vassal", rel: 20, armee: 40 }, pologne: { statut: "vassal", rel: 55, armee: 60 }, suisse: { statut: "vassal", rel: 15, armee: 12 }, hollande: { statut: "annexe", rel: -10, armee: 0 }, russie: { rel: -35, armee: 420 }, suede: { rel: -25, armee: 45 }, ottoman: { rel: 0, armee: 150 }, egypte: { armee: 25 } }) },
  "1815": { corps: [C("Ier corps", "drouot", 20, "france", 75, 60), C("IIe corps", "soult", 25, "france", 75, 60), C("IIIe corps", "ney", 18, "france", 75, 60), C("Garde impériale", "mortier", 21, "france", 88, 70), C("Réserve de cavalerie", "grouchy", 13, "france", 72, 60)], depot: 100 },
  "elbe": { corps: [C("Bataillon de l’île d’Elbe", "drouot", 1, "italie", 80, 70)], depot: 0 },
  "none": { corps: [], depot: 0 }
};
N.defaultPol = { conscription: 1, solde: 100, rav: 1, impots: 100, droits: 0, douanes: 1, contrib: 1, police: 1, espions: 0, censure: 1, propag: 1, blocus: 0, pain: 0, industrie: 0, travaux: 1 };
let cid = 0;
N.applyPreset = (s, key, withPays) => {
  const p = N.presets[key]; if (!p) return;
  s.corps = p.corps.map(c => ({ ...c, id: "c" + Date.now().toString(36) + (cid++), dest: null, eta: null }));
  s.depot = p.depot;
  if (withPays && p.pays) s.pays = JSON.parse(JSON.stringify(p.pays));
};
/* Appelé à la création d’une partie et lors de la migration d’une ancienne sauvegarde */
N.setup = (s, startId, keepArmy) => {
  const y = parseD(s.date).y; const key = startId && N.presets[startId] ? startId : y >= 1812 ? "1812" : y >= 1804 ? "1804" : y >= 1799 ? "1799" : "1796";
  const want = s.stats.armee;
  N.applyPreset(s, P(s) === 0 ? (s.rank === "elbe" ? "elbe" : "none") : key, false);
  s.pays = JSON.parse(JSON.stringify(N.presets[key].pays));
  s.pol = { ...N.defaultPol, ...(s.pol || {}) };
  if (key >= "1804") { s.pol.droits = 1; s.pol.censure = 2; } if (s.flags.blocus) s.pol.blocus = 2;
  s.laws = s.laws || {}; if (key >= "1804") Object.assign(s.laws, { prefets: "1800-02-17", banque: "1800-01-18", lycees: "1802-05-01", legion: "1802-05-19", code: "1804-03-21" }); if (key >= "1812") Object.assign(s.laws, { cadastre: "1807-09-15", universite: "1808-03-17", codepenal: "1810-02-12" });
  s.projects = s.projects || {}; s.posts = s.posts || { ext: y >= 1807 ? "champagny" : "talleyrand", police: y >= 1810 ? "savary" : "fouche", guerre: y >= 1807 ? "clarke" : "berthier", tresor: y >= 1806 ? "mollien" : "barbe" };
  s.thrones = s.thrones || (key === "1812" ? { espagne: "joseph", naples: "murat", allemagne: "jerome" } : {});
  s.dette = s.dette || 0; s.eco = s.eco || 100; s.wk = s.wk || {};
  s.rivals = s.rivals || {}; for (const r of N.rivals) if (!s.rivals[r.id]) s.rivals[r.id] = { plan: r.plans[0].plan, prog: Math.round(Math.random() * 30), i: 0 };
  if (keepArmy && want > 0) N.statHooks.armee.set(s, want);
  N.sync(s);
};

/* Jauges dérivées des corps d’armée */
N.sync = s => {
  const men = s.corps.reduce((t, c) => t + c.men, 0);
  s.stats.armee = clamp(men + s.depot, 0, 750);
  if (men > 0) s.stats.moral = clamp(s.corps.reduce((t, c) => t + c.moral * c.men, 0) / men, 0, 100);
  s.flags.atWar = Object.entries(s.pays).some(([k, p]) => p.statut === "guerre" && k !== "angleterre" && k !== "portugal" && k !== "egypte") || (P(s) === 1 && Object.values(s.pays).some(p => p.statut === "guerre"));
};
N.statHooks = {
  armee: {
    add(s, d){ if (d >= 0) { s.depot += d; return; } let loss = -d; const fromDepot = Math.min(s.depot, loss * .25); s.depot -= fromDepot; loss -= fromDepot; const tot = s.corps.reduce((t, c) => t + c.men, 0); if (tot <= 0) { s.depot = Math.max(0, s.depot - loss); return; } const k = Math.max(0, 1 - loss / tot); for (const c of s.corps) c.men *= k; },
    set(s, v){ const tot = s.corps.reduce((t, c) => t + c.men, 0) + s.depot; if (v <= 1.5) { N.applyPreset(s, v >= 1 ? "elbe" : "none"); return; } if (tot <= 0) { N.applyPreset(s, "1815"); return N.statHooks.armee.set(s, v); } const k = v / tot; for (const c of s.corps) c.men *= k; s.depot *= k; }
  },
  moral: { add(s, d){ for (const c of s.corps) c.moral = clamp(c.moral + d, 0, 100); if (!s.corps.length) s.stats.moral = clamp(s.stats.moral + d, 0, 100); }, set(s, v){ for (const c of s.corps) c.moral = v; s.stats.moral = v; } }
};

/* ---------------- Ministres ---------------- */
N.ministers = {
  ext: { label: "Relations extérieures", list: [["talleyrand", "Talleyrand", 1.3, "1797", "talleyrand"], ["champagny", "Champagny", 1.0, "1804"], ["maret", "Maret, duc de Bassano", .95, "1800"], ["caulaincourt", "Caulaincourt", 1.15, "1807"]] },
  police: { label: "Police générale", list: [["fouche", "Fouché", 1.35, "1799", "fouche"], ["savary", "Savary", 1.0, "1802"], ["regnier", "Régnier", .85, "1799"]] },
  guerre: { label: "Guerre", list: [["berthier", "Berthier", 1.2, "1796", "berthier"], ["clarke", "Clarke", 1.0, "1800"], ["carnot", "Carnot", 1.15, "1796"]] },
  tresor: { label: "Trésor", list: [["barbe", "Barbé-Marbois", .95, "1799"], ["mollien", "Mollien", 1.15, "1800"], ["gaudin", "Gaudin", 1.1, "1799"]] }
};
N.minister = (s, post) => { const m = N.ministers[post].list.find(x => x[0] === s.posts[post]); if (!m) return 1; if (m[4] && !GAME.relAlive(s, m[4])) return .9; return m[2]; };

/* ---------------- Lois et grands travaux ---------------- */
N.laws = [
  { id: "prefets", label: "Créer les préfets", year: 1800, cost: 10, note: "Un représentant de l’État par département. Impôts mieux perçus.", fx: { s: { popularite: 2 }, c: { reforms: 1 } } },
  { id: "banque", label: "Fonder la Banque de France", year: 1800, cost: 20, note: "Crédit de l’État et monnaie stabilisés.", fx: { c: { reforms: 1 } } },
  { id: "lycees", label: "Créer les lycées", year: 1802, cost: 25, note: "Former les cadres civils et militaires.", fx: { s: { popularite: 3 }, c: { reforms: 1 } } },
  { id: "legion", label: "Instituer la Légion d’honneur", year: 1802, cost: 10, note: "Récompenser le mérite civil et militaire.", fx: { s: { loyaute: 6, moral: 4 } } },
  { id: "code", label: "Promulguer le Code civil", year: 1801, cost: 5, note: "Égalité civile, propriété, mariage civil.", fx: { s: { popularite: 8, complot: -4 }, f: { codeCivil: true }, c: { reforms: 1 } }, done: "code" },
  { id: "livret", label: "Imposer le livret ouvrier", year: 1803, cost: 3, note: "Contrôle de la main-d’œuvre : patrons satisfaits, ouvriers moins.", fx: { s: { popularite: -2, complot: -2 } } },
  { id: "prudhommes", label: "Créer les conseils de prud’hommes", year: 1806, cost: 4, note: "Arbitrage des conflits du travail.", fx: { s: { popularite: 2 } } },
  { id: "cadastre", label: "Lancer le cadastre général", year: 1807, cost: 30, note: "Impôt foncier mieux réparti.", fx: { c: { reforms: 1 } } },
  { id: "universite", label: "Fonder l’Université impériale", year: 1808, cost: 20, note: "Monopole d’État sur l’enseignement.", fx: { s: { popularite: 1 }, r: { pie7: -6 }, c: { reforms: 1 } } },
  { id: "codepenal", label: "Promulguer le Code pénal", year: 1810, cost: 5, note: "Peines fixes, répression des complots.", fx: { s: { complot: -5, popularite: -1 } } }
];
N.works = [
  { id: "ourcq", label: "Canal de l’Ourcq", year: 1802, cost: 40, weeks: 110, note: "Eau potable pour Paris.", fx: { s: { popularite: 5 } } },
  { id: "simplon", label: "Route du Simplon", year: 1800, cost: 50, weeks: 130, note: "L’artillerie passe les Alpes en toute saison.", fx: { s: { popularite: 2, moral: 3 }, f: { simplon: true }, c: { reforms: 1 } } },
  { id: "rivoli", label: "Rue de Rivoli et quais de Paris", year: 1802, cost: 45, weeks: 120, note: "Paris embelli, ouvriers occupés.", fx: { s: { popularite: 5, complot: -2 } } },
  { id: "stquentin", label: "Canal de Saint-Quentin", year: 1802, cost: 35, weeks: 140, note: "Relie l’Escaut à la Seine.", fx: { s: { popularite: 2 }, eco: 4 } },
  { id: "vendome", label: "Colonne Vendôme", year: 1806, cost: 15, weeks: 80, note: "Fondue avec le bronze des canons pris à l’ennemi.", fx: { s: { popularite: 4, moral: 4 } } },
  { id: "arc", label: "Arc de triomphe de l’Étoile", year: 1806, cost: 40, weeks: 260, note: "À la gloire des armées.", fx: { s: { popularite: 5, loyaute: 4 } } },
  { id: "bourse", label: "Palais de la Bourse", year: 1807, cost: 25, weeks: 150, note: "Un temple pour le commerce.", fx: { s: { popularite: 1 }, eco: 3 } },
  { id: "anvers", label: "Arsenal d’Anvers et rade de Cherbourg", year: 1803, cost: 80, weeks: 200, note: "Reconstruire une marine.", fx: { s: { coalition: 4 }, f: { navy: true }, pays: { angleterre: { rel: -10 } } } },
  { id: "routes", label: "Routes impériales", year: 1804, cost: 60, weeks: 180, note: "Armées et marchandises circulent plus vite.", fx: { s: { popularite: 2 }, eco: 5 } },
  { id: "betterave", label: "Sucre de betterave", year: 1811, cost: 20, weeks: 60, note: "Remplacer le sucre de canne des colonies.", fx: { s: { popularite: 3 }, eco: 3 } }
];
N.thrones = [
  { pays: "naples", who: [["joseph", "Joseph Bonaparte"], ["murat", "Joachim Murat"]] }, { pays: "hollande", who: [["louis", "Louis Bonaparte"]] },
  { pays: "allemagne", who: [["jerome", "Jérôme Bonaparte (Westphalie)"]] }, { pays: "espagne", who: [["joseph", "Joseph Bonaparte"], ["murat", "Joachim Murat"]] },
  { pays: "italie", who: [["eugene", "Eugène de Beauharnais (vice-roi)"]] }
];

/* ---------------- Budget mensuel : sert au calcul et à l’affichage ---------------- */
N.budget = s => {
  const st = s.stats, p = s.pol, r = N.ranks[s.rank] || { income: 0 }, pw = P(s), L = s.laws;
  const rec = [], dep = [];
  if (pw === 0) { rec.push(["Pension et revenus de l’exil", s.rank === "prisonnier" ? .2 : .6]); dep.push(["Maison et domestiques", s.rank === "prisonnier" ? .2 : .5]); }
  else {
    const mult = (1 + (L.prefets ? .03 : 0) + (L.cadastre ? .04 : 0) + (L.banque ? .02 : 0)) * (s.eco / 100) * (pw >= 2 ? N.minister(s, "tresor") : 1);
    const vassaux = Object.values(s.pays).filter(x => x.statut === "vassal" || x.statut === "occupe").length;
    rec.push([pw >= 2 ? "Impôts directs" : "Caisse de l’armée", st.departements * .55 * (.7 + st.popularite / 200) * r.income * (p.impots / 100) * mult]);
    if (pw >= 2) { rec.push(["Droits réunis", [0, 6, 11][p.droits]]); rec.push(["Douanes" + (p.blocus === 1 ? " et licences" : ""), [2, 5, 8][p.douanes] * (p.blocus === 2 ? .35 : p.blocus === 1 ? 1.4 : 1)]); }
    rec.push(["Contributions des pays soumis", p.contrib * (pw >= 2 ? vassaux * 1.4 : vassaux * 3)]);
    dep.push(["Solde et entretien", st.armee * (pw >= 2 ? .085 : .02) * (p.solde / 100)]);
    if (s.flags.atWar) dep.push(["Dépenses de campagne", st.armee * (pw >= 2 ? .035 : .01)]);
    dep.push(["Ravitaillement", st.armee * .012 * [.6, 1, 1.5][p.rav] * (pw >= 2 ? 1 : .3)]);
    if (pw >= 2) {
      dep.push(["Police" + (p.espions ? " et espions" : ""), [0, 3, 7, 12][p.police] + (p.espions ? 4 : 0)]); dep.push(["Presse et propagande", [0, 2, 5, 9][p.propag]]);
      if (p.pain) dep.push(["Prix du pain", 3]); if (p.industrie) dep.push(["Aides à l’industrie", [0, 4, 8][p.industrie]]);
      const tr = N.works.filter(w => s.projects[w.id] && s.projects[w.id].left > 0).reduce((t, w) => t + w.cost / w.weeks * 4.35 * [.5, 1, 1.6][p.travaux], 0); if (tr) dep.push(["Grands travaux", tr]);
      if (s.dette > 0) dep.push(["Intérêts de la dette", s.dette * .005]);
      if (s.rank === "empereur") dep.push(["Maison de l’Empereur", 3]);
    }
  }
  const R = rec.reduce((t, x) => t + x[1], 0), D = dep.reduce((t, x) => t + x[1], 0);
  return { rec, dep, R, D, solde: R - D };
};

/* ---------------- Simulation hebdomadaire (les taux sont mensuels, le moteur applique la fraction de mois) ---------------- */
N.tick = function(s, h){
  const st = s.stats, f = s.flags, p = s.pol, pw = P(s), age = h.age, out = [];
  const b = N.budget(s); h.add("tresor", b.solde);
  if (st.tresor < 0) { h.add("popularite", -1.2); h.add("loyaute", -1); h.add("moral", -1.5); if (h.chance(.15)) { s.dette += 40; st.tresor += 36; out.push({ t: "Le Trésor est à sec : un emprunt forcé de 40 millions est contracté.", tone: "bad" }); } }
  // Recrutement et corps d’armée
  if (pw >= 1) {
    const rec = [0, 4, 8, 14, 24][p.conscription] * (pw >= 2 ? 1 : .12) * Math.min(1, st.departements / 100) * (pw >= 2 ? N.minister(s, "guerre") : 1);
    s.depot += rec * h.dt; h.add("popularite", [.3, 0, -.4, -1, -2.2][p.conscription] * (pw >= 2 ? 1 : .2));
    s.depot = Math.max(0, s.depot * (1 - .003 * h.dt));
  }
  const ravT = [40, 65, 88][p.rav], moralT = 58 + (p.solde - 100) * .5 + (s.laws.legion ? 3 : 0);
  for (const c of s.corps) {
    if (c.dest && s.date >= c.eta) { c.loc = c.dest; c.dest = null; c.eta = null; out.push({ t: `${c.name} (${N.marshalName(c.marshal)}) est arrivé : ${N.regionName(c.loc)}.` }); }
    const stat = N.map.status(s, c.loc);
    let fac = stat === "home" || stat === "annexe" ? 1 : stat === "vassal" || stat === "allie" ? .85 : .6;
    if (c.loc === "espagne") fac = .55; if (c.loc === "egypte") fac = .5;
    const winter = [10, 11, 0, 1, 2].includes(h.month);
    if (c.loc === "russie") { fac = winter ? .15 : .35; c.men *= 1 - (winter ? .12 : .045) * h.dt; c.moral = clamp(c.moral - (winter ? 4 : 1.5) * h.dt, 0, 100); }
    if (c.loc === "espagne" && s.pays.espagne.statut === "guerre") { c.men *= 1 - .012 * h.dt; c.moral = clamp(c.moral - .5 * h.dt, 0, 100); }
    c.supply = clamp(c.supply + (ravT * fac - c.supply) * .3 * h.dt, 0, 100);
    if (c.supply < 35) { c.men *= 1 - .018 * h.dt; c.moral = clamp(c.moral - 3 * h.dt, 0, 100); }
    c.men *= 1 - .003 * h.dt;
    c.moral = clamp(c.moral + (moralT - c.moral) * .05 * h.dt, 0, 100);
    const m = N.marshal(c.marshal); if (m.until && s.date >= m.until && m.id !== "?") { out.push({ t: `${m.name} n’est plus disponible ; ${c.name} passe à un général de division.`, tone: "bad" }); c.marshal = "?"; }
  }
  if (s.corps.some(c => c.loc === "russie")) { h.add("fatigue", 3); if (h.chance(.03)) h.condition("typhus", "Typhus", 2.5); }
  if (s.pays.espagne.statut === "guerre" && s.corps.some(c => c.loc === "espagne")) h.add("popularite", -.15);
  // Opinion, cour, complots
  h.drift("popularite", 50 + (pw >= 2 ? [0, .8, 1.6, 2.4][p.propag] * 2.5 - (p.impots - 100) * .35 - [0, 1.5, 3][p.droits] + (p.pain ? 2.5 : 0) - [0, 1, 3][p.blocus] : 0), .018);
  h.drift("loyaute", 55, .02);
  if (pw >= 2) {
    if (f.atWar) { h.add("popularite", -.25); h.add("coalition", st.departements > 115 ? .5 : .15); } else h.drift("coalition", 30, .03);
    h.add("coalition", p.contrib * .12 - .12);
    let c = (50 - st.popularite) * .02 + (50 - st.loyaute) * .02 - .25 + p.censure * .1 - [0, .5, 1.1, 1.8][p.police] * N.minister(s, "police");
    if (s.rank === "empereur" && !GAME.hasHeir(s)) c += .35;
    for (const rel of N.relations) if (rel.plotter && GAME.relAlive(s, rel.id)) c += Math.max(0, -s.rel[rel.id]) / 220;
    h.add("complot", c); h.add("popularite", -[0, .03, .15, .4][p.police]);
    // Économie et Blocus
    s.eco = clamp(s.eco + ((100 + [0, 6, 12][p.industrie] - [0, 2, 9][p.blocus] + (p.douanes === 2 ? -2 : 0)) - s.eco) * .03 * h.dt, 70, 135);
    if (p.blocus) { const a = s.pays.angleterre; a.pression = clamp((a.pression || 0) + [0, .5, 1.1][p.blocus] * h.dt * (f.navy ? 1.2 : 1), 0, 100); for (const k of ["russie", "hollande", "allemagne", "suede", "portugal"]) if (s.pays[k].statut !== "guerre") s.pays[k].rel = clamp(s.pays[k].rel - [0, .15, .45][p.blocus] * h.dt, -100, 100); }
    // Grands travaux
    for (const w of N.works) { const pr = s.projects[w.id]; if (pr && pr.left > 0) { pr.left -= [.5, 1, 1.6][p.travaux] * h.dt * 4.35; if (pr.left <= 0) { pr.left = 0; pr.done = s.date; h.fx(w.fx); if (w.fx.eco) s.eco = clamp(s.eco + w.fx.eco, 70, 135); out.push({ t: `Grands travaux : ${w.label} achevé.`, tone: "good", src: "Le Moniteur universel" }); } } }
  } else { h.drift("complot", 5, .05); if (pw === 1) h.drift("coalition", 55, .01); }
  // Pays : usure de la guerre, vassaux pressurés
  for (const [k, c] of Object.entries(s.pays)) {
    if (c.statut === "guerre") c.ws = clamp((c.ws || 0) - .6 * h.dt, -100, 100);
    if (c.statut === "vassal" || c.statut === "occupe") c.rel = clamp(c.rel - (p.contrib - 1) * .5 * h.dt, -100, 100);
    if (c.statut !== "guerre" && k !== "pologne") c.armee = Math.min(c.armeeMax || (c.armeeMax = Math.max(c.armee, 20)), c.armee + c.armeeMax * .01 * h.dt);
  }
  // Corps du personnage
  h.add("fatigue", f.atWar && pw >= 1 ? 1.2 : -2.5);
  h.add("stress", (st.coalition + st.complot) / 110 - 1.6 + (st.tresor < 0 ? .8 : 0));
  let dS = 0; if (st.fatigue > 70) dS -= .8; if (st.stress > 70) dS -= .8; if (age > 40) dS -= (age - 40) * .035; if (st.fatigue < 45 && st.stress < 55) dS += .7;
  h.add("sante", dS);
  if (f.stHelena) { h.add("sante", -.5); h.add("stress", .6); }
  if (age >= 44 && !h.hasCondition("cancer") && h.chance(.0016 * (1 + st.stress / 40) * (f.stHelena ? 4 : 1))) { h.condition("cancer", "Ulcère, puis cancer de l’estomac", .9); out.push({ t: "Douleurs violentes au côté droit. Le médecin parle d’une affection de l’estomac, comme celle qui emporta votre père.", tone: "bad" }); }
  if (st.stress > 80 && !h.hasCondition("ulcere") && h.chance(.02)) h.condition("ulcere", "Troubles digestifs chroniques", .4);
  if (age > 38 && !h.hasCondition("vessie") && h.chance(.004)) h.condition("vessie", "Dysurie (troubles urinaires)", .06);
  return out;
};
N.plotHazard = s => P(s) >= 2 ? Math.pow(s.stats.complot / 100, 3) * .028 : Math.pow(s.stats.complot / 100, 3) * .006;
N.plotCause = s => s.rank === "empereur" ? "Assassiné lors d’une conjuration de palais." : "Assassiné par des conjurés royalistes.";

/* Offensive ennemie : un pays en guerre peut marcher sur vous */
N.enemyMove = s => {
  if (P(s) < 1) return null;
  const foes = Object.entries(s.pays).filter(([k, c]) => c.statut === "guerre" && c.armee >= 35 && !REG(k).sea && k !== "portugal" && k !== "espagne");
  const field = Math.max(20, s.corps.reduce((t, c) => t + c.men, 0) * (P(s) >= 2 ? .5 : 1.2));
  if (!foes.length || Math.random() > .022) return null;
  const [k, c] = foes[Math.floor(Math.random() * foes.length)];
  const targets = ["france", ...Object.keys(s.pays).filter(x => ["vassal", "annexe", "occupe", "allie"].includes(s.pays[x].statut))].filter(t => REG(k).adj.includes(t));
  if (!targets.length) return null;
  const t = targets[Math.floor(Math.random() * targets.length)];
  return { id: "off-" + k + "-" + s.week, title: `Offensive ennemie : ${N.regionName(k)}`, place: N.regionName(t), scene: "bataille", people: [], region: t,
    text: `Une armée venue de ${N.regionName(k)}, forte d’environ ${Math.round(Math.min(c.armee * .45, field))} 000 hommes, marche sur ${N.regionName(t)}. Vos avant-postes se replient. Il faut décider avant qu’elle ne coupe vos communications.`,
    choices: [
      { t: "Concentrer les corps disponibles et livrer bataille", res: "Vous marchez à l’ennemi.", battle: { name: N.regionName(t), base: .55, need: Math.round(Math.min(c.armee * .45, field)), foe: k, win: { s: { popularite: 5 }, pays: { [k]: { ws: 30, armee: -Math.round(c.armee * .25) } }, txt: "L’ennemi repasse la frontière." }, loss: { s: { popularite: -6, departements: t === "france" ? -3 : -1 }, pays: { [k]: { ws: -25 } }, txt: "L’ennemi s’installe sur vos terres." } } },
      { t: "Céder du terrain et gagner du temps", res: "Vous reculez en bon ordre. Le pays ravagé gronde.", fx: { s: { popularite: -5, departements: t === "france" ? -2 : 0, moral: -4 }, pays: { [k]: { ws: -15 } } } },
      { t: "Envoyer un émissaire proposer un armistice", res: "L’ennemi écoute, sans arrêter sa marche.", fx: { s: { tresor: -15, moral: -2 }, pays: { [k]: { rel: 6, ws: -5 } } } }
    ] };
};

/* ---------------- Actions des panneaux ---------------- */
const once = (s, id) => s.wk[id] === s.week ? "Déjà fait cette semaine" : false;
const pay = (s, n) => s.stats.tresor < n ? `Il faut ${M(n)}` : false;
const useOnce = (s, id) => { s.wk[id] = s.week; };
N.act = (s, act, arg, val) => {
  const st = s.stats; const fx = o => GAME.applyFx(s, o);
  const corps = () => s.corps.find(c => c.id === arg);
  switch (act) {
    case "pol": s.pol[arg] = +val; if (arg === "blocus" && +val > 0 && !s.flags.blocus) s.pol.blocus = 0; return {};
    case "corps_marshal": { const c = corps(); if (c) c.marshal = val; return { msg: `${c.name} : commandement confié à ${N.marshalName(val)}.` }; }
    case "corps_plus": { const c = corps(); const n = Math.min(10, s.depot); if (n < 1) return { msg: "Les dépôts sont vides.", tone: "bad" }; c.men += n; s.depot -= n; c.moral = clamp(c.moral - 2, 0, 100); return {}; }
    case "corps_minus": { const c = corps(); const n = Math.min(10, c.men - 2); if (n <= 0) return {}; c.men -= n; s.depot += n; return {}; }
    case "corps_move": { const c = corps(); if (!c || val === c.loc) { if (c) { c.dest = null; c.eta = null; } return {}; } const why = N.canEnter(s, val); if (why) return { msg: why, tone: "bad" }; const d = N.path(c.loc, val); c.dest = val; c.eta = addDays(s.date, (REG(val).sea || REG(c.loc).sea ? 6 : d * 2) * 7); return { msg: `${c.name} se met en marche vers ${N.regionName(val)} (arrivée vers le ${frDate(c.eta)}).`, sfx: "drum" }; }
    case "corps_new": { if (s.corps.length >= 6) return { msg: "Six corps au maximum.", tone: "bad" }; if (s.depot < 15) return { msg: "Il faut 15 000 hommes aux dépôts.", tone: "bad" }; const free = N.marshalsFree(s)[0]; s.depot -= 15; s.corps.push({ id: "c" + Date.now().toString(36), name: `Corps de ${free ? free.name : "réserve"}`, marshal: free ? free.id : "?", men: 15, moral: 50, supply: 55, loc: "france", dest: null, eta: null }); return { msg: "Un nouveau corps est formé en France.", sfx: "drum" }; }
    case "corps_del": { if (s.corps.length <= 3) return { msg: "Il faut garder au moins trois corps.", tone: "bad" }; const c = corps(); s.depot += c.men; s.corps = s.corps.filter(x => x !== c); return { msg: `${c.name} est dissous ; ses hommes rejoignent les dépôts.` }; }
    case "offensive": return { battle: N.offensive(s, arg) };
    case "law": { const l = N.laws.find(x => x.id === arg); st.tresor -= l.cost; s.laws[l.id] = s.date; if (l.done) s.done[l.done] = s.done[l.done] || "panel"; fx(l.fx); return { msg: `${l.label} : la mesure est promulguée.`, tone: "good", src: "Le Moniteur universel", sfx: "paper" }; }
    case "work": { const w = N.works.find(x => x.id === arg); s.projects[w.id] = { left: w.weeks, start: s.date }; return { msg: `Grands travaux : le chantier « ${w.label} » est ouvert.`, src: "Le Moniteur universel", sfx: "paper" }; }
    case "emprunt": s.dette += 110; st.tresor += 100; fx({ s: { popularite: -1 } }); return { msg: "Emprunt de 100 millions souscrit auprès des banquiers ; 110 à rembourser." };
    case "rembourser": { const n = Math.min(100, s.dette); st.tresor -= n; s.dette -= n; return { msg: `${M(n)} de dette remboursés.` }; }
    case "biens": useOnce(s, "biens" + parseD(s.date).y); fx({ s: { tresor: 40, popularite: -1 } }); return { msg: "Vente de domaines nationaux : 40 millions encaissés." };
    case "ambassade": { const c = s.pays[arg]; st.tresor -= 8; useOnce(s, "amb" + arg); const g = Math.round((4 + Math.random() * 5) * N.minister(s, "ext")); c.rel = clamp(c.rel + g, -100, 100); return { msg: `Ambassade auprès de ${N.regionName(arg)} : relations ${g > 0 ? "+" : ""}${g}.` }; }
    case "paix": { const c = s.pays[arg]; useOnce(s, "paix" + arg); const pr = clamp(.12 + (c.ws || 0) / 90 + c.rel / 250 + (N.minister(s, "ext") - 1) * .3 + (arg === "angleterre" ? (c.pression || 0) / 250 - .15 : 0), .02, .95);
      if (Math.random() < pr) { const ind = Math.max(0, Math.round((c.ws || 0) * 1.2)); c.statut = "paix"; c.rel = clamp(c.rel + 20, -100, 100); c.ws = 0; s.counters.treaties++; fx({ s: { tresor: ind, coalition: -10, popularite: 5 } }); N.sync(s); return { msg: `Paix signée avec ${N.regionName(arg)}${ind ? ` ; indemnité de ${M(ind)}` : ""}.`, tone: "good", src: "Le Moniteur universel", sfx: "crowd" }; }
      c.rel = clamp(c.rel - 3, -100, 100); return { msg: `${N.regionName(arg)} repousse vos ouvertures de paix.`, tone: "bad" }; }
    case "alliance": { const c = s.pays[arg]; useOnce(s, "all" + arg); if (Math.random() < clamp((c.rel - 20) / 60, .05, .9)) { c.statut = "allie"; fx({ s: { coalition: -6 } }); return { msg: `Traité d’alliance signé avec ${N.regionName(arg)}.`, tone: "good", src: "Le Moniteur universel" }; } return { msg: `${N.regionName(arg)} décline l’alliance pour le moment.` }; }
    case "guerre": { const c = s.pays[arg]; c.statut = "guerre"; c.rel = clamp(c.rel - 40, -100, 100); c.ws = 0; fx({ s: { coalition: 8, popularite: -3 } }); N.sync(s); return { msg: `La guerre est déclarée : ${N.regionName(arg)}.`, tone: "bad", src: "Le Moniteur universel", sfx: "cannon" }; }
    case "tribut": { const c = s.pays[arg]; useOnce(s, "trib" + arg + parseD(s.date).y); c.rel = clamp(c.rel - 15, -100, 100); fx({ s: { tresor: 30, coalition: 2 } }); return { msg: `Contribution extraordinaire de 30 millions levée : ${N.regionName(arg)}.` }; }
    case "annexer": { const c = s.pays[arg]; c.statut = "annexe"; c.rel = clamp(c.rel - 20, -100, 100); fx({ s: { departements: arg === "hollande" ? 9 : 6, coalition: 7, popularite: -1 } }); return { msg: `${N.regionName(arg)} est réuni à l’Empire.`, src: "Le Moniteur universel" }; }
    case "post": { const old = s.posts[arg]; if (old === val) return {}; const m = N.ministers[arg]; const o = m.list.find(x => x[0] === old), n = m.list.find(x => x[0] === val); s.posts[arg] = val; if (o && o[4]) fx({ r: { [o[4]]: -20 } }); if (n && n[4]) fx({ r: { [n[4]]: 8 } }); return { msg: `${m.label} : ${n[1]} remplace ${o ? o[1] : "son prédécesseur"}.`, src: "Le Moniteur universel" }; }
    case "enquete": st.tresor -= 10; useOnce(s, "enquete"); fx({ s: { complot: -Math.round(7 * N.minister(s, "police")) } }); { const worst = N.relations.filter(r => r.plotter && GAME.relAlive(s, r.id)).sort((a, b) => s.rel[a.id] - s.rel[b.id])[0]; return { msg: worst && s.rel[worst.id] < -20 ? `Rapport de police : des réunions suspectes se tiennent autour de ${worst.name}.` : "Rapport de police : quelques agitateurs arrêtés, rien de sérieux.", src: "Rapport de police" }; }
    case "arrestations": useOnce(s, "arrest"); fx({ s: { complot: -12, popularite: -5 } }); return { msg: "Arrestations préventives : suspects envoyés à Vincennes et au Temple.", src: "Rapport de police" };
    case "surveiller": { st.tresor -= 4; useOnce(s, "surv"); const r = GAME.relDef(s, val); const v = s.rel[val]; const txt = v < -40 ? "tient des propos hostiles et reçoit des visiteurs suspects" : v < 0 ? "se plaint en privé, sans rien préparer" : "ne dit que du bien de vous, du moins devant témoins"; if (Math.random() < .2) fx({ r: { [val]: -5 } }); return { msg: `Rapport de police : ${r.name} ${txt}.`, src: "Rapport de police" }; }
    case "bulletin": useOnce(s, "bulletin"); s.lastBattle.used = true; fx({ s: { popularite: s.lastBattle.win ? 5 : 2, loyaute: s.lastBattle.win ? 2 : 0 } }); return { msg: `Bulletin de la Grande Armée : ${s.lastBattle.win ? "la victoire" : "le « succès »"} de ${s.lastBattle.name} est proclamé${s.lastBattle.win ? "e" : ""} dans tout l’Empire.`, src: "Bulletin de la Grande Armée", sfx: "crowd" };
    case "fete": { st.tresor -= 15; const last = s.wk.feteLast || -99; const g = s.week - last < 26 ? 2 : 4; s.wk.feteLast = s.week; fx({ s: { popularite: g } }); return { msg: "Te Deum à Notre-Dame, feux d’artifice et vin aux fontaines.", src: "Journal de Paris", sfx: "crowd" }; }
    case "tableau": st.tresor -= 8; useOnce(s, "tab" + parseD(s.date).y); fx({ s: { popularite: 2 } }); return { msg: "Une grande toile est commandée pour le prochain Salon.", src: "Journal de Paris" };
    case "blocus_on": s.flags.blocus = true; s.pol.blocus = 2; s.done.blocus = s.done.blocus || "panel"; fx({ s: { coalition: 6, popularite: -2 }, r: { talleyrand: -6 } }); return { msg: "Décret : les îles Britanniques sont déclarées en état de blocus.", src: "Le Moniteur universel", sfx: "paper" };
    case "repos": useOnce(s, "repos"); fx({ s: { fatigue: -8, stress: -5, sante: 1, popularite: -.5 } }); return { msg: "Quelques jours de repos, loin des dossiers." };
    case "medecin": useOnce(s, "medecin"); st.tresor -= 1; fx({ s: { sante: 2.5 } }); return { msg: "Le médecin prescrit bains, diète et moins de café." };
    case "famille": useOnce(s, "famille"); fx({ s: { stress: -5 }, spouseRel: 3, r: { letizia: 1 } }); return { msg: "Une soirée en famille." };
    case "heritier": if (val === "aucun") val = ""; s.family.heir = val || null; fx({ s: { complot: val ? -4 : 3 } }); return { msg: val ? `Succession : ${val} est désigné héritier.` : "Aucun héritier n’est plus désigné.", src: "Le Moniteur universel" };
    case "throne": { const [who, name] = val.split("|"); s.thrones[arg] = who; s.pays[arg].statut = "vassal"; s.pays[arg].rel = clamp(s.pays[arg].rel - 8, -100, 100); fx({ s: { coalition: 4, loyaute: 2 }, r: who === "murat" ? { murat: 15 } : { letizia: 4 } }); return { msg: `${name} monte sur le trône : ${N.regionName(arg)}.`, src: "Le Moniteur universel" }; }
  }
  return {};
};
N.canEnter = (s, id) => { const r = REG(id); if (id === "angleterre") return "Sans maîtrise de la mer, impossible de débarquer en Angleterre."; if (id === "egypte" && !s.flags.egypt) return "Il faudrait une flotte et une expédition."; const stt = N.map.status(s, id); if (stt === "paix") return `${r.name} est en paix avec vous : y entrer serait un acte de guerre. Déclarez la guerre ou obtenez une alliance.`; return false; };
N.offensive = (s, k) => {
  const c = s.pays[k]; const men = Math.max(15, Math.round(Math.min(c.armee * .45, Math.max(25, s.corps.reduce((t, x) => t + x.men, 0) * .6))));
  return { title: `Offensive : ${N.regionName(k)}`, battle: { name: N.regionName(k), base: .5, need: men, foe: k, region: k,
    win: { s: { popularite: 4, loyaute: 2 }, pays: { [k]: { ws: 32, armee: -Math.round(c.armee * .3) } }, txt: "L’armée ennemie est battue et recule." },
    loss: { s: { popularite: -5 }, pays: { [k]: { ws: -22 } }, txt: "L’offensive échoue ; vos corps se replient." } } };
};

/* ---------------- Panneaux de gestion (décrits en données) ---------------- */
const sl = (id, label, min, max, step, fmt, note) => s => ({ k: "slider", act: "pol", arg: id, label, min, max, step, val: s.pol[id], fmt, note: typeof note === "function" ? note(s) : note });
const levels = (...names) => v => names[v];
N.panels = [
  { id: "armee", label: "Armée", cond: s => P(s) >= 1 || s.corps.length > 0, blocks: s => {
    const pw = P(s); const free = N.marshalsFree(s);
    const rows = s.corps.map((c, i) => ({ k: "row", title: `${i + 1}. ${c.name}`, sub: `${Math.round(c.men)} 000 h. · ${N.regionName(c.loc)}${c.dest ? ` → ${N.regionName(c.dest)} (${frDate(c.eta)})` : ""}`,
      meters: [["Moral", c.moral], ["Ravitaillement", c.supply]],
      ctrls: [
        { k: "select", act: "corps_marshal", arg: c.id, label: "Chef", val: c.marshal, options: [[c.marshal, N.marshalName(c.marshal)], ...free.map(m => [m.id, `${m.name} (${m.skill >= 1.2 ? "excellent" : m.skill >= 1.05 ? "très bon" : m.skill >= .95 ? "solide" : "médiocre"})`])] },
        { k: "select", act: "corps_move", arg: c.id, label: "Position", val: c.dest || c.loc, options: N.map.regions.filter(r => r.id === c.loc || r.id === c.dest || !N.canEnter(s, r.id)).map(r => [r.id, r.name + (r.id === c.loc ? " (sur place)" : ` — ${(r.sea || REG(c.loc).sea ? 6 : N.path(c.loc, r.id) * 2)} sem.`)]) },
        { k: "btn", act: "corps_plus", arg: c.id, label: "+10 000", dis: s.depot < 1 && "Dépôts vides" }, { k: "btn", act: "corps_minus", arg: c.id, label: "−10 000", dis: c.men <= 3 && "Effectif minimal" },
        { k: "btn", act: "corps_del", arg: c.id, label: "Dissoudre", dis: s.corps.length <= 3 && "3 corps au minimum" }
      ] }));
    return [
      { k: "kpi", items: [["Sous les armes", `${Math.round(s.stats.armee)} 000`], ["Aux dépôts", `${Math.round(s.depot)} 000`], ["Moral moyen", Math.round(s.stats.moral)], ["Corps", `${s.corps.length}/6`]] },
      ...rows,
      { k: "btn", act: "corps_new", label: "Former un nouveau corps", cost: "15 000 hommes des dépôts", dis: (s.corps.length >= 6 && "6 corps au maximum") || (s.depot < 15 && "Dépôts insuffisants") },
      { k: "h", text: "Recrutement et intendance" },
      sl("conscription", "Conscription", 0, 4, 1, levels("Suspendue", "Légère", "Normale", "Forte", "Levée en masse"), s => `≈ ${Math.round([0, 4, 8, 14, 24][s.pol.conscription] * (pw >= 2 ? 1 : .12))} 000 recrues par mois · popularité ${["+0,3", "0", "−0,4", "−1", "−2,2"][s.pol.conscription]}/mois`)(s),
      sl("solde", "Solde des troupes", 80, 125, 5, v => v + " %", s => `Coût de l’entretien ×${(s.pol.solde / 100).toFixed(2)} · moral visé ${Math.round(58 + (s.pol.solde - 100) * .5)}`)(s),
      sl("rav", "Ravitaillement", 0, 2, 1, levels("Vivre sur le pays", "Convois réguliers", "Magasins abondants"), "Un corps mal ravitaillé fond et se démoralise, surtout loin de France.")(s)
    ]; } },
  { id: "lois", label: "Lois", cond: s => P(s) >= 2, blocks: s => {
    const y = parseD(s.date).y;
    return [{ k: "info", html: "Chaque loi se promulgue une fois. Ses effets sont permanents." },
      ...N.laws.map(l => ({ k: "row", title: l.label, sub: l.note + (s.laws[l.id] ? ` Promulguée en ${parseD(s.laws[l.id]).y}.` : ""), done: !!s.laws[l.id], ctrls: s.laws[l.id] ? [] : [{ k: "btn", act: "law", arg: l.id, label: "Promulguer", cost: M(l.cost), dis: (y < l.year && `Les projets ne sont pas mûrs avant ${l.year}`) || pay(s, l.cost) }] }))]; } },
  { id: "finances", label: "Finances", cond: s => true, blocks: s => {
    const b = N.budget(s), pw = P(s);
    const out = [{ k: "kpi", items: [["Trésor", M(s.stats.tresor)], ["Solde mensuel", (b.solde >= 0 ? "+" : "") + M(b.solde)], ["Dette", M(s.dette)], ["Économie", Math.round(s.eco)]] },
      { k: "table", title: "Recettes par mois", rows: b.rec.map(x => [x[0], "+" + x[1].toFixed(1)]) }, { k: "table", title: "Dépenses par mois", rows: b.dep.map(x => [x[0], "−" + x[1].toFixed(1)]) }];
    if (pw >= 1) out.push(sl("contrib", "Contributions des pays soumis", 0, 3, 1, levels("Aucune", "Modérées", "Lourdes", "Écrasantes"), "Rapportent beaucoup, mais usent la fidélité des vassaux et inquiètent l’Europe.")(s));
    if (pw >= 2) out.push(
      sl("impots", "Impôts directs", 80, 130, 5, v => v + " %", s => `Popularité visée ${s.pol.impots > 100 ? "−" : "+"}${Math.abs((s.pol.impots - 100) * .35).toFixed(1)}`)(s),
      sl("droits", "Droits réunis (alcool, tabac, sel)", 0, 2, 1, levels("Supprimés", "Modérés", "Élevés"), "Impôts indirects, détestés dans les campagnes.")(s),
      { k: "btn", act: "emprunt", label: "Emprunter 100 millions", cost: "110 à rembourser, intérêts mensuels" }, { k: "btn", act: "rembourser", label: "Rembourser la dette", cost: M(Math.min(100, s.dette)), dis: (s.dette <= 0 && "Aucune dette") || pay(s, Math.min(100, s.dette)) },
      { k: "btn", act: "biens", label: "Vendre des domaines nationaux", cost: "+40 M F, une fois par an", dis: once(s, "biens" + parseD(s.date).y) && "Déjà fait cette année" });
    return out; } },
  { id: "diplomatie", label: "Diplomatie", cond: s => P(s) >= 2, blocks: s => {
    const order = ["angleterre", "autriche", "russie", "prusse", "espagne", "allemagne", "italie", "naples", "hollande", "pologne", "suisse", "portugal", "ottoman", "suede", "danemark"];
    const rows = order.map(k => { const c = s.pays[k]; const st = c.statut; const ctrls = [];
      if (st === "guerre") { ctrls.push({ k: "btn", act: "paix", arg: k, label: "Proposer la paix", dis: once(s, "paix" + k) }); if (!REG(k).sea) ctrls.push({ k: "btn", act: "offensive", arg: k, label: "Offensive", dis: !s.corps.some(x => !x.dest && (x.loc === k || REG(k).adj.includes(x.loc))) && "Aucun corps à portée" }); }
      if (st === "paix") { ctrls.push({ k: "btn", act: "ambassade", arg: k, label: "Ambassade", cost: "8 M F", dis: once(s, "amb" + k) || pay(s, 8) }, { k: "btn", act: "alliance", arg: k, label: "Alliance", dis: once(s, "all" + k) || (c.rel < 25 && "Relations insuffisantes") }, { k: "btn", act: "guerre", arg: k, label: "Déclarer la guerre", confirm: true }); }
      if (st === "allie") ctrls.push({ k: "btn", act: "ambassade", arg: k, label: "Ambassade", cost: "8 M F", dis: once(s, "amb" + k) || pay(s, 8) }, { k: "btn", act: "guerre", arg: k, label: "Rompre et attaquer", confirm: true });
      if (st === "vassal" || st === "occupe") ctrls.push({ k: "btn", act: "tribut", arg: k, label: "Lever 30 M F", dis: once(s, "trib" + k + parseD(s.date).y) && "Déjà levé cette année" }, { k: "btn", act: "annexer", arg: k, label: "Annexer", confirm: true });
      return { k: "row", title: N.regionName(k), badge: [N.map.statusLabel[st], st], sub: `Armée estimée : ${Math.round(c.armee)} 000 h.${st === "guerre" ? ` · avantage militaire ${Math.round(c.ws || 0)}` : ""}${k === "angleterre" && s.pol.blocus ? ` · pression du Blocus ${Math.round(c.pression || 0)} %` : ""}`, rel: c.rel, ctrls }; });
    const posts = Object.entries(N.ministers).map(([k, m]) => ({ k: "select", act: "post", arg: k, label: m.label, val: s.posts[k], options: m.list.filter(x => x[3] <= s.date && (!x[4] || GAME.relAlive(s, x[4])) || x[0] === s.posts[k]).map(x => [x[0], `${x[1]} (${x[2] >= 1.25 ? "brillant" : x[2] >= 1.1 ? "habile" : x[2] >= .95 ? "honnête" : "terne"})`]) }));
    const rv = N.rivals.map(r => { const v = s.rivals[r.id]; return { k: "row", title: r.name, sub: s.pol.espions ? v.plan : "Projets inconnus : entretenez un réseau d’espions (panneau Police).", meters: s.pol.espions ? [["Avancement du plan", v.prog]] : [] }; });
    return [{ k: "h", text: "Puissances" }, ...rows, { k: "h", text: "Ministres" }, ...posts, { k: "h", text: "Ce que préparent vos rivaux" }, ...rv]; } },
  { id: "police", label: "Police", cond: s => P(s) >= 2, blocks: s => [
    { k: "kpi", items: [["Risque de complot", Math.round(s.stats.complot)], ["Ministre", N.ministers.police.list.find(x => x[0] === s.posts.police)?.[1] || "—"]] },
    sl("police", "Budget de la police", 0, 3, 1, levels("Minimal", "Ordinaire", "Renforcé", "Omniprésent"), "Réduit le risque de complot. Une police trop visible pèse sur l’opinion.")(s),
    { k: "select", act: "pol", arg: "espions", label: "Espions à l’étranger", val: s.pol.espions, options: [[0, "Aucun réseau"], [1, "Réseau entretenu (4 M F par mois)"]], note: "Révèle les plans de vos rivaux dans le panneau Diplomatie." },
    { k: "btn", act: "enquete", label: "Ordonner une enquête", cost: "10 M F", dis: once(s, "enquete") || pay(s, 10) },
    { k: "btn", act: "arrestations", label: "Arrestations préventives", cost: "Complot −12, popularité −5", dis: once(s, "arrest"), confirm: true },
    { k: "select", act: "surveiller", label: "Faire surveiller quelqu’un (4 M F)", val: "", options: [["", "Choisir une personne…"], ...N.relations.filter(r => GAME.relAlive(s, r.id) && !["alexandre", "pitt", "wellington", "pie7", "metternich"].includes(r.id)).map(r => [r.id, r.name])], dis: once(s, "surv") || pay(s, 4) }
  ] },
  { id: "presse", label: "Presse", cond: s => P(s) >= 2, blocks: s => [
    sl("censure", "Journaux autorisés", 0, 3, 1, levels("Presse libre (73 titres)", "Presse surveillée", "13 journaux à Paris", "4 journaux à Paris"), "La censure étouffe les mauvaises nouvelles, mais pousse l’opposition dans l’ombre.")(s),
    sl("propag", "Budget de propagande", 0, 3, 1, levels("Aucun", "Modeste", "Soutenu", "Massif"), "Gravures, chansons, articles commandés : soutient la popularité.")(s),
    { k: "btn", act: "bulletin", label: "Publier un Bulletin de la Grande Armée", cost: "Après une bataille", dis: (!s.lastBattle || s.lastBattle.used || s.week - s.lastBattle.week > 8) && "Aucune bataille récente à raconter" },
    { k: "btn", act: "fete", label: "Te Deum et fête publique", cost: "15 M F", dis: pay(s, 15) },
    { k: "btn", act: "tableau", label: "Commander un tableau à David ou à Gros", cost: "8 M F, une fois par an", dis: once(s, "tab" + parseD(s.date).y) || pay(s, 8) }
  ] },
  { id: "travaux", label: "Travaux", cond: s => P(s) >= 2, blocks: s => {
    const y = parseD(s.date).y;
    return [sl("travaux", "Rythme des chantiers", 0, 2, 1, levels("Ralenti", "Normal", "Accéléré"), "Accélérer coûte plus cher chaque mois.")(s),
      ...N.works.map(w => { const pr = s.projects[w.id]; return { k: "row", title: w.label, sub: w.note + (pr && pr.done ? ` Achevé en ${parseD(pr.done).y}.` : ""), done: !!(pr && pr.done), meters: pr && !pr.done ? [["Avancement", (1 - pr.left / w.weeks) * 100]] : [], ctrls: pr ? [] : [{ k: "btn", act: "work", arg: w.id, label: "Ouvrir le chantier", cost: `${M(w.cost)} sur ${Math.round(w.weeks / 52 * 10) / 10} an(s)`, dis: y < w.year && `Projet présenté en ${w.year}` }] }; })]; } },
  { id: "economie", label: "Économie", cond: s => P(s) >= 2, blocks: s => [
    { k: "kpi", items: [["Indice d’activité", Math.round(s.eco)], ["Pression sur Londres", `${Math.round(s.pays.angleterre.pression || 0)} %`]] },
    s.flags.blocus ? sl("blocus", "Blocus continental", 0, 2, 1, levels("Levé", "Assoupli par des licences", "Strict"), "Use l’Angleterre lentement ; ruine les ports, irrite la Russie et vos alliés.")(s) : { k: "btn", act: "blocus_on", label: "Décréter le Blocus continental", cost: "Fermer l’Europe au commerce anglais", dis: s.rank !== "empereur" && "Il faut dominer le continent", confirm: true },
    sl("douanes", "Tarif douanier", 0, 2, 1, levels("Bas", "Moyen", "Prohibitif"), "Protège les manufactures, renchérit la vie.")(s),
    { k: "select", act: "pol", arg: "pain", label: "Prix du pain", val: s.pol.pain, options: [[0, "Marché libre"], [1, "Prix maximum et réserves (3 M F par mois)"]], note: "Le pain cher fait les émeutes." },
    sl("industrie", "Aides aux manufactures", 0, 2, 1, levels("Aucune", "Prix et expositions", "Commandes d’État"), "Fait monter lentement l’activité, donc les impôts.")(s)
  ] },
  { id: "famille", label: "Famille", cond: s => true, blocks: s => {
    const fam = s.family, pw = P(s);
    const heirs = [["aucun", "Aucun héritier désigné"], ...fam.children.map(c => [c.name.split(",")[0], c.name.split(",")[0]]), ["Eugène de Beauharnais", "Eugène de Beauharnais (fils adoptif)"], ["Joseph Bonaparte", "Joseph Bonaparte (frère aîné)"], ["Louis Bonaparte", "Louis Bonaparte (frère)"]];
    const out = [{ k: "table", title: "Maison", rows: [["Conjoint", fam.spouse ? GAME.relDef(s, fam.spouse).name : fam.spouseName || "—"], ["Enfants", fam.children.length ? fam.children.map(c => `${c.name.split(",")[0]} (${parseD(c.born).y})`).join(", ") : "Aucun enfant légitime"], ["Héritier", fam.heir || (fam.children[0] ? fam.children[0].name.split(",")[0] : "Aucun")]] },
      { k: "btn", act: "famille", label: "Passer du temps en famille", cost: "Stress −5", dis: once(s, "famille") || (!(fam.spouse || fam.spouseName || fam.children.length) && "Personne auprès de vous") },
      { k: "btn", act: "repos", label: "Prendre du repos", cost: "Fatigue −8, stress −5", dis: once(s, "repos") },
      { k: "btn", act: "medecin", label: "Consulter son médecin", cost: "Santé +2,5", dis: once(s, "medecin") }];
    if (pw >= 3) { out.push({ k: "h", text: "Succession et trônes" }, { k: "select", act: "heritier", label: "Héritier", val: fam.heir || "aucun", options: heirs.some(h => h[0] === (fam.heir || "aucun")) ? heirs : [...heirs, [fam.heir, fam.heir]] });
      for (const t of N.thrones) { const stt = s.pays[t.pays].statut; out.push({ k: "select", act: "throne", arg: t.pays, label: `Trône : ${N.regionName(t.pays)}`, val: s.thrones[t.pays] ? "" : "", options: [["", s.thrones[t.pays] ? `Occupé par ${t.who.find(w => w[0] === s.thrones[t.pays])?.[1] || s.thrones[t.pays]}` : "Vacant"], ...t.who.filter(w => w[0] !== s.thrones[t.pays] && !Object.values(s.thrones).includes(w[0])).map(w => [w.join("|"), `Y placer ${w[1]}`])], dis: !["vassal", "occupe"].includes(stt) && "Il faut d’abord dominer ce pays" }); } }
    return out; } }
];

/* ---------------- Parole : types d’action libre possibles à cette époque ---------------- */
N.speech = [
  { id: "ordre", label: "Ordre ou décret", hint: "Une loi, un ordre militaire, une nomination, une mesure exceptionnelle.", ph: "Ex. : J’ordonne la création d’une école spéciale militaire à Fontainebleau pour former les officiers…" },
  { id: "proclamation", label: "Proclamation", hint: "Texte affiché et lu publiquement, à la Nation ou à un pays conquis.", ph: "Ex. : Proclamation aux habitants de la Lombardie : vos propriétés, votre religion et vos usages seront respectés…" },
  { id: "discours", label: "Discours aux troupes", hint: "Harangue lue à l’ordre du jour de l’armée.", ph: "Ex. : Soldats, vous êtes nus, mal nourris ; je veux vous conduire dans les plus fertiles plaines…", cond: s => s.corps.length > 0 },
  { id: "lettre", label: "Lettre privée", hint: "Lettre personnelle à un proche, un ministre ou un souverain.", ph: "Ex. : Je vous écris pour vous proposer une entrevue, de souverain à souverain…", target: true },
  { id: "communique", label: "Communiqué au Moniteur", hint: "Texte officiel publié dans le journal du gouvernement.", ph: "Ex. : Le gouvernement dément les rumeurs de disette et annonce l’arrivée de convois de blé…", cond: s => P(s) >= 2 },
  { id: "rumeur", label: "Rumeur à faire fuiter", hint: "Bruit répandu dans les salons par un proche ou par la police.", ph: "Ex. : Faire courir le bruit que l’Autriche négocie en secret avec nous, pour inquiéter Londres…" }
];
N.advisors = [
  { rel: "talleyrand", name: "Talleyrand", role: "diplomate", style: "feutré, ironique, toujours soucieux de l’équilibre européen et de la modération" },
  { name: "Cambacérès", role: "juriste, deuxième personnage de l’État", style: "prudent, légaliste, attentif à l’opinion des notables", cond: s => s.date >= "1799-11-01" },
  { rel: "berthier", name: "Berthier", role: "chef d’état-major", style: "précis, concret, préoccupé de logistique et d’exécution" },
  { name: "Las Cases", role: "compagnon d’exil", style: "dévoué, soucieux de la postérité", cond: s => P(s) === 0 }
];
N.advisor = s => N.advisors.find(a => (!a.rel || (GAME.relAlive(s, a.rel) && s.rel[a.rel] > -60)) && (!a.cond || a.cond(s)) && (P(s) > 0 || !a.rel || a.rel === "berthier")) || N.advisors[2];
N.newsSources = s => P(s) === 0 ? ["The Times (Londres)", "Journal des débats", "Rumeur de Longwood"] : ["Le Moniteur universel", "Journal des débats", "Gazette de France", "Journal de Paris", "The Times (Londres)", "Gazette de Vienne", "Rapport de police"];
N.publicLabel = "Dans les rues, les salons et les bivouacs";

/* ---------------- Rivaux : chacun poursuit son plan ---------------- */
N.rivals = [
  { id: "angleterre", name: "Le cabinet britannique", plans: [
    { plan: "Financer une nouvelle coalition sur le continent", news: ["Londres vote de nouveaux subsides pour ses alliés du continent", "Un envoyé britannique reçu à Vienne et à Saint-Pétersbourg"], done: { s: { coalition: 10 }, pays: { autriche: { rel: -8 }, russie: { rel: -8 } } }, title: "L’or anglais scelle une alliance contre la France" },
    { plan: "Étrangler le commerce maritime français", news: ["La Royal Navy resserre le blocus de Brest et de Toulon", "Des navires neutres saisis au large de Bordeaux"], done: { s: { tresor: -30, popularite: -2 } }, title: "Les ports français asphyxiés par les croisières anglaises" },
    { plan: "Soutenir les insurrections contre la France", news: ["Des armes anglaises débarquées de nuit sur les côtes", "Londres accueille des émissaires venus du continent"], done: { s: { complot: 6, coalition: 4 } }, title: "Des soulèvements éclatent, armés par Londres" } ] },
  { id: "autriche", name: "La cour de Vienne", plans: [
    { plan: "Réformer l’armée et préparer la revanche", news: ["L’archiduc Charles réorganise l’armée autrichienne", "Vienne lève une Landwehr de volontaires"], done: { pays: { autriche: { armee: 40, rel: -10 } }, s: { coalition: 6 } }, title: "L’Autriche a refait ses forces", war: -35 },
    { plan: "Détacher les princes allemands de la France", news: ["Des agents autrichiens parcourent la Bavière et la Saxe", "Vienne promet des agrandissements aux princes allemands"], done: { pays: { allemagne: { rel: -15 } }, s: { coalition: 5 } }, title: "L’Allemagne travaillée par la diplomatie de Vienne" } ] },
  { id: "russie", name: "Le tsar Alexandre", plans: [
    { plan: "Rassembler une armée sur la frontière occidentale", news: ["Des régiments russes en marche vers la Lituanie", "Le tsar inspecte ses troupes à Vilna"], done: { pays: { russie: { armee: 50, rel: -8 } }, s: { coalition: 6 } }, title: "La Russie masse ses armées à l’ouest", war: -45 },
    { plan: "Se rapprocher de Londres et rouvrir ses ports", news: ["Des navires « neutres » chargés de produits anglais à Riga", "Un oukase modifie les tarifs douaniers russes"], done: { pays: { russie: { rel: -12 }, angleterre: { pression: -15 } }, s: { coalition: 5 } }, title: "Saint-Pétersbourg tourne le dos au système français" } ] },
  { id: "prusse", name: "La cour de Berlin", plans: [
    { plan: "Reconstituer l’armée en secret", news: ["Scharnhorst instruit les recrues prussiennes par roulement", "La reine Louise prêche la résistance à Berlin"], done: { pays: { prusse: { armee: 40, rel: -10 } }, s: { coalition: 4 } }, title: "La Prusse réarme en silence", war: -45 } ] },
  { id: "royalistes", name: "Les royalistes en exil", plans: [
    { plan: "Monter une conspiration à Paris", news: ["Des émigrés rentrés clandestinement signalés en Normandie", "Le comte d’Artois reçoit des agents à Londres"], done: { s: { complot: 12 } }, title: "Un complot royaliste se noue dans la capitale" },
    { plan: "Rallier des généraux mécontents", news: ["Des lettres de Louis XVIII circulent parmi les officiers", "On murmure dans certains états-majors"], done: { s: { loyaute: -6, complot: 5 } }, title: "Des officiers approchés par les agents du roi" } ] }
];

/* ---------------- Compléments aux événements historiques : pays, région de la bataille, armées ---------------- */
const peace = { statut: "paix" }, war = (rel = -30) => ({ statut: "guerre", rel });
const allWar = { angleterre: war(-10), autriche: war(), russie: war(), prusse: war() };
const X = {
  italie: { region: "italie", c: { 0: { fx: { moveCorps: "italie" }, win: { pays: { italie: { statut: "occupe" } } } } } },
  arcole: { region: "italie" },
  campoformio: { region: "autriche", c: { 0: { fx: { pays: { autriche: { ...peace, rel: 20 }, italie: { statut: "vassal" }, allemagne: peace, naples: peace } } }, 1: { win: { pays: { autriche: { ...peace, rel: 5 }, italie: { statut: "vassal" }, allemagne: peace } } } } },
  egypte: { c: { 0: { fx: { moveCorps: "egypte", f: { egypt: true }, pays: { ottoman: war(-40), egypte: { statut: "occupe" } } } } } },
  acre: { region: "egypte" }, egyptealt: { region: "egypte" },
  brumaire: { c: { 0: { fx: { preset: "1799" } }, 1: { fx: { preset: "1799" } } } },
  marengo: { region: "italie", c: { 0: { win: { pays: { autriche: { ...peace, rel: 15 }, italie: { statut: "vassal" }, russie: { ...peace, rel: 20 }, naples: peace, allemagne: peace, ottoman: peace } } } } },
  amiens: { c: { 0: { fx: { pays: { angleterre: { ...peace, rel: 30 }, portugal: peace, ottoman: peace } } } } },
  rupture: { c: { 0: { fx: { pays: { angleterre: war(-30) } } }, 2: { fx: { pays: { angleterre: war(-30) } } } } },
  trafalgar: { pre: { pays: { autriche: war(), russie: war(), angleterre: war(0) } }, c: { 0: { fx: { moveCorps: "allemagne" } }, 1: { fx: { moveCorps: "allemagne" } } } },
  austerlitz: { region: "autriche", c: { 0: { win: { pays: { autriche: { ...peace, rel: 5 }, allemagne: { statut: "vassal" }, naples: { statut: "occupe" } } } }, 1: { win: { pays: { autriche: peace } } } } },
  iena: { region: "prusse", pre: { pays: { prusse: war(-40) } }, c: { 0: { win: { pays: { prusse: { statut: "occupe" }, allemagne: { statut: "vassal" } } } }, 1: { win: { pays: { prusse: { statut: "occupe" } } } } } },
  tilsit: { c: { 0: { fx: { pays: { russie: { statut: "allie", rel: 70 }, prusse: peace, pologne: { statut: "vassal", armee: 40 } } } }, 1: { fx: { pays: { russie: peace, prusse: peace, pologne: { statut: "vassal", armee: 60 } } } }, 2: { fx: { pays: { russie: peace, prusse: { statut: "annexe" } } } } } },
  espagne: { c: { 0: { fx: { pays: { espagne: war(-70), portugal: war(-30) }, thr: { espagne: "joseph" } } }, 1: { fx: { pays: { espagne: { statut: "allie", rel: 10 } } } } } },
  wagram: { region: "autriche", pre: { pays: { autriche: war(-40) } }, c: { 0: { win: { pays: { autriche: { ...peace, rel: 10 } } } } } },
  mariage: { c: { 0: { fx: { pays: { autriche: { statut: "allie", rel: 40 } } } }, 1: { fx: { pays: { russie: { statut: "allie", rel: 30 } } } } } },
  russie: { c: { 0: { fx: { moveCorps: "russie", pays: { russie: war(-40) } } }, 2: { fx: { gamble: { win: { pays: { russie: { rel: 30 } } } } } }, 3: { region: "espagne" } } },
  moskova: { region: "russie" }, moscou: { region: "russie" }, berezina: { region: "russie" },
  retraite: { c: { 0: { fx: { moveCorps: "allemagne", pays: { prusse: war(-50) } } }, 1: { fx: { moveCorps: "allemagne", pays: { prusse: war(-50) } } } } },
  leipzig: { region: "allemagne", pre: { pays: { autriche: war(-40), prusse: war(-20), russie: war(-10), suede: war(-30) } }, c: { 0: { fx: { moveCorps: "allemagne" }, loss: { pays: { allemagne: war(-30) }, moveCorps: "france" } }, 1: { fx: { moveCorps: "france", pays: { allemagne: war(-20) } } }, 2: { fx: { moveCorps: "france", paysAll: "paix" } } } },
  abdication: { c: { 0: { fx: { paysAll: "paix" } }, 2: { fx: { paysAll: "paix" } } } },
  centjours: { c: { 0: { fx: { preset: "1815", pays: allWar } } } },
  waterloo: { region: "hollande" },
  apreswaterloo: { region: "allemagne", c: { 0: { fx: { paysAll: "paix" } } } },
  saintehelene: { c: { 0: { fx: { paysAll: "paix" } } } }
};
const merge = (a, b) => { for (const [k, v] of Object.entries(b)) { if (v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object") merge(a[k], v); else a[k] = v; } return a; };
for (const e of N.events) { const x = X[e.id]; if (!x) continue; if (x.region) e.region = x.region; if (x.pre) e.pre = merge(e.pre || {}, x.pre);
  for (const [i, o] of Object.entries(x.c || {})) { const ch = e.choices[+i]; if (!ch) continue; if (o.fx) ch.fx = merge(ch.fx || {}, o.fx); if (o.region && ch.battle) ch.battle.region = o.region; if (ch.battle) { if (o.win) merge(ch.battle.win, o.win); if (o.loss) merge(ch.battle.loss, o.loss); } } }
/* Les grandes batailles n’ont lieu que si la guerre correspondante existe encore dans votre partie */
const addCond = (id, fn) => { const e = N.events.find(x => x.id === id); const old = e.cond; e.cond = s => (!old || old(s)) && fn(s); };
addCond("blocus", s => !s.flags.blocus && s.pays.angleterre.statut === "guerre");
addCond("tilsit", s => s.pays.russie.statut === "guerre");
addCond("code", s => !s.laws.code);
addCond("russie", s => s.pays.russie.statut !== "guerre" && s.pays.russie.rel < 30);
addCond("amiens", s => s.pays.angleterre.statut === "guerre");

N.audio = { tempo: 76, root: 146.83, scale: [0, 2, 3, 5, 7, 8, 10], style: "marche" };
})();
</script>
