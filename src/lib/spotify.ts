/** Reconnaît un lien Spotify partageable (playlist, album, artiste, titre, podcast). */
export type SpotifyKind = "playlist" | "album" | "artist" | "track" | "show" | "episode";
export const SPOTIFY_KINDS: Record<SpotifyKind, string> = { playlist: "Playlist", album: "Album", artist: "Artiste", track: "Titre", show: "Podcast", episode: "Épisode" };

export function parseSpotifyUrl(raw: string): { kind: SpotifyKind; id: string } | null {
  const m = raw.trim().match(/^(?:https:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?|spotify:)(playlist|album|artist|track|show|episode)[/:]([A-Za-z0-9]{22})(?:[?/#].*)?$/);
  return m ? { kind: m[1] as SpotifyKind, id: m[2] } : null;
}
