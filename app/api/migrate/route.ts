import { NextResponse } from 'next/server'
import { 
  saveSettingsToDB, 
  saveSportsToDB, 
  saveSlotsToDB, 
  saveBookingsToDB,
  saveAdminCredentialsToDB,
  initializeStorage
} from '@/lib/db'
import { isDatabaseMode } from '@/lib/config'
import type { Settings, Sport, TimeSlot, Booking, AdminCredentials } from '@/lib/storage'

interface MigrateRequest {
  settings?: Settings
  sports?: Sport[]
  slots?: TimeSlot[]
  bookings?: Booking[]
  adminCredentials?: AdminCredentials
}

/**
 * POST /api/migrate
 * Migre les données du localStorage vers la base de données
 */
export async function POST(request: Request) {
  try {
    // Vérifier que le mode database est configuré
    if (!isDatabaseMode()) {
      return NextResponse.json({
        success: false,
        error: 'Mode database non actif. Définissez STORAGE_MODE=database dans .env'
      }, { status: 400 })
    }
    
    // Initialiser la connexion à la DB
    const storageType = await initializeStorage()
    if (storageType !== 'database') {
      return NextResponse.json({
        success: false,
        error: 'Impossible de se connecter à la base de données'
      }, { status: 500 })
    }

    const body: MigrateRequest = await request.json()
    const migrated: string[] = []
    const errors: string[] = []

    // Migrer les settings
    if (body.settings) {
      const success = await saveSettingsToDB(body.settings)
      if (success) {
        migrated.push('settings')
      } else {
        errors.push('settings')
      }
    }

    // Migrer les sports (doit être fait avant les slots à cause des relations)
    if (body.sports) {
      const success = await saveSportsToDB(body.sports)
      if (success) {
        migrated.push('sports')
      } else {
        errors.push('sports')
      }
    }

    // Migrer les slots
    if (body.slots) {
      const success = await saveSlotsToDB(body.slots)
      if (success) {
        migrated.push('slots')
      } else {
        errors.push('slots')
      }
    }

    // Migrer les bookings
    if (body.bookings) {
      const success = await saveBookingsToDB(body.bookings)
      if (success) {
        migrated.push('bookings')
      } else {
        errors.push('bookings')
      }
    }

    // Migrer les credentials admin
    if (body.adminCredentials) {
      const success = await saveAdminCredentialsToDB(body.adminCredentials)
      if (success) {
        migrated.push('adminCredentials')
      } else {
        errors.push('adminCredentials')
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      migrated,
      errors,
      message: errors.length === 0 
        ? `Migration réussie: ${migrated.length} éléments migrés`
        : `Migration partielle: ${migrated.length} réussis, ${errors.length} erreurs`
    })
  } catch (error) {
    console.error('Erreur migration:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 })
  }
}

/**
 * GET /api/migrate
 * Vérifie le statut de la base de données
 */
export async function GET() {
  try {
    const dbConfigured = isDatabaseMode()
    let storageType: 'database' | 'local' = 'local'
    
    if (dbConfigured) {
      storageType = await initializeStorage()
    }
    
    return NextResponse.json({
      databaseMode: storageType === 'database',
      databaseConfigured: dbConfigured,
      storageMode: process.env.STORAGE_MODE || 'local',
      databaseUrl: process.env.DATABASE_URL ? 'configured' : 'not configured',
      message: storageType === 'database'
        ? '✅ Mode database actif et connecté' 
        : dbConfigured 
          ? '⚠️ Database configurée mais non connectée'
          : '⚠️ Mode localStorage actif (données non persistantes)'
    })
  } catch (error) {
    return NextResponse.json({
      databaseMode: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 })
  }
}
