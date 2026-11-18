<script>
"use strict";
/* =====================================================================
   DONALD TRUMP — personne réelle et vivante, personnage politique.
   Uniquement des faits publics, présentés de façon neutre ; aucune citation
   inventée ; conséquences réalistes et défendables, sans jugement.
   ===================================================================== */
(function(){
const P = s => GAME.power(s);
const sg = (v, d = 1) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(d).replace(".", ",")}`;
const MD = v => `${(Math.round(v * 10) / 10).toString().replace(".", ",")} Md $`;
const once = (s, id) => s.wk[id] === s.week ? "Déjà fait cette semaine" : false;

/* États : nom, grands électeurs (recensements 2010 et 2020), tendance approximative (points, positif = républicain), case de la carte */
const ST = { AK: ["Alaska", 3, 3, 12, 0, 0], ME: ["Maine", 4, 4, -7, 10, 0], VT: ["Vermont", 3, 3, -32, 9, 1], NH: ["New Hampshire", 4, 4, -5, 10, 1], WI: ["Wisconsin", 10, 10, 0, 5, 1],
  WA: ["Washington", 12, 12, -18, 0, 2], ID: ["Idaho", 4, 4, 32, 1, 2], MT: ["Montana", 3, 4, 18, 2, 2], ND: ["Dakota du Nord", 3, 3, 34, 3, 2], MN: ["Minnesota", 10, 10, -5, 4, 2], IL: ["Illinois", 20, 19, -17, 5, 2], MI: ["Michigan", 16, 15, -1, 6, 2], NY: ["New York", 29, 28, -22, 8, 2], MA: ["Massachusetts", 11, 11, -32, 9, 2],
  OR: ["Oregon", 7, 8, -14, 0, 3], NV: ["Nevada", 6, 6, -2, 1, 3], WY: ["Wyoming", 3, 3, 45, 2, 3], SD: ["Dakota du Sud", 3, 3, 28, 3, 3], IA: ["Iowa", 6, 6, 8, 4, 3], IN: ["Indiana", 11, 11, 17, 5, 3], OH: ["Ohio", 18, 17, 8, 6, 3], PA: ["Pennsylvanie", 20, 19, 0, 7, 3], NJ: ["New Jersey", 14, 14, -14, 8, 3], CT: ["Connecticut", 7, 7, -18, 9, 3], RI: ["Rhode Island", 4, 4, -18, 10, 3],
  CA: ["Californie", 55, 54, -29, 0, 4], UT: ["Utah", 6, 6, 20, 1, 4], CO: ["Colorado", 9, 10, -10, 2, 4], NE: ["Nebraska", 5, 5, 20, 3, 4], MO: ["Missouri", 10, 10, 17, 4, 4], KY: ["Kentucky", 8, 8, 27, 5, 4], WV: ["Virginie-Occidentale", 5, 4, 40, 6, 4], VA: ["Virginie", 13, 13, -8, 7, 4], MD: ["Maryland", 10, 10, -30, 8, 4], DE: ["Delaware", 3, 3, -17, 9, 4],
  AZ: ["Arizona", 11, 11, 1, 1, 5], NM: ["Nouveau-Mexique", 5, 5, -9, 2, 5], KS: ["Kansas", 6, 6, 17, 3, 5], AR: ["Arkansas", 6, 6, 27, 4, 5], TN: ["Tennessee", 11, 11, 24, 5, 5], NC: ["Caroline du Nord", 15, 16, 2, 6, 5], SC: ["Caroline du Sud", 9, 9, 12, 7, 5], DC: ["District de Columbia", 3, 3, -85, 8, 5],
  OK: ["Oklahoma", 7, 7, 34, 3, 6], LA: ["Louisiane", 8, 8, 19, 4, 6], MS: ["Mississippi", 6, 6, 17, 5, 6], AL: ["Alabama", 9, 9, 26, 6, 6], GA: ["Géorgie", 16, 16, 1, 7, 6], HI: ["Hawaï", 4, 4, -30, 0, 7], TX: ["Texas", 38, 40, 7, 3, 7], FL: ["Floride", 29, 30, 4, 8, 7] };
const SWING = ["PA", "WI", "MI", "GA", "AZ", "NV", "NC", "FL", "OH", "MN", "NH", "IA"];
const tile = (c, r) => { const x = 160 + c * 62, y = 60 + r * 62; return `${x},${y} ${x + 56},${y} ${x + 56},${y + 56} ${x},${y + 56}`; };

const T = CHARACTERS.trump = {
  id: "trump", name: "Donald Trump", short: "Trump", role: "Homme d’affaires, 45e et 47e président des États-Unis", theme: "theme-maison",
  art: "linear-gradient(160deg,#20304f,#0c1220)", born: "1946-06-14", birthplace: "New York", unit: { label: "semaine", days: 7 },
  portrait: s => ART.statesman({ age: s ? GAME.age(s) : 69 }),
  realStatus: { title: "Son parcours réel (à la mi-2026)", text: "Élu président en 2016 face à Hillary Clinton, battu en 2020 par Joe Biden, mis en accusation deux fois par la Chambre et acquitté deux fois par le Sénat, réélu en 2024 face à Kamala Harris. Il est le deuxième président de l’histoire américaine à exercer deux mandats non consécutifs." },
  realTimeline: "Promoteur immobilier et animateur de télévision à New York, candidat républicain en 2015, président de 2017 à 2021, puis de nouveau depuis janvier 2025.",
  histLabel: "Moment réel", accidentCause: "Mort dans un accident.", suddenCause: "Mort subitement d’un arrêt cardiaque", mortality: .25,
  groups: { pouvoir: "Pouvoir", vie: "Santé" },
  stats: [
    { id: "approbation", label: "Popularité", group: "pouvoir", min: 0, max: 100, bad: "low", aiMax: 5, hint: "Part des Américains qui approuvent son action" },
    { id: "base", label: "Soutien de la base", group: "pouvoir", min: 0, max: 100, bad: "low", aiMax: 8, hint: "Fidélité des électeurs républicains" },
    { id: "congres", label: "Soutien au Congrès", group: "pouvoir", min: 0, max: 100, bad: "low", aiMax: 8, hint: "Capacité à faire voter ses textes" },
    { id: "economie", label: "Économie", group: "pouvoir", min: 0, max: 100, bad: "low", aiMax: 6, hint: "Croissance, emploi, prix" },
    { id: "bourse", label: "Bourse", group: "pouvoir", min: 500, max: 20000, barMax: 9000, fmt: v => `${Math.round(v).toLocaleString("fr-FR")} pts`, bad: "low", warn: -1, danger: -1, aiMax: 200, hint: "Grand indice boursier américain" },
    { id: "international", label: "Relations internationales", group: "pouvoir", min: 0, max: 100, bad: "low", aiMax: 8, hint: "Crédit auprès des alliés et des rivaux" },
    { id: "medias", label: "Hostilité des médias", group: "pouvoir", min: 0, max: 100, bad: "high", aiMax: 10, hint: "Ton de la couverture nationale" },
    { id: "justice", label: "Pression judiciaire", group: "pouvoir", min: 0, max: 100, bad: "high", aiMax: 10, hint: "Enquêtes, procès et recours en cours" },
    { id: "fortune", label: "Fortune", group: "pouvoir", min: 0, max: 50, barMax: 10, fmt: MD, bad: "low", warn: 1, danger: .2, aiMax: .4, hint: "Patrimoine estimé, en milliards de dollars" },
    { id: "sante", label: "Santé", group: "vie", min: 0, max: 100, bad: "low", aiMax: 6 }, { id: "fatigue", label: "Fatigue", group: "vie", min: 0, max: 100, bad: "high", aiMax: 12 }, { id: "stress", label: "Stress", group: "vie", min: 0, max: 100, bad: "high", aiMax: 12 }
  ],
  ranks: { candidat: { label: "Candidat à l’élection présidentielle", power: 1 }, elu: { label: "Président élu", power: 1 }, president: { label: "Président des États-Unis", power: 3 }, ancien: { label: "Ancien président", power: 1 }, prive: { label: "Homme d’affaires", power: 0 } },
  statusLabel: s => s.rank === "president" ? `Mandat ${s.terms}` : s.running ? "En campagne" : "Hors du pouvoir",

  relations: [
    { id: "melania", name: "Melania Trump", role: "Épouse", bio: "Mariée à Donald Trump depuis 2005, première dame de 2017 à 2021 et depuis 2025.", from: "2005-01-22", start: 70 },
    { id: "ivanka", name: "Ivanka Trump", role: "Fille, conseillère à la Maison-Blanche (2017-2021)", bio: "Fille aînée, dirigeante de la Trump Organization puis conseillère de son père.", from: "1981-10-30", start: 80 },
    { id: "donjr", name: "Donald Trump Jr.", role: "Fils", bio: "Fils aîné, dirigeant de la Trump Organization, très actif dans les campagnes.", from: "1977-12-31", start: 75 },
    { id: "kushner", name: "Jared Kushner", role: "Gendre, conseiller (2017-2021)", bio: "Époux d’Ivanka, chargé notamment du dossier du Proche-Orient.", from: "2009-10-25", start: 70 },
    { id: "pence", name: "Mike Pence", role: "Vice-président (2017-2021)", bio: "Ancien gouverneur de l’Indiana, colistier en 2016.", from: "2016-07-15", start: 65 },
    { id: "vance", name: "JD Vance", role: "Vice-président depuis 2025", bio: "Sénateur de l’Ohio, colistier en 2024.", from: "2022-01-01", start: 60 },
    { id: "bannon", name: "Steve Bannon", role: "Stratège de campagne, conseiller en 2017", bio: "Directeur de la campagne de 2016, figure du courant nationaliste.", from: "2016-08-17", start: 55 },
    { id: "mcconnell", name: "Mitch McConnell", role: "Chef des républicains du Sénat (2007-2025)", bio: "Sénateur du Kentucky, maître de la procédure parlementaire.", from: "2015-01-01", start: 30 },
    { id: "ryan", name: "Paul Ryan", role: "Président de la Chambre (2015-2019)", bio: "Républicain du Wisconsin, spécialiste du budget.", from: "2015-10-29", start: 20 },
    { id: "johnson", name: "Mike Johnson", role: "Président de la Chambre depuis 2023", bio: "Républicain de Louisiane.", from: "2023-10-25", start: 60 },
    { id: "pelosi", name: "Nancy Pelosi", role: "Cheffe des démocrates de la Chambre", bio: "Démocrate de Californie, présidente de la Chambre de 2019 à 2023.", from: "2015-01-01", start: -50 },
    { id: "schumer", name: "Chuck Schumer", role: "Chef des démocrates du Sénat", bio: "Sénateur de New York.", from: "2015-01-01", start: -40 },
    { id: "clinton", name: "Hillary Clinton", role: "Candidate démocrate en 2016", bio: "Ancienne secrétaire d’État.", from: "2015-04-12", start: -60 },
    { id: "obama", name: "Barack Obama", role: "44e président", bio: "Président de 2009 à 2017.", from: "2015-01-01", start: -45 },
    { id: "biden", name: "Joe Biden", role: "46e président", bio: "Vice-président de 2009 à 2017, président de 2021 à 2025.", from: "2015-01-01", start: -45 },
    { id: "harris", name: "Kamala Harris", role: "Vice-présidente (2021-2025), candidate en 2024", bio: "Ancienne sénatrice de Californie.", from: "2019-01-21", start: -50 },
    { id: "musk", name: "Elon Musk", role: "Entrepreneur", bio: "Dirigeant de Tesla et de SpaceX, propriétaire du réseau X depuis 2022.", from: "2016-12-14", start: 10 },
    { id: "xi", name: "Xi Jinping", role: "Président de la Chine", bio: "Dirigeant chinois depuis 2012.", from: "2015-01-01", start: -10 },
    { id: "poutine", name: "Vladimir Poutine", role: "Président de la Russie", bio: "Au pouvoir depuis 2000.", from: "2015-01-01", start: 5 },
    { id: "kim", name: "Kim Jong-un", role: "Dirigeant de la Corée du Nord", bio: "Au pouvoir depuis 2011.", from: "2015-01-01", start: -40 },
    { id: "macron", name: "Emmanuel Macron", role: "Président de la France", bio: "Élu en 2017.", from: "2017-05-14", start: 15 },
    { id: "merkel", name: "Angela Merkel", role: "Chancelière d’Allemagne (2005-2021)", bio: "Cheffe du gouvernement allemand.", from: "2015-01-01", start: -10 },
    { id: "netanyahou", name: "Benyamin Netanyahou", role: "Premier ministre d’Israël", bio: "Chef du gouvernement israélien pendant l’essentiel de la période.", from: "2015-01-01", start: 45 },
    { id: "zelensky", name: "Volodymyr Zelensky", role: "Président de l’Ukraine", bio: "Élu en 2019.", from: "2019-05-20", start: 0 }
  ],

  starts: [
    { id: "2015", date: "2015-06-16", year: "2015", title: "L’escalator de la Trump Tower", summary: "69 ans. Vous annoncez votre candidature à l’investiture républicaine. Seize autres candidats sont en lice ; les sondages vous créditent de quelques points.",
      rank: "candidat", scene: "tribune", place: "Trump Tower, New York", terms: 0, running: 2016, house: "R", senate: "R",
      stats: { approbation: 34, base: 40, congres: 20, economie: 58, bourse: 2100, international: 50, medias: 55, justice: 5, fortune: 3.7, sante: 80, fatigue: 25, stress: 35 } },
    { id: "2017", date: "2017-01-20", year: "2017", title: "L’investiture", summary: "70 ans. Vous prêtez serment comme 45e président. Les républicains tiennent la Chambre et le Sénat ; le pays est profondément divisé.",
      rank: "president", scene: "bureau", place: "Maison-Blanche, Washington", terms: 1, running: 0, house: "R", senate: "R",
      stats: { approbation: 44, base: 86, congres: 62, economie: 60, bourse: 2270, international: 48, medias: 68, justice: 12, fortune: 3.5, sante: 78, fatigue: 30, stress: 45 }, rel: { pence: 75, ryan: 35, mcconnell: 45 } },
    { id: "2025", date: "2025-01-20", year: "2025", title: "Le retour", summary: "78 ans. Vous prêtez serment comme 47e président, quatre ans après avoir quitté la Maison-Blanche. Les républicains contrôlent les deux chambres.",
      rank: "president", scene: "bureau", place: "Maison-Blanche, Washington", terms: 2, running: 0, house: "R", senate: "R",
      stats: { approbation: 47, base: 90, congres: 66, economie: 58, bourse: 6000, international: 45, medias: 62, justice: 30, fortune: 5.5, sante: 70, fatigue: 32, stress: 45 }, rel: { vance: 75, johnson: 70, musk: 70, mcconnell: 5, pence: -40 } }
  ],

  eraNotes: {
    2015: "Primaires républicaines à dix-sept candidats. Obama président. Accord de Paris sur le climat et accord sur le nucléaire iranien.", 2016: "Investiture républicaine en juillet, Mike Pence colistier. Élection du 8 novembre gagnée au collège électoral face à Hillary Clinton.",
    2017: "Investiture. Décret sur les entrées aux États-Unis contesté en justice. Neil Gorsuch à la Cour suprême. Renvoi du directeur du FBI, nomination du procureur spécial Mueller. Retrait annoncé de l’accord de Paris. Baisse d’impôts votée en décembre.",
    2018: "Droits de douane sur l’acier, l’aluminium et les produits chinois. Sommet de Singapour avec Kim Jong-un. Brett Kavanaugh à la Cour suprême. Les démocrates reprennent la Chambre aux élections de mi-mandat. Fermeture partielle du gouvernement.",
    2019: "Fin de la plus longue fermeture du gouvernement à cette date. Rapport Mueller. Première mise en accusation par la Chambre en décembre.", 2020: "Acquittement au Sénat. Pandémie de Covid-19. Accords d’Abraham. Amy Coney Barrett à la Cour suprême. Élection du 3 novembre perdue face à Joe Biden.",
    2021: "Assaut du Capitole le 6 janvier. Seconde mise en accusation, second acquittement. Comptes suspendus sur les grands réseaux. Départ pour la Floride.", 2022: "Lancement de Truth Social. Perquisition du FBI à Mar-a-Lago. Annonce d’une nouvelle candidature le 15 novembre.",
    2023: "Quatre inculpations pénales, à New York, en Floride, à Washington et en Géorgie. Large avance dans les primaires républicaines.", 2024: "Verdict de culpabilité à New York en mai. Tentative d’assassinat à Butler en juillet. JD Vance colistier. Retrait de Joe Biden, remplacé par Kamala Harris. Élection du 5 novembre gagnée.",
    2025: "Seconde investiture. Vague de décrets, nombreux recours. Droits de douane généralisés annoncés le 2 avril. Frappes sur des sites nucléaires iraniens en juin. Grande loi budgétaire signée le 4 juillet. Longue fermeture du gouvernement à l’automne.", 2026: "Élections de mi-mandat en novembre. Coupe du monde de football et 250e anniversaire de l’indépendance."
  },

  events: [
    { id: "colistier2016", date: "2016-07-12", until: "2016-07-25", cond: s => s.running === 2016, title: "Choisir un colistier", place: "Indianapolis", scene: "tribune", people: ["pence", "ivanka"],
      text: "La convention de Cleveland s’ouvre dans quelques jours. Votre entourage a retenu trois noms : le gouverneur de l’Indiana Mike Pence, proche des conservateurs religieux ; l’ancien président de la Chambre Newt Gingrich ; le gouverneur du New Jersey Chris Christie.",
      real: "Il annonce le choix de Mike Pence le 15 juillet 2016. Le ticket rassure une partie de l’électorat évangélique.",
      choices: [{ t: "Mike Pence", hist: true, res: "Le ticket Trump-Pence est investi à Cleveland.", fx: { s: { base: 6, congres: 5 }, r: { pence: 15 }, f: { vp: "pence" } } }, { t: "Newt Gingrich", res: "Un vétéran de Washington à vos côtés.", fx: { s: { base: 3, medias: 3, congres: 2 }, f: { vp: "gingrich" } } }, { t: "Chris Christie", res: "Un allié de la première heure.", fx: { s: { base: -2, approbation: 1 }, f: { vp: "christie" } } }] },
    { id: "voyage2017", date: "2017-01-27", until: "2017-02-20", cond: s => s.rank === "president" && s.terms === 1, title: "Le décret sur les entrées", place: "Bureau ovale", scene: "bureau", people: ["bannon"],
      text: "Vos conseillers ont rédigé un décret qui suspend l’entrée aux États-Unis des ressortissants de sept pays à majorité musulmane, au nom de la sécurité nationale. Les juristes de l’administration n’ont pas tous été consultés ; les compagnies aériennes non plus.",
      real: "Le décret est signé le 27 janvier 2017. Des juges fédéraux le suspendent en quelques jours. Après deux réécritures, la Cour suprême valide la troisième version en juin 2018.",
      choices: [{ t: "Signer le décret tel quel, avec effet immédiat", hist: true, res: "Confusion dans les aéroports, manifestations, premiers recours.", fx: { s: { base: 5, approbation: -2, medias: 6, justice: 6, international: -4 } } }, { t: "Signer une version limitée, revue par les juristes", res: "Le texte tient mieux devant les tribunaux.", fx: { s: { base: 2, justice: 2, medias: 2 } } }, { t: "Renoncer et renforcer les contrôles par voie administrative", res: "La promesse de campagne attendra.", fx: { s: { base: -5, approbation: 1 } } }] },
    { id: "comey2017", date: "2017-05-09", until: "2017-05-30", cond: s => s.rank === "president" && s.terms === 1, title: "Le directeur du FBI", place: "Bureau ovale", scene: "bureau", people: ["kushner"],
      text: "Le FBI enquête sur les ingérences russes dans la campagne de 2016. Son directeur, James Comey, nommé sous Obama, a été critiqué par les deux partis. Le ministère de la Justice vous transmet une note qui recommande son remplacement.",
      real: "James Comey est renvoyé le 9 mai 2017. Huit jours plus tard, le ministère de la Justice nomme Robert Mueller procureur spécial. Son rapport, rendu en 2019, n’établit pas d’entente avec la Russie et ne conclut pas sur l’entrave.",
      choices: [{ t: "Renvoyer le directeur du FBI", hist: true, res: "Un procureur spécial est nommé la semaine suivante.", fx: { s: { justice: 18, medias: 8, base: 2, congres: -4 } } }, { t: "Le maintenir jusqu’à la fin de l’enquête", res: "L’enquête suit son cours, sans procureur spécial.", fx: { s: { justice: 6, base: -2, medias: -2 } } }] },
    { id: "paris2017", date: "2017-06-01", until: "2017-06-25", cond: s => s.rank === "president" && s.terms === 1, title: "L’accord de Paris", place: "Roseraie de la Maison-Blanche", scene: "bureau", people: ["ivanka", "bannon", "macron"],
      text: "L’accord de Paris sur le climat, signé en 2015, n’impose aucun objectif contraignant. Votre administration est divisée : une partie veut en sortir pour tenir une promesse de campagne, une autre plaide pour y rester en révisant les engagements américains.",
      real: "Il annonce le retrait le 1er juin 2017. Les États-Unis réintègrent l’accord en 2021 sous Joe Biden, puis s’en retirent de nouveau en janvier 2025.",
      choices: [{ t: "Annoncer le retrait", hist: true, res: "Les alliés européens regrettent ; l’industrie du charbon applaudit.", fx: { s: { base: 5, international: -8, medias: 4 }, pays: { europe: { rel: -10 } } } }, { t: "Rester en révisant les engagements à la baisse", res: "Un compromis qui ne satisfait personne tout à fait.", fx: { s: { base: -3, international: 3 } } }] },
    { id: "impots2017", date: "2017-12-20", until: "2018-01-10", cond: s => s.rank === "president" && s.terms === 1 && s.senate === "R", title: "La baisse d’impôts", place: "Capitole", scene: "bureau", people: ["ryan", "mcconnell"],
      text: "Le Congrès vient d’adopter, sans une voix démocrate, une réforme fiscale qui ramène l’impôt sur les sociétés de 35 à 21 % et allège temporairement l’impôt des ménages. Le Bureau du budget du Congrès estime son coût à environ 1 500 milliards de dollars sur dix ans.",
      real: "Il promulgue la loi le 22 décembre 2017 : c’est la principale réussite législative de son premier mandat.",
      choices: [{ t: "Promulguer la loi", hist: true, res: "Les marchés saluent, le déficit se creuse.", fx: { s: { economie: 4, bourse: 120, base: 4, congres: 5 }, f: { taxcut: true } } }, { t: "Exiger davantage pour les classes moyennes avant de signer", res: "Les négociations reprennent ; les marchés s’impatientent.", fx: { s: { approbation: 2, congres: -6, bourse: -60 } } }] },
    { id: "singapour2018", date: "2018-06-12", until: "2018-07-01", cond: s => s.rank === "president", title: "Le sommet de Singapour", place: "Île de Sentosa, Singapour", scene: "tribune", people: ["kim"],
      text: "Après une année d’essais de missiles et d’invectives, Kim Jong-un propose une rencontre. Aucun président américain en exercice n’a jamais rencontré un dirigeant nord-coréen. Vos diplomates redoutent une image sans contrepartie vérifiable.",
      real: "Le sommet a lieu le 12 juin 2018. La déclaration commune évoque la dénucléarisation sans calendrier. Deux autres rencontres suivent, à Hanoï et dans la zone démilitarisée, sans accord.",
      choices: [{ t: "Rencontrer Kim Jong-un", hist: true, res: "La poignée de main fait le tour du monde.", fx: { s: { approbation: 2, international: 3 }, r: { kim: 40 }, pays: { coree: { rel: 30 } } } }, { t: "Exiger des gestes vérifiables avant toute rencontre", res: "Pyongyang reprend ses essais.", fx: { s: { international: 1 }, r: { kim: -10 }, pays: { coree: { rel: -10 } } } }] },
    { id: "shutdown2018", date: "2018-12-21", until: "2019-01-10", cond: s => s.rank === "president" && s.terms === 1, title: "Le mur et le budget", place: "Bureau ovale", scene: "bureau", people: ["pelosi", "schumer", "mcconnell"],
      text: "Le budget provisoire expire ce soir. Vous réclamez 5,7 milliards de dollars pour la barrière à la frontière sud ; les démocrates, qui prennent la Chambre en janvier, refusent. Sans accord, un quart de l’administration fédérale cessera d’être financé.",
      real: "La fermeture partielle dure 35 jours, un record à l’époque. Elle s’achève sans les crédits demandés ; il déclare ensuite l’urgence nationale pour réaffecter des fonds militaires.",
      choices: [{ t: "Refuser de signer sans les crédits du mur", hist: true, res: "800 000 fonctionnaires sans paie pendant cinq semaines.", fx: { s: { base: 4, approbation: -4, economie: -2, congres: -5, medias: 4 } } }, { t: "Signer le budget et renvoyer le débat", res: "Le gouvernement reste ouvert ; une partie de votre camp gronde.", fx: { s: { base: -5, approbation: 2 } } }] },
    { id: "covid2020", date: "2020-03-11", until: "2020-03-30", cond: s => s.rank === "president", title: "La pandémie", place: "Bureau ovale", scene: "bureau", people: ["pence", "kushner"],
      text: "L’Organisation mondiale de la santé vient de qualifier le Covid-19 de pandémie. Les marchés s’effondrent, les hôpitaux de New York se remplissent. Les États-Unis sont un État fédéral : la santé publique relève d’abord des gouverneurs.",
      real: "Il déclare l’urgence nationale le 13 mars 2020 et laisse aux États les décisions de confinement. L’opération Warp Speed, lancée en mai, finance des vaccins disponibles dès décembre. Le pays compte plus de 350 000 morts fin 2020.",
      choices: [{ t: "Urgence nationale, décisions aux gouverneurs, pari sur un vaccin rapide", hist: true, res: "Les vaccins arrivent en moins d’un an ; la gestion de la crise divise.", fx: { s: { approbation: -3, economie: -14, bourse: -500, medias: 6, stress: 12 }, f: { covid: true } } }, { t: "Imposer des règles fédérales strictes et uniformes", res: "La courbe s’aplatit plus vite ; la contestation monte dans votre camp.", fx: { s: { approbation: 1, base: -8, economie: -17, bourse: -550, stress: 12 }, f: { covid: true } } }, { t: "Tout miser sur la réouverture rapide de l’économie", res: "L’activité repart tôt ; le bilan humain s’alourdit.", fx: { s: { approbation: -6, base: 3, economie: -9, bourse: -350, medias: 10 }, f: { covid: true } } }] },
    { id: "apres2020", date: "2020-11-07", until: "2020-12-01", cond: s => s.flags.lost2020, title: "Après le scrutin", place: "Maison-Blanche", scene: "bureau", people: ["pence", "mcconnell"],
      text: "Les grands médias annoncent la victoire de Joe Biden. Votre équipe juridique prépare des recours dans plusieurs États. La transition ne peut commencer officiellement qu’avec le feu vert de l’administration.",
      real: "Il conteste le résultat ; plus de soixante recours sont rejetés. Le 6 janvier 2021, pendant la certification, des partisans envahissent le Capitole. Il est mis en accusation une seconde fois par la Chambre, puis acquitté par le Sénat.",
      choices: [{ t: "Contester le résultat devant les tribunaux et l’opinion", hist: true, res: "Les recours échouent. Le 6 janvier marque la fin du mandat ; la Chambre vote une seconde mise en accusation, le Sénat acquitte.", fx: { s: { base: 4, approbation: -8, congres: -18, justice: 25, medias: 15, international: -6 }, r: { pence: -60, mcconnell: -40 }, f: { contested: true } } }, { t: "Reconnaître la défaite et organiser la transition", res: "La passation se déroule dans le calme.", fx: { s: { base: -10, approbation: 6, congres: 4, medias: -8 }, r: { pence: 10, biden: 15 } } }] },
    { id: "candidat2022", date: "2022-11-15", until: "2022-12-10", cond: s => s.rank === "ancien" && s.terms < 2, title: "Repartir en campagne ?", place: "Mar-a-Lago, Floride", scene: "tribune", people: ["donjr", "melania"],
      text: "Les élections de mi-mandat viennent de décevoir votre camp : plusieurs candidats que vous souteniez ont perdu. Le gouverneur de Floride Ron DeSantis monte dans les sondages. Aucun ancien président battu n’a regagné la Maison-Blanche depuis Grover Cleveland, en 1892.",
      real: "Il annonce sa candidature le 15 novembre 2022 et remporte largement les primaires de 2024.",
      choices: [{ t: "Annoncer sa candidature pour 2024", hist: true, res: "La campagne commence, deux ans avant le scrutin.", fx: { s: { base: 6, medias: 5, stress: 8 }, call: { fn: "run", y: 2024 } } }, { t: "Renoncer et peser en faiseur de rois", res: "Vous restez la voix la plus écoutée du parti, sans être candidat.", fx: { s: { base: -8, stress: -10, justice: -5 } } }] },
    { id: "inculpations2023", date: "2023-08-15", until: "2023-09-15", cond: s => s.flags.contested && s.rank !== "president", title: "Quatre procédures", place: "Bedminster, New Jersey", scene: "tribune", people: ["donjr"],
      text: "En cinq mois, vous avez été inculpé quatre fois : à New York pour des écritures comptables, en Floride pour la conservation de documents classifiés, à Washington et en Géorgie pour les suites de l’élection de 2020. Vous plaidez non coupable dans les quatre dossiers.",
      real: "Il fait des procédures un thème central de sa campagne. Reconnu coupable à New York en mai 2024, il fait appel ; les deux dossiers fédéraux sont abandonnés après sa réélection.",
      choices: [{ t: "Faire campagne sur ce thème", hist: true, res: "Les dons affluent, les primaires se resserrent autour de vous.", fx: { s: { base: 8, approbation: -2, justice: 12, medias: 6, fortune: -.1 } } }, { t: "Laisser les avocats parler et recentrer la campagne sur l’économie", res: "Le sujet occupe moins les écrans.", fx: { s: { base: 1, approbation: 1, justice: 8, medias: -3 } } }] },
    { id: "butler2024", date: "2024-07-13", until: "2024-07-20", cond: s => s.running === 2024, title: "Butler, Pennsylvanie", place: "Butler, Pennsylvanie", scene: "tribune", people: [],
      text: "Pendant un meeting en plein air, un tireur posté sur un toit ouvre le feu. Une balle vous effleure l’oreille droite ; un spectateur est tué, deux autres grièvement blessés. Les agents du Secret Service vous couvrent, puis vous relèvent.",
      real: "Il se redresse, le poing levé, avant d’être évacué. Il apparaît deux jours plus tard à la convention de Milwaukee, un pansement sur l’oreille.",
      choices: [{ t: "Se relever et saluer la foule avant d’être évacué", hist: true, res: "La photographie fait le tour du monde.", fx: { s: { base: 8, approbation: 3, stress: 15, sante: -3 } } }, { t: "Se laisser évacuer aussitôt et appeler au calme", res: "Vous publiez un message d’apaisement le soir même.", fx: { s: { base: 3, approbation: 4, stress: 12, sante: -3 } } }] },
    { id: "colistier2024", date: "2024-07-15", until: "2024-07-25", cond: s => s.running === 2024, title: "Choisir un colistier", place: "Milwaukee, Wisconsin", scene: "tribune", people: ["vance", "donjr"],
      text: "La convention républicaine s’ouvre à Milwaukee. Trois noms restent en lice : le sénateur de l’Ohio JD Vance, 39 ans ; le sénateur de Floride Marco Rubio ; le gouverneur du Dakota du Nord Doug Burgum.",
      real: "Il choisit JD Vance le 15 juillet 2024.",
      choices: [{ t: "JD Vance", hist: true, res: "Un colistier jeune, issu de la Rust Belt.", fx: { s: { base: 5 }, r: { vance: 20 }, f: { vp: "vance" }, call: { fn: "bonus", st: ["OH", "PA", "MI", "WI"], v: .6 } } }, { t: "Marco Rubio", res: "Un profil rassurant pour les modérés.", fx: { s: { approbation: 2, base: -1 }, f: { vp: "rubio" }, call: { fn: "bonus", st: ["FL", "NV", "AZ"], v: .8 } } }, { t: "Doug Burgum", res: "Un gouverneur discret et homme d’affaires.", fx: { s: { approbation: 1 }, f: { vp: "burgum" } } }] },
    { id: "douanes2025", date: "2025-04-02", until: "2025-04-20", cond: s => s.rank === "president" && s.terms === 2, title: "Les droits de douane généralisés", place: "Roseraie de la Maison-Blanche", scene: "bureau", people: ["vance", "xi"],
      text: "Votre équipe commerciale propose un droit de douane minimal de 10 % sur toutes les importations, et des taux bien supérieurs pour une soixantaine de pays, calculés d’après les déficits commerciaux. Le Trésor prévient que les marchés ne l’ont pas anticipé.",
      real: "Les droits sont annoncés le 2 avril 2025. Les Bourses perdent plus de 10 % en deux séances ; le 9 avril, les taux les plus élevés sont suspendus pour 90 jours, sauf pour la Chine. Des négociations pays par pays suivent.",
      choices: [{ t: "Annoncer le plan complet", hist: true, res: "Chute des marchés, puis suspension partielle une semaine plus tard.", fx: { s: { bourse: -520, economie: -4, base: 3, approbation: -3, international: -8 }, pays: { chine: { rel: -20 }, europe: { rel: -12 }, canada: { rel: -15 }, mexique: { rel: -10 }, japon: { rel: -8 } }, f: { tarifs: true } } }, { t: "Se limiter au droit de 10 % et négocier", res: "Les marchés reculent modérément.", fx: { s: { bourse: -180, economie: -1, base: 1, international: -3 }, pays: { chine: { rel: -8 }, europe: { rel: -5 } } } }, { t: "Cibler la seule Chine", res: "Pékin riposte, les alliés respirent.", fx: { s: { bourse: -120, base: 1 }, pays: { chine: { rel: -18 } } } }] },
    { id: "iran2025", date: "2025-06-21", until: "2025-07-05", cond: s => s.rank === "president" && s.terms === 2, title: "Les sites nucléaires iraniens", place: "Salle de crise", scene: "bureau", people: ["netanyahou", "vance"],
      text: "Israël bombarde l’Iran depuis une semaine. Le site d’enrichissement de Fordo, enterré sous une montagne, n’est à la portée que des bombes pénétrantes américaines. Une partie de votre camp refuse toute nouvelle guerre au Proche-Orient.",
      real: "Des bombardiers américains frappent trois sites nucléaires iraniens dans la nuit du 21 au 22 juin 2025. L’Iran riposte par des tirs sur une base au Qatar ; un cessez-le-feu entre Israël et l’Iran est annoncé le 24 juin.",
      choices: [{ t: "Ordonner les frappes", hist: true, res: "Trois sites sont touchés ; un cessez-le-feu suit en trois jours.", fx: { s: { international: 2, base: -1, approbation: 1, stress: 8 }, r: { netanyahou: 12 }, pays: { iran: { rel: -30 }, israel: { rel: 15 } } } }, { t: "Refuser d’engager l’aviation américaine", res: "Israël poursuit seul ; le programme iranien est retardé, pas arrêté.", fx: { s: { base: 2 }, r: { netanyahou: -15 }, pays: { israel: { rel: -10 }, iran: { rel: 5 } } } }] },
    { id: "loi2025", date: "2025-07-03", until: "2025-07-20", cond: s => s.rank === "president" && s.terms === 2 && s.house === "R", title: "La grande loi budgétaire", place: "Capitole", scene: "bureau", people: ["johnson", "vance"],
      text: "Le Congrès achève l’examen d’une loi unique : prolongation des baisses d’impôts de 2017, crédits pour la frontière et la défense, réduction de dépenses de santé et d’aide alimentaire. Le Bureau du budget estime qu’elle ajoutera plus de 3 000 milliards à la dette en dix ans. Au Sénat, il faudra la voix du vice-président.",
      real: "La loi passe le Sénat par 51 voix contre 50 et il la promulgue le 4 juillet 2025.",
      choices: [{ t: "Peser de tout son poids pour un vote avant le 4 juillet", hist: true, res: "Promulguée le jour de la fête nationale.", fx: { s: { base: 5, congres: 6, economie: 2, bourse: 90, approbation: -2 }, f: { obbba: true } } }, { t: "Accepter un texte réduit pour rallier les modérés", res: "Le vote est plus large, le texte moins ambitieux.", fx: { s: { base: -3, congres: 3, approbation: 2 } } }] }
  ],

  randomEvents: [
    { id: "fuite", cond: s => s.rank === "president", title: "Une fuite dans la presse", people: [], scene: "bureau", text: "Un grand quotidien publie le compte rendu d’une réunion à huis clos. Seules huit personnes étaient dans la pièce.",
      choices: [{ t: "Ordonner une enquête interne", res: "La Maison-Blanche se referme.", fx: { s: { medias: 3, stress: 4, congres: -1 } } }, { t: "Laisser passer", res: "Le sujet s’éteint en quarante-huit heures.", fx: { s: { medias: -1 } } }, { t: "Répondre publiquement en contestant l’article", res: "La polémique dure une semaine.", fx: { s: { base: 2, medias: 4 } } }] },
    { id: "ouragan", cond: s => s.rank === "president", title: "Un ouragan sur la côte du Golfe", people: [], scene: "tribune", text: "Un ouragan de catégorie 4 touche terre. Les gouverneurs demandent la déclaration de catastrophe majeure et des fonds fédéraux.",
      choices: [{ t: "Se rendre sur place et débloquer l’aide maximale", res: "Les images sont celles d’un président présent.", fx: { s: { approbation: 3, fatigue: 6 } } }, { t: "Débloquer l’aide et laisser les agences travailler", res: "L’aide arrive ; l’absence est commentée.", fx: { s: { approbation: -1 } } }] },
    { id: "allie", cond: s => s.rank === "president", title: "Un allié demande des garanties", people: ["macron"], scene: "bureau", text: "Plusieurs capitales européennes veulent savoir si l’engagement américain dans l’OTAN reste entier. Elles proposent d’augmenter leurs dépenses de défense en échange d’une déclaration commune.",
      choices: [{ t: "Signer la déclaration commune", res: "Les alliés sont rassurés.", fx: { s: { international: 5, base: -2 }, pays: { europe: { rel: 10 } } } }, { t: "Exiger d’abord des hausses de budget chiffrées", res: "Les Européens s’exécutent en maugréant.", fx: { s: { international: -2, base: 3 }, pays: { europe: { rel: -5 } } } }] },
    { id: "meeting", cond: s => !!s.running, title: "Un débat télévisé", people: [], scene: "tribune", text: "Les chaînes proposent un débat face à votre adversaire, à six semaines du scrutin. Vos conseillers sont partagés.",
      choices: [{ t: "Accepter et attaquer", res: "Le débat est vif ; chaque camp crie victoire.", fx: { s: { base: 3, approbation: -1, medias: 3 } } }, { t: "Accepter et rester sur le fond", res: "Un ton inhabituel, remarqué.", fx: { s: { approbation: 2, base: -1 } } }, { t: "Refuser", res: "Vous tenez un meeting à la même heure.", fx: { s: { base: 1, approbation: -1 } } }] },
    { id: "famille", cond: s => true, title: "Un week-end à Mar-a-Lago", people: ["melania"], scene: "tribune", text: "L’agenda permet deux jours en Floride. Votre équipe propose d’en profiter pour des dîners de donateurs ; votre famille préférerait un vrai repos.",
      choices: [{ t: "Se reposer en famille", res: "Deux jours sans caméras.", fx: { s: { fatigue: -15, stress: -10 }, r: { melania: 5 } } }, { t: "Recevoir les donateurs", res: "Les caisses se remplissent.", fx: { s: { fortune: .05, base: 1, fatigue: 5 } } }] }
  ],

  legends: [
    { title: "Le Bâtisseur de majorités", cond: s => s.terms >= 2 && s.stats.approbation >= 52, text: "Deux mandats et un pays qui te suit." },
    { title: "Le Revenant", cond: s => s.terms >= 2 && s.flags.lostOnce, text: "Battu, puis réélu : un retour sans équivalent depuis le XIXe siècle." },
    { title: "Le Président d’un mandat", cond: s => s.terms === 1, text: "Quatre années qui ont changé le ton de la politique américaine." },
    { title: "Le Négociateur", cond: s => s.stats.international >= 65, text: "Tes sommets ont redessiné des alliances." },
    { title: "Le Candidat", cond: s => s.terms === 0, text: "Tu as bousculé la campagne sans atteindre la Maison-Blanche." },
    { title: "L’Outsider", cond: () => true, text: "Tu es entré en politique par effraction et tu ne l’as plus quittée." }
  ],
  aiBrief: "Donald Trump (né en 1946), homme d’affaires et président des États-Unis. Ton : simulateur politique sérieux, factuel et strictement neutre, dans le style d’une agence de presse.",
  aiRules: [
    "Personne réelle et vivante, sujet politique : appuie-toi uniquement sur des faits publics. N’invente aucune citation présentée comme réelle ; les paroles sont paraphrasées, sans guillemets.",
    "Neutralité stricte : aucun jugement moral ou partisan, ni pour ni contre. Présente les réactions des deux camps de façon équilibrée, avec des conséquences réalistes et défendables.",
    "Rien de diffamatoire : n’affirme aucun fait non établi sur une personne réelle ; pour les affaires judiciaires, tiens-toi aux procédures publiques et à la présomption d’innocence.",
    "Respecte les institutions américaines : pouvoirs du président, du Congrès, des tribunaux et des États. Une action hors de ses pouvoirs doit être déclarée invalide ou bloquée."
  ]
};

/* ---------------- Cartes : États-Unis (popularité par État) et monde (diplomatie) ---------------- */
T.swing = s => (s.stats.approbation - 43.5) * .55 + (s.stats.economie - 55) * .1 + (s.stats.base - 75) * .06 - (s.stats.justice > 60 ? 1 : 0);
T.margin = (s, k) => ST[k][3] + T.swing(s) + ((s.bonus || {})[k] || 0);
const usMap = { id: "usa", label: "États-Unis", title: "États-Unis : popularité par État", viewBox: "150 50 700 510",
  regions: Object.entries(ST).map(([k, v]) => ({ id: k, name: v[0], short: k, pts: tile(v[4], v[5]), c: [160 + v[4] * 62 + 28, 60 + v[5] * 62 + 26], adj: [] })),
  statusLabel: { s5: "Très favorable", s4: "Favorable", s3: "Disputé", s2: "Défavorable", s1: "Très défavorable" },
  status(s, id){ const m = T.margin(s, id); return m >= 12 ? "s5" : m >= 3 ? "s4" : m > -3 ? "s3" : m > -12 ? "s2" : "s1"; }, markers: s => [] };
const W = (id, name, pts, c) => ({ id, name, pts, c, adj: [] });
const worldMap = { id: "monde", label: "Monde", title: "Monde : diplomatie et déploiements", viewBox: "120 40 820 480",
  regions: [W("canada", "Canada", "140,70 330,70 320,145 150,145", [235, 108]), W("usa", "États-Unis", "150,150 310,150 318,228 210,250 150,222", [232, 195]), W("mexique", "Mexique", "172,255 255,252 275,312 222,322", [228, 285]), W("amlat", "Amérique latine", "262,322 345,330 352,470 302,500 268,420", [308, 400]),
    W("royaumeuni", "Royaume-Uni", "425,108 468,104 470,160 428,165", [447, 135]), W("europe", "Union européenne", "474,128 566,122 574,205 480,210", [524, 166]), W("ukraine", "Ukraine", "578,165 640,160 642,196 580,198", [610, 180]), W("russie", "Russie", "580,60 905,60 905,150 650,156 578,158", [745, 108]),
    W("israel", "Israël", "548,216 600,216 600,258 548,258", [574, 238]), W("arabie", "Arabie saoudite", "604,262 672,262 668,318 608,308", [638, 288]), W("iran", "Iran", "646,202 712,202 712,256 646,256", [679, 229]), W("inde", "Inde", "684,262 748,265 738,345 698,338", [716, 300]),
    W("chine", "Chine", "720,160 852,158 862,262 754,262 720,200", [790, 212]), W("coree", "Corée du Nord", "856,150 900,150 900,184 858,186", [878, 168]), W("japon", "Japon", "872,190 925,186 928,246 880,250", [900, 218]), W("afrique", "Afrique", "440,225 540,222 596,330 556,442 500,432 462,330", [512, 330])],
  statusLabel: { home: "États-Unis", allie: "Allié proche", paix: "Partenaire", tendu: "Relations tendues", guerre: "Adversaire" },
  status(s, id){ if (id === "usa") return "home"; const v = s.pays[id].rel; return v >= 45 ? "allie" : v >= 0 ? "paix" : v >= -40 ? "tendu" : "guerre"; },
  markers(s){ return Object.entries(s.pays).filter(([k, c]) => c.troupes > 0).map(([k, c]) => ({ id: "t-" + k, region: k, moving: false, label: c.troupes > 1 ? "★★" : "★", title: `${T.regionName(k)} : présence militaire ${c.troupes > 1 ? "renforcée" : "américaine"}` })); } };
T.maps = [usMap, worldMap]; T.map = worldMap;
T.regionName = id => (worldMap.regions.find(r => r.id === id) || usMap.regions.find(r => r.id === id) || { name: id }).name;
T.ev = (s, k) => ST[k][parseD(s.date).y >= 2024 ? 2 : 1];
T.mapInfo = (s, id) => {
  if (ST[id]) { const m = T.margin(s, id); const st = usMap.status(s, id); return `<div class="map-info"><button class="x" data-do="mapclose" aria-label="Fermer">×</button><h3>${esc(ST[id][0])} <span class="chip ${st === "s3" ? "rival" : m > 0 ? "allie" : "ennemi"}">${esc(usMap.statusLabel[st])}</span></h3>
    <span class="note">${T.ev(s, id)} grands électeurs · avance estimée : ${m >= 0 ? "républicains" : "démocrates"} ${sg(Math.abs(m)).slice(1)} point${Math.abs(m) >= 2 ? "s" : ""}${(s.bonus || {})[id] ? ` · effet de vos meetings ${sg(s.bonus[id])}` : ""}</span>
    ${s.running ? `<div class="ops"><button class="btn small primary" data-do="act|meeting|${id}">Tenir un meeting ici</button></div>` : `<span class="note">Les meetings par État s’ouvrent pendant une campagne.</span>`}</div>`; }
  if (id === "usa") return `<div class="map-info"><button class="x" data-do="mapclose" aria-label="Fermer">×</button><h3>États-Unis</h3><span class="note">Basculez sur la carte des États pour la popularité État par État.</span></div>`;
  const c = s.pays[id]; const st = worldMap.status(s, id);
  return `<div class="map-info"><button class="x" data-do="mapclose" aria-label="Fermer">×</button><h3>${esc(T.regionName(id))} <span class="chip ${st === "allie" ? "allie" : st === "guerre" ? "ennemi" : st === "tendu" ? "rival" : "neutre"}">${esc(worldMap.statusLabel[st])}</span></h3>
    <span class="note">Relation ${Math.round(c.rel)} · droits de douane ${["aucun", "faibles", "élevés", "très élevés"][c.tarif || 0]} · présence militaire ${["aucune", "permanente", "renforcée"][c.troupes || 0]}</span>
    ${P(s) >= 3 ? `<div class="ops"><button class="btn small" data-do="goto|diplomatie">Diplomatie et armée</button></div>` : `<span class="note">La diplomatie appartient au président en exercice.</span>`}</div>`;
};

/* ---------------- Mise en place ---------------- */
T.defaultPol = { impots: 0, douanes: 0, defense: 1, social: 1, frontiere: 1, energie: 1, ton: 1, reseaux: 2, pub: 1, theme: "economie" };
const PAYS0 = { canada: 55, mexique: 20, amlat: 10, royaumeuni: 60, europe: 45, ukraine: 25, russie: -25, israel: 65, arabie: 35, iran: -65, inde: 30, chine: -15, coree: -70, japon: 60, afrique: 15 };
T.setup = (s, startId) => {
  const st = T.starts.find(x => x.id === startId) || T.starts[0];
  s.terms = st.terms; s.running = st.running; s.house = st.house; s.senate = st.senate; s.pol = { ...T.defaultPol }; s.wk = {}; s.bonus = {}; s.decrets = {}; s.dette = startId === "2025" ? 36.2 : startId === "2017" ? 19.9 : 18.2; s.juges = startId === "2025" ? 3 : 0;
  s.pays = {}; for (const [k, v] of Object.entries(PAYS0)) s.pays[k] = { rel: v, statut: "paix", tarif: 0, troupes: ["europe", "japon", "arabie"].includes(k) ? 1 : 0 };
  if (startId === "2025") { s.pays.russie.rel = -45; s.pays.ukraine.rel = 30; s.pays.chine.rel = -30; s.pays.coree.rel = -55; s.flags.lostOnce = true; s.flags.contested = true; s.flags.vp = "vance"; } if (startId === "2017") s.flags.vp = "pence";
  s.cabinet = {}; for (const [k, p] of Object.entries(T.posts)) { const o = p.list.filter(x => x[4] <= s.date); s.cabinet[k] = (startId === "2025" ? o[o.length - 1] : o[0] || p.list[0])[0]; }
  s.rivals = {}; for (const r of T.rivals) s.rivals[r.id] = { plan: r.plans[0].plan, prog: Math.round(Math.random() * 30), i: 0 };
};
T.sync = s => { for (const c of Object.values(s.pays)) c.statut = c.rel >= 45 ? "allie" : c.rel >= 0 ? "paix" : c.rel >= -40 ? "tendu" : "guerre"; };

/* ---------------- Cabinet ---------------- */
T.posts = {
  chef: { label: "Chef de cabinet", list: [["priebus", "Reince Priebus", 55, 60, "2015"], ["kelly", "John Kelly", 50, 80, "2017-07"], ["mulvaney", "Mick Mulvaney", 75, 60, "2019-01"], ["meadows", "Mark Meadows", 90, 55, "2020-03"], ["wiles", "Susie Wiles", 85, 85, "2024-11"]] },
  etat: { label: "Secrétaire d’État", list: [["tillerson", "Rex Tillerson", 40, 65, "2015"], ["pompeo", "Mike Pompeo", 85, 75, "2018-03"], ["rubio", "Marco Rubio", 75, 80, "2024-11"]] },
  defense: { label: "Secrétaire à la Défense", list: [["mattis", "James Mattis", 40, 90, "2015"], ["esper", "Mark Esper", 55, 70, "2019-07"], ["hegseth", "Pete Hegseth", 95, 50, "2024-11"]] },
  tresor: { label: "Secrétaire au Trésor", list: [["mnuchin", "Steven Mnuchin", 80, 72, "2015"], ["bessent", "Scott Bessent", 80, 80, "2024-11"]] },
  justice: { label: "Ministre de la Justice", list: [["sessions", "Jeff Sessions", 55, 65, "2015"], ["barr", "William Barr", 65, 80, "2019-02"], ["bondi", "Pam Bondi", 92, 65, "2024-11"]] }
};
T.cab = (s, post, i) => { const o = T.posts[post].list.find(x => x[0] === s.cabinet[post]); return o ? o[i] : 60; };

/* ---------------- Économie : budget fédéral mensuel, en milliards de dollars ---------------- */
T.budget = s => {
  const p = s.pol, y = parseD(s.date).y; const base = 270 + (y - 2015) * 14; const eco = .8 + s.stats.economie / 250;
  const rec = [["Impôt sur le revenu", base * .5 * eco * (1 + p.impots * .06)], ["Cotisations sociales", base * .35 * eco], ["Impôt sur les sociétés", base * .1 * eco * (1 + p.impots * .12) * (s.flags.taxcut ? .75 : 1)], ["Droits de douane", 3 + p.douanes * 9 * (y >= 2025 ? 1.6 : 1)]];
  const sp = 320 + (y - 2015) * 24;
  const dep = [["Retraites et santé", sp * .52 * (1 + (p.social - 1) * .05)], ["Défense", sp * .15 * (1 + (p.defense - 1) * .1)], ["Frontière et sécurité intérieure", sp * .02 * (1 + (p.frontiere - 1) * .4)], ["Autres dépenses", sp * .22], ["Intérêts de la dette", s.dette * (y >= 2023 ? 2.4 : 1.6)]];
  const R = rec.reduce((t, x) => t + x[1], 0), D = dep.reduce((t, x) => t + x[1], 0); return { rec, dep, R, D, solde: R - D };
};
T.fin = { stat: "bourse", unit: "pts", chartTitle: "Bourse sur les douze derniers mois, en points d’indice",
  kpis: (s, b, f) => [["Bourse", f(s.stats.bourse)], ["Recettes fédérales par mois", Math.round(b.R) + " Md $"], ["Dépenses fédérales par mois", Math.round(b.D) + " Md $"], ["Déficit par mois", Math.round(-b.solde) + " Md $"], ["Dette fédérale", s.dette.toFixed(1).replace(".", ",") + " billions $"], ["Économie", Math.round(s.stats.economie)]] };

/* ---------------- Simulation hebdomadaire ---------------- */
T.tick = function(s, h){
  const st = s.stats, p = s.pol, pw = P(s), out = []; const b = T.budget(s);
  if (pw >= 3) s.dette += -b.solde / 1000 * h.dt;
  const ecoT = 56 + p.impots * -2.5 - p.douanes * 3 + (s.flags.taxcut ? 2 : 0) + (p.energie - 1) * 1.5 - (s.flags.covid && s.date < "2021-06-01" ? 8 : 0);
  h.drift("economie", pw >= 3 ? ecoT : 56, .06);
  st.bourse = clamp(st.bourse * (1 + ((st.economie - 46) * .0011 - p.douanes * .0012 + (Math.random() - .5) * .02) * h.dt * 4.3 / 4.3), 500, 20000);
  h.drift("approbation", 41 + (st.economie - 50) * .3 - (st.medias - 60) * .08 + (p.ton === 0 ? 2 : p.ton === 2 ? -2 : 0) + (pw >= 3 ? (T.cab(s, "chef", 3) - 65) * .04 : 2), .05);
  h.drift("base", 78 + (p.ton === 2 ? 5 : p.ton === 0 ? -4 : 0) + p.frontiere * 2 + p.douanes, .04);
  const maj = (s.house === "R" ? 1 : 0) + (s.senate === "R" ? 1 : 0); h.drift("congres", pw >= 3 ? 30 + maj * 16 + (st.approbation - 45) * .4 : 35, .05);
  h.drift("medias", 58 + (p.ton === 2 ? 10 : p.ton === 0 ? -6 : 0) + p.reseaux * 2, .05);
  h.drift("justice", s.flags.contested && pw < 3 ? 45 : pw >= 3 ? 14 : 8, .02);
  h.drift("international", 50 + (pw >= 3 ? (T.cab(s, "etat", 3) - 65) * .15 - p.douanes * 3 : 0), .03);
  h.add("fortune", .012 * (st.bourse > 3000 ? 1.4 : 1) - (s.running ? .01 * p.pub : 0) - (st.justice > 50 ? .012 : 0));
  h.add("fatigue", (pw >= 3 ? 2.5 : s.running ? 3.5 : -3) + p.reseaux * .6 - 2.2); h.add("stress", (st.medias + st.justice) / 60 - 2.4 + (s.running ? 1 : 0));
  const age = h.age; h.drift("sante", 92 - Math.max(0, age - 68) * 1.25 - Math.max(0, st.fatigue - 70) * .3 - Math.max(0, st.stress - 70) * .3, .05);
  for (const [k, c] of Object.entries(s.pays)) { c.rel = clamp(c.rel + ((PAYS0[k] - c.rel) * .01 - (c.tarif || 0) * .35) * h.dt * 4.3 / 4.3, -100, 100); }
  for (const k of Object.keys(s.bonus)) { s.bonus[k] *= 1 - .03 * h.dt; }
  return out;
};

/* ---------------- Élections ---------------- */
T.elect = s => { const y = parseD(s.date).y; let ev = 0; const won = [], lost = []; const adv = s.pol.pub * .4 + (s.pol.theme === "economie" ? (s.stats.economie > 55 ? 1 : -1) : s.pol.theme === "immigration" ? .6 : .2);
  for (const k of Object.keys(ST)) { const m = T.margin(s, k) + adv + (Math.random() - .5) * 4; if (m > 0) { ev += T.ev(s, k); if (SWING.includes(k)) won.push(ST[k][0]); } else if (SWING.includes(k)) lost.push(ST[k][0]); } return { ev, win: ev >= 270, won, lost, y }; };
T.fxCall = (s, c, out) => {
  if (c.fn === "run") { s.running = c.y; s.bonus = {}; out.notes.push(`Candidature déclarée pour ${c.y}.`); }
  else if (c.fn === "bonus") for (const k of c.st) s.bonus[k] = (s.bonus[k] || 0) + c.v;
};
T.week = (s, cont) => {
  if (s.dead || cont) return null; const p = parseD(s.date), y = p.y; const info = (id, title, text, fx, scene) => ({ event: { id, title, text, place: s.place, scene: scene || "tribune", people: [], choices: [{ t: "Continuer", fx: fx || {} }] } });
  const past = (m, d) => s.date >= fmtD(y, m, d) && s.date < addDays(fmtD(y, m, d), 7);
  if (s.rank === "president" && s.terms === 1 && !s.running && y % 4 === 3 && p.m >= 6 && s.wk.autorun !== y) { s.wk.autorun = y; s.running = y + 1; s.bonus = {}; GAME.news(s, { src: "Dépêche d’agence", title: `Le président est candidat à sa réélection en ${y + 1}`, text: "La campagne s’ouvre : l’onglet Campagne est disponible.", ton: "neu" }); }
  // Présidentielle : premier mardi de novembre, tous les quatre ans
  if (y % 4 === 0 && past(11, y === 2016 ? 8 : y === 2020 ? 3 : y === 2024 ? 5 : 7) && s.running === y) {
    const r = T.elect(s); s.running = 0; s.lastVote = r; const real = { 2016: "Dans la réalité, il l’emporte avec 304 grands électeurs contre 227.", 2020: "Dans la réalité, Joe Biden l’emporte avec 306 grands électeurs contre 232.", 2024: "Dans la réalité, il l’emporte avec 312 grands électeurs contre 226." }[y] || "";
    s.history.push({ date: s.date, id: "elec" + y, kind: "saison", title: `Élection présidentielle de ${y}`, choice: r.win ? "Victoire" : "Défaite", hist: null, histExists: false, outcome: `${r.ev} grands électeurs` });
    if (r.win) { if (s.rank !== "president") s.rank = "elu"; s.flags["won" + y] = true; return info("elec" + y, `Nuit électorale ${y} : victoire`, `Vous obtenez ${r.ev} grands électeurs sur 538 ; il en fallait 270. États disputés gagnés : ${r.won.join(", ") || "aucun"}. Perdus : ${r.lost.join(", ") || "aucun"}. ${real}`, { s: { base: 6, stress: -8, medias: 4 } }); }
    s.flags.lostOnce = true; s.flags["lost" + y] = true; return info("elec" + y, `Nuit électorale ${y} : défaite`, `Vous obtenez ${r.ev} grands électeurs sur 538 ; il en fallait 270. États disputés gagnés : ${r.won.join(", ") || "aucun"}. Perdus : ${r.lost.join(", ") || "aucun"}. ${real}`, { s: { base: -4, stress: 10 } }); }
  // Mi-mandat et renouvellement du Congrès
  if (y % 2 === 0 && past(11, 3) && s.wk.mid !== y) { s.wk.mid = y; const inPower = s.rank === "president" || s.rank === "elu"; const score = (inPower ? s.stats.approbation - 47 : 47 - 44) + (y % 4 === 0 ? (s.lastVote && s.lastVote.y === y && s.lastVote.win ? 4 : -2) : -4) + (Math.random() - .5) * 6; const oldH = s.house, oldS = s.senate;
    if (inPower || y % 4 === 0) { s.house = score > -1 ? "R" : "D"; s.senate = score > -4 ? "R" : "D"; } else { s.house = Math.random() < .6 ? "R" : "D"; }
    if (y % 4 !== 0) return info("mid" + y, `Élections de mi-mandat ${y}`, `Chambre des représentants : majorité ${s.house === "R" ? "républicaine" : "démocrate"}${oldH !== s.house ? " (bascule)" : ""}. Sénat : majorité ${s.senate === "R" ? "républicaine" : "démocrate"}${oldS !== s.senate ? " (bascule)" : ""}.`, { s: { congres: s.house === "R" ? 4 : -12 } }, "bureau"); }
  // Investiture ou fin de mandat : 20 janvier
  if (past(1, 20) && y % 4 === 1 && s.wk.inaug !== y) { s.wk.inaug = y;
    if (s.rank === "elu" || (s.rank === "president" && s.flags["won" + (y - 1)])) { const was = s.rank; s.rank = "president"; s.terms++; s.place = "Maison-Blanche, Washington"; s.decrets = {}; s.scene = "bureau"; return info("inaug" + y, `Investiture du 20 janvier ${y}`, `Vous prêtez serment sur les marches du Capitole pour ${was === "president" ? "un second mandat consécutif" : s.terms === 1 ? "votre premier mandat" : "un nouveau mandat"}. Les panneaux du pouvoir exécutif sont ${was === "president" ? "toujours" : "désormais"} entre vos mains.`, { s: { approbation: 3, stress: 5 } }, "bureau"); }
    if (s.rank === "president") { s.rank = s.terms >= 2 ? "prive" : "ancien"; s.place = "Mar-a-Lago, Floride"; s.scene = "tribune"; return info("fin" + y, "Fin du mandat", s.terms >= 2 ? "La Constitution limite la présidence à deux mandats. Vous quittez la Maison-Blanche et retrouvez la Floride." : "Votre successeur prête serment. Vous quittez Washington pour la Floride ; rien ne vous interdit de vous représenter dans quatre ans.", { s: { stress: -10, fatigue: -15 } }); } }
  if (s.rank === "candidat" && !s.running) { s.rank = "prive"; }
  return null;
};

/* ---------------- Jauges, alertes, À venir ---------------- */
T.mainGauges = s => [{ label: "Popularité", v: s.stats.approbation }, { label: "Soutien de la base", v: s.stats.base }, { label: "Soutien au Congrès", v: s.stats.congres }, { label: "Économie", v: s.stats.economie }, { label: `Santé · ${GAME.age(s)} ans`, v: s.stats.sante }];
T.sideFacts = s => [["Bourse", `${Math.round(s.stats.bourse).toLocaleString("fr-FR")} pts`], ["Relations internationales", Math.round(s.stats.international)], ["Hostilité des médias", Math.round(s.stats.medias)], ["Pression judiciaire", Math.round(s.stats.justice)], ["Chambre · Sénat", `${s.house} · ${s.senate}`], ["Fortune", MD(s.stats.fortune)]];
T.alerts = s => { const o = { general: [], pouvoir: [], economie: [] }; if (s.stats.approbation < 36) o.general.push("Popularité au plus bas : vos alliés au Congrès prennent leurs distances."); if (s.stats.justice >= 65) o.pouvoir.push("La pression judiciaire devient très forte."); if (P(s) >= 3 && s.house === "D") o.pouvoir.push("La Chambre est démocrate : vos lois seront bloquées, les enquêtes parlementaires s’ouvrent."); if (s.stats.economie < 40) o.economie.push("L’économie ralentit nettement."); if (s.running) o.general.push(`Vous êtes en campagne pour ${s.running}.`); return o; };
T.badges = (s, c) => ({ general: c.view !== "general" && c.flagGeneral, pouvoir: c.view !== "pouvoir" && c.al.pouvoir.length > 0, medias: c.view !== "medias" && c.newsNew, economie: c.view !== "economie" && c.al.economie.length > 0, messages: c.unread > 0 });
T.upcoming = s => { const out = [], y = parseD(s.date).y; for (const x of s.deferred) out.push({ d: x.date, t: x.title, k: "Conséquence attendue" });
  for (const yy of [y, y + 1, y + 2]) { if (yy % 2 === 0) out.push({ d: `${yy}-11-0${yy === 2016 ? 8 : yy === 2020 ? 3 : yy === 2024 ? 5 : 3}`, t: yy % 4 === 0 ? `Élection présidentielle${s.running === yy ? " : vous êtes candidat" : ""}` : "Élections de mi-mandat", k: "Scrutin" }); if (yy % 4 === 1) out.push({ d: `${yy}-01-20`, t: "Investiture présidentielle", k: "Calendrier" }); }
  return out.filter(x => x.d > s.date).sort((a, b) => a.d.localeCompare(b.d)).slice(0, 8); };
T.opinions = s => [["Popularité nationale", s.stats.approbation], ["Soutien de la base républicaine", s.stats.base]];
T.newsFx = (s, cat, sign) => { if (cat === "etr") { const v = sign * .4; s.stats.base = clamp(s.stats.base + v, 0, 100); return { k: "de la base", v }; } const v = sign * .3; s.stats.approbation = clamp(s.stats.approbation + v, 0, 100); return { k: "nationale", v }; };

/* ---------------- Tableau « Pouvoir » ---------------- */
T.boards = { pouvoir: s => { const blk = (t, b) => `<div class="panel"><h2>${t}</h2>${b}</div>`; const y = parseD(s.date).y;
  const sw = SWING.map(k => [k, T.margin(s, k)]).sort((a, b) => b[1] - a[1]); let ev = 0; for (const k of Object.keys(ST)) if (T.margin(s, k) > 0) ev += T.ev(s, k);
  return `<div class="kpi four"><div><small>Statut</small><b>${esc(GAME.rankLabel(s))}</b></div><div><small>Mandats exercés</small><b>${s.terms}</b></div><div><small>Chambre des représentants</small><b>${s.house === "R" ? "Républicaine" : "Démocrate"}</b></div><div><small>Sénat</small><b>${s.senate === "R" ? "Républicain" : "Démocrate"}</b></div><div><small>Juges nommés à la Cour suprême</small><b>${s.juges}</b></div><div><small>Projection si l’on votait aujourd’hui</small><b>${ev} grands électeurs</b></div></div>`
    + `<div class="two-col">` + blk("États disputés", `<div class="tbl">${sw.map(([k, m]) => `<div><span>${esc(ST[k][0])} (${T.ev(s, k)})</span><span>${m >= 0 ? "R" : "D"} ${sg(Math.abs(m)).slice(1)}</span></div>`).join("")}</div><p class="note" style="margin:6px 0 0">Avance estimée en points. Il faut 270 grands électeurs sur 538.</p>`)
    + blk("Décrets en vigueur", Object.keys(s.decrets).length ? `<div class="tbl">${Object.entries(s.decrets).map(([k, d]) => `<div><span>${esc(T.decrets.find(x => x.id === k).label)}</span><span>${d.bloque ? "suspendu par un juge" : ["modéré", "ferme", "maximal"][d.lvl]}</span></div>`).join("")}</div>` : `<span class="note">${P(s) >= 3 ? "Aucun décret signé pendant ce mandat." : "Les décrets sont réservés au président en exercice."}</span>`) + `</div>`
    + blk("Cabinet", `<div class="tbl">${Object.entries(T.posts).map(([k, p]) => `<div><span>${esc(p.label)}</span><span>${P(s) >= 3 ? esc(p.list.find(x => x[0] === s.cabinet[k])[1]) : "—"}</span></div>`).join("")}<div><span>Vice-président ou colistier</span><span>${esc({ pence: "Mike Pence", vance: "JD Vance", rubio: "Marco Rubio", gingrich: "Newt Gingrich", christie: "Chris Christie", burgum: "Doug Burgum" }[s.flags.vp] || "—")}</span></div></div>`); } };

/* ---------------- Panneaux ---------------- */
const levels = (...n) => v => n[v + (n.off || 0)];
const lv = (off, ...n) => { const f = v => n[v + off]; return f; };
const note = (id, label, min, max, step, fmt, txt) => s => ({ k: "slider", act: "pol", arg: id, label, min, max, step, val: s.pol[id], fmt, live: v => txt(s, +v) });
T.decrets = [
  { id: "frontiere", label: "Sécurité de la frontière sud", fx: [{ base: 3 }, { base: 5, approbation: -1 }, { base: 7, approbation: -3, international: -2 }], risk: [.1, .35, .6] },
  { id: "energie", label: "Déréglementation de l’énergie", fx: [{ economie: 1 }, { economie: 2, base: 2 }, { economie: 3, base: 3, approbation: -2 }], risk: [.05, .2, .4] },
  { id: "fonction", label: "Réduction de l’administration fédérale", fx: [{ base: 2 }, { base: 4, congres: -2 }, { base: 6, approbation: -3, congres: -4 }], risk: [.15, .4, .65] },
  { id: "commerce", label: "Droits de douane par décret", fx: [{ base: 1, bourse: -40 }, { base: 3, bourse: -120, economie: -1 }, { base: 4, bourse: -260, economie: -3, international: -4 }], risk: [.1, .3, .55] },
  { id: "accords", label: "Retrait d’un accord international", fx: [{ base: 2, international: -2 }, { base: 3, international: -5 }, { base: 4, international: -9 }], risk: [.02, .05, .1] },
  { id: "sante", label: "Prix des médicaments", fx: [{ approbation: 1 }, { approbation: 2, bourse: -30 }, { approbation: 3, bourse: -70, congres: -2 }], risk: [.1, .3, .5] },
  { id: "tech", label: "Intelligence artificielle et technologies", fx: [{ economie: 1 }, { economie: 2, bourse: 40 }, { economie: 2, bourse: 70, approbation: -1 }], risk: [.02, .1, .2] }
];
T.panels = [
  { id: "decrets", label: "Décrets exécutifs", cond: s => true, blocks: s => P(s) < 3 ? [{ k: "info", html: "Seul le président en exercice signe des décrets." }, ...(s.running ? [{ k: "h", text: "Campagne" }, ...T.panels.find(x => x.id === "campagne").blocks(s)] : [])] : [
    { k: "info", html: "Un décret s’applique sans vote du Congrès, mais un juge fédéral peut le suspendre. Plus il est ambitieux, plus le risque de blocage est élevé. Un seul décret par thème et par mandat." },
    { k: "kpi", items: [["Juges nommés à la Cour suprême", s.juges], ["Ministre de la Justice", T.posts.justice.list.find(x => x[0] === s.cabinet.justice)[1]]] },
    ...T.decrets.map(d => { const cur = s.decrets[d.id]; const r = lvl => Math.round(clamp(d.risk[lvl] - s.juges * .04 - (T.cab(s, "justice", 3) - 65) * .003, .02, .9) * 100);
      return { k: "row", title: d.label, sub: cur ? (cur.bloque ? "Suspendu par un tribunal fédéral." : `Signé le ${frDate(cur.d)}, version ${["modérée", "ferme", "maximale"][cur.lvl]}.${cur.pending ? " Recours en cours d’examen." : ""}`) : `Risque de blocage : modéré ${r(0)} %, ferme ${r(1)} %, maximal ${r(2)} %.`, done: !!cur, ctrls: cur ? [] : [0, 1, 2].map(l => ({ k: "btn", act: "decret", arg: d.id + "|" + l, label: ["Modéré", "Ferme", "Maximal"][l] })) }; })] },
  { id: "cabinet", label: "Cabinet et nominations", cond: s => true, blocks: s => P(s) < 3 ? [{ k: "info", html: "Vous nommerez votre cabinet une fois investi." }] : [
    { k: "info", html: "Chaque nom a deux qualités : sa loyauté envers vous et sa compétence reconnue. Remplacer un ministre coûte du soutien au Congrès." },
    ...Object.entries(T.posts).map(([k, p]) => ({ k: "select", act: "nommer", arg: k, label: p.label, val: s.cabinet[k], options: p.list.filter(x => x[4] <= s.date || x[0] === s.cabinet[k]).map(x => [x[0], `${x[1]} · loyauté ${x[2]}, compétence ${x[3]}`]) }))] },
  { id: "diplomatie", label: "Diplomatie et armée", cond: s => true, blocks: s => P(s) < 3 ? [{ k: "info", html: "La diplomatie et le commandement des armées appartiennent au président en exercice." }] : [
    { k: "kpi", items: [["Relations internationales", Math.round(s.stats.international)], ["Secrétaire d’État", T.posts.etat.list.find(x => x[0] === s.cabinet.etat)[1]]] },
    ...["chine", "russie", "ukraine", "europe", "royaumeuni", "canada", "mexique", "israel", "arabie", "iran", "coree", "japon", "inde"].map(k => { const c = s.pays[k]; const st = worldMap.status(s, k);
      return { k: "row", title: T.regionName(k), badge: [worldMap.statusLabel[st], st === "allie" ? "allie" : st === "guerre" ? "ennemi" : st === "tendu" ? "rival" : "neutre"], rel: c.rel, sub: `Droits de douane : ${["aucun", "faibles", "élevés", "très élevés"][c.tarif || 0]} · présence militaire : ${["aucune", "permanente", "renforcée"][c.troupes || 0]}`,
        ctrls: [{ k: "btn", act: "sommet", arg: k, label: "Sommet", dis: once(s, "som" + k) || (s.wk["somW" + k] && s.week - s.wk["somW" + k] < 20 && "Trop récent") }, { k: "btn", act: "sanction", arg: k, label: "Sanctions", dis: once(s, "sanc" + k) }, { k: "btn", act: "tarif", arg: k, label: (c.tarif || 0) >= 3 ? "Lever les droits" : "Relever les droits" }, { k: "btn", act: "troupes", arg: k, label: (c.troupes || 0) >= 2 ? "Retirer les troupes" : "Renforcer les troupes" }] }; })] },
  { id: "campagne", label: "Campagne", cond: s => true, blocks: s => !s.running ? [{ k: "info", html: s.terms >= 2 ? "La Constitution limite la présidence à deux mandats." : "Vous n’êtes pas en campagne." }, ...(s.terms < 2 && (s.rank === "ancien" || s.rank === "prive" || (s.rank === "president" && s.terms === 1 && parseD(s.date).y % 4 >= 2)) ? [{ k: "btn", act: "candidater", label: "Déclarer sa candidature", cost: `Pour l’élection de ${Math.ceil((parseD(s.date).y + (parseD(s.date).m >= 11 ? 1 : 0)) / 4) * 4}`, confirm: true }] : [])] : [
    { k: "kpi", items: [["Scrutin", `novembre ${s.running}`], ["Projection", `${Object.keys(ST).reduce((t, k) => t + (T.margin(s, k) > 0 ? T.ev(s, k) : 0), 0)} grands électeurs`]] },
    { k: "select", act: "pol", arg: "theme", label: "Thème principal", val: s.pol.theme, options: [["economie", "Économie et emploi"], ["immigration", "Immigration et frontière"], ["securite", "Ordre et sécurité"], ["systeme", "Contre le système de Washington"]], note: "L’économie porte si elle va bien, et se retourne contre vous sinon." },
    note("pub", "Budget publicitaire", 0, 3, 1, lv(0, "Minimal", "Modeste", "Soutenu", "Massif"), (s, v) => `avance ${sg(v * .4)} point dans tous les États · fortune ${sg(-.01 * v, 2)} Md $/mois`)(s),
    { k: "select", act: "meeting", label: "Tenir un meeting dans un État disputé", val: "", options: [["", "Choisir un État…"], ...SWING.map(k => [k, `${ST[k][0]} · ${T.margin(s, k) >= 0 ? "R" : "D"} ${sg(Math.abs(T.margin(s, k))).slice(1)}`])], dis: once(s, "meeting"), note: "Un meeting par semaine : +1,2 point dans l’État, fatigue +6. L’effet s’estompe avec le temps." }] },
  { id: "famille", label: "Famille", cond: s => true, blocks: s => [
    { k: "table", title: "Les proches", rows: [["Épouse", "Melania Trump"], ["Enfants", "Donald Jr., Ivanka, Eric, Tiffany, Barron"]] },
    { k: "btn", act: "repos", label: "Un week-end de golf", cost: "Fatigue −12, stress −8", dis: once(s, "repos") }, { k: "btn", act: "famille", label: "Dîner en famille", cost: "Stress −5", dis: once(s, "famille") }] },
  { id: "image", label: "Communication", cond: s => true, blocks: s => [
    { k: "select", act: "pol", arg: "ton", label: "Ton public", val: s.pol.ton, options: [[0, "Présidentiel et mesuré"], [1, "Direct"], [2, "Offensif"]], note: "Le ton offensif soude la base et durcit la couverture médiatique." },
    note("reseaux", "Présence sur les réseaux", 0, 3, 1, lv(0, "Rare", "Occasionnelle", "Quotidienne", "Permanente"), (s, v) => `hostilité des médias ${sg(v * 2)} · fatigue ${sg(v * .6)}/mois`)(s),
    { k: "btn", act: "write", arg: "post", label: "Publier un message", cost: "Compte comme l’action de la semaine" }, { k: "btn", act: "write", arg: "interview", label: "Accorder une interview", cost: "Compte comme l’action de la semaine" }, { k: "btn", act: "write", arg: "discours", label: "Prononcer un discours", cost: "Compte comme l’action de la semaine" }] },
  { id: "budget", label: "Budget et économie", cond: s => true, blocks: s => P(s) < 3 ? [{ k: "info", html: "Le budget fédéral dépend du président et du Congrès. Vous pourrez agir une fois investi." }] : [
    { k: "info", html: `Chaque réglage est une proposition au Congrès : avec un soutien de ${Math.round(s.stats.congres)} sur 100, ${s.stats.congres >= 50 ? "elle passe" : "elle est en partie bloquée, et ses effets sont réduits"}.` },
    note("impots", "Impôts", -2, 2, 1, lv(2, "Forte baisse", "Baisse", "Inchangés", "Hausse", "Forte hausse"), (s, v) => `économie visée ${sg(-v * 2.5)} · recettes ${sg(v * 6, 0)} %`)(s),
    note("douanes", "Droits de douane", 0, 4, 1, lv(0, "Aucun droit nouveau", "Ciblés", "Larges", "Généralisés", "Maximaux"), (s, v) => `économie visée ${sg(-v * 3)} · base ${sg(v)} · relations internationales ${sg(-v * 3)} · recettes +${v * 9} Md $/mois`)(s),
    note("defense", "Budget de la défense", 0, 2, 1, lv(0, "Réduit", "Stable", "En hausse"), (s, v) => `dépenses de défense ${sg((v - 1) * 10, 0)} %`)(s),
    note("social", "Retraites et santé", 0, 2, 1, lv(0, "Économies", "Inchangées", "Élargies"), (s, v) => `dépenses ${sg((v - 1) * 5, 0)} % · popularité ${["en baisse", "stable", "en hausse"][v]}`)(s),
    note("frontiere", "Crédits pour la frontière", 0, 2, 1, lv(0, "Réduits", "Stables", "Renforcés"), (s, v) => `base ${sg(v * 2)}`)(s),
    note("energie", "Politique énergétique", 0, 2, 1, lv(0, "Priorité au climat", "Équilibrée", "Priorité aux hydrocarbures"), (s, v) => `économie visée ${sg((v - 1) * 1.5)}`)(s),
    { k: "btn", act: "fed", label: "Presser la banque centrale de baisser ses taux", cost: "Bourse en hausse, crédibilité en baisse", dis: once(s, "fed") || (s.wk.fedW && s.week - s.wk.fedW < 12 && "Trop récent") }] }
];
T.windows = { general: ["cabinet", "diplomatie", "campagne", "famille"], pouvoir: "decrets", medias: "image", economie: "budget" };
T.views = [{ id: "general", label: "Vue générale", icon: "general", kind: "general" }, { id: "pouvoir", label: "Pouvoir", icon: "armee", kind: "board" }, { id: "medias", label: "Médias", icon: "presse", kind: "presse" }, { id: "economie", label: "Économie", icon: "finances", kind: "finances" }, { id: "messages", label: "Messages", icon: "corr", kind: "corr" }];

T.act = (s, act, arg, val) => {
  const fx = o => GAME.applyFx(s, o); const use = id => { s.wk[id] = s.week; };
  switch (act) {
    case "pol": s.pol[arg] = isNaN(+val) ? val : +val; return {};
    case "decret": { const [id, l] = arg.split("|"); const d = T.decrets.find(x => x.id === id); const lvl = +l; const risk = clamp(d.risk[lvl] - s.juges * .04 - (T.cab(s, "justice", 3) - 65) * .003, .02, .9); s.decrets[id] = { lvl, d: s.date, pending: true }; fx({ s: d.fx[lvl] });
      const blocked = Math.random() < risk; const inv = {}; for (const [k, v] of Object.entries(d.fx[lvl])) inv[k] = -v * .7;
      s.deferred.push({ date: addDays(s.date, (2 + Math.floor(Math.random() * 5)) * 7), title: blocked ? `Un juge fédéral suspend le décret : ${d.label.toLowerCase()}` : `Les tribunaux laissent s’appliquer le décret : ${d.label.toLowerCase()}`, text: blocked ? "Le gouvernement fait appel ; en attendant, le texte ne s’applique plus." : "Les recours sont rejetés à ce stade.", fx: blocked ? { s: { ...inv, justice: 5, medias: 3 }, call: { fn: "block", id } } : { s: { justice: -1 }, call: { fn: "clear", id } }, src: "Dépêche d’agence", from: null });
      GAME.news(s, { src: "Dépêche d’agence", title: `Le président signe un décret : ${d.label.toLowerCase()}`, text: `Version ${["modérée", "ferme", "maximale"][lvl]}. Des associations et des États annoncent des recours.`, ton: "neu" }); return { toast: "Décret signé. Les recours sont déposés.", sfx: "paper" }; }
    case "nommer": { const p = T.posts[arg]; const o = p.list.find(x => x[0] === val); if (!o || val === s.cabinet[arg]) return {}; s.cabinet[arg] = val; fx({ s: { congres: -3, medias: 2 } }); return { msg: `${p.label} : ${o[1]} est nommé.`, src: "Dépêche d’agence", sfx: "paper" }; }
    case "sommet": { use("som" + arg); s.wk["somW" + arg] = s.week; const g = Math.round((6 + Math.random() * 8) * (.6 + T.cab(s, "etat", 3) / 160)); s.pays[arg].rel = clamp(s.pays[arg].rel + g, -100, 100); fx({ s: { international: s.pays[arg].rel < -20 ? -1 : 2, fatigue: 5 } }); return { msg: `Sommet avec ${T.regionName(arg)} : relation ${sg(g, 0)}.`, src: "Dépêche d’agence" }; }
    case "sanction": use("sanc" + arg); s.pays[arg].rel = clamp(s.pays[arg].rel - 12, -100, 100); fx({ s: { base: 1, international: s.pays[arg].rel > 20 ? -3 : 0 } }); return { msg: `Sanctions annoncées : ${T.regionName(arg)}.`, src: "Dépêche d’agence" };
    case "tarif": { const c = s.pays[arg]; if ((c.tarif || 0) >= 3) { c.tarif = 0; c.rel = clamp(c.rel + 8, -100, 100); fx({ s: { bourse: 60 } }); return { msg: `Droits de douane levés : ${T.regionName(arg)}.`, src: "Dépêche d’agence" }; } c.tarif = (c.tarif || 0) + 1; c.rel = clamp(c.rel - 8, -100, 100); fx({ s: { bourse: -70, base: 1 } }); return { msg: `Droits de douane relevés : ${T.regionName(arg)}.`, src: "Dépêche d’agence" }; }
    case "troupes": { const c = s.pays[arg]; if ((c.troupes || 0) >= 2) { c.troupes = 0; fx({ s: { base: 2, international: -3 } }); return { msg: `Retrait des forces américaines : ${T.regionName(arg)}.`, src: "Dépêche d’agence" }; } c.troupes = (c.troupes || 0) + 1; fx({ s: { international: 1, base: -1 } }); return { msg: `Présence militaire renforcée : ${T.regionName(arg)}.`, src: "Dépêche d’agence" }; }
    case "meeting": { const k = val || arg; if (!ST[k] || !s.running) return { msg: "Les meetings s’ouvrent pendant une campagne.", tone: "bad" }; if (s.wk.meeting === s.week) return { msg: "Un meeting par semaine.", tone: "bad" }; use("meeting"); s.bonus[k] = Math.min(4, (s.bonus[k] || 0) + 1.2); fx({ s: { fatigue: 6, base: .5 } }); return { msg: `Meeting : ${ST[k][0]}. Avance locale ${sg(1.2)} point.`, sfx: "crowd" }; }
    case "candidater": { const y = Math.ceil((parseD(s.date).y + (parseD(s.date).m >= 11 ? 1 : 0)) / 4) * 4; s.running = y; s.bonus = {}; if (s.rank === "prive") s.rank = "candidat"; fx({ s: { base: 4, medias: 4 } }); s.history.push({ date: s.date, id: "cand" + y, kind: "saison", title: "Candidature", choice: `Candidat pour ${y}`, hist: null, histExists: false, outcome: "" }); return { msg: `Vous êtes candidat à l’élection de ${y}.`, src: "Dépêche d’agence", sfx: "crowd" }; }
    case "fed": use("fed"); s.wk.fedW = s.week; fx({ s: { bourse: 70, international: -1, medias: 2 } }); return { msg: "La pression sur la banque centrale fait monter les marchés et grincer les économistes.", src: "Dépêche d’agence" };
    case "repos": use("repos"); fx({ s: { fatigue: -12, stress: -8, medias: 1 } }); return { msg: "Deux jours sur le parcours de golf." };
    case "famille": use("famille"); fx({ s: { stress: -5 }, r: { melania: 2, ivanka: 1 } }); return { msg: "Un dîner en famille." };
  }
  return {};
};
const fxc = T.fxCall; T.fxCall = (s, c, out) => { if (c.fn === "block" && s.decrets[c.id]) { s.decrets[c.id].bloque = true; s.decrets[c.id].pending = false; } else if (c.fn === "clear" && s.decrets[c.id]) s.decrets[c.id].pending = false; else fxc(s, c, out); };

/* ---------------- Parole ---------------- */
const canPost = s => s.date < "2021-01-08" || s.date >= "2022-02-21";
T.speech = [
  { id: "post", label: "Message sur les réseaux", hint: "Un message public, sur le réseau que vous utilisez à cette date.", ph: "Ex. : Excellente réunion avec les sénateurs ce matin. La loi sera votée cette semaine !", photo: true, cond: canPost },
  { id: "discours", label: "Discours ou meeting", hint: "Une allocution devant le public, le Congrès ou la nation.", ph: "Ex. : Ce soir, depuis le Bureau ovale, j’annonce…" },
  { id: "conference", label: "Conférence de presse", hint: "Déclaration et réponses aux journalistes.", ph: "Ex. : Nous avons conclu un accord commercial. Voici ce qu’il contient…" },
  { id: "interview", label: "Interview", hint: "Un journaliste pose deux ou trois questions.", ph: "", flow: "interview" },
  { id: "communique", label: "Communiqué officiel", hint: "Texte diffusé par la Maison-Blanche ou par votre équipe de campagne.", ph: "Ex. : Le président a signé aujourd’hui…" },
  { id: "ordre", label: "Ordre présidentiel", hint: "Une décision relevant des pouvoirs du président : nomination, grâce, veto, ordre aux armées.", ph: "Ex. : J’oppose mon veto à la loi de finances telle qu’elle a été votée…", cond: s => P(s) >= 3 },
  { id: "rumeur", label: "Information glissée à la presse", hint: "Un proche fait passer un message à un journaliste.", ph: "Ex. : Faire savoir que le président envisage de remplacer son secrétaire d’État…" }
];
T.advisors = [{ name: "le chef de cabinet", role: "chef de cabinet", style: "organisé, protecteur de l’agenda, attentif au Congrès, aux sondages et aux risques juridiques" }];
T.advisor = s => ({ ...T.advisors[0], name: P(s) >= 3 ? T.posts.chef.list.find(x => x[0] === s.cabinet.chef)[1] : s.date < "2017-01-01" ? "Kellyanne Conway" : "Susie Wiles", role: P(s) >= 3 ? "chef de cabinet" : "direction de campagne" });
T.newsSources = s => ["Associated Press", "Reuters", "The New York Times", "The Wall Street Journal", "Fox News", "CNN", "Politico", "Réseaux sociaux : partisans", "Réseaux sociaux : opposants", "Rumeur de Washington"];
T.newsCat = src => { const x = String(src || "").toLowerCase(); if (/carnet|conséquence/.test(x)) return "sys"; if (/rumeur|couloir/.test(x)) return "rum"; if (/réseau|twitter|truth|\bx\b|partisan|opposant|forum/.test(x)) return "etr"; return "fr"; };
T.pressCats = [["tous", "Tout"], ["fr", "Presse et agences"], ["etr", "Réseaux sociaux"], ["rum", "Rumeurs de Washington"], ["sys", "Carnet"]];
T.tonLabel = { fav: "Favorable", neu: "Neutre", hos: "Critique" };
T.publicLabel = "Dans le pays";
T.press = (s, kind, d) => { if (kind !== "evenement") return []; const a = [{ src: "Associated Press", ton: "neu", title: d.title, text: d.res || "" }, { src: "Réseaux sociaux : partisans", ton: "fav", title: "Ses soutiens applaudissent", text: "Le message est massivement relayé dans son camp." }, { src: "Réseaux sociaux : opposants", ton: "hos", title: "Ses adversaires dénoncent", text: "Les élus démocrates réagissent en quelques minutes." }]; for (const x of [...a].reverse()) GAME.news(s, x); return a; };
T.aiState = s => `SITUATION POLITIQUE : ${GAME.rankLabel(s)} ; mandats exercés : ${s.terms}${s.running ? ` ; en campagne pour ${s.running}` : ""}. Chambre : majorité ${s.house === "R" ? "républicaine" : "démocrate"} ; Sénat : majorité ${s.senate === "R" ? "républicaine" : "démocrate"}. Dette fédérale : ${s.dette.toFixed(1)} billions de dollars. Décrets signés ce mandat : ${Object.entries(s.decrets).map(([k, d]) => T.decrets.find(x => x.id === k).label + (d.bloque ? " (suspendu)" : "")).join(", ") || "aucun"}. Réglages : impôts ${s.pol.impots}, droits de douane ${s.pol.douanes}/4. Réseau disponible à cette date : ${s.date < "2021-01-08" ? "Twitter" : s.date < "2022-02-21" ? "aucun grand réseau (comptes suspendus)" : s.date < "2024-08-12" ? "Truth Social" : "Truth Social et X"}.`;

/* ---------------- Messages ---------------- */
T.persona = { melania: "épouse réservée, protectrice de son fils, peu de mots", ivanka: "fille posée, soucieuse d’image et de modération", donjr: "fils combatif, proche de la base militante", kushner: "gendre discret, négociateur, pense transactions", pence: "vice-président loyal et conservateur religieux, formel", vance: "vice-président jeune, idéologue, loyal", bannon: "stratège nationaliste, tranchant, pense rapport de forces", mcconnell: "tacticien du Sénat, laconique, attaché aux juges et à la procédure", ryan: "conservateur budgétaire, poli, mal à l’aise avec le style", johnson: "président de la Chambre loyal, juriste, prudent", pelosi: "adversaire démocrate chevronnée, ferme, institutionnelle", schumer: "adversaire démocrate, négociateur, new-yorkais", clinton: "adversaire, formelle et distante", obama: "prédécesseur, courtois et distant", biden: "adversaire, ton traditionnel de Washington", harris: "adversaire, formelle", musk: "entrepreneur imprévisible, obsédé par l’efficacité et la technologie", xi: "dirigeant chinois, formules diplomatiques, intérêts de long terme, par voie officielle", poutine: "dirigeant russe, froid, parle rapport de forces, par voie officielle", kim: "dirigeant nord-coréen, flatteur dans la forme, inflexible sur son arsenal", macron: "président français, chaleureux dans la forme, défend le multilatéralisme", merkel: "chancelière allemande, sobre, factuelle, attachée aux règles", netanyahou: "premier ministre israélien, allié, insiste sur l’Iran", zelensky: "président ukrainien, direct, demande des armes et des garanties" };
T.contactGroups = [["Famille", ["melania", "ivanka", "donjr", "kushner"]], ["Entourage et parti", ["pence", "vance", "bannon", "mcconnell", "ryan", "johnson", "musk"]], ["Opposition", ["pelosi", "schumer", "clinton", "obama", "biden", "harris"]], ["Dirigeants étrangers", ["xi", "poutine", "kim", "macron", "merkel", "netanyahou", "zelensky"]]];
T.contactLoc = () => "ligne"; T.mailDays = () => 0; const _rn = T.regionName; T.regionName = id => id === "ligne" ? "par message" : _rn(id);
T.mailScripts = [{ id: "ivanka", t: "Papa, les sondages auprès des femmes des banlieues restent faibles. Un message sur les familles aiderait." }, { id: "mcconnell", t: "Le calendrier du Sénat est serré. Dites-moi vos trois priorités, je vous dirai ce qui peut passer." }, { id: "donjr", t: "La base est à fond derrière toi. Ne lâche rien." }, { id: "kushner", t: "J’ai un canal ouvert au Proche-Orient. Si tu veux un accord, c’est le moment d’en parler." }, { id: "melania", t: "Pense à te reposer ce week-end." }];
T.mailFallback = (s, id) => (s.rel[id] || 0) >= 40 ? "Bien reçu. Je m’en occupe et je vous rappelle." : (s.rel[id] || 0) >= -15 ? "Message reçu. Mes équipes reviendront vers les vôtres." : "J’ai pris connaissance de votre message.";

T.rivals = [
  { id: "democrates", name: "Les démocrates", plans: [{ plan: "Bloquer l’agenda au Congrès", news: ["Les démocrates annoncent une obstruction au Sénat", "L’opposition dépose des centaines d’amendements"], done: { s: { congres: -5 } }, title: "L’opposition fait échouer un vote clé" }, { plan: "Ouvrir des enquêtes parlementaires", news: ["Une commission de la Chambre convoque des conseillers", "Les démocrates réclament des documents"], done: { s: { justice: 6, medias: 3 } }, title: "Une commission d’enquête rend ses conclusions" }] },
  { id: "chine", name: "Pékin", plans: [{ plan: "Riposter aux droits de douane", news: ["Pékin taxe le soja américain", "La Chine restreint ses exportations de terres rares"], done: { s: { economie: -2, bourse: -90 }, pays: { chine: { rel: -6 } } }, title: "La riposte commerciale chinoise touche les fermiers américains" }] },
  { id: "rivalinterne", name: "Les rivaux du parti", plans: [{ plan: "Préparer l’après et se démarquer", news: ["Un gouverneur républicain prend ses distances", "Des sénateurs critiquent la ligne commerciale"], done: { s: { base: -3, congres: -3 } }, title: "Des républicains votent contre la Maison-Blanche" }] }
];
T.audio = { tempo: 96, root: 130.81, scale: [0, 2, 4, 7, 9], style: "marche" };
T.endTiles = (s, x) => [["Mandats exercés", String(s.terms), "Réalité : 2, non consécutifs"], ["Popularité finale", `${Math.round(s.stats.approbation)} %`, "Réalité : entre 35 et 49 % selon les périodes"], ["Dernier scrutin", s.lastVote ? `${s.lastVote.ev} grands électeurs` : "—", "Réalité : 304 (2016), 232 (2020), 312 (2024)"], ["Décrets suspendus", String(Object.values(s.decrets).filter(d => d.bloque).length), "Sur le dernier mandat"], ["Fidélité à la réalité", `${x.fidelity} %`, `${x.same} choix sur ${x.total} comme dans la réalité`]];
})();
</script>
