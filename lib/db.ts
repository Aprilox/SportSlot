/**
 * Couche d'abstraction pour le stockage de données
 * Gère automatiquement le basculement entre DB et localStorage
 * Utilise des imports dynamiques pour éviter les erreurs en mode local
 */

import { isDatabaseConnected, connectDatabase, withPrisma } from './prisma'
import { isDatabaseMode } from './config'
import type { 
  Sport, 
  TimeSlot, 
  Booking, 
  Settings, 
  AdminCredentials,
  WorkingHours,
  ClosedPeriod,
  BrandingSettings
} from './storage'

// ===========================================
// INITIALISATION
// ===========================================

let dbInitialized = false

/**
 * Initialise la connexion à la DB si nécessaire
 */
export async function initializeStorage(): Promise<'database' | 'local'> {
  if (dbInitialized) {
    return isDatabaseConnected() ? 'database' : 'local'
  }
  
  if (isDatabaseMode()) {
    const connected = await connectDatabase()
    dbInitialized = true
    return connected ? 'database' : 'local'
  }
  
  dbInitialized = true
  return 'local'
}

/**
 * Vérifie si on utilise la DB
 */
export function isUsingDatabase(): boolean {
  return isDatabaseMode() && isDatabaseConnected()
}

// ===========================================
// HASH UTILITIES (chargées dynamiquement)
// ===========================================

async function getHashUtils() {
  const { hashPassword, verifyPassword, needsMigration } = await import('./hash')
  return { hashPassword, verifyPassword, needsMigration }
}

// ===========================================
// ADMIN CREDENTIALS
// ===========================================

/**
 * Récupère les credentials admin depuis la DB
 */
export async function getAdminCredentialsFromDB(): Promise<AdminCredentials | null> {
  if (!isUsingDatabase()) return null
  
  return withPrisma(async (prisma) => {
    try {
      const creds = await prisma.adminCredentials.findFirst({
        where: { id: 'admin' }
      })
      
      if (creds) {
        return {
          username: creds.username,
          password: creds.password, // Hashé
        }
      }
      return null
    } catch (error) {
      console.error('Erreur DB getAdminCredentials:', error)
      return null
    }
  })
}

/**
 * Sauvegarde les credentials admin dans la DB
 */
export async function saveAdminCredentialsToDB(credentials: AdminCredentials): Promise<boolean> {
  if (!isUsingDatabase()) return false
  
  const result = await withPrisma(async (prisma) => {
    try {
      const { hashPassword, needsMigration } = await getHashUtils()
      
      // Hash le mot de passe si ce n'est pas déjà fait
      const hashedPassword = needsMigration(credentials.password)
        ? await hashPassword(credentials.password)
        : credentials.password
      
      await prisma.adminCredentials.upsert({
        where: { id: 'admin' },
        update: {
          username: credentials.username,
          password: hashedPassword,
        },
        create: {
          id: 'admin',
          username: credentials.username,
          password: hashedPassword,
        }
      })
      return true
    } catch (error) {
      console.error('Erreur DB saveAdminCredentials:', error)
      return false
    }
  })
  
  return result ?? false
}

/**
 * Vérifie les credentials admin
 */
export async function verifyAdminCredentials(
  username: string, 
  password: string
): Promise<boolean> {
  if (!isUsingDatabase()) {
    // Mode localStorage: la vérification se fait côté client
    return false
  }
  
  try {
    const creds = await getAdminCredentialsFromDB()
    if (!creds) return false
    
    if (creds.username !== username) return false
    
    const { verifyPassword } = await getHashUtils()
    return await verifyPassword(password, creds.password)
  } catch (error) {
    console.error('Erreur vérification credentials:', error)
    return false
  }
}

// ===========================================
// SETTINGS
// ===========================================

/**
 * Récupère les paramètres depuis la DB
 */
export async function getSettingsFromDB(): Promise<Settings | null> {
  if (!isUsingDatabase()) return null
  
  return withPrisma(async (prisma) => {
    try {
      const settings = await prisma.settings.findFirst({
        where: { id: 'main' }
      })
      
      if (settings) {
        return {
          defaultSlotDuration: settings.defaultSlotDuration,
          defaultMaxCapacity: settings.defaultMaxCapacity,
          defaultPrice: settings.defaultPrice,
          minBookingAdvance: settings.minBookingAdvance || 0,
          dataVersion: settings.dataVersion || 0,
          branding: JSON.parse(settings.branding) as BrandingSettings,
          workingHours: JSON.parse(settings.workingHours) as WorkingHours[],
          closedPeriods: JSON.parse(settings.closedPeriods) as ClosedPeriod[],
          smtp: settings.smtp ? JSON.parse(settings.smtp) : undefined,
        }
      }
      return null
    } catch (error) {
      console.error('Erreur DB getSettings:', error)
      return null
    }
  })
}

/**
 * Sauvegarde les paramètres dans la DB
 */
export async function saveSettingsToDB(settings: Settings): Promise<boolean> {
  if (!isUsingDatabase()) return false
  
  const result = await withPrisma(async (prisma) => {
    try {
      await prisma.settings.upsert({
        where: { id: 'main' },
        update: {
          defaultSlotDuration: settings.defaultSlotDuration,
          defaultMaxCapacity: settings.defaultMaxCapacity,
          defaultPrice: settings.defaultPrice,
          minBookingAdvance: settings.minBookingAdvance || 0,
          dataVersion: settings.dataVersion || 0,
          branding: JSON.stringify(settings.branding),
          workingHours: JSON.stringify(settings.workingHours),
          closedPeriods: JSON.stringify(settings.closedPeriods),
          smtp: settings.smtp ? JSON.stringify(settings.smtp) : '{}',
        },
        create: {
          id: 'main',
          defaultSlotDuration: settings.defaultSlotDuration,
          defaultMaxCapacity: settings.defaultMaxCapacity,
          defaultPrice: settings.defaultPrice,
          minBookingAdvance: settings.minBookingAdvance || 0,
          dataVersion: settings.dataVersion || 0,
          branding: JSON.stringify(settings.branding),
          workingHours: JSON.stringify(settings.workingHours),
          closedPeriods: JSON.stringify(settings.closedPeriods),
          smtp: settings.smtp ? JSON.stringify(settings.smtp) : '{}',
        }
      })
      return true
    } catch (error) {
      console.error('Erreur DB saveSettings:', error)
      return false
    }
  })
  
  return result ?? false
}

// ===========================================
// SPORTS
// ===========================================

/**
 * Récupère les sports depuis la DB
 */
export async function getSportsFromDB(): Promise<Sport[] | null> {
  if (!isUsingDatabase()) return null
  
  return withPrisma(async (prisma) => {
    try {
      const sports = await prisma.sport.findMany({
        orderBy: { order: 'asc' }
      })
      
      return sports.map(s => ({
        id: s.id,
        name: s.name,
        enabled: s.enabled,
        icon: s.icon,
        imageUrl: s.imageUrl || undefined,
      }))
    } catch (error) {
      console.error('Erreur DB getSports:', error)
      return null
    }
  })
}

/**
 * Sauvegarde les sports dans la DB
 */
export async function saveSportsToDB(sports: Sport[]): Promise<boolean> {
  if (!isUsingDatabase()) return false
  
  const result = await withPrisma(async (prisma) => {
    try {
      // Transaction pour remplacer tous les sports
      await prisma.$transaction(async (tx) => {
        // Supprimer tous les sports existants
        await tx.sport.deleteMany()
        
        // Créer les nouveaux
        await tx.sport.createMany({
          data: sports.map((s, index) => ({
            id: s.id,
            name: s.name,
            enabled: s.enabled,
            icon: s.icon,
            imageUrl: s.imageUrl || null,
            order: index,
          }))
        })
      })
      return true
    } catch (error) {
      console.error('Erreur DB saveSports:', error)
      return false
    }
  })
  
  return result ?? false
}

// ===========================================
// TIME SLOTS
// ===========================================

/**
 * Récupère les créneaux depuis la DB
 */
export async function getSlotsFromDB(): Promise<TimeSlot[] | null> {
  if (!isUsingDatabase()) return null
  
  return withPrisma(async (prisma) => {
    try {
      const slots = await prisma.timeSlot.findMany({
        include: { sports: true },
        orderBy: [{ date: 'asc' }, { time: 'asc' }]
      })
      
      return slots.map(s => ({
        id: s.id,
        date: s.date,
        time: s.time,
        duration: s.duration,
        maxCapacity: s.maxCapacity,
        currentBookings: s.currentBookings,
        price: s.price,
        sportIds: s.sports.map(sp => sp.id),
        published: s.published,
        outsideWorkingHours: s.outsideWorkingHours,
        // Champs pour les modifications non publiées
        originalDate: s.originalDate || undefined,
        originalTime: s.originalTime || undefined,
        originalDuration: s.originalDuration || undefined,
      }))
    } catch (error) {
      console.error('Erreur DB getSlots:', error)
      return null
    }
  })
}

/**
 * Sauvegarde les créneaux dans la DB
 */
export async function saveSlotsToDB(slots: TimeSlot[]): Promise<boolean> {
  if (!isUsingDatabase()) return false
  
  const result = await withPrisma(async (prisma) => {
    try {
      // Récupérer les IDs des sports existants
      const existingSports = await prisma.sport.findMany({
        select: { id: true }
      })
      const existingSportIds = new Set(existingSports.map(s => s.id))
      
      await prisma.$transaction(async (tx) => {
        // Supprimer tous les slots existants
        await tx.timeSlot.deleteMany()
        
        // Créer les nouveaux avec leurs relations sports
        for (const slot of slots) {
          // Filtrer les sportIds pour ne garder que ceux qui existent
          const validSportIds = slot.sportIds.filter(id => existingSportIds.has(id))
          
          await tx.timeSlot.create({
            data: {
              id: slot.id,
              date: slot.date,
              time: slot.time,
              duration: slot.duration,
              maxCapacity: slot.maxCapacity,
              currentBookings: slot.currentBookings,
              price: slot.price,
              published: slot.published ?? false,
              outsideWorkingHours: slot.outsideWorkingHours ?? false,
              // Champs pour les modifications non publiées
              originalDate: slot.originalDate || null,
              originalTime: slot.originalTime || null,
              originalDuration: slot.originalDuration || null,
              sports: validSportIds.length > 0 ? {
                connect: validSportIds.map(id => ({ id }))
              } : undefined
            }
          })
        }
      })
      return true
    } catch (error) {
      console.error('❌ Erreur DB saveSlots:', error)
      // Afficher plus de détails sur l'erreur
      if (error instanceof Error) {
        console.error('   Message:', error.message)
        console.error('   Stack:', error.stack?.split('\n').slice(0, 3).join('\n'))
      }
      return false
    }
  })
  
  return result ?? false
}

// ===========================================
// BOOKINGS
// ===========================================

/**
 * Récupère les réservations depuis la DB
 */
export async function getBookingsFromDB(): Promise<Booking[] | null> {
  if (!isUsingDatabase()) return null
  
  return withPrisma(async (prisma) => {
    try {
      const bookings = await prisma.booking.findMany({
        orderBy: { createdAt: 'desc' }
      })
      
      return bookings.map(b => ({
        id: b.id,
        slotId: b.slotId,
        customerName: b.customerName,
        customerEmail: b.customerEmail,
        customerPhone: b.customerPhone || '',
        numberOfPeople: b.numberOfPeople,
        totalPrice: b.totalPrice,
        sportId: b.sportId || '',
        sportName: b.sportName,
        date: b.date,
        time: b.time,
        createdAt: b.createdAt.toISOString(),
      }))
    } catch (error) {
      console.error('Erreur DB getBookings:', error)
      return null
    }
  })
}

/**
 * Sauvegarde les réservations dans la DB
 */
export async function saveBookingsToDB(bookings: Booking[]): Promise<boolean> {
  if (!isUsingDatabase()) return false
  
  const result = await withPrisma(async (prisma) => {
    try {
      // Récupérer les IDs des slots existants pour filtrer les bookings valides
      const existingSlots = await prisma.timeSlot.findMany({
        select: { id: true }
      })
      const existingSlotIds = new Set(existingSlots.map(s => s.id))
      
      // Filtrer les bookings dont le slot existe
      const validBookings = bookings.filter(b => existingSlotIds.has(b.slotId))
      
      if (validBookings.length < bookings.length) {
        console.log(`⚠️ ${bookings.length - validBookings.length} bookings ignorés (slots non trouvés)`)
      }
      
      await prisma.$transaction(async (tx) => {
        await tx.booking.deleteMany()
        
        if (validBookings.length > 0) {
          await tx.booking.createMany({
            data: validBookings.map(b => ({
              id: b.id,
              slotId: b.slotId,
              customerName: b.customerName,
              customerEmail: b.customerEmail,
              customerPhone: b.customerPhone || '',
              numberOfPeople: b.numberOfPeople,
              totalPrice: b.totalPrice,
              sportId: b.sportId || '',
              sportName: b.sportName,
              date: b.date,
              time: b.time,
              createdAt: new Date(b.createdAt),
            }))
          })
        }
      })
      return true
    } catch (error) {
      console.error('Erreur DB saveBookings:', error)
      return false
    }
  })
  
  return result ?? false
}

// ===========================================
// UTILITAIRES
// ===========================================

/**
 * Migre les données du localStorage vers la DB
 */
export async function migrateToDatabase(): Promise<{
  success: boolean
  message: string
  migrated: string[]
}> {
  if (!isUsingDatabase()) {
    return {
      success: false,
      message: 'Mode database non actif',
      migrated: []
    }
  }
  
  const migrated: string[] = []
  
  try {
    // Import dynamique pour éviter les erreurs côté serveur
    const storage = await import('./storage')
    
    // Migrer les settings
    const settings = storage.getSettings()
    if (await saveSettingsToDB(settings)) {
      migrated.push('settings')
    }
    
    // Migrer les sports
    const sports = storage.getSports()
    if (await saveSportsToDB(sports)) {
      migrated.push('sports')
    }
    
    // Migrer les slots
    const slots = storage.getSlots()
    if (await saveSlotsToDB(slots)) {
      migrated.push('slots')
    }
    
    // Migrer les bookings
    const bookings = storage.getBookings()
    if (await saveBookingsToDB(bookings)) {
      migrated.push('bookings')
    }
    
    // Migrer les credentials admin
    const creds = storage.getAdminCredentials()
    if (await saveAdminCredentialsToDB(creds)) {
      migrated.push('adminCredentials')
    }
    
    return {
      success: true,
      message: `Migration réussie: ${migrated.length} éléments migrés`,
      migrated
    }
  } catch (error) {
    return {
      success: false,
      message: `Erreur de migration: ${(error as Error).message}`,
      migrated
    }
  }
}


