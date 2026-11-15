/**
 * Routes de l'application.
 * Tant qu'aucun profil n'existe, toutes les pages redirigent vers l'onboarding.
 */
import { lazy, Suspense } from 'react'
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppDataProvider, useAppData } from './state/AppDataContext'
import { Layout } from './components/Layout'

// Chaque écran est chargé à la demande : la première page s'affiche plus vite,
// et la bibliothèque de graphiques n'est téléchargée que sur l'écran Suivi.
const Onboarding = lazy(() => import('./features/onboarding/Onboarding').then((m) => ({ default: m.Onboarding })))
const Dashboard = lazy(() => import('./features/dashboard/Dashboard').then((m) => ({ default: m.Dashboard })))
const ProfilePage = lazy(() => import('./features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const TrackingPage = lazy(() => import('./features/tracking/TrackingPage').then((m) => ({ default: m.TrackingPage })))
const MenuPage = lazy(() => import('./features/menu/MenuPage').then((m) => ({ default: m.MenuPage })))
const BatchPage = lazy(() => import('./features/batch/BatchPage').then((m) => ({ default: m.BatchPage })))
const ShoppingPage = lazy(() => import('./features/shopping/ShoppingPage').then((m) => ({ default: m.ShoppingPage })))

/** Affiché pendant le chargement d'un écran (en général imperceptible). */
function Loading() {
  return (
    <p role="status" className="p-8 text-center text-muted">
      Chargement…
    </p>
  )
}

function AppRoutes() {
  const { activeProfile } = useAppData()

  if (!activeProfile) {
    return (
      <Routes>
        <Route path="/bienvenue" element={<Onboarding />} />
        <Route path="*" element={<Navigate to="/bienvenue" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/nouveau-profil" element={<Onboarding />} />
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="menu" element={<MenuPage />} />
        <Route path="batch" element={<BatchPage />} />
        <Route path="courses" element={<ShoppingPage />} />
        <Route path="suivi" element={<TrackingPage />} />
        <Route path="profil" element={<ProfilePage />} />
        <Route path="bienvenue" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

/**
 * Routeur : adresses classiques (/menu, /suivi…) sur le site publié ;
 * navigation en mémoire pour l'aperçu intégré à une autre page (build « VITE_ROUTER=memory »).
 */
const Router = import.meta.env.VITE_ROUTER === 'memory' ? MemoryRouter : BrowserRouter

export default function App() {
  return (
    <AppDataProvider>
      <Router>
        <Suspense fallback={<Loading />}>
          <AppRoutes />
        </Suspense>
      </Router>
    </AppDataProvider>
  )
}
