// Textes de la Zone 1 — Station Halcyon. Ton sobre, humain, jamais spectaculaire.

export interface LogEntry { id: string; crew: string; title: string; place: string; day: string; kind: 'audio' | 'texte'; lines: { crew: string; text: string }[]; secret?: boolean; }
export interface HoloLine { crew: string; text: string; gesture?: 'point' | 'arms' | 'turn' | 'head' | 'none'; }
export interface HoloEntry { id: string; title: string; place: string; day: string; lines: HoloLine[]; secret?: boolean; }
export interface Clue { id: string; title: string; text: string; secret?: boolean; }

const L = (crew: string, ...lines: string[]) => lines.map((text) => ({ crew, text }));

export const LOGS: Record<string, LogEntry> = {
  ilse1: {
    id: 'ilse1', crew: 'varga', title: 'Jour 214', place: 'Salle technique', day: 'Jour 214', kind: 'audio',
    lines: L('varga',
      'Jour 214. Samir dit que le signal se répète toutes les quatre heures.',
      'Il ne ressemble à rien de connu. Pas un pulsar, pas un écho. Une structure.',
      'Naomi veut descendre. Kenji veut qu\'on attende la relève.',
      'Moi, je veux comprendre avant de décider. Fin du journal.'),
  },
  lea1: {
    id: 'lea1', crew: 'fontaine', title: 'Ce qui se fissure', place: 'Cabine de Léa', day: 'Jour 220', kind: 'texte',
    lines: L('fontaine',
      'On ne mange plus ensemble. Samir dort à côté de ses écrans.',
      'Naomi parle de la surface comme d\'un endroit où on aurait déjà vécu.',
      'Kenji ne dit plus rien. Ilse fait semblant que tout va bien, pour nous.',
      'Je fais pareil. Je ne sais pas laquelle de nous deux ment le mieux.'),
  },
  naomi1: {
    id: 'naomi1', crew: 'achebe', title: 'Relevés impossibles', place: 'Laboratoire', day: 'Jour 223', kind: 'audio',
    lines: L('achebe',
      'Les relevés de la surface sont impossibles.',
      'Il y a de la vie là-dessous, et elle brille.',
      'Pas des lumières de ville. Des organismes. Des forêts entières qui s\'allument au rythme du signal.',
      'Je n\'arrive plus à dormir. Je veux les voir.'),
  },
  dispute: {
    id: 'dispute', crew: 'mori', title: 'Désaccord', place: 'Hangar', day: 'Jour 229', kind: 'audio',
    lines: [
      { crew: 'mori', text: 'On ne sait rien de ce vaisseau. Il dérive là depuis combien de temps ? Personne n\'a répondu à nos appels.' },
      { crew: 'varga', text: 'C\'est justement pour ça qu\'on y va.' },
      { crew: 'mori', text: 'Non. C\'est pour ça qu\'on attend. La relève arrive dans quarante jours.' },
      { crew: 'varga', text: 'Le signal change, Kenji. Samir dit qu\'il accélère. Dans quarante jours, il n\'y aura peut-être plus rien à comprendre.' },
      { crew: 'mori', text: 'Alors je pilote. Mais je veux que ce soit noté : j\'étais contre.' },
      { crew: 'varga', text: 'C\'est noté.' },
    ],
  },
  samir1: {
    id: 'samir1', crew: 'haddad', title: 'Note personnelle', place: 'Derrière un panneau du carrefour', day: 'Jour 226', kind: 'audio', secret: true,
    lines: L('haddad',
      'Note personnelle. Je n\'ai pas tout dit à Ilse.',
      'Quand je ralentis le signal, il y a une deuxième couche, dessous. Elle ne s\'adresse pas à nous.',
      'Elle parle à nos machines. Les relais de la station répondent tout seuls, la nuit.',
      'J\'ai coupé la liaison. Je ne sais pas si j\'ai bien fait.'),
  },
};

export const HOLOS: Record<string, HoloEntry> = {
  fete: {
    id: 'fete', title: 'Le décodage', place: 'Baie d\'observation', day: 'Jour 211',
    lines: [
      { crew: 'haddad', text: 'Là ! Vous voyez ? Ce n\'est pas du bruit. C\'est une suite. Elle se répète, mais jamais tout à fait pareil.', gesture: 'point' },
      { crew: 'reyes', text: 'Traduction pour les ingénieurs ?', gesture: 'head' },
      { crew: 'haddad', text: 'Quelqu\'un, quelque part, a construit ça. Et ça marche encore.', gesture: 'arms' },
      { crew: 'achebe', text: 'Sur la planète. Je le savais.', gesture: 'turn' },
      { crew: 'varga', text: 'Doucement. On enregistre tout, on vérifie tout. Mais ce soir, on peut fêter ça.', gesture: 'arms' },
      { crew: 'fontaine', text: 'Enfin une bonne nouvelle.', gesture: 'head' },
    ],
  },
  tomas: {
    id: 'tomas', title: 'L\'établi', place: 'Atelier de Tomás', day: 'Jour 228',
    lines: [
      { crew: 'reyes', text: 'Tiens-toi tranquille. Voilà… le genou gauche, encore. Tu sais que tu es le seul à ne jamais te plaindre, ici ?', gesture: 'head' },
      { crew: 'reyes', text: 'Ilse veut qu\'on parte tous sur l\'Asterion. Toi, tu restes. Quelqu\'un doit garder la maison.', gesture: 'arms' },
      { crew: 'reyes', text: 'Et puis… toi, tu tiendras plus longtemps que nous tous.', gesture: 'none' },
    ],
  },
  anniv: {
    id: 'anniv', title: 'Anniversaire', place: 'Réfectoire', day: 'Jour 197', secret: true,
    lines: [
      { crew: 'reyes', text: 'Joyeux anniversaire, docteur ! Le gâteau est… techniquement comestible.', gesture: 'arms' },
      { crew: 'fontaine', text: 'Vous êtes fous. Où est-ce que vous avez trouvé du sucre ?', gesture: 'head' },
      { crew: 'haddad', text: 'Dans la réserve de Kenji. Il ne doit jamais le savoir.', gesture: 'point' },
      { crew: 'achebe', text: 'Fais un vœu.', gesture: 'none' },
      { crew: 'fontaine', text: 'Que l\'on rentre tous à la maison.', gesture: 'none' },
    ],
  },
};

export const CLUES: Record<string, Clue> = {
  tasse: { id: 'tasse', title: 'Tasse renversée', text: 'Cabine d\'Ilse. Le café a coulé sur un rapport à moitié écrit. Elle n\'a pas pris le temps de nettoyer.' },
  lit: { id: 'lit', title: 'Lit défait', text: 'Cabine de Kenji. Les draps sont en boule, une couverture par terre. Il dormait mal.' },
  dessin: { id: 'dessin', title: 'Dessin de la planète', text: 'Cabine de Naomi. Des forêts au crayon de couleur, qui brillent. En bas : « bientôt ».' },
  plan: { id: 'plan', title: 'Plan de R-12', text: 'Cabine de Tomás. Ton propre schéma, annoté à la main : « genou gauche — à revoir ».' },
  casque: { id: 'casque', title: 'Casque audio', text: 'Cabine de Samir. Encore branché sur un enregistreur. Il écoutait le signal en boucle.' },
  photo: { id: 'photo', title: 'Photo d\'équipage', text: 'Cabine de Léa. Les six, devant la baie d\'observation, le jour de l\'arrivée. Tout le monde sourit.' },
  code: { id: 'code', title: 'Code griffonné', text: 'Sous la console : « Volet baie — 2 1 4 7 ». Écrit au feutre, à la hâte.' },
  plante: { id: 'plante', title: 'La dernière plante', text: 'Seule plante encore vivante de la serre. Sa tige s\'est tordue pour pousser vers la planète.' },
  traces: { id: 'traces', title: 'Traces de Tomás', text: 'Des empreintes de bottes le long des parois. Il connaissait le seul chemin sûr.' },
  famille: { id: 'famille', title: 'Photo de famille de Kenji', text: 'Coincée dans une grille d\'aération. Une femme et deux enfants sur une plage. Au dos : « reviens ».', secret: true },
};

export const OBJECTIVES = {
  init: 'Initialisation…',
  m1: 'Trouver une source d\'énergie',
  m2: 'Rétablir l\'énergie de secours',
  m3: 'Explorer les quartiers',
  m4: 'Ouvrir le volet de la baie',
  m5: 'Récupérer le module de scan',
  m6: 'Traverser la serre hydroponique',
  m7: 'Atteindre l\'atelier',
  m8: 'Rejoindre le hangar',
  m9: 'Lancer la navette vers l\'Asterion',
  end: 'À suivre : l\'Asterion',
} as const;

export const MISSION_NAMES: Record<string, string> = {
  m1: '1 · Réveil', m2: '2 · Courant coupé', m3: '3 · Les quartiers de l\'équipage', m4: '4 · La baie d\'observation', m5: '5 · Le scanner',
  m6: '6 · La serre morte', m7: '7 · L\'atelier de Tomás', m8: '8 · La brèche', m9: '9 · Le hangar',
};

export const ROOMS: Record<string, string> = {
  A: 'Baie de maintenance', B: 'Coursive B', J: 'Carrefour', C: 'Salle technique', D: 'Quartiers de l\'équipage',
  D1: 'Cabine d\'Ilse', D2: 'Cabine de Tomás', D3: 'Cabine de Naomi', D4: 'Cabine de Kenji', D5: 'Cabine de Léa', D6: 'Cabine de Samir',
  R: 'Réfectoire', E: 'Baie d\'observation', F: 'Laboratoire de Naomi', G: 'Serre hydroponique', H: 'Salle effondrée', I: 'Atelier de Tomás',
  K: 'Compartiment de la brèche', L: 'Hangar',
};
