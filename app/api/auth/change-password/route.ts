/**
 * API Route: Change Password
 * POST /api/auth/change-password
 * 
 * Change le mot de passe admin (mode database)
 */

import { NextRequest, NextResponse } from 'next/server'
import { 
  getAdminCredentialsFromDB, 
  saveAdminCredentialsToDB, 
  isUsingDatabase 
} from '@/lib/db'
import { isDatabaseMode } from '@/lib/config'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Mot de passe actuel et nouveau requis' },
        { status: 400 }
      )
    }

    if (newPassword.length < 4) {
      return NextResponse.json(
        { success: false, error: 'Le nouveau mot de passe doit contenir au moins 4 caractères' },
        { status: 400 }
      )
    }

    // Vérifier si on utilise la DB
    if (!isDatabaseMode() || !isUsingDatabase()) {
      return NextResponse.json({
        success: false,
        error: 'Mode localStorage actif - modification côté client uniquement',
        mode: 'local'
      }, { status: 200 })
    }

    // Récupérer les credentials actuels
    const creds = await getAdminCredentialsFromDB()
    if (!creds) {
      return NextResponse.json(
        { success: false, error: 'Aucun compte admin trouvé' },
        { status: 404 }
      )
    }

    // Import dynamique des utilitaires de hash
    const { verifyPassword, hashPassword } = await import('@/lib/hash')

    // Vérifier le mot de passe actuel
    const isValid = await verifyPassword(currentPassword, creds.password)
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Mot de passe actuel incorrect' },
        { status: 401 }
      )
    }

    // Hasher et sauvegarder le nouveau mot de passe
    const hashedPassword = await hashPassword(newPassword)
    const saved = await saveAdminCredentialsToDB({
      username: creds.username,
      password: hashedPassword
    })

    if (saved) {
      return NextResponse.json({
        success: true,
        message: 'Mot de passe modifié avec succès'
      })
    } else {
      return NextResponse.json(
        { success: false, error: 'Erreur lors de la sauvegarde' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Erreur change-password:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}


