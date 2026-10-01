import { NextResponse } from 'next/server'
import { 
  getSettingsFromDB, 
  getSportsFromDB, 
  getSlotsFromDB, 
  getBookingsFromDB,
  getAdminCredentialsFromDB,
  saveAdminCredentialsToDB,
  saveSettingsToDB,
  initializeStorage
} from '@/lib/db'
import { isDatabaseMode, getStorageMode } from '@/lib/config'
import { DEFAULT_SETTINGS } from '@/lib/storage'

/**
 * GET /api/data
 * Récupère toutes les données depuis la base de données
 * Utilisé pour initialiser l'application en mode database (local ou external)
 * Crée automatiquement l'admin par défaut (admin/admin) si aucun n'existe
 */
export async function GET() {
  try {
    const storageMode = getStorageMode()
    
    // Mode browser = pas de DB, on utilise localStorage
    if (storageMode === 'browser' || !isDatabaseMode()) {
      return NextResponse.json({
        success: true,
        mode: 'browser',
        message: 'Mode navigateur actif - données depuis localStorage'
      })
    }
    
    // Initialiser la connexion DB
    const storageType = await initializeStorage()
    if (storageType !== 'database') {
      return NextResponse.json({
        success: false,
        mode: storageMode,
        message: 'Impossible de se connecter à la base de données'
      })
    }
    
    // Vérifier si l'admin existe, sinon le créer avec les credentials par défaut
    const existingAdmin = await getAdminCredentialsFromDB()
    if (!existingAdmin) {
      console.log('🔐 Création de l\'utilisateur admin par défaut (admin/admin)')
      await saveAdminCredentialsToDB({
        username: 'admin',
        password: 'admin' // Sera hashé automatiquement
      })
    }
    
    // Récupérer toutes les données
    let [settings, sports, slots, bookings] = await Promise.all([
      getSettingsFromDB(),
      getSportsFromDB(),
      getSlotsFromDB(),
      getBookingsFromDB()
    ])
    
    // Si pas de settings, créer les settings par défaut
    if (!settings) {
      console.log('⚙️ Création des paramètres par défaut')
      await saveSettingsToDB(DEFAULT_SETTINGS)
      settings = DEFAULT_SETTINGS
    }
    
    return NextResponse.json({
      success: true,
      mode: 'database',
      storageMode: storageMode, // 'local' ou 'external'
      data: {
        settings,
        sports: sports || [],
        slots: slots || [],
        bookings: bookings || []
      }
    })
  } catch (error) {
    console.error('Erreur récupération données:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 })
  }
}
