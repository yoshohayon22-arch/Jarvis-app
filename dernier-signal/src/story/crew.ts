import type { VoiceProfile } from '../audio/audio';

// L'équipage de la station orbitale Halcyon.

export interface Crew { id: string; name: string; role: string; bio: string; voice: VoiceProfile; voiceIndex: number; }

export const CREW: Record<string, Crew> = {
  varga: { id: 'varga', name: 'Ilse Varga', role: 'Commandante', bio: 'Calme, économe de ses mots. Vingt ans de missions, aucune perdue.', voice: { pitch: 0.88, rate: 0.94, prefer: 'f' }, voiceIndex: 0 },
  okafor: { id: 'okafor', name: 'Tomas Okafor', role: 'Astrophysicien', bio: 'Curieux de tout, parle trop vite quand il est ému. C\'est lui qui a capté le signal.', voice: { pitch: 1.02, rate: 1.1, prefer: 'm' }, voiceIndex: 0 },
  solenne: { id: 'solenne', name: 'Mira Solenne', role: 'Ingénieure de maintenance', bio: 'Ironique, bricoleuse, la seule à parler à R-12 comme à un collègue.', voice: { pitch: 1.12, rate: 1.0, prefer: 'f' }, voiceIndex: 1 },
  keller: { id: 'keller', name: 'Yann Keller', role: 'Pilote', bio: 'Impulsif et loyal. Préfère agir que d\'attendre les ordres du centre.', voice: { pitch: 0.82, rate: 1.04, prefer: 'm' }, voiceIndex: 1 },
  ishii: { id: 'ishii', name: 'Hana Ishii', role: 'Médecin et biologiste', bio: 'Prudente, attentive aux autres. Tient un journal personnel chaque soir.', voice: { pitch: 1.0, rate: 0.92, prefer: 'f' }, voiceIndex: 2 },
  brandt: { id: 'brandt', name: 'Elio Brandt', role: 'Technicien des communications', bio: 'Le plus jeune. Anxieux, brillant, il écoute le signal la nuit.', voice: { pitch: 1.18, rate: 1.02, prefer: 'm' }, voiceIndex: 2 },
};
