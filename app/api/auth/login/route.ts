/**
 * API Route: Login Admin
 * POST /api/auth/login
 * 
 * Gère l'authentification admin selon le mode de stockage:
 * - browser: vérification côté client (localStorage)
 * - local/external: vérification côté serveur (base de données)
 */

import { NextRequest, NextResponse } from 'next/server'
import { 
  verifyAdminCredentials, 
  initializeStorage, 
  getAdminCredentialsFromDB,
  saveAdminCredentialsToDB 
} from '@/lib/db'
import { isDatabaseMode, getStorageMode } from '@/lib/config'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username et password requis' },
        { status: 400 }
      )
    }

    const storageMode = getStorageMode()

    // Mode browser = vérification côté client
    if (storageMode === 'browser') {
      return NextResponse.json({
        success: false,
        error: 'Mode navigateur - vérification côté client',
        mode: 'browser'
      }, { status: 200 })
    }

    // Mode local ou external = vérification via DB
    if (isDatabaseMode()) {
      const storageType = await initializeStorage()
      
      if (storageType === 'database') {
        // Vérifier si l'admin existe, sinon le créer avec les credentials par défaut
        const existingAdmin = await getAdminCredentialsFromDB()
        if (!existingAdmin) {
          console.log('🔐 Création de l\'utilisateur admin par défaut (admin/admin)')
          await saveAdminCredentialsToDB({
            username: 'admin',
            password: 'admin' // Sera hashé automatiquement
          })
        }
        
        // Mode database: vérification côté serveur avec hash
        const isValid = await verifyAdminCredentials(username, password)
        
        if (isValid) {
          return NextResponse.json({
            success: true,
            message: 'Connexion réussie',
            mode: storageMode
          })
        } else {
          return NextResponse.json(
            { success: false, error: 'Identifiants incorrects' },
            { status: 401 }
          )
        }
      }
    }
    
    // Fallback: vérification côté client
    return NextResponse.json({
      success: false,
      error: 'Mode navigateur - vérification côté client',
      mode: 'browser'
    }, { status: 200 })
  } catch (error) {
    console.error('Erreur login:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/auth/login
 * Retourne le mode d'authentification actuel
 */
export async function GET() {
  const storageMode = getStorageMode()
  const useDatabase = isDatabaseMode()
  
  return NextResponse.json({
    mode: storageMode,
    useDatabase,
    message: useDatabase 
      ? `Authentification via base de données (${storageMode})`
      : 'Authentification via localStorage (browser)'
  })
}
