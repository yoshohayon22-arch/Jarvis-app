<script>
"use strict";
/* =====================================================================
   MRBEAST (Jimmy Donaldson) — personne réelle et vivante : faits publics
   de sa carrière de créateur, aucune citation inventée, rien de diffamatoire.
   ===================================================================== */
(function(){
const sg = (v, d = 1) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(d).replace(".", ",")}`;
const MS = v => Math.abs(v) < 1 && v !== 0 ? `${Math.round(v * 1000)} k $` : `${Math.abs(v) >= 100 ? Math.round(v) : (Math.round(v * 10) / 10).toString().replace(".", ",")} M $`;
const MM = v => v >= 10 ? `${Math.round(v)} M` : `${(Math.round(v * 100) / 100).toString().replace(".", ",")} M`;
const once = (s, id) => s.wk[id] === s.week ? "Déjà fait cette semaine" : false;
const rnd = (a, b) => a + Math.random() * (b - a);

const TYPES = { defi: { label: "Défi d’endurance", mult: 1, cost: .2, weeks: 2, note: "Dernier à lâcher, 24 heures, 100 jours…" }, philanthropie: { label: "Philanthropie", mult: .9, cost: .5, weeks: 3, rep: 3, note: "Aider des gens, filmer le résultat." }, competition: { label: "Compétition à gros prix", mult: 1.25, cost: 1, weeks: 4, note: "Des candidats, des éliminations, un chèque." }, budget: { label: "Très gros budget", mult: 1.5, cost: 3, weeks: 6, note: "Décors géants, centaines de participants." }, comparatif: { label: "Du moins cher au plus cher", mult: 1.1, cost: .6, weeks: 3, note: "1 $ contre 1 000 000 $." }, collab: { label: "Collaboration", mult: 1.15, cost: .3, weeks: 2, note: "Avec un autre créateur ou une célébrité." } };

const B = CHARACTERS.mrbeast = {
  id: "mrbeast", name: "MrBeast", short: "MrBeast", role: "Créateur YouTube et entrepreneur (Jimmy Donaldson)", theme: "theme-studio",
  art: "linear-gradient(160deg,#3c2160,#120a20)", born: "1998-05-07", birthplace: "Wichita, Kansas", unit: { label: "semaine", days: 7 },
  portrait: s => ART.creator({ age: s ? GAME.age(s) : 18 }),
  realStatus: { title: "Son parcours réel (à la mi-2026)", text: "Sa chaîne principale devient la plus suivie au monde en juin 2024 et dépasse les 400 millions d’abonnés en 2025. Il a lancé la marque de chocolat Feastables, l’émission Beast Games sur Prime Video et la chaîne caritative Beast Philanthropy." },
  realTimeline: "Il publie sa première vidéo à 13 ans, perce en 2017 en comptant jusqu’à 100 000, puis fait de la surenchère de budgets et de dons sa marque de fabrique.",
  histLabel: "Moment réel", accidentCause: "Mort dans un accident.", suddenCause: "Mort subitement", mortality: .35,
  groups: { chaine: "Chaîne", vie: "Santé" },
  stats: [
    { id: "abonnes", label: "Abonnés", group: "chaine", min: 0, max: 2000, barMax: 500, fmt: MM, bad: "low", warn: -1, danger: -1, aiMax: 8, hint: "Abonnés de la chaîne principale, en millions" },
    { id: "vues", label: "Vues par mois", group: "chaine", min: 0, max: 20000, barMax: 4000, fmt: MM, bad: "low", warn: -1, danger: -1, aiMax: 100, hint: "Vues mensuelles, toutes vidéos confondues, en millions" },
    { id: "algo", label: "Faveur de l’algorithme", group: "chaine", min: 0, max: 100, bad: "low", aiMax: 8, hint: "À quel point la plateforme recommande vos vidéos" },
    { id: "tresorerie", label: "Trésorerie", group: "chaine", min: -100, max: 20000, barMax: 500, fmt: MS, bad: "low", warn: .2, danger: 0, aiMax: 5, hint: "Argent disponible pour produire" },
    { id: "equipe", label: "Moral de l’équipe", group: "chaine", min: 0, max: 100, bad: "low", aiMax: 10, hint: "Énergie et fidélité des équipes" },
    { id: "reputation", label: "Réputation", group: "chaine", min: 0, max: 100, bad: "low", aiMax: 10, hint: "Image auprès du public et des marques" },
    { id: "badbuzz", label: "Risque de bad buzz", group: "chaine", min: 0, max: 100, bad: "high", aiMax: 12, hint: "Polémiques latentes" },
    { id: "sante", label: "Santé", group: "vie", min: 0, max: 100, bad: "low", aiMax: 6 }, { id: "fatigue", label: "Fatigue", group: "vie", min: 0, max: 100, bad: "high", aiMax: 12 }, { id: "stress", label: "Stress", group: "vie", min: 0, max: 100, bad: "high", aiMax: 12 }
  ],
  ranks: { createur: { label: "Créateur YouTube", power: 2 }, retire: { label: "Retiré des écrans", power: 0 } },
  rankLabel: s => s.rank === "retire" ? "Retiré des écrans" : `${MM(s.stats.abonnes)} d’abonnés`,
  statusLabel: s => s.prod ? `En tournage : ${s.prod.w} sem.` : "Entre deux vidéos",

  relations: [
    { id: "sue", name: "Sue Donaldson", role: "Mère", bio: "Ancienne militaire, elle l’a élevé en Caroline du Nord et travaille à ses côtés.", from: "1998-05-07", start: 80 },
    { id: "chandler", name: "Chandler Hallow", role: "Ami et visage de la chaîne", bio: "Ancien homme à tout faire de l’équipe, devenu l’un des personnages préférés du public.", from: "2017-01-01", start: 75 },
    { id: "karl", name: "Karl Jacobs", role: "Ami et visage de la chaîne", bio: "Arrivé comme monteur, passé devant la caméra en 2020.", from: "2019-01-01", start: 70 },
    { id: "nolan", name: "Nolan Hansen", role: "Ami et visage de la chaîne", bio: "Créateur recruté dans l’équipe à l’écran.", from: "2021-01-01", start: 65 },
    { id: "reed", name: "Reed Duchscher", role: "Manager et associé", bio: "Agent de créateurs, il négocie contrats et partenariats.", from: "2018-01-01", start: 70 },
    { id: "rober", name: "Mark Rober", role: "Créateur, ancien ingénieur", bio: "Vulgarisateur scientifique, partenaire des collectes Team Trees et Team Seas.", from: "2019-05-01", start: 60 },
    { id: "pewdiepie", name: "PewDiePie", role: "Créateur suédois", bio: "Longtemps le créateur individuel le plus suivi de la plateforme.", from: "2017-01-01", start: 30 },
    { id: "logan", name: "Logan Paul", role: "Créateur et entrepreneur", bio: "Créateur américain, cofondateur de marques de boissons.", from: "2019-01-01", start: 25 },
    { id: "ksi", name: "KSI", role: "Créateur et entrepreneur britannique", bio: "Créateur, musicien, cofondateur de marques.", from: "2019-01-01", start: 25 }
  ],
  starts: [
    { id: "2017", date: "2017-01-01", year: "2017", title: "Trente mille abonnés", summary: "18 ans. Vous venez de quitter l’université après deux semaines. Vous filmez dans votre chambre, à Greenville, avec quelques amis et presque pas d’argent.",
      rank: "createur", scene: "studio", place: "Greenville, Caroline du Nord", stats: { abonnes: .03, vues: .6, algo: 45, tresorerie: .004, equipe: 70, reputation: 55, badbuzz: 5, sante: 92, fatigue: 30, stress: 35 }, team: 0 },
    { id: "2019", date: "2019-01-01", year: "2019", title: "Le plus généreux de la plateforme", summary: "20 ans. Quinze millions d’abonnés. Vous réinvestissez tout dans des vidéos où vous distribuez voitures, maisons et liasses de billets.",
      rank: "createur", scene: "studio", place: "Greenville, Caroline du Nord", stats: { abonnes: 15, vues: 280, algo: 68, tresorerie: 1.2, equipe: 75, reputation: 72, badbuzz: 8, sante: 90, fatigue: 40, stress: 40 }, team: 1 },
    { id: "2022", date: "2022-01-01", year: "2022", title: "L’entreprise MrBeast", summary: "23 ans. Près de 90 millions d’abonnés après votre reconstitution d’un jeu télévisé coréen à 3,5 millions de dollars. Une marque de chocolat est prête à sortir.",
      rank: "createur", scene: "studio", place: "Greenville, Caroline du Nord", stats: { abonnes: 88, vues: 1400, algo: 80, tresorerie: 14, equipe: 68, reputation: 78, badbuzz: 12, sante: 86, fatigue: 50, stress: 50 }, team: 3, biz: { burger: 2020, gaming: 2020, doublage: 2021 } },
    { id: "2024", date: "2024-01-01", year: "2024", title: "Vers la première place mondiale", summary: "25 ans. 225 millions d’abonnés. La chaîne indienne T-Series est encore devant, de peu. Un tournage géant pour une plateforme de streaming se prépare.",
      rank: "createur", scene: "studio", place: "Greenville, Caroline du Nord", stats: { abonnes: 225, vues: 2600, algo: 84, tresorerie: 40, equipe: 62, reputation: 76, badbuzz: 20, sante: 84, fatigue: 55, stress: 55 }, team: 4, biz: { burger: 2020, gaming: 2020, doublage: 2021, feastables: 2022 } }
  ],
  eraNotes: {
    2017: "YouTube traverse la crise de la démonétisation des annonceurs. PewDiePie domine le classement des créateurs. Le format « dernier à lâcher » émerge.", 2018: "Les vidéos de dons et de défis explosent. Course aux abonnés entre PewDiePie et T-Series.",
    2019: "T-Series devient la chaîne la plus suivie. Collecte Team Trees : 20 millions de dollars pour 20 millions d’arbres. TikTok monte en puissance.", 2020: "Pandémie : audiences record. Lancement de la chaîne Beast Philanthropy et de MrBeast Burger en cuisines fantômes.",
    2021: "Collecte Team Seas. Reconstitution d’un jeu télévisé coréen à 3,5 millions de dollars, l’une des vidéos les plus vues de l’année. Doublage des vidéos en plusieurs langues.", 2022: "Lancement des barres chocolatées Feastables. Il devient le créateur individuel le plus suivi. YouTube Shorts concurrence TikTok.",
    2023: "Vidéo finançant mille opérations de la cataracte, qui déclenche un débat sur la philanthropie filmée. Différend public avec le partenaire de MrBeast Burger.", 2024: "Sa chaîne dépasse T-Series en juin. Tournage de Beast Games pour Prime Video ; critiques sur les conditions de tournage et la culture d’entreprise ; audit interne annoncé.",
    2025: "Beast Games bat des records d’audience sur Prime Video. Feastables devient rentable ; la chaîne passe les 400 millions d’abonnés.", 2026: "L’intelligence artificielle transforme la production vidéo ; les plateformes multiplient les émissions de créateurs."
  },
  events: [
    { id: "compter2017", date: "2017-01-08", until: "2017-02-15", title: "Compter jusqu’à 100 000", place: "Greenville", scene: "studio", people: [],
      text: "Vous cherchez une idée que personne n’oserait tenter. Compter à voix haute jusqu’à cent mille, face caméra, sans tricher : il faudrait une quarantaine d’heures. Personne ne regardera tout, mais tout le monde cliquera pour voir si c’est vrai.",
      real: "Il le fait, en une quarantaine d’heures, et accélère certains passages pour tenir dans la limite de durée de la plateforme. La vidéo dépasse les millions de vues et lance sa chaîne.",
      choices: [{ t: "Le faire, en entier", hist: true, res: "Quarante heures plus tard, vous n’avez plus de voix, et la vidéo décolle.", fx: { s: { abonnes: .25, vues: 6, algo: 12, fatigue: 25, sante: -3 } } }, { t: "Une version courte : compter jusqu’à 10 000", res: "La vidéo marche correctement, sans faire parler.", fx: { s: { abonnes: .03, vues: 1, algo: 3, fatigue: 8 } } }] },
    { id: "don2017", date: "2017-06-10", until: "2017-08-01", title: "Le premier sponsor", place: "Greenville", scene: "studio", people: ["sue"],
      text: "Une application vous propose 10 000 dollars pour une intégration. C’est plus d’argent que vous n’en avez jamais eu. Vous pourriez acheter du matériel, ou en faire le sujet de la vidéo.",
      real: "Il donne la totalité de la somme à un sans-abri et filme la scène. Le format du don spectaculaire devient sa signature.",
      choices: [{ t: "Tout donner à un inconnu et filmer", hist: true, res: "La vidéo fait le tour de la plateforme ; les marques rappellent.", fx: { s: { abonnes: .4, vues: 12, reputation: 10, algo: 6 } } }, { t: "Investir dans des caméras et un monteur", res: "Vos vidéos gagnent en qualité.", fx: { s: { tresorerie: .01, algo: 2, equipe: 4 } } }] },
    { id: "arbres2019", date: "2019-10-25", until: "2019-12-01", cond: s => s.stats.abonnes >= 5, title: "Vingt millions d’arbres", place: "Greenville", scene: "studio", people: ["rober"],
      text: "Pour fêter vos vingt millions d’abonnés, des fans vous mettent au défi de planter vingt millions d’arbres. Avec l’ingénieur et créateur Mark Rober, vous pourriez monter une collecte ouverte à toute la plateforme : un dollar, un arbre.",
      real: "La collecte Team Trees est lancée le 25 octobre 2019 et atteint 20 millions de dollars avant la fin de l’année, avec des centaines de créateurs.",
      choices: [{ t: "Lancer la collecte avec Mark Rober", hist: true, res: "Des centaines de créateurs relaient ; l’objectif est atteint en moins de deux mois.", fx: { s: { reputation: 12, abonnes: 2, vues: 60, fatigue: 8 }, r: { rober: 15 }, call: { fn: "don", v: 20, lieu: "amnord" } } }, { t: "Planter les arbres avec votre seul budget, à plus petite échelle", res: "Une belle vidéo, sans mouvement collectif.", fx: { s: { reputation: 4, tresorerie: -.3, vues: 20 }, call: { fn: "don", v: .3, lieu: "amnord" } } }] },
    { id: "burger2020", date: "2020-12-19", until: "2021-02-01", cond: s => !s.biz.burger, title: "Un restaurant sans salle", place: "Greenville", scene: "studio", people: ["reed"],
      text: "Un partenaire propose de vendre des burgers à votre nom dans trois cents cuisines de restaurants existants, en livraison uniquement. Vous ne contrôlerez pas ce qui sort des cuisines.",
      real: "MrBeast Burger ouvre le 19 décembre 2020 dans 300 points de livraison. Le succès est immédiat ; la qualité inégale le conduit en 2023 à un différend public avec son partenaire.",
      choices: [{ t: "Lancer les 300 points de vente d’un coup", hist: true, res: "Files d’attente géantes pour l’ouverture.", fx: { s: { tresorerie: 2, abonnes: 1.5, badbuzz: 6 }, call: { fn: "biz", id: "burger" } } }, { t: "Tester d’abord dans dix villes en contrôlant la qualité", res: "Lancement discret, clients satisfaits.", fx: { s: { tresorerie: .2, reputation: 3 }, call: { fn: "biz", id: "burger" } } }, { t: "Refuser", res: "Vous restez concentré sur les vidéos.", fx: { s: { equipe: 2 } } }] },
    { id: "jeu2021", date: "2021-11-10", until: "2021-12-10", cond: s => s.stats.abonnes >= 30, title: "Reconstituer le jeu", place: "Greenville", scene: "studio", people: ["chandler", "karl"],
      text: "Une série coréenne où des candidats s’affrontent dans des jeux d’enfants est devenue le phénomène de l’automne. Vos équipes ont chiffré une reconstitution des décors, sans la violence : 456 participants, 456 000 dollars pour le vainqueur, environ 3,5 millions de dollars au total.",
      real: "La vidéo sort le 24 novembre 2021 et dépasse les 100 millions de vues en quelques jours. C’est l’une des vidéos les plus vues de l’histoire de la plateforme.",
      choices: [{ t: "Tout construire, en vrai", hist: true, res: "Sept semaines de chantier, une vidéo record.", fx: { s: { tresorerie: -3.5, abonnes: 14, vues: 400, algo: 8, equipe: -6, fatigue: 15 } } }, { t: "Une version réduite à 500 000 dollars", res: "Très regardée, vite oubliée.", fx: { s: { tresorerie: -.5, abonnes: 4, vues: 120 } } }] },
    { id: "chocolat2022", date: "2022-01-29", until: "2022-03-15", cond: s => !s.biz.feastables, title: "Une barre de chocolat", place: "Greenville", scene: "studio", people: ["reed"],
      text: "Votre équipe a mis au point une barre chocolatée à la liste d’ingrédients courte. Le lancement peut s’appuyer sur une vidéo : une chocolaterie géante, des tickets gagnants, une usine à gagner.",
      real: "Feastables est lancée le 29 janvier 2022 et écoule plus d’un million de barres en quelques jours. La marque entre ensuite dans la grande distribution et devient l’activité la plus rentable du groupe.",
      choices: [{ t: "Lancer la marque avec une vidéo géante", hist: true, res: "Ruptures de stock en trois jours.", fx: { s: { tresorerie: -2, abonnes: 3, reputation: 2 }, call: { fn: "biz", id: "feastables" } } }, { t: "Rester créateur et ne pas vendre de produits", res: "Votre image reste celle du donateur.", fx: { s: { reputation: 3 } } }] },
    { id: "cataracte2023", date: "2023-01-28", until: "2023-03-01", cond: s => s.stats.abonnes >= 40, title: "Mille opérations", place: "Greenville", scene: "studio", people: [],
      text: "Une opération de la cataracte dure dix minutes et rend la vue. Vous pouvez en financer mille, dans plusieurs pays, et filmer le moment où les pansements tombent. Certains diront que la charité ne se filme pas.",
      real: "La vidéo sort le 28 janvier 2023. Très vue, elle déclenche un débat public : générosité pour les uns, mise en scène de la détresse pour les autres. Il répond que les vidéos financent les dons.",
      choices: [{ t: "Financer les opérations et publier la vidéo", hist: true, res: "Des millions de vues, et un vrai débat.", fx: { s: { tresorerie: -1, reputation: 5, badbuzz: 6, abonnes: 5, vues: 150 }, call: { fn: "don", v: 1, lieu: "afrique" } } }, { t: "Financer sans filmer", res: "Personne ne le saura ; la chaîne caritative n’en profite pas.", fx: { s: { tresorerie: -1, stress: -4 }, call: { fn: "don", v: 1, lieu: "afrique" } } }] },
    { id: "audit2024", date: "2024-08-07", until: "2024-09-15", cond: s => s.team >= 3, title: "Une croissance trop rapide", place: "Greenville", scene: "studio", people: ["reed"],
      text: "Pendant l’été, les critiques publiques se multiplient : des participants à votre grand tournage se plaignent de son organisation, d’anciens salariés décrivent un rythme de travail éprouvant. L’entreprise a grandi plus vite que son encadrement.",
      real: "Il annonce une enquête confiée à un cabinet extérieur, puis le recrutement de cadres dirigeants et une formation obligatoire pour les équipes.",
      choices: [{ t: "Commander un audit extérieur et recruter des dirigeants expérimentés", hist: true, res: "Le rythme ralentit quelques mois ; l’entreprise se structure.", fx: { s: { badbuzz: -15, reputation: 3, tresorerie: -2, equipe: 8, algo: -3 }, f: { audit: true } } }, { t: "Répondre point par point dans une vidéo", res: "Vos fans vous soutiennent ; la presse reste sceptique.", fx: { s: { badbuzz: -4, reputation: -2 } } }, { t: "Ne rien dire et continuer à produire", res: "Le sujet revient à chaque sortie.", fx: { s: { badbuzz: 10, equipe: -6 } } }] },
    { id: "games2024", date: "2024-12-19", until: "2025-02-01", cond: s => !s.biz.games && s.stats.abonnes >= 100, title: "Mille candidats, cinq millions de dollars", place: "Toronto et Las Vegas", scene: "studio", people: ["chandler", "karl", "nolan"],
      text: "Une plateforme de streaming diffuse votre émission de compétition : mille candidats, le plus gros prix individuel de l’histoire de la télévision. Le tournage a coûté bien plus que prévu ; vous avez comblé la différence de votre poche.",
      real: "Beast Games sort le 19 décembre 2024 sur Prime Video et devient l’émission sans scénario la plus regardée de la plateforme. Il déclare y avoir perdu de l’argent ; la série est renouvelée.",
      choices: [{ t: "Diffuser et porter la promotion vous-même", hist: true, res: "Record d’audience pour la plateforme.", fx: { s: { abonnes: 12, reputation: 4, tresorerie: -8, fatigue: 12 }, call: { fn: "biz", id: "games" } } }, { t: "Renégocier le budget avant toute suite", res: "Les discussions sont longues, mais la deuxième saison sera rentable.", fx: { s: { tresorerie: -2, equipe: 3 }, call: { fn: "biz", id: "games" } } }] }
  ],
  randomEvents: [
    { id: "algo", cond: s => s.rank !== "retire", title: "La plateforme change ses règles", people: [], scene: "studio", text: "La plateforme annonce qu’elle recommandera davantage les vidéos qui retiennent les spectateurs jusqu’au bout, et moins celles qui font cliquer puis décrocher.",
      choices: [{ t: "Refaire le montage de toutes les vidéos en cours", res: "Trois semaines de retard, de meilleures vidéos.", fx: { s: { algo: 6, equipe: -4, fatigue: 5 } } }, { t: "Ne rien changer", res: "Vos chiffres tiennent, pour l’instant.", fx: { s: { algo: -5 } } }] },
    { id: "sponsor", cond: s => s.stats.abonnes >= 1, title: "Une offre trop belle", people: ["reed"], scene: "studio", text: "Un site de paris en ligne propose le plus gros contrat que vous ayez jamais reçu pour une seule intégration. Une bonne partie de votre public est mineure.",
      choices: [{ t: "Refuser", res: "L’argent part chez un concurrent.", fx: { s: { reputation: 4 } } }, { t: "Accepter", res: "Le virement arrive ; les critiques aussi.", fx: { s: { tresorerie: 1.5, reputation: -8, badbuzz: 10 } } }] },
    { id: "burnout", cond: s => s.team >= 2 && s.stats.equipe < 60, title: "Un monteur craque", people: ["chandler"], scene: "studio", text: "Votre meilleur monteur n’a pas pris un jour de repos depuis quatre mois. Il vous demande une semaine, en plein rush avant une sortie.",
      choices: [{ t: "Lui donner deux semaines et décaler la sortie", res: "L’équipe apprécie le geste.", fx: { s: { equipe: 10, algo: -2 } } }, { t: "Lui demander de tenir jusqu’à la sortie", res: "La vidéo sort à l’heure. Il démissionne le mois suivant.", fx: { s: { equipe: -10, badbuzz: 4 } } }] },
    { id: "copie", cond: s => s.stats.abonnes >= 5, title: "Vos formats sont copiés", people: [], scene: "studio", text: "Trois chaînes reprennent vos titres, vos miniatures et jusqu’à vos décors. L’une d’elles vient de vous dépasser sur une vidéo.",
      choices: [{ t: "Monter d’un cran : un format que personne ne peut copier", res: "Plus cher, plus risqué, inimitable.", fx: { s: { algo: 4, tresorerie: -.3, stress: 5 } } }, { t: "Les inviter à collaborer", res: "Vous transformez des concurrents en alliés.", fx: { s: { reputation: 3, abonnes: .5 } } }] },
    { id: "repos", cond: s => s.stats.fatigue > 60, title: "Trop de nuits blanches", people: ["sue"], scene: "studio", text: "Votre mère vous fait remarquer que vous n’avez pas quitté le studio depuis des semaines. Trois vidéos sont en retard.",
      choices: [{ t: "Prendre une semaine de vraies vacances", res: "Vous revenez avec dix idées.", fx: { s: { fatigue: -30, stress: -15, algo: -2 }, r: { sue: 6 } } }, { t: "Continuer", res: "Le corps tiendra bien encore un peu.", fx: { s: { fatigue: 8, sante: -4 } } }] }
  ],
  legends: [
    { title: "Le Numéro un", cond: s => s.stats.abonnes >= 300, text: "Personne, sur la plateforme, n’a jamais été autant suivi." },
    { title: "Le Philanthrope", cond: s => s.dons >= 50 && s.stats.reputation >= 70, text: "Tes vidéos ont financé des puits, des arbres, des opérations, des maisons." },
    { title: "Le Chocolatier", cond: s => Object.keys(s.biz).length >= 5, text: "Le créateur est devenu un groupe." },
    { title: "L’Enfant de l’algorithme", cond: s => s.videos.length >= 60, text: "Tu as compris la machine mieux qu’elle ne se comprend." },
    { title: "L’Étoile filante", cond: s => s.stats.abonnes < 5, text: "Une idée folle, un moment de gloire." },
    { title: "Le Showman", cond: () => true, text: "Plus gros, plus cher, plus généreux : ta recette a changé la plateforme." }
  ],
  aiBrief: "MrBeast (Jimmy Donaldson, né en 1998), créateur YouTube américain et entrepreneur. Ton : simulateur sérieux de l’économie des créateurs, factuel, style presse spécialisée.",
  aiRules: ["Personne réelle et vivante : uniquement des faits publics. N’invente aucune citation présentée comme réelle ; les paroles sont paraphrasées, sans guillemets.", "Rien de diffamatoire : aucune accusation non établie contre lui, ses proches, ses collaborateurs ou d’autres créateurs ; rien sur la vie intime ou la santé privée.", "Reste neutre et réaliste sur les chiffres : audiences, coûts de production, revenus publicitaires, réactions du public et des marques."]
};

/* ---------------- Carte du monde : tournages et actions ---------------- */
const W = (id, name, pts, c) => ({ id, name, pts, c, adj: [] });
B.map = { title: "Tournages et activités", viewBox: "120 40 820 480", regions: [W("amnord", "Amérique du Nord", "140,70 330,70 318,228 210,250 150,222", [235, 150]), W("amlat", "Amérique latine", "172,255 275,258 345,330 352,470 302,500 268,420 222,322", [290, 380]), W("europe", "Europe", "425,104 574,104 580,205 430,210", [502, 158]), W("afrique", "Afrique", "440,225 590,222 596,330 556,442 500,432 462,330", [518, 330]), W("moyenorient", "Moyen-Orient", "600,215 712,205 712,300 610,310", [656, 258]), W("asie", "Asie", "590,60 928,60 928,250 862,262 720,300 720,200 590,200", [800, 150]), W("oceanie", "Océanie", "780,360 900,360 905,440 790,445", [842, 402]), W("antarctique", "Antarctique", "300,490 760,490 760,515 300,515", [530, 503])],
  statusLabel: { home: "Base", allie: "Tournage réalisé", vassal: "Action caritative", paix: "Pas encore visité" },
  status(s, id){ if (id === "amnord") return "home"; if (s.lieux[id] && s.lieux[id].don) return "vassal"; if (s.lieux[id] && s.lieux[id].tour) return "allie"; return "paix"; },
  markers(s){ const out = [{ id: "base", region: "amnord", moving: false, label: "★", title: "Studio de Greenville" }]; if (s.prod && s.prod.lieu !== "amnord") out.push({ id: "prod", region: s.prod.lieu, moving: true, label: "▶", title: `Tournage en cours : ${s.prod.title}` }); return out; } };
B.regionName = id => id === "ligne" ? "par message" : (B.map.regions.find(r => r.id === id) || { name: id }).name;
B.mapInfo = (s, id) => { const l = s.lieux[id] || {}; const st = B.map.status(s, id); const vids = s.videos.filter(v => v.lieu === id);
  return `<div class="map-info"><button class="x" data-do="mapclose" aria-label="Fermer">×</button><h3>${esc(B.regionName(id))} <span class="chip ${st === "paix" ? "neutre" : "allie"}">${esc(B.map.statusLabel[st])}</span></h3>
    <span class="note">${vids.length ? `${vids.length} vidéo${vids.length > 1 ? "s" : ""} tournée${vids.length > 1 ? "s" : ""} ici, dont « ${esc(vids[vids.length - 1].title)} ».` : "Aucun tournage ici pour l’instant."}${l.don ? ` Dons engagés : ${MS(l.don)}.` : ""}</span>
    <div class="ops"><button class="btn small primary" data-do="char|video|${id}" ${s.prod || s.rank === "retire" ? "disabled" : ""}>Tourner une vidéo ici</button></div></div>`; };

/* ---------------- Mise en place ---------------- */
B.defaultPol = { salaires: 100, cadence: 1, sponsors: 1, ethique: 1, part: 1, train: 0, reseaux: 2, shorts: 1 };
B.teams = [["Vous et quelques amis", .005], ["Une dizaine de personnes", .06], ["Une cinquantaine de salariés", .35], ["Environ 150 salariés", 1.1], ["Plus de 300 salariés", 2.4]];
B.setup = (s, startId) => { const st = B.starts.find(x => x.id === startId) || B.starts[0]; s.team = st.team; s.pol = { ...B.defaultPol }; s.wk = {}; s.biz = { ...(st.biz || {}) }; s.videos = []; s.prod = null; s.lieux = {}; s.dons = startId === "2024" ? 60 : startId === "2022" ? 50 : 0; s.studio = Math.min(2, st.team > 2 ? 2 : st.team > 0 ? 1 : 0); s.rivals = {}; for (const r of B.rivals) s.rivals[r.id] = { plan: r.plans[0].plan, prog: Math.round(Math.random() * 30), i: 0 }; };
B.sync = s => {};

/* ---------------- Entreprises ---------------- */
B.bizList = [
  { id: "gaming", label: "Chaînes secondaires (jeux, réactions)", year: 2020, cost: .2, inc: .12, note: "Du contenu moins cher, publié plus souvent." },
  { id: "philanthropy", label: "Chaîne Beast Philanthropy", year: 2020, cost: .3, inc: 0, note: "Tous ses revenus financent une banque alimentaire et des dons.", rep: 6 },
  { id: "burger", label: "MrBeast Burger", year: 2020, cost: .5, inc: .25, note: "Burgers en livraison, préparés par des restaurants partenaires." },
  { id: "doublage", label: "Doublage en plusieurs langues", year: 2021, cost: .4, inc: .3, note: "Vos vidéos en espagnol, hindi, portugais, français…", subs: 1.25 },
  { id: "feastables", label: "Feastables (chocolat et snacks)", year: 2022, cost: 3, inc: 1.6, note: "Votre marque en grande distribution." },
  { id: "games", label: "Beast Games sur une plateforme de streaming", year: 2024, cost: 15, inc: 1.2, note: "Une émission de compétition à très gros budget." },
  { id: "lunchly", label: "Lunchly (repas pour enfants, avec deux autres créateurs)", year: 2024, cost: 2, inc: .5, note: "Une marque lancée à trois.", buzz: 5 }
];
B.rpm = y => y < 2018 ? .0016 : y < 2021 ? .0026 : .0034;   // revenu publicitaire, en M $ par million de vues
B.budget = s => { const p = s.pol, st = s.stats, y = parseD(s.date).y; const rec = [], dep = [];
  rec.push(["Publicité de la plateforme", st.vues * B.rpm(y) * (st.reputation < 40 ? .7 : 1)]);
  for (const b of B.bizList) if (s.biz[b.id] && b.inc) rec.push([b.label.split(" (")[0], b.inc * (.4 + st.abonnes / 180) * (st.reputation / 75)]);
  if (st.abonnes >= 1) rec.push(["Produits dérivés", st.abonnes * .004 * (st.reputation / 75)]);
  dep.push(["Salaires", B.teams[s.team][1] * p.salaires / 100]); dep.push(["Studio et matériel", [.002, .05, .3, .9][s.studio]]);
  const brut = rec.reduce((t, x) => t + x[1], 0); if (p.part) dep.push(["Dons réguliers", brut * [0, .05, .15, .3][p.part]]);
  dep.push(["Train de vie", [.003, .02, .1][p.train]]);
  const R = brut, D = dep.reduce((t, x) => t + x[1], 0); return { rec, dep, R, D, solde: R - D }; };
B.fin = { stat: "tresorerie", unit: "M $", chartTitle: "Trésorerie sur les douze derniers mois, en millions de dollars",
  kpis: (s, b, f) => [["Trésorerie", MS(s.stats.tresorerie)], ["Revenus par mois", "+" + MS(b.R)], ["Dépenses par mois", "−" + MS(b.D)], ["Solde par mois", sg(b.solde, 2) + " M $"], ["Dons cumulés", MS(s.dons)], ["Vidéos publiées", s.videos.length]] };

/* ---------------- Vidéos : production, sortie, prédiction ---------------- */
B.baseViews = (s, v) => { const st = s.stats, t = TYPES[v.type]; const y = parseD(s.date).y; const ref = Math.max(.02, st.abonnes * .09) + .05; const bud = 1 + Math.log10(1 + v.budget / ref) * .55;
  const team = [.75, .9, 1, 1.08, 1.12][s.team] * (.7 + st.equipe / 330); return Math.max(.02, (st.abonnes * 1.3 + .25) * (.45 + st.algo / 90) * t.mult * bud * team * (s.biz.doublage ? 1.2 : 1)); };
B.weeksFor = (s, v) => Math.max(1, Math.round(TYPES[v.type].weeks * [1.5, 1.2, 1, .85, .75][s.team] * [1.3, 1, .75][s.pol.cadence] + (v.lieu !== "amnord" ? 1 : 0)));
B.start = (s, v) => { s.stats.tresorerie -= v.budget; s.prod = { ...v, w: B.weeksFor(s, v), d: s.date }; GAME.news(s, { src: "Carnet", title: "Tournage lancé", text: `« ${v.title} » : ${TYPES[v.type].label.toLowerCase()}, budget ${MS(v.budget)}, sortie dans ${s.prod.w} semaine${s.prod.w > 1 ? "s" : ""}.`, tone: "key" }); };
B.aiVideo = async (s, v, base) => {
  const o = await AI.call(`Tu es le moteur de « Legacy », simulateur sérieux en français. Le joueur incarne le créateur et sort une vidéo. Juge-la comme le ferait le public de la plateforme à cette date : force du concept, clarté et promesse du titre, efficacité de la miniature, adéquation du budget. Ne juge pas l’orthographe.

${AI.context(s)}

VIDÉO QUI SORT
- Type : ${TYPES[v.type].label}
- Titre : « ${v.title} »
- Concept : ${v.concept}
- Miniature : ${v.thumb || "(non décrite)"}
- Budget : ${v.budget} million(s) de dollars · Lieu : ${B.regionName(v.lieu)}
- Audience attendue pour une vidéo moyenne de ce type avec ce budget : ${base.toFixed(1)} millions de vues le premier mois.
DERNIÈRES VIDÉOS : ${s.videos.slice(-5).map(x => `« ${x.title} » (${x.views.toFixed(0)} M)`).join(" ; ") || "aucune"}

"multiplicateur" : entre 0.3 (ratée, déjà vue, titre flou) et 3 (idée exceptionnelle, jamais faite, titre irrésistible) ; 1 = dans la moyenne. Pénalise la répétition d’un concept récent. "retention" : part moyenne de la vidéo regardée, de 20 à 80. Si le concept est dangereux, humiliant ou trompeur, les effets doivent le refléter (réputation, risque de bad buzz).
${AI.rules(s)}
RÉPONDS UNIQUEMENT par un objet JSON : {"multiplicateur":1.2,"retention":55,"verdict":"2 phrases sur ce qui marche ou non","effets":{"jauges":{"reputation":2,"badbuzz":3,"algo":2}},"presse":[{"source":"…","titre":"…","texte":"…","ton":"favorable|neutre|hostile"}],"commentaires":[{"qui":"…","texte":"…"}]}`, { timeout: 90000 });
  if (!o || !isFinite(Number(o.multiplicateur))) throw new Error("forme");
  return { mult: clamp(Number(o.multiplicateur), .3, 3), ret: clamp(Math.round(Number(o.retention) || 50), 20, 80), verdict: String(o.verdict || "").slice(0, 400), fx: AI.normFx(o.effets, s, 1), news: (Array.isArray(o.presse) ? o.presse : []).slice(0, 3).map(n => ({ src: String(n.source || "Presse spécialisée").slice(0, 60), title: String(n.titre || "").slice(0, 140), text: String(n.texte || "").slice(0, 300), ton: n.ton })).filter(n => n.title), comments: (Array.isArray(o.commentaires) ? o.commentaires : []).slice(0, 5).map(c => ({ qui: String(c.qui || "").slice(0, 50), texte: String(c.texte || c).slice(0, 200) })) };
};
B.release = async s => {
  const v = s.prod; s.prod = null; const base = B.baseViews(s, v); if (s.speed > 0) UI.resumeSpeed = s.speed; LOOP.setSpeed(0);
  const ov = UI.openModal(`<div class="loading"><div class="quill" aria-hidden="true"></div><h2>« ${esc(v.title)} » est en ligne</h2><p class="muted">Les premières heures décident de tout. Les compteurs tournent…</p></div>`, { scene: "studio" });
  let r = null; if (AI.usable()) { try { r = await B.aiVideo(s, v, base); } catch (e) { r = null; } }
  if (GAME.s !== s) return;
  if (!r) { const m = clamp(rnd(.55, 1.6) * (s.videos.slice(-4).filter(x => x.type === v.type).length >= 3 ? .75 : 1), .3, 3); r = { mult: m, ret: Math.round(35 + m * 12), verdict: m > 1.2 ? "Le concept accroche et la vidéo est partagée bien au-delà de vos abonnés." : m < .8 ? "Le public a l’impression d’avoir déjà vu cette vidéo." : "Une sortie solide, dans la moyenne de la chaîne.", fx: { s: {}, r: {}, pays: {} }, news: [], comments: [] }; }
  const views = base * r.mult; const y = parseD(s.date).y; const subs = views * .032 * (s.stats.reputation / 70) * (r.ret / 50) / (1 + s.stats.abonnes / 150); const spons = [0, .25, .6, 1][s.pol.sponsors] * views * .004 * [1.3, 1, .7][s.pol.ethique];
  const out = GAME.applyFx(s, { s: { abonnes: subs, vues: views * .6, tresorerie: views * B.rpm(y) + spons, algo: (r.mult - 1) * 7 + (r.ret - 50) * .12, equipe: -2 - (v.budget > s.stats.abonnes * .05 ? 2 : 0), fatigue: 6, reputation: (TYPES[v.type].rep || 0) - s.pol.sponsors * .5 + (s.pol.ethique === 0 ? -1 : 0), badbuzz: s.pol.ethique === 0 ? 2 : 0 } }); GAME.applyFx(s, r.fx, out);
  (s.lieux[v.lieu] = s.lieux[v.lieu] || {}).tour = true; s.videos.push({ title: v.title, type: v.type, budget: v.budget, lieu: v.lieu, d: s.date, views, mult: r.mult }); if (s.videos.length > 300) s.videos.shift();
  s.history.push({ date: s.date, id: "vid-" + s.week, kind: "video", title: "Vidéo", choice: v.title, hist: null, histExists: false, outcome: `${MM(views)} de vues` });
  GAME.news(s, { src: "Carnet", title: `Sortie : ${v.title}`, text: `${MM(views)} de vues le premier mois, ${sg(subs, 2)} M d’abonnés.`, tone: r.mult >= 1 ? "good" : "bad" }); for (const n of [...r.news].reverse()) GAME.news(s, n);
  AUDIO.sfx(r.mult >= 1.2 ? "crowd" : "notify"); UI.save();
  const o2 = UI.openModal(`<div class="outcome"><div class="ev-kind"><span class="k hist">Sortie de la vidéo</span><span class="label">${esc(TYPES[v.type].label)} · ${esc(B.regionName(v.lieu))}</span></div><h2>${esc(v.title)}</h2>
    <div class="kpi four"><div><small>Vues le premier mois</small><b>${MM(views)}</b></div><div><small>Par rapport à la moyenne</small><b>×${r.mult.toFixed(1).replace(".", ",")}</b></div><div><small>Vidéo regardée à</small><b>${r.ret} %</b></div><div><small>Nouveaux abonnés</small><b>${MM(subs)}</b></div><div><small>Recettes de la vidéo</small><b>${MS(views * B.rpm(y) + spons)}</b></div><div><small>Budget engagé</small><b>${MS(v.budget)}</b></div></div>
    <p class="ev-text">${esc(r.verdict)}</p><div class="deltas">${UI.deltaChips(out)}</div>
    ${r.comments.length ? `<div>${r.comments.map(c => `<div class="comment">${c.qui ? `<small>${esc(c.qui)}</small>` : ""}${esc(c.texte)}</div>`).join("")}</div>` : ""}
    <div class="row"><button class="btn primary" id="cont">Reprendre le cours du temps</button></div></div>`, { scene: "studio", wide: true });
  $("#cont", o2).onclick = () => UI.afterEvent();
};
B.week = (s, cont) => { if (s.dead || cont) return null; if (s.prod) { s.prod.w--; if (s.prod.w <= 0) { B.release(s); return { hold: true }; } } return null; };
/* Fenêtre de création d’une vidéo */
B.doView = (s, a, x) => { if (a === "video") B.videoModal(s, x); };
B.videoModal = (s, lieu) => {
  if (s.prod || s.rank === "retire" || UI.modalOpen) return; const was = UI.pause(); const V = B.draft = B.draft || { type: "defi", title: "", concept: "", thumb: "", budget: 0, lieu: "amnord" }; if (lieu) V.lieu = lieu;
  const max = Math.max(.001, s.stats.tresorerie); const close = () => { UI.closeModal(); UI.update(true); if (was) LOOP.setSpeed(was); };
  const render = () => { const t = TYPES[V.type]; const minB = Math.min(max, Math.max(.0005, t.cost * Math.max(.02, s.stats.abonnes) * .02)); if (!V.budget || V.budget > max) V.budget = Math.min(max, Math.max(minB, max * .2)); const base = B.baseViews(s, V);
    const ov = UI.openModal(`<div class="ev-kind"><span class="k hist">Nouvelle vidéo</span><span class="label">Trésorerie : ${MS(s.stats.tresorerie)}</span></div><h2>Que tournez-vous ?</h2>
      <div class="types" role="group" aria-label="Type de vidéo">${Object.entries(TYPES).map(([k, x]) => `<button data-vt="${k}" aria-pressed="${k === V.type}">${esc(x.label)}</button>`).join("")}</div><span class="note">${esc(t.note)}</span>
      <div class="ctl"><div class="ctl-top"><label for="v-title">Titre</label></div><input class="sel" id="v-title" maxlength="100" value="${esc(V.title)}" placeholder="Ex. : Le dernier à quitter le cercle gagne 500 000 $"></div>
      <div class="ctl"><div class="ctl-top"><label for="v-concept">Concept</label></div><textarea class="write" style="min-height:90px" id="v-concept" maxlength="700" placeholder="Décrivez la vidéo : qui participe, quelle est la règle, quel est l’enjeu, comment elle se termine.">${esc(V.concept)}</textarea></div>
      <div class="ctl"><div class="ctl-top"><label for="v-thumb">Miniature</label></div><input class="sel" id="v-thumb" maxlength="200" value="${esc(V.thumb)}" placeholder="Ex. : moi bouche ouverte devant un cercle rouge géant, une valise de billets au centre"></div>
      <div class="ctl"><div class="ctl-top"><label for="v-budget">Budget</label><b id="v-bl">${MS(V.budget)}</b></div><input type="range" id="v-budget" min="0" max="1000" step="1" value="${Math.round(Math.sqrt(V.budget / max) * 1000)}"><span class="note" id="v-note">Tournage : ${B.weeksFor(s, V)} semaine(s) · audience attendue pour une vidéo moyenne : ${MM(base)} de vues</span></div>
      <div class="ctl"><div class="ctl-top"><label for="v-lieu">Lieu de tournage</label></div><select class="sel" id="v-lieu">${B.map.regions.map(r => `<option value="${r.id}" ${r.id === V.lieu ? "selected" : ""}>${esc(r.name)}${r.id === "amnord" ? " (votre studio)" : " (une semaine de plus)"}</option>`).join("")}</select></div>
      <div class="row"><button class="btn ghost" id="v-close">Fermer</button><button class="btn primary" id="v-go" style="font-size:1rem;padding:.6em 1.6em">Lancer le tournage</button></div>`, { wide: true });
    const upd = () => { $("#v-bl", ov).textContent = MS(V.budget); $("#v-note", ov).textContent = `Tournage : ${B.weeksFor(s, V)} semaine(s) · audience attendue pour une vidéo moyenne : ${MM(B.baseViews(s, V))} de vues`; };
    $$("[data-vt]", ov).forEach(b => b.onclick = () => { V.type = b.dataset.vt; render(); });
    $("#v-title", ov).oninput = e => { V.title = e.target.value; }; $("#v-concept", ov).oninput = e => { V.concept = e.target.value; }; $("#v-thumb", ov).oninput = e => { V.thumb = e.target.value; };
    $("#v-budget", ov).oninput = e => { V.budget = Math.max(0, Math.pow(+e.target.value / 1000, 2) * max); upd(); }; $("#v-lieu", ov).onchange = e => { V.lieu = e.target.value; upd(); };
    $("#v-close", ov).onclick = close;
    $("#v-go", ov).onclick = () => { if (V.title.trim().length < 4 || V.concept.trim().length < 10) { UI.toast("Donnez un titre et décrivez le concept."); return; } B.start(s, { type: V.type, title: V.title.trim(), concept: V.concept.trim(), thumb: V.thumb.trim(), budget: Math.round(V.budget * 1000) / 1000, lieu: V.lieu }); B.draft = null; AUDIO.sfx("drum"); UI.save(); close(); }; };
  render();
};
B.fxCall = (s, c, out) => { if (c.fn === "biz") { s.biz[c.id] = parseD(s.date).y; } else if (c.fn === "don") { s.dons += c.v; (s.lieux[c.lieu] = s.lieux[c.lieu] || {}).don = (s.lieux[c.lieu].don || 0) + c.v; } };

/* ---------------- Simulation hebdomadaire ---------------- */
B.tick = function(s, h){ const st = s.stats, p = s.pol, out = []; const b = B.budget(s); h.add("tresorerie", b.solde); const y = parseD(s.date).y;
  const active = s.rank !== "retire"; const recent = s.videos.filter(v => v.d >= addDays(s.date, -70)).length;
  h.drift("vues", st.abonnes * (5.5 + st.algo * .09) * (s.biz.doublage ? 1.15 : 1) * (active ? 1 : .5) + (s.biz.gaming ? st.abonnes * .9 : 0), .18);
  h.add("abonnes", st.vues * .0018 * (st.reputation / 70) * (1 + p.shorts * (y >= 2021 ? .25 : 0)) * (y < 2019 ? 2.2 : 1) / (1 + st.abonnes / 150));
  h.drift("algo", 50 + Math.min(4, recent) * 7 + p.shorts * (y >= 2021 ? 3 : 0) + p.cadence * 2 - (recent === 0 ? 14 : 0), .1);
  h.drift("equipe", 62 + (p.salaires - 100) * .6 - [-6, 0, 10][p.cadence] - (s.prod ? 3 : 0) + (s.flags.audit ? 6 : 0) - Math.max(0, s.team - s.studio - 1) * 5, .1);
  h.drift("reputation", 62 + [0, 3, 7, 11][p.part] + (s.biz.philanthropy ? 4 : 0) - [0, 1, 4, 8][p.sponsors] * [1.6, 1, .4][p.ethique] - st.badbuzz * .15, .05);
  h.add("badbuzz", (s.team >= 3 && !s.flags.audit ? .8 : 0) + [.6, 0, -.4][p.ethique] + [-.3, 0, .9][p.cadence] + (st.equipe < 45 ? 1 : 0) - .9);
  h.drift("fatigue", 20, .25); h.add("fatigue", (s.prod ? 5 : -4) + [-3, 0, 4][p.cadence] + p.reseaux * .5 - [0, 1, 2, 3, 4][s.team] * .6); h.add("stress", st.badbuzz / 25 + (st.tresorerie < 0 ? 2 : 0) + (s.prod ? .6 : 0) - 2.2);
  h.drift("sante", 95 - Math.max(0, h.age - 40) * 1 - Math.max(0, st.fatigue - 75) * .35 - Math.max(0, st.stress - 75) * .3, .06);
  if (st.badbuzz >= 80 && h.chance(.35)) { h.fx({ s: { reputation: -12, abonnes: -st.abonnes * .01, badbuzz: -35, equipe: -6 } }); out.push({ t: "Une polémique éclate : anciens collaborateurs et commentateurs s’expriment toute la semaine.", tone: "bad" }); GAME.news(s, { src: "Presse spécialisée", title: "La machine MrBeast sous le feu des critiques", text: "Rythme de production, promesses des vidéos, partenariats : les reproches s’accumulent.", ton: "hos" }); }
  return out; };

B.mainGauges = s => [{ label: "Faveur de l’algorithme", v: s.stats.algo }, { label: "Moral de l’équipe", v: s.stats.equipe }, { label: "Réputation", v: s.stats.reputation }, { label: "Risque de bad buzz", v: s.stats.badbuzz, bad: "high" }, { label: `Santé · ${GAME.age(s)} ans`, v: s.stats.sante }];
B.sideFacts = s => [["Abonnés", MM(s.stats.abonnes)], ["Vues par mois", MM(s.stats.vues)], ["Trésorerie", MS(s.stats.tresorerie)], ["Vidéos publiées", s.videos.length], ["Fatigue", Math.round(s.stats.fatigue)], ["Stress", Math.round(s.stats.stress)]];
B.alerts = s => { const o = { general: [], studio: [], business: [] }; if (!s.prod && s.rank !== "retire") o.studio.push("Aucune vidéo en tournage : l’algorithme oublie vite."); if (s.stats.equipe < 40) o.studio.push("L’équipe est à bout."); if (s.stats.badbuzz >= 65) o.general.push("Une polémique menace d’éclater."); if (s.stats.tresorerie < 0) o.business.push("La trésorerie est négative."); return o; };
B.badges = (s, c) => ({ general: c.view !== "general" && (c.flagGeneral || c.al.general.length > 0), studio: c.view !== "studio" && c.al.studio.length > 0, medias: c.view !== "medias" && c.newsNew, business: c.view !== "business" && c.al.business.length > 0, messages: c.unread > 0 });
B.upcoming = s => { const out = []; if (s.prod) out.push({ d: addDays(s.date, s.prod.w * 7), t: `Sortie prévue : ${s.prod.title}`, k: "Vidéo" }); for (const x of s.deferred) out.push({ d: x.date, t: x.title, k: "Conséquence attendue" }); const y = parseD(s.date).y; for (const b of B.bizList) if (!s.biz[b.id] && b.year === y + 1) out.push({ d: `${b.year}-01-01`, t: `Devient possible : ${b.label}`, k: "Business", approx: true }); const nx = [1, 10, 50, 100, 200, 300, 500, 1000].find(n => n > s.stats.abonnes); if (nx && s.stats.vues > 0) { const mo = (nx - s.stats.abonnes) / Math.max(.0001, s.stats.vues * .0018 * (s.stats.reputation / 70) / (1 + s.stats.abonnes / 150)) / 2.5; if (mo < 60) out.push({ d: addDays(s.date, Math.round(mo * 30)), t: `Cap des ${nx} million${nx > 1 ? "s" : ""} d’abonnés, au rythme actuel`, k: "Chaîne", approx: true }); } return out.sort((a, b) => a.d.localeCompare(b.d)).slice(0, 8); };
B.opinions = s => [["Réputation auprès du public", s.stats.reputation], ["Faveur de l’algorithme", s.stats.algo]];
B.newsFx = (s, cat, sign) => { const v = sign * (cat === "rum" ? .4 : .7); s.stats.reputation = clamp(s.stats.reputation + v, 0, 100); return { k: "du public", v }; };

B.boards = { studio: s => { const blk = (t, b) => `<div class="panel"><h2>${t}</h2>${b}</div>`; const last = s.videos.slice(-10).reverse();
  return `<div class="kpi four"><div><small>Abonnés</small><b>${MM(s.stats.abonnes)}</b></div><div><small>Vues par mois</small><b>${MM(s.stats.vues)}</b></div><div><small>Vidéos publiées</small><b>${s.videos.length}</b></div><div><small>Équipe</small><b>${esc(B.teams[s.team][0])}</b></div><div><small>Meilleure vidéo</small><b>${s.videos.length ? MM(Math.max(...s.videos.map(v => v.views))) : "—"}</b></div><div><small>Dons cumulés</small><b>${MS(s.dons)}</b></div></div>`
    + blk("En production", s.prod ? `<div class="res w"><small>${esc(TYPES[s.prod.type].label)} · ${esc(B.regionName(s.prod.lieu))} · budget ${MS(s.prod.budget)}</small><span>« ${esc(s.prod.title)} » : sortie dans ${s.prod.w} semaine${s.prod.w > 1 ? "s" : ""}.</span></div>` : s.rank === "retire" ? `<span class="note">Vous ne tournez plus.</span>` : `<p class="note" style="margin:0 0 8px">Aucun tournage en cours. Choisissez un type, un concept, un titre, une miniature et un budget : le public jugera.</p><button class="btn primary" data-do="char|video" style="min-height:56px;font-size:1rem">Créer une vidéo</button>`)
    + blk("Dernières vidéos", last.length ? `<div class="tbl">${last.map(v => `<div><span>${esc(v.title)} <small class="note">· ${esc(TYPES[v.type].label)} · ${esc(frMonth(v.d))}</small></span><span>${MM(v.views)} · ×${v.mult.toFixed(1).replace(".", ",")}</span></div>`).join("")}</div>` : `<span class="note">Aucune vidéo publiée dans cette partie.</span>`); } };

const lv = (...n) => v => n[v];
const live = (id, label, min, max, step, fmt, extra) => s => ({ k: "slider", act: "pol", arg: id, label, min, max, step, val: s.pol[id], fmt, live: v => { const old = s.pol[id]; s.pol[id] = +v; const b = B.budget(s); const ex = extra ? extra(s, +v) : ""; s.pol[id] = old; return `${ex}${ex ? " · " : ""}solde mensuel ${sg(b.solde, 2)} M $`; } });
const note = (id, label, min, max, step, fmt, txt) => s => ({ k: "slider", act: "pol", arg: id, label, min, max, step, val: s.pol[id], fmt, live: v => txt(s, +v) });
B.panels = [
  { id: "equipe", label: "Équipe et studio", cond: s => true, blocks: s => [
    { k: "kpi", items: [["Équipe", B.teams[s.team][0]], ["Moral", Math.round(s.stats.equipe)], ["Studio", ["Votre chambre", "Un entrepôt", "Un grand studio", "Un campus de studios"][s.studio]], ["Tournage", s.prod ? `${s.prod.w} sem. restantes` : "aucun"]] },
    { k: "btn", act: "embaucher", label: "Agrandir l’équipe", cost: s.team >= 4 ? "Taille maximale" : `${B.teams[s.team + 1][0]} · ${MS(B.teams[s.team + 1][1])} par mois`, dis: (s.team >= 4 && "Taille maximale") || (s.stats.tresorerie < B.teams[Math.min(4, s.team + 1)][1] * 3 && "Trésorerie insuffisante (trois mois de salaires)") },
    { k: "btn", act: "licencier", label: "Réduire l’équipe", cost: "Moral −10", dis: s.team <= 0 && "Vous êtes déjà seul", confirm: true },
    { k: "btn", act: "studio", label: "Agrandir le studio", cost: s.studio >= 3 ? "Taille maximale" : MS([.05, 1.5, 14][s.studio]), dis: (s.studio >= 3 && "Taille maximale") || (s.stats.tresorerie < [.05, 1.5, 14][s.studio] && "Trésorerie insuffisante") },
    live("salaires", "Niveau des salaires", 80, 130, 5, v => v + " %", (s, v) => `moral visé ${sg((v - 100) * .6)}`)(s),
    note("cadence", "Cadence de production", 0, 2, 1, lv("Tranquille", "Soutenue", "Infernale"), (s, v) => `tournages ${["plus longs", "normaux", "plus courts"][v]} · moral visé ${sg([6, 0, -10][v])} · bad buzz ${sg([-.3, 0, .9][v])}/mois`)(s),
    note("shorts", "Formats courts", 0, 2, 1, lv("Aucun", "Quelques-uns", "Tous les jours"), (s, v) => parseD(s.date).y < 2021 ? "Les formats courts ne comptent pas encore sur la plateforme." : `abonnés ${sg(v * 25, 0)} % · algorithme ${sg(v * 3)}`)(s)] },
  { id: "sponsors", label: "Sponsors", cond: s => true, blocks: s => [
    note("sponsors", "Intégrations sponsorisées par vidéo", 0, 3, 1, lv("Aucune", "Une, discrète", "Deux", "Trois et plus"), (s, v) => `recettes par vidéo ${["nulles", "modestes", "fortes", "maximales"][v]} · réputation visée ${sg(-[0, 1, 4, 8][v] * [1.6, 1, .4][s.pol.ethique])}`)(s),
    { k: "select", act: "pol", arg: "ethique", label: "Choix des marques", val: s.pol.ethique, options: [[0, "Accepter la meilleure offre, quelle qu’elle soit"], [1, "Écarter les secteurs sensibles"], [2, "Seulement des produits que vous utilisez"]], note: "Les marques douteuses paient mieux et abîment la réputation." }] },
  { id: "philanthropie", label: "Philanthropie", cond: s => true, blocks: s => [
    { k: "kpi", items: [["Dons cumulés", MS(s.dons)], ["Réputation", Math.round(s.stats.reputation)]] },
    live("part", "Part des revenus reversée", 0, 3, 1, lv("Rien", "5 %", "15 %", "30 %"), (s, v) => `réputation visée ${sg([0, 3, 7, 11][v])}`)(s),
    ...[["puits", "Creuser cent puits", .3, "afrique"], ["maisons", "Construire cent maisons", 3, "amlat"], ["ecoles", "Rénover des écoles", 1, "asie"], ["plages", "Nettoyer des plages et des rivières", .5, "oceanie"]].map(([id, label, cost, lieu]) => ({ k: "btn", act: "don", arg: `${id}|${cost}|${lieu}`, label, cost: `${MS(cost)} · ${B.regionName(lieu)}`, dis: (s.stats.tresorerie < cost && "Trésorerie insuffisante") || (s.wk["don" + id] !== undefined && s.week - s.wk["don" + id] < 26 && "Déjà financé récemment") }))] },
  { id: "vie", label: "Vie privée", cond: s => true, blocks: s => [
    live("train", "Train de vie", 0, 2, 1, lv("Presque rien pour vous", "Confortable", "Luxueux"), (s, v) => "")(s),
    { k: "btn", act: "repos", label: "Couper trois jours", cost: "Fatigue −15, stress −8", dis: once(s, "repos") }, { k: "btn", act: "famille", label: "Passer voir votre mère", cost: "Stress −6", dis: once(s, "famille") },
    { k: "btn", act: "retraite", label: "Arrêter les vidéos", cost: "Définitif", dis: s.rank === "retire" && "Déjà fait", confirm: true }] },
  { id: "image", label: "Image et réseaux", cond: s => true, blocks: s => [
    note("reseaux", "Présence sur les autres réseaux", 0, 3, 1, lv("Aucune", "Occasionnelle", "Quotidienne", "Permanente"), (s, v) => `fatigue ${sg(v * .5)}/mois`)(s),
    { k: "btn", act: "write", arg: "post", label: "Publier un message", cost: "Compte comme l’action de la semaine" }, { k: "btn", act: "write", arg: "interview", label: "Passer dans un podcast", cost: "Compte comme l’action de la semaine" }] },
  { id: "business", label: "Business", cond: s => true, blocks: s => { const y = parseD(s.date).y; return [{ k: "info", html: "Chaque activité rapporte selon votre audience et votre réputation." }, ...B.bizList.map(b => ({ k: "row", title: b.label, sub: b.note + (s.biz[b.id] ? ` Lancé en ${s.biz[b.id]}.` : ""), done: !!s.biz[b.id], ctrls: s.biz[b.id] ? [] : [{ k: "btn", act: "biz", arg: b.id, label: "Lancer", cost: MS(b.cost), dis: (y < b.year && `Pas avant ${b.year}`) || (s.stats.tresorerie < b.cost && `Il faut ${MS(b.cost)}`) }] }))]; } }
];
B.windows = { general: ["sponsors", "philanthropie", "vie"], studio: "equipe", medias: "image", business: "business" };
B.views = [{ id: "general", label: "Vue générale", icon: "general", kind: "general" }, { id: "studio", label: "Studio", icon: "armee", kind: "board" }, { id: "medias", label: "Médias", icon: "presse", kind: "presse" }, { id: "business", label: "Business", icon: "finances", kind: "finances" }, { id: "messages", label: "Messages", icon: "corr", kind: "corr" }];
B.act = (s, act, arg, val) => { const fx = o => GAME.applyFx(s, o); const use = id => { s.wk[id] = s.week; };
  switch (act) {
    case "pol": s.pol[arg] = +val; return {};
    case "embaucher": s.team++; fx({ s: { equipe: -3 } }); return { msg: `Recrutements : ${B.teams[s.team][0].toLowerCase()}.`, tone: "good" };
    case "licencier": s.team--; fx({ s: { equipe: -10, badbuzz: 5 } }); return { msg: "L’équipe est réduite.", tone: "bad" };
    case "studio": s.stats.tresorerie -= [.05, 1.5, 14][s.studio]; s.studio++; fx({ s: { equipe: 5 } }); return { msg: `Nouveau lieu de tournage : ${["un entrepôt", "un grand studio", "un campus de studios"][s.studio - 1]}.`, tone: "good" };
    case "don": { const [id, cost, lieu] = arg.split("|"); s.wk["don" + id] = s.week; s.stats.tresorerie -= +cost; B.fxCall(s, { fn: "don", v: +cost, lieu }); fx({ s: { reputation: 3 } }); GAME.news(s, { src: "Presse locale", title: "Un chantier financé par un créateur américain", text: "Les habitants racontent l’arrivée des équipes.", ton: "fav" }); return { toast: "Projet financé.", sfx: "crowd" }; }
    case "biz": { const b = B.bizList.find(x => x.id === arg); s.stats.tresorerie -= b.cost; s.biz[b.id] = parseD(s.date).y; fx({ s: { reputation: b.rep || 0, badbuzz: b.buzz || 0 } }); s.history.push({ date: s.date, id: "biz-" + b.id, kind: "business", title: "Business", choice: `Lancement : ${b.label}`, hist: null, histExists: false, outcome: "" }); return { msg: `Lancement : ${b.label}.`, tone: "good" }; }
    case "repos": use("repos"); fx({ s: { fatigue: -15, stress: -8 } }); return { msg: "Trois jours sans caméra." };
    case "famille": use("famille"); fx({ s: { stress: -6 }, r: { sue: 3 } }); return { msg: "Un dîner à la maison." };
    case "retraite": s.rank = "retire"; s.prod = null; s.history.push({ date: s.date, id: "ret", kind: "business", title: "Fin des vidéos", choice: "Arrêt annoncé", hist: null, histExists: false, outcome: `${MM(s.stats.abonnes)} d’abonnés` }); return { msg: "Vous annoncez la fin de vos vidéos.", sfx: "crowd" };
  } return {}; };

B.speech = [
  { id: "post", label: "Post sur les réseaux", hint: "Un message public, avec ou sans photo.", ph: "Ex. : La prochaine vidéo est la plus chère que j’aie jamais tournée. Vendredi.", photo: true },
  { id: "live", label: "Live ou vidéo spontanée", hint: "Une prise de parole directe, sans montage.", ph: "Ex. : En direct du studio, je réponds à toutes vos questions sur le dernier tournage…" },
  { id: "interview", label: "Interview ou podcast", hint: "Un animateur pose deux ou trois questions.", ph: "", flow: "interview" },
  { id: "communique", label: "Communiqué officiel", hint: "Texte diffusé par votre entreprise.", ph: "Ex. : Notre société annonce le recrutement d’une directrice des ressources humaines…" },
  { id: "decision", label: "Décision d’entreprise", hint: "Une décision de dirigeant : règle interne, partenariat, lancement.", ph: "Ex. : À partir de ce mois-ci, tout candidat à un tournage sera suivi par une équipe médicale indépendante…" },
  { id: "rumeur", label: "Information glissée à un proche", hint: "Faire fuiter un chiffre ou un projet.", ph: "Ex. : Laisser entendre qu’une plateforme a offert cent millions pour une émission…" }
];
B.advisors = [{ rel: "reed", name: "Reed Duchscher", role: "manager et associé", style: "pragmatique, pense contrats, image de marque et rentabilité" }];
B.advisor = s => GAME.relAlive(s, "reed") ? B.advisors[0] : { name: "votre associé", role: "associé", style: "pragmatique, pense image de marque et rentabilité" };
B.newsSources = s => ["Presse spécialisée", "The Verge", "Variety", "Tubefilter", "Forbes", "Commentaires de la vidéo", "Réseaux sociaux", "Forum de fans", "Rumeur du milieu"];
B.newsCat = src => { const x = String(src || "").toLowerCase(); if (/carnet|conséquence/.test(x)) return "sys"; if (/rumeur/.test(x)) return "rum"; if (/commentaire|réseau|forum|fan|reddit|twitter|tiktok/.test(x)) return "etr"; return "fr"; };
B.pressCats = [["tous", "Tout"], ["fr", "Presse"], ["etr", "Commentaires et réseaux"], ["rum", "Rumeurs"], ["sys", "Carnet"]]; B.tonLabel = { fav: "Favorable", neu: "Neutre", hos: "Critique" }; B.publicLabel = "Dans les commentaires";
B.press = (s, kind, d) => { if (kind !== "evenement") return []; const a = [{ src: "Presse spécialisée", ton: "neu", title: d.title, text: d.res || "" }]; for (const x of a) GAME.news(s, x); return a; };
B.aiState = s => `CHAÎNE : ${MM(s.stats.abonnes)} d’abonnés, ${MM(s.stats.vues)} de vues par mois, ${s.videos.length} vidéos publiées dans cette partie. Équipe : ${B.teams[s.team][0]}. Activités lancées : ${Object.keys(s.biz).join(", ") || "aucune"}. Dons cumulés : ${s.dons} M $. En tournage : ${s.prod ? `« ${s.prod.title} »` : "rien"}.\nDERNIÈRES VIDÉOS :\n${s.videos.slice(-5).map(v => `- « ${v.title} » : ${v.views.toFixed(1)} M de vues`).join("\n") || "- aucune"}`;
B.persona = { sue: "mère protectrice, pragmatique, lui rappelle de dormir", chandler: "ami maladroit et drôle, loyal, peu sérieux", karl: "ami enthousiaste, parle vite, plein d’idées", nolan: "ami calme, pince-sans-rire", reed: "manager pragmatique, parle chiffres, contrats et risques d’image", rober: "créateur ingénieur, méthodique, bienveillant, aime les causes utiles", pewdiepie: "créateur chevronné, ironique, détaché des classements", logan: "créateur entrepreneur, fonceur, parle business", ksi: "créateur britannique, blagueur, compétiteur" };
B.contactGroups = [["Famille", ["sue"]], ["L’équipe", ["chandler", "karl", "nolan", "reed"]], ["Créateurs", ["rober", "pewdiepie", "logan", "ksi"]]];
B.contactLoc = () => "ligne"; B.mailDays = () => 0;
B.mailScripts = [{ id: "sue", t: "Tu as mangé aujourd’hui ? Et dormi ? Le studio peut tourner une journée sans toi." }, { id: "chandler", t: "J’ai encore perdu au dernier défi. Promets-moi que la prochaine vidéo, c’est un truc où je peux gagner." }, { id: "reed", t: "Trois marques veulent une intégration ce trimestre. Dis-moi lesquelles on rappelle." }, { id: "karl", t: "J’ai une idée de vidéo. Elle est soit géniale, soit illégale. Je te raconte ?" }];
B.mailFallback = (s, id) => (s.rel[id] || 0) >= 40 ? "Vu ! On en parle au studio." : "Bien reçu.";
B.rivals = [
  { id: "tseries", name: "Les grandes chaînes concurrentes", plans: [{ plan: "Creuser l’écart au classement des abonnés", news: ["Une chaîne musicale indienne gagne un million d’abonnés en une semaine", "Les chaînes pour enfants dominent les vues mondiales"], done: { s: { stress: 3 } }, title: "Le classement mondial se resserre" }] },
  { id: "copieurs", name: "Les créateurs concurrents", plans: [{ plan: "Reprendre vos formats avec de plus gros budgets", news: ["Un créateur annonce un jeu à dix millions de dollars", "Un concurrent recrute d’anciens membres de votre équipe"], done: { s: { algo: -4, equipe: -3 } }, title: "Un concurrent sort avant vous la vidéo que vous prépariez" }] },
  { id: "plateforme", name: "La plateforme", plans: [{ plan: "Modifier les règles de recommandation", news: ["La plateforme teste une nouvelle page d’accueil", "Les miniatures trompeuses seront moins recommandées"], done: { s: { algo: -6 } }, title: "Nouvel algorithme : les cartes sont rebattues" }] }
];
B.audio = { tempo: 124, root: 146.83, scale: [0, 2, 4, 7, 9], style: "stade" };
B.endTiles = (s, x) => [["Abonnés", MM(s.stats.abonnes), "Réalité : plus de 400 millions en 2025"], ["Vidéos publiées", String(s.videos.length), "Dans cette partie"], ["Meilleure vidéo", s.videos.length ? MM(Math.max(...s.videos.map(v => v.views))) + " de vues" : "—", s.videos.length ? [...s.videos].sort((a, b) => b.views - a.views)[0].title : ""], ["Dons cumulés", MS(s.dons), "Arbres, océans, puits, opérations"], ["Activités lancées", String(Object.keys(s.biz).length), Object.keys(s.biz).join(", ") || "Aucune"], ["Fidélité à la réalité", `${x.fidelity} %`, `${x.same} choix sur ${x.total} comme dans la réalité`]];
B.autoTest = s => { if (!s.prod && s.rank !== "retire" && s.stats.tresorerie > 0) B.start(s, { type: Object.keys(TYPES)[Math.floor(Math.random() * 6)], title: "Vidéo de test " + s.week, concept: "Un défi de test pour vérifier le jeu.", thumb: "", budget: Math.max(.001, s.stats.tresorerie * .25), lieu: Math.random() < .3 ? "afrique" : "amnord" }); if (s.stats.tresorerie > B.teams[Math.min(4, s.team + 1)][1] * 8 && s.team < 4) B.act(s, "embaucher"); };
B.testInfo = s => ({ videos: s.videos.length, team: s.team, biz: Object.keys(s.biz), best: s.videos.length ? Math.round(Math.max(...s.videos.map(v => v.views))) : 0 });
})();
</script>
