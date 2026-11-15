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
import { TrackingPage } from './features/tracking/TrackingPage'
import { MenuPage } from './features/menu/MenuPage'
import { BatchPage } from './features/batch/BatchPage'
import { ShoppingPage } from './features/shopping/ShoppingPage'

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

export default function App() {
  return (
    <AppDataProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppDataProvider>
  )
}
