<script>
"use strict";
/* =====================================================================
   PERSONNAGES — architecture pilotée par les données.
   Ajouter un personnage = ajouter un objet dans CHARACTERS (même forme que napoleon).
   ===================================================================== */
const CHARACTERS = {};

CHARACTERS.napoleon = {
  id: "napoleon",
  name: "Napoléon Bonaparte",
  short: "Napoléon",
  role: "Général, Premier consul, Empereur des Français",
  theme: "theme-empire",
  art: "linear-gradient(160deg,#1e3a2b,#0b140f)",
  born: "1769-08-15",
  birthplace: "Ajaccio, Corse",
  unit: { label: "mois", months: 1 },
  portrait: s => ART.napoleon({ age: s ? GAME.age(s) : 27 }),
  realDeath: { date: "1821-05-05", age: 51, place: "Longwood, île de Sainte-Hélène",
    cause: "Cancer de l’estomac, selon l’autopsie de 1821 (l’hypothèse d’un empoisonnement à l’arsenic, avancée au XXe siècle, est aujourd’hui largement écartée)." },
  realTimeline: "Général à 26 ans, Premier consul à 30, Empereur à 35, exilé à 45, mort à 51 sur un rocher de l’Atlantique Sud.",

  groups: { empire: "L’Empire", vie: "Santé & vie privée" },
  stats: [
    { id: "armee", label: "Grande Armée", group: "empire", min: 0, max: 750, barMax: 700, unit: "k", fmt: v => `${Math.round(v)} 000 h.`, bad: "low", warn: 120, danger: 60, aiMax: 60, hint: "Effectifs sous les armes" },
    { id: "moral", label: "Moral des troupes", group: "empire", min: 0, max: 100, bad: "low", aiMax: 12, hint: "Discipline, ardeur, fidélité du rang" },
    { id: "tresor", label: "Trésor", group: "empire", min: -800, max: 2000, barMax: 800, fmt: v => `${Math.round(v)} M F`, bad: "low", warn: 40, danger: 0, aiMax: 80, hint: "Millions de francs disponibles" },
    { id: "departements", label: "Territoire", group: "empire", min: 0, max: 160, barMin: 60, barMax: 140, fmt: v => `${Math.round(v)} dép.`, bad: "low", warn: 90, danger: 70, aiMax: 4, hint: "Départements sous administration française" },
    { id: "loyaute", label: "Loyauté des maréchaux", group: "empire", min: 0, max: 100, bad: "low", aiMax: 12, hint: "Fidélité des grands chefs militaires" },
    { id: "popularite", label: "Popularité en France", group: "empire", min: 0, max: 100, bad: "low", aiMax: 12, hint: "Opinion des Français, des notables aux faubourgs" },
    { id: "coalition", label: "Menace des coalitions", group: "empire", min: 0, max: 100, bad: "high", aiMax: 12, hint: "Volonté de l’Europe de s’unir contre vous" },
    { id: "complot", label: "Risque de complot", group: "empire", min: 0, max: 100, bad: "high", aiMax: 12, hint: "Royalistes, jacobins, ambitieux de l’entourage" },
    { id: "sante", label: "Santé", group: "vie", min: 0, max: 100, bad: "low", aiMax: 10, hint: "État général du corps" },
    { id: "fatigue", label: "Fatigue", group: "vie", min: 0, max: 100, bad: "high", aiMax: 12, hint: "Campagnes, nuits courtes, chevauchées" },
    { id: "stress", label: "Stress", group: "vie", min: 0, max: 100, bad: "high", aiMax: 12, hint: "Pression politique et personnelle" }
  ],

  ranks: {
    general:   { label: "Général en chef de l’armée d’Italie", income: .14, power: 1 },
    general2:  { label: "Général de la République", income: .1, power: 1 },
    consul:    { label: "Premier consul", income: 1, power: 2 },
    consulvie: { label: "Premier consul à vie", income: 1, power: 2 },
    empereur:  { label: "Empereur des Français", income: 1.05, power: 3 },
    elbe:      { label: "Souverain de l’île d’Elbe", income: .03, power: 0 },
    exilam:    { label: "Exilé aux États-Unis", income: .02, power: 0 },
    prisonnier:{ label: "Prisonnier des Britanniques à Sainte-Hélène", income: 0, power: 0 }
  },

  relations: [
    { id: "josephine", name: "Joséphine de Beauharnais", role: "Épouse (mariée le 9 mars 1796)", bio: "Veuve du général de Beauharnais, reine des salons du Directoire. Mère d’Eugène et d’Hortense.", from: "1795-10-01", dies: { date: "1814-05-29", cause: "emportée par une maladie respiratoire à la Malmaison" }, start: 55 },
    { id: "marielouise", name: "Marie-Louise d’Autriche", role: "Archiduchesse, fille de l’empereur François Ier", bio: "Élevée dans la haine de « l’Ogre corse », elle devient pourtant l’impératrice en 1810 si l’Histoire suit son cours.", from: "1809-10-01", dies: { date: "1847-12-17", cause: "morte à Parme" }, start: 0 },
    { id: "letizia", name: "Letizia Bonaparte", role: "Mère", bio: "« Madame Mère ». Économe, austère, elle ne croit jamais tout à fait à la durée de la fortune familiale.", from: "1769-01-01", dies: { date: "1836-02-02", cause: "morte à Rome" }, start: 60 },
    { id: "berthier", name: "Louis-Alexandre Berthier", role: "Chef d’état-major", bio: "Infatigable, méthodique : il transforme les intuitions de Bonaparte en ordres précis.", from: "1796-03-01", dies: { date: "1815-06-01", cause: "mort d’une chute à Bamberg" }, start: 55 },
    { id: "talleyrand", name: "Charles-Maurice de Talleyrand", role: "Diplomate, ministre des Relations extérieures", bio: "Ancien évêque d’Autun, génie de la négociation et de la survie politique. Toujours un temps d’avance.", from: "1797-07-01", dies: { date: "1838-05-17", cause: "mort à Paris" }, plotter: true, start: 15 },
    { id: "fouche", name: "Joseph Fouché", role: "Ministre de la Police", bio: "Ancien conventionnel régicide. Il sait tout, sur tout le monde — y compris sur vous.", from: "1799-07-01", dies: { date: "1820-12-26", cause: "mort en exil à Trieste" }, plotter: true, start: 5 },
    { id: "murat", name: "Joachim Murat", role: "Général de cavalerie, beau-frère", bio: "Le plus brillant sabreur de l’armée, époux de Caroline Bonaparte. Ambitieux et changeant.", from: "1796-03-01", dies: { date: "1815-10-13", cause: "fusillé à Pizzo par les Bourbons de Naples", cond: s => !s.flags.waterlooWon }, plotter: true, start: 40 },
    { id: "ney", name: "Michel Ney", role: "Général puis maréchal", bio: "Le « brave des braves ». Courage physique immense, jugement parfois impulsif.", from: "1801-01-01", dies: { date: "1815-12-07", cause: "fusillé à Paris après la seconde Restauration", cond: s => s.flags.lostWaterloo }, start: 35 },
    { id: "davout", name: "Louis-Nicolas Davout", role: "Général puis maréchal", bio: "Sévère, intègre, peut-être le meilleur tacticien de l’Empire. Jamais vaincu sur le champ de bataille.", from: "1798-03-01", dies: { date: "1823-06-01", cause: "mort à Paris" }, start: 40 },
    { id: "pie7", name: "Pie VII", role: "Pape", bio: "Moine bénédictin devenu pape en 1800. Doux d’apparence, inflexible sur l’essentiel.", from: "1800-03-14", dies: { date: "1823-08-20", cause: "mort à Rome" }, start: 0 },
    { id: "alexandre", name: "Alexandre Ier", role: "Tsar de Russie", bio: "Monté sur le trône en 1801 après l’assassinat de son père. Séducteur, mystique, imprévisible.", from: "1801-03-24", dies: { date: "1825-12-01", cause: "mort à Taganrog" }, start: 0 },
    { id: "metternich", name: "Klemens von Metternich", role: "Diplomate autrichien", bio: "Ambassadeur à Paris en 1806, ministre des Affaires étrangères en 1809. Le grand architecte de l’équilibre européen.", from: "1806-08-01", dies: { date: "1859-06-11", cause: "mort à Vienne" }, start: -5 },
    { id: "pitt", name: "William Pitt le Jeune", role: "Premier ministre britannique", bio: "Financier des coalitions successives contre la France.", from: "1796-01-01", dies: { date: "1806-01-23", cause: "mort à Londres" }, start: -45 },
    { id: "wellington", name: "Arthur Wellesley (Wellington)", role: "Général britannique", bio: "Vainqueur aux Indes, puis maître de la guerre défensive dans la péninsule Ibérique.", from: "1808-08-01", dies: { date: "1852-09-14", cause: "mort au château de Walmer" }, start: -30 }
  ],

  starts: [
    { id: "1796", date: "1796-03-27", year: "1796", title: "Le général de l’armée d’Italie",
      summary: "26 ans. Marié depuis dix-huit jours à Joséphine, vous arrivez à Nice devant une armée affamée, mal chaussée, payée en assignats sans valeur.",
      rank: "general", scene: "italie", place: "Quartier général de Nice",
      stats: { armee: 38, moral: 35, tresor: 4, departements: 98, loyaute: 40, popularite: 25, coalition: 62, complot: 4, sante: 86, fatigue: 25, stress: 40 },
      rel: { josephine: 60, talleyrand: 0, murat: 45, berthier: 50, pitt: -40 },
      family: { spouse: "josephine", children: [] }, flags: { atWar: true } },
    { id: "1799", date: "1799-10-16", year: "1799", title: "Le retour d’Égypte",
      summary: "30 ans. Débarqué à Fréjus, vous rentrez à Paris en héros. Le Directoire est discrédité ; Sieyès cherche « un sabre ».",
      rank: "general2", scene: "paris", place: "Rue de la Victoire, Paris",
      stats: { armee: 300, moral: 50, tresor: 15, departements: 102, loyaute: 50, popularite: 60, coalition: 72, complot: 25, sante: 78, fatigue: 45, stress: 50 },
      rel: { josephine: 25, talleyrand: 25, fouche: 10, berthier: 65, murat: 55, ney: 20, davout: 35 },
      family: { spouse: "josephine", children: [] }, flags: { atWar: true, egypt: true, leftEgypt: true },
      done: ["italie", "arcole", "egypte", "acre", "retour"] },
    { id: "1804", date: "1804-11-01", year: "1804", title: "À la veille du Sacre",
      summary: "35 ans. Proclamé Empereur des Français en mai, vous préparez le couronnement à Notre-Dame. Le pape Pie VII est en route pour Paris.",
      rank: "empereur", scene: "palais", place: "Palais des Tuileries",
      stats: { armee: 450, moral: 72, tresor: 260, departements: 108, loyaute: 70, popularite: 68, coalition: 55, complot: 30, sante: 75, fatigue: 40, stress: 45 },
      rel: { josephine: 55, talleyrand: 35, fouche: 20, berthier: 75, murat: 50, ney: 45, davout: 50, pie7: 15, alexandre: -20, pitt: -60 },
      family: { spouse: "josephine", children: [] }, flags: { consul: true, empire: true, concordat: true },
      done: ["italie", "arcole", "egypte", "acre", "retour", "brumaire", "marengo", "machine", "concordat", "amiens", "consulvie", "code", "enghien", "empire"],
      counters: { battlesWon: 14, reforms: 3, treaties: 3 } },
    { id: "1812", date: "1812-05-01", year: "1812", title: "Avant la campagne de Russie",
      summary: "42 ans. L’Empire compte 130 départements. Le tsar a rouvert ses ports aux neutres : la rupture approche. Votre fils, le roi de Rome, a un an.",
      rank: "empereur", scene: "palais", place: "Palais de Saint-Cloud",
      stats: { armee: 680, moral: 64, tresor: 380, departements: 130, loyaute: 55, popularite: 58, coalition: 52, complot: 28, sante: 62, fatigue: 50, stress: 55 },
      rel: { josephine: 40, marielouise: 45, talleyrand: -35, fouche: -25, berthier: 70, murat: 25, ney: 50, davout: 55, pie7: -55, alexandre: -30, metternich: 10, wellington: -45 },
      family: { spouse: "marielouise", exSpouses: ["josephine"], children: [{ name: "Napoléon François Charles Joseph, roi de Rome", born: "1811-03-20" }] },
      flags: { consul: true, empire: true, concordat: true, blocus: true, spainWar: true, divorced: true, remarried: true, atWar: true },
      done: ["italie", "arcole", "egypte", "acre", "retour", "brumaire", "marengo", "machine", "concordat", "amiens", "consulvie", "code", "enghien", "empire", "sacre", "trafalgar", "austerlitz", "iena", "blocus", "tilsit", "espagne", "talleyrand", "wagram", "divorce", "mariage", "roidrome"],
      counters: { battlesWon: 24, battlesLost: 1, reforms: 4, treaties: 5 } }
  ],

  /* Repères réels par année : donnés à Claude pour que les événements restent cohérents avec l’époque */
  eraNotes: {
    1796: "Directoire. Première coalition (Autriche, Grande-Bretagne, Piémont). Campagne d’Italie : Lodi, Arcole. Mariage avec Joséphine.",
    1797: "Rivoli, traité de Campoformio avec l’Autriche. Bonaparte rentre à Paris auréolé de gloire ; coup d’État du 18 fructidor.",
    1798: "Expédition d’Égypte, bataille des Pyramides, destruction de la flotte à Aboukir par Nelson. Loi Jourdan sur la conscription.",
    1799: "Siège d’Acre manqué, peste à Jaffa. Retour en France, coup d’État du 18 Brumaire, Consulat. Deuxième coalition.",
    1800: "Création de la Banque de France et des préfets. Marengo. Attentat de la rue Saint-Nicaise. Hohenlinden (Moreau).",
    1801: "Paix de Lunéville avec l’Autriche. Concordat avec Pie VII. Assassinat du tsar Paul Ier, avènement d’Alexandre Ier.",
    1802: "Paix d’Amiens avec l’Angleterre. Légion d’honneur. Consulat à vie. Création des lycées. Expédition de Saint-Domingue.",
    1803: "Rupture de la paix d’Amiens. Vente de la Louisiane aux États-Unis. Camp de Boulogne. Exil de Madame de Staël.",
    1804: "Complot de Cadoudal. Exécution du duc d’Enghien. Code civil. Proclamation de l’Empire, maréchalat, Sacre.",
    1805: "Troisième coalition. Ulm, Trafalgar, Austerlitz, traité de Presbourg.",
    1806: "Confédération du Rhin, fin du Saint-Empire. Iéna et Auerstaedt. Blocus continental (décret de Berlin).",
    1807: "Eylau, Friedland, traités de Tilsit avec Alexandre. Création du duché de Varsovie.",
    1808: "Soulèvement de Madrid (Dos de Mayo), Joseph roi d’Espagne, capitulation de Bailén. Entrevue d’Erfurt.",
    1809: "Disgrâce de Talleyrand. Aspern-Essling (mort de Lannes), Wagram. Annexion des États pontificaux, Pie VII arrêté. Divorce.",
    1810: "Mariage avec Marie-Louise. Annexion de la Hollande. Masséna arrêté devant Torres Vedras par Wellington.",
    1811: "Naissance du roi de Rome. Crise économique et disette. L’Empire atteint 130 départements.",
    1812: "Campagne de Russie : la Moskova, incendie de Moscou, retraite, Bérézina. Conspiration Malet à Paris.",
    1813: "Sixième coalition. Lützen, Bautzen, Dresde, puis défaite de Leipzig. Wellington victorieux à Vitoria.",
    1814: "Campagne de France. Paris capitule. Abdication à Fontainebleau, exil à l’île d’Elbe. Restauration de Louis XVIII. Congrès de Vienne.",
    1815: "Cent-Jours. Waterloo. Seconde abdication, reddition aux Anglais, départ pour Sainte-Hélène.",
    1816: "Sainte-Hélène : Longwood, conflit avec le gouverneur Hudson Lowe, Las Cases recueille le Mémorial.",
    1817: "Sainte-Hélène : premiers troubles hépatiques et digestifs signalés.",
    1818: "Sainte-Hélène : isolement croissant, départ du médecin O’Meara.",
    1819: "Sainte-Hélène : arrivée du médecin Antommarchi ; Napoléon jardine à Longwood.",
    1820: "Sainte-Hélène : santé déclinante.",
    1821: "Mort à Longwood le 5 mai."
  },

  /* ---------------- Événements historiques clés (écrits à l’avance) ----------------
     Chaque choix « hist: true » reproduit ce qui s’est réellement passé.
     Les autres font bifurquer l’Histoire ; les drapeaux (f) conditionnent la suite. */
  events: [
    { id: "italie", date: "1796-04-10", until: "1796-07-01", title: "Franchir les Alpes ligures", place: "Savone, Riviera ligure", scene: "italie", people: ["berthier", "murat"],
      text: "L’armée d’Italie piétine depuis des mois sur la côte. Face à vous, deux armées alliées : les Piémontais de Colli et les Autrichiens de Beaulieu. Vos soldats n’ont ni souliers ni solde, mais ils sont aguerris. Le Directoire vous demande surtout de nourrir l’armée sur le pays… et d’envoyer de l’argent à Paris.",
      real: "Bonaparte frappe à la jonction des deux armées : Montenotte (12 avril), Millesimo, Mondovi. Le Piémont signe l’armistice de Cherasco le 28 avril 1796.",
      anecdote: "Sa proclamation à l’armée promettait « les plaines les plus fertiles du monde » ; son authenticité exacte est discutée, elle fut probablement réécrite plus tard à Sainte-Hélène.",
      choices: [
        { t: "Frapper vite à la jonction des Piémontais et des Autrichiens", hist: true, res: "Vous séparez les deux armées et battez les Piémontais coup sur coup.",
          battle: { name: "Montenotte", base: .8, need: 25, win: { s: { moral: 25, popularite: 18, tresor: 35, loyaute: 10 }, r: { berthier: 8 }, txt: "Le Piémont demande l’armistice. Les contributions de guerre remplissent enfin la caisse." }, loss: { s: { moral: -20, popularite: -10, armee: -8 }, txt: "Les deux armées alliées se rejoignent. Vous reculez vers Savone." } } },
        { t: "Attendre les renforts promis par le Directoire", res: "Les renforts n’arrivent qu’au compte-gouttes. L’armée s’impatiente.", fx: { s: { moral: -12, popularite: -6, coalition: 5, armee: 6 } } },
        { t: "Laisser les soldats se nourrir sur le pays sans attaquer", res: "Le pillage nourrit l’armée mais soulève les villages.", fx: { s: { moral: 8, tresor: 10, popularite: -4, loyaute: -6 } } }
      ] },
    { id: "arcole", date: "1796-11-15", until: "1797-02-01", cond: s => !s.flags.noItaly, title: "Le pont d’Arcole", place: "Marais de l’Adige, près de Vérone", scene: "bataille", people: ["murat", "berthier"],
      text: "Les Autrichiens d’Alvinczy marchent pour délivrer Mantoue. Pour les prendre à revers, il faut franchir l’Alpone sur un étroit pont de bois balayé par la mitraille. Deux assauts ont échoué. Les grenadiers hésitent ; vos officiers vous regardent.",
      real: "Bonaparte saisit un drapeau et s’élance sur le pont. L’assaut échoue, il tombe dans un fossé marécageux et manque d’être pris. La bataille est gagnée le troisième jour par la manœuvre.",
      anecdote: "Son aide de camp Jean-Baptiste Muiron meurt en le couvrant de son corps. Bonaparte rentrera d’Égypte trois ans plus tard à bord d’une frégate baptisée La Muiron.",
      choices: [
        { t: "Saisir le drapeau et mener soi-même l’assaut sur le pont", hist: true, res: "Vous vous jetez en avant sous la mitraille, drapeau en main.",
          fx: { danger: { p: .05, type: "bataille", cause: "Tué par la mitraille autrichienne sur le pont d’Arcole, à 27 ans." }, s: { moral: 15, popularite: 14, stress: 8, fatigue: 10 }, r: { murat: 5 } },
          battle: { name: "Arcole", base: .66, need: 20, win: { s: { moral: 10, popularite: 10, loyaute: 8 }, txt: "Au troisième jour, la manœuvre par Albaredo fait céder Alvinczy. La légende du pont est née." }, loss: { s: { moral: -15, armee: -6 }, txt: "Alvinczy tient l’Alpone. Il faudra tout recommencer devant Rivoli." } } },
        { t: "Contourner par le gué d’Albaredo, sans risquer votre vie", res: "Plus lente, la manœuvre évite le massacre sur le pont.",
          battle: { name: "Arcole", base: .58, need: 20, win: { s: { moral: 6, popularite: 5 }, txt: "Les Autrichiens se retirent. Une victoire sans légende." }, loss: { s: { moral: -12, armee: -6 }, txt: "La manœuvre traîne ; Alvinczy se retire en bon ordre." } } },
        { t: "Lever le siège de Mantoue et se replier", res: "Prudence jugée timorée à Paris.", fx: { s: { moral: -15, popularite: -12, coalition: 10 }, f: { noItaly: true } } }
      ] },
    { id: "campoformio", date: "1797-10-01", until: "1798-02-01", cond: s => s.rank === "general" && !s.flags.noItaly, title: "Campoformio", place: "Villa de Passariano, Frioul", scene: "italie", people: ["berthier", "talleyrand"],
      text: "Après Rivoli et la chute de Mantoue, vous êtes à moins de cent kilomètres de Vienne. Vous négociez seul avec le comte Cobenzl, sans attendre les instructions du Directoire. L’Autriche accepterait de céder la Belgique et la rive gauche du Rhin, à condition de recevoir Venise, que vous venez d’occuper.",
      real: "Le traité de Campoformio est signé le 18 octobre 1797 : l’Autriche reconnaît la République cisalpine et cède la Belgique ; la République de Venise, millénaire, est livrée à l’Autriche. Bonaparte rentre à Paris en pacificateur.",
      anecdote: "Lors des négociations, il aurait brisé un service à thé offert par Catherine II pour impressionner Cobenzl ; l’épisode, rapporté plus tard, est peut-être embelli.",
      choices: [
        { t: "Signer la paix en livrant Venise à l’Autriche", hist: true, res: "La paix est signée. Paris vous acclame ; les patriotes vénitiens se sentent trahis.", fx: { s: { popularite: 15, coalition: -20, departements: 4, tresor: 15 }, r: { talleyrand: 10 }, f: { atWar: false }, c: { treaties: 1 } } },
        { t: "Marcher sur Vienne pour imposer une paix totale", res: "L’armée reprend la route du Semmering.",
          battle: { name: "Marche sur Vienne", base: .5, need: 45, win: { s: { popularite: 20, coalition: -25, departements: 6, tresor: 40 }, c: { treaties: 1 }, f: { atWar: false }, txt: "Vienne capitule. L’Autriche signe une paix bien plus dure." }, loss: { s: { armee: -12, moral: -15, popularite: -10, coalition: 8 }, txt: "L’armée s’épuise dans les Alpes styriennes ; il faut traiter en position de faiblesse." } } },
        { t: "Refuser de sacrifier Venise et attendre Paris", res: "Les négociations traînent ; le Directoire impose ses propres conditions.", fx: { s: { popularite: -4, coalition: -8 }, r: { talleyrand: -4 } } }
      ] },
    { id: "egypte", date: "1798-04-01", until: "1798-08-01", cond: s => s.rank === "general" || s.rank === "general2", title: "L’Angleterre ou l’Orient ?", place: "Paris, rue de la Victoire", scene: "paris", people: ["talleyrand", "josephine"],
      text: "Rentré d’Italie couvert de gloire après Campoformio, vous inquiétez le Directoire. On vous a confié l’« armée d’Angleterre », mais votre inspection des côtes de la Manche vous a convaincu qu’un débarquement est irréalisable sans maîtrise des mers. Talleyrand défend un autre projet : frapper la route des Indes en Égypte.",
      real: "Bonaparte part de Toulon le 19 mai 1798 avec environ 35 000 hommes et une commission de 167 savants. Il prend Malte, débarque à Alexandrie et bat les Mamelouks aux Pyramides le 21 juillet.",
      anecdote: "La pierre de Rosette est découverte en 1799 par un officier de l’expédition. Champollion s’en servira pour déchiffrer les hiéroglyphes en 1822.",
      choices: [
        { t: "Partir pour l’Égypte avec l’armée et les savants", hist: true, res: "La flotte appareille de Toulon. Malte tombe en route.",
          fx: { s: { popularite: 10, coalition: 8, armee: -10, tresor: -5, stress: 5 }, r: { talleyrand: 10 }, f: { egypt: true }, scene: "desert", place: "Le Caire" } },
        { t: "Tenter malgré tout le débarquement en Angleterre", res: "Vous rassemblez les péniches à Boulogne et dans l’estuaire de l’Escaut.",
          battle: { name: "Débarquement en Angleterre", base: .18, need: 40, risk: .04, win: { s: { popularite: 30, coalition: -30, departements: 0, tresor: 80 }, f: { englandInvaded: true }, txt: "Une brume providentielle, une flotte anglaise dispersée : vos troupes prennent pied dans le Kent. Londres négocie." }, loss: { s: { armee: -25, moral: -25, popularite: -15 }, f: { englandFailed: true }, txt: "La Royal Navy coule la moitié des transports. Le désastre ruine votre crédit." } } },
        { t: "Rester à Paris pour peser sur la politique", res: "Vous fréquentez les salons et l’Institut, en attendant votre heure.",
          fx: { s: { popularite: -4, complot: 8, stress: 6 }, r: { josephine: 6, talleyrand: 4 }, f: { stayedParis: true } } }
      ] },
    { id: "acre", date: "1799-03-20", until: "1799-06-01", cond: s => s.flags.egypt && !s.flags.leftEgypt, title: "Le siège de Saint-Jean-d’Acre", place: "Saint-Jean-d’Acre, Syrie ottomane", scene: "desert", people: ["berthier"],
      text: "Après la destruction de votre flotte par Nelson à Aboukir, vous êtes enfermé en Orient. Vous avez marché vers la Syrie pour devancer l’offensive ottomane. Jaffa est prise, mais la peste s’est déclarée dans l’armée. Devant Acre, le pacha Djezzar tient bon, ravitaillé par les navires anglais de Sidney Smith.",
      real: "Après deux mois de siège et plusieurs assauts sanglants, Bonaparte lève le siège le 20 mai 1799 et ramène une armée décimée par la peste en Égypte.",
      anecdote: "Le tableau de Gros, « Les Pestiférés de Jaffa » (1804), montre Bonaparte touchant un malade : une image de propagande soigneusement composée.",
      choices: [
        { t: "Poursuivre le siège encore quelques semaines", hist: true, res: "Assauts répétés, brèches colmatées : Acre ne tombe pas.",
          fx: { s: { armee: -6, moral: -12, fatigue: 12, stress: 10 }, danger: { p: .03, type: "maladie", cause: "Emporté par la peste contractée au camp devant Acre." } },
          battle: { name: "Assaut sur Acre", base: .25, need: 12, win: { s: { moral: 20, popularite: 15, coalition: -5 }, f: { acreTaken: true }, txt: "La brèche cède enfin. La route de Damas, peut-être de Constantinople, est ouverte." }, loss: { s: { moral: -8, armee: -3 }, txt: "Vous levez le siège et ramenez l’armée en Égypte à travers le désert." } } },
        { t: "Lever le siège tout de suite pour sauver l’armée", res: "Vous repartez vers l’Égypte avant que la peste n’achève le corps expéditionnaire.", fx: { s: { moral: -6, armee: -2, popularite: -4, fatigue: 6 } } }
      ] },
    { id: "retour", date: "1799-08-20", until: "1800-06-01", cond: s => s.flags.egypt && !s.flags.leftEgypt, title: "Quitter l’Égypte ?", place: "Alexandrie", scene: "mer", people: ["berthier"],
      text: "Des journaux européens, transmis par les Anglais eux-mêmes, vous apprennent que l’Italie est perdue et que le Directoire vacille face à la deuxième coalition. Deux frégates sont prêtes. Partir, c’est laisser l’armée à Kléber ; rester, c’est peut-être manquer le moment où la France cherche un homme.",
      real: "Bonaparte s’embarque en secret le 23 août 1799 avec quelques fidèles, échappe aux croisières anglaises et débarque à Fréjus le 9 octobre. Kléber, furieux, hérite d’une armée sans flotte.",
      anecdote: "Kléber est assassiné au Caire en juin 1800 ; ses successeurs capitulent en 1801.",
      choices: [
        { t: "Partir en secret et laisser le commandement à Kléber", hist: true, res: "Vous traversez la Méditerranée sans être intercepté.", fx: { s: { popularite: 12, loyaute: -6, stress: 6 }, r: { berthier: 4 }, f: { leftEgypt: true }, rank: "general2", scene: "paris", place: "Paris" , danger: { p: .015, type: "accident", cause: "La frégate La Muiron est interceptée et coulée par la Royal Navy." } } },
        { t: "Rester en Égypte et y bâtir une colonie durable", res: "Vous fondez l’Égypte française avec l’Institut du Caire.", fx: { s: { popularite: -8, loyaute: 8, moral: 6, coalition: 4 }, f: { stayedEgypt: true }, place: "Le Caire" } }
      ] },
    { id: "egyptealt", date: "1800-04-01", until: "1801-09-01", cond: s => s.flags.stayedEgypt && !s.flags.leftEgypt, title: "L’Égypte française isolée", place: "Le Caire", scene: "desert", people: ["berthier"],
      text: "Sans flotte, votre colonie tient grâce à l’impôt levé sur les paysans du Nil. Une armée ottomane, appuyée par les Britanniques, se prépare à débarquer. À Paris, un autre général pourrait bien prendre la place que vous laissez vacante.",
      real: "Dans l’Histoire réelle, l’armée d’Orient, laissée à Kléber puis à Menou, capitule en 1801 face aux Britanniques et aux Ottomans.",
      choices: [
        { t: "Rentrer enfin en France, quitte à arriver tard", res: "Vous rentrez dans une France qui ne vous attendait plus.", fx: { s: { popularite: 4 }, f: { leftEgypt: true, returnedLate: true }, rank: "general2", scene: "paris", place: "Paris" } },
        { t: "Affronter le débarquement anglo-ottoman", res: "Vous concentrez l’armée près d’Aboukir.",
          battle: { name: "Aboukir", base: .55, need: 15, win: { s: { moral: 15, popularite: 10, coalition: -4 }, f: { egyptHeld: true }, txt: "L’armée ottomane est rejetée à la mer. L’Égypte reste française." }, loss: { s: { armee: -10, moral: -20 }, f: { egyptLost: true, leftEgypt: true }, rank: "general2", txt: "Vous capitulez. Les Anglais vous rapatrient en France, vaincu." } } }
      ] },
    { id: "brumaire", date: "1799-11-09", until: "1801-12-01", cond: s => (s.rank === "general" || s.rank === "general2") && !(s.flags.egypt && !s.flags.leftEgypt), title: "Le 18 Brumaire", place: "Château de Saint-Cloud", scene: "paris", people: ["talleyrand", "fouche", "murat"],
      text: "Le Directoire n’a plus d’autorité. Sieyès, l’un des directeurs, prépare une révision de la Constitution et cherche un général pour garantir l’opération. Les Conseils ont été transférés à Saint-Cloud sous prétexte d’un complot jacobin. Aujourd’hui, vous devez parler aux députés. Certains crient déjà « Hors la loi ! ».",
      real: "Le 18 brumaire an VIII (9 novembre 1799), avec Sieyès et Ducos, Bonaparte renverse le Directoire. Le lendemain, bousculé aux Cinq-Cents, il est sauvé par son frère Lucien. Le Consulat est institué.",
      anecdote: "Bonaparte s’embrouille dans son discours aux Anciens. C’est Lucien, président des Cinq-Cents, qui convainc les grenadiers d’évacuer la salle, Murat à leur tête.",
      choices: [
        { t: "Mener le coup d’État avec Sieyès, sous couvert de légalité", hist: true, res: "Le Directoire tombe. Trois consuls provisoires sont nommés : Bonaparte, Sieyès, Ducos.",
          fx: { s: { popularite: 10, complot: 10, loyaute: 8, stress: 10 }, r: { talleyrand: 10, fouche: 8, murat: 8 }, f: { consul: true }, rank: "consul", scene: "palais", place: "Palais du Luxembourg", c: { reforms: 0 } } },
        { t: "Prendre le pouvoir seul, par la seule force de l’armée", res: "Les grenadiers chassent les députés. Vous gouvernez par décret militaire.",
          fx: { s: { popularite: -10, complot: 25, loyaute: 12, coalition: 6 }, r: { talleyrand: -10, fouche: 4 }, f: { consul: true, military: true }, rank: "consul", scene: "palais", place: "Palais du Luxembourg" } },
        { t: "Refuser de trahir la Constitution et servir le Directoire", res: "Vous restez un général, loyal et populaire, mais d’autres convoitent le pouvoir.",
          fx: { s: { popularite: 4, complot: -5, stress: -6 }, r: { talleyrand: -8 }, f: { noCoup: true } } }
      ] },
    { id: "marengo", date: "1800-05-15", until: "1800-12-01", cond: s => s.flags.consul, title: "Le Grand-Saint-Bernard", place: "Col du Grand-Saint-Bernard", scene: "italie", people: ["berthier", "murat"],
      text: "Les Autrichiens de Mélas assiègent Masséna dans Gênes. Plutôt que d’attaquer de front, vous pourriez franchir les Alpes par le Grand-Saint-Bernard, canons démontés et traînés dans des troncs évidés, pour tomber sur les arrières ennemis. Un pari logistique — et politique : le Consulat ne survivrait pas à une défaite.",
      real: "L’armée franchit le col en mai 1800. Le 14 juin, à Marengo, Bonaparte est battu jusqu’au milieu de l’après-midi ; l’arrivée de Desaix renverse la bataille. Desaix est tué dans la contre-attaque.",
      anecdote: "Le célèbre tableau de David montre Bonaparte cabré sur un étalon fougueux. En réalité, il passa le col sur une mule, guidée par un paysan.",
      choices: [
        { t: "Franchir le col et livrer bataille dans la plaine du Pô", hist: true, res: "L’armée débouche en Lombardie, sur les arrières de Mélas.",
          fx: { s: { fatigue: 12 } },
          battle: { name: "Marengo", base: .56, need: 40, win: { s: { popularite: 18, coalition: -18, departements: 2, loyaute: 6, tresor: 25 }, c: { treaties: 1 }, txt: "Sauvé par Desaix, mort dans la charge, vous obtenez la Lombardie. La paix de Lunéville suivra." }, loss: { s: { popularite: -25, complot: 22, armee: -20, moral: -20 }, txt: "Mélas tient la plaine. À Paris, on parle déjà de remplacer le Premier consul." } } },
        { t: "Laisser Moreau mener la guerre en Allemagne", res: "La victoire, si elle vient, sera celle de Moreau.",
          fx: { s: { popularite: -8, complot: 8, coalition: -6, fatigue: -6 }, f: { moreauGlory: true } } },
        { t: "Proposer la paix à l’Autriche avant de combattre", res: "Vienne, confiante, refuse de céder l’Italie.", fx: { s: { coalition: 4, popularite: -3 }, r: { talleyrand: 6 } } }
      ] },
    { id: "machine", date: "1800-12-24", until: "1801-03-01", cond: s => s.flags.consul, title: "La machine infernale", place: "Rue Saint-Nicaise, Paris", scene: "paris", people: ["fouche", "josephine"],
      text: "Ce soir, vous vous rendez à l’Opéra entendre « La Création » de Haydn. Rue Saint-Nicaise, une charrette chargée d’un baril de poudre explose quelques secondes après le passage de votre voiture, lancée à vive allure par un cocher ivre. Joséphine, qui suivait, est indemne. Plusieurs passants sont tués. Paris attend votre réaction.",
      real: "Bonaparte accuse d’emblée les jacobins et fait déporter plus d’une centaine d’entre eux. Fouché prouve ensuite que l’attentat est l’œuvre de chouans royalistes, qui seront exécutés.",
      anecdote: "Bonaparte arrive à l’Opéra, s’assied dans sa loge et écoute l’oratorio comme si de rien n’était.",
      pre: { danger: { p: .03, type: "assassinat", cause: "Tué par la « machine infernale » de la rue Saint-Nicaise." } },
      choices: [
        { t: "Frapper les jacobins, vos opposants de gauche", hist: true, res: "Plus d’une centaine de jacobins sont déportés, alors même que la piste royaliste se précise.", fx: { s: { complot: -12, popularite: 4 }, r: { fouche: -6 } } },
        { t: "Laisser Fouché enquêter et punir les vrais coupables", res: "Fouché remonte la piste des chouans de Cadoudal.", fx: { s: { complot: -10, popularite: 6 }, r: { fouche: 12 } } },
        { t: "Afficher une clémence générale pour pacifier le pays", res: "Le geste rassure, mais les comploteurs s’enhardissent.", fx: { s: { complot: 6, popularite: 8 }, r: { fouche: -4 } } }
      ] },
    { id: "concordat", date: "1801-07-15", until: "1802-04-01", cond: s => s.flags.consul, title: "Le Concordat", place: "Hôtel de Brienne, Paris", scene: "palais", people: ["pie7", "talleyrand"],
      text: "Depuis la Révolution, l’Église de France est déchirée entre prêtres jureurs et réfractaires ; dans l’Ouest, la religion nourrit la chouannerie. Les envoyés de Pie VII négocient depuis des mois. Les généraux républicains, eux, grincent des dents à l’idée de voir revenir les évêques.",
      real: "Le Concordat est signé le 15 juillet 1801 : le catholicisme est reconnu comme « religion de la grande majorité des Français », l’État nomme les évêques et salarie le clergé.",
      anecdote: "Lors du Te Deum de 1802 à Notre-Dame, le général Delmas aurait lancé une remarque cinglante sur les « hommes morts pour supprimer tout cela » ; la formule exacte varie selon les sources.",
      choices: [
        { t: "Signer le Concordat avec Pie VII", hist: true, res: "La paix religieuse est rétablie ; la chouannerie perd son principal ressort.", fx: { s: { popularite: 8, complot: -10, loyaute: -4 }, r: { pie7: 30 }, f: { concordat: true }, c: { reforms: 1, treaties: 1 } } },
        { t: "Maintenir la séparation et l’Église constitutionnelle", res: "Les républicains applaudissent, l’Ouest gronde.", fx: { s: { popularite: -6, complot: 8, loyaute: 6 }, r: { pie7: -20 } } },
        { t: "Fonder une Église gallicane soumise à l’État seul", res: "Rome condamne ; le schisme s’installe.", fx: { s: { popularite: -4, complot: 6 }, r: { pie7: -40 }, f: { schisme: true } } }
      ] },
    { id: "amiens", date: "1802-03-25", until: "1802-10-01", cond: s => s.flags.consul, title: "La paix d’Amiens", place: "Amiens", scene: "palais", people: ["talleyrand", "pitt"],
      text: "Après dix ans de guerre, l’Angleterre, épuisée financièrement, accepte de négocier. Joseph, votre frère, mène les discussions. L’accord vous ferait rendre l’Égypte ; Londres rendrait la plupart de ses conquêtes coloniales, mais garderait Ceylan et Trinidad. Malte doit revenir aux chevaliers de Saint-Jean.",
      real: "La paix d’Amiens est signée le 25 mars 1802. Toute l’Europe est en paix pour la première fois depuis 1792. Elle ne dure que quatorze mois.",
      anecdote: "Des milliers de Britanniques se ruent à Paris pour voir le Louvre et apercevoir le Premier consul.",
      choices: [
        { t: "Signer la paix", hist: true, res: "La paix est signée. Les fonds publics remontent, le commerce reprend.", fx: { s: { coalition: -30, popularite: 12, tresor: 40 }, r: { pitt: 15, talleyrand: 8 }, f: { atWar: false, peace: true }, c: { treaties: 1 } } },
        { t: "Exiger Malte et poursuivre la guerre", res: "Londres refuse ; la guerre continue sur mer.", fx: { s: { coalition: 8, popularite: -6, tresor: -20 }, r: { pitt: -10 } } }
      ] },
    { id: "consulvie", date: "1802-08-02", until: "1803-06-01", cond: s => s.rank === "consul", title: "Le Consulat à vie", place: "Palais des Tuileries", scene: "palais", people: ["talleyrand", "fouche"],
      text: "La paix vous a rendu immensément populaire. Vos partisans au Sénat proposent un plébiscite : « Napoléon Bonaparte sera-t-il consul à vie ? ». Fouché vous met en garde : les républicains sincères n’y verront qu’une monarchie déguisée.",
      real: "Le plébiscite d’août 1802 approuve le Consulat à vie par environ 3,5 millions de oui contre quelques milliers de non. La Légion d’honneur avait été créée en mai.",
      anecdote: "Les registres de vote étaient ouverts, signés publiquement : voter « non » demandait du courage.",
      choices: [
        { t: "Accepter le plébiscite et devenir consul à vie", hist: true, res: "Le peuple approuve massivement. Votre pouvoir n’a plus de terme.", fx: { s: { popularite: 6, complot: 6 }, r: { fouche: -6 }, rank: "consulvie", c: { reforms: 1 } } },
        { t: "Refuser et garder un mandat de dix ans", res: "Les républicains vous saluent. Les ambitieux attendent la fin du mandat.", fx: { s: { popularite: 4, complot: -6, loyaute: -4 }, r: { fouche: 8 }, f: { republican: true } } }
      ] },
    { id: "enghien", date: "1804-03-15", until: "1804-07-01", cond: s => s.flags.consul && !s.flags.empire, title: "Le duc d’Enghien", place: "Château de Vincennes", scene: "paris", people: ["talleyrand", "fouche", "alexandre"],
      text: "La police vient de démanteler le complot de Cadoudal, qui voulait vous enlever ou vous tuer. Les conjurés évoquent l’arrivée imminente d’un « prince » Bourbon. Le duc d’Enghien, petit-fils du prince de Condé, vit à Ettenheim, en territoire badois, à quelques lieues du Rhin. Une colonne de dragons pourrait l’enlever cette nuit.",
      real: "Enlevé en territoire neutre, le duc d’Enghien est jugé sommairement et fusillé dans les fossés de Vincennes le 21 mars 1804. Il n’avait aucun lien établi avec le complot. L’Europe des cours est scandalisée.",
      anecdote: "« C’est pire qu’un crime, c’est une faute » : le mot est attribué tantôt à Boulay de la Meurthe, tantôt à Fouché ou à Talleyrand.",
      choices: [
        { t: "Faire enlever, juger et exécuter le duc", hist: true, res: "Le duc est fusillé à l’aube. Les royalistes sont terrorisés, les cours d’Europe indignées.", fx: { s: { complot: -18, coalition: 12, popularite: -2 }, r: { alexandre: -25, talleyrand: -4 }, f: { enghien: true } } },
        { t: "Le faire enlever, mais l’emprisonner sans le juger", res: "Un otage précieux ; les royalistes grondent mais n’osent rien.", fx: { s: { complot: -6, coalition: 5 }, r: { alexandre: -8 } } },
        { t: "Ne pas violer le territoire badois", res: "Vous gardez votre réputation. Les comploteurs, eux, gardent espoir.", fx: { s: { complot: 8, coalition: -3 }, r: { alexandre: 4 } } }
      ] },
    { id: "code", date: "1804-03-21", until: "1804-09-01", cond: s => s.flags.consul, title: "Le Code civil", place: "Conseil d’État", scene: "palais", people: ["talleyrand"],
      text: "Depuis quatre ans, vous présidez une bonne partie des séances du Conseil d’État consacrées au nouveau Code. Portalis, Tronchet, Bigot de Préameneu et Maleville ont fondu le droit coutumier, le droit romain et les acquis de 1789 en 2 281 articles. Reste à trancher les derniers points : la place des femmes, le divorce, l’autorité du père.",
      real: "Le « Code civil des Français » est promulgué le 21 mars 1804 : égalité devant la loi, propriété, contrat, mariage civil et divorce. Il consacre aussi l’incapacité juridique de la femme mariée.",
      anecdote: "Il deviendra le « Code Napoléon » en 1807 et inspirera le droit de dizaines de pays, de la Belgique au Québec et à l’Amérique latine.",
      choices: [
        { t: "Promulguer le Code tel qu’il a été préparé", hist: true, res: "Le Code est promulgué. Il survivra à tous les régimes.", fx: { s: { popularite: 8, complot: -4 }, f: { codeCivil: true }, c: { reforms: 1 } } },
        { t: "Le promulguer en élargissant les droits des femmes mariées", res: "Une audace juridique qui choque une partie des notables.", fx: { s: { popularite: 3, complot: 3 }, f: { codeCivil: true, codeLiberal: true }, c: { reforms: 1 } } },
        { t: "Différer : le Code doit encore être revu", res: "La France attendra son droit commun.", fx: { s: { popularite: -3 } } }
      ] },
    { id: "empire", date: "1804-05-18", until: "1805-06-01", cond: s => s.flags.consul && !s.flags.empire, title: "Proclamer l’Empire ?", place: "Saint-Cloud", scene: "palais", people: ["fouche", "talleyrand", "josephine"],
      text: "Après le complot de Cadoudal, le Sénat juge qu’un pouvoir héréditaire découragerait les assassins : tuer le chef ne suffirait plus à abattre le régime. Fouché lui-même pousse à l’hérédité. On vous propose le titre d’« Empereur des Français ».",
      real: "Le sénatus-consulte du 18 mai 1804 confie « le gouvernement de la République à un Empereur ». Le plébiscite approuve, et dix-huit maréchaux sont nommés le lendemain.",
      anecdote: "Beethoven aurait rayé la dédicace de sa 3e symphonie à Bonaparte en apprenant la nouvelle ; elle deviendra « Héroïque ». Le récit vient de son élève Ferdinand Ries.",
      choices: [
        { t: "Accepter le titre d’Empereur et nommer les maréchaux", hist: true, res: "Vous devenez Napoléon Ier. Dix-huit maréchaux reçoivent leur bâton.", fx: { s: { loyaute: 14, complot: -10, coalition: 10, popularite: 2 }, r: { fouche: 6, berthier: 8, ney: 8, davout: 8, murat: 8 }, rank: "empereur", f: { empire: true } } },
        { t: "Rester Premier consul : la République ne doit pas mourir", res: "Les républicains vous admirent ; les royalistes guettent la faille.", fx: { s: { complot: 8, popularite: 6, coalition: -5 }, f: { republican: true, noEmpire: true } } }
      ] },
    { id: "sacre", date: "1804-12-02", until: "1805-03-01", cond: s => s.rank === "empereur" && !s.flags.sacred, title: "Le Sacre", place: "Cathédrale Notre-Dame de Paris", scene: "palais", people: ["pie7", "josephine", "letizia"],
      text: "Pie VII est venu de Rome pour vous sacrer. La cathédrale a été décorée de faux décors néogothiques, l’orchestre compte des centaines de musiciens. Le protocole a été âprement négocié : le pape bénira les couronnes. Mais qui posera la couronne sur votre tête ?",
      real: "Le 2 décembre 1804, après l’onction par le pape, Napoléon se couronne lui-même, puis couronne Joséphine. Letizia, en froid avec son fils, n’assiste pas à la cérémonie.",
      anecdote: "David la peindra pourtant au centre de la tribune, sur ordre de l’Empereur.",
      choices: [
        { t: "Prendre la couronne et vous couronner vous-même", hist: true, res: "Le geste est calculé : vous ne tenez votre pouvoir que de la Nation et de vous-même.", fx: { s: { popularite: 6, complot: -6 }, r: { pie7: -8, josephine: 10 }, f: { sacred: true } } },
        { t: "Recevoir la couronne des mains du pape", res: "Rome triomphe ; l’armée et les républicains murmurent.", fx: { s: { popularite: -2, loyaute: -6, complot: -4 }, r: { pie7: 20, josephine: 8 }, f: { sacred: true, papalCrown: true } } }
      ] },
    { id: "trafalgar", date: "1805-10-21", until: "1806-01-01", cond: s => s.rank === "empereur" && !s.flags.peaceEngland, title: "Ulm et Trafalgar", place: "Bavière", scene: "camp", people: ["berthier", "ney", "murat"],
      text: "La Grande Armée, levée du camp de Boulogne, a traversé l’Allemagne à marches forcées et encerclé l’Autrichien Mack dans Ulm : 25 000 hommes ont capitulé le 20 octobre. Le lendemain, au large de Cadix, l’amiral Villeneuve est sorti avec la flotte franco-espagnole contre Nelson. Un courrier arrive.",
      real: "Le 21 octobre 1805, à Trafalgar, la flotte franco-espagnole est anéantie. Nelson est tué au combat. L’Angleterre sera maîtresse des mers jusqu’à la fin de l’Empire.",
      anecdote: "Villeneuve, libéré par les Anglais, est retrouvé mort à Rennes en 1806, poignardé de plusieurs coups ; la thèse officielle est le suicide.",
      choices: [
        { t: "Taire le désastre naval et pousser vers Vienne", hist: true, res: "Les bulletins de la Grande Armée parlent d’Ulm ; Trafalgar y est à peine mentionné.", fx: { s: { popularite: 4, stress: 6, coalition: 4 }, f: { atWar: true } } },
        { t: "Lancer un grand programme de reconstruction navale", res: "Les arsenaux d’Anvers et de Brest tournent à plein.", fx: { s: { tresor: -80, coalition: -2 }, f: { atWar: true, navy: true } } }
      ] },
    { id: "austerlitz", date: "1805-12-02", until: "1806-04-01", cond: s => s.rank === "empereur" && s.flags.atWar && !s.flags.peaceEngland, title: "Le soleil d’Austerlitz", place: "Plateau de Pratzen, Moravie", scene: "bataille", people: ["davout", "berthier", "alexandre"],
      text: "Vous êtes loin de vos bases, face aux armées russe et autrichienne réunies, avec le tsar Alexandre et l’empereur François en personne. Vous avez volontairement abandonné le plateau de Pratzen et dégarni votre aile droite, pour faire croire à votre faiblesse. Les coalisés semblent mordre à l’hameçon. Davout arrive de Vienne à marche forcée.",
      real: "Le 2 décembre 1805, les coalisés descendent du plateau pour tourner votre droite ; Soult le reprend en plein centre. La victoire est totale. Le traité de Presbourg impose à l’Autriche une indemnité de 40 millions de francs.",
      anecdote: "Le soir de la bataille, Napoléon proclame : « Soldats, je suis content de vous ». Le bronze des canons pris servira à fondre la colonne Vendôme.",
      choices: [
        { t: "Feindre la faiblesse et attendre qu’ils quittent le plateau", hist: true, res: "Au lever du soleil, les colonnes coalisées descendent de Pratzen.",
          battle: { name: "Austerlitz", base: .82, need: 60, win: { s: { coalition: -28, departements: 4, tresor: 120, popularite: 15, moral: 15, loyaute: 8 }, r: { alexandre: -6, davout: 8 }, c: { treaties: 1 }, txt: "Victoire totale. L’Autriche signe à Presbourg ; la troisième coalition s’effondre." }, loss: { s: { armee: -45, moral: -25, popularite: -15, coalition: 12 }, txt: "La feinte est éventée. Vous retraitez vers Brünn." } } },
        { t: "Attaquer de front sans attendre Davout", res: "Une bataille de chocs, sans finesse.",
          battle: { name: "Austerlitz", base: .5, need: 70, win: { s: { coalition: -15, tresor: 60, popularite: 8 }, txt: "Victoire coûteuse : l’ennemi recule en ordre." }, loss: { s: { armee: -60, moral: -25, popularite: -18, coalition: 15 }, txt: "Vos colonnes se brisent sur la ligne russe." } } },
        { t: "Négocier une paix immédiate avec le tsar", res: "Alexandre, persuadé de vous battre, refuse.", fx: { s: { coalition: 4, moral: -8 }, r: { alexandre: 6 } } }
      ] },
    { id: "iena", date: "1806-10-14", until: "1807-01-01", cond: s => s.rank === "empereur" && !s.flags.peaceEngland, title: "Iéna et Auerstaedt", place: "Saxe", scene: "bataille", people: ["davout", "ney", "murat"],
      text: "La Prusse, restée neutre l’an dernier, vous a lancé un ultimatum. Son armée, héritière de Frédéric II, a la réputation d’être la meilleure d’Europe, mais ses généraux ont plus de soixante ans. Vous pensez avoir son armée principale devant vous, près d’Iéna. Davout, seul avec 26 000 hommes, est à Auerstaedt.",
      real: "Le 14 octobre 1806, Napoléon bat à Iéna une partie de l’armée prussienne, tandis que Davout écrase le gros de l’armée à Auerstaedt, à un contre deux. Berlin est prise le 27 octobre.",
      choices: [
        { t: "Livrer bataille à Iéna et faire confiance à Davout", hist: true, res: "Deux batailles le même jour.",
          battle: { name: "Iéna", base: .8, need: 80, win: { s: { coalition: -15, tresor: 100, departements: 3, popularite: 10, moral: 10 }, r: { davout: 15 }, txt: "L’armée prussienne cesse d’exister. Vous entrez dans Berlin." }, loss: { s: { armee: -50, moral: -20, popularite: -12, coalition: 15 }, txt: "Les Prussiens tiennent la Saale." } } },
        { t: "Concentrer toute l’armée avant d’attaquer", res: "Plus sûr, plus lent.", battle: { name: "Iéna", base: .7, need: 80, win: { s: { coalition: -10, tresor: 60, popularite: 6 }, txt: "Victoire, mais l’armée prussienne s’échappe vers l’Oder." }, loss: { s: { armee: -30, moral: -15 }, txt: "Vous laissez filer l’occasion." } } }
      ] },
    { id: "blocus", date: "1806-11-21", until: "1807-04-01", cond: s => s.rank === "empereur" && !s.flags.peaceEngland, title: "Le Blocus continental", place: "Berlin", scene: "palais", people: ["talleyrand"],
      text: "Maître du continent, vous ne pouvez pas atteindre l’Angleterre, protégée par sa flotte. Une idée s’impose : la ruiner en lui fermant tous les ports d’Europe. Talleyrand vous rappelle que les marchands de Hambourg, d’Amsterdam et de Bordeaux vivent du commerce anglais.",
      real: "Le décret de Berlin du 21 novembre 1806 interdit tout commerce avec les îles Britanniques. Le blocus, mal appliqué et contourné par la contrebande, pèse lourdement sur les alliés de la France.",
      choices: [
        { t: "Décréter le Blocus continental", hist: true, res: "Les ports d’Europe se ferment aux navires anglais. La contrebande s’organise.", fx: { s: { coalition: 6, popularite: -2 }, r: { talleyrand: -6 }, f: { blocus: true } } },
        { t: "Chercher une paix de compromis avec Londres", res: "Fox, au pouvoir à Londres, sonde la paix, puis meurt en septembre. Les pourparlers s’enlisent.", fx: { s: { coalition: -6 }, r: { talleyrand: 8 } } }
      ] },
    { id: "tilsit", date: "1807-06-25", until: "1807-12-01", cond: s => s.rank === "empereur" && !s.flags.peaceEngland, title: "Le radeau du Niémen", place: "Tilsit, sur le Niémen", scene: "mer", people: ["alexandre", "talleyrand"],
      text: "Après le carnage d’Eylau et la victoire de Friedland, l’armée russe a reflué derrière le Niémen. Le tsar Alexandre accepte de vous rencontrer, seul à seul, sur un radeau ancré au milieu du fleuve. Le roi de Prusse attend sur la rive, sous la pluie.",
      real: "Les traités de Tilsit (7 et 9 juillet 1807) font d’Alexandre un allié et le membre du Blocus. La Prusse perd la moitié de son territoire ; le duché de Varsovie est créé.",
      anecdote: "Selon la tradition, la première phrase d’Alexandre aurait été : « Je hais les Anglais autant que vous ». La source principale est Napoléon lui-même.",
      choices: [
        { t: "Faire du tsar un allié et partager l’Europe", hist: true, res: "Deux empereurs se partagent le continent.", battle: null, fx: { s: { coalition: -25, departements: 2, popularite: 8 }, r: { alexandre: 45, talleyrand: 4 }, c: { treaties: 1 }, f: { tilsit: true } } },
        { t: "Restaurer un royaume de Pologne complet", res: "Les Polonais vous acclament ; le tsar se sent menacé.", fx: { s: { coalition: 4, departements: 2 }, r: { alexandre: -30 }, f: { polandRestored: true }, c: { treaties: 1 } } },
        { t: "Rayer la Prusse de la carte", res: "Une humiliation que la Prusse n’oubliera pas.", fx: { s: { coalition: 6, departements: 6, tresor: 60 }, r: { alexandre: 10 } } }
      ] },
    { id: "espagne", date: "1808-05-02", until: "1808-10-01", cond: s => s.rank === "empereur", title: "L’affaire d’Espagne", place: "Bayonne", scene: "palais", people: ["murat", "talleyrand"],
      text: "La monarchie espagnole se déchire : le roi Charles IV et son fils Ferdinand se disputent le trône sous vos yeux, à Bayonne. Murat occupe Madrid ; ce matin, la ville s’est soulevée contre ses troupes et la répression a été féroce. Vous pourriez placer un Bonaparte sur le trône d’Espagne.",
      real: "Napoléon obtient l’abdication des deux Bourbons et fait de son frère Joseph le roi d’Espagne. Le pays s’embrase ; la capitulation de Bailén, en juillet, stupéfie l’Europe. La guerre d’Espagne mobilisera 200 000 à 300 000 soldats jusqu’en 1814.",
      anecdote: "Goya peindra en 1814 « Le Tres de Mayo », les fusillades de la nuit qui suivit le soulèvement.",
      choices: [
        { t: "Placer Joseph sur le trône d’Espagne", hist: true, res: "Joseph entre à Madrid. Toute l’Espagne prend les armes.", fx: { s: { departements: 2, coalition: 8, popularite: -4 }, r: { murat: -4 }, f: { spainWar: true, atWar: true } } },
        { t: "Soutenir Ferdinand comme roi allié", res: "L’Espagne reste un allié fragile, mais un allié.", fx: { s: { coalition: -4, popularite: 2 }, f: { spainAlly: true } } },
        { t: "Retirer les troupes et laisser les Espagnols régler leurs affaires", res: "Vous perdez la face, pas une armée.", fx: { s: { popularite: -2, loyaute: -4, coalition: -2 } } }
      ] },
    { id: "talleyrand", date: "1809-01-28", until: "1809-04-01", cond: s => s.rank === "empereur" && GAME.relAlive(s, "talleyrand"), title: "Talleyrand et Fouché", place: "Palais des Tuileries", scene: "palais", people: ["talleyrand", "fouche"],
      text: "Rentré d’Espagne en hâte, vous apprenez que Talleyrand et Fouché, ennemis notoires, ont été vus bras dessus bras dessous dans un salon parisien. Ils auraient discuté de votre succession si vous tombiez en Espagne, Murat dans le rôle de remplaçant. Le conseil restreint est réuni ce matin.",
      real: "Le 28 janvier 1809, Napoléon invective Talleyrand pendant une demi-heure devant les ministres. Talleyrand perd sa charge de grand chambellan mais reste au Conseil — et commence à renseigner l’Autriche et la Russie.",
      anecdote: "Selon les témoins, Napoléon le traite de « merde dans un bas de soie ». Talleyrand, impassible, aurait commenté en sortant : « Quel dommage qu’un si grand homme soit si mal élevé ».",
      choices: [
        { t: "L’humilier publiquement, mais le garder près de vous", hist: true, res: "Talleyrand encaisse en silence. Il ne pardonnera jamais.", fx: { s: { complot: 6, stress: 8 }, r: { talleyrand: -35, fouche: -8 } } },
        { t: "Le faire arrêter et exiler en province", res: "Le coup est rude pour les comploteurs, mais Talleyrand a des amis partout.", fx: { s: { complot: -6, coalition: 4, popularite: -2 }, r: { talleyrand: -60, fouche: -15 }, f: { talleyrandExiled: true } } },
        { t: "Le recevoir seul et chercher à le regagner", res: "Il s’incline, promet, sourit. Que pense-t-il vraiment ?", fx: { s: { complot: -2 }, r: { talleyrand: 12 } } }
      ] },
    { id: "wagram", date: "1809-07-05", until: "1809-11-01", cond: s => s.rank === "empereur", title: "Wagram", place: "Île Lobau, Danube", scene: "bataille", people: ["davout", "berthier"],
      text: "L’Autriche a repris les armes. En mai, à Aspern-Essling, vous avez subi votre premier revers personnel ; le maréchal Lannes y a eu les jambes brisées par un boulet et il est mort quelques jours plus tard. Il faut à nouveau franchir le Danube, cette fois avec 150 000 hommes, face à l’archiduc Charles.",
      real: "Les 5 et 6 juillet 1809, à Wagram, Napoléon remporte une victoire coûteuse. Le traité de Schönbrunn, en octobre, ampute l’Autriche de 3,5 millions de sujets.",
      choices: [
        { t: "Franchir le Danube de nuit sur des ponts préparés", hist: true, res: "Sous un orage, l’armée passe en quelques heures.",
          battle: { name: "Wagram", base: .7, need: 120, win: { s: { coalition: -16, departements: 4, tresor: 80, popularite: 6 }, c: { treaties: 1 }, txt: "Victoire. L’Autriche cède l’Illyrie et la Galicie." }, loss: { s: { armee: -60, moral: -20, popularite: -15, coalition: 12, complot: 10 }, txt: "L’archiduc Charles tient. L’Europe reprend espoir." } } },
        { t: "Proposer la paix sans combattre", res: "Vienne gagne du temps pour mobiliser.", fx: { s: { coalition: 6, moral: -6 }, r: { metternich: 8 } } }
      ] },
    { id: "divorce", date: "1809-12-15", until: "1810-06-01", cond: s => s.family.spouse === "josephine" && s.rank === "empereur" && !GAME.hasHeir(s), title: "L’héritier", place: "Palais des Tuileries", scene: "palais", people: ["josephine", "letizia", "fouche"],
      text: "Vous avez quarante ans, aucun héritier légitime, et vous savez désormais pouvoir être père : Marie Walewska attend un enfant de vous. Le petit Napoléon-Charles, fils d’Hortense que vous pensiez désigner, est mort en 1807. Joséphine a quarante-six ans. Fouché et votre famille vous pressent de divorcer.",
      real: "Le divorce est prononcé le 15 décembre 1809 lors d’une cérémonie en famille, où chacun lit une déclaration. Joséphine garde le titre d’impératrice et la Malmaison.",
      anecdote: "Joséphine s’évanouit — ou feint de s’évanouir, selon les témoins — dans la soirée qui précède l’annonce.",
      choices: [
        { t: "Divorcer pour épouser une princesse capable de donner un héritier", hist: true, res: "Le divorce est prononcé. Joséphine se retire à la Malmaison.", fx: { s: { stress: 10, complot: -6, popularite: -3 }, r: { josephine: -15, letizia: 8, fouche: 6 }, spouse: null, ex: "josephine", f: { divorced: true } } },
        { t: "Rester avec Joséphine et adopter Eugène de Beauharnais comme héritier", res: "Vous désignez Eugène, vice-roi d’Italie. La dynastie reste fragile.", fx: { s: { stress: -4, complot: 6 }, r: { josephine: 25, letizia: -10 }, heir: "Eugène de Beauharnais, fils adoptif", f: { heirEugene: true } } }
      ] },
    { id: "mariage", date: "1810-02-01", until: "1810-12-01", cond: s => s.flags.divorced && !s.family.spouse, title: "Une princesse pour l’Empire", place: "Palais des Tuileries", scene: "palais", people: ["metternich", "alexandre", "marielouise"],
      text: "Deux cours s’offrent à vous. Saint-Pétersbourg fait traîner votre demande pour la grande-duchesse Anna, sœur du tsar, qui n’a que quinze ans. Vienne, par Metternich, laisse entendre que l’archiduchesse Marie-Louise, petite-nièce de Marie-Antoinette, pourrait vous être accordée.",
      real: "Napoléon épouse Marie-Louise : par procuration à Vienne le 11 mars 1810, puis à Paris les 1er et 2 avril. L’alliance autrichienne refroidit les relations avec la Russie.",
      choices: [
        { t: "Épouser l’archiduchesse Marie-Louise", hist: true, res: "La fille des Habsbourg devient impératrice des Français.", fx: { s: { coalition: -10, popularite: 2 }, r: { marielouise: 35, metternich: 20, alexandre: -12 }, spouse: "marielouise", f: { remarried: true, austrianMarriage: true } } },
        { t: "Attendre la grande-duchesse Anna et consolider l’alliance russe", res: "Après de longs mois, le tsar finit par accepter.", fx: { s: { coalition: -6 }, r: { alexandre: 25, metternich: -10 }, spouse: null, spouseName: "Anna Pavlovna de Russie", f: { remarried: true, russianMarriage: true } } }
      ] },
    { id: "roidrome", date: "1811-03-20", until: "1813-12-01", cond: s => s.flags.remarried && !s.flags.sonBorn && Math.random() < .4, title: "Une naissance aux Tuileries", place: "Palais des Tuileries", scene: "palais", people: ["marielouise"],
      text: "L’accouchement est long et dangereux ; le médecin Dubois vous demande de choisir, en cas de besoin, entre la mère et l’enfant. Paris attend les coups de canon : vingt et un pour une fille, cent un pour un garçon.",
      real: "Le 20 mars 1811 naît Napoléon François Charles Joseph, aussitôt titré roi de Rome. Au vingt-deuxième coup de canon, Paris explose de joie.",
      anecdote: "L’enfant, élevé à Vienne après 1814 sous le nom de duc de Reichstadt, meurt de la tuberculose à 21 ans, en 1832.",
      choices: [
        { t: "« Sauvez la mère »", hist: true, res: "La mère et l’enfant survivent. C’est un garçon : le roi de Rome.", fx: { s: { complot: -15, popularite: 10, stress: -10 }, r: { marielouise: 15 }, child: { name: "Napoléon François Charles Joseph, roi de Rome" }, f: { sonBorn: true } } },
        { t: "« Sauvez l’enfant, l’Empire avant tout »", res: "Les deux survivent, mais l’impératrice l’apprend et ne l’oubliera pas.", fx: { s: { complot: -15, popularite: 8 }, r: { marielouise: -20 }, child: { name: "Napoléon François Charles Joseph, roi de Rome" }, f: { sonBorn: true } } }
      ] },
    { id: "russie", date: "1812-06-22", until: "1813-06-01", cond: s => s.rank === "empereur" && !s.flags.tilsitStrong, title: "Franchir le Niémen ?", place: "Kowno, sur le Niémen", scene: "camp", people: ["alexandre", "berthier", "davout"],
      text: "Le tsar a rouvert ses ports aux navires neutres, ruinant le Blocus, et masse ses troupes à la frontière du duché de Varsovie. Plus de 600 000 hommes de vingt nations sont rassemblés le long du Niémen : la plus grande armée jamais vue en Europe. Caulaincourt, ancien ambassadeur à Saint-Pétersbourg, vous supplie de renoncer.",
      real: "Le 24 juin 1812, la Grande Armée franchit le Niémen. Les Russes refusent la bataille et reculent en pratiquant la terre brûlée. Chaleur, dysenterie et désertions fondent l’armée avant même le premier grand combat.",
      anecdote: "Selon Ségur, le cheval de l’Empereur fit un écart et le désarçonna au bord du Niémen ; un témoin aurait murmuré que c’était un mauvais présage.",
      choices: [
        { t: "Franchir le Niémen et forcer le tsar à la bataille", hist: true, res: "La Grande Armée s’enfonce en Lituanie. L’ennemi recule, l’armée fond.", fx: { s: { armee: -90, moral: -6, fatigue: 15, stress: 10, popularite: -3 }, r: { alexandre: -30 }, f: { inRussia: true, atWar: true }, scene: "camp", place: "Vitebsk" } },
        { t: "Mener une guerre limitée : tenir la Pologne et attendre", res: "Vous restez sur la Vistule. Le tsar n’ose pas attaquer.", fx: { s: { coalition: 6, moral: -4, tresor: -40 }, r: { alexandre: -10 }, f: { noRussia: true } } },
        { t: "Envoyer Caulaincourt négocier avec Alexandre", res: "La mission se joue sur votre relation avec le tsar.", fx: { r: { alexandre: 10 }, f: { noRussia: true }, gamble: { rel: "alexandre", threshold: -10, win: { s: { coalition: -20, tresor: 40 }, f: { peaceRussia: true }, txt: "Alexandre accepte un compromis : le Blocus est assoupli, la Pologne reste un duché." }, loss: { s: { coalition: 12, popularite: -6 }, txt: "Le tsar refuse et prépare la guerre." } } } },
        { t: "Porter l’effort sur l’Espagne et chasser Wellington", res: "200 000 hommes supplémentaires partent pour la péninsule.",
          fx: { f: { noRussia: true } },
          battle: { name: "Campagne du Portugal", base: .5, need: 150, win: { s: { coalition: -15, popularite: 10 }, r: { wellington: -15 }, f: { spainWar: false, spainWon: true }, txt: "Wellington rembarque à Lisbonne. La guérilla s’essouffle." }, loss: { s: { armee: -60, moral: -15, coalition: 8 }, r: { wellington: -10 }, txt: "Wellington tient les lignes de Torres Vedras. La guérilla continue." } } }
      ] },
    { id: "moskova", date: "1812-09-07", until: "1812-10-15", cond: s => s.flags.inRussia, title: "La Moskova", place: "Borodino", scene: "bataille", people: ["ney", "davout", "murat"],
      text: "Koutouzov a enfin accepté la bataille, à 120 kilomètres de Moscou, retranché derrière de grandes redoutes. Vous êtes fiévreux, enrhumé, souffrant de la vessie. Au milieu de la journée, Ney et Murat réclament la Garde impériale pour achever l’armée russe ébranlée.",
      real: "Le 7 septembre 1812, à Borodino, la bataille la plus meurtrière de l’époque fait environ 70 000 tués et blessés. Napoléon refuse d’engager la Garde : « À huit cents lieues de France, on ne fait pas démolir sa dernière réserve ». Les Russes se retirent en bon ordre.",
      choices: [
        { t: "Refuser d’engager la Garde", hist: true, res: "Vous gardez votre dernière réserve intacte.",
          battle: { name: "La Moskova", base: .6, need: 120, win: { s: { armee: -35, moral: 4 }, r: { ney: -6 }, txt: "Victoire indécise. La route de Moscou est ouverte, l’armée russe intacte." }, loss: { s: { armee: -50, moral: -15 }, txt: "Les Russes tiennent leurs redoutes. Vous reculez sur Smolensk." } } },
        { t: "Lancer la Garde pour anéantir Koutouzov", res: "Les bonnets à poil s’ébranlent.",
          battle: { name: "La Moskova", base: .55, need: 120, win: { s: { armee: -45, moral: 12, coalition: -10 }, r: { ney: 10, alexandre: 10 }, f: { russiaBroken: true }, txt: "L’armée russe est disloquée. Alexandre demande à négocier." }, loss: { s: { armee: -70, moral: -25, loyaute: -10 }, txt: "La Garde est saignée. Vous n’avez plus de réserve." } } }
      ] },
    { id: "moscou", date: "1812-09-15", until: "1812-11-01", cond: s => s.flags.inRussia, title: "Moscou brûle", place: "Le Kremlin, Moscou", scene: "neige", people: ["alexandre", "berthier"],
      text: "Moscou était presque vide quand vous y êtes entré. La nuit suivante, des incendies ont éclaté dans tous les quartiers ; le gouverneur Rostoptchine a fait évacuer les pompes. Les trois quarts de la ville sont en cendres. Le tsar ne répond pas à vos lettres. L’hiver arrive dans six semaines.",
      real: "Napoléon attend plus d’un mois une réponse d’Alexandre qui ne vient jamais. Il quitte Moscou le 19 octobre, trop tard. Barré à Maloïaroslavets, il doit reprendre la route dévastée de Smolensk.",
      choices: [
        { t: "Attendre la réponse du tsar à Moscou", hist: true, res: "Cinq semaines d’attente. L’hiver vous surprend sur la route.", fx: { s: { armee: -40, moral: -18, fatigue: 10, stress: 15 }, f: { lateRetreat: true }, scene: "neige" } },
        { t: "Partir immédiatement vers le sud, par Kalouga", res: "Vous gagnez des semaines précieuses sur l’hiver.",
          battle: { name: "Maloïaroslavets", base: .5, need: 60, win: { s: { armee: -15, moral: 6 }, txt: "Vous forcez le passage vers les provinces intactes du sud." }, loss: { s: { armee: -30, moral: -10 }, f: { lateRetreat: true }, txt: "Koutouzov vous barre la route ; il faut reprendre celle de Smolensk." } } },
        { t: "Hiverner à Moscou avec les réserves trouvées", res: "Un pari : tenir jusqu’au printemps, loin de tout.", fx: { s: { armee: -30, moral: -10, complot: 18, stress: 12 }, f: { winterMoscow: true } } }
      ] },
    { id: "malet", date: "1812-10-23", until: "1812-12-01", cond: s => s.flags.inRussia || s.flags.winterMoscow, title: "La conspiration Malet", place: "Paris (dépêche)", scene: "paris", people: ["marielouise"],
      text: "Une estafette vous rejoint. À Paris, le général Malet, évadé d’une maison de santé, a annoncé votre mort en Russie et proclamé un gouvernement provisoire. Pendant quelques heures, le préfet de police et le ministre de la Police ont été arrêtés. Personne n’a songé à proclamer votre fils empereur.",
      real: "La conspiration échoue en une matinée et Malet est fusillé. Mais Napoléon est frappé : « Napoléon II, on n’y pensait pas ! ». Il quittera l’armée le 5 décembre pour regagner Paris.",
      choices: [
        { t: "Laisser l’armée à Murat et rentrer au plus vite", hist: true, res: "Vous traversez l’Europe en traîneau, presque incognito.", fx: { s: { complot: -15, loyaute: -8, moral: -6, fatigue: 10 }, r: { murat: 4 }, danger: { p: .012, type: "accident", cause: "Le traîneau de l’Empereur est surpris par des cosaques en Lituanie." } } },
        { t: "Rester avec l’armée jusqu’au bout", res: "Les soldats voient l’Empereur marcher à pied dans la neige.", fx: { s: { moral: 10, loyaute: 6, complot: 10, fatigue: 15 } } }
      ] },
    { id: "berezina", date: "1812-11-26", until: "1812-12-31", cond: s => s.flags.inRussia && s.flags.lateRetreat, title: "La Bérézina", place: "Studienka, sur la Bérézina", scene: "neige", people: ["ney", "davout"],
      text: "Trois armées russes convergent pour vous enfermer contre la Bérézina, dont le pont de Borissov a été détruit. Le dégel a rendu la rivière infranchissable à gué. Le général Éblé a gardé, contre vos ordres, quelques outils et forges de campagne. Ses pontonniers proposent d’entrer dans l’eau glacée pour bâtir deux ponts.",
      real: "Du 26 au 29 novembre 1812, les pontonniers d’Éblé, dans l’eau jusqu’aux épaules, construisent deux ponts. Le gros de l’armée passe ; des milliers de traînards restent sur la rive est quand les ponts sont brûlés. Moins de 100 000 hommes repasseront le Niémen.",
      anecdote: "Presque tous les pontonniers d’Éblé meurent de froid ou d’épuisement dans les semaines qui suivent ; Éblé lui-même meurt à Königsberg le 31 décembre.",
      choices: [
        { t: "Faire construire les ponts à Studienka, malgré le prix", hist: true, res: "Les pontonniers entrent dans l’eau glacée.",
          fx: { danger: { p: .025, type: "bataille", cause: "Tué par l’artillerie russe sur la rive de la Bérézina." }, s: { fatigue: 12 } },
          battle: { name: "La Bérézina", base: .65, need: 30, win: { s: { armee: -60, moral: -10 }, txt: "L’essentiel de l’armée passe. Le piège russe s’est refermé sur le vide." }, loss: { s: { armee: -110, moral: -25, loyaute: -10 }, txt: "Les ponts cèdent sous la foule. Le désastre est total." } } },
        { t: "Forcer le passage à Borissov, sous le feu", res: "Une attaque frontale sur la tête de pont russe.",
          battle: { name: "Borissov", base: .35, need: 40, risk: .04, win: { s: { armee: -40 }, txt: "Le pont est repris par un coup d’audace." }, loss: { s: { armee: -130, moral: -30 }, txt: "L’armée est taillée en pièces." } } }
      ] },
    { id: "retraite", date: "1812-12-15", until: "1813-05-01", cond: s => s.flags.inRussia, title: "Le Niémen, de nouveau", place: "Kowno", scene: "neige", people: ["ney", "murat"],
      text: "Le maréchal Ney, dernier soldat de l’arrière-garde, a repassé le Niémen un fusil à la main. Ce qui reste de la Grande Armée tient dans quelques villes de Prusse orientale. La Prusse, votre alliée forcée, hésite. L’Europe entière sait désormais que vous pouvez être vaincu.",
      real: "La campagne a coûté environ 400 000 morts et prisonniers. Fin décembre, le général prussien Yorck signe la convention de Tauroggen avec les Russes : le début de la sixième coalition.",
      choices: [
        { t: "Lever immédiatement une nouvelle armée", hist: true, res: "La conscription est avancée ; on appelle même les classes futures.", fx: { s: { armee: 140, popularite: -10, tresor: -90, coalition: 14 }, f: { inRussia: false, russiaDone: true }, scene: "palais", place: "Palais des Tuileries" } },
        { t: "Proposer la paix au tsar sur la base de Tilsit", res: "Alexandre, porté par la victoire, se rêve en libérateur de l’Europe.", fx: { s: { coalition: 10, popularite: 4 }, r: { alexandre: 6 }, f: { inRussia: false, russiaDone: true }, scene: "palais", place: "Palais des Tuileries" } }
      ] },
    { id: "leipzig", date: "1813-10-16", until: "1814-01-01", cond: s => s.rank === "empereur" && (s.flags.russiaDone || s.stats.coalition >= 70), title: "La bataille des Nations", place: "Leipzig, Saxe", scene: "bataille", people: ["berthier", "ney", "metternich"],
      text: "Russes, Prussiens, Suédois et désormais Autrichiens convergent sur Leipzig : 300 000 hommes contre vos 190 000. Metternich a choisi son camp. Vos jeunes conscrits, les « Marie-Louise », se battent avec courage mais manquent de cavalerie. Une retraite derrière le Rhin reste possible, mais elle livrerait l’Allemagne.",
      real: "Du 16 au 19 octobre 1813, la « bataille des Nations » se termine par la défaite française, aggravée par la défection des Saxons et le dynamitage prématuré du pont de l’Elster, qui noie des milliers d’hommes et le maréchal Poniatowski.",
      choices: [
        { t: "Accepter la bataille autour de Leipzig", hist: true, res: "Trois jours de combats d’une violence inouïe.",
          battle: { name: "Leipzig", base: .3, need: 180, win: { s: { coalition: -20, popularite: 12, departements: 0 }, f: { leipzigWon: true }, txt: "Contre toute attente, la coalition recule. L’Allemagne reste à vous." }, loss: { s: { armee: -120, moral: -25, departements: -18, popularite: -15, coalition: 15, loyaute: -12 }, f: { lostLeipzig: true }, txt: "Défaite. L’armée repasse le Rhin ; l’Empire perd l’Allemagne." } } },
        { t: "Se retirer derrière le Rhin sans livrer bataille", res: "Vous abandonnez l’Allemagne pour sauver l’armée.", fx: { s: { departements: -14, moral: -10, popularite: -6, coalition: 6 }, f: { rhineRetreat: true } } },
        { t: "Accepter les « frontières naturelles » proposées par Metternich", res: "La France garderait la Belgique et la rive gauche du Rhin.", fx: { s: { departements: -22, coalition: -35, popularite: 6, loyaute: 6 }, r: { metternich: 20 }, f: { frankfurtPeace: true, atWar: false }, c: { treaties: 1 } } }
      ] },
    { id: "abdication", date: "1814-03-31", until: "1814-12-01", cond: s => s.rank === "empereur" && (s.flags.lostLeipzig || s.flags.rhineRetreat || s.stats.coalition >= 85), title: "Fontainebleau", place: "Château de Fontainebleau", scene: "palais", people: ["ney", "berthier", "marielouise"],
      text: "Malgré une campagne de France éblouissante, Paris a capitulé le 31 mars et le Sénat, à l’instigation de Talleyrand, vous a déclaré déchu. Vous êtes à Fontainebleau avec 60 000 hommes. Les maréchaux, Ney en tête, sont venus vous dire que l’armée ne marchera pas sur Paris.",
      real: "Napoléon abdique le 6 avril 1814. Le traité de Fontainebleau lui laisse la souveraineté de l’île d’Elbe. Dans la nuit du 12 au 13 avril, il tente de s’empoisonner ; le poison, éventé, ne le tue pas.",
      anecdote: "Le 20 avril, dans la cour du Cheval-Blanc, il fait ses adieux à la Vieille Garde et embrasse le drapeau.",
      choices: [
        { t: "Abdiquer et accepter la souveraineté de l’île d’Elbe", hist: true, res: "Vous partez pour l’Elbe. Louis XVIII monte sur le trône.", fx: { s: { stress: 20, popularite: -6 }, set: { armee: 1, departements: 1, tresor: 6, coalition: 30, complot: 10, loyaute: 40 }, r: { ney: -15, marielouise: -10 }, rank: "elbe", scene: "mer", place: "Portoferraio, île d’Elbe", f: { exileElba: true, abdicated: true, atWar: false } } },
        { t: "Marcher sur Paris avec les fidèles", res: "La Garde vous suit. Les maréchaux hésitent.",
          battle: { name: "Bataille de Paris", base: .18, need: 50, risk: .06, win: { s: { popularite: 15, coalition: -10 }, f: { parisRetaken: true }, txt: "Paris se soulève à votre approche. Les alliés négocient." }, loss: { s: { armee: -50 }, set: { armee: 1, departements: 1, tresor: 2, complot: 25 }, rank: "elbe", scene: "mer", place: "Portoferraio, île d’Elbe", f: { exileElba: true, abdicated: true }, txt: "Défait aux portes de Paris, vous êtes contraint à l’exil." } } },
        { t: "Abdiquer en faveur de votre fils, sous régence", res: "Les alliés refusent : c’est l’abdication sans condition ou la guerre.", fx: { s: { stress: 15 }, set: { armee: 1, departements: 1, tresor: 6, complot: 10 }, rank: "elbe", scene: "mer", place: "Portoferraio, île d’Elbe", f: { exileElba: true, abdicated: true } } }
      ] },
    { id: "centjours", date: "1815-02-26", until: "1816-06-01", cond: s => s.rank === "elbe", title: "Le vol de l’Aigle", place: "Portoferraio, île d’Elbe", scene: "mer", people: ["marielouise", "letizia"],
      text: "On ne vous verse pas la pension promise ; on parle à Vienne de vous déporter plus loin, aux Açores ou à Sainte-Hélène. Marie-Louise ne vous a jamais rejoint et vous ne voyez pas votre fils. De France, on vous écrit que les Bourbons sont impopulaires et que l’armée les méprise. Le brick l’Inconstant est au port.",
      real: "Le 26 février 1815, Napoléon quitte l’Elbe avec un millier d’hommes, débarque à Golfe-Juan le 1er mars et entre aux Tuileries le 20 mars sans tirer un coup de feu. Ney, qui avait promis de le ramener « dans une cage de fer », se rallie à lui.",
      anecdote: "Près de Grenoble, à Laffrey, il s’avance seul face aux soldats envoyés l’arrêter et ouvre sa redingote : les soldats crient « Vive l’Empereur ! ».",
      choices: [
        { t: "Quitter l’Elbe et reconquérir la France", hist: true, res: "L’Aigle vole de clocher en clocher jusqu’aux tours de Notre-Dame.", fx: { s: { popularite: 20, stress: 15, fatigue: 10 }, set: { armee: 200, departements: 87, tresor: 80, coalition: 92, complot: 25, loyaute: 55, moral: 75 }, r: { ney: 20 }, rank: "empereur", scene: "palais", place: "Palais des Tuileries", f: { centJours: true, exileElba: false, atWar: true }, danger: { p: .02, type: "bataille", cause: "Abattu par un détachement royaliste sur la route Napoléon." } } },
        { t: "Rester à l’Elbe et vivre en prince du Tyrrhénien", res: "Vous réorganisez les mines de fer, les routes et la flottille de l’île.", fx: { s: { stress: -10, popularite: -6 }, f: { stayedElba: true } } }
      ] },
    { id: "waterloo", date: "1815-06-18", until: "1815-08-01", cond: s => s.flags.centJours, title: "Waterloo", place: "Mont-Saint-Jean, Belgique", scene: "bataille", people: ["ney", "wellington"],
      text: "L’Europe entière a déclaré la guerre à votre personne. Vous avez frappé le premier en Belgique : Blücher a été battu à Ligny avant-hier, et Grouchy le poursuit avec 33 000 hommes. Wellington s’est retranché sur le plateau de Mont-Saint-Jean. Il a plu toute la nuit ; le terrain est détrempé et votre artillerie s’enlise.",
      real: "Napoléon attend que le sol sèche et n’attaque que vers 11 h 30. Les charges de cavalerie de Ney se brisent sur les carrés anglais. Les Prussiens de Blücher, que Grouchy n’a pas retenus, arrivent sur le flanc droit en fin d’après-midi. La Garde recule : c’est la déroute.",
      anecdote: "Grouchy, à Walhain, entend le canon de Waterloo. Son subordonné Gérard le supplie de « marcher au canon » ; Grouchy s’en tient à ses ordres écrits.",
      choices: [
        { t: "Attendre que le sol sèche pour faire donner l’artillerie", hist: true, res: "L’attaque commence vers 11 h 30.",
          battle: { name: "Waterloo", base: .3, need: 70, win: { s: { coalition: -20, popularite: 15, moral: 15 }, r: { wellington: -20, ney: 10 }, f: { waterlooWon: true }, txt: "Le centre anglais cède avant l’arrivée des Prussiens. Bruxelles est ouverte." }, loss: { s: { armee: -60, moral: -40, popularite: -20, loyaute: -20 }, f: { lostWaterloo: true }, txt: "Les Prussiens débouchent de Plancenoit. La Garde recule. C’est la déroute." } } },
        { t: "Attaquer dès l’aube, malgré la boue", res: "Les batteries s’enlisent mais l’assaut part à 7 heures.",
          battle: { name: "Waterloo", base: .48, need: 70, win: { s: { coalition: -22, popularite: 16, moral: 15 }, r: { wellington: -20 }, f: { waterlooWon: true }, txt: "Wellington est enfoncé avant midi. Blücher arrive sur un champ déjà perdu." }, loss: { s: { armee: -55, moral: -35, popularite: -18 }, f: { lostWaterloo: true }, txt: "L’assaut s’enlise dans la boue d’Hougoumont et de la Haye-Sainte." } } },
        { t: "Ordonner à Grouchy de rejoindre le champ de bataille", res: "Un aide de camp part au galop vers Wavre.",
          battle: { name: "Waterloo", base: .52, need: 70, win: { s: { coalition: -24, popularite: 18, moral: 15 }, r: { wellington: -20 }, f: { waterlooWon: true }, txt: "Les 33 000 hommes de Grouchy prennent les Prussiens de flanc. Wellington retraite vers la mer." }, loss: { s: { armee: -55, moral: -35, popularite: -18 }, f: { lostWaterloo: true }, txt: "Grouchy arrive trop tard. Les alliés l’emportent." } } }
      ] },
    { id: "apreswaterloo", date: "1815-07-01", until: "1815-12-01", cond: s => s.flags.waterlooWon, title: "Après la victoire", place: "Bruxelles", scene: "camp", people: ["wellington", "metternich", "alexandre"],
      text: "Vous êtes entré à Bruxelles. Mais l’Europe a mobilisé plus de 700 000 hommes : Autrichiens et Russes approchent du Rhin. La victoire vous donne un répit et une monnaie d’échange. À Vienne, le congrès est terminé et Metternich laisse entendre qu’un compromis n’est pas impossible si vous renoncez à la Belgique.",
      real: "Dans l’Histoire réelle, Waterloo est perdu : Napoléon abdique une seconde fois le 22 juin 1815.",
      choices: [
        { t: "Négocier une paix sur les frontières de 1814, au profit de votre fils", res: "Une paix de lassitude, mais une paix.", fx: { s: { coalition: -40, popularite: 10 }, r: { metternich: 20, alexandre: 15 }, f: { peace1815: true, atWar: false }, c: { treaties: 1 } } },
        { t: "Poursuivre la guerre et marcher sur le Rhin", res: "Vous jouez la carte du génie militaire contre le nombre.",
          battle: { name: "Campagne du Rhin", base: .33, need: 150, win: { s: { coalition: -25, departements: 9, popularite: 10 }, txt: "Les Autrichiens battus, la coalition se fissure." }, loss: { s: { armee: -90, popularite: -15 }, f: { lostWaterloo: true }, txt: "Écrasé sous le nombre, vous devez abdiquer." } } }
      ] },
    { id: "saintehelene", date: "1815-07-10", until: "1816-12-01", cond: s => s.flags.lostWaterloo && s.rank === "empereur", title: "Rochefort", place: "Île d’Aix, rade de Rochefort", scene: "mer", people: ["wellington"],
      text: "Vous avez abdiqué une seconde fois le 22 juin. Les Prussiens vous feraient fusiller s’ils vous prenaient. À Rochefort, deux frégates devaient vous conduire en Amérique, mais le navire anglais Bellerophon bloque la rade. Votre frère Joseph, qui vous ressemble, propose de prendre votre place.",
      real: "Le 15 juillet 1815, Napoléon se rend au capitaine Maitland du Bellerophon, espérant l’hospitalité britannique. Le gouvernement anglais le déporte à Sainte-Hélène, où il arrive le 15 octobre 1815.",
      anecdote: "Il écrit au prince régent qu’il vient « comme Thémistocle, s’asseoir au foyer du peuple britannique ». Joseph, lui, s’embarque pour l’Amérique et y vit des années près de Philadelphie.",
      choices: [
        { t: "Se rendre aux Anglais du Bellerophon", hist: true, res: "On vous déporte à Sainte-Hélène, à 1 900 kilomètres de l’Afrique.", fx: { s: { stress: 20, popularite: -4 }, set: { armee: 0, departements: 0, tresor: 2, coalition: 10, complot: 5, loyaute: 30 }, rank: "prisonnier", scene: "prison", place: "Longwood, Sainte-Hélène", f: { stHelena: true, atWar: false } } },
        { t: "Tenter de forcer le blocus pour l’Amérique", res: "Une nuit sans lune, un chasse-marée, quelques fidèles.",
          battle: { name: "Évasion vers l’Amérique", base: .35, need: 0, risk: .05, win: { set: { armee: 0, departements: 0, tresor: 10, coalition: 5, complot: 5 }, rank: "exilam", scene: "mer", place: "Point Breeze, New Jersey", f: { america: true, atWar: false }, txt: "Vous débarquez à New York sous un nom d’emprunt." }, loss: { set: { armee: 0, departements: 0, tresor: 1, coalition: 10, complot: 5 }, rank: "prisonnier", scene: "prison", place: "Longwood, Sainte-Hélène", f: { stHelena: true, atWar: false }, txt: "La Royal Navy intercepte l’embarcation. Direction : Sainte-Hélène." } } }
      ] },
    { id: "lowe", date: "1816-04-17", until: "1817-12-01", cond: s => s.flags.stHelena, title: "Hudson Lowe", place: "Longwood, Sainte-Hélène", scene: "prison", people: [],
      text: "Le nouveau gouverneur de l’île, Sir Hudson Lowe, applique ses consignes à la lettre : un officier doit vous voir deux fois par jour, votre courrier est lu, vos promenades limitées. Il ne vous appelle que « général Bonaparte ». Le comte de Las Cases, lui, note chaque soir vos souvenirs.",
      real: "Les relations entre Napoléon et Hudson Lowe tournent à la guerre froide : ils ne se rencontrent que six fois, la dernière en août 1816. Las Cases, expulsé en novembre 1816, publiera en 1823 « Le Mémorial de Sainte-Hélène », immense succès qui forge la légende.",
      choices: [
        { t: "Refuser tout compromis et dicter vos mémoires", hist: true, res: "Vous construisez votre légende, page après page.", fx: { s: { stress: 10, popularite: 10 }, f: { memorial: true }, c: { reforms: 0 } } },
        { t: "Accepter les règles pour obtenir plus de liberté", res: "Vos promenades s’allongent ; votre santé s’en ressent favorablement.", fx: { s: { stress: -12, sante: 6, popularite: -4 } } }
      ] }
  ],

  /* ---------------- Événements de secours (si l’IA ne répond pas) ---------------- */
  randomEvents: [
    { id: "dettesjo", cond: s => s.family.spouse === "josephine" && GAME.relAlive(s, "josephine"), title: "Les dettes de Joséphine", people: ["josephine"], scene: "palais",
      text: "Votre intendant vous présente un état accablant : modistes, bijoutiers et marchands de plantes rares réclament plus d’un million de francs à Joséphine. Elle jure n’avoir rien acheté d’inutile. La Malmaison se couvre de serres et de roses venues du monde entier.",
      choices: [
        { t: "Payer, en lui faisant une scène", res: "Les créanciers sont réglés ; Joséphine pleure, puis recommence.", fx: { s: { tresor: -12, stress: 4 }, r: { josephine: -4 } } },
        { t: "Payer sans un mot", res: "Joséphine est touchée ; le Trésor un peu moins.", fx: { s: { tresor: -12 }, r: { josephine: 10 } } },
        { t: "Faire réduire les factures par vos agents", res: "Les fournisseurs sont payés à moitié ; Paris en fait des gorges chaudes.", fx: { s: { tresor: -5, popularite: -2 }, r: { josephine: -8 } } }
      ] },
    { id: "pain", cond: s => GAME.power(s) >= 2, title: "Le prix du pain", people: [], scene: "paris",
      text: "La récolte est mauvaise dans le Bassin parisien et le prix du pain de quatre livres s’envole. Les préfets signalent des attroupements devant les boulangeries. Les souvenirs de 1789 hantent les ministres.",
      choices: [
        { t: "Fixer un prix maximum et réquisitionner les grains", res: "Le pain reste abordable, mais les paysans cachent leurs récoltes.", fx: { s: { popularite: 5, tresor: -15, complot: -2 } } },
        { t: "Ouvrir des soupes populaires et acheter du blé à l’étranger", res: "Les soupes économiques calment les faubourgs.", fx: { s: { popularite: 7, tresor: -30 } } },
        { t: "Laisser faire le marché", res: "Les prix finissent par baisser, après des semaines de colère.", fx: { s: { popularite: -8, complot: 5 } } }
      ] },
    { id: "refractaires", cond: s => GAME.power(s) >= 2 && s.stats.armee > 150, title: "Les réfractaires", people: [], scene: "camp",
      text: "Dans le Massif central et les Pyrénées, des milliers de jeunes gens fuient la conscription dans les bois. Certains se mutilent pour être réformés. Les familles aisées, elles, achètent des remplaçants.",
      choices: [
        { t: "Envoyer des colonnes mobiles et loger des garnisaires chez les familles", res: "Les réfractaires rentrent, la haine reste.", fx: { s: { armee: 20, popularite: -6 } } },
        { t: "Proclamer une amnistie pour ceux qui se présentent", res: "Beaucoup reviennent ; l’autorité en sort affaiblie.", fx: { s: { armee: 10, popularite: 3, loyaute: -3 } } },
        { t: "Augmenter le prix du remplacement", res: "Le Trésor encaisse, l’injustice choque.", fx: { s: { tresor: 25, popularite: -4 } } }
      ] },
    { id: "rivalite", cond: s => s.rank === "empereur" && GAME.relAlive(s, "ney") && GAME.relAlive(s, "davout"), title: "Querelle de maréchaux", people: ["ney", "davout"], scene: "camp",
      text: "Ney accuse Davout de lui avoir volé la gloire d’une victoire dans un bulletin de l’armée. Davout répond qu’il n’a fait que rapporter les faits. Les deux états-majors ne se parlent plus et les ordres circulent mal.",
      choices: [
        { t: "Donner raison à Ney", res: "Le brave des braves est satisfait ; Davout se renferme.", fx: { s: { loyaute: -2 }, r: { ney: 12, davout: -12 } } },
        { t: "Donner raison à Davout", res: "Davout reçoit une dotation ; Ney fulmine.", fx: { s: { tresor: -10 }, r: { davout: 12, ney: -12 } } },
        { t: "Les réconcilier à votre table", res: "Une poignée de main, des sourires crispés.", fx: { s: { loyaute: 4, stress: 3 }, r: { ney: 3, davout: 3 } } }
      ] },
    { id: "contrebande", cond: s => s.flags.blocus && s.rank === "empereur", title: "La contrebande", people: ["fouche"], scene: "mer",
      text: "Les douaniers signalent que le sucre, le café et les cotonnades anglaises entrent en masse par Hambourg et par la Hollande, où votre frère Louis ferme les yeux. Les marchands français, privés de débouchés, réclament des licences d’importation.",
      choices: [
        { t: "Faire brûler publiquement les marchandises saisies", res: "Les autodafés impressionnent, la contrebande continue.", fx: { s: { popularite: -3, coalition: 2 } } },
        { t: "Vendre des licences d’importation", res: "Le Trésor y gagne, le Blocus y perd sa crédibilité.", fx: { s: { tresor: 40, coalition: -2 }, r: { alexandre: -4 } } },
        { t: "Annexer la Hollande pour fermer la brèche", res: "Louis abdique, la Hollande devient française.", fx: { s: { departements: 9, coalition: 6, popularite: -2 } } }
      ] },
    { id: "corvisart", cond: s => s.stats.fatigue > 60 || s.stats.sante < 55, title: "L’avis du médecin", people: [], scene: "palais",
      text: "Votre médecin vous trouve le teint jaune, le pouls irrégulier et le sommeil réduit à quatre heures par nuit. Il vous prescrit le repos, des bains chauds et moins de café. Vous avez vingt dossiers urgents sur votre bureau.",
      choices: [
        { t: "Obéir et prendre deux semaines de repos", res: "Le travail s’accumule, mais vous retrouvez des forces.", fx: { s: { fatigue: -20, stress: -10, sante: 6, popularite: -2 } } },
        { t: "Prendre des bains chauds, mais continuer de travailler", res: "Un compromis à la Bonaparte : bains brûlants et dictées dans la baignoire.", fx: { s: { fatigue: -6, sante: 2 } } },
        { t: "Renvoyer le médecin", res: "Vous travaillez comme avant. Le corps proteste.", fx: { s: { fatigue: 5, sante: -4, stress: 3 } } }
      ] },
    { id: "pauline", cond: s => GAME.power(s) >= 2, title: "Pauline fait scandale", people: [], scene: "palais",
      text: "Votre sœur Pauline, princesse Borghèse, a posé presque nue pour le sculpteur Canova, et tout Rome en parle. Son mari, le prince Camille, se plaint de ses frasques à qui veut l’entendre. Les salons royalistes de Paris en font leurs délices.",
      choices: [
        { t: "Exiger qu’elle rentre auprès de son mari", res: "Pauline boude, mais obéit… quelque temps.", fx: { s: { popularite: 2, stress: 3 }, r: { letizia: 4 } } },
        { t: "En rire et la laisser vivre", res: "Votre indulgence nourrit les pamphlets.", fx: { s: { popularite: -3, stress: -2 } } }
      ] },
    { id: "lycees", cond: s => GAME.power(s) >= 2 && !s.flags.lycees, once: true, title: "Former les élites", people: [], scene: "paris",
      text: "Fourcroy, directeur de l’Instruction publique, propose de créer des lycées dans chaque ressort de cour d’appel : uniforme, tambour, latin et mathématiques, et des bourses pour les fils d’officiers. Les écoles religieuses, elles, réclament la liberté d’enseigner.",
      choices: [
        { t: "Créer les lycées d’État", res: "Les premiers lycées ouvrent : la France aura ses cadres.", fx: { s: { tresor: -25, popularite: 4 }, f: { lycees: true }, c: { reforms: 1 } } },
        { t: "Laisser l’enseignement à l’Église et aux communes", res: "Économique, mais l’État renonce à former ses élites.", fx: { s: { popularite: 2 }, r: { pie7: 8 }, f: { lycees: true } } }
      ] },
    { id: "banque", cond: s => GAME.power(s) >= 2 && s.stats.tresor < 150, title: "Panique à la Banque de France", people: [], scene: "paris",
      text: "Des spéculateurs, liés au munitionnaire Ouvrard, ont fait vaciller la Banque de France. Les porteurs de billets font la queue pour obtenir des espèces. Le ministre du Trésor Barbé-Marbois est dépassé.",
      choices: [
        { t: "Faire rendre gorge aux spéculateurs", res: "Ouvrard et ses associés doivent restituer des millions.", fx: { s: { tresor: 45, popularite: 4, complot: 3 } } },
        { t: "Garantir les billets sur votre propre trésor de guerre", res: "La confiance revient, la caisse de l’armée se vide.", fx: { s: { tresor: -20, popularite: 6, moral: -3 } } },
        { t: "Renvoyer le ministre et réformer le Trésor", res: "Mollien, nouveau ministre, impose une comptabilité rigoureuse.", fx: { s: { tresor: 20 }, c: { reforms: 1 } } }
      ] },
    { id: "espion", cond: s => s.flags.atWar && GAME.power(s) >= 2, title: "Un espion propose ses services", people: ["berthier"], scene: "camp",
      text: "Un Alsacien, contrebandier de son état, prétend avoir ses entrées dans l’état-major ennemi. Il réclame une forte somme en or contre l’ordre de bataille complet de l’adversaire.",
      choices: [
        { t: "Payer l’espion", res: "Les renseignements s’avèrent exacts : vous savez où frapper.", fx: { s: { tresor: -15, coalition: -5, moral: 4 } } },
        { t: "Le faire surveiller par la police", res: "C’était un agent double. Vous l’utilisez pour intoxiquer l’ennemi.", fx: { s: { coalition: -3 }, r: { fouche: 4 } } },
        { t: "Le congédier", res: "On n’achète pas la victoire.", fx: { s: { stress: -1 } } }
      ] },
    { id: "stael", cond: s => GAME.power(s) >= 2 && s.date < "1814-01-01", once: true, title: "Le salon de Madame de Staël", people: ["talleyrand"], scene: "paris",
      text: "Germaine de Staël, fille de Necker, tient le salon le plus brillant de Paris. On y raille votre « despotisme » et on y lit des pamphlets libéraux. Benjamin Constant, son ami, vient d’y prononcer un discours très remarqué contre vos projets.",
      choices: [
        { t: "L’éloigner de Paris", res: "Elle part pour Coppet, en Suisse, et y fait de son exil une tribune européenne.", fx: { s: { complot: -3, popularite: -2, coalition: 2 }, f: { staelExiled: true } } },
        { t: "La tolérer", res: "Les salons bruissent, mais la liberté de parole fait aussi votre réputation.", fx: { s: { complot: 3, popularite: 2 } } },
        { t: "La recevoir et chercher à la séduire intellectuellement", res: "Elle sort fascinée… et toujours aussi critique.", fx: { s: { stress: 3 }, r: { talleyrand: 2 } } }
      ] },
    { id: "chouans", cond: s => s.stats.popularite < 45 && GAME.power(s) >= 2, title: "Agitation dans l’Ouest", people: ["fouche"], scene: "camp",
      text: "Des bandes de chouans attaquent les diligences et les caisses publiques dans le Morbihan. Les préfets réclament des troupes. Les prêtres réfractaires prêchent dans les fermes isolées.",
      choices: [
        { t: "Envoyer une colonne et fusiller les chefs", res: "Les chemins redeviennent sûrs. Les rancunes, elles, demeurent.", fx: { s: { complot: -8, popularite: -3, armee: -3 } } },
        { t: "Négocier avec les chefs et offrir l’amnistie", res: "Plusieurs chefs déposent les armes.", fx: { s: { complot: -4, popularite: 3 } } },
        { t: "S’en remettre à la police de Fouché", res: "Infiltrations, primes, arrestations nocturnes.", fx: { s: { complot: -6, tresor: -8 }, r: { fouche: 5 } } }
      ] },
    { id: "simplon", cond: s => GAME.power(s) >= 2 && !s.flags.simplon, once: true, title: "La route du Simplon", people: [], scene: "italie",
      text: "Les ingénieurs des Ponts et Chaussées présentent le projet d’une route carrossable par le col du Simplon, reliant Genève à Milan : galeries percées dans le roc, ponts, refuges. Le chantier coûterait des millions, mais l’artillerie pourrait passer en toute saison.",
      choices: [
        { t: "Lancer les travaux", res: "Des milliers d’ouvriers s’attaquent à la montagne.", fx: { s: { tresor: -40, popularite: 3, coalition: 2 }, f: { simplon: true }, c: { reforms: 1 } } },
        { t: "Ajourner, la guerre passe avant", res: "Les plans retournent dans les cartons.", fx: { s: { tresor: 5 }, f: { simplon: true } } }
      ] },
    { id: "lettretsar", cond: s => GAME.relAlive(s, "alexandre") && GAME.power(s) >= 2, title: "Une lettre du tsar", people: ["alexandre"], scene: "palais",
      text: "Un courrier de Saint-Pétersbourg apporte une lettre personnelle d’Alexandre, cordiale dans la forme, inquiète sur le fond : il s’interroge sur vos intentions en Pologne et sur le sort de son beau-frère, le duc d’Oldenbourg.",
      choices: [
        { t: "Répondre chaleureusement et donner des garanties", res: "Le tsar paraît rassuré.", fx: { s: { coalition: -4 }, r: { alexandre: 10 } } },
        { t: "Répondre sèchement : la France n’a de comptes à rendre à personne", res: "La lettre circule dans les chancelleries.", fx: { s: { coalition: 6 }, r: { alexandre: -12 } } },
        { t: "Laisser Talleyrand rédiger la réponse", res: "Une prose habile… dont on ne sait trop au service de qui elle est.", fx: { s: { coalition: -2 }, r: { alexandre: 4, talleyrand: 4 } } }
      ] },
    { id: "mariel", cond: s => s.date >= "1813-01-01" && s.rank === "empereur", title: "Les « Marie-Louise »", people: ["marielouise"], scene: "camp",
      text: "Pour reconstituer l’armée, il faut appeler par anticipation des conscrits de dix-huit ans. Le peuple les appelle les « Marie-Louise », du nom de l’impératrice régente qui a signé le décret. Les mères pleurent dans les mairies.",
      choices: [
        { t: "Appeler les jeunes classes", res: "Des dizaines de milliers d’adolescents rejoignent les dépôts.", fx: { s: { armee: 60, popularite: -8, moral: -3 } } },
        { t: "Mobiliser plutôt la Garde nationale des villes", res: "Des bourgeois rechignant à servir loin de chez eux.", fx: { s: { armee: 30, popularite: -4, loyaute: -2 } } }
      ] },
    { id: "elbe", cond: s => s.rank === "elbe", title: "Le petit royaume", people: ["letizia"], scene: "mer",
      text: "Votre mère et votre sœur Pauline vous ont rejoint à Portoferraio. Vous dessinez des routes, réorganisez les mines de fer de Rio, créez une flottille de quatre navires. Les espions des Bourbons et des Anglais vous observent jour et nuit.",
      choices: [
        { t: "Moderniser l’île comme un petit empire", res: "Routes, hôpital, théâtre : l’île change de visage.", fx: { s: { stress: -6, tresor: -2 }, r: { letizia: 6 } } },
        { t: "Recevoir discrètement des émissaires venus de France", res: "On vous dit que l’armée regrette l’Empereur.", fx: { s: { stress: 4, popularite: 4 }, f: { elbaContacts: true } } }
      ] },
    { id: "longwood", cond: s => s.rank === "prisonnier", title: "Les jours de Longwood", people: [], scene: "prison",
      text: "Longwood House est humide, infestée de rats. Votre petite cour — Montholon, Bertrand, Gourgaud — se déchire en jalousies. Vous dictez, vous lisez, vous jouez aux échecs. Le médecin s’inquiète d’une douleur au côté droit.",
      choices: [
        { t: "Jardiner chaque matin avec vos domestiques", res: "Vous retournez la terre et faites planter des arbres.", fx: { s: { stress: -8, sante: 3, fatigue: -4 } } },
        { t: "Dicter jusqu’à épuisement vos campagnes", res: "Vos récits d’Italie et d’Égypte prennent forme.", fx: { s: { stress: 4, fatigue: 6, popularite: 4 } } },
        { t: "Refuser de sortir, en signe de protestation", res: "Vous ne quittez plus votre chambre.", fx: { s: { sante: -5, stress: 6 } } }
      ] },
    { id: "neipperg", cond: s => s.rank === "prisonnier" || s.rank === "elbe", once: true, title: "Nouvelles de Vienne", people: ["marielouise"], scene: "prison",
      text: "Un voyageur vous rapporte ce que toute l’Europe sait déjà : Marie-Louise vit à Parme avec le général autrichien Neipperg, que Metternich avait placé auprès d’elle. Votre fils grandit à Vienne sous le nom de duc de Reichstadt et n’apprend plus le français.",
      choices: [
        { t: "Lui écrire malgré tout, pour l’enfant", res: "La lettre part. Vous ne saurez jamais si elle a été lue.", fx: { s: { stress: 6 }, r: { marielouise: 4 } } },
        { t: "Ne plus jamais prononcer son nom", res: "Vous gardez son portrait, mais vous vous taisez.", fx: { s: { stress: 10, sante: -2 }, r: { marielouise: -20 } } }
      ] },
    { id: "gourgaud", cond: s => s.rank === "prisonnier", once: true, title: "La petite cour se déchire", people: [], scene: "prison",
      text: "Le général Gourgaud, jaloux de la faveur dont jouit Montholon, le provoque en duel. Bertrand tente de calmer le jeu. Dans une maison de vingt pièces battue par les alizés, chaque querelle prend des proportions démesurées.",
      choices: [
        { t: "Prendre le parti de Montholon", res: "Gourgaud demande à quitter l’île ; il sera rapatrié en 1818.", fx: { s: { stress: 4 } } },
        { t: "Réconcilier tout le monde à votre table", res: "Un dîner glacial, une paix fragile.", fx: { s: { stress: -3, fatigue: 3 } } }
      ] },
    { id: "medecin_he", cond: s => s.rank === "prisonnier" && s.stats.sante < 70, title: "Le médecin de Longwood", people: [], scene: "prison",
      text: "Le chirurgien irlandais O’Meara diagnostique une hépatite due au climat et réclame votre transfert hors de l’île. Le gouverneur l’accuse de faire de la politique et menace de le renvoyer en Angleterre.",
      choices: [
        { t: "Soutenir O’Meara contre le gouverneur", res: "O’Meara est renvoyé ; vous voilà sans médecin pendant des mois.", fx: { s: { stress: 8, sante: -3 } } },
        { t: "Accepter un médecin choisi par les Anglais", res: "Vous refusez de le voir plus d’une fois sur deux.", fx: { s: { sante: 3, stress: 4 } } }
      ] },
    { id: "amerique", cond: s => s.rank === "exilam", title: "Le Nouveau Monde", people: [], scene: "mer",
      text: "Des réfugiés bonapartistes vous rendent visite et rêvent d’un « Champ d’Asile » au Texas, ou d’une expédition pour délivrer l’Amérique espagnole. Le président Monroe vous fait savoir qu’il ne tolérera aucune aventure militaire.",
      choices: [
        { t: "Vivre en gentleman-farmer et écrire", res: "Vos mémoires paraissent à Philadelphie.", fx: { s: { stress: -8, popularite: 4 } } },
        { t: "Soutenir en secret les insurgés d’Amérique du Sud", res: "Des émissaires partent pour Buenos Aires.", fx: { s: { stress: 6, complot: 6 }, danger: { p: .01, type: "assassinat", cause: "Assassiné par un agent espagnol à Philadelphie." } } }
      ] }
  ],

  /* ---------------- Actions de gestion, disponibles à tout moment ---------------- */
  actions: [
    { id: "conscription", label: "Lever une conscription", desc: "+ armée, − popularité", cd: 6, cond: s => GAME.power(s) >= 2, fx: { s: { armee: 60, popularite: -6, tresor: -15 } } },
    { id: "volontaires", label: "Recruter des volontaires", desc: "+ armée, − trésor", cd: 4, cond: s => GAME.power(s) === 1, fx: { s: { armee: 6, tresor: -3, popularite: -1 } } },
    { id: "requisitions", label: "Lever des contributions", desc: "+ trésor, − popularité", cd: 4, cond: s => GAME.power(s) === 1, fx: { s: { tresor: 12, popularite: -3, coalition: 2 } } },
    { id: "impot", label: "Lever les droits réunis", desc: "Taxe sur l’alcool, le tabac, le sel", cd: 6, cond: s => GAME.power(s) >= 2, fx: { s: { tresor: 70, popularite: -6 } } },
    { id: "harangue", label: "Passer les troupes en revue", desc: "+ moral, + fatigue", cd: 3, cond: s => GAME.power(s) >= 1 && s.stats.armee > 5, fx: { s: { moral: 8, fatigue: 5 } } },
    { id: "dotations", label: "Doter les maréchaux", desc: "Titres, terres, rentes", cd: 6, cond: s => GAME.power(s) >= 2, fx: { s: { tresor: -45, loyaute: 10 }, r: { ney: 4, davout: 4, berthier: 4, murat: 4 } } },
    { id: "police", label: "Renforcer la police", desc: "− complot, − popularité", cd: 4, cond: s => GAME.power(s) >= 2, fx: { s: { tresor: -15, complot: -12, popularite: -2 }, r: { fouche: 4 } } },
    { id: "propagande", label: "Fêtes et bulletins", desc: "Te Deum, bulletins de l’armée", cd: 4, cond: s => GAME.power(s) >= 2, fx: { s: { tresor: -20, popularite: 6 } } },
    { id: "diplomatie", label: "Mission diplomatique", desc: "− menace des coalitions", cd: 6, cond: s => GAME.power(s) >= 2, fx: { s: { coalition: -8, tresor: -10 }, r: { talleyrand: 3, metternich: 3 } } },
    { id: "repos", label: "Prendre du repos", desc: "− fatigue, − stress", cd: 3, cond: s => !s.flags.inRussia && GAME.power(s) >= 1, fx: { s: { fatigue: -18, stress: -10, sante: 2 } } },
    { id: "medecin", label: "Consulter son médecin", desc: "+ santé", cd: 6, cond: s => true, fx: { s: { sante: 6, tresor: -1 } } },
    { id: "famille", label: "Passer du temps en famille", desc: "− stress, + relation conjoint", cd: 3, cond: s => !!(s.family.spouse || s.family.spouseName) || s.family.children.length > 0, fx: { s: { stress: -8 }, spouseRel: 6 } },
    { id: "memoires", label: "Dicter ses mémoires", desc: "Forger sa légende", cd: 4, cond: s => GAME.power(s) === 0, fx: { s: { popularite: 3, stress: -4, fatigue: 3 } } },
    { id: "jardin", label: "Jardiner et marcher", desc: "+ santé, − stress", cd: 3, cond: s => GAME.power(s) === 0, fx: { s: { sante: 3, stress: -6 } } }
  ],

  /* ---------------- Simulation mensuelle propre au personnage ---------------- */
  tick(s, h){
    const st = s.stats, f = s.flags, r = this.ranks[s.rank] || { income: 0 };
    const age = h.age;
    const out = [];
    // Finances
    const income = st.departements * .55 * (.7 + st.popularite / 200) * r.income + (GAME.power(s) === 1 ? 2 : 0);
    let upkeep = st.armee * (GAME.power(s) >= 2 ? .085 : .02) + (f.atWar ? st.armee * .035 : 0);
    if (GAME.power(s) === 0) upkeep = 0;
    h.add("tresor", income - upkeep);
    if (st.tresor < 0) { h.add("popularite", -1.2); h.add("loyaute", -1); h.add("moral", -1.5); }
    // Armée
    h.add("armee", -st.armee * .004);
    if (f.spainWar) { h.add("armee", -4); h.add("moral", -.4); h.add("popularite", -.15); }
    if (f.inRussia) { const winter = [10, 11, 0, 1, 2].includes(h.month); h.add("armee", -st.armee * (winter ? .12 : .05)); h.add("moral", winter ? -4 : -1.5); h.add("fatigue", 3); if (Math.random() < .03) h.condition("typhus", "Typhus", 2.5); }
    h.drift("moral", 58, .05);
    // Politique
    h.drift("popularite", 50, .018);
    h.drift("loyaute", 55, .02);
    if (f.atWar && GAME.power(s) >= 2) { h.add("popularite", -.25); h.add("coalition", st.departements > 115 ? .5 : .15); } else h.drift("coalition", 30, .03);
    if (GAME.power(s) >= 2) {
      let c = (50 - st.popularite) * .02 + (50 - st.loyaute) * .02 - .25;
      if (s.rank === "empereur" && !GAME.hasHeir(s)) c += .35;
      for (const rel of this.relations) if (rel.plotter && GAME.relAlive(s, rel.id)) c += Math.max(0, -s.rel[rel.id]) / 220;
      h.add("complot", c);
    } else h.drift("complot", 5, .05);
    // Corps
    h.add("fatigue", f.atWar && GAME.power(s) >= 1 ? 1.2 : -2.5);
    h.add("stress", (st.coalition + st.complot) / 110 - 1.6 + (st.tresor < 0 ? .8 : 0));
    let dS = 0;
    if (st.fatigue > 70) dS -= .8; if (st.stress > 70) dS -= .8;
    if (age > 40) dS -= (age - 40) * .035;
    if (st.fatigue < 45 && st.stress < 55) dS += .7;
    h.add("sante", dS);
    if (f.stHelena) { h.add("sante", -.5); h.add("stress", .6); }
    // Maladies : son père Charles est mort d’un cancer de l’estomac en 1785
    if (age >= 44 && !h.hasCondition("cancer") && Math.random() < .0016 * (1 + st.stress / 40) * (f.stHelena ? 4 : 1)) { h.condition("cancer", "Ulcère, puis cancer de l’estomac", .9); out.push({ t: "Douleurs violentes au côté droit. Le médecin parle d’une affection de l’estomac, comme celle qui emporta votre père.", tone: "bad" }); }
    if (st.stress > 80 && !h.hasCondition("ulcere") && Math.random() < .02) h.condition("ulcere", "Troubles digestifs chroniques", .4);
    if (age > 38 && !h.hasCondition("vessie") && Math.random() < .004) h.condition("vessie", "Dysurie (troubles urinaires)", .06);
    return out;
  },
  plotHazard: s => GAME.power(s) >= 2 ? Math.pow(s.stats.complot / 100, 3) * .028 : Math.pow(s.stats.complot / 100, 3) * .006,
  plotCause: s => s.rank === "empereur" ? "Assassiné lors d’une conjuration de palais." : "Assassiné par des conjurés royalistes.",

  /* ---------------- Titres de légende ---------------- */
  legends: [
    { title: "Le Vainqueur de Waterloo", cond: (s, c) => s.flags.waterlooWon, text: "Tu as gagné la bataille que l’Histoire t’avait refusée." },
    { title: "Le Conquérant", cond: (s, c) => c.battlesWon >= 10 && c.maxDep >= 125, text: "Ton nom résonne de Madrid à Moscou. L’Europe a tremblé." },
    { title: "Le Bâtisseur", cond: (s, c) => c.reforms >= 4 && c.avgPop >= 55, text: "Codes, lycées, routes et préfets : tu as construit un État qui te survit." },
    { title: "Le Pacificateur", cond: (s, c) => c.treaties >= 4 && s.stats.coalition < 40 && GAME.power(s) >= 2, text: "Tu as su t’arrêter. L’Europe a fini par traiter avec toi." },
    { title: "Le Prisonnier de l’Atlantique", cond: (s, c) => s.flags.stHelena, text: "Vaincu, tu as gagné la bataille de la mémoire depuis ton rocher." },
    { title: "L’Empereur de toujours", cond: (s, c) => s.rank === "empereur" && GAME.age(s) >= 60, text: "Tu es mort sur le trône, vieil homme, ta dynastie installée." },
    { title: "Le Météore", cond: (s, c) => GAME.age(s) < 35 && c.battlesWon >= 3, text: "Une ascension fulgurante, fauchée trop tôt." },
    { title: "L’Oublié", cond: (s, c) => !s.flags.consul, text: "Un général brillant parmi d’autres. Les manuels t’ont à peine retenu." },
    { title: "L’Aigle déchu", cond: (s, c) => true, text: "Le génie et la démesure, la gloire et la chute." }
  ],

  aiBrief: "Napoléon Bonaparte (1769-1821), de général de la Révolution à Empereur des Français. Ton : simulateur historique sérieux, précis, sans anachronisme, dans la langue d’un récit historique moderne.",
  aiRules: [
    "Ne mets jamais dans la bouche d’un personnage une phrase présentée comme une citation historique réelle si elle n’est pas attestée ; les paroles inventées doivent être paraphrasées, sans guillemets.",
    "Reste neutre : pas de jugement moral, des conséquences réalistes et défendables."
  ]
};

/* Personnages prévus aux étapes suivantes : ajouter leur objet complet dans CHARACTERS suffira à les rendre jouables. */
const ROSTER = [
  { id: "napoleon" },
  { id: "trump", name: "Donald Trump", role: "Homme d’affaires, président des États-Unis", art: "linear-gradient(160deg,#20304f,#0c1220)", c1: "#3b5b94", c2: "#121b30", letter: "DT" },
  { id: "ronaldo", name: "Cristiano Ronaldo", role: "Footballeur", art: "linear-gradient(160deg,#1f4b2c,#0b1a10)", c1: "#3f8a4f", c2: "#10261a", letter: "CR" },
  { id: "mrbeast", name: "MrBeast", role: "Créateur YouTube, entrepreneur", art: "linear-gradient(160deg,#3c2160,#120a20)", c1: "#7b44c4", c2: "#1d1033", letter: "MB" },
  { id: "moise", name: "Moïse", role: "Prophète, selon le récit biblique", art: "linear-gradient(160deg,#6b4a22,#20150a)", c1: "#b98a4a", c2: "#3a2610", letter: "M" }
];
</script>
