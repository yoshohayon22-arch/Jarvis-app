import type { VoiceProfile } from '../audio/audio';

// L'équipage de la station orbitale Halcyon.

export interface Crew { id: string; name: string; first: string; role: string; bio: string; voice: VoiceProfile; voiceIndex: number; female: boolean; height: number; }

export const CREW: Record<string, Crew> = {
  varga: { id: 'varga', name: 'Ilse Varga', first: 'Ilse', role: 'Commandante', bio: 'Calme et protectrice. Elle porte seule le poids des décisions.', voice: { pitch: 0.88, rate: 0.94, prefer: 'f' }, voiceIndex: 0, female: true, height: 1.72 },
  reyes: { id: 'reyes', name: 'Tomás Reyes', first: 'Tomás', role: 'Ingénieur', bio: 'Bricoleur et drôle. C\'est lui qui a construit et réparé R-12.', voice: { pitch: 1.0, rate: 1.06, prefer: 'm' }, voiceIndex: 0, female: false, height: 1.8 },
  achebe: { id: 'achebe', name: 'Naomi Achebe', first: 'Naomi', role: 'Biologiste', bio: 'Fascinée par la planète. La première à vouloir y descendre.', voice: { pitch: 1.1, rate: 1.04, prefer: 'f' }, voiceIndex: 1, female: true, height: 1.68 },
  mori: { id: 'mori', name: 'Kenji Mori', first: 'Kenji', role: 'Pilote', bio: 'Prudent. Il s\'est opposé à l\'expédition vers l\'Asterion.', voice: { pitch: 0.84, rate: 0.98, prefer: 'm' }, voiceIndex: 1, female: false, height: 1.76 },
  fontaine: { id: 'fontaine', name: 'Léa Fontaine', first: 'Léa', role: 'Médecin', bio: 'Tient un journal personnel. La voix la plus intime de l\'équipage.', voice: { pitch: 1.0, rate: 0.92, prefer: 'f' }, voiceIndex: 2, female: true, height: 1.65 },
  haddad: { id: 'haddad', name: 'Samir Haddad', first: 'Samir', role: 'Communications', bio: 'C\'est lui qui a décodé le signal. Il dort à côté de ses écrans.', voice: { pitch: 1.12, rate: 1.02, prefer: 'm' }, voiceIndex: 2, female: false, height: 1.74 },
};
