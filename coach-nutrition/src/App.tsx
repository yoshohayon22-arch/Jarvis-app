/**
 * Routes de l'application.
 * Tant qu'aucun profil n'existe, toutes les pages redirigent vers l'onboarding.
 */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppDataProvider, useAppData } from './state/AppDataContext'
import { Layout } from './components/Layout'
import { Onboarding } from './features/onboarding/Onboarding'
import { Dashboard } from './features/dashboard/Dashboard'
import { ProfilePage } from './features/profile/ProfilePage'
import { ComingSoon } from './features/ComingSoon'
import { MenuPage } from './features/menu/MenuPage'

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
        <Route
          path="batch"
          element={
            <ComingSoon
              title="Batch cooking"
              phase={4}
              description="Tes sessions de cuisine minutées, avec 3 ou 4 bases à combiner dans la semaine."
            />
          }
        />
        <Route
          path="courses"
          element={
            <ComingSoon
              title="Liste de courses"
              phase={4}
              description="Générée depuis ton menu, classée par rayon, avec le prix estimé en CHF."
            />
          }
        />
        <Route
          path="suivi"
          element={
            <ComingSoon
              title="Suivi du poids"
              phase={5}
              description="Ta courbe avec moyenne sur 7 jours, ta tendance par semaine et les conseils du coach. Tu peux déjà te peser depuis l’accueil."
            />
          }
        />
        <Route path="profil" element={<ProfilePage />} />
        <Route path="bienvenue" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AppDataProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppDataProvider>
  )
}
