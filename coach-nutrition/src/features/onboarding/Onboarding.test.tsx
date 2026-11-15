import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppDataProvider } from '../../state/AppDataContext'
import { createMemoryBackend, createStorage } from '../../storage/storage'
import { Onboarding } from './Onboarding'

function setup() {
  const storage = createStorage(createMemoryBackend())
  render(
    <AppDataProvider storage={storage}>
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>
    </AppDataProvider>,
  )
  return { storage, user: userEvent.setup() }
}

describe('Onboarding', () => {
  it('bloque les moins de 18 ans avec un message bienveillant', async () => {
    const { user } = setup()
    await user.type(screen.getByLabelText('Nom du profil'), 'Léa')
    await user.click(screen.getByLabelText('Femme'))
    await user.type(screen.getByLabelText('Âge'), '16')
    await user.click(screen.getByRole('button', { name: /continuer/i }))
    expect(screen.getByText(/parle à un médecin ou à un diététicien/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Faisons connaissance' })).toBeInTheDocument()
  })

  it('parcourt toutes les étapes et crée le profil', async () => {
    const { user, storage } = setup()
    const next = () => user.click(screen.getByRole('button', { name: /continuer/i }))

    await user.type(screen.getByLabelText('Nom du profil'), 'Alex')
    await user.click(screen.getByLabelText('Homme'))
    await user.type(screen.getByLabelText('Âge'), '30')
    await next()
    await user.type(screen.getByLabelText('Taille'), '180')
    await user.type(screen.getByLabelText('Poids actuel'), '80')
    await next()
    // IMC < 18,5 refusé…
    await user.type(screen.getByLabelText('Poids cible'), '55')
    await next()
    expect(screen.getByText(/en dessous de 18,5/)).toBeInTheDocument()
    // …puis un objectif réaliste est accepté.
    await user.clear(screen.getByLabelText('Poids cible'))
    await user.type(screen.getByLabelText('Poids cible'), '75')
    await next()
    await user.click(screen.getByLabelText(/Modérément actif/))
    await next()
    await next() // repas : 3 par défaut
    await user.click(screen.getByLabelText(/Casher/))
    expect(screen.getByText('Options casher')).toBeInTheDocument()
    await next()
    await next() // organisation
    expect(screen.getByText(/^2.?320 kcal$/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /créer mon profil/i }))

    const saved = storage.load()
    expect(saved.profiles).toHaveLength(1)
    expect(saved.profiles[0].name).toBe('Alex')
    expect(saved.profiles[0].settings.restrictions).toEqual(['casher'])
    expect(saved.profiles[0].weighIns).toHaveLength(1)
  })
})
