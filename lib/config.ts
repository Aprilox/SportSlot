/**
 * Configuration de l'application SportSlot
 * Gère les variables d'environnement et le mode de stockage
 * 
 * 3 modes disponibles:
 * - 'browser': localStorage dans le navigateur (par défaut, dev uniquement)
 * - 'local': base de données SQLite locale (fichier dev.db)
 * - 'external': base de données externe (PostgreSQL, MySQL, etc.)
 */

export type StorageMode = 'browser' | 'local' | 'external'

interface AppConfig {
  storageMode: StorageMode
  databaseUrl: string | null
  hashSecret: string
  appUrl: string
  isDevelopment: boolean
  isProduction: boolean
}

/**
 * Détermine le mode de stockage basé sur les variables d'environnement
 */
function determineStorageMode(): StorageMode {
  const configuredMode = process.env.STORAGE_MODE?.toLowerCase()
  const databaseUrl = process.env.DATABASE_URL || ''
  
  // Mode explicitement configuré
  if (configuredMode === 'browser') return 'browser'
  
  if (configuredMode === 'local') {
    // Vérifier que DATABASE_URL est configuré
    if (!databaseUrl) {
      console.warn('⚠️ STORAGE_MODE=local mais DATABASE_URL non configuré!')
      console.warn('   Ajoutez: DATABASE_URL="file:./dev.db" dans votre .env')
      console.warn('   Fallback vers mode browser')
      return 'browser'
    }
    return 'local'
  }
  
  if (configuredMode === 'external') {
    if (!databaseUrl) {
      console.warn('⚠️ STORAGE_MODE=external mais DATABASE_URL non configuré!')
      console.warn('   Fallback vers mode browser')
      return 'browser'
    }
    return 'external'
  }
  
  // Détection automatique basée sur DATABASE_URL (mode legacy 'database')
  if (configuredMode === 'database') {
    if (!databaseUrl) {
      console.warn('⚠️ STORAGE_MODE=database mais DATABASE_URL non configuré!')
      return 'browser'
    }
    // Détecter si local ou externe
    if (databaseUrl.includes('file:') || databaseUrl.includes('sqlite')) {
      return 'local'
    }
    if (databaseUrl.includes('postgresql') || databaseUrl.includes('mysql') || databaseUrl.includes('mongodb')) {
      return 'external'
    }
    return 'local'
  }
  
  // Pas de mode configuré = browser (localStorage)
  return 'browser'
}

/**
 * Récupère la configuration de l'application
 */
function getConfig(): AppConfig {
  const storageMode = determineStorageMode()
  const databaseUrl = process.env.DATABASE_URL || null
  const hashSecret = process.env.HASH_SECRET || 'default-dev-secret'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const nodeEnv = process.env.NODE_ENV || 'development'
  
  return {
    storageMode,
    databaseUrl,
    hashSecret,
    appUrl,
    isDevelopment: nodeEnv === 'development',
    isProduction: nodeEnv === 'production',
  }
}

export const config = getConfig()

/**
 * Vérifie si le mode database (local ou external) est actif
 */
export function isDatabaseMode(): boolean {
  return (config.storageMode === 'local' || config.storageMode === 'external') && !!config.databaseUrl
}

/**
 * Vérifie si le mode localStorage est actif
 */
export function isLocalStorageMode(): boolean {
  return config.storageMode === 'browser'
}

/**
 * Récupère le mode de stockage actuel
 */
export function getStorageMode(): StorageMode {
  return config.storageMode
}

/**
 * Récupère les infos du mode de stockage pour l'affichage
 */
export function getStorageModeInfo(): {
  mode: StorageMode
  label: string
  labelEn: string
  icon: string
  color: string
  description: string
} {
  switch (config.storageMode) {
    case 'browser':
      return {
        mode: 'browser',
        label: 'Navigateur - DEMO',
        labelEn: 'Browser - DEMO',
        icon: '🌐',
        color: '#f59e0b', // amber
        description: 'Mode démonstration - Données stockées dans le navigateur (non persistantes)'
      }
    case 'local':
      return {
        mode: 'local',
        label: 'DB Locale',
        labelEn: 'Local DB',
        icon: '💾',
        color: '#3b82f6', // blue
        description: 'Base de données SQLite locale'
      }
    case 'external':
      return {
        mode: 'external',
        label: 'DB Externe',
        labelEn: 'External DB',
        icon: '☁️',
        color: '#10b981', // green
        description: 'Base de données externe (PostgreSQL, MySQL, etc.)'
      }
  }
}

/**
 * Log la configuration actuelle (pour le debug)
 */
export function logConfig(): void {
  const modeInfo = getStorageModeInfo()
  console.log('🔧 SportSlot Configuration:')
  console.log(`   Mode: ${modeInfo.icon} ${modeInfo.label} (${config.storageMode})`)
  console.log(`   Database: ${config.databaseUrl ? 'Configured' : 'Not configured'}`)
  console.log(`   Environment: ${config.isDevelopment ? 'Development' : 'Production'}`)
}
