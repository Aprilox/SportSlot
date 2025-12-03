import { NextResponse } from 'next/server'
import { 
  saveSettingsToDB,
  saveSportsToDB,
  saveSlotsToDB,
  saveBookingsToDB,
  initializeStorage
} from '@/lib/db'
import { isDatabaseMode, getStorageMode } from '@/lib/config'

/**
 * POST /api/sync
 * Synchronise les données du localStorage vers la base de données
 * Appelé lors de la publication des changements
 */
export async function POST(request: Request) {
  try {
    const storageMode = getStorageMode()
    
    // Mode browser = pas de DB, on ignore
    if (storageMode === 'browser' || !isDatabaseMode()) {
      return NextResponse.json({
        success: true,
        mode: 'browser',
        message: 'Mode navigateur - pas de synchronisation DB'
      })
    }
    
    // Initialiser la connexion DB
    const storageType = await initializeStorage()
    if (storageType !== 'database') {
      return NextResponse.json({
        success: false,
        message: 'Impossible de se connecter à la base de données'
      }, { status: 500 })
    }
    
    // Récupérer les données du body
    const { settings, sports, slots, bookings } = await request.json()
    
    console.log('🔄 Synchronisation vers la DB...')
    console.log(`   - Settings: ${settings ? '✓' : '✗'}`)
    console.log(`   - Sports: ${sports?.length || 0}`)
    console.log(`   - Slots: ${slots?.length || 0}`)
    console.log(`   - Bookings: ${bookings?.length || 0}`)
    
    // Sauvegarder dans l'ordre (sports d'abord car slots les référencent)
    const results: Record<string, boolean | null> = {
      sports: null,
      slots: null,
      bookings: null,
      settings: null
    }
    
    // 1. Sports (doit être fait en premier)
    if (sports && Array.isArray(sports)) {
      results.sports = await saveSportsToDB(sports)
    }
    
    // 2. Slots (après sports car ils les référencent)
    if (slots && Array.isArray(slots)) {
      results.slots = await saveSlotsToDB(slots)
    }
    
    // 3. Bookings (après slots car ils les référencent)
    if (bookings && Array.isArray(bookings)) {
      results.bookings = await saveBookingsToDB(bookings)
    }
    
    // 4. Settings
    if (settings) {
      results.settings = await saveSettingsToDB(settings)
    }
    
    // Vérifier uniquement les éléments qui ont été traités (pas null)
    const processedResults = Object.entries(results).filter(([, v]) => v !== null)
    const allSuccess = processedResults.every(([, v]) => v === true)
    const anyProcessed = processedResults.length > 0
    
    console.log(`✅ Synchronisation ${allSuccess ? 'réussie' : 'partielle'}:`, results)
    
    return NextResponse.json({
      success: allSuccess || !anyProcessed,
      mode: 'database',
      storageMode,
      results,
      message: allSuccess || !anyProcessed
        ? 'Données synchronisées avec succès' 
        : 'Synchronisation partielle - voir les résultats'
    })
  } catch (error) {
    console.error('❌ Erreur synchronisation:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 })
  }
}
