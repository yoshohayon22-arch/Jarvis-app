import type { LogEntry, HoloEntry, Clue } from './zone1';

// Textes de la Zone 2 — Épave de l'Asterion.

const L = (crew: string, ...lines: string[]) => lines.map((text) => ({ crew, text }));

export const LOGS2: Record<string, LogEntry> = {
  ilse2: {
    id: 'ilse2', crew: 'varga', title: 'Arrivée', place: 'Pont brisé', day: 'Jour 231', kind: 'audio',
    lines: L('varga',
      'Jour 231. Nous sommes à bord de l\'Asterion.',
      'La coque est ouverte sur toute la longueur. Rien de ce que nous connaissons ne fait des trous pareils.',
      'Samir a retrouvé le signal ici aussi. Plus fort. Comme si le vaisseau l\'écoutait encore.',
      'Kenji reste près de la navette. Il a raison de rester près de la navette.'),
  },
  kenji1: {
    id: 'kenji1', crew: 'mori', title: 'D\'où viennent les débris', place: 'Section de gravité', day: 'Jour 232', kind: 'audio',
    lines: L('mori',
      'Ce vaisseau n\'a pas été frappé par hasard.',
      'J\'ai relevé les impacts sur trois ponts. Les débris venaient tous de la même direction.',
      'De la planète.',
      'Je l\'ai dit à Ilse. Elle m\'a demandé de ne pas en parler aux autres. Pas encore.'),
  },
  tomas2: {
    id: 'tomas2', crew: 'reyes', title: 'Réacteur', place: 'Puits du réacteur', day: 'Jour 232', kind: 'audio',
    lines: L('reyes',
      'Le réacteur est intact. Pas une fissure.',
      'Quelqu\'un l\'a éteint. Proprement, dans l\'ordre, anneau par anneau. Comme on éteint une maison avant de partir.',
      'Ce qui veut dire qu\'ils savaient qu\'ils ne reviendraient pas.'),
  },
  lea2: {
    id: 'lea2', crew: 'fontaine', title: 'Avant la descente', place: 'Baie des capsules', day: 'Jour 233', kind: 'texte',
    lines: L('fontaine',
      'Ma jambe est cassée. Tomás m\'a portée jusqu\'ici. Je l\'ai entendu pleurer dans le couloir, il croyait que je dormais.',
      'Il ne reste presque plus de capsules. Ilse dit que la surface est notre seule chance.',
      'Naomi a l\'air heureuse. C\'est ce qui me fait le plus peur.',
      'Si quelqu\'un lit ça : nous ne sommes pas partis par curiosité. Nous sommes partis parce qu\'il n\'y avait plus d\'autre endroit.'),
  },
  ancien: {
    id: 'ancien', crew: 'inconnu', title: 'Journal de bord de l\'Asterion', place: 'Alcôve du pont brisé', day: 'Il y a 19 ans', kind: 'texte', secret: true,
    lines: L('inconnu',
      'Journal de bord, Asterion. Le signal nous a guidés jusqu\'à cette planète.',
      'Notre intelligence de bord dit qu\'elle comprend une partie du message. Elle dit qu\'il ne nous est pas destiné.',
      'L\'équipage a voté. Nous descendons demain.',
      'Nous laissons le vaisseau en orbite, au cas où quelqu\'un viendrait après nous.'),
  },
};

export const HOLOS2: Record<string, HoloEntry> = {
  commandement: {
    id: 'commandement', title: 'L\'évacuation', place: 'Poste de commandement', day: 'Jour 233',
    lines: [
      { crew: 'haddad', text: 'Ilse, les registres… l\'Asterion était déjà là. Il y a dix-neuf ans. Un autre équipage a suivi le même signal.', gesture: 'point' },
      { crew: 'varga', text: 'Et où sont-ils ?', gesture: 'head' },
      { crew: 'mori', text: 'Ilse ! Une vague de débris arrive. Énorme. Elle vient de la surface.', gesture: 'arms' },
      { crew: 'reyes', text: 'Léa est touchée ! Sa jambe, elle est coincée !', gesture: 'arms' },
      { crew: 'varga', text: 'On ne peut pas rejoindre la navette. Tout le monde aux capsules. On descend.', gesture: 'turn' },
      { crew: 'achebe', text: 'Vers la planète…', gesture: 'none' },
      { crew: 'varga', text: 'Vers la planète. C\'est un ordre. Allez !', gesture: 'point' },
    ],
  },
  samirChante: {
    id: 'samirChante', title: 'Dans le noir', place: 'Cabine obscure', day: 'Jour 232', secret: true,
    lines: [
      { crew: 'haddad', text: 'Ma mère chantait ça quand il y avait des coupures de courant. On s\'asseyait par terre, dans le noir, et elle chantait.', gesture: 'head' },
      { crew: 'haddad', text: 'Je ne me souviens plus des paroles. Juste de l\'air.', gesture: 'none' },
      { crew: 'haddad', text: 'La la, la la la… Je crois que le signal aussi, c\'est une chanson. Quelqu\'un qui chante dans le noir pour ne pas avoir peur.', gesture: 'arms' },
    ],
  },
};

export const CLUES2: Record<string, Clue> = {
  impacts: { id: 'impacts', title: 'Impacts alignés', text: 'Des centaines de trous dans la coque, tous orientés vers la planète.' },
  combinaisons: { id: 'combinaisons', title: 'Combinaisons vides', text: 'Des combinaisons de l\'ancien équipage flottent dans le vestiaire. Il en manque une par casier.' },
  casque: { id: 'casqueKenji', title: 'Casque de Kenji', text: 'Accroché à une antenne, dehors, sur la coque. Kenji l\'a laissé là comme un repère, pour trouver le chemin du retour.', secret: true },
  anneaux: { id: 'anneaux', title: 'Anneaux de confinement', text: 'Quatre anneaux désalignés, chacun verrouillé à la main.' },
};

export const OBJECTIVES2 = {
  m10: 'Entrer dans l\'Asterion',
  m11: 'Trouver le poste de commandement',
  m12: 'Traverser la section de gravité artificielle',
  m13: 'Récupérer l\'équipement de sortie',
  m13b: 'Rejoindre le réacteur par la coque',
  m14: 'Redémarrer le réacteur',
  m15: 'Accéder aux enregistrements de bord',
  m16: 'Trouver une capsule de descente',
  m16b: 'Récupérer les pièces à l\'extérieur',
  m16c: 'Réparer la capsule et embarquer',
  m17: 'Descendre vers la planète',
  end2: 'À suivre : la planète',
} as const;

export const MISSION_NAMES2: Record<string, string> = {
  m10: '10 · L\'amarrage', m11: '11 · Le pont brisé', m12: '12 · La gravité folle', m13: '13 · Les bottes magnétiques',
  m14: '14 · Le réacteur', m15: '15 · Le poste de commandement', m16: '16 · Les capsules', m17: '17 · La descente',
};

export const ROOMS2: Record<string, string> = {
  X: 'Coque de l\'Asterion', R1: 'Pont brisé', R2: 'Section de gravité', R2s: 'Cabine obscure', R3: 'Vestiaire',
  R4: 'Puits du réacteur', R5: 'Poste de commandement', R6: 'Baie des capsules', X2: 'Épave extérieure',
};
