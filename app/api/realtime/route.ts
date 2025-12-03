import { NextResponse } from 'next/server'
import { 
  getSettingsFromDB, 
  getSlotsFromDB, 
  getBookingsFromDB,
  initializeStorage
} from '@/lib/db'
import { isDatabaseMode, getStorageMode } from '@/lib/config'

/**
 * GET /api/realtime
 * API pour la synchronisation temps réel
 * Retourne la version actuelle des données et optionnellement les données complètes
 * 
 * Query params:
 * - version: version actuelle du client (si différente, retourne les nouvelles données)
 * - full: si true, retourne toujours les données complètes
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientVersion = parseInt(searchParams.get('version') || '0')
    const fullSync = searchParams.get('full') === 'true'
    
    const storageMode = getStorageMode()
    
    // Mode browser = retourner une réponse simple
    if (storageMode === 'browser' || !isDatabaseMode()) {
      return NextResponse.json({
        success: true,
        mode: 'browser',
        version: 0,
        needsSync: false
      })
    }
    
    // Initialiser la connexion DB
    await initializeStorage()
    
    // Récupérer les settings pour la version
    const settings = await getSettingsFromDB()
    const serverVersion = settings?.dataVersion || 0
    
    // Si la version client est à jour, pas besoin de sync
    if (!fullSync && clientVersion >= serverVersion) {
      return NextResponse.json({
        success: true,
        mode: 'database',
        version: serverVersion,
        needsSync: false
      })
    }
    
    // Récupérer les données pour la synchronisation
    const [slots, bookings] = await Promise.all([
      getSlotsFromDB(),
      getBookingsFromDB()
    ])
    
    return NextResponse.json({
      success: true,
      mode: 'database',
      version: serverVersion,
      needsSync: true,
      data: {
        slots: slots || [],
        bookings: bookings || [],
        settings: settings
      }
    })
  } catch (error) {
    console.error('Erreur realtime:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 })
  }
}
