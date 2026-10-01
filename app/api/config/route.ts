import { NextResponse } from 'next/server'
import { getStorageModeInfo, isDatabaseMode, config } from '@/lib/config'
import { initializeStorage, isUsingDatabase } from '@/lib/db'

/**
 * GET /api/config
 * Retourne les informations de configuration pour l'affichage dans l'admin
 */
export async function GET() {
  try {
    const modeInfo = getStorageModeInfo()
    
    // Initialiser la DB si nécessaire pour vérifier la connexion
    let dbConnected = false
    if (isDatabaseMode()) {
      const storageType = await initializeStorage()
      dbConnected = storageType === 'database' && isUsingDatabase()
    }
    
    return NextResponse.json({
      success: true,
      mode: modeInfo.mode,
      label: modeInfo.label,
      labelEn: modeInfo.labelEn,
      icon: modeInfo.icon,
      color: modeInfo.color,
      description: modeInfo.description,
      dbConnected,
      isDevelopment: config.isDevelopment,
      isProduction: config.isProduction
    })
  } catch (error) {
    console.error('Erreur config:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 })
  }
}
