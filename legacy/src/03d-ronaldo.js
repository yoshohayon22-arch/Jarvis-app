<script>
"use strict";
/* =====================================================================
   CRISTIANO RONALDO — personne réelle et vivante : uniquement des faits
   publics de carrière, aucune citation inventée, rien sur la vie intime.
   Même forme de données que Napoléon ; le moteur et l’interface sont communs.
   ===================================================================== */
(function(){
const P = s => GAME.power(s);
const ME = v => `${v >= 100 ? Math.round(v) : (Math.round(v * 10) / 10).toString().replace(".", ",")} M €`;
const sg = (v, d = 1) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(d).replace(".", ",")}`;
const rnd = (a, b) => a + Math.random() * (b - a);
const pois = l => { let L = Math.exp(-Math.max(0, l)), k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return k - 1; };
const doy = (m, d) => [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334][m - 1] + d;
const inWin = (date, m, d) => { const p = parseD(date); let x = doy(p.m, p.d) - doy(m, d); if (x < -300) x += 365; return x >= 0 && x < 7; };
const between = (date, m1, d1, m2, d2) => { const p = parseD(date); const x = doy(p.m, p.d), a = doy(m1, d1), b = doy(m2, d2); return a <= b ? (x >= a && x <= b) : (x >= a || x <= b); };

/* ---------------- Clubs et championnats ---------------- */
const CLUBS = {
  sporting: { n: "Sporting CP", sh: "SC", reg: "portugal", lg: "pt", st: 75, col: ["#1f8a4c", "#ffffff"] }, benfica: { n: "Benfica", sh: "BE", reg: "portugal", lg: "pt", st: 77 }, porto: { n: "FC Porto", sh: "PO", reg: "portugal", lg: "pt", st: 78 },
  manutd: { n: "Manchester United", sh: "MU", reg: "angleterre", lg: "pl", st: 86, col: ["#c8102e", "#ffffff"] }, arsenal: { n: "Arsenal", sh: "AR", reg: "angleterre", lg: "pl", st: 84 }, chelsea: { n: "Chelsea", sh: "CH", reg: "angleterre", lg: "pl", st: 85 }, liverpool: { n: "Liverpool", sh: "LI", reg: "angleterre", lg: "pl", st: 85 }, mancity: { n: "Manchester City", sh: "MC", reg: "angleterre", lg: "pl", st: 86, from: 2009, col: ["#6cabdd", "#ffffff"] }, tottenham: { n: "Tottenham", sh: "TO", reg: "angleterre", lg: "pl", st: 80 },
  real: { n: "Real Madrid", sh: "RM", reg: "espagne", lg: "es", st: 90, col: ["#f4f4f4", "#1a2a55"] }, barcelona: { n: "FC Barcelone", sh: "BA", reg: "espagne", lg: "es", st: 90 }, atletico: { n: "Atlético de Madrid", sh: "AT", reg: "espagne", lg: "es", st: 84 }, valencia: { n: "Valence CF", sh: "VA", reg: "espagne", lg: "es", st: 79 }, sevilla: { n: "Séville FC", sh: "SE", reg: "espagne", lg: "es", st: 79 },
  juve: { n: "Juventus", sh: "JU", reg: "italie", lg: "it", st: 85, col: ["#111111", "#f4f4f4"] }, inter: { n: "Inter", sh: "IN", reg: "italie", lg: "it", st: 84 }, milan: { n: "AC Milan", sh: "MI", reg: "italie", lg: "it", st: 83 }, napoli: { n: "Naples", sh: "NA", reg: "italie", lg: "it", st: 81 }, roma: { n: "AS Rome", sh: "RO", reg: "italie", lg: "it", st: 79 },
  bayern: { n: "Bayern Munich", sh: "BY", reg: "allemagne", lg: "de", st: 89 }, dortmund: { n: "Borussia Dortmund", sh: "DO", reg: "allemagne", lg: "de", st: 82 },
  psg: { n: "Paris Saint-Germain", sh: "PS", reg: "france", lg: "fr", st: 86, from: 2012, col: ["#1b2a4a", "#d0202e"] }, lyon: { n: "Olympique lyonnais", sh: "OL", reg: "france", lg: "fr", st: 78 },
  alnassr: { n: "Al-Nassr", sh: "AN", reg: "arabie", lg: "sa", st: 68, from: 2022, col: ["#f2c20c", "#17338a"] }, alhilal: { n: "Al-Hilal", sh: "AH", reg: "arabie", lg: "sa", st: 71, from: 2022 }, alittihad: { n: "Al-Ittihad", sh: "AI", reg: "arabie", lg: "sa", st: 67, from: 2022 }, alahli: { n: "Al-Ahli", sh: "AA", reg: "arabie", lg: "sa", st: 65, from: 2023 },
  intermiami: { n: "Inter Miami", sh: "IM", reg: "usa", lg: "us", st: 62, from: 2020, col: ["#f5b5c8", "#111111"] }
};
const LEAGUES = {
  pl: { n: "Premier League", m: 38, oth: 70, others: ["Everton", "Aston Villa", "Newcastle", "West Ham", "Fulham", "Blackburn", "Bolton", "Middlesbrough", "Southampton", "Leicester", "Crystal Palace", "Wolverhampton", "Brighton", "Sunderland"], cup: "Coupe d’Angleterre" },
  es: { n: "Liga", m: 38, oth: 71, others: ["Athletic Bilbao", "Villarreal", "Real Sociedad", "Betis", "Getafe", "Espanyol", "Málaga", "Celta Vigo", "Osasuna", "Levante", "Majorque", "La Corogne", "Saragosse", "Grenade"], cup: "Coupe du Roi" },
  it: { n: "Serie A", m: 38, oth: 70, others: ["Lazio", "Atalanta", "Fiorentina", "Torino", "Sassuolo", "Bologne", "Udinese", "Sampdoria", "Genoa", "Cagliari", "Parme", "Vérone", "Empoli"], cup: "Coupe d’Italie" },
  sa: { n: "Saudi Pro League", m: 34, oth: 54, others: ["Al-Shabab", "Al-Ettifaq", "Al-Taawoun", "Al-Fateh", "Al-Fayha", "Damac", "Al-Raed", "Al-Khaleej", "Al-Riyadh", "Al-Wehda", "Abha", "Al-Hazem", "Al-Qadsiah"], cup: "Coupe du Roi d’Arabie", asia: true },
  pt: { n: "Liga Portugal", m: 34, oth: 64, others: ["Braga", "Vitória Guimarães", "Boavista", "Marítimo", "Nacional", "Belenenses", "Rio Ave", "Estoril", "Famalicão", "Gil Vicente", "Arouca", "Moreirense", "Casa Pia"], cup: "Coupe du Portugal" },
  de: { n: "Bundesliga", m: 34, oth: 72, others: ["Bayer Leverkusen", "Schalke 04", "Werder Brême", "Stuttgart", "Wolfsburg", "Mönchengladbach", "Francfort", "Hambourg", "Leipzig", "Hoffenheim", "Fribourg", "Mayence"], cup: "Coupe d’Allemagne" },
  fr: { n: "Ligue 1", m: 34, oth: 70, others: ["Marseille", "Monaco", "Lille", "Rennes", "Nice", "Bordeaux", "Saint-Étienne", "Lens", "Nantes", "Toulouse", "Montpellier", "Strasbourg"], cup: "Coupe de France" },
  us: { n: "Major League Soccer", m: 34, oth: 58, others: ["LA Galaxy", "LAFC", "Seattle Sounders", "Atlanta United", "New York City FC", "Columbus Crew", "Orlando City", "Toronto FC", "Portland Timbers", "Philadelphia Union", "FC Cincinnati", "Nashville SC"], cup: "Coupe des États-Unis", noEurope: true }
};
const EURO_OPP = ["bayern", "barcelona", "real", "manutd", "chelsea", "liverpool", "juve", "inter", "milan", "psg", "atletico", "arsenal", "dortmund", "porto", "benfica", "lyon", "mancity", "napoli", "roma", "sevilla", "valencia", "tottenham"];
const ASIA_OPP = ["Al-Ain", "Persépolis", "Al-Sadd", "Al-Duhail", "Pakhtakor", "Al-Rayyan", "Istiklol", "Sharjah"];
const NAT_OPP = [["Espagne", 88], ["France", 88], ["Allemagne", 87], ["Angleterre", 85], ["Italie", 85], ["Pays-Bas", 84], ["Belgique", 84], ["Croatie", 83], ["Brésil", 89], ["Argentine", 88], ["Uruguay", 83], ["Suisse", 80], ["Danemark", 80], ["Suède", 79], ["Maroc", 80], ["Ghana", 76], ["République tchèque", 78], ["Pologne", 78], ["Hongrie", 75], ["Turquie", 78], ["Serbie", 78], ["Irlande", 74], ["Islande", 73], ["Slovaquie", 74], ["Luxembourg", 62], ["Azerbaïdjan", 62], ["Lettonie", 60], ["Estonie", 60], ["Arménie", 64], ["Bosnie-Herzégovine", 74]];
const COACH = {
  manutd: [[2003, "Sir Alex Ferguson"], [2013, "David Moyes"], [2014, "Louis van Gaal"], [2016, "José Mourinho"], [2019, "Ole Gunnar Solskjær"], [2022, "Erik ten Hag"], [2025, "Rúben Amorim"]],
  real: [[2003, "l’entraîneur"], [2009, "Manuel Pellegrini"], [2010, "José Mourinho"], [2013, "Carlo Ancelotti"], [2015, "Rafael Benítez"], [2016, "Zinédine Zidane"], [2018, "Julen Lopetegui"], [2019, "Zinédine Zidane"], [2021, "Carlo Ancelotti"], [2025, "Xabi Alonso"]],
  juve: [[2003, "l’entraîneur"], [2014, "Massimiliano Allegri"], [2019, "Maurizio Sarri"], [2020, "Andrea Pirlo"], [2021, "Massimiliano Allegri"], [2024, "Thiago Motta"]],
  alnassr: [[2022, "Rudi Garcia"], [2023, "Luís Castro"], [2024, "Stefano Pioli"], [2025, "Jorge Jesus"]],
  portugal: [[2003, "Luiz Felipe Scolari"], [2008, "Carlos Queiroz"], [2010, "Paulo Bento"], [2014, "Fernando Santos"], [2023, "Roberto Martínez"]]
};
const coachOf = (club, y) => { const t = COACH[club]; if (!t) return "l’entraîneur"; let n = t[0][1]; for (const [yy, nm] of t) if (y >= yy) n = nm; return n; };
const TOURS = y => y === 2021 ? "Euro 2020" : y === 2022 ? "Coupe du monde 2022" : y % 4 === 0 && y !== 2020 ? `Euro ${y}` : (y - 2) % 4 === 0 && y !== 2022 ? `Coupe du monde ${y}` : null;
const seasonY = date => { const p = parseD(date); return p.m >= 7 ? p.y : p.y - 1; };

const R = CHARACTERS.ronaldo = {
  id: "ronaldo", name: "Cristiano Ronaldo", short: "Ronaldo", role: "Footballeur", theme: "theme-stade",
  art: "linear-gradient(160deg,#16324a,#0a1420)", born: "1985-02-05", birthplace: "Funchal, Madère", unit: { label: "semaine", days: 7 },
  portrait: s => ART.footballer({ age: s ? GAME.age(s) : 18, col: s && s.club && CLUBS[s.club].col ? CLUBS[s.club].col : s && !s.club ? ["#2b3340", "#d9dee6"] : ["#c8102e", "#ffffff"] }),
  realStatus: { title: "Sa carrière réelle (à la mi-2026)", text: "Cinq Ballons d’or (2008, 2013, 2014, 2016, 2017), cinq Ligues des champions (2008, 2014, 2016, 2017, 2018), l’Euro 2016, deux Ligues des nations (2019, 2025), plus de 900 buts officiels et le record de buts et de sélections en équipe nationale. À 41 ans, il joue toujours à Al-Nassr." },
  realTimeline: "Formé au Sporting, révélé à Manchester United, légende du Real Madrid, puis la Juventus, un retour à Manchester et l’Arabie saoudite.",
  histLabel: "Moment de carrière", accidentCause: "Mort dans un accident de la route.", suddenCause: "Mort subitement d’un arrêt cardiaque", mortality: .4,
  groups: { carriere: "Carrière", vie: "Santé" },
  stats: [
    { id: "forme", label: "Forme physique", group: "carriere", min: 0, max: 100, bad: "low", aiMax: 10, hint: "Fraîcheur et condition du moment" },
    { id: "niveau", label: "Niveau de jeu", group: "carriere", min: 30, max: 99, bad: "low", aiMax: 3, hint: "Qualité globale du joueur" },
    { id: "popularite", label: "Popularité", group: "carriere", min: 0, max: 100, bad: "low", aiMax: 10, hint: "Image auprès du public mondial" },
    { id: "coach", label: "Relation avec le coach", group: "carriere", min: 0, max: 100, bad: "low", aiMax: 12, hint: "Confiance de l’entraîneur" },
    { id: "vestiaire", label: "Vestiaire", group: "carriere", min: 0, max: 100, bad: "low", aiMax: 12, hint: "Entente avec les coéquipiers" },
    { id: "valeur", label: "Valeur marchande", group: "carriere", min: 0, max: 250, barMax: 150, fmt: ME, bad: "low", warn: 15, danger: 5, aiMax: 12, hint: "Estimation du marché des transferts" },
    { id: "fortune", label: "Fortune", group: "carriere", min: -50, max: 5000, barMax: 1000, fmt: ME, bad: "low", warn: 1, danger: 0, aiMax: 25, hint: "Patrimoine disponible" },
    { id: "abonnes", label: "Abonnés", group: "carriere", min: 0, max: 1500, barMax: 1000, fmt: v => `${Math.round(v)} M`, bad: "low", warn: -1, danger: -1, aiMax: 15, hint: "Abonnés cumulés sur les réseaux, en millions" },
    { id: "sante", label: "Santé", group: "vie", min: 0, max: 100, bad: "low", aiMax: 6, hint: "État général du corps" },
    { id: "fatigue", label: "Fatigue", group: "vie", min: 0, max: 100, bad: "high", aiMax: 12, hint: "Charge des matchs et des entraînements" },
    { id: "stress", label: "Stress", group: "vie", min: 0, max: 100, bad: "high", aiMax: 12, hint: "Pression médiatique et sportive" }
  ],
  ranks: { joueur: { label: "Footballeur professionnel", power: 2 }, libre: { label: "Joueur sans club", power: 1 }, retraite: { label: "Retraité des terrains", power: 0 } },
  rankLabel: s => s.rank === "retraite" ? "Retraité des terrains" : s.club ? `${CLUBS[s.club].n} · n° ${s.flags.num28 ? 28 : 7}` : "Sans club",
  statusLabel: s => s.rank === "retraite" ? "Retraité" : s.injury ? `Blessé : ${s.injury.w} sem.` : !s.club ? "Sans club" : "Apte",

  relations: [
    { id: "dolores", name: "Dolores Aveiro", role: "Mère", bio: "Elle a élevé quatre enfants à Funchal. Présente à tous les grands rendez-vous.", from: "1985-01-01", start: 85 },
    { id: "katia", name: "Katia Aveiro", role: "Sœur", bio: "Chanteuse, première supportrice de son frère.", from: "1985-01-01", start: 75 },
    { id: "mendes", name: "Jorge Mendes", role: "Agent", bio: "Le plus puissant des agents portugais. Il négocie contrats et transferts.", from: "2002-01-01", start: 75 },
    { id: "ferguson", name: "Sir Alex Ferguson", role: "Entraîneur de Manchester United (1986-2013)", bio: "Le manager qui l’a fait venir en Angleterre à 18 ans et lui a confié le numéro 7.", from: "2003-08-01", start: 65 },
    { id: "scolari", name: "Luiz Felipe Scolari", role: "Sélectionneur du Portugal (2003-2008)", bio: "Champion du monde avec le Brésil, il lance le jeune ailier en sélection.", from: "2003-08-01", start: 60 },
    { id: "rooney", name: "Wayne Rooney", role: "Coéquipier à Manchester United", bio: "Arrivé à Manchester en 2004, partenaire d’attaque pendant cinq saisons.", from: "2004-08-31", start: 55 },
    { id: "messi", name: "Lionel Messi", role: "Le grand rival", bio: "L’Argentin du FC Barcelone, avec qui il se partage les Ballons d’or pendant plus de dix ans.", from: "2005-01-01", start: -10 },
    { id: "pepe", name: "Pepe", role: "Coéquipier au Real Madrid et en sélection", bio: "Défenseur central, compagnon de route en club et avec le Portugal.", from: "2007-07-01", start: 65 },
    { id: "perez", name: "Florentino Pérez", role: "Président du Real Madrid", bio: "L’homme des « Galactiques », qui paie 94 millions d’euros en 2009.", from: "2009-06-01", start: 50 },
    { id: "ramos", name: "Sergio Ramos", role: "Coéquipier et capitaine au Real Madrid", bio: "Défenseur, capitaine, buteur des fins de match.", from: "2009-07-01", start: 50 },
    { id: "marcelo", name: "Marcelo", role: "Coéquipier au Real Madrid", bio: "Latéral gauche brésilien, complice sur le terrain.", from: "2009-07-01", start: 70 },
    { id: "benzema", name: "Karim Benzema", role: "Coéquipier au Real Madrid", bio: "Arrivé le même été 2009, avant-centre au service du collectif.", from: "2009-07-01", start: 55 },
    { id: "mourinho", name: "José Mourinho", role: "Entraîneur", bio: "Entraîneur portugais, au Real Madrid de 2010 à 2013.", from: "2010-06-01", start: 50 },
    { id: "ancelotti", name: "Carlo Ancelotti", role: "Entraîneur", bio: "Entraîneur italien, au Real Madrid à partir de 2013 : la « Décima » en 2014.", from: "2013-06-25", start: 60 },
    { id: "santos", name: "Fernando Santos", role: "Sélectionneur du Portugal (2014-2022)", bio: "Le sélectionneur de l’Euro 2016.", from: "2014-09-23", start: 65 },
    { id: "zidane", name: "Zinédine Zidane", role: "Entraîneur du Real Madrid", bio: "Trois Ligues des champions de suite comme entraîneur, de 2016 à 2018.", from: "2016-01-04", start: 65 },
    { id: "georgina", name: "Georgina Rodríguez", role: "Compagne", bio: "Rencontrée à Madrid en 2016.", from: "2016-11-01", start: 85 },
    { id: "mbappe", name: "Kylian Mbappé", role: "La relève", bio: "L’attaquant français de la génération suivante, qui a grandi avec ses posters.", from: "2017-01-01", start: 20 },
    { id: "bruno", name: "Bruno Fernandes", role: "Coéquipier en sélection et à Manchester United", bio: "Milieu offensif portugais.", from: "2017-11-01", start: 55 },
    { id: "allegri", name: "Massimiliano Allegri", role: "Entraîneur de la Juventus", bio: "Entraîneur italien de la Juventus.", from: "2018-07-10", start: 55 },
    { id: "tenhag", name: "Erik ten Hag", role: "Entraîneur de Manchester United (2022-2024)", bio: "Entraîneur néerlandais.", from: "2022-05-23", start: 35 },
    { id: "martinez", name: "Roberto Martínez", role: "Sélectionneur du Portugal depuis 2023", bio: "Sélectionneur espagnol du Portugal.", from: "2023-01-09", start: 65 }
  ],

  starts: [
    { id: "2003", date: "2003-08-12", year: "2003", title: "L’arrivée à Manchester", summary: "18 ans. Manchester United vient de payer environ 19 millions d’euros au Sporting après un match amical à Lisbonne. Vous ne parlez pas anglais et tout reste à prouver.",
      rank: "joueur", scene: "stade", place: "Carrington, Manchester", club: "manutd", salary: 1.8, until: "2007-06-30",
      stats: { forme: 62, niveau: 68, popularite: 22, coach: 62, vestiaire: 48, valeur: 18, fortune: .6, abonnes: 0, sante: 96, fatigue: 22, stress: 38 },
      skills: { finition: 60, vitesse: 82, tete: 58, cf: 55, passe: 62 }, family: { spouse: null, children: [] }, career: { goals: 5, apps: 31, natGoals: 0, caps: 0, past: ["sporting"] } },
    { id: "2009", date: "2009-07-01", year: "2009", title: "Le joueur le plus cher du monde", summary: "24 ans. Ballon d’or 2008, champion d’Europe avec Manchester, vous rejoignez le Real Madrid pour 94 millions d’euros. 80 000 personnes vous attendent au Bernabéu.",
      rank: "joueur", scene: "stade", place: "Valdebebas, Madrid", club: "real", salary: 13, until: "2015-06-30",
      stats: { forme: 72, niveau: 91, popularite: 70, coach: 60, vestiaire: 55, valeur: 94, fortune: 28, abonnes: 0, sante: 96, fatigue: 25, stress: 42 },
      skills: { finition: 86, vitesse: 93, tete: 82, cf: 86, passe: 78 }, family: { spouse: null, children: [] },
      career: { goals: 123, apps: 323, natGoals: 22, caps: 63, ballons: 1, cl: 1, past: ["sporting", "manutd"], trophies: [{ y: 2007, n: "Premier League" }, { y: 2008, n: "Premier League" }, { y: 2008, n: "Ligue des champions" }, { y: 2009, n: "Premier League" }] } },
    { id: "2018", date: "2018-07-10", year: "2018", title: "Le défi italien", summary: "33 ans. Après neuf saisons et quatre Ligues des champions à Madrid, vous signez à la Juventus pour 100 millions d’euros.",
      rank: "joueur", scene: "stade", place: "Continassa, Turin", club: "juve", salary: 31, until: "2022-06-30",
      stats: { forme: 72, niveau: 94, popularite: 88, coach: 62, vestiaire: 62, valeur: 100, fortune: 380, abonnes: 330, sante: 93, fatigue: 28, stress: 40 },
      skills: { finition: 95, vitesse: 86, tete: 92, cf: 80, passe: 80 }, family: { spouse: null, spouseName: "Georgina Rodríguez (compagne)", children: [{ name: "Cristiano Jr.", born: "2010-06-17" }, { name: "Eva et Mateo", born: "2017-06-08" }, { name: "Alana Martina", born: "2017-11-12" }] },
      career: { goals: 658, apps: 916, natGoals: 85, caps: 154, ballons: 5, cl: 5, past: ["sporting", "manutd", "real"], trophies: [{ y: 2008, n: "Ligue des champions" }, { y: 2014, n: "Ligue des champions" }, { y: 2016, n: "Ligue des champions" }, { y: 2016, n: "Euro 2016" }, { y: 2017, n: "Ligue des champions" }, { y: 2017, n: "Liga" }, { y: 2018, n: "Ligue des champions" }] }, biz: { cr7: 2013, musee: 2013, hotels: 2016 } },
    { id: "2023", date: "2023-01-03", year: "2023", title: "Le pari saoudien", summary: "37 ans. Libre depuis votre départ de Manchester, vous signez à Al-Nassr, à Riyad, le contrat le plus élevé de l’histoire du football.",
      rank: "joueur", scene: "stade", place: "Riyad", club: "alnassr", salary: 200, until: "2025-06-30",
      stats: { forme: 66, niveau: 85, popularite: 78, coach: 62, vestiaire: 66, valeur: 15, fortune: 520, abonnes: 780, sante: 90, fatigue: 28, stress: 45 },
      skills: { finition: 92, vitesse: 76, tete: 90, cf: 76, passe: 78 }, family: { spouse: null, spouseName: "Georgina Rodríguez (compagne)", children: [{ name: "Cristiano Jr.", born: "2010-06-17" }, { name: "Eva et Mateo", born: "2017-06-08" }, { name: "Alana Martina", born: "2017-11-12" }, { name: "Bella Esmeralda", born: "2022-04-18" }] },
      career: { goals: 819, apps: 1145, natGoals: 118, caps: 196, ballons: 5, cl: 5, past: ["sporting", "manutd", "real", "juve"], trophies: [{ y: 2008, n: "Ligue des champions" }, { y: 2014, n: "Ligue des champions" }, { y: 2016, n: "Euro 2016" }, { y: 2018, n: "Ligue des champions" }, { y: 2019, n: "Serie A" }, { y: 2019, n: "Ligue des nations" }, { y: 2020, n: "Serie A" }] }, biz: { cr7: 2013, musee: 2013, hotels: 2016, clinique: 2019 } }
  ],

  eraNotes: {
    2003: "Arrivée à Manchester United pour environ 19 M€ ; il hérite du numéro 7. Premier League dominée par Arsenal, Manchester United et Chelsea.", 2004: "Vainqueur de la Coupe d’Angleterre. Euro au Portugal : finale perdue 0-1 contre la Grèce. Arrivée de Rooney à Manchester.",
    2005: "Chelsea de Mourinho champion d’Angleterre. Messi émerge à Barcelone.", 2006: "Coupe du monde en Allemagne : Portugal quatrième ; polémique après l’expulsion de Rooney en quart de finale.",
    2007: "Champion d’Angleterre avec Manchester United, meilleur joueur de Premier League.", 2008: "Doublé championnat et Ligue des champions (finale à Moscou contre Chelsea), 42 buts sur la saison, premier Ballon d’or.",
    2009: "Finale de Ligue des champions perdue contre le Barça de Guardiola. Transfert record au Real Madrid pour 94 M€.", 2010: "Mourinho arrive au Real. Coupe du monde en Afrique du Sud : Portugal éliminé en huitièmes par l’Espagne. Twitter et Facebook explosent.",
    2011: "Coupe du Roi gagnée contre le Barça. 40 buts en Liga, record de l’époque.", 2012: "Real champion d’Espagne avec 100 points. Euro : Portugal demi-finaliste. Messi marque 91 buts dans l’année civile.",
    2013: "Ancelotti arrive au Real, Gareth Bale aussi. Deuxième Ballon d’or.", 2014: "La « Décima » à Lisbonne contre l’Atlético ; 17 buts en une Ligue des champions. Coupe du monde au Brésil : élimination au premier tour. Troisième Ballon d’or.",
    2015: "Meilleur buteur de l’histoire du Real Madrid. Le Barça de Messi, Suárez et Neymar gagne tout.", 2016: "Ligue des champions avec Zidane, puis l’Euro en France avec le Portugal. Quatrième Ballon d’or.",
    2017: "Doublé Liga et Ligue des champions. Cinquième Ballon d’or.", 2018: "Troisième Ligue des champions de suite, puis départ pour la Juventus (100 M€). Coupe du monde en Russie : triplé contre l’Espagne, élimination en huitièmes.",
    2019: "Champion d’Italie. Première Ligue des nations avec le Portugal.", 2020: "Pandémie de Covid-19 : stades vides, saisons interrompues. Deuxième titre de champion d’Italie.",
    2021: "Meilleur buteur de Serie A et de l’Euro. Retour à Manchester United en août. Record mondial de buts en sélection.", 2022: "Saison difficile à Manchester ; interview télévisée et rupture de contrat en novembre. Coupe du monde au Qatar : quart de finale. Signature à Al-Nassr fin décembre.",
    2023: "Première saison complète en Arabie saoudite ; Benzema, Neymar et d’autres stars suivent. Meilleur buteur mondial de l’année civile.", 2024: "Record de buts sur une saison de Saudi Pro League. Lancement de sa chaîne YouTube. 900e but officiel en septembre.",
    2025: "Deuxième Ligue des nations avec le Portugal, contre l’Espagne. Prolongation à Al-Nassr jusqu’en 2027.", 2026: "Coupe du monde en Amérique du Nord, la sixième à laquelle il peut participer."
  },

  /* ---------------- Moments de carrière réels ---------------- */
  events: [
    { id: "numero7", date: "2003-08-14", until: "2003-09-10", cond: s => s.club === "manutd", title: "Le numéro 7", place: "Old Trafford, Manchester", scene: "vestiaire", people: ["ferguson", "mendes"],
      text: "Vous aviez demandé le 28, votre numéro au Sporting. Sir Alex Ferguson vous tend un autre maillot : le 7, celui de George Best, d’Éric Cantona et de David Beckham, parti cet été au Real Madrid. Dans deux jours, Bolton vient à Old Trafford.",
      real: "Il accepte le 7. Entré à l’heure de jeu contre Bolton le 16 août 2003, il enflamme le stade en trente minutes de dribbles et reçoit une ovation debout.", anecdote: "Le numéro deviendra une marque : « CR7 ».",
      choices: [{ t: "Prendre le 7 et sa légende", hist: true, res: "Le maillot pèse lourd, mais il vous va bien.", fx: { s: { popularite: 6, stress: 6, coach: 5 } } },
        { t: "Garder le 28, loin de la pression", res: "Vous commencez dans l’ombre des anciens.", fx: { s: { stress: -5, popularite: -2, coach: -4 }, f: { num28: true } } }] },
    { id: "euro2004", date: "2004-07-04", until: "2004-07-20", cond: s => !s.nat.retired && s.club, title: "Finale de l’Euro 2004", place: "Estádio da Luz, Lisbonne", scene: "stade", people: ["scolari"],
      text: "À 19 ans, vous jouez la finale d’un Euro, chez vous, devant tout un pays. En face, la Grèce, que personne n’attendait là et qui vous a déjà battus en match d’ouverture. Elle défend à dix et attend un coup de pied arrêté.",
      real: "Le Portugal s’incline 0-1 sur une tête de Charisteas à la 57e minute. Les images de ses larmes sur la pelouse font le tour du monde.", anecdote: "Il avait marqué son premier but en sélection lors du match d’ouverture, déjà contre la Grèce.",
      choices: [{ t: "Entrer sur la pelouse", hist: true, res: "Coup d’envoi à Lisbonne.", match: { comp: "tour", title: "Finale de l’Euro 2004", opp: "Grèce", T: 83, O: 82, final: true, trophy: "Euro 2004", win: { s: { popularite: 15 }, txt: "Le Portugal est champion d’Europe à domicile." }, loss: { s: { popularite: 2, stress: 10 }, txt: "Tout un pays pleure avec vous." } } }] },
    { id: "clin2006", date: "2006-07-08", until: "2006-08-10", cond: s => s.club === "manutd", title: "Après le clin d’œil", place: "Lisbonne", scene: "plateau", people: ["ferguson", "rooney", "mendes"],
      text: "En quart de finale de la Coupe du monde, votre coéquipier de club Wayne Rooney a été expulsé contre le Portugal, et les caméras vous ont filmé faisant un clin d’œil vers votre banc. La presse anglaise vous désigne comme le coupable. Le Real Madrid se renseigne ; Ferguson fait le voyage pour vous convaincre de revenir.",
      real: "Il reste à Manchester. La saison suivante, il marque 23 buts, United est champion et il est élu meilleur joueur de Premier League.", anecdote: "Rooney a toujours dit ne lui en avoir jamais voulu.",
      choices: [{ t: "Rentrer à Manchester et répondre sur le terrain", hist: true, res: "Sifflé sur tous les terrains d’Angleterre, vous transformez la colère en buts.", fx: { s: { stress: 10, coach: 8, niveau: 2, popularite: -3 }, r: { ferguson: 10, rooney: 5 } } },
        { t: "Exiger un départ immédiat pour l’Espagne", res: "Mendes ouvre les discussions avec Madrid.", fx: { r: { ferguson: -20 }, call: { fn: "force", club: "real", salary: 7, years: 5, p: .4 } } }] },
    { id: "moscou2008", date: "2008-05-21", until: "2008-06-05", cond: s => s.club === "manutd", title: "Finale de la Ligue des champions", place: "Stade Loujniki, Moscou", scene: "stade", people: ["ferguson", "rooney"],
      text: "Manchester United contre Chelsea : la première finale 100 % anglaise. Il pleut sur Moscou, la pelouse a été posée à la hâte. Vous sortez d’une saison à plus de quarante buts. Le Ballon d’or se joue peut-être ce soir.",
      real: "Il ouvre le score de la tête à la 26e minute ; Lampard égalise. Aux tirs au but, il manque le sien, mais Terry glisse et Van der Sar arrête la tentative d’Anelka : United gagne 6-5.", anecdote: "Il termine la saison avec 42 buts et reçoit son premier Ballon d’or en décembre.",
      choices: [{ t: "Jouer la finale", hist: true, res: "Coup d’envoi sous la pluie.", match: { comp: "cl", title: "Finale de la Ligue des champions 2008", opp: "Chelsea", T: 88, O: 86, final: true, trophy: "Ligue des champions", win: { s: { popularite: 12, valeur: 15 }, txt: "Champion d’Europe." }, loss: { s: { stress: 8 }, txt: "Chelsea soulève la coupe." } } }] },
    { id: "real2009", date: "2009-06-11", until: "2009-07-20", cond: s => s.club === "manutd", title: "94 millions d’euros", place: "Manchester", scene: "plateau", people: ["ferguson", "perez", "mendes"],
      text: "Manchester United vient d’accepter une offre du Real Madrid : 80 millions de livres, 94 millions d’euros, le transfert le plus cher de l’histoire. Florentino Pérez, revenu à la présidence, veut faire de vous le visage de ses nouveaux « Galactiques ». Ferguson vous laisse décider.",
      real: "Il signe au Real Madrid pour six ans. Le 6 juillet 2009, environ 80 000 personnes assistent à sa présentation au Santiago-Bernabéu.", anecdote: "Raúl portant le 7, il joue sa première saison madrilène avec le numéro 9.",
      choices: [{ t: "Signer au Real Madrid", hist: true, res: "Vous devenez le joueur le plus cher du monde.", fx: { s: { popularite: 8, stress: 6 }, r: { perez: 15, ferguson: 2 }, call: { fn: "transfer", club: "real", salary: 13, years: 6 } } },
        { t: "Rester à Manchester et prolonger", res: "Old Trafford garde son numéro 7.", fx: { s: { coach: 10, vestiaire: 6 }, r: { ferguson: 15, perez: -10 }, call: { fn: "extend", salary: 11, years: 5 } } }] },
    { id: "decima2014", date: "2014-05-24", until: "2014-06-08", cond: s => s.club === "real", title: "La Décima", place: "Estádio da Luz, Lisbonne", scene: "stade", people: ["ancelotti", "ramos"],
      text: "Le Real court depuis douze ans après sa dixième Coupe d’Europe. La finale se joue à Lisbonne, dans votre pays, contre l’Atlético de Madrid, tout juste champion d’Espagne. Vous jouez diminué par une blessure à la cuisse.",
      real: "Mené 0-1, le Real égalise par Ramos à la 93e minute et s’impose 4-1 en prolongation. Il marque le quatrième but sur penalty et porte son total à 17 buts dans la compétition, un record.", anecdote: "Il reçoit son troisième Ballon d’or en janvier 2015.",
      choices: [{ t: "Jouer la finale", hist: true, res: "Derby madrilène à Lisbonne.", match: { comp: "cl", title: "Finale de la Ligue des champions 2014", opp: "Atlético de Madrid", T: 90, O: 87, final: true, trophy: "Ligue des champions", win: { s: { popularite: 12 }, r: { ancelotti: 10 }, txt: "La dixième, enfin." }, loss: { s: { stress: 10 }, txt: "L’Atlético crée la surprise." } } }] },
    { id: "euro2016", date: "2016-07-10", until: "2016-07-25", cond: s => !s.nat.retired && s.club, title: "Finale de l’Euro 2016", place: "Stade de France, Saint-Denis", scene: "stade", people: ["santos", "pepe"],
      text: "Finale contre la France, chez elle. À la 8e minute, un choc avec Dimitri Payet vous laisse au sol, le genou gauche touché. Les soigneurs vous bandent la jambe. Vous êtes le capitaine ; le Portugal n’a jamais rien gagné.",
      real: "Il tente de reprendre deux fois, puis sort sur civière à la 25e minute, en larmes. Il finit le match debout dans la zone technique, à encourager ses coéquipiers. Éder marque à la 109e : le Portugal est champion d’Europe.", anecdote: "Un papillon de nuit s’était posé sur son visage pendant qu’il était à terre : l’image est restée.",
      choices: [{ t: "Serrer les dents et rester sur le terrain", hist: true, res: "Vous essayez, deux fois. Le genou ne tient pas ; vous sortez sur civière et poussez l’équipe depuis le banc.", fx: { s: { stress: 12 }, call: { fn: "final2016", stay: true } } },
        { t: "Sortir tout de suite pour ne pas pénaliser l’équipe", res: "Vous cédez votre place dès la 10e minute et vivez la finale au bord du terrain.", fx: { call: { fn: "final2016", stay: false } } }] },
    { id: "juve2018", date: "2018-07-10", until: "2018-08-15", cond: s => s.club === "real", title: "Turin appelle", place: "Madrid", scene: "plateau", people: ["perez", "mendes", "zidane"],
      text: "Trois Ligues des champions de suite, mais Zidane vient de partir et vos relations avec la direction se sont tendues. La Juventus propose 100 millions d’euros au Real et un contrat de quatre ans. Vous avez 33 ans : aucun joueur de cet âge n’a jamais coûté ce prix.",
      real: "Il signe à la Juventus. Il y gagne deux championnats d’Italie et marque 101 buts en trois saisons.", anecdote: "En avril 2018, le public de Turin l’avait applaudi debout après son retourné acrobatique contre la Juventus.",
      choices: [{ t: "Signer à la Juventus", hist: true, res: "Un nouveau championnat à conquérir.", fx: { s: { popularite: 4 }, r: { perez: -10 }, call: { fn: "transfer", club: "juve", salary: 31, years: 4 } } },
        { t: "Rester au Real et négocier une prolongation", res: "Mendes retourne voir Florentino Pérez.", fx: { r: { perez: 10 }, call: { fn: "extend", salary: 26, years: 3 } } }] },
    { id: "retour2021", date: "2021-08-27", until: "2021-09-01", cond: s => s.club === "juve", title: "Le marché ferme dans cinq jours", place: "Turin", scene: "plateau", people: ["mendes", "ferguson"],
      text: "Vous avez dit à la Juventus que vous vouliez partir. Selon la presse, Manchester City a discuté avec Jorge Mendes. Puis Manchester United est entré dans la danse, et d’anciens coéquipiers vous ont appelé.",
      real: "Manchester United annonce son retour le 27 août 2021. Il marque un doublé pour son deuxième premier match, contre Newcastle, et finit la saison avec 24 buts.", anecdote: "Le maillot floqué à son nom bat des records de ventes en quelques heures.",
      choices: [{ t: "Rentrer à Manchester United", hist: true, res: "Douze ans après, Old Trafford vous retrouve.", fx: { s: { popularite: 8 }, r: { ferguson: 10 }, call: { fn: "transfer", club: "manutd", salary: 26, years: 2 } } },
        { t: "Signer à Manchester City", res: "L’autre moitié de Manchester.", fx: { s: { popularite: -6 }, r: { ferguson: -25, rooney: -10 }, call: { fn: "transfer", club: "mancity", salary: 24, years: 2 } } },
        { t: "Rester à la Juventus", res: "Vous honorez la dernière année de contrat.", fx: { s: { coach: -4 }, r: { allegri: 4 } } }] },
    { id: "interview2022", date: "2022-11-10", until: "2022-11-20", cond: s => s.club === "manutd", title: "Sur le banc", place: "Manchester", scene: "plateau", people: ["tenhag", "mendes"],
      text: "Vous ne débutez plus les matchs. En octobre, vous avez quitté le banc avant la fin d’une rencontre et vous avez été écarté du groupe. La Coupe du monde commence dans dix jours. Un journaliste britannique vous propose une longue interview télévisée, sans filtre.",
      real: "L’interview est diffusée à la mi-novembre 2022 ; il y critique le club et son entraîneur. Le 22 novembre, Manchester United et lui annoncent la fin de son contrat d’un commun accord.", anecdote: "Il devient quelques jours plus tard le premier joueur à marquer dans cinq Coupes du monde.",
      choices: [{ t: "Donner l’interview et tout dire", hist: true, res: "L’entretien fait le tour du monde. Le club et vous vous séparez.", fx: { s: { popularite: -6, stress: 12, vestiaire: -15 }, r: { tenhag: -40 }, call: { fn: "release" } } },
        { t: "Se taire et regagner sa place", res: "Vous travaillez en silence.", fx: { s: { coach: 8, stress: 6 }, r: { tenhag: 12 } } },
        { t: "Demander à Mendes un départ discret en janvier", res: "L’agent sonde le marché sans bruit.", fx: { r: { mendes: 5 }, call: { fn: "scout" } } }] },
    { id: "nassr2022", date: "2022-12-27", until: "2023-01-20", cond: s => !s.club && s.rank !== "retraite", title: "L’offre de Riyad", place: "Madrid", scene: "plateau", people: ["mendes"],
      text: "Libre de tout contrat après la Coupe du monde, vous vous entraînez seul. Les grands clubs européens ne se bousculent pas. Al-Nassr, à Riyad, propose un contrat de deux ans et demi que la presse chiffre autour de 200 millions d’euros par saison, en comptant les accords commerciaux.",
      real: "Il signe à Al-Nassr le 30 décembre 2022. Son arrivée ouvre la voie à des dizaines de joueurs de premier plan vers le championnat saoudien.", anecdote: "Le compte Instagram du club passe de moins d’un million à plus de dix millions d’abonnés en quelques jours.",
      choices: [{ t: "Signer à Al-Nassr", hist: true, res: "Le football saoudien change d’échelle.", fx: { s: { popularite: -2 }, call: { fn: "transfer", club: "alnassr", salary: 200, years: 3 } } },
        { t: "Revenir au Sporting, pour un salaire symbolique", res: "Lisbonne retrouve l’enfant du centre de formation.", fx: { s: { popularite: 8 }, r: { dolores: 10 }, call: { fn: "transfer", club: "sporting", salary: 4, years: 2 } } },
        { t: "Tenter l’aventure américaine", res: "La MLS déroule le tapis rouge.", fx: { s: { popularite: 3 }, call: { fn: "transfer", club: "intermiami", salary: 30, years: 2 } } }] },
    { id: "youtube2024", date: "2024-08-21", until: "2024-10-01", cond: s => !s.biz.youtube, title: "Une chaîne à soi", place: "Riyad", scene: "plateau", people: ["georgina"],
      text: "Votre équipe a préparé une chaîne YouTube : entraînements, famille, entretiens avec d’anciens coéquipiers. Vous avez déjà plus d’abonnés que quiconque sur les autres réseaux. Reste à savoir si vous voulez ouvrir cette porte de plus.",
      real: "La chaîne « UR · Cristiano » est lancée le 21 août 2024. Elle dépasse le million d’abonnés en moins de deux heures, un record pour la plateforme.", anecdote: "Il reçoit ses trophées YouTube en direct avec ses enfants.",
      choices: [{ t: "Lancer la chaîne", hist: true, res: "Les compteurs s’affolent.", fx: { s: { abonnes: 40, popularite: 4, stress: 3 }, call: { fn: "biz", id: "youtube" } } },
        { t: "Rester concentré sur le terrain", res: "Les caméras resteront à la porte.", fx: { s: { stress: -3 } } }] },
    { id: "nations2025", date: "2025-06-08", until: "2025-06-20", cond: s => !s.nat.retired && s.club, title: "Finale de la Ligue des nations", place: "Allianz Arena, Munich", scene: "stade", people: ["martinez", "bruno"],
      text: "À 40 ans, vous êtes encore le capitaine. En face, l’Espagne, championne d’Europe en titre, et un ailier de 17 ans dont tout le monde parle. On a présenté le match comme un duel entre deux générations.",
      real: "Mené deux fois, le Portugal égalise par lui à la 61e minute (2-2) et s’impose 5-3 aux tirs au but. Sorti sur blessure avant la séance, il fond en larmes à la remise du trophée.", anecdote: "C’est son troisième titre avec le Portugal.",
      choices: [{ t: "Jouer la finale", hist: true, res: "Coup d’envoi à Munich.", match: { comp: "tour", title: "Finale de la Ligue des nations 2025", opp: "Espagne", T: 85, O: 88, final: true, trophy: "Ligue des nations", win: { s: { popularite: 10 }, r: { martinez: 8 }, txt: "Un troisième trophée avec le Portugal." }, loss: { s: { stress: 6 }, txt: "L’Espagne garde la main." } } }] },
    { id: "prolong2025", date: "2025-06-26", until: "2025-07-20", cond: s => s.club === "alnassr", title: "Rester ou partir", place: "Riyad", scene: "plateau", people: ["mendes"],
      text: "Votre contrat à Al-Nassr s’achève. Vous avez laissé entendre que le chapitre pouvait se clore. Le club propose deux saisons de plus ; des clubs engagés dans la Coupe du monde des clubs vous ont approché.",
      real: "Il prolonge à Al-Nassr jusqu’en 2027, avec l’objectif affiché d’atteindre les 1 000 buts.", anecdote: "Il aura 42 ans à la fin de ce contrat.",
      choices: [{ t: "Prolonger jusqu’en 2027", hist: true, res: "Même club, même ambition.", fx: { s: { coach: 5 }, call: { fn: "extend", salary: 200, years: 2 } } },
        { t: "Laisser le contrat s’éteindre et écouter le marché", res: "Mendes reprend son téléphone.", fx: { call: { fn: "release" } } }] }
  ],

  randomEvents: [
    { id: "remplace", cond: s => s.club, title: "Remplacé à l’heure de jeu", people: [], scene: "stade", text: "Le quatrième arbitre lève le panneau : votre numéro. Le score est serré, vous vous sentiez bien. Les caméras se tournent vers vous pendant que vous marchez vers le banc.",
      choices: [{ t: "Serrer la main du coach et s’asseoir", res: "Un geste simple, remarqué.", fx: { s: { coach: 6, vestiaire: 3, stress: 3 } } }, { t: "Montrer son agacement et filer au vestiaire", res: "L’image tourne en boucle.", fx: { s: { coach: -8, popularite: -3, vestiaire: -3 } } }, { t: "Demander une explication le lendemain, en privé", res: "La discussion est franche.", fx: { s: { coach: 2, stress: -2 } } }] },
    { id: "tournage", cond: s => s.club && s.pol.sponsors >= 1, title: "Un tournage la veille du match", people: ["mendes"], scene: "plateau", text: "Un partenaire veut tourner une publicité demain, veille de match. Six heures de plateau. Le contrat le prévoit ; le staff du club, lui, n’apprécie pas.",
      choices: [{ t: "Honorer le tournage", res: "La marque est ravie, les jambes moins.", fx: { s: { fortune: 2, fatigue: 8, coach: -4 } } }, { t: "Reporter, quitte à payer une pénalité", res: "Le football d’abord.", fx: { s: { fortune: -.5, coach: 4 }, r: { mendes: -3 } } }] },
    { id: "jeune", cond: s => s.club && GAME.age(s) >= 26, title: "Un jeune du centre de formation", people: [], scene: "vestiaire", text: "Un attaquant de 18 ans vient de monter avec les professionnels. Il reste après l’entraînement pour vous regarder tirer vos coups francs, sans oser vous parler.",
      choices: [{ t: "L’inviter à travailler avec vous chaque jour", res: "Il progresse à vue d’œil.", fx: { s: { vestiaire: 7, fatigue: 3, popularite: 2 } } }, { t: "Rester concentré sur sa propre routine", res: "Chacun son travail.", fx: { s: { vestiaire: -2 } } }] },
    { id: "rumeur", cond: s => s.club, title: "Une rumeur de transfert", people: ["mendes"], scene: "plateau", text: "Un journal sportif affirme que vous avez demandé à partir. C’est faux, ou du moins prématuré. Le vestiaire lit la presse, les supporters aussi.",
      choices: [{ t: "Démentir publiquement", res: "Le message est clair.", fx: { s: { vestiaire: 4, coach: 3 } } }, { t: "Ne rien dire", res: "La rumeur enfle, puis s’éteint.", fx: { s: { vestiaire: -3, stress: 3 } } }, { t: "Laisser Mendes s’en servir pour renégocier", res: "L’agent appelle le club.", fx: { s: { coach: -4, valeur: 3 }, r: { mendes: 4 } } }] },
    { id: "kine", cond: s => s.club && s.stats.fatigue > 60, title: "L’avis du préparateur", people: [], scene: "vestiaire", text: "Vos données de charge sont dans le rouge depuis trois semaines. Le préparateur physique recommande de sauter le prochain match. Vous détestez regarder un match depuis la tribune.",
      choices: [{ t: "Écouter le staff et souffler", res: "Une semaine de soins.", fx: { s: { fatigue: -22, forme: 5, coach: 2 } } }, { t: "Jouer quand même", res: "Vous serrez les dents.", fx: { s: { fatigue: 8, coach: 2 }, call: { fn: "risk", p: .12 } } }] },
    { id: "enfants", cond: s => true, title: "Une visite à l’hôpital", people: ["dolores"], scene: "plateau", text: "Un hôpital pour enfants vous demande une visite et une aide pour financer un service. Aucune caméra n’est prévue, sauf si vous le souhaitez.",
      choices: [{ t: "Y aller discrètement et financer le service", res: "Personne ne le saura avant longtemps.", fx: { s: { fortune: -.4, stress: -6 }, r: { dolores: 5 } } }, { t: "Y aller avec les médias", res: "Les images sont belles ; certains parlent de communication.", fx: { s: { fortune: -.4, popularite: 5 } } }, { t: "Envoyer un maillot signé", res: "Le geste minimal.", fx: { s: { popularite: 1 } } }] },
    { id: "capitaine", cond: s => s.club && s.stats.vestiaire > 55 && GAME.age(s) >= 24, once: true, title: "Le brassard", people: [], scene: "vestiaire", text: "Le capitaine est blessé pour plusieurs mois. L’entraîneur hésite entre un ancien du club et vous.",
      choices: [{ t: "Dire au coach que vous êtes prêt", res: "Vous menez l’équipe sur la pelouse.", fx: { s: { coach: 4, vestiaire: -2, stress: 5, popularite: 3 } } }, { t: "Soutenir l’ancien", res: "Le vestiaire apprécie.", fx: { s: { vestiaire: 8 } } }] }
  ],

  legends: [
    { title: "Le plus grand de tous", cond: (s, c) => s.career.ballons >= 7 || (s.career.ballons >= 5 && s.career.cl >= 6), text: "Les chiffres ont fini par clore le débat." },
    { title: "Monsieur Ligue des champions", cond: (s, c) => s.career.cl >= 5, text: "La coupe aux grandes oreilles portait ton nom." },
    { title: "Le Capitaine", cond: (s, c) => s.career.trophies.some(t => /Euro|Coupe du monde/.test(t.n)), text: "Tu as offert un grand titre à ton pays." },
    { title: "L’Éternel", cond: (s, c) => s.career.lastAge >= 42 && s.career.goals >= 900, text: "Le temps n’a jamais eu prise sur toi." },
    { title: "La Marque", cond: (s, c) => s.stats.fortune >= 1500, text: "Le joueur est devenu une entreprise." },
    { title: "L’Étoile filante", cond: (s, c) => s.career.goals < 300, text: "Un talent immense, une trajectoire trop courte." },
    { title: "Le Phénomène", cond: () => true, text: "Travail, orgueil et buts : une carrière hors norme." }
  ],
  aiBrief: "Cristiano Ronaldo (né en 1985), footballeur portugais. Ton : simulateur de carrière sportive sérieux, factuel, dans le style d’un journal sportif de référence.",
  aiRules: [
    "Personne réelle et vivante : appuie-toi uniquement sur des faits publics de carrière. N’invente aucune citation présentée comme réelle ; les paroles sont paraphrasées, sans guillemets.",
    "Rien de diffamatoire : aucune allusion à des affaires judiciaires, fiscales, médicales ou à la vie intime, pour lui comme pour les autres personnes réelles.",
    "Reste neutre et réaliste : des conséquences sportives, médiatiques et commerciales défendables."
  ]
};

/* ---------------- Carte : pays, clubs, offres ---------------- */
R.map = { title: "Clubs et championnats", viewBox: "120 95 640 600", home: "angleterre",
  regions: [
    { id: "angleterre", name: "Angleterre", pts: "300,150 345,120 370,170 400,235 385,275 330,285 300,265 320,215 295,190", c: [345, 215], adj: [] },
    { id: "france", name: "France", pts: "330,300 400,285 450,300 480,330 475,380 490,430 470,470 420,480 380,500 330,490 315,430 290,380 280,340", c: [390, 395], adj: [] },
    { id: "espagne", name: "Espagne", pts: "220,500 330,495 380,505 390,540 350,600 300,640 240,640 215,590", c: [300, 565], adj: [] },
    { id: "portugal", name: "Portugal", pts: "175,520 218,503 213,590 238,642 185,640 170,580", c: [194, 580], adj: [] },
    { id: "allemagne", name: "Allemagne", pts: "480,250 560,240 583,300 572,362 520,380 482,372 487,330 455,300 482,282", c: [525, 315], adj: [] },
    { id: "italie", name: "Italie", pts: "478,440 496,415 578,404 600,432 592,472 642,540 682,592 652,612 620,570 580,542 545,482 500,462", c: [552, 448], adj: [] },
    { id: "arabie", name: "Arabie saoudite", pts: "590,620 745,620 745,685 590,685", c: [668, 655], adj: [], sea: true },
    { id: "usa", name: "États-Unis", pts: "135,130 262,130 262,200 135,200", c: [198, 168], adj: [], sea: true }
  ],
  statusLabel: { home: "Club actuel", vassal: "Anciens clubs", allie: "Offre reçue", paix: "Autres championnats" },
  status(s, id){ if (s.club && CLUBS[s.club].reg === id) return "home"; if ((s.offers || []).some(o => CLUBS[o.club].reg === id)) return "allie"; if (s.career.past.some(c => CLUBS[c].reg === id)) return "vassal"; return "paix"; },
  markers(s){ const out = []; const add = (c, kind) => { if (!out.some(m => m.id === c)) out.push({ id: c, region: CLUBS[c].reg, moving: kind === "offer", label: CLUBS[c].sh, title: `${CLUBS[c].n}${kind === "offer" ? " — offre reçue" : kind === "now" ? " — club actuel" : " — ancien club"}` }); }; if (s.club) add(s.club, "now"); for (const o of (s.offers || [])) add(o.club, "offer"); for (const c of s.career.past) add(c, "past"); return out; }
};
R.regionName = id => ({ manchester: "Manchester" }[id] || (R.map.regions.find(r => r.id === id) || { name: id }).name);
R.mapInfo = (s, id) => {
  const reg = R.map.regions.find(r => r.id === id); const st = R.map.status(s, id); const lg = LEAGUES[(Object.values(CLUBS).find(c => c.reg === id) || {}).lg];
  const clubs = Object.entries(CLUBS).filter(([k, c]) => c.reg === id && (!c.from || c.from <= parseD(s.date).y));
  const mine = clubs.filter(([k]) => s.career.byClub[k]).map(([k, c]) => `${c.n} : ${s.career.byClub[k].g} buts en ${s.career.byClub[k].a} matchs`);
  const offers = (s.offers || []).filter(o => CLUBS[o.club].reg === id);
  return `<div class="map-info"><button class="x" data-do="mapclose" aria-label="Fermer">×</button><h3>${esc(reg.name)} <span class="chip ${st === "home" ? "allie" : st}">${esc(R.map.statusLabel[st])}</span></h3>
    <span class="note">${lg ? esc(lg.n) + " · " : ""}Grands clubs : ${clubs.map(([k, c]) => `${esc(c.n)} (${c.st})`).join(", ") || "—"}</span>
    ${mine.length ? `<span class="note">Votre passage : ${esc(mine.join(" ; "))}.</span>` : ""}
    ${offers.length ? `<span class="note">Offre : ${offers.map(o => `${esc(CLUBS[o.club].n)}, ${ME(o.salary)} par an sur ${o.years} ans`).join(" ; ")}.</span><div class="ops"><button class="btn small" data-do="goto|contrats">Voir les offres</button></div>` : ""}</div>`;
};

/* ---------------- Mise en place d’une partie ---------------- */
R.defaultPol = { intensite: 2, focus: "finition", recup: 1, nutrition: 1, menager: 0, live: 1, sponsors: 1, social: 1, ton: 1, train: 1, dons: 0, attitude: 1, dispo: 0 };
R.setup = (s, startId) => {
  const st = R.starts.find(x => x.id === startId) || R.starts[0];
  s.club = st.club; s.contract = { club: st.club, salary: st.salary, until: st.until };
  s.skills = { ...st.skills }; s.pol = { ...R.defaultPol }; s.wk = {}; s.offers = []; s.results = []; s.injury = null; s.wkq = []; s.biz = { ...(st.biz || {}) };
  s.career = { goals: 0, assists: 0, apps: 0, natGoals: 0, caps: 0, ballons: 0, cl: 0, trophies: [], past: [], byClub: {}, lastAge: GAME.age(s), ...JSON.parse(JSON.stringify(st.career || {})) };
  s.nat = { retired: false, sel: 65, tour: null };
  if (st.family && st.family.spouseName) s.family.spouseName = st.family.spouseName;
  s.rivals = {}; for (const r of R.rivals) s.rivals[r.id] = { plan: r.plans[0].plan, prog: Math.round(Math.random() * 30), i: 0 };
  R.newSeason(s);
  // Départ en cours de saison : le championnat est déjà à mi-parcours
  if (parseD(s.date).m <= 5 && s.club) { const se = s.season, m = LEAGUES[CLUBS[s.club].lg].m; se.md = Math.round(m / 2); se.pts = Math.round(se.md * 1.8); for (const k of Object.keys(se.riv)) se.riv[k] = Math.round(se.md * (1.4 + Math.random() * .7)); se.cl.stage = "out"; se.cup.out = true; }
};
R.sync = s => {};
R.newSeason = s => {
  const y = seasonY(s.date); const lg = s.club ? LEAGUES[CLUBS[s.club].lg] : null; const fx = [];
  if (lg) { const lgId = CLUBS[s.club].lg; const riv = Object.keys(CLUBS).filter(k => CLUBS[k].lg === lgId && k !== s.club && (!CLUBS[k].from || CLUBS[k].from <= y + 1));
    const pool = []; for (const k of riv) pool.push({ opp: k }, { opp: k }); const oth = [...lg.others].sort(() => Math.random() - .5); let i = 0; while (pool.length < lg.m) pool.push({ name: oth[i++ % oth.length] });
    pool.sort(() => Math.random() - .5); pool.forEach((f, i) => { f.home = i % 2 === 0; fx.push(f); });
    s.season = { y, club: s.club, fx, md: 0, pts: 0, w: 0, d: 0, l: 0, riv: Object.fromEntries(riv.map(k => [k, 0])), cl: { in: !lg.noEurope && CLUBS[s.club].st >= 78 || !!lg.asia, asia: !!lg.asia, stage: "grp", pts: 0, tie: null }, cup: { stage: 0, out: false }, g: 0, a: 0, apps: 0, lg: 0, titles: [], closed: false };
  } else s.season = { y, club: null, fx: [], md: 0, pts: 0, w: 0, d: 0, l: 0, riv: {}, cl: { in: false, stage: "out" }, cup: { stage: 0, out: true }, g: 0, a: 0, apps: 0, lg: 0, titles: [], closed: false };
};

/* ---------------- Calendrier : quels matchs cette semaine ? ---------------- */
const CLW = [[9, 13], [9, 27], [10, 18], [11, 1], [11, 22], [12, 6], [2, 14], [3, 7], [4, 4], [4, 11], [4, 25], [5, 2], [5, 25]];
const INTW = [[9, 4], [10, 9], [11, 13], [3, 21], [6, 3]];
const CUPW = [[1, 5], [1, 26], [4, 18], [5, 15]];
const TOURW = y => y === 2022 ? [[11, 20], [11, 27], [12, 4], [12, 11], [12, 18]] : [[6, 10], [6, 17], [6, 24], [7, 1], [7, 8]];
const natOpp = (min, max) => { const pool = NAT_OPP.filter(o => o[1] >= min && o[1] <= max); return pool[Math.floor(Math.random() * pool.length)]; };
R.clubStrength = (k, y) => { const c = CLUBS[k]; let st = c.st; if (k === "manutd" && y >= 2014) st = 79; if (k === "mancity" && y < 2011) st = 76; if (k === "psg" && y < 2012) st = 75; if (k === "milan" && y >= 2012 && y < 2021) st = 78; if (k === "barcelona" && y >= 2021) st = 86; if (k === "juve" && y >= 2021) st = 81; return st; };
R.fixtures = (s, date, preview) => {
  const out = []; if (s.rank === "retraite") return out; const p = parseD(date), y = p.y; const se = s.season; const club = s.club;
  const tourName = TOURS(y); const tw = tourName ? TOURW(y) : null; const natOn = !s.nat.retired && (club || s.rank === "libre");
  const tIdx = tw ? tw.findIndex(([m, d]) => inWin(date, m, d)) : -1;
  if (tIdx >= 0 && natOn) { const t = s.nat.tour && s.nat.tour.y === y ? s.nat.tour : { name: tourName, y, stage: 0, out: false, pts: 0 };
    const rail = (y === 2004 || y === 2016) && !R.events.find(e => e.id === (y === 2004 ? "euro2004" : "euro2016")).done_; const stages = [["Premier tour", "Premier tour"], ["Premier tour", "Huitième de finale"], ["Quart de finale"], ["Demi-finale"], ["Finale"]][tIdx];
    if (!t.out) for (const stg of stages) { if (stg === "Finale" && (y === 2004 || y === 2016) && !s.done[y === 2004 ? "euro2004" : "euro2016"]) continue; if (/^Euro/.test(tourName) && y < 2016 && stg === "Huitième de finale") continue; const ko = stg !== "Premier tour"; const o = ko ? natOpp(80, 90) : natOpp(72, 86); out.push({ comp: "tour", tour: tourName, stage: stg, opp: o[0], O: o[1], T: 84, ko, big: ko, final: stg === "Finale", rail: (y === 2004 || y === 2016) && !s.flags.natOut, title: `${tourName} · ${stg}`, tIdx }); }
    return out; }
  const tourBlock = tw && between(date, tw[0][0], tw[0][1] - 9, tw[4][0], tw[4][1] + 6);
  const iIdx = INTW.findIndex(([m, d]) => inWin(date, m, d));
  if (iIdx >= 0 && !tourBlock) { if (natOn) { if (iIdx === 4 && y === 2019) { out.push({ comp: "tour", tour: "Ligue des nations", stage: "Demi-finale", opp: "Suisse", O: 80, T: 85, ko: true, big: true, title: "Ligue des nations · Demi-finale", nl: true }, { comp: "tour", tour: "Ligue des nations", stage: "Finale", opp: "Pays-Bas", O: 84, T: 85, ko: true, big: true, final: true, title: "Ligue des nations · Finale", nl: true, trophy: "Ligue des nations" }); } else if (!(iIdx === 4 && y === 2025)) { const o = natOpp(58, 84); out.push({ comp: "nat", opp: o[0], O: o[1], T: 84, title: "Match international", home: Math.random() < .5 }); } } return out; }
  if (!club || !se || se.club !== club) return out; const lg = LEAGUES[CLUBS[club].lg]; const yS = se.y;
  const winter = CLUBS[club].lg !== "pl" && between(date, 12, 23, 1, 3);
  if (!tourBlock && !winter && between(date, 8, 13, 5, 31) && se.md + (preview | 0) < lg.m) { const mdx = se.md + (preview | 0); const f = se.fx[mdx]; const O = f.opp ? R.clubStrength(f.opp, yS) : lg.oth + Math.round(rnd(-4, 5)); const mainRival = Object.keys(se.riv).sort((a, b) => CLUBS[b].st - CLUBS[a].st)[0];
    out.push({ comp: "lg", opp: f.opp ? CLUBS[f.opp].n : f.name, oppId: f.opp || null, O, T: R.clubStrength(club, yS), home: f.home, big: f.opp === mainRival || mdx === 0 && s.flags.newClub || mdx >= lg.m - 2, title: `${lg.n} · ${mdx === 0 ? "1re" : (mdx + 1) + "e"} journée` }); }
  const cIdx = CLW.findIndex(([m, d]) => inWin(date, m, d)); const cl = se.cl;
  if (cIdx >= 0 && cl.in && cl.stage !== "out" && cl.stage !== "won" && !tourBlock) { const name = cl.asia ? "Ligue des champions d’Asie" : "Ligue des champions"; const T = R.clubStrength(club, yS);
    const need = cIdx <= 5 ? "grp" : cIdx <= 7 ? "r16" : cIdx <= 9 ? "qf" : cIdx <= 11 ? "sf" : "f";
    if (cl.stage === need) { const pick = () => { if (cl.asia) return { opp: ASIA_OPP[Math.floor(Math.random() * ASIA_OPP.length)], O: Math.round(rnd(54, 66)) }; const pool = EURO_OPP.filter(k => CLUBS[k].reg !== CLUBS[club].reg && (!CLUBS[k].from || CLUBS[k].from <= yS + 1)); const k = pool[Math.floor(Math.random() * pool.length)]; return { opp: CLUBS[k].n, O: R.clubStrength(k, yS) }; };
      const leg2 = need !== "grp" && need !== "f" && cl.tie; const o = leg2 ? { opp: cl.tie.opp, O: cl.tie.O } : pick(); const lbl = { grp: `phase de groupes, ${cIdx + 1}e match`, r16: "huitième de finale", qf: "quart de finale", sf: "demi-finale", f: "finale" }[need];
      const railed = !cl.asia && !s.flags.clubDiverged && ((club === "manutd" && (yS === 2007 || yS === 2008)) || (club === "real" && [2013, 2015, 2016, 2017].includes(yS)));
      const histFinal = need === "f" && ((club === "manutd" && yS === 2007 && !s.done.moscou2008) || (club === "real" && yS === 2013 && !s.done.decima2014));
      if (!histFinal) out.push({ comp: "cl", name, stage: need, leg: need === "grp" || need === "f" ? 0 : (leg2 ? 2 : 1), opp: o.opp, O: o.O, T, home: need === "f" ? false : !leg2, ko: need !== "grp", big: need === "sf" || need === "f" || (need !== "grp" && !!leg2), final: need === "f", rail: railed && need !== "f", trophy: need === "f" ? name : null, title: `${name} · ${lbl}${leg2 ? " retour" : need !== "grp" && need !== "f" ? " aller" : ""}` }); } }
  const kIdx = CUPW.findIndex(([m, d]) => inWin(date, m, d));
  if (kIdx >= 0 && !se.cup.out && se.cup.stage === kIdx && !tourBlock) { const O = kIdx < 2 ? lg.oth + Math.round(rnd(-8, 6)) : Math.round(rnd(lg.oth + 4, lg.oth + 16)); const names = lg.others; out.push({ comp: "cup", name: lg.cup, stage: kIdx, opp: names[Math.floor(Math.random() * names.length)], O, T: R.clubStrength(club, yS), home: Math.random() < .5, ko: true, big: kIdx === 3, final: kIdx === 3, trophy: kIdx === 3 ? lg.cup : null, title: `${lg.cup} · ${["huitième de finale", "quart de finale", "demi-finale", "finale"][kIdx]}` }); }
  return out;
};

/* ---------------- Simulation d’un match ---------------- */
R.rating = s => s.stats.niveau * (.74 + s.stats.forme / 300) * (1 - Math.max(0, s.stats.fatigue - 50) / 400);
R.plays = (s, f) => !s.injury && !(s.pol.menager && f.comp !== "tour" && !f.big && !f.ko && f.O < f.T - 10) && !(f.comp === "nat" && s.pol.dispo === 1 && f.O < 70) && !(f.comp !== "nat" && f.comp !== "tour" && s.stats.coach < 28 && Math.random() < .5);
R.xg = (s, f, plays) => { const rt = plays ? R.rating(s) : 0; const T = f.T + (plays ? (rt - 78) * .16 : -2) + (f.home ? 2.5 : 0) + (f.rail ? 6 : 0); const mine = 1.45 * Math.exp((T - f.O) / 38), opp = 1.2 * Math.exp((f.O - T) / 38); return { mine, opp, share: plays ? clamp(.5 * Math.pow(rt / 100, 3.6), .04, .46) : 0 }; };
R.simulate = (s, f) => {
  const plays = R.plays(s, f); const x = R.xg(s, f, plays); let goals = pois(x.mine * x.share), others = pois(x.mine * (1 - x.share)), ga = pois(x.opp); const assists = plays ? Math.min(others, pois(others * .16 * (s.skills.passe / 80))) : 0;
  let gf = goals + others; if (f.rail && gf <= ga) { gf = ga + 1; if (plays && Math.random() < .5) goals++; }
  return { gf, ga, goals, assists, played: plays, sim: true };
};
/* Enregistre le résultat d’un match (simulé ou joué) */
R.applyMatch = (s, f, res) => {
  if (f.final) { f.ko = true; if (f.comp === "cl") f.stage = "f"; }
  const se = s.season, st = s.stats; let { gf, ga } = res; let win = gf > ga, draw = gf === ga; let tab = "";
  if (draw && (f.ko && (f.final || f.comp === "tour" || f.comp === "cup"))) { win = res.tab !== undefined ? res.tab : Math.random() < (f.rail ? .85 : .5 + (f.T - f.O) / 200); draw = false; tab = win ? ", vainqueur aux tirs au but" : ", battu aux tirs au but"; }
  const y = parseD(s.date).y; const cName = f.comp === "nat" || f.comp === "tour" ? "Portugal" : (s.club ? CLUBS[s.club].n : "");
  if (res.played) { se.apps++; se.g += res.goals; se.a += res.assists; s.career.apps++; s.career.goals += res.goals; s.career.assists += res.assists;
    if (f.comp === "nat" || f.comp === "tour") { s.career.caps++; s.career.natGoals += res.goals; } else if (s.club) { const b = s.career.byClub[s.club] = s.career.byClub[s.club] || { g: 0, a: 0 }; b.g += res.goals; b.a++; }
    if (f.comp === "lg") se.lg += res.goals;
    const big = f.big || f.final ? 2 : 1; const note = clamp(6 + res.goals * 1.1 + res.assists * .6 + (win ? .4 : draw ? 0 : -.5) - (res.goals === 0 && !win ? .4 : 0) + (res.bonus || 0), 3, 10); res.note = note;
    GAME.applyFx(s, { s: { fatigue: 2.4, popularite: (res.goals * .35 + (note >= 8 ? .4 : note < 5.5 ? -.5 : 0)) * big, coach: (note - 6.4) * .9, vestiaire: res.assists * .8 + (win ? .3 : -.2) + (res.selfish ? -1.5 : 0), forme: (note - 6.5) * .5, stress: (win ? -1 : 1.5) * big } });
    const risk = .0065 * (1 + st.fatigue / 45) * (GAME.age(s) > 33 ? 1.5 : 1) * [.8, .9, 1, 1.25][s.pol.intensite] / (1 + s.pol.recup * .35);
    if (Math.random() < risk) R.injure(s);
    s.career.lastAge = GAME.age(s);
  } else GAME.applyFx(s, { s: { fatigue: -4, coach: s.injury ? 0 : -.6 } });
  let line = `${f.title} : ${cName} ${gf}-${ga} ${f.opp}${tab}${res.played ? (res.goals ? ` · ${res.goals === 1 ? "1 but" : res.goals + " buts"}` : "") + (res.assists ? ` · ${res.assists} passe${res.assists > 1 ? "s" : ""} décisive${res.assists > 1 ? "s" : ""}` : "") : s.injury ? " · blessé" : " · laissé au repos"}`;
  if (f.comp === "lg") { se.md++; if (win) { se.pts += 3; se.w++; } else if (draw) { se.pts++; se.d++; } else se.l++; const lgAvg = LEAGUES[CLUBS[s.club].lg].oth; for (const k of Object.keys(se.riv)) { if (k === f.oppId) { se.riv[k] += win ? 0 : draw ? 1 : 3; continue; } const pw = clamp(.4 + (R.clubStrength(k, se.y) - lgAvg - 8) / 34, .2, .86); const r = Math.random(); se.riv[k] += r < pw ? 3 : r < pw + (1 - pw) * .45 ? 1 : 0; } }
  else if (f.comp === "cl") { const cl = se.cl; if (f.stage === "grp") { cl.pts += win ? 3 : draw ? 1 : 0; cl.n = (cl.n || 0) + 1; if (cl.n >= 6) { if (cl.pts >= 9 || f.rail) { cl.stage = "r16"; cl.tie = null; } else { cl.stage = "out"; line += ". Éliminé en phase de groupes"; } } }
    else if (f.stage === "f") { cl.stage = win ? "won" : "out"; if (win) R.trophy(s, f.trophy, y); }
    else if (f.leg === 1) cl.tie = { opp: f.opp, O: f.O, gf, ga };
    else { const agf = cl.tie.gf + gf, aga = cl.tie.ga + ga; let through = agf > aga || (agf === aga && (f.rail || Math.random() < .5)); if (f.rail) through = true; cl.tie = null; if (through) { cl.stage = { r16: "qf", qf: "sf", sf: "f" }[f.stage]; line += ` (${agf}-${aga} sur les deux matchs, qualifié)`; } else { cl.stage = "out"; line += ` (${agf}-${aga} sur les deux matchs, éliminé)`; } } }
  else if (f.comp === "cup") { if (win) { if (f.final) { R.trophy(s, f.trophy, y); se.cup.out = true; } else se.cup.stage++; } else se.cup.out = true; }
  else if (f.comp === "tour") { const t = s.nat.tour && s.nat.tour.y === y && s.nat.tour.name === f.tour ? s.nat.tour : (s.nat.tour = { name: f.tour, y, out: false, pts: 0, n: 0 });
    if (!f.ko) { t.pts += win ? 3 : draw ? 1 : 0; t.n++; if (t.n >= 3 && t.pts < 4 && !f.rail) { t.out = true; line += ". Éliminé au premier tour"; } }
    else if (!win && !f.rail) { t.out = true; s.flags.natOut = false; } else if (f.final && win && f.trophy) R.trophy(s, f.trophy, y);
    if (f.final && win && !f.trophy && f.tour !== "Ligue des nations") R.trophy(s, f.tour, y); }
  s.results.unshift({ d: s.date, line, win, draw, big: !!(f.big || f.final), note: res.note || null }); if (s.results.length > 40) s.results.length = 40;
  const tone = win ? "good" : draw ? "" : "bad";
  if (f.big || f.final || res.goals >= 3 || !res.sim) { GAME.news(s, { src: "Carnet", title: f.title, text: line, tone }); R.press(s, "match", { f, res, win, draw, line }); } else if (res.goals >= 2) GAME.news(s, { src: "Carnet", text: line, tone });
  return { win, draw, line };
};
R.trophy = (s, name, y) => { s.career.trophies.push({ y, n: name }); if (/Ligue des champions$/.test(name)) s.career.cl++; s.season.titles.push(name); GAME.applyFx(s, { s: { popularite: /Euro|Coupe du monde/.test(name) ? 10 : 5, valeur: 5, vestiaire: 6, coach: 5 } }); GAME.news(s, { src: "Carnet", title: `Trophée : ${name}`, text: `${name} ${y} : un titre de plus au palmarès.`, tone: "good" }); R.press(s, "trophee", { name }); AUDIO.sfx("victory"); };
R.injure = (s, forceW) => { if (s.injury) return; const sev = Math.random(); const w = forceW || (sev < .55 ? 2 + Math.floor(Math.random() * 2) : sev < .9 ? 4 + Math.floor(Math.random() * 5) : 12 + Math.floor(Math.random() * 14)); const names = w <= 3 ? ["Contracture à la cuisse", "Entorse légère de la cheville", "Coup au genou"] : w <= 9 ? ["Lésion musculaire à l’ischio-jambier", "Entorse de la cheville", "Élongation au mollet"] : ["Blessure aux ligaments du genou", "Fracture d’un métatarse"]; s.injury = { name: names[Math.floor(Math.random() * names.length)], w }; GAME.news(s, { src: "Carnet", title: "Blessure", text: `${s.injury.name} : absence estimée à ${w} semaines.`, tone: "bad" }); R.press(s, "blessure", { w }); };

/* Semaine de compétition : joue les matchs, s’arrête sur ceux à vivre en direct, puis sur les bilans */
R.week = (s, cont) => {
  if (s.dead) return null;
  if (!cont) { s.wkq = R.fixtures(s, s.date).map(f => ({ ...f })); if (s.injury) { s.injury.w--; if (s.injury.w <= 0) { GAME.news(s, { src: "Carnet", text: `Retour de blessure (${s.injury.name.toLowerCase()}) : vous reprenez l’entraînement collectif.`, tone: "good" }); s.injury = null; s.stats.forme = clamp(s.stats.forme - 8, 0, 100); } } }
  while (s.wkq.length) { const f = s.wkq.shift(); if (f.comp === "tour" && s.nat.tour && s.nat.tour.y === parseD(s.date).y && s.nat.tour.out) continue; if (f.comp === "cl" && s.season.cl.stage !== f.stage) continue;
    const plays = R.plays(s, f); const live = plays && (s.pol.live === 2 || (s.pol.live === 1 && (f.big || f.final)) || (s.pol.live === 0 && f.final)); if (live) return { match: f }; R.applyMatch(s, f, R.simulate(s, f)); }
  return R.seasonEvents(s);
};

/* Bilans : fin de saison, Ballon d’or, fin de contrat, offres */
const BALLON_REAL = { 2008: "Cristiano Ronaldo", 2009: "Lionel Messi", 2010: "Lionel Messi", 2011: "Lionel Messi", 2012: "Lionel Messi", 2013: "Cristiano Ronaldo", 2014: "Cristiano Ronaldo", 2015: "Lionel Messi", 2016: "Cristiano Ronaldo", 2017: "Cristiano Ronaldo", 2018: "Luka Modrić", 2019: "Lionel Messi", 2021: "Lionel Messi", 2022: "Karim Benzema", 2023: "Lionel Messi", 2024: "Rodri", 2025: "Ousmane Dembélé" };
const MESSI = y => y < 2009 ? 64 : y <= 2012 ? 104 : y <= 2014 ? 86 : y === 2015 ? 102 : y <= 2017 ? 86 : y <= 2019 ? 94 : y <= 2023 ? 90 : 72;
R.seasonEvents = s => {
  const se = s.season, p = parseD(s.date), y = p.y; const info = (id, title, text, fx, scene) => ({ event: { id, title, text, place: s.place, scene: scene || "plateau", people: [], choices: [{ t: "Continuer", fx: fx || {} }] } });
  if (se && !se.closed && s.club && se.club === s.club && ((p.m === 6 && seasonY(s.date) === se.y) || seasonY(s.date) > se.y)) {
    se.closed = true; const lg = LEAGUES[CLUBS[s.club].lg]; const best = Math.max(0, ...Object.values(se.riv)); const rank = 1 + Object.values(se.riv).filter(v => v > se.pts).length; const champ = se.md >= lg.m - 2 && se.pts >= best;
    if (champ) R.trophy(s, lg.n, y); const top = se.lg >= 30;
    s.lastSeason = { y: se.y, g: se.g, titles: [...se.titles], lg: se.lg }; (s.career.seasons = s.career.seasons || []).push({ y: se.y, club: s.club, g: se.g, a: se.a, apps: se.apps });
    return info("bilan" + se.y, `Bilan de la saison ${se.y}-${String(se.y + 1).slice(2)}`, `${CLUBS[s.club].n} termine ${rank === 1 ? "champion" : rank + "e"} de ${lg.n} avec ${se.pts} points. Vous avez marqué ${se.g} buts et donné ${se.a} passes décisives en ${se.apps} matchs, toutes compétitions confondues${top ? `, dont ${se.lg} en championnat : meilleur buteur` : ""}. ${se.titles.length ? "Titres de la saison : " + se.titles.join(", ") + "." : "Aucun titre cette saison."}`, { s: { popularite: champ ? 4 : rank > 4 ? -3 : 0, coach: champ ? 6 : rank > 4 ? -6 : 0, valeur: se.g >= 40 ? 10 : se.g >= 25 ? 4 : se.g < 10 ? -6 : 0 } }, "stade");
  }
  if (inWin(s.date, 12, 1) && s.wk.ballon !== y && s.club && y >= 2004) { s.wk.ballon = y; const ls = s.lastSeason || { g: 0, titles: [] }; const score = ls.g * 1.25 + ls.titles.reduce((t, n) => t + (/Ligue des champions$|Euro|Coupe du monde/.test(n) ? 22 : 9), 0) + (s.stats.niveau - 80) * 1.2; const rival = MESSI(y) + rnd(-10, 10);
    if (score >= 62 && ls.y === y - 1) { const won = score > rival && score >= 86; const real = BALLON_REAL[y];
      if (won) { s.career.ballons++; R.press(s, "ballon", { won: true }); return info("ballon" + y, `Ballon d’or ${y}`, `Vous recevez le Ballon d’or ${y}, le ${s.career.ballons === 1 ? "premier" : s.career.ballons + "e"} de votre carrière. ${real ? `Dans la réalité, le trophée ${y} est allé à ${real}.` : ""}`, { s: { popularite: 8, valeur: 10, stress: -5 } }, "plateau"); }
      R.press(s, "ballon", { won: false }); return info("ballon" + y, `Ballon d’or ${y}`, `Vous terminez sur le podium du Ballon d’or ${y}, devancé au classement. ${real ? `Dans la réalité, le trophée ${y} est allé à ${real}.` : ""}`, { s: { stress: 4 }, r: { messi: -3 } }, "plateau"); } }
  if (s.club && s.contract && se.closed && s.wk.offerExt !== y && p.m >= 6 && p.m <= 7 && parseD(s.contract.until).y === y + 1 && s.stats.coach >= 45 && s.stats.niveau >= R.clubStrength(s.club, y) - 8) {
    s.wk.offerExt = y; const sal = Math.max(s.contract.salary, Math.round(R.fair(s) * (CLUBS[s.club].lg === "sa" ? 5 : 1) * 10) / 10);
    return { event: { id: "ext" + y, title: "Le club veut prolonger", place: s.place, scene: "plateau", people: ["mendes"], text: `Il vous reste un an de contrat. ${CLUBS[s.club].n} propose de prolonger de trois saisons, à ${ME(sal)} par an. Jorge Mendes estime que le marché pourrait offrir autre chose, sans garantie.`,
      choices: [{ t: `Prolonger jusqu’en ${y + 4}`, fx: { s: { coach: 4 }, call: { fn: "extend", salary: sal, years: 4 } } }, { t: "Refuser et aller au bout du contrat", fx: { s: { coach: -5 }, r: { mendes: 3 } } }] } };
  }
  // Nouvelle saison, fin de contrat
  if (se && seasonY(s.date) > se.y && p.m >= 7) {
    if (s.contract && s.contract.until <= s.date && s.club) { const old = s.club; R.leave(s); R.genOffers(s, 3); const ch = s.offers.slice(0, 3).map(o => ({ t: `Signer à ${CLUBS[o.club].n} (${ME(o.salary)} par an, ${o.years} ans)`, fx: { call: { fn: "transfer", club: o.club, salary: o.salary, years: o.years } } }));
      const back = { t: `Prolonger à ${CLUBS[old].n} (${ME(Math.max(.5, R.fair(s) * .8))} par an, 1 an)`, fx: { call: { fn: "transfer", club: old, salary: Math.max(.5, R.fair(s) * .8), years: 1 } } };
      return { event: { id: "fin" + y, title: "Fin de contrat", place: s.place, scene: "plateau", people: ["mendes"], text: `Votre contrat avec ${CLUBS[old].n} est arrivé à son terme. Jorge Mendes a réuni les propositions. ${s.offers.length ? "" : "Le marché est calme pour un joueur de votre âge."}`, choices: [...(s.stats.coach >= 40 && s.stats.niveau >= R.clubStrength(old, y) - 14 ? [back] : []), ...ch, { t: "Mettre un terme à sa carrière", fx: { call: { fn: "retire" } } }].slice(0, 4) } }; }
    R.newSeason(s); s.flags.newClub = false; if (s.club) GAME.news(s, { src: "Carnet", title: `Saison ${s.season.y}-${String(s.season.y + 1).slice(2)}`, text: `Reprise avec ${CLUBS[s.club].n}. Entraîneur : ${coachOf(s.club, s.season.y)}.`, tone: "key" });
  }
  if (!s.club && s.rank === "libre" && (s.offers || []).length === 0 && s.wk.freeAsk !== s.week && s.week % 4 === 0) { s.wk.freeAsk = s.week; R.genOffers(s, 2); }
  return null;
};

/* ---------------- Contrats et transferts ---------------- */
R.fair = s => { const y = parseD(s.date).y, age = GAME.age(s); const era = clamp((y - 1994) / 22, .3, 1.25); const ageM = age <= 31 ? 1 : age <= 34 ? .85 : age <= 37 ? .6 : .4; return Math.round(Math.pow(Math.max(2, s.stats.niveau - 55), 1.62) * .115 * era * ageM * (.85 + s.stats.popularite / 300) * 10) / 10; };
R.genOffers = (s, n) => {
  const y = parseD(s.date).y, age = GAME.age(s), niv = s.stats.niveau;
  const pool = Object.entries(CLUBS).filter(([k, c]) => k !== s.club && (!c.from || c.from <= y) && c.col && niv >= R.clubStrength(k, y) - 9 && (age <= 34 || R.clubStrength(k, y) < 84 || niv >= 90) && !(s.offers || []).some(o => o.club === k));
  const extra = Object.entries(CLUBS).filter(([k, c]) => k !== s.club && (!c.from || c.from <= y) && !c.col && niv >= R.clubStrength(k, y) - 6 && Math.abs(R.clubStrength(k, y) - niv) < 14);
  const all = [...pool, ...extra].sort(() => Math.random() - .5).slice(0, n);
  for (const [k, c] of all) { const rich = c.lg === "sa" ? 5 : c.lg === "us" ? .9 : k === "psg" || k === "mancity" ? 1.25 : R.clubStrength(k, y) >= 86 ? 1.1 : .8; s.offers.push({ club: k, salary: Math.max(.3, Math.round(R.fair(s) * rich * rnd(.9, 1.15) * 10) / 10), years: age >= 35 ? 1 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 3), exp: addDays(s.date, 70) }); }
  if (all.length) { GAME.news(s, { src: "Rumeur de transfert", title: `${CLUBS[all[0][0]].n} s’intéresse à ${R.short}`, text: "Jorge Mendes a reçu une proposition écrite.", ton: "neu" }); UI.flagGeneral = true; }
  return all.length;
};
R.leave = s => { if (s.club && !s.career.past.includes(s.club)) s.career.past.push(s.club); s.club = null; s.contract = null; s.rank = "libre"; };
R.window = date => { const m = parseD(date).m; return m === 7 || m === 8 || m === 1; };
R.fxCall = (s, c, out) => {
  const y = parseD(s.date).y;
  if (c.fn === "transfer") { const same = s.club === c.club; if (!same) { R.leave(s); s.club = c.club; s.flags.newClub = true; const d = s.date; const real = d < "2009-06-01" ? "manutd" : d < "2018-07-01" ? "real" : d < "2021-08-20" ? "juve" : d < "2022-11-22" ? "manutd" : "alnassr"; s.flags.clubDiverged = c.club !== real; }
    s.rank = "joueur"; s.contract = { club: c.club, salary: c.salary, until: `${y + (parseD(s.date).m >= 6 ? c.years : c.years - 1)}-06-30` }; s.offers = []; s.place = { manutd: "Carrington, Manchester", mancity: "Manchester", real: "Valdebebas, Madrid", juve: "Continassa, Turin", alnassr: "Riyad", sporting: "Alcochete, Lisbonne", intermiami: "Fort Lauderdale, Floride", psg: "Poissy, Paris" }[c.club] || CLUBS[c.club].n;
    if (!same) { s.stats.coach = 60; s.stats.vestiaire = 52; if (!s.season || s.season.club !== c.club) { const md = s.season ? s.season.md : 0; R.newSeason(s); if (parseD(s.date).m === 6) s.season.closed = true; if (parseD(s.date).m <= 5) s.season.md = Math.min(LEAGUES[CLUBS[c.club].lg].m - 1, Math.round(LEAGUES[CLUBS[c.club].lg].m * .5)); } R.press(s, "transfert", { club: c.club, salary: c.salary }); }
    out.notes.push(`Contrat : ${CLUBS[c.club].n}, ${ME(c.salary)} par an jusqu’en ${parseD(s.contract.until).y}.`); }
  else if (c.fn === "extend" && s.club) { s.contract.salary = c.salary; s.contract.until = `${y + c.years}-06-30`; out.notes.push(`Prolongation : ${ME(c.salary)} par an jusqu’en ${y + c.years}.`); }
  else if (c.fn === "force") { if (Math.random() < c.p) R.fxCall(s, { fn: "transfer", club: c.club, salary: c.salary, years: c.years }, out); else { GAME.applyFx(s, { s: { coach: -12, vestiaire: -6 } }, out); out.notes.push("Le club refuse de vous laisser partir."); } }
  else if (c.fn === "release") { R.leave(s); s.season.closed = true; out.notes.push("Vous êtes libre de tout contrat."); R.genOffers(s, 2); }
  else if (c.fn === "scout") { s.wk.scoutAt = s.week + 3; }
  else if (c.fn === "retire") { R.leave(s); s.rank = "retraite"; s.offers = []; s.nat.retired = true; s.place = "Funchal, Madère"; out.notes.push(`Fin de carrière : ${s.career.goals} buts en ${s.career.apps} matchs.`); R.press(s, "retraite"); }
  else if (c.fn === "biz") { s.biz[c.id] = y; }
  else if (c.fn === "risk") { if (Math.random() < c.p) R.injure(s); }
  else if (c.fn === "final2016") { const win = Math.random() < (c.stay ? .52 : .46); s.career.caps++; s.career.apps++; if (c.stay) R.injure(s, 5); else R.injure(s, 3);
    out.battle = { name: "Finale de l’Euro 2016", win, draw: false }; if (win) { R.trophy(s, "Euro 2016", 2016); out.notes.push("Le Portugal s’impose en prolongation : champion d’Europe pour la première fois."); } else { GAME.applyFx(s, { s: { stress: 10 } }, out); out.notes.push("La France l’emporte en prolongation."); }
    s.results.unshift({ d: s.date, line: `Finale de l’Euro 2016 : Portugal ${win ? "1-0" : "0-1"} France (a.p.)`, win, draw: false, big: true }); if (s.nat.tour) s.nat.tour.out = true; }
};

/* ---------------- Budget mensuel (millions d’euros) ---------------- */
R.biz = [
  { id: "musee", label: "Musée CR7 à Funchal", year: 2013, cost: 1.5, inc: .03, note: "Trophées et maillots exposés dans votre ville natale.", fx: { s: { popularite: 2 } } },
  { id: "cr7", label: "Marque CR7 (sous-vêtements, parfums, chaussures)", year: 2013, cost: 6, inc: .5, note: "Votre nom sur des produits vendus dans le monde entier.", fx: { s: { popularite: 1 } } },
  { id: "hotels", label: "Hôtels Pestana CR7", year: 2016, cost: 35, inc: .6, note: "Hôtels en association avec le groupe Pestana.", fx: {} },
  { id: "salles", label: "Salles de sport CR7 Fitness", year: 2016, cost: 8, inc: .25, note: "Réseau de salles en franchise.", fx: {} },
  { id: "clinique", label: "Cliniques de greffe capillaire", year: 2019, cost: 12, inc: .3, note: "Participation dans un groupe de cliniques.", fx: {} },
  { id: "youtube", label: "Chaîne YouTube", year: 2024, cost: 1, inc: .35, note: "Vidéos d’entraînement, de famille et d’entretiens.", fx: { s: { abonnes: 40, popularite: 3 } } }
];
R.budget = s => {
  const p = s.pol, st = s.stats, y = parseD(s.date).y; const rec = [], dep = [];
  const sal = s.contract && s.club ? s.contract.salary / 12 : 0; if (sal) rec.push([`Salaire (${CLUBS[s.club].n})`, sal]);
  const era = clamp((y - 1998) / 18, .2, 1.3); const pop = st.popularite / 100; const active = s.rank !== "retraite" ? 1 : .55;
  const equip = y >= 2003 ? (y >= 2016 ? 1.7 : y >= 2010 ? .9 : .25) * active : 0; rec.push(["Équipementier", equip]);
  if (p.sponsors) rec.push(["Contrats publicitaires", [0, .35, .85, 1.5][p.sponsors] * pop * 2.2 * era * active]);
  if (st.abonnes > 20 && p.social) rec.push(["Publications sponsorisées", st.abonnes / 1000 * [0, 1.2, 2.6, 4][p.social]]);
  for (const b of R.biz) if (s.biz[b.id]) rec.push([b.label.split(" (")[0], b.inc * (.6 + pop * .8) * (b.id === "youtube" ? st.abonnes / 600 : 1)]);
  const taxable = sal + rec.filter(r => /publicit|Équipementier|sponsoris/.test(r[0])).reduce((t, r) => t + r[1], 0); const rate = s.club && CLUBS[s.club].lg === "sa" ? 0 : .43; if (taxable * rate > .001) dep.push(["Impôts", taxable * rate]);
  if (sal) dep.push(["Commission de l’agent", sal * .07]);
  dep.push(["Train de vie", [.04, .12, .45][p.train] * (1 + st.fortune / 900)]);
  dep.push(["Staff personnel (kiné, cuisinier, préparateur)", [0, .015, .05][p.recup] + [0, .008, .02][p.nutrition]]);
  if (p.dons) dep.push(["Dons et œuvres caritatives", [0, .05, .2, .6][p.dons]]);
  const R_ = rec.reduce((t, x) => t + x[1], 0), D = dep.reduce((t, x) => t + x[1], 0); return { rec, dep, R: R_, D, solde: R_ - D };
};
R.fin = { stat: "fortune", unit: "M €", chartTitle: "Fortune sur les douze derniers mois, en millions d’euros",
  kpis: (s, b, f) => [["Fortune", f(s.stats.fortune)], ["Revenus par mois", "+" + b.R.toFixed(2).replace(".", ",")], ["Dépenses par mois", "−" + b.D.toFixed(2).replace(".", ",")], ["Solde par mois", sg(b.solde, 2)], ["Salaire annuel", s.contract ? ME(s.contract.salary) : "—"], ["Abonnés", `${Math.round(s.stats.abonnes)} M`]] };

/* ---------------- Simulation hebdomadaire ---------------- */
const CURVE = [[16, 58], [18, 68], [20, 77], [22, 85], [24, 90], [26, 93], [28, 95], [31, 95], [33, 93], [35, 90], [37, 86], [39, 82], [41, 78], [43, 72], [45, 64], [50, 45]];
const curve = age => { for (let i = 1; i < CURVE.length; i++) if (age <= CURVE[i][0]) { const [a0, v0] = CURVE[i - 1], [a1, v1] = CURVE[i]; return v0 + (v1 - v0) * (age - a0) / (a1 - a0); } return 40; };
R.tick = function(s, h){
  const st = s.stats, p = s.pol, age = h.age + (parseD(s.date).m - 2) / 12, out = []; const b = R.budget(s); h.add("fortune", b.solde);
  const playing = s.rank !== "retraite";
  if (playing) {
    const pot = curve(age) + [-5, -1, 1.5, 3][p.intensite] + (age > 29 ? p.nutrition * 1.2 + p.recup * 1.2 - 1.5 : 0) - (s.injury ? 2 : 0) - (!s.club ? 3 : 0);
    h.drift("niveau", pot, .09);
    if (p.focus !== "physique" && p.focus !== "recup" && s.skills[p.focus] !== undefined) s.skills[p.focus] = clamp(s.skills[p.focus] + [.0, .25, .5, .7][p.intensite] * (age < 30 ? 1 : .55) * h.dt, 30, 99);
    for (const k of Object.keys(s.skills)) if (k !== p.focus) s.skills[k] = clamp(s.skills[k] - (k === "vitesse" && age > 30 ? .22 : age > 33 ? .08 : 0) * h.dt, 30, 99);
    h.add("fatigue", [-9, -3, 3, 9][p.intensite] - p.recup * 5 - (p.focus === "recup" ? 8 : 0) + p.sponsors * 1.4 + (age > 34 ? 2 : 0)); h.drift("fatigue", 15, .3);
    h.drift("forme", 52 + p.intensite * 9 + p.nutrition * 4 + (p.focus === "physique" ? 6 : 0) - Math.max(0, st.fatigue - 55) * .7 - (s.injury ? 30 : 0), .3);
    h.drift("coach", 55, .03); h.drift("vestiaire", 55 + [-6, 0, 4][p.attitude === 0 ? 2 : p.attitude === 2 ? 0 : 1], .03);
    const ageV = age <= 29 ? 1 : age <= 31 ? .85 : age <= 33 ? .6 : age <= 35 ? .35 : age <= 37 ? .18 : .08; h.drift("valeur", Math.pow(Math.max(0, st.niveau - 60), 2) * .1 * ageV * (.8 + st.popularite / 400), .12);
    if (s.wk.scoutAt && s.week >= s.wk.scoutAt) { delete s.wk.scoutAt; if (!R.genOffers(s, 2 + Math.floor(Math.random() * 2))) out.push({ t: "Jorge Mendes a fait le tour du marché : aucune offre sérieuse pour l’instant." }); }
    s.offers = (s.offers || []).filter(o => { if (o.exp > s.date) return true; out.push({ t: `${CLUBS[o.club].n} retire son offre.` }); return false; });
    if (R.window(s.date) && s.club && st.niveau >= 80 && h.chance(.25)) R.genOffers(s, 1);
  } else { st.niveau = clamp(st.niveau - .25 * h.dt, 30, 99); h.drift("forme", 50, .1); h.add("fatigue", -6); h.drift("valeur", 0, .3); }
  h.drift("popularite", 28 + st.niveau * .45 + [0, 3, 6, 8][p.social] + [-0, 2, 5, 8][p.dons] + [2, 0, -3][p.ton] + (playing ? 0 : -8), .03);
  const y = parseD(s.date).y; if (y >= 2009) { const g = Math.max(0, (y - 2008)) * [0, .25, .6, 1][p.social] * (st.popularite / 100) * (y >= 2015 ? 1.6 : 1) * [.9, 1, 1.25][p.ton]; h.add("abonnes", g); }
  h.add("stress", p.sponsors * .7 + p.social * .5 + (st.coach < 40 ? 1.5 : 0) + (st.popularite < 40 ? 1 : 0) + (s.injury ? 1 : 0) - 2.6 - (s.wk.famW && s.week - s.wk.famW < 5 ? 1 : 0));
  h.drift("sante", 96 - Math.max(0, age - 34) * (playing ? .9 : 1.2) - Math.max(0, st.fatigue - 75) * .4 - Math.max(0, st.stress - 75) * .3 + p.nutrition * 1.5, .06);
  return out;
};

/* ---------------- Jauges, alertes, « À venir » ---------------- */
R.mainGauges = s => [{ label: "Forme physique", v: s.stats.forme }, { label: "Niveau de jeu", v: s.stats.niveau }, { label: "Popularité", v: s.stats.popularite }, { label: "Relation avec le coach", v: s.stats.coach }, { label: `Santé · ${GAME.age(s)} ans`, v: s.stats.sante }];
R.sideFacts = s => [["Valeur", ME(s.stats.valeur)], ["Abonnés", `${Math.round(s.stats.abonnes)} M`], ["Vestiaire", Math.round(s.stats.vestiaire)], ["Fatigue", Math.round(s.stats.fatigue)], ["Buts en carrière", s.career.goals], ["Ballons d’or", s.career.ballons]];
R.alerts = s => { const o = { general: [], saison: [], business: [] }; if (s.injury) o.saison.push(`Blessé : ${s.injury.name.toLowerCase()}, encore ${s.injury.w} semaine${s.injury.w > 1 ? "s" : ""}.`); if (s.stats.fatigue >= 75 && s.rank !== "retraite") o.saison.push("Fatigue très élevée : le risque de blessure grimpe."); if (s.stats.coach < 35 && s.club) o.saison.push("Le coach ne vous fait plus confiance : vous risquez le banc."); if (s.stats.fortune < 0) o.business.push("Vos comptes sont dans le rouge."); if ((s.offers || []).length) o.general.push(`${s.offers.length} offre${s.offers.length > 1 ? "s" : ""} de transfert sur la table.`); if (s.contract && s.club && s.contract.until <= addDays(s.date, 200)) o.general.push(`Votre contrat s’achève le ${frDate(s.contract.until)}.`); if (!s.club && s.rank === "libre") o.general.push("Vous êtes sans club."); return o; };
R.badges = (s, c) => ({ general: c.view !== "general" && (c.flagGeneral || (s.offers || []).length > 0), saison: c.view !== "saison" && c.al.saison.length > 0, medias: c.view !== "medias" && c.newsNew, business: c.view !== "business" && c.al.business.length > 0, messages: c.unread > 0 });
R.upcoming = s => {
  const out = []; let d = s.date, off = 0; for (let i = 0; i < 6 && out.length < 7; i++) { d = addDays(d, 7); const fs = R.fixtures(s, d, off); if (fs.some(f => f.comp === "lg")) off++; for (const f of fs) out.push({ d, t: `${f.title}${f.comp === "lg" ? "" : ""} : ${f.opp}`, k: f.big || f.final ? "Grand match" : "Match" }); }
  for (const x of s.deferred) out.push({ d: x.date, t: x.title, k: "Conséquence attendue" });
  if (s.injury) out.push({ d: addDays(s.date, s.injury.w * 7), t: "Retour de blessure prévu", k: "Santé" });
  if (s.contract && s.club) out.push({ d: s.contract.until, t: `Fin du contrat avec ${CLUBS[s.club].n}`, k: "Contrat" });
  const y = parseD(s.date).y; const win = [`${y}-07-01`, `${y + 1}-01-01`, `${y + 1}-07-01`].find(x => x > s.date); if (s.rank !== "retraite") out.push({ d: win, t: "Ouverture du marché des transferts", k: "Mercato" });
  const tn = TOURS(y) || TOURS(y + 1); const ty = TOURS(y) ? y : y + 1; const td = `${ty}-${ty === 2022 ? "11-20" : "06-10"}`; if (tn && td > s.date && !s.nat.retired) out.push({ d: td, t: `Début : ${tn}`, k: "Sélection" });
  return out.sort((a, b) => a.d.localeCompare(b.d)).slice(0, 10);
};
R.opinions = s => [["Popularité mondiale", s.stats.popularite], ["Vestiaire", s.stats.vestiaire]];
R.newsFx = (s, cat, sign) => { const v = sign * (cat === "rum" ? .3 : cat === "etr" ? .5 : .7); s.stats.popularite = clamp(s.stats.popularite + v, 0, 100); return { k: "du public", v }; };

/* ---------------- Tableau de la saison ---------------- */
R.boards = { saison: s => {
  const se = s.season; const y = se.y; const blk = (t, body) => `<div class="panel"><h2>${t}</h2>${body}</div>`;
  if (s.rank === "retraite") return blk("Carrière terminée", `<p class="note">Vous avez raccroché les crampons. ${s.career.goals} buts en ${s.career.apps} matchs, ${s.career.trophies.length} trophées, ${s.career.ballons} Ballon${s.career.ballons > 1 ? "s" : ""} d’or.</p>`) + blk("Palmarès", `<div class="tbl">${s.career.trophies.slice().reverse().map(t => `<div><span>${esc(t.n)}</span><span>${t.y}</span></div>`).join("") || "<span class='note'>Aucun trophée.</span>"}</div>`);
  if (!s.club) return blk("Sans club", `<p class="note">Vous vous entraînez seul en attendant une offre. Demandez à Jorge Mendes de sonder le marché (Vue générale, Contrats et transferts).</p>`) + blk("Derniers matchs", s.results.slice(0, 8).map(r => `<div class="res ${r.win ? "w" : r.draw ? "d" : "l"}"><small>${esc(frDate(r.d))}</small><span>${esc(r.line)}</span></div>`).join("") || "<span class='note'>—</span>");
  const lg = LEAGUES[CLUBS[s.club].lg]; const table = [[CLUBS[s.club].n, se.pts, true], ...Object.entries(se.riv).map(([k, v]) => [CLUBS[k].n, v, false])].sort((a, b) => b[1] - a[1]);
  const stg = { grp: `phase de groupes (${se.cl.pts} pts)`, r16: "qualifié pour les huitièmes", qf: "qualifié pour les quarts", sf: "qualifié pour les demi-finales", f: "en finale", out: "éliminé", won: "vainqueur" }[se.cl.stage];
  const next = R.fixtures(s, addDays(s.date, 7), 0);
  return `<div class="kpi four"><div><small>Saison ${y}-${String(y + 1).slice(2)}</small><b>${esc(CLUBS[s.club].n)}</b></div><div><small>Entraîneur</small><b>${esc(coachOf(s.club, y))}</b></div><div><small>Buts cette saison</small><b>${se.g}</b></div><div><small>Passes décisives</small><b>${se.a}</b></div><div><small>Matchs joués</small><b>${se.apps}</b></div><div><small>Buts en carrière</small><b>${s.career.goals}</b></div></div>`
    + `<div class="two-col">` + blk(`${esc(lg.n)} · journée ${se.md}/${lg.m}`, `<div class="tbl">${table.map((r, i) => `<div class="${r[2] ? "tot" : ""}"><span>${i + 1}. ${esc(r[0])}</span><span>${r[1]} pts</span></div>`).join("")}</div><p class="note" style="margin:6px 0 0">Classement des clubs de tête. Bilan : ${se.w} victoires, ${se.d} nuls, ${se.l} défaites.</p>`)
    + blk("Coupes et sélection", `<div class="tbl"><div><span>${se.cl.in ? (se.cl.asia ? "Ligue des champions d’Asie" : "Ligue des champions") : "Coupe d’Europe"}</span><span>${se.cl.in ? stg : "non qualifié"}</span></div><div><span>${esc(lg.cup)}</span><span>${se.cup.out ? (se.titles.includes(lg.cup) ? "vainqueur" : "terminé") : ["huitièmes", "quarts", "demi-finales", "finale"][se.cup.stage]}</span></div><div><span>Portugal</span><span>${s.nat.retired ? "retraite internationale" : `${s.career.caps} sélections, ${s.career.natGoals} buts`}</span></div><div><span>Ballons d’or</span><span>${s.career.ballons}</span></div><div><span>Ligues des champions</span><span>${s.career.cl}</span></div></div>`) + `</div>`
    + blk("Cette semaine et la suivante", next.length ? next.map(f => `<div class="res"><small>${esc(f.big || f.final ? "Grand match" : "Match")}</small><span>${esc(f.title)} : ${esc(f.opp)}${f.comp === "lg" || f.comp === "cl" && !f.final ? (f.home ? " (à domicile)" : " (à l’extérieur)") : ""}</span></div>`).join("") : `<span class="note">Pas de match prévu la semaine prochaine.</span>`)
    + blk("Derniers matchs", s.results.slice(0, 10).map(r => `<div class="res ${r.win ? "w" : r.draw ? "d" : "l"}"><small>${esc(frDate(r.d))}${r.note ? ` · note ${r.note.toFixed(1).replace(".", ",")}` : ""}</small><span>${esc(r.line)}</span></div>`).join("") || `<span class="note">La saison n’a pas commencé.</span>`)
    + blk("Qualités", `<div class="gauges two">${[["Finition", "finition"], ["Vitesse et dribble", "vitesse"], ["Jeu de tête", "tete"], ["Coups francs", "cf"], ["Passe", "passe"]].map(([l, k]) => `<div class="gauge"><div class="top"><span class="name">${l}</span><span class="val">${Math.round(s.skills[k])}</span></div><span class="bar"><i class="lvl-${s.skills[k] < 60 ? "warn" : "good"}" style="width:${s.skills[k]}%"></i></span></div>`).join("")}</div>`);
} };

/* ---------------- Panneaux ---------------- */
const levels = (...n) => v => n[v];
const live = (id, label, min, max, step, fmt, extra) => s => ({ k: "slider", act: "pol", arg: id, label, min, max, step, val: s.pol[id], fmt, live: v => { const old = s.pol[id]; s.pol[id] = +v; const b = R.budget(s); const ex = extra ? extra(s, +v) : ""; s.pol[id] = old; return `${ex}${ex ? " · " : ""}solde mensuel ${sg(b.solde, 2)} M €`; } });
const note = (id, label, min, max, step, fmt, txt) => s => ({ k: "slider", act: "pol", arg: id, label, min, max, step, val: s.pol[id], fmt, live: v => txt(s, +v) });
const once = (s, id) => s.wk[id] === s.week ? "Déjà fait cette semaine" : false;
const playing = s => s.rank !== "retraite";
R.panels = [
  { id: "entrainement", label: "Entraînement et santé", cond: s => true, blocks: s => !playing(s) ? [{ k: "info", html: "Vous ne vous entraînez plus en professionnel." }, { k: "btn", act: "repos", label: "Faire du sport pour le plaisir", cost: "Santé +1", dis: once(s, "repos") }] : [
    { k: "kpi", items: [["Forme", Math.round(s.stats.forme)], ["Fatigue", Math.round(s.stats.fatigue)], ["Niveau", Math.round(s.stats.niveau)], ["État", R.statusLabel(s)]] },
    note("intensite", "Intensité de l’entraînement", 0, 3, 1, levels("Légère", "Modérée", "Soutenue", "Maximale"), (s, v) => `niveau visé ${sg([-5, -1, 1.5, 3][v])} · fatigue ${sg([-9, -3, 3, 9][v])}/mois · risque de blessure ×${[.8, .9, 1, 1.25][v].toString().replace(".", ",")}`)(s),
    { k: "select", act: "pol", arg: "focus", label: "Travail spécifique", val: s.pol.focus, options: [["finition", "Finition devant le but"], ["vitesse", "Vitesse et dribble"], ["tete", "Jeu de tête et détente"], ["cf", "Coups francs"], ["passe", "Passe et jeu collectif"], ["physique", "Préparation physique (forme)"], ["recup", "Récupération (fatigue)"]], note: "La qualité travaillée progresse ; elle compte dans les actions clés des matchs." },
    live("recup", "Récupération (cryothérapie, sommeil, soins)", 0, 2, 1, levels("Ordinaire", "Suivie", "Staff personnel complet"), (s, v) => `fatigue ${sg(-v * 5)}/mois · blessures moins fréquentes`)(s),
    live("nutrition", "Nutrition", 0, 2, 1, levels("Libre", "Encadrée", "Cuisinier personnel"), (s, v) => `forme ${sg(v * 4)} · ralentit le déclin après 30 ans`)(s),
    { k: "select", act: "pol", arg: "menager", label: "Gestion des matchs", val: s.pol.menager, options: [[0, "Jouer tous les matchs"], [1, "Souffler contre les petites équipes"]], note: "Moins de matchs, moins de buts, moins de fatigue." },
    { k: "select", act: "pol", arg: "live", label: "Matchs vécus en direct", val: s.pol.live, options: [[0, "Seulement les finales"], [1, "Les grands matchs"], [2, "Tous les matchs"]], note: "Les autres sont simulés et résumés dans la fenêtre Saison." },
    { k: "btn", act: "soins", label: "Accélérer la rééducation", cost: "Retour plus rapide, risque de rechute", dis: (!s.injury && "Vous n’êtes pas blessé") || once(s, "soins"), confirm: true },
    { k: "btn", act: "repos", label: "Prendre deux jours de repos complet", cost: "Fatigue −10, coach −1", dis: once(s, "repos") }] },
  { id: "contrats", label: "Contrats et transferts", cond: s => true, blocks: s => {
    if (!playing(s)) return [{ k: "info", html: "Votre carrière de joueur est terminée." }];
    const c = s.contract; const win = R.window(s.date); const out = [{ k: "table", title: "Contrat en cours", rows: c && s.club ? [["Club", CLUBS[s.club].n], ["Salaire", ME(c.salary) + " par an"], ["Échéance", frDate(c.until)], ["Valeur marchande", ME(s.stats.valeur)], ["Salaire jugé juste par Mendes", ME(R.fair(s)) + " par an"]] : [["Situation", "Sans club"], ["Salaire jugé juste par Mendes", ME(R.fair(s)) + " par an"]] }];
    if (s.club) out.push({ k: "btn", act: "prolonger", label: "Demander une prolongation avec augmentation", cost: "Selon vos performances et le coach", dis: once(s, "prol") || (s.wk.prolY === parseD(s.date).y && "Déjà négocié cette année") });
    out.push({ k: "btn", act: "sonder", label: "Demander à Jorge Mendes de sonder le marché", cost: "Réponses sous trois semaines", dis: s.wk.scoutAt ? "Mendes est déjà au travail" : once(s, "sonder") });
    out.push({ k: "h", text: `Offres reçues${win ? "" : " · marché fermé (ouvert en janvier, juillet et août)"}` });
    if (!s.offers.length) out.push({ k: "info", html: "Aucune offre sur la table." });
    for (const o of s.offers) out.push({ k: "row", title: CLUBS[o.club].n, sub: `${ME(o.salary)} par an · ${o.years} an${o.years > 1 ? "s" : ""} · ${LEAGUES[CLUBS[o.club].lg].n} · niveau du club ${R.clubStrength(o.club, parseD(s.date).y)} · valable jusqu’au ${frDate(o.exp)}`, ctrls: [{ k: "btn", act: "offer_yes", arg: o.club, label: "Signer", dis: !win && s.club && "Marché fermé", confirm: true }, { k: "btn", act: "offer_no", arg: o.club, label: "Refuser" }] });
    out.push({ k: "h", text: "Fin de carrière" }, { k: "btn", act: "retraite", label: "Prendre sa retraite de joueur", cost: "Définitif", confirm: true });
    return out; } },
  { id: "vestiaire", label: "Vestiaire", cond: s => playing(s) && !!s.club, blocks: s => [
    { k: "kpi", items: [["Coach", `${coachOf(s.club, s.season.y)}`], ["Confiance du coach", Math.round(s.stats.coach)], ["Vestiaire", Math.round(s.stats.vestiaire)], ["Numéro", s.flags.num28 ? 28 : 7]] },
    { k: "select", act: "pol", arg: "attitude", label: "Attitude dans le groupe", val: s.pol.attitude, options: [[0, "Discret, au service du collectif"], [1, "Leader par l’exemple"], [2, "Star exigeante"]], note: "Le vestiaire suit les leaders, moins les stars." },
    { k: "btn", act: "diner", label: "Inviter l’équipe à dîner", cost: "0,05 M €, vestiaire +5", dis: once(s, "diner") || (s.wk.dinerW && s.week - s.wk.dinerW < 8 && "Trop récent") },
    { k: "btn", act: "coachtalk", label: "Parler franchement avec le coach", cost: "Résultat selon votre forme du moment", dis: once(s, "coachtalk") || (s.wk.talkW && s.week - s.wk.talkW < 6 && "Trop récent") },
    { k: "btn", act: "mentor", label: "Rester après l’entraînement avec les jeunes", cost: "Vestiaire +3, fatigue +3", dis: once(s, "mentor") }] },
  { id: "selection", label: "Équipe du Portugal", cond: s => playing(s), blocks: s => [
    { k: "table", title: "Seleção", rows: [["Sélectionneur", coachOf("portugal", parseD(s.date).y)], ["Sélections", s.career.caps], ["Buts", s.career.natGoals], ["Prochain tournoi", TOURS(parseD(s.date).y) && `${parseD(s.date).y}-06-10` > s.date ? TOURS(parseD(s.date).y) : TOURS(parseD(s.date).y + 1) || TOURS(parseD(s.date).y + 2)], ["Titres", s.career.trophies.filter(t => /Euro|nations|monde/.test(t.n)).map(t => t.n).join(", ") || "Aucun"]] },
    s.nat.retired ? { k: "info", html: "Vous avez pris votre retraite internationale." } : { k: "select", act: "pol", arg: "dispo", label: "Disponibilité", val: s.pol.dispo, options: [[0, "Répondre à toutes les convocations"], [1, "Se ménager contre les petites nations"]], note: "Les trêves internationales tombent en septembre, octobre, novembre, mars et juin." },
    s.nat.retired ? null : { k: "btn", act: "retraitenat", label: "Annoncer sa retraite internationale", cost: "Définitif", confirm: true }] },
  { id: "famille", label: "Famille", cond: s => true, blocks: s => [
    { k: "table", title: "Les proches", rows: [["Mère", "Dolores Aveiro"], ["Compagne", s.family.spouseName || "—"], ["Enfants", s.family.children.length ? s.family.children.map(c => `${c.name} (${parseD(c.born).y})`).join(", ") : "—"]] },
    { k: "btn", act: "famille", label: "Passer du temps en famille", cost: "Stress −6", dis: once(s, "famille") },
    { k: "btn", act: "madere", label: "Retourner quelques jours à Madère", cost: "Stress −10, forme −2", dis: once(s, "madere") || (s.wk.madW && s.week - s.wk.madW < 10 && "Trop récent") }] },
  { id: "image", label: "Image et médias", cond: s => true, blocks: s => [
    note("social", "Présence sur les réseaux", 0, 3, 1, levels("Aucune", "Occasionnelle", "Régulière", "Quotidienne"), (s, v) => parseD(s.date).y < 2009 ? "Les réseaux sociaux n’ont pas encore pris leur essor." : `abonnés ${["stables", "en hausse lente", "en hausse", "en forte hausse"][v]} · stress ${sg(v * .5)}/mois`)(s),
    { k: "select", act: "pol", arg: "ton", label: "Ton public", val: s.pol.ton, options: [[0, "Humble et réservé"], [1, "Confiant"], [2, "Provocateur"]], note: "La provocation fait parler, et divise." },
    live("dons", "Dons et œuvres caritatives", 0, 3, 1, levels("Aucun", "Ponctuels", "Réguliers", "Importants"), (s, v) => `popularité visée ${sg([0, 2, 5, 8][v])}`)(s),
    { k: "btn", act: "write", arg: "post", label: "Publier un message", cost: "Compte comme l’action de la semaine" },
    { k: "btn", act: "write", arg: "interview", label: "Accorder une interview", cost: "Compte comme l’action de la semaine" }] },
  { id: "business", label: "Sponsors et business", cond: s => true, blocks: s => { const y = parseD(s.date).y; return [
    live("sponsors", "Contrats publicitaires", 0, 3, 1, levels("Aucun", "Quelques partenaires", "Nombreux", "Omniprésent"), (s, v) => `fatigue ${sg(v * 1.4)}/mois · stress ${sg(v * .7)}/mois`)(s),
    live("train", "Train de vie", 0, 2, 1, levels("Sobre", "Confortable", "Fastueux"), (s, v) => ["", "", "voitures, villas, jet"][v])(s),
    { k: "h", text: "Entreprises" },
    ...R.biz.map(b => ({ k: "row", title: b.label, sub: b.note + (s.biz[b.id] ? ` Lancé en ${s.biz[b.id]}.` : ""), done: !!s.biz[b.id], ctrls: s.biz[b.id] ? [] : [{ k: "btn", act: "biz", arg: b.id, label: "Lancer", cost: ME(b.cost), dis: (y < b.year && `Pas avant ${b.year}`) || (s.stats.fortune < b.cost && `Il faut ${ME(b.cost)}`) }] }))]; } }
];
R.windows = { general: ["contrats", "vestiaire", "selection", "famille"], saison: "entrainement", medias: "image", business: "business" };
R.views = [{ id: "general", label: "Vue générale", icon: "general", kind: "general" }, { id: "saison", label: "Saison", icon: "ballon", kind: "board" }, { id: "medias", label: "Médias", icon: "presse", kind: "presse" }, { id: "business", label: "Business", icon: "finances", kind: "finances" }, { id: "messages", label: "Messages", icon: "corr", kind: "corr" }];

R.act = (s, act, arg, val) => {
  const fx = o => GAME.applyFx(s, o); const use = id => { s.wk[id] = s.week; };
  switch (act) {
    case "pol": s.pol[arg] = isNaN(+val) ? val : +val; return {};
    case "repos": use("repos"); fx({ s: { fatigue: -10, coach: playing(s) ? -1 : 0, sante: playing(s) ? 0 : 1 } }); return { msg: "Deux jours sans ballon." };
    case "soins": use("soins"); if (Math.random() < .3) { s.injury.w += 3; return { msg: "Rechute : la reprise était prématurée. Trois semaines de plus.", tone: "bad" }; } s.injury.w = Math.max(1, s.injury.w - 2); return { msg: "La rééducation avance plus vite que prévu.", tone: "good" };
    case "prolonger": { use("prol"); s.wk.prolY = parseD(s.date).y; const fair = R.fair(s); const ok = s.stats.coach >= 50 && fair > s.contract.salary * 1.05; if (ok) { const sal = Math.round((s.contract.salary + (fair - s.contract.salary) * .8) * 10) / 10; const out = { deltas: {}, rels: {}, notes: [] }; R.fxCall(s, { fn: "extend", salary: sal, years: 3 }, out); return { msg: out.notes[0], tone: "good", src: "Rumeur de transfert" }; } fx({ s: { coach: -3 } }); return { msg: fair <= s.contract.salary * 1.05 ? "Le club estime que votre salaire reflète déjà votre niveau." : "Le club refuse de discuter tant que la confiance du coach n’est pas rétablie.", tone: "bad" }; }
    case "sonder": use("sonder"); s.wk.scoutAt = s.week + 3; fx({ r: { mendes: 2 } }); return { msg: "Jorge Mendes commence sa tournée des clubs." };
    case "offer_no": s.offers = s.offers.filter(o => o.club !== arg); return { msg: `Offre de ${CLUBS[arg].n} déclinée.` };
    case "offer_yes": { const o = s.offers.find(x => x.club === arg); if (!o) return {}; if (s.club && s.contract && parseD(s.contract.until).y - parseD(s.date).y >= 2 && s.stats.niveau >= 88 && Math.random() < .45) { s.offers = s.offers.filter(x => x !== o); fx({ s: { coach: -6, vestiaire: -4 } }); return { msg: `${CLUBS[s.club].n} vous déclare intransférable : l’offre de ${CLUBS[o.club].n} est repoussée.`, tone: "bad", src: "Rumeur de transfert" }; } const out = { deltas: {}, rels: {}, notes: [] }; R.fxCall(s, { fn: "transfer", club: o.club, salary: o.salary, years: o.years }, out); s.history.push({ date: s.date, id: "tr-" + s.week, kind: "transfert", title: "Transfert", choice: `Signature à ${CLUBS[o.club].n}`, hist: null, histExists: false, outcome: out.notes[0] }); return { msg: out.notes[0], tone: "good", sfx: "crowd" }; }
    case "retraite": { const out = { deltas: {}, rels: {}, notes: [] }; R.fxCall(s, { fn: "retire" }, out); s.history.push({ date: s.date, id: "ret", kind: "transfert", title: "Fin de carrière", choice: "Retraite annoncée", hist: null, histExists: false, outcome: out.notes[0] }); return { msg: out.notes[0], sfx: "crowd" }; }
    case "retraitenat": s.nat.retired = true; fx({ s: { popularite: -2, fatigue: -5 } }); R.press(s, "retraitenat"); return { msg: `Retraite internationale : ${s.career.caps} sélections, ${s.career.natGoals} buts avec le Portugal.` };
    case "diner": use("diner"); s.wk.dinerW = s.week; fx({ s: { fortune: -.05, vestiaire: 5 } }); return { msg: "Dîner d’équipe : l’ambiance se détend." };
    case "coachtalk": { use("coachtalk"); s.wk.talkW = s.week; const good = s.stats.forme + s.stats.niveau > 135 + Math.random() * 30; fx({ s: { coach: good ? 7 : -5 } }); return { msg: good ? "Le coach apprécie votre franchise et vous confirme son plan." : "La discussion tourne court : le coach vous demande d’abord de le prouver sur le terrain.", tone: good ? "good" : "bad" }; }
    case "mentor": use("mentor"); fx({ s: { vestiaire: 3, fatigue: 3 } }); return { msg: "Séance supplémentaire avec les jeunes." };
    case "famille": use("famille"); s.wk.famW = s.week; fx({ s: { stress: -6 }, r: { dolores: 1, georgina: 1 } }); return { msg: "Une soirée en famille." };
    case "madere": use("madere"); s.wk.madW = s.week; fx({ s: { stress: -10, forme: -2 }, r: { dolores: 4 } }); return { msg: "Quelques jours à Funchal." };
    case "biz": { const b = R.biz.find(x => x.id === arg); s.stats.fortune -= b.cost; s.biz[b.id] = parseD(s.date).y; fx(b.fx); s.history.push({ date: s.date, id: "biz-" + b.id, kind: "business", title: "Business", choice: `Lancement : ${b.label}`, hist: null, histExists: false, outcome: "" }); return { msg: `Lancement : ${b.label}.`, tone: "good", src: "Carnet" }; }
  }
  return {};
};

/* ---------------- Parole : types d’action libre selon l’époque ---------------- */
R.speech = [
  { id: "post", label: "Post sur les réseaux", hint: "Un message public, avec ou sans photo.", ph: "Ex. : Fier de cette équipe. On continue. 💪", photo: true, cond: s => s.date >= "2010-06-01" },
  { id: "interview", label: "Interview", hint: "Un journaliste pose deux ou trois questions ; vos réponses sont publiées.", ph: "", flow: "interview" },
  { id: "conference", label: "Conférence de presse", hint: "Déclaration devant les journalistes, avant ou après un match.", ph: "Ex. : Je suis venu ici pour gagner des titres. Les critiques ne m’intéressent pas…" },
  { id: "communique", label: "Communiqué officiel", hint: "Texte diffusé par votre entourage ou votre agent.", ph: "Ex. : Cristiano Ronaldo tient à démentir les informations parues ce matin…" },
  { id: "live", label: "Live ou vidéo spontanée", hint: "Une prise de parole directe, sans filtre.", ph: "Ex. : En direct depuis la salle de sport, je réponds aux questions des fans…", cond: s => s.date >= "2016-01-01" },
  { id: "rumeur", label: "Rumeur à faire fuiter", hint: "Une information glissée à la presse par un proche ou par votre agent.", ph: "Ex. : Faire savoir que deux grands clubs se renseignent, pour presser la direction de prolonger…" }
];
R.advisors = [{ rel: "mendes", name: "Jorge Mendes", role: "agent", style: "pragmatique, protecteur, pense image, contrats et valeur marchande" }];
R.advisor = s => R.advisors[0];
R.newsSources = s => ["A Bola", "Marca", "L’Équipe", "La Gazzetta dello Sport", "BBC Sport", "Record", "Réseaux sociaux", "Forum de supporters", "Rumeur de transfert"];
R.newsCat = src => { const x = String(src || "").toLowerCase(); if (/carnet|conséquence/.test(x)) return "sys"; if (/rumeur|mercato|transfert/.test(x)) return "rum"; if (/réseau|twitter|instagram|forum|supporter|fan|youtube|tiktok|facebook/.test(x)) return "etr"; return "fr"; };
R.pressCats = [["tous", "Tout"], ["fr", "Presse sportive"], ["etr", "Réseaux et supporters"], ["rum", "Rumeurs de transfert"], ["sys", "Carnet"]];
R.tonLabel = { fav: "Favorable", neu: "Neutre", hos: "Hostile" };
R.publicLabel = "Chez les supporters";
R.press = (s, kind, d) => {
  const A = (src, ton, title, text) => ({ src, ton, title, text }); let arts = []; const papers = ["A Bola", "Marca", "L’Équipe", "La Gazzetta dello Sport", "BBC Sport", "Record"]; const pp = () => papers[Math.floor(Math.random() * papers.length)]; const soc = parseD(s.date).y >= 2010 ? "Réseaux sociaux" : "Forum de supporters";
  if (kind === "match") { const g = d.res.goals; if (d.res.played && g >= 3) arts = [A(pp(), "fav", `Triplé de Ronaldo : ${d.f.opp} balayé`, d.line + "."), A(soc, "fav", "Les supporters s’enflamment", "Les images de ses buts tournent en boucle.")];
    else if (d.win && d.res.played && g >= 1) arts = [A(pp(), "fav", `Ronaldo décisif : ${d.f.title}`, d.line + ".")];
    else if (d.win) arts = [A(pp(), "neu", `Victoire sans éclat pour Ronaldo`, d.line + ".")];
    else if (!d.win && !d.draw && d.res.played && g === 0) arts = [A(pp(), "hos", `Soirée sans pour Ronaldo`, d.line + "."), A(soc, "hos", "Les critiques pleuvent", "Certains supporters lui reprochent ses choix dans les moments chauds.")];
    else arts = [A(pp(), "neu", d.f.title, d.line + ".")]; }
  else if (kind === "transfert") arts = [A("Marca", "neu", `Officiel : Ronaldo signe à ${CLUBS[d.club].n}`, `Contrat estimé à ${ME(d.salary)} par an.`), A(soc, "fav", "Les ventes de maillots s’envolent", "Le numéro 7 est déjà en rupture dans les boutiques du club.")];
  else if (kind === "blessure") arts = [A(pp(), "neu", "Ronaldo à l’infirmerie", `Son absence est estimée à ${d.w} semaines.`)];
  else if (kind === "trophee") arts = [A(pp(), "fav", `${d.name} : un trophée de plus pour Ronaldo`, "Son palmarès s’allonge encore.")];
  else if (kind === "ballon") arts = [A("L’Équipe", d.won ? "fav" : "neu", d.won ? "Ronaldo, Ballon d’or" : "Ronaldo sur le podium du Ballon d’or", d.won ? "Le jury le place au sommet du football mondial." : "Le trophée lui échappe cette année.")];
  else if (kind === "retraite") arts = [A("A Bola", "fav", "Ronaldo raccroche", "Le Portugal salue l’un des plus grands joueurs de l’histoire.")];
  else if (kind === "retraitenat") arts = [A("Record", "neu", "Ronaldo quitte la sélection", "Le capitaine laisse sa place.")];
  else if (kind === "evenement") arts = [A(pp(), "neu", d.title, d.res || "")];
  for (const a of arts.reverse()) GAME.news(s, a); return arts;
};
R.aiState = s => `SITUATION SPORTIVE : ${s.rank === "retraite" ? "retraité" : s.club ? `${CLUBS[s.club].n} (${LEAGUES[CLUBS[s.club].lg].n}), entraîneur ${coachOf(s.club, s.season.y)}, contrat ${s.contract.salary} M€ par an jusqu’au ${frDate(s.contract.until)}` : "sans club"}. Saison en cours : ${s.season.g} buts, ${s.season.a} passes décisives en ${s.season.apps} matchs ; ${s.season.pts} points après ${s.season.md} journées. Carrière : ${s.career.goals} buts en ${s.career.apps} matchs, ${s.career.caps} sélections (${s.career.natGoals} buts), ${s.career.ballons} Ballon(s) d’or, ${s.career.cl} Ligue(s) des champions. ${s.injury ? `Blessé : ${s.injury.name}, ${s.injury.w} semaines.` : ""} Offres de transfert : ${(s.offers || []).map(o => CLUBS[o.club].n).join(", ") || "aucune"}. Entreprises : ${Object.keys(s.biz).join(", ") || "aucune"}.\nDERNIERS MATCHS :\n${s.results.slice(0, 5).map(r => "- " + r.line).join("\n") || "- aucun"}`;

/* ---------------- Messages ---------------- */
R.persona = { dolores: "mère aimante et fière, simple, croyante, inquiète pour sa santé", katia: "sœur complice, enthousiaste, protectrice", mendes: "agent pragmatique et protecteur ; parle contrats, image et opportunités", ferguson: "manager exigeant et paternel ; discipline, travail, sens du collectif", scolari: "sélectionneur chaleureux et autoritaire, esprit de groupe", rooney: "coéquipier direct, compétiteur, humour de vestiaire", messi: "rival respectueux et réservé ; répond brièvement, parle peu de lui", pepe: "ami fidèle, guerrier, parle franc", perez: "président courtois et calculateur ; pense institution et marque du club", ramos: "capitaine fier, compétiteur, parle au nom du vestiaire", marcelo: "ami joyeux, blagueur, loyal", benzema: "coéquipier discret, tourné vers le jeu collectif", mourinho: "entraîneur exigeant, direct, piquant, protecteur de ses joueurs en public", ancelotti: "entraîneur calme, diplomate, proche des joueurs", santos: "sélectionneur prudent, pragmatique, croyant", zidane: "entraîneur sobre, respectueux, peu de mots", georgina: "compagne attentive, tournée vers la famille", mbappe: "jeune star admirative et ambitieuse, polie", bruno: "coéquipier respectueux, compétiteur", allegri: "entraîneur pragmatique, ironique, gestionnaire", tenhag: "entraîneur méthodique, ferme sur les règles collectives", martinez: "sélectionneur diplomate, positif, méthodique" };
R.contactGroups = [["Famille", ["dolores", "katia", "georgina"]], ["Entourage", ["mendes", "perez"]], ["Entraîneurs", ["ferguson", "scolari", "mourinho", "ancelotti", "zidane", "santos", "allegri", "tenhag", "martinez"]], ["Joueurs", ["rooney", "pepe", "ramos", "marcelo", "benzema", "bruno", "messi", "mbappe"]]];
R.contactLoc = (s, id) => "ligne"; R.mailDays = (s, id) => 0;
const _rn = R.regionName; R.regionName = id => id === "ligne" ? "par message" : _rn(id);
R.mailScripts = [{ id: "dolores", t: "Mon fils, je t’ai vu à la télévision. Tu as l’air fatigué. Mange bien et appelle-moi quand tu peux." }, { id: "mendes", t: "J’ai eu deux appels cette semaine à ton sujet. Rien de concret encore, mais on parle de toi. Dis-moi ce que tu veux pour la suite." }, { id: "katia", t: "Toute la famille a regardé le match ensemble. On est fiers de toi, comme toujours." }, { id: "ferguson", t: "Bon travail ces dernières semaines. N’oublie pas : le talent ne suffit pas, c’est le travail quotidien qui fait la différence." }, { id: "pepe", t: "Irmão, on se voit bientôt en sélection. Prépare-toi, cette fois on va au bout." }, { id: "marcelo", t: "Tu as vu ma passe ? La prochaine fois tu me rends la pareille, d’accord ?" }];
R.mailFallback = (s, id) => (s.rel[id] || 0) >= 40 ? "Bien reçu. On en reparle très vite, compte sur moi." : (s.rel[id] || 0) >= -15 ? "Message reçu. Je te réponds dès que possible." : "J’ai vu ton message.";

/* ---------------- Rivaux ---------------- */
R.rivals = [
  { id: "messi", name: "Lionel Messi", plans: [{ plan: "Enchaîner les buts pour le Ballon d’or", news: ["Messi marque encore un triplé", "Messi, nouveau record de buts sur une année"], done: { s: { stress: 4, popularite: -1 } }, title: "Messi prend la tête de la course au Ballon d’or" }, { plan: "Gagner un grand titre avec l’Argentine", news: ["L’Argentine de Messi enchaîne les victoires", "Messi porte sa sélection"], done: { s: { stress: 3 } }, title: "Messi soulève un trophée avec l’Argentine" }] },
  { id: "rivalclub", name: "Le grand rival du club", plans: [{ plan: "Recruter une star pour vous barrer la route", news: ["Le rival annonce une recrue de premier plan", "Un transfert record chez le concurrent direct"], done: { s: { stress: 3, valeur: -2 } }, title: "Le rival présente sa nouvelle star" }, { plan: "Monter une série de victoires en championnat", news: ["Le rival enchaîne une huitième victoire de suite", "Le concurrent direct ne lâche rien"], done: { s: { stress: 4, coach: -2 } }, title: "Le rival prend le large en tête" }] },
  { id: "releve", name: "La nouvelle génération", plans: [{ plan: "S’imposer comme les nouveaux visages du football", news: ["Un attaquant de 20 ans affole les compteurs", "La presse parle déjà de succession"], done: { s: { popularite: -2, stress: 3 } }, title: "La relève fait la une" }] }
];
R.audio = { tempo: 116, root: 110, scale: [0, 3, 5, 7, 10], style: "stade" };
R.endTiles = (s, x) => [["Buts en carrière", String(s.career.goals), "Réalité : plus de 900"], ["Ballons d’or", String(s.career.ballons), "Réalité : 5"], ["Ligues des champions", String(s.career.cl), "Réalité : 5"], ["Sélections · buts", `${s.career.caps} · ${s.career.natGoals}`, "Réalité : plus de 220 sélections"], ["Trophées", String(s.career.trophies.length), s.career.trophies.slice(-3).map(t => t.n).join(", ") || "Aucun"], ["Fidélité à la réalité", `${x.fidelity} %`, `${x.same} choix sur ${x.total} comme le vrai Ronaldo`]];

/* ---------------- Match en direct : situations et options ---------------- */
R.matchSkill = (s, k) => k === "physique" ? s.stats.forme : (s.skills[k] || 70);
R.moments = [
  { txt: "Lancé dans la profondeur, vous vous présentez seul face au gardien.", opts: [{ id: "frappe", label: "Frapper", sk: "finition", base: .46, goal: true }, { id: "dribble", label: "Dribbler le gardien", sk: "vitesse", base: .36, goal: true, bonus: .3 }, { id: "passe", label: "Passer au coéquipier démarqué", sk: "passe", base: .62, assist: true }] },
  { txt: "Coup franc à vingt-cinq mètres, légèrement sur la gauche. Le mur se place.", opts: [{ id: "cf", label: "Coup franc direct", sk: "cf", base: .17, goal: true, bonus: .4 }, { id: "centre", label: "Centrer au second poteau", sk: "passe", base: .3, assist: true }, { id: "court", label: "Jouer court", sk: "passe", base: .9, none: true }] },
  { txt: "Un centre arrive de l’aile droite, à hauteur du point de penalty.", opts: [{ id: "tete", label: "Reprendre de la tête", sk: "tete", base: .36, goal: true }, { id: "volee", label: "Tenter la volée", sk: "finition", base: .22, goal: true, bonus: .5 }, { id: "remise", label: "Remettre en retrait", sk: "passe", base: .5, assist: true }] },
  { txt: "Contre-attaque : vous partez du milieu de terrain avec un défenseur devant vous.", opts: [{ id: "dribble", label: "Dribbler", sk: "vitesse", base: .4, goal: true, bonus: .3 }, { id: "loin", label: "Frapper de loin", sk: "finition", base: .13, goal: true, bonus: .5 }, { id: "passe", label: "Décaler un partenaire", sk: "passe", base: .48, assist: true }] },
  { txt: "Penalty ! L’arbitre désigne le point. Le gardien vous fixe.", pen: true, opts: [{ id: "droite", label: "À ras de terre, à droite", sk: "finition", base: .8, goal: true }, { id: "gauche", label: "En hauteur, à gauche", sk: "finition", base: .76, goal: true, bonus: .1 }, { id: "panenka", label: "Une panenka", sk: "finition", base: .62, goal: true, bonus: .5 }] },
  { txt: "Ballon récupéré à l’entrée de la surface, deux défenseurs reviennent sur vous.", opts: [{ id: "frappe", label: "Frapper tout de suite", sk: "finition", base: .26, goal: true }, { id: "dribble", label: "Passement de jambes et crochet", sk: "vitesse", base: .3, goal: true, bonus: .3 }, { id: "passe", label: "Passer dans la course d’un coéquipier", sk: "passe", base: .44, assist: true }] }
];
})();
</script>
