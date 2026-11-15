/**
 * Mia, la marmotte des Alpes : la coach de l'application.
 * Dessin vectoriel original (SVG). Décoratif par défaut ; passer `title` pour qu'il soit annoncé.
 */
export function Mia({ size = 160, title, className = '' }: { size?: number; title?: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <ellipse cx="100" cy="188" rx="48" ry="6" fill="#000" opacity=".08" />
      {/* corps */}
      <path d="M56 118 C52 82 74 62 100 62 C126 62 148 82 144 118 C142 156 128 182 100 182 C72 182 58 156 56 118Z" fill="#a8774e" />
      {/* tablier vert avec une feuille */}
      <path d="M70 122 C70 112 130 112 130 122 L134 172 C120 180 80 180 66 172Z" fill="#067d45" />
      <path d="M82 116 C80 106 76 100 72 96 M118 116 C120 106 124 100 128 96" stroke="#067d45" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M100 136 C92 136 88 146 100 154 C112 146 108 136 100 136Z" fill="#34d37f" />
      <path d="M100 142 L100 152" stroke="#05683a" strokeWidth="1.5" />
      {/* tête */}
      <circle cx="100" cy="72" r="38" fill="#b9875c" />
      <circle cx="68" cy="44" r="10" fill="#a8774e" />
      <circle cx="132" cy="44" r="10" fill="#a8774e" />
      <circle cx="68" cy="44" r="5" fill="#e6b8a2" />
      <circle cx="132" cy="44" r="5" fill="#e6b8a2" />
      <ellipse cx="100" cy="88" rx="22" ry="17" fill="#f1dcc4" />
      {/* visage */}
      <circle cx="86" cy="68" r="5" fill="#10231a" />
      <circle cx="114" cy="68" r="5" fill="#10231a" />
      <circle cx="87.5" cy="66.5" r="1.6" fill="#fff" />
      <circle cx="115.5" cy="66.5" r="1.6" fill="#fff" />
      <ellipse cx="100" cy="80" rx="6" ry="4.5" fill="#5b3a29" />
      <path d="M92 88 Q100 94 108 88" stroke="#5b3a29" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <rect x="96" y="90" width="8" height="8" rx="1.5" fill="#fff" stroke="#c9b9a6" strokeWidth="1" />
      <circle cx="74" cy="84" r="5" fill="#ff9aa2" opacity=".55" />
      <circle cx="126" cy="84" r="5" fill="#ff9aa2" opacity=".55" />
      {/* pattes et cuillère en bois */}
      <ellipse cx="62" cy="126" rx="9" ry="12" fill="#a8774e" />
      <path d="M146 92 L158 150" stroke="#c98e4f" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="144" cy="86" rx="8" ry="11" fill="#c98e4f" />
      <ellipse cx="146" cy="124" rx="9" ry="12" fill="#a8774e" />
      <ellipse cx="84" cy="182" rx="12" ry="6" fill="#8b5f3c" />
      <ellipse cx="116" cy="182" rx="12" ry="6" fill="#8b5f3c" />
    </svg>
  )
}

/** Petit portrait de Mia (tête seule) pour les messages du coach. */
export function MiaAvatar({ size = 48 }: { size?: number }) {
  return (
    <svg viewBox="58 30 84 84" width={size} height={size} aria-hidden="true" className="shrink-0 rounded-full bg-brand-100">
      <circle cx="68" cy="44" r="10" fill="#a8774e" />
      <circle cx="132" cy="44" r="10" fill="#a8774e" />
      <circle cx="68" cy="44" r="5" fill="#e6b8a2" />
      <circle cx="132" cy="44" r="5" fill="#e6b8a2" />
      <circle cx="100" cy="72" r="38" fill="#b9875c" />
      <ellipse cx="100" cy="88" rx="22" ry="17" fill="#f1dcc4" />
      <circle cx="86" cy="68" r="5" fill="#10231a" />
      <circle cx="114" cy="68" r="5" fill="#10231a" />
      <circle cx="87.5" cy="66.5" r="1.6" fill="#fff" />
      <circle cx="115.5" cy="66.5" r="1.6" fill="#fff" />
      <ellipse cx="100" cy="80" rx="6" ry="4.5" fill="#5b3a29" />
      <path d="M92 88 Q100 94 108 88" stroke="#5b3a29" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <rect x="96" y="90" width="8" height="8" rx="1.5" fill="#fff" stroke="#c9b9a6" strokeWidth="1" />
      <circle cx="74" cy="84" r="5" fill="#ff9aa2" opacity=".55" />
      <circle cx="126" cy="84" r="5" fill="#ff9aa2" opacity=".55" />
    </svg>
  )
}
