/**
 * Client Prisma avec gestion de connexion
 * Utilise des imports dynamiques pour éviter les erreurs en mode local
 */

import { isDatabaseMode } from './config'

// Type pour le client Prisma (importé dynamiquement)
type PrismaClientType = import('@prisma/client').PrismaClient

// Déclaration globale pour le développement (Hot Reload)
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClientType | undefined
}

/**
 * État de connexion à la base de données
 */
let isConnected = false
let connectionError: Error | null = null
let prismaClient: PrismaClientType | null = null

/**
 * Récupère ou crée l'instance du client Prisma
 * Utilise un import dynamique pour ne charger Prisma que si nécessaire
 */
async function getPrismaClient(): Promise<PrismaClientType | null> {
  if (!isDatabaseMode()) {
    return null
  }
  
  // Utiliser le client global en développement
  if (globalThis.__prisma) {
    return globalThis.__prisma
  }
  
  // Utiliser le client existant
  if (prismaClient) {
    return prismaClient
  }
  
  try {
    // Import dynamique de Prisma - ne charge que si nécessaire
    const { PrismaClient } = await import('@prisma/client')
    
    prismaClient = new PrismaClient({
      log: process.env.NODE_ENV === 'development' 
        ? ['error', 'warn']
        : ['error'],
    })
    
    // Stocker dans global en développement
    if (process.env.NODE_ENV === 'development') {
      globalThis.__prisma = prismaClient
    }
    
    return prismaClient
  } catch (error) {
    console.error('❌ Impossible de charger Prisma:', error)
    return null
  }
}

/**
 * Exécute une opération avec le client Prisma
 * Retourne null si Prisma n'est pas disponible
 */
export async function withPrisma<T>(
  operation: (prisma: PrismaClientType) => Promise<T>
): Promise<T | null> {
  const client = await getPrismaClient()
  if (!client) {
    return null
  }
  return operation(client)
}

/**
 * Tente de se connecter à la base de données
 * @returns true si la connexion est établie
 */
export async function connectDatabase(): Promise<boolean> {
  if (!isDatabaseMode()) {
    console.log('📦 Mode localStorage actif - pas de connexion DB')
    return false
  }
  
  if (isConnected) {
    return true
  }
  
  try {
    const client = await getPrismaClient()
    if (!client) {
      throw new Error('Client Prisma non disponible')
    }
    
    await client.$connect()
    isConnected = true
    connectionError = null
    console.log('✅ Connexion à la base de données établie')
    return true
  } catch (error) {
    isConnected = false
    connectionError = error as Error
    console.error('❌ Erreur de connexion à la base de données:', error)
    console.log('📦 Fallback vers localStorage')
    return false
  }
}

/**
 * Déconnexion propre de la base de données
 */
export async function disconnectDatabase(): Promise<void> {
  if (isConnected && prismaClient) {
    await prismaClient.$disconnect()
    isConnected = false
    console.log('🔌 Déconnexion de la base de données')
  }
}

/**
 * Vérifie si la base de données est connectée
 */
export function isDatabaseConnected(): boolean {
  return isConnected
}

/**
 * Récupère l'erreur de connexion si elle existe
 */
export function getConnectionError(): Error | null {
  return connectionError
}

/**
 * Vérifie la santé de la connexion
 */
export async function healthCheck(): Promise<{
  status: 'ok' | 'error' | 'not_configured'
  mode: 'database' | 'local'
  message: string
}> {
  if (!isDatabaseMode()) {
    return {
      status: 'ok',
      mode: 'local',
      message: 'Mode localStorage actif'
    }
  }
  
  try {
    const client = await getPrismaClient()
    if (!client) {
      throw new Error('Client Prisma non disponible')
    }
    
    // Test simple de connexion
    await client.$queryRaw`SELECT 1`
    return {
      status: 'ok',
      mode: 'database',
      message: 'Base de données connectée'
    }
  } catch (error) {
    return {
      status: 'error',
      mode: 'database',
      message: `Erreur: ${(error as Error).message}`
    }
  }
}
