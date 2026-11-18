<script>
"use strict";
/* =====================================================================
   IA — Claude évalue les actions libres, conseille, écrit les dépêches,
   fait avancer les rivaux et raconte les batailles. JSON strict, validé.
   ===================================================================== */
const AI = {
  sample: null, downloads: null, available: false, status: "init", note: "Connexion à Claude…",
  ready: null, pending: null, failures: 0, tok: 0, ctls: new Set(),
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
    AI.setStatus(AI.available ? "ok" : "off", AI.available ? "Claude est prêt" : "Claude indisponible dans cette vue");
  },
  setStatus(st, note){ AI.status = st; AI.note = note; UI.updateAIStatus && UI.updateAIStatus(); },
  usable(){ return AI.available && AI.enabled; },

  /* Appel générique : JSON attendu, délai maximal, annulation propre */
  async call(prompt, { tier = AI.tier, timeout = 90000, json = true } = {}){
    if (!AI.usable()) throw { code: "unavailable" };
    const ctl = new AbortController(); AI.ctls.add(ctl);
    const timer = setTimeout(() => ctl.abort(), timeout);
    try {
      if (json) return await AI.sample.json(prompt, { modelTier: tier, signal: ctl.signal, cache: false });
      const r = await AI.sample(prompt, { modelTier: tier, signal: ctl.signal, cache: false }); return r.text;
    } catch (e) {
      const code = e && e.code;
      if (["not_granted", "sampling_disabled", "capability_disabled", "not_declared", "session_expired"].includes(code)) { AI.available = false; AI.setStatus("off", "Claude n’est pas autorisé dans cette vue"); }
      throw e;
    } finally { clearTimeout(timer); AI.ctls.delete(ctl); }
  },

  /* ---------- Contexte commun envoyé à chaque appel ---------- */
  context(s){
    const ch = GAME.ch(s); const y = parseD(s.date).y;
    const stats = ch.stats.map(d => `- ${d.id} (${d.label}) = ${Math.round(s.stats[d.id])}${d.fmt ? ` [${d.fmt(s.stats[d.id])}]` : " /100"}${d.bad === "high" ? " ; une hausse est mauvaise" : ""} ; variation max ±${d.aiMax}`).join("\n");
    const rels = ch.relations.filter(r => GAME.relAlive(s, r.id)).map(r => `- ${r.id} : ${r.name}, ${r.role} — ${Math.round(s.rel[r.id])} (${GAME.relStatusLabel[GAME.relStatus(s.rel[r.id])]})`).join("\n");
    const pays = s.pays ? Object.entries(s.pays).map(([k, c]) => `- ${k} : ${ch.regionName(k)} — ${ch.map.statusLabel[c.statut]}, relation ${Math.round(c.rel)}${typeof c.armee === "number" ? `, armée ≈ ${Math.round(c.armee)} 000` : ""}`).join("\n") : "";
    const corps = s.corps && s.corps.length ? s.corps.map(c => `- ${c.name} (${ch.marshalName(c.marshal)}) : ${Math.round(c.men)} 000 h., moral ${Math.round(c.moral)}, ravitaillement ${Math.round(c.supply)}, ${ch.regionName(c.loc)}`).join("\n") : "- aucun";
    const fam = [s.family.spouse ? `conjoint : ${GAME.relDef(s, s.family.spouse).name}` : s.family.spouseName ? `conjoint : ${s.family.spouseName}` : "pas de conjoint", s.family.children.length ? `enfants : ${s.family.children.map(c => c.name).join(", ")}` : "pas d’enfant", s.family.heir ? `héritier : ${s.family.heir}` : ""].filter(Boolean).join(" ; ");
    const diverg = s.history.filter(h => h.kind === "hist" && h.hist === false).map(h => `- ${frMonth(h.date)}, ${h.title} : « ${h.choice} » au lieu de ce qui s’est réellement passé`).join("\n") || "- aucune : l’Histoire suit son cours réel";
    const next = ch.events.find(e => !s.done[e.id] && e.date > s.date && e.choices.some(c => c.hist));
    const lois = s.laws ? Object.keys(s.laws).join(", ") : "";
    return `PERSONNAGE : ${ch.aiBrief}
DATE : ${frDate(s.date)} — ${GAME.age(s)} ans — ${GAME.rankLabel(s)} — lieu : ${s.place}
CONTEXTE RÉEL : ${y} : ${ch.eraNotes[y] || "—"} / ${y + 1} : ${ch.eraNotes[y + 1] || "—"}
${next ? `PROCHAIN GRAND MOMENT HISTORIQUE (géré à part) : ${next.title}, ${frMonth(next.date)}.` : ""}
BIFURCATIONS DÉJÀ PROVOQUÉES PAR LE JOUEUR :
${diverg}

JAUGES :
${stats}
${s.dette !== undefined ? `Dette : ${Math.round(s.dette)} M F. Lois en vigueur : ${lois || "aucune"}.` : ""}

RELATIONS VIVANTES (-100 ennemi … +100 allié) :
${rels}
${pays ? `\nPUISSANCES :\n${pays}` : ""}
${s.corps ? `\nCORPS D’ARMÉE :\n${corps}\nDépôts : ${Math.round(s.depot)} 000 h.` : ""}
${ch.aiState ? ch.aiState(s) + "\n" : ""}FAMILLE : ${fam}
SANTÉ : ${s.conditions.length ? s.conditions.map(c => c.name).join(", ") : "pas de maladie déclarée"}`;
  },

  /* Mémoire : actions récentes en détail, anciennes en résumé compact (rien n’est supprimé du journal) */
  memory(s){
    const j = s.journal; if (!j.length) return "- (aucune action libre pour l’instant)";
    const recent = j.slice(-8), old = j.slice(0, -8);
    const line = x => `- ${frDate(x.d)} [${x.typeLabel}] ${x.resume}${x.suites && x.suites.length ? ` (suites : ${x.suites.map(q => q.t).join(" ; ")})` : ""}`;
    let oldTxt = "";
    if (old.length) {
      const keep = old.length > 110 ? [...old].sort((a, b) => (b.importance || 1) - (a.importance || 1)).slice(0, 110).sort((a, b) => a.d.localeCompare(b.d)) : old;
      oldTxt = `ACTIONS PLUS ANCIENNES (résumé${old.length > keep.length ? `, ${old.length - keep.length} actions mineures omises` : ""}) :\n` + keep.map(x => `- ${frMonth(x.d)} : ${String(x.resume).slice(0, 90)}`).join("\n") + "\n";
    }
    return oldTxt + "ACTIONS RÉCENTES (détail) :\n" + recent.map(x => `${line(x)}\n  Texte du joueur : « ${String(x.text).slice(0, 320)} »`).join("\n") + (s.deferred.length ? "\nCONSÉQUENCES EN ATTENTE :\n" + s.deferred.map(d => `- vers ${frMonth(d.date)} : ${d.title}`).join("\n") : "");
  },
  rules(s){ return GAME.ch(s).aiRules.map(r => "- " + r).join("\n"); },

  /* Convertit un bloc d’effets renvoyé par l’IA en effets du jeu, bornés */
  normFx(o, s, scale = 1){
    const ch = GAME.ch(s); const fx = { s: {}, r: {}, pays: {} }; if (!o || typeof o !== "object") return fx;
    const j = o.jauges && typeof o.jauges === "object" ? o.jauges : o;
    for (const [k, v] of Object.entries(j)) { const d = ch.stats.find(x => x.id === k); const n = Number(v); if (d && isFinite(n) && n) fx.s[k] = clamp(Math.round(n), -d.aiMax * scale, d.aiMax * scale); }
    const relIds = ch.relations.map(r => r.id);
    for (const [k, v] of Object.entries(o.relations || {})) { const id = AI.findRel(s, k); const n = Number(v); if (id && isFinite(n) && n && GAME.relAlive(s, id)) fx.r[id] = clamp(Math.round(n), -25, 25); }
    if (s.pays) for (const [k, v] of Object.entries(o.pays || {})) { const n = Number(typeof v === "object" && v ? v.relation ?? v.rel : v); if (s.pays[k] && isFinite(n) && n) fx.pays[k] = { rel: clamp(Math.round(n), -25, 25) }; }
    return fx;
  },
  findRel(s, k){ const ch = GAME.ch(s); const key = String(k || "").toLowerCase().trim(); if (!key) return null; return (ch.relations.find(r => r.id === key) || ch.relations.find(r => r.name.toLowerCase().includes(key) || key.includes(r.id) || key.includes(r.name.toLowerCase().split(" ").pop())))?.id || null; },

  /* ---------- 1. Action libre : validité et répercussions ---------- */
  actionPrompt(s, a){
    const ch = GAME.ch(s); const tp = ch.speech.find(x => x.id === a.type);
    return `Tu es le moteur de simulation de « Legacy », un simulateur de vie historique sérieux, en français. Le joueur incarne le personnage et vient d’écrire UNE action libre. Tu dois juger si elle est possible, puis calculer ses répercussions de façon réaliste.

${AI.context(s)}

MÉMOIRE DE LA PARTIE :
${AI.memory(s)}

ACTION DU JOUEUR — type : ${tp.label} (${tp.hint})${a.target ? ` — destinataire : ${a.target}` : ""}
« ${a.text} »

RÈGLES :
- "valide" = false si l’action est impossible ou anachronique pour ce personnage à cette date (technologie inexistante, pouvoir qu’il n’a pas avec son titre actuel, personne morte ou pas encore née, moyens qu’il n’a pas). Donne alors une "raison" courte et concrète, et laisse le reste vide. Une action maladroite, risquée ou impopulaire reste valide : elle a simplement des conséquences.
- Difficulté équilibrée : réaliste, mais une erreur doit rester rattrapable. La plupart des effets valent entre 1 et 8 points ; réserve les grands effets aux actes majeurs. Une action médiocre a des effets faibles, pas nuls.
- Tiens compte de la mémoire : une action ancienne peut ressurgir (un journal ressort une promesse, une loi passée produit encore des effets, un personnage se souvient).
- "effets_differes" : de 0 à 3 conséquences futures plausibles, avec un délai en semaines (de 2 à 520).
- "fil_actualite" : 2 à 4 articles de sources d’époque crédibles pour ce personnage (${ch.newsSources(s).join(", ")}…), y compris des sources étrangères ou hostiles quand c’est logique. Titre, une ou deux phrases, et le ton de l’article envers le personnage (favorable, neutre ou hostile).
- "reactions_personnages" : 1 à 4 personnes réelles concernées, parmi les relations listées (utilise leur identifiant), avec une réaction paraphrasée et le changement de relation (-20 à +20).
- "commentaires_public" : 3 à 6 réactions courtes et variées (${ch.publicLabel}), chacune attribuée à un type de personne (« un grenadier », « une marchande des Halles »…).
${AI.rules(s)}
- "resume" : une phrase neutre qui résume l’action et son effet, pour la mémoire. "importance" : 1 (anecdotique) à 5 (tournant de la partie).

RÉPONDS UNIQUEMENT par un objet JSON de cette forme exacte :
{"valide":true,"raison":"","resume":"…","importance":2,"effets_immediats":{"jauges":{"popularite":3},"relations":{"talleyrand":-4},"pays":{"autriche":-5}},"effets_differes":[{"dans_semaines":12,"titre":"…","texte":"…","jauges":{"tresor":-20},"relations":{},"pays":{}}],"fil_actualite":[{"source":"…","titre":"…","texte":"…","ton":"favorable|neutre|hostile"}],"reactions_personnages":[{"id":"talleyrand","nom":"Talleyrand","reaction":"…","relation":-4}],"commentaires_public":[{"qui":"un grenadier de la Garde","texte":"…"}]}`;
  },
  normAction(o, s){
    if (!o || typeof o !== "object" || typeof o.valide !== "boolean") throw new Error("forme");
    if (!o.valide) return { valide: false, raison: String(o.raison || "Cette action n’est pas possible à cette date.").slice(0, 400) };
    const ch = GAME.ch(s);
    const fx = AI.normFx(o.effets_immediats, s, 1.5);
    const reactions = (Array.isArray(o.reactions_personnages) ? o.reactions_personnages : []).slice(0, 5).map(r => { const id = AI.findRel(s, r.id) || AI.findRel(s, r.nom); const n = clamp(Math.round(Number(r.relation) || 0), -20, 20); return { id: id && GAME.relAlive(s, id) ? id : null, nom: String(r.nom || (id ? GAME.relDef(s, id).name : "")).slice(0, 60), reaction: String(r.reaction || "").slice(0, 300), relation: n }; }).filter(r => r.nom && r.reaction);
    for (const r of reactions) if (r.id && r.relation) fx.r[r.id] = r.relation;
    const differes = (Array.isArray(o.effets_differes) ? o.effets_differes : []).slice(0, 4).map(d => ({ weeks: clamp(Math.round(Number(d.dans_semaines) || 8), 1, 520), title: String(d.titre || "Conséquence").slice(0, 100), text: String(d.texte || "").slice(0, 400), fx: AI.normFx(d, s, 1.5) })).filter(d => d.title);
    const news = (Array.isArray(o.fil_actualite) ? o.fil_actualite : []).slice(0, 4).map(n => ({ src: String(n.source || ch.newsSources(s)[0]).slice(0, 60), title: String(n.titre || "").slice(0, 140), text: String(n.texte || "").slice(0, 400), ton: String(n.ton || "neutre") })).filter(n => n.title);
    const comments = (Array.isArray(o.commentaires_public) ? o.commentaires_public : []).slice(0, 6).map(c => typeof c === "string" ? { qui: "", texte: c.slice(0, 220) } : { qui: String(c.qui || "").slice(0, 60), texte: String(c.texte || "").slice(0, 220) }).filter(c => c.texte);
    if (news.length < 1) throw new Error("fil manquant");
    return { valide: true, resume: String(o.resume || "").slice(0, 240) || "Action libre.", importance: clamp(Math.round(Number(o.importance) || 2), 1, 5), fx, differes, news, reactions, comments };
  },
  /* Un essai, puis un second si la réponse est absente ou invalide */
  async evaluateAction(s, a){
    const prompt = AI.actionPrompt(s, a); let last = null;
    for (let i = 0; i < 2; i++) {
      try { return AI.normAction(await AI.call(prompt, { timeout: 110000 }), s); }
      catch (e) { last = e; if (e && ["unavailable", "not_granted", "sampling_disabled", "capability_disabled", "not_declared", "rate_limited", "refused"].includes(e.code)) break; }
    }
    throw last || new Error("échec");
  },

  /* ---------- Interview : le journaliste pose ses questions ---------- */
  async interview(s){
    const ch = GAME.ch(s);
    const o = await AI.call(`Dans « Legacy », simulateur de vie sérieux en français, un journaliste interviewe le personnage. Choisis un média réel et crédible à cette date pour ce personnage, puis pose 2 ou 3 questions courtes, précises et un peu délicates, liées à sa situation actuelle et à ses actions récentes. Pas de question sur sa vie intime, sa santé privée ou des affaires judiciaires.

${AI.context(s)}

MÉMOIRE DE LA PARTIE :
${AI.memory(s)}
${AI.rules(s)}
RÉPONDS UNIQUEMENT par un objet JSON : {"media":"…","questions":["…","…"]}`, { timeout: 70000 });
    const qs = (o && Array.isArray(o.questions) ? o.questions : []).slice(0, 3).map(q => String(q).slice(0, 240)).filter(Boolean);
    if (qs.length < 2) throw new Error("forme");
    return { media: String(o.media || "un grand média").slice(0, 60), questions: qs };
  },

  /* ---------- 2. Conseiller : avis avant l’envoi, sans consommer l’action ---------- */
  async advise(s, a){
    const ch = GAME.ch(s); const adv = ch.advisor(s); const tp = ch.speech.find(x => x.id === a.type);
    const o = await AI.call(`Tu joues ${adv.name}, ${adv.role}, conseiller du personnage dans « Legacy », simulateur historique sérieux en français. Ton caractère : ${adv.style}. Tu donnes ton avis AVANT que l’action soit lancée. C’est une reconstitution : ne cite aucune phrase réelle de ${adv.name}, parle à la première personne en le paraphrasant, en vouvoyant le personnage.

${AI.context(s)}

MÉMOIRE DE LA PARTIE :
${AI.memory(s)}

ACTION ENVISAGÉE — type : ${tp.label}${a.target ? ` — destinataire : ${a.target}` : ""}
« ${a.text} »

Dis franchement si l’action est possible à cette date, ce qu’elle risque de produire, et propose mieux si tu vois mieux. Reste bref et concret.
RÉPONDS UNIQUEMENT par un objet JSON : {"avis":"2 à 4 phrases","risques":["…","…"],"effets_probables":["…","…"],"alternatives":["…","…"]}`, { timeout: 80000 });
    if (!o || typeof o.avis !== "string") throw new Error("forme");
    const arr = x => (Array.isArray(x) ? x : []).slice(0, 4).map(t => String(t).slice(0, 220)).filter(Boolean);
    return { name: adv.name, role: adv.role, avis: o.avis.slice(0, 700), risques: arr(o.risques), effets: arr(o.effets_probables), alternatives: arr(o.alternatives) };
  },

  /* ---------- 3. Dépêches à choix (3 à 4 par an) ---------- */
  eventPrompt(s){
    const ch = GAME.ch(s);
    return `Tu es le moteur narratif de « Legacy », un simulateur de vie historique sérieux et réaliste, entièrement en français.

${AI.context(s)}

MÉMOIRE DE LA PARTIE :
${AI.memory(s)}
DERNIÈRES DÉCISIONS À CHOIX :
${s.history.slice(-6).map(h => `- ${frMonth(h.date)} — ${h.title} : ${h.choice}`).join("\n") || "- (début de partie)"}

CONSIGNES :
- Écris UN événement qui s’impose au personnage, plausible à cette date et dans cette situation précise : politique, militaire, diplomatique, économique, familial, santé. Il peut découler d’une action libre passée du joueur. Varie les thèmes.
- Appuie-toi sur des faits, des lieux, des institutions et des personnes réels de l’époque. Si les choix du joueur ont changé l’Histoire, fais réagir le monde de façon crédible. Ne raconte pas le prochain grand moment historique.
- Texte de 3 à 5 phrases, au présent, en vouvoyant le personnage. Ton sobre de récit historique.
${AI.rules(s)}
- Entre 2 et 4 choix, avec de vrais compromis. Effets proportionnés : la plupart entre 2 et 8 points, dans les bornes indiquées.
- « danger » facultatif : seulement si le choix expose physiquement le personnage (probabilité 0.01 à 0.08, cause de mort courte).

RÉPONDS UNIQUEMENT par un objet JSON de cette forme exacte :
{"titre":"…","lieu":"…","texte":"…","personnages":["id_relation_ou_nom"],"choix":[{"texte":"…","effets":{"popularite":-4,"tresor":30},"relations":{"talleyrand":6},"pays":{"autriche":-5},"danger":null,"resume":"…"}]}`;
  },
  normEvent(o, s){
    if (!o || typeof o !== "object") throw new Error("pas un objet");
    const title = String(o.titre || "").trim(), text = String(o.texte || "").trim();
    if (title.length < 3 || text.length < 60) throw new Error("texte manquant");
    if (!Array.isArray(o.choix) || o.choix.length < 2) throw new Error("choix manquants");
    const choices = o.choix.slice(0, 4).map(c => {
      const t = String(c.texte || "").trim(); if (!t) throw new Error("choix vide");
      const fx = AI.normFx({ jauges: c.effets, relations: c.relations, pays: c.pays }, s, 1);
      if (c.danger && typeof c.danger === "object" && Number(c.danger.p ?? c.danger.proba) > 0) fx.danger = { p: clamp(Number(c.danger.p ?? c.danger.proba), 0, .08), type: String(c.danger.type || "accident"), cause: String(c.danger.cause || "Mort brutale.").slice(0, 160) };
      return { t: t.slice(0, 200), res: String(c.resume || "").slice(0, 260), fx };
    });
    const people = (Array.isArray(o.personnages) ? o.personnages : []).slice(0, 6).map(p => AI.findRel(s, p) || String(p).slice(0, 40));
    return { id: "ai-" + Date.now().toString(36), title: title.slice(0, 90), place: String(o.lieu || s.place).slice(0, 80), text: text.slice(0, 1100), people, choices, scene: s.scene, forDate: s.date, rank: s.rank };
  },
  prefetch(s){
    if (!AI.usable() || AI.pending || AI.ready || AI.failures >= 4) return;
    const snap = JSON.parse(JSON.stringify(s)); const tok = AI.tok;
    AI.setStatus("busy", "Claude prépare la prochaine dépêche…");
    const p = AI.call(AI.eventPrompt(snap), { timeout: 90000 }).then(o => { const ev = AI.normEvent(o, snap); if (tok === AI.tok) { AI.ready = ev; AI.failures = 0; AI.setStatus("ok", "Dépêche prête"); return ev; } return null; })
      .catch(() => { AI.failures++; if (AI.available) AI.setStatus("ok", "Claude est prêt"); return null; }).finally(() => { if (AI.pending === p) AI.pending = null; });
    AI.pending = p;
  },
  take(s){ const e = AI.ready; AI.ready = null; if (!e) return null; if (e.rank !== s.rank || addDays(e.forDate, 240) < s.date) return null; return e; },
  reset(){ AI.tok++; AI.ready = null; for (const c of AI.ctls) c.abort(); AI.pending = null; },

  /* ---------- 4. Rivaux : leurs plans avancent tous les quelques mois ---------- */
  async rivals(s){
    const ch = GAME.ch(s);
    const list = ch.rivals.map(r => `- ${r.id} : ${r.name} — plan actuel : ${s.rivals[r.id].plan} — avancement ${s.rivals[r.id].prog} %`).join("\n");
    const o = await AI.call(`Tu fais vivre les rivaux du personnage dans « Legacy », simulateur historique sérieux en français. Chaque rival poursuit son propre plan, indépendamment du joueur, et réagit à la situation.

${AI.context(s)}

MÉMOIRE DE LA PARTIE :
${AI.memory(s)}

RIVAUX :
${list}

Fais avancer UN ou DEUX de ces plans de façon crédible pour l’époque (les autres ne bougent pas). Pour chacun : le plan (tu peux le faire évoluer ou le remplacer s’il est achevé ou devenu absurde), le nouvel avancement (0 à 100, en général +10 à +35), une annonce pour le fil d’actualité (source d’époque, titre, une ou deux phrases) et de petits effets (jauges entre -6 et +6, relations des pays entre -10 et +10). Si un plan atteint 100, décris son aboutissement dans l’annonce et donne des effets un peu plus forts.
${AI.rules(s)}
Ajoute aussi une courte revue de presse : 2 articles (un français, un étranger) qui commentent la situation actuelle ou une action récente du joueur, avec leur ton envers le personnage.\nRÉPONDS UNIQUEMENT par un objet JSON : {"rivaux":[{"id":"…","plan":"…","progression":45,"annonce":{"source":"…","titre":"…","texte":"…"},"effets":{"jauges":{"coalition":3},"pays":{"autriche":-4}}}],"presse":[{"source":"…","titre":"…","texte":"…","ton":"favorable|neutre|hostile"}]}`, { timeout: 90000 });
    if (!o || !Array.isArray(o.rivaux)) throw new Error("forme");
    const out = [];
    for (const r of o.rivaux.slice(0, 2)) {
      const def = ch.rivals.find(x => x.id === r.id); if (!def) continue; const v = s.rivals[def.id];
      const prog = clamp(Math.round(Number(r.progression) || v.prog), 0, 100); const done = prog >= 100;
      if (r.plan) v.plan = String(r.plan).slice(0, 160); v.prog = done ? 0 : prog;
      const fx = AI.normFx(r.effets, s, done ? 1 : .5); for (const k of Object.keys(fx.pays)) fx.pays[k].rel = clamp(fx.pays[k].rel, -12, 12);
      GAME.applyFx(s, fx);
      const n = { src: String(r.annonce?.source || ch.newsSources(s)[0]).slice(0, 60), title: String(r.annonce?.titre || def.name).slice(0, 140), text: String(r.annonce?.texte || "").slice(0, 400), tone: done ? "bad" : "", kind: "rival", ton: "hos" };
      GAME.news(s, n); out.push(n);
    }
    if (!out.length) throw new Error("vide");
    for (const a of (Array.isArray(o.presse) ? o.presse : []).slice(0, 2)) if (a && a.titre) GAME.news(s, { src: String(a.source || ch.newsSources(s)[1]).slice(0, 60), title: String(a.titre).slice(0, 140), text: String(a.texte || "").slice(0, 400), ton: a.ton });
    return out;
  },

  /* ---------- Correspondance : un contact répond, ou écrit de lui-même ---------- */
  thread(s, id){ const th = s.corr[id] || []; const last = th.slice(-12); return (th.length > last.length ? `(${th.length - last.length} lettres plus anciennes non reproduites)\n` : "") + (last.map(m => `- ${frDate(m.d)} — ${m.me ? "LE PERSONNAGE écrit" : "LE CONTACT écrit"} : « ${String(m.t).slice(0, 500)} »`).join("\n") || "- (aucun échange jusqu’ici)"); },
  async reply(s, id){
    const ch = GAME.ch(s); const r = GAME.relDef(s, id);
    const o = await AI.call(`Tu écris la réponse de ${r.name} (${r.role}) à une lettre du personnage, dans « Legacy », simulateur historique sérieux en français. C’est une reconstitution : écris dans sa personnalité, avec ses connaissances et ses intérêts réels à cette date, sans reprendre de phrases authentiques. Caractère : ${ch.persona[id] || r.bio}. ${r.bio}
Lieu du contact : ${ch.regionName(ch.contactLoc(s, id))}. Relation actuelle avec le personnage : ${Math.round(s.rel[id])} sur une échelle de -100 à +100 (${GAME.relStatusLabel[GAME.relStatus(s.rel[id])]}).

${AI.context(s)}

MÉMOIRE DE LA PARTIE :
${AI.memory(s)}

CORRESPONDANCE AVEC CE CONTACT (la dernière lettre du personnage est celle à laquelle tu réponds) :
${AI.thread(s, id)}

Écris une lettre de 2 à 5 phrases, à la première personne, dans le ton et les formules de l’époque et de ce lien (une épouse ne s’adresse pas comme un ministre ou un souverain ennemi). Le contact ne sait que ce qu’il peut savoir là où il est. Il peut accepter, refuser, marchander, flatter, se plaindre ou donner une information utile. Si la lettre reçue est anachronique ou incompréhensible pour lui, il s’en étonne.
${AI.rules(s)}
"relation" : l’effet de cet échange sur la relation, entre -8 et +8.
RÉPONDS UNIQUEMENT par un objet JSON : {"reponse":"…","relation":2}`, { timeout: 80000 });
    if (!o || typeof o.reponse !== "string" || o.reponse.trim().length < 5) throw new Error("forme");
    return { t: o.reponse.trim().slice(0, 900), rel: clamp(Math.round(Number(o.relation) || 0), -8, 8) };
  },
  async mail(s){
    const ch = GAME.ch(s); const ids = ch.contactGroups.flatMap(g => g[1]).filter(id => GAME.relAlive(s, id));
    const o = await AI.call(`Dans « Legacy », simulateur historique sérieux en français, un proche ou un correspondant du personnage lui écrit de lui-même. Choisis UN contact qui a une vraie raison d’écrire maintenant (demande, conseil, plainte, nouvelle, mise en garde) et rédige sa lettre, dans sa personnalité et avec ce qu’il peut savoir. C’est une reconstitution : aucune phrase authentique.

${AI.context(s)}

MÉMOIRE DE LA PARTIE :
${AI.memory(s)}

CONTACTS POSSIBLES (identifiant : caractère) :
${ids.map(id => `- ${id} : ${GAME.relDef(s, id).name} — ${ch.persona[id] || ""}${(s.corr[id] || []).length ? ` — dernier échange le ${frDate(s.corr[id][s.corr[id].length - 1].d)}` : ""}`).join("\n")}

Lettre de 2 à 4 phrases, à la première personne, dans le ton de l’époque. Varie les correspondants : évite ceux qui ont écrit récemment.
${AI.rules(s)}
RÉPONDS UNIQUEMENT par un objet JSON : {"id":"…","message":"…"}`, { timeout: 80000 });
    const id = o && AI.findRel(s, o.id); if (!id || !GAME.relAlive(s, id) || typeof o.message !== "string" || o.message.trim().length < 5) throw new Error("forme");
    return { id, t: o.message.trim().slice(0, 800) };
  },

  /* ---------- 5. Récit court d’une phase de bataille ---------- */
  async narrate(s, info){
    return String(await AI.call(`Tu racontes une phase de bataille dans « Legacy », simulateur historique sérieux en français. Écris 2 phrases, au présent, sobres et précises, sans citation inventée, à partir de ces faits calculés par le jeu (ne change aucun chiffre) :
${info}
Réponds par le texte seul.`, { tier: "quick", timeout: 20000, json: false })).trim().slice(0, 420);
  }
};
</script>
