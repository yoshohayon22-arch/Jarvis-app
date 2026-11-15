/**
 * Mise en page commune : en-tête (logo + sélecteur de profil), navigation,
 * contenu, et mention santé en pied de page.
 * Sur mobile, la navigation passe en barre fixe en bas de l'écran.
 */
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { CalendarDays, ChefHat, Home, Leaf, LineChart, ShoppingCart, UserRound, UserPlus } from 'lucide-react'
import { useAppData } from '../state/AppDataContext'
import { setActiveProfile } from '../domain/profiles'
import { HEALTH_DISCLAIMER } from '../domain/safety'
import { Suspense, useId } from 'react'

const NAV = [
  { to: '/', label: 'Accueil', icon: Home, end: true },
  { to: '/menu', label: 'Menu', icon: CalendarDays },
  { to: '/batch', label: 'Batch', icon: ChefHat },
  { to: '/courses', label: 'Courses', icon: ShoppingCart },
  { to: '/suivi', label: 'Suivi', icon: LineChart },
  { to: '/profil', label: 'Profil', icon: UserRound },
]

function ProfileSwitcher() {
  const { data, activeProfile, update } = useAppData()
  const navigate = useNavigate()
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">
        Profil actif
      </label>
      <select
        id={id}
        value={activeProfile?.id ?? ''}
        onChange={(e) => {
          if (e.target.value === '__new__') return navigate('/nouveau-profil')
          update((d) => setActiveProfile(d, e.target.value))
        }}
        className="max-w-[10rem] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
      >
        {data.profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
        <option value="__new__">+ Nouveau profil</option>
      </select>
      <button
        type="button"
        onClick={() => navigate('/nouveau-profil')}
        className="hidden rounded-xl p-2 text-brand-700 hover:bg-brand-50 sm:inline-flex"
        aria-label="Ajouter un profil"
        title="Ajouter un profil"
      >
        <UserPlus size={20} aria-hidden="true" />
      </button>
    </div>
  )
}

export function Layout() {
  return (
    <div className="min-h-screen pb-24 md:pb-0">
      <a href="#contenu" className="skip-link">
        Aller au contenu
      </a>
      <header className="no-print sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 text-brand-700" aria-label="Coach Nutrition, accueil">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Leaf size={20} aria-hidden="true" />
            </span>
            <span className="hidden text-lg font-bold sm:inline">Coach Nutrition</span>
          </NavLink>

          {/* Navigation principale (ordinateur / tablette) */}
          <nav aria-label="Navigation principale" className="ml-4 hidden md:block">
            <ul className="flex gap-1">
              {NAV.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                        isActive ? 'bg-brand-50 text-brand-700' : 'text-muted hover:bg-slate-50 hover:text-ink'
                      }`
                    }
                  >
                    <Icon size={18} aria-hidden="true" />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ml-auto">
            <ProfileSwitcher />
          </div>
        </div>
      </header>

      <main id="contenu" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6 outline-none sm:py-8">
        {/* Suspense local : la barre de navigation reste affichée pendant le chargement d'un écran. */}
        <Suspense fallback={<p role="status" className="p-8 text-center text-muted">Chargement…</p>}>
          <Outlet />
        </Suspense>
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 text-center text-xs text-muted">{HEALTH_DISCLAIMER}</footer>

      {/* Navigation mobile : barre fixe en bas */}
      <nav
        aria-label="Navigation principale"
        className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white md:hidden"
      >
        <ul className="grid grid-cols-6">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${
                    isActive ? 'text-brand-700' : 'text-muted'
                  }`
                }
              >
                <Icon size={20} aria-hidden="true" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
