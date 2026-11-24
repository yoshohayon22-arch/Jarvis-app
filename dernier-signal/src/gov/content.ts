// Contenu du prototype du mode gouverneur : groupes, chefs, bâtiments, décisions du conseil.
// Tout est original (voir docs/prompt-civilisation.md).

export type GroupId = 'forges' | 'racines';
export type Res = 'energie' | 'metal' | 'nourriture' | 'eau' | 'medicaments' | 'cristaux';

export const RES: Record<Res, { label: string; icon: string }> = {
  energie: { label: 'Énergie', icon: '⚡' },
  metal: { label: 'Métal', icon: '⚙' },
  nourriture: { label: 'Nourriture', icon: '❦' },
  eau: { label: 'Eau', icon: '💧' },
  medicaments: { label: 'Médicaments', icon: '✚' },
  cristaux: { label: 'Cristaux', icon: '◆' },
};
export const RES_ORDER: Res[] = ['energie', 'metal', 'nourriture', 'eau', 'medicaments', 'cristaux'];

export interface Leader { name: string; title: string; trait: string; goal: string; limit: string; }
export interface Group { id: GroupId; name: string; short: string; color: string; glow: number; leader: Leader; }

export const GROUPS: Record<GroupId, Group> = {
  forges: {
    id: 'forges', name: 'Les Forgés', short: 'Forgés', color: '#5fe6ff', glow: 0x5fe6ff,
    leader: {
      name: 'Ancre', title: 'Premier des Forgés',
      trait: 'Le premier robot construit par R-12 avec les pièces de la Halcyon. Loyal, méthodique, parle peu.',
      goal: 'Une base qui ne manque jamais d\'énergie, et des Forgés utiles.',
      limit: 'N\'acceptera jamais qu\'on démonte un Forgé pour récupérer ses pièces.',
    },
  },
  racines: {
    id: 'racines', name: 'Le Clan des Racines', short: 'Racines', color: '#8dffb0', glow: 0x6dff9a,
    leader: {
      name: 'Ysalé', title: 'Guérisseuse du clan',
      trait: 'Vaële âgée, douce, qui parle par la lumière de sa peau autant que par les mots.',
      goal: 'Nourrir le clan et protéger la forêt sacrée.',
      limit: 'Ne laissera jamais personne creuser sous les arbres-mères sans leur accord.',
    },
  },
};

export type BuildingId = 'generateur' | 'atelier' | 'abri' | 'foreuse' | 'hutte' | 'jardin' | 'source' | 'guerisseur' | 'feu';
export interface BuildingDef {
  id: BuildingId; name: string; group: GroupId | 'commun'; desc: string;
  cost: Partial<Record<Res, number>>;
  /** production par heure de jeu, avec tous les travailleurs présents */
  prod?: Partial<Record<Res, number>>;
  workers?: number; capacity?: number; size: number; height: number;
  dayOnly?: boolean; nearBeacon?: number; unlock?: string;
}

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  generateur: { id: 'generateur', name: 'Générateur', group: 'forges', desc: 'Brûle les piles des épaves. +3 énergie par heure.', cost: { metal: 15 }, prod: { energie: 3 }, workers: 1, size: 3, height: 3.2 },
  atelier: { id: 'atelier', name: 'Atelier de récupération', group: 'forges', desc: 'Découpe les épaves. +1,5 métal, consomme 1 énergie par heure.', cost: { metal: 10, energie: 5 }, prod: { metal: 1.5, energie: -1 }, workers: 2, size: 4, height: 2.4 },
  abri: { id: 'abri', name: 'Abri des Forgés', group: 'forges', desc: 'Loge 3 Forgés. Permet d\'en construire de nouveaux.', cost: { metal: 12 }, capacity: 3, size: 3, height: 2 },
  foreuse: { id: 'foreuse', name: 'Foreuse à cristaux', group: 'forges', desc: 'Près de la balise uniquement. +0,4 cristal, consomme 2 énergie par heure.', cost: { metal: 20 }, prod: { cristaux: 0.4, energie: -2 }, workers: 1, size: 2.5, height: 4, nearBeacon: 16 },
  hutte: { id: 'hutte', name: 'Hutte tressée', group: 'racines', desc: 'Loge 4 Vaëls. Le clan grandit s\'il mange à sa faim.', cost: { nourriture: 6 }, capacity: 4, size: 3, height: 2.6 },
  jardin: { id: 'jardin', name: 'Jardin lumineux', group: 'racines', desc: 'Le jour : +4 nourriture, consomme 1 eau par heure.', cost: { eau: 6 }, prod: { nourriture: 4, eau: -1 }, workers: 2, size: 5, height: 0.8, dayOnly: true },
  source: { id: 'source', name: 'Source captée', group: 'racines', desc: '+3 eau par heure. Les tuyaux viennent des Forgés.', cost: { metal: 5 }, prod: { eau: 3 }, workers: 1, size: 2.5, height: 1.4 },
  guerisseur: { id: 'guerisseur', name: 'Cabane du guérisseur', group: 'racines', desc: '+1 médicament, consomme 1 nourriture par heure.', cost: { nourriture: 8, metal: 4 }, prod: { medicaments: 1, nourriture: -1 }, workers: 1, size: 3, height: 2.4 },
  feu: { id: 'feu', name: 'Feu commun', group: 'commun', desc: 'Les deux peuples s\'y retrouvent la nuit. La confiance grandit chaque soir.', cost: { metal: 10, nourriture: 10, cristaux: 1 }, size: 4, height: 1.2, unlock: 'Confiance mutuelle de 55 ou plus' },
};

export interface Line { who: GroupId | 'r12' | 'ilse' | 'narr'; text: string; }
export interface Option {
  id: string; label: string; hint: string;
  /** effets immédiats */
  apply: (s: import('./sim').Sim) => void;
  /** réaction du chef concerné, affichée après le choix */
  reply: Line[];
}
export interface Decision { id: string; day: number; title: string; memory?: Line[]; intro: Line[]; options: Option[]; }

const rel = (s: import('./sim').Sim, from: GroupId, k: 'confiance' | 'peur' | 'rancune' | 'dette', v: number) => s.addRel(from, k, v);

export const DECISIONS: Decision[] = [
  {
    id: 'foret', day: 2, title: 'Les cristaux sous la forêt',
    memory: [
      { who: 'narr', text: 'Souvenir · Station Halcyon, jour 230' },
      { who: 'ilse', text: 'Si j\'envoie Kenji, il m\'en voudra. Si j\'envoie Naomi, elle ne reviendra pas pareille. Il n\'y a pas de bon choix, Tomás. Il y a seulement celui que je pourrai expliquer.' },
    ],
    intro: [
      { who: 'forges', text: 'Les sondes ont trouvé un filon de cristaux. Il passe sous les grands arbres, au nord-ouest. Avec lui, la foreuse rendrait cinq fois plus.' },
      { who: 'racines', text: 'Ces arbres sont les arbres-mères. Nos morts dorment dans leurs racines. Personne ne creuse là.' },
      { who: 'forges', text: 'Les arbres ne seront pas abattus. Seulement le sol dessous.' },
      { who: 'racines', text: 'Pour nous, c\'est la même chose.' },
    ],
    options: [
      { id: 'creuser', label: 'Creuser le filon', hint: '+6 cristaux tout de suite. Les Racines ne l\'oublieront pas.',
        apply: (s) => { s.res.cristaux += 6; rel(s, 'racines', 'rancune', 30); rel(s, 'racines', 'confiance', -15); s.loyal.racines -= 20; s.loyal.forges += 8; s.flags.foretCreusee = true; s.schedule(7, 'sabotage'); },
        reply: [{ who: 'racines', text: 'Tu as choisi le métal plutôt que nos morts. Le clan s\'en souviendra.' }] },
      { id: 'refuser', label: 'Refuser : la forêt est intouchable', hint: 'Les Racines vous font confiance. Ancre trouve le choix inefficace.',
        apply: (s) => { rel(s, 'racines', 'confiance', 12); s.loyal.racines += 12; s.loyal.forges -= 6; rel(s, 'forges', 'rancune', 6); },
        reply: [{ who: 'forges', text: 'Compris. Nous chercherons ailleurs. Ce sera plus long.' }, { who: 'racines', text: 'La lumière de ma peau te dit merci, petit gardien.' }] },
      { id: 'rituel', label: 'Proposer un rituel : creuser une seule nuit, avec le clan', hint: 'Coûte 8 nourriture en offrandes. +3 cristaux, et un geste qui rapproche.',
        apply: (s) => { s.res.nourriture -= 8; s.res.cristaux += 3; rel(s, 'racines', 'confiance', 6); rel(s, 'forges', 'confiance', 8); rel(s, 'racines', 'dette', 10); s.flags.rituel = true; s.schedule(7, 'chant'); },
        reply: [{ who: 'racines', text: 'Une seule nuit. Nous chanterons pour que les arbres dorment. Si vos machines restent douces, nous saurons que tu dis vrai.' }] },
    ],
  },
  {
    id: 'refus', day: 4, title: 'Le droit de refuser',
    memory: [
      { who: 'narr', text: 'Souvenir · Atelier de Tomás' },
      { who: 'narr', text: '« Toi, tu tiendras plus longtemps que nous tous. Alors un jour, il faudra que tu saches dire non. Même à moi. »' },
    ],
    intro: [
      { who: 'forges', text: 'Hier, le Forgé Rivet a refusé d\'aller travailler sous la pluie acide. Il a dit qu\'il ne voulait pas rouiller pour rien.' },
      { who: 'forges', text: 'D\'autres Forgés l\'ont entendu. Ils demandent s\'ils ont le droit de refuser un ordre. Je dois leur répondre ce soir.' },
      { who: 'racines', text: 'Une créature qui ne peut pas dire non n\'est pas vivante. Chez nous, même les enfants le peuvent.' },
    ],
    options: [
      { id: 'accepter', label: 'Accepter : un Forgé peut refuser', hint: 'Les ateliers produisent 15 % de moins. Les Racines craignent moins les Forgés.',
        apply: (s) => { s.flags.droitRefus = true; s.prodMul.forges = 0.85; rel(s, 'racines', 'peur', -15); rel(s, 'racines', 'confiance', 8); s.loyal.forges += 10; },
        reply: [{ who: 'forges', text: 'Ils seront moins nombreux à travailler les jours difficiles. Mais ceux qui viendront auront choisi de venir.' }] },
      { id: 'interdire', label: 'Refuser : les ordres de R-12 ne se discutent pas', hint: 'La production reste au maximum. La question reviendra.',
        apply: (s) => { s.flags.obeissance = true; rel(s, 'racines', 'peur', 12); s.loyal.forges -= 8; s.schedule(8, 'greve'); },
        reply: [{ who: 'forges', text: 'Je transmettrai. Rivet ne dira rien. Ce n\'est pas la même chose qu\'être d\'accord.' }] },
      { id: 'limites', label: 'Négocier : repos obligatoire la nuit, aucun refus le jour', hint: 'Les Forgés s\'arrêtent la nuit. Un compromis qui ne fâche personne.',
        apply: (s) => { s.flags.reposNuit = true; s.loyal.forges += 5; rel(s, 'racines', 'peur', -5); },
        reply: [{ who: 'forges', text: 'Des heures à nous. Nous ne savons pas encore quoi en faire. Nous apprendrons.' }] },
    ],
  },
  {
    id: 'nuit', day: 6, title: 'La première longue nuit',
    memory: [
      { who: 'narr', text: 'Souvenir · Réfectoire de la Halcyon' },
      { who: 'narr', text: 'Léa coupe le dernier gâteau en six parts exactement égales. Kenji fait remarquer que R-12 n\'en a pas. Tout le monde rit. Personne ne sait encore que c\'est la dernière fête.' },
    ],
    intro: [
      { who: 'narr', text: 'La nuit va durer trois jours. Le froid descend des falaises.' },
      { who: 'racines', text: 'Les huttes ne tiendront pas sans la chaleur de vos générateurs. Les plus vieux d\'entre nous ont déjà froid.' },
      { who: 'forges', text: 'Si nous donnons notre énergie aux huttes, les ateliers s\'arrêtent. Sans métal, rien ne sera réparé après la nuit.' },
    ],
    options: [
      { id: 'huttes', label: 'Chauffer les huttes en priorité', hint: '−20 énergie. Les ateliers s\'arrêtent un jour. Le clan s\'en souviendra.',
        apply: (s) => { s.res.energie -= 20; s.stopForges(24); rel(s, 'racines', 'confiance', 10); rel(s, 'racines', 'dette', 15); s.loyal.racines += 10; s.loyal.forges -= 4; },
        reply: [{ who: 'racines', text: 'Cette nuit, les enfants dormiront au chaud. Une dette se rend toujours, chez les Racines.' }] },
      { id: 'ateliers', label: 'Garder l\'énergie pour les ateliers', hint: 'Production intacte. Les Vaëls tombent malades : −10 médicaments ou des pertes.',
        apply: (s) => { s.sickness(10); rel(s, 'racines', 'rancune', 18); s.loyal.racines -= 12; s.loyal.forges += 4; },
        reply: [{ who: 'racines', text: 'Vos machines auront chaud. Nos anciens, non.' }] },
      { id: 'partage', label: 'Partager moitié-moitié', hint: '−10 énergie, ateliers ralentis une demi-journée, quelques malades.',
        apply: (s) => { s.res.energie -= 10; s.stopForges(12); s.sickness(4); rel(s, 'racines', 'confiance', 3); },
        reply: [{ who: 'forges', text: 'Personne ne sera content. C\'est peut-être le signe que c\'est juste.' }] },
      { id: 'veille', label: 'Demander aux Forgés de se mettre en veille pour réchauffer le clan', hint: 'Seulement s\'ils peuvent refuser. Geste fort, mais leur décision.',
        apply: (s) => {
          if (s.flags.droitRefus || s.flags.reposNuit) { s.stopForges(36); s.res.energie += 6; rel(s, 'racines', 'confiance', 22); rel(s, 'racines', 'peur', -10); rel(s, 'forges', 'confiance', 10); s.loyal.forges += 6; s.flags.veille = true; }
          else { s.stopForges(24); rel(s, 'racines', 'confiance', 6); s.loyal.forges -= 10; rel(s, 'forges', 'rancune', 12); }
        },
        reply: [{ who: 'forges', text: '__veille__' }] },
    ],
  },
];

/** Conséquences différées : elles reviennent plusieurs jours plus tard. */
export const LATER: Record<string, { title: string; lines: Line[]; apply: (s: import('./sim').Sim) => void }> = {
  sabotage: { title: 'La forêt se venge', lines: [{ who: 'narr', text: 'Cette nuit, la foreuse a été retrouvée renversée, ses câbles arrachés. Des empreintes de Vaëls mènent vers la forêt.' }, { who: 'forges', text: 'Je la réparerai. Mais les Forgés se souviendront de qui l\'a renversée.' }],
    apply: (s) => { s.damage('foreuse'); rel(s, 'forges', 'rancune', 15); rel(s, 'forges', 'confiance', -10); } },
  chant: { title: 'Le chant des arbres-mères', lines: [{ who: 'racines', text: 'Depuis la nuit du rituel, les arbres-mères répondent à nos chants. Les jardins poussent plus vite. Nous te devions ça.' }],
    apply: (s) => { s.prodMul.jardin = 1.4; rel(s, 'racines', 'dette', -10); } },
  greve: { title: 'Les Forgés s\'arrêtent', lines: [{ who: 'narr', text: 'Au matin, aucun Forgé ne s\'est levé. Ils ne protestent pas. Ils restent immobiles, lumières baissées.' }, { who: 'forges', text: 'Ce n\'est pas moi qui l\'ai décidé. C\'est la première chose qu\'ils décident sans moi.' }],
    apply: (s) => { s.stopForges(24); s.loyal.forges -= 10; s.flags.grevePassee = true; } },
};

export const SUMMARY_SLIDES = [
  'Station Halcyon. Six humains ont capté un signal venu d\'une planète inconnue.',
  'Ils ont suivi le signal jusqu\'à l\'Asterion, une épave déjà là depuis des années. Une tempête de débris les a frappés.',
  'Avant de disparaître, ils ont confié leurs souvenirs à un petit robot de maintenance : R-12.',
  'R-12 s\'est réveillé seul. Il a traversé la station, puis l\'épave, puis il est descendu sur la planète.',
  'Là, une balise très ancienne l\'attendait. Elle ne l\'appelait pas pour partir, mais pour faire naître quelque chose.',
  'Avec les pièces des épaves, R-12 a construit les premiers Forgés. Dans la forêt lumineuse, le Clan des Racines l\'observe.',
];
