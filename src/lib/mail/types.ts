/** Données de l'onglet Mail (source : ta boîte Gmail, lue en IMAP). */
export interface MailRow {
  uid: number;
  from: string;
  email: string;
  subject: string;
  date: string | null;
  unread: boolean;
}

export interface MailList {
  connected: true;
  account: string;
  mails: MailRow[];
  /** Nombre total de messages correspondant à la recherche (on n'en affiche que les plus récents). */
  total: number;
  fetchedAt: string;
}

export interface MailMessage {
  uid: number;
  from: string;
  email: string;
  to: string;
  subject: string;
  date: string | null;
  text: string;
  /** Vrai si le texte a été coupé (message très long). */
  truncated: boolean;
  messageId: string;
  references: string;
}
