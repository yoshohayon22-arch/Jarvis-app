// Textes de la Zone 1 — Station Halcyon (tranche verticale).
// Ton sobre, humain. Chaque journal : 20 à 40 secondes.

export interface LogEntry { id: string; crew: string; title: string; place: string; day: string; kind: 'audio' | 'texte'; lines: string[]; }
export interface HoloLine { crew: string; text: string; gesture?: 'point' | 'arms' | 'turn' | 'head' | 'none'; }
export interface HoloEntry { id: string; title: string; place: string; day: string; lines: HoloLine[]; }
export interface Clue { id: string; title: string; text: string; }

export const LOGS: Record<string, LogEntry> = {
  log01: {
    id: 'log01', crew: 'solenne', title: 'Mise en veille', place: 'Baie de maintenance', day: 'Jour 212', kind: 'audio',
    lines: [
      'Bon. R-12, je te mets en veille.',
      'Le servo de ton genou gauche grince encore. Je m\'en occupe à mon retour, promis.',
      'On part quelques jours sur l\'Asterion, avec Yann et Tomas. La commandante dit que c\'est une simple inspection.',
      'Si tu entends ce message… c\'est que quelqu\'un t\'a rallumé.',
      'Ou que personne n\'est revenu pour le faire.',
      'Dans les deux cas, prends soin de la station.',
    ],
  },
  log02: {
    id: 'log02', crew: 'ishii', title: 'Journal personnel', place: 'Quartiers de l\'équipage', day: 'Jour 205', kind: 'texte',
    lines: [
      'Elio ne dort plus. Il écoute le signal au casque, la nuit.',
      'Il dit qu\'il entend quelque chose entre les impulsions. Une voix, peut-être. Il n\'ose pas le dire à Ilse.',
      'Je lui ai donné de quoi dormir. Il a posé la boîte sur la table, sans y toucher.',
      'La décision est prise : Yann, Tomas et Mira partent sur l\'Asterion dans trois jours.',
      'Moi, je reste. Quelqu\'un doit rester.',
    ],
  },
};

export const HOLOS: Record<string, HoloEntry> = {
  holo01: {
    id: 'holo01', title: 'Le signal', place: 'Salle des relais', day: 'Jour 198',
    lines: [
      { crew: 'okafor', text: 'Ça recommence. Même fréquence. Toutes les quarante et une minutes, exactement.', gesture: 'point' },
      { crew: 'varga', text: 'Une source naturelle ? Un pulsar ?', gesture: 'head' },
      { crew: 'okafor', text: 'Un pulsar ne compte pas, commandante. Ça, ça compte. Un. Deux. Trois. Puis ça recommence.', gesture: 'arms' },
      { crew: 'varga', text: 'Pas un mot au centre tant qu\'on n\'est pas sûrs. Et personne ne descend.', gesture: 'turn' },
      { crew: 'okafor', text: 'Et si ça ne vient pas de la planète ? Si ça vient de l\'Asterion ?', gesture: 'point' },
      { crew: 'varga', text: 'Préparez-moi un rapport. Ce soir.', gesture: 'none' },
    ],
  },
};

export const CLUES: Record<string, Clue> = {
  mug: { id: 'mug', title: 'Tasse « MIRA »', text: 'Le café a séché au fond. Elle est partie pressée.' },
  board: { id: 'board', title: 'Tableau blanc', text: '« 41:00 » souligné trois fois, puis une série de traits : I · II · III.' },
  photo: { id: 'photo', title: 'Photo d\'équipage', text: 'Les six, devant la baie d\'observation. Quelqu\'un a entouré un visage au feutre : Elio.' },
  pills: { id: 'pills', title: 'Boîte de somnifères', text: 'Pleine. Le sceau n\'a jamais été ouvert.' },
  crowbar: { id: 'crowbar', title: 'Pied-de-biche', text: 'La porte du hangar a été forcée. Les marques sont à l\'intérieur.' },
  asterion: { id: 'asterion', title: 'L\'Asterion', text: 'Immense, immobile. Ses feux de position clignotent encore.' },
};

export const OBJECTIVES = {
  wake: 'Sortir de la baie de maintenance',
  power: 'Trouver une source d\'énergie',
  route: 'Rétablir l\'énergie',
  quarters: 'Explorer les quartiers de l\'équipage',
  hangar: 'Rejoindre le hangar',
  jetpack: 'Récupérer le module de propulsion',
  catwalk: 'Atteindre la passerelle du hangar',
  bay: 'Entrer dans la baie d\'observation',
  end: 'À suivre…',
} as const;

export const ROOMS: Record<string, string> = {
  A: 'Baie de maintenance', B: 'Coursive B', C: 'Salle des relais', D: 'Quartiers de l\'équipage', E: 'Hangar', F: 'Baie d\'observation',
};
