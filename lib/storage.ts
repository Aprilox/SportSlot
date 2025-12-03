/**
 * Couche de stockage unifiée pour SportSlot
 * Supporte localStorage (dev) et Database (production)
 * 
 * IMPORTANT: Ce fichier est utilisé côté client
 * Pour les opérations côté serveur, utilisez lib/db.ts directement
 */

// ===========================================
// TYPES & INTERFACES
// ===========================================

export interface Sport {
  id: string
  name: string
  enabled: boolean
  icon: string
  imageUrl?: string
}

export interface WorkingHours {
  dayOfWeek: number
  enabled: boolean
  startTime: string
  endTime: string
  slotDuration: number
}

export interface ClosedPeriod {
  id: string
  startDate: string
  endDate: string
  reason: string
  published?: boolean // true = visible pour les clients
  pendingDeletion?: boolean // true = marqué pour suppression
}

export interface BrandingSettings {
  siteName: string
  siteDescription: string
  siteTitle: string // Titre de l'onglet du navigateur (ex: "Réservation de créneaux sportifs")
  logoUrl: string
  logoOriginalUrl?: string // Image originale avant recadrage
  logoIcon: string
  logoBackground: boolean // true = afficher arrière-plan coloré, false = transparent
  primaryColor: string
  currency: string
  currencySymbol: string
  defaultLanguage: string // Langue par défaut (fr, en, de, etc.)
  contactEmail: string
  contactPhone: string
  address: string
}

export interface SmtpSettings {
  enabled: boolean
  host: string
  port: number
  secure: boolean // true pour SSL/TLS
  user: string
  password: string
  fromEmail: string
  fromName: string
  // Notifications
  notifyTeamOnBooking: boolean
  teamEmails: string[] // Emails de l'équipe pour les notifications
  sendConfirmationToClient: boolean
}

export interface Settings {
  defaultSlotDuration: number
  defaultMaxCapacity: number
  defaultPrice: number
  minBookingAdvance: number // Délai minimum de réservation en minutes (0 = pas de minimum)
  workingHours: WorkingHours[]
  closedPeriods: ClosedPeriod[]
  branding: BrandingSettings
  smtp?: SmtpSettings
  dataVersion: number // Version des données pour synchronisation client
}

export interface Booking {
  id: string
  slotId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  numberOfPeople: number
  totalPrice: number
  createdAt: string
  sportId: string
  sportName: string
  date: string
  time: string
}

export interface TimeSlot {
  id: string
  sportIds: string[]
  sportId?: string // Legacy support
  date: string
  time: string
  duration: number
  maxCapacity: number
  currentBookings: number
  price: number
  published: boolean // true = visible pour les clients, false = brouillon (orange dans admin)
  outsideWorkingHours?: boolean // true = hors horaires de travail (rouge dans admin, invisible pour clients)
  pendingDeletion?: boolean // true = marqué pour suppression (apparaît en rouge barré, supprimé à la publication)
  // Champs pour les modifications non publiées (déplacement/redimensionnement)
  originalDate?: string // Date originale avant déplacement (pour afficher au client)
  originalTime?: string // Heure originale avant déplacement
  originalDuration?: number // Durée originale avant redimensionnement
}

export interface AdminCredentials {
  username: string
  password: string
}

export type ViewMode = "week" | "month" | "year"

// ===========================================
// CLÉS DE STOCKAGE LOCAL
// ===========================================

const STORAGE_KEYS = {
  SPORTS: "sportslot_sports",
  SLOTS: "sportslot_slots",
  SETTINGS: "sportslot_settings",
  AUTH: "sportslot_auth",
  BOOKINGS: "sportslot_bookings",
  THEME: "sportslot_theme",
  ADMIN_CREDENTIALS: "sportslot_admin_credentials",
  STORAGE_MODE: "sportslot_storage_mode",
}

// ===========================================
// VALEURS PAR DÉFAUT
// ===========================================

const DEFAULT_SPORTS: Sport[] = [
  { id: "1", name: "Golf", enabled: true, icon: "⛳" },
  { id: "2", name: "Tennis", enabled: true, icon: "🎾" },
  { id: "3", name: "Padel", enabled: true, icon: "🏓" },
]

const DEFAULT_WORKING_HOURS: WorkingHours[] = [
  { dayOfWeek: 0, enabled: false, startTime: "09:00", endTime: "18:00", slotDuration: 60 },
  { dayOfWeek: 1, enabled: true, startTime: "09:00", endTime: "18:00", slotDuration: 60 },
  { dayOfWeek: 2, enabled: true, startTime: "09:00", endTime: "18:00", slotDuration: 60 },
  { dayOfWeek: 3, enabled: true, startTime: "09:00", endTime: "18:00", slotDuration: 60 },
  { dayOfWeek: 4, enabled: true, startTime: "09:00", endTime: "18:00", slotDuration: 60 },
  { dayOfWeek: 5, enabled: true, startTime: "09:00", endTime: "18:00", slotDuration: 60 },
  { dayOfWeek: 6, enabled: true, startTime: "09:00", endTime: "18:00", slotDuration: 60 },
]

const DEFAULT_BRANDING: BrandingSettings = {
  siteName: "SportSlot",
  siteDescription: "Réservez votre créneau sportif",
  siteTitle: "Réservation de créneaux sportifs",
  logoUrl: "",
  logoOriginalUrl: "",
  logoIcon: "🏆",
  logoBackground: true,
  primaryColor: "#3b82f6",
  currency: "CHF",
  currencySymbol: ".-",
  defaultLanguage: "fr",
  contactEmail: "",
  contactPhone: "",
  address: "",
}

const DEFAULT_SETTINGS: Settings = {
  defaultSlotDuration: 60,
  defaultMaxCapacity: 4,
  defaultPrice: 50,
  minBookingAdvance: 0, // 0 = pas de minimum, sinon en minutes
  workingHours: DEFAULT_WORKING_HOURS,
  closedPeriods: [],
  branding: DEFAULT_BRANDING,
  dataVersion: 1, // Incrémenté à chaque modification pour sync client
}

const DEFAULT_ADMIN_CREDENTIALS: AdminCredentials = {
  username: "admin",
  password: "admin",
}

// ===========================================
// FONCTIONS UTILITAIRES LOCALSTORAGE
// ===========================================

export const getFromStorage = <T,>(key: string, defaultValue: T): T => {
  if (typeof window === "undefined") return defaultValue
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : defaultValue
  } catch {
    return defaultValue
  }
}

export const saveToStorage = <T,>(key: string, value: T): void => {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    // Erreur silencieuse - localStorage peut être plein ou désactivé
  }
}

// ===========================================
// SYNCHRONISATION DATABASE
// ===========================================

// Timer pour la synchronisation debounced
let syncTimer: ReturnType<typeof setTimeout> | null = null

// Synchroniser les données vers la base de données (si en mode DB)
export const syncToDatabase = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false
  
  try {
    // Vérifier si on est en mode DB (via le cache localStorage)
    const storageMode = localStorage.getItem('sportslot_storage_mode')
    
    // Utiliser les getters pour éviter les dépendances circulaires
    const settings = getFromStorage(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS)
    const sports = getFromStorage(STORAGE_KEYS.SPORTS, DEFAULT_SPORTS)
    const slots = getFromStorage<TimeSlot[]>(STORAGE_KEYS.SLOTS, [])
    const bookings = getFromStorage<Booking[]>(STORAGE_KEYS.BOOKINGS, [])
    
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings, sports, slots, bookings })
    })
    
    const result = await response.json()
    
    if (result.mode === 'browser') {
      // Mode browser = pas de sync nécessaire, c'est normal
      return true
    }
    
    // Retirer le flag de sync en attente
    localStorage.removeItem('sportslot_pending_sync')
    
    if (result.success) {
      return true
    } else {
      return false
    }
  } catch (error) {
    // Retirer le flag même en cas d'erreur
    localStorage.removeItem('sportslot_pending_sync')
    return false
  }
}

// Planifier une synchronisation (debounced)
const scheduleDatabaseSync = () => {
  if (typeof window === 'undefined') return
  
  // Marquer qu'une sync est en attente (pour empêcher le DataLoader d'écraser les données)
  localStorage.setItem('sportslot_pending_sync', 'true')
  
  // Annuler le timer précédent
  if (syncTimer) {
    clearTimeout(syncTimer)
  }
  
  // Planifier une nouvelle synchronisation dans 2 secondes
  syncTimer = setTimeout(async () => {
    await syncToDatabase()
  }, 2000)
}

// ===========================================
// SPORTS
// ===========================================

export const getSports = (): Sport[] => {
  return getFromStorage(STORAGE_KEYS.SPORTS, DEFAULT_SPORTS)
}

export const saveSports = (sports: Sport[]): void => {
  saveToStorage(STORAGE_KEYS.SPORTS, sports)
  // Déclencher un événement pour la synchronisation client
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sportsChanged', { detail: sports }))
  }
  
  // Planifier une synchronisation DB
  scheduleDatabaseSync()
}

// ===========================================
// TIME SLOTS
// ===========================================

export const getSlots = (): TimeSlot[] => {
  return getFromStorage(STORAGE_KEYS.SLOTS, [])
}

export const saveSlots = (slots: TimeSlot[], options?: { immediate?: boolean }): void => {
  saveToStorage(STORAGE_KEYS.SLOTS, slots)
  
  // Émettre un événement pour notifier les autres composants
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('slotsChanged', { detail: slots }))
  }
  
  // Si synchronisation immédiate demandée (ex: réservation client)
  if (options?.immediate) {
    // Incrémenter la version pour que les autres clients détectent le changement
    incrementDataVersion()
    // Synchroniser immédiatement (pas de debounce)
    syncToDatabase()
  } else {
    // Planifier une synchronisation DB (debounced)
    scheduleDatabaseSync()
  }
}

// Obtenir uniquement les créneaux publiés (pour les clients)
export const getPublishedSlots = (): TimeSlot[] => {
  const slots = getSlots()
  return slots.filter(slot => slot.published !== false) // true ou undefined = publié
}

// Publier tous les créneaux non publiés et supprimer ceux marqués pour suppression
export const publishAllSlots = async (): Promise<{ published: number, deleted: number, deletedClosures: number, synced: boolean }> => {
  const slots = getSlots()
  let publishedCount = 0
  let deletedCount = 0
  
  // Filtrer les slots à supprimer et publier les autres
  const updatedSlots = slots
    .filter(slot => {
      if (slot.pendingDeletion) {
        deletedCount++
        return false // Supprimer ce slot
      }
      return true
    })
    .map(slot => {
      // Nettoyer les champs originaux (les modifications deviennent permanentes)
      const { originalDate, originalTime, originalDuration, ...cleanSlot } = slot
      
      if (slot.published === false || originalDate || originalTime || originalDuration) {
        publishedCount++
        return { ...cleanSlot, published: true }
      }
      return cleanSlot
    })
  
  saveSlots(updatedSlots)
  
  // Publier et supprimer les fermetures
  const settings = getSettings()
  let deletedClosuresCount = 0
  const updatedClosedPeriods = settings.closedPeriods
    .filter(period => {
      if (period.pendingDeletion) {
        deletedClosuresCount++
        return false // Supprimer cette fermeture
      }
      return true
    })
    .map(period => ({
      ...period,
      published: true
    }))
  saveSettings({ ...settings, closedPeriods: updatedClosedPeriods })
  
  // Incrémenter la version pour notifier les clients
  incrementDataVersion()
  
  // Synchroniser avec la DB
  const synced = await syncToDatabase()
  
  return { published: publishedCount, deleted: deletedCount, deletedClosures: deletedClosuresCount, synced }
}

// Vérifier s'il y a des créneaux non publiés ou à supprimer
export const hasUnpublishedSlots = (): boolean => {
  const slots = getSlots()
  const settings = getSettings()
  
  // Vérifier les créneaux non publiés ou marqués pour suppression
  const hasUnpublishedOrPending = slots.some(slot => slot.published === false || slot.pendingDeletion === true)
  
  // Vérifier les fermetures non publiées
  const hasUnpublishedClosures = settings.closedPeriods.some(period => period.published !== true)
  
  return hasUnpublishedOrPending || hasUnpublishedClosures
}

// Compter les créneaux en attente de suppression
export const getPendingDeletionCount = (): number => {
  const slots = getSlots()
  return slots.filter(slot => slot.pendingDeletion === true).length
}

// Compter les fermetures non publiées (excluant celles à supprimer)
export const getUnpublishedClosuresCount = (): number => {
  const settings = getSettings()
  return settings.closedPeriods.filter(period => period.published !== true && !period.pendingDeletion).length
}

// Compter les fermetures en attente de suppression
export const getPendingClosureDeletionCount = (): number => {
  const settings = getSettings()
  return settings.closedPeriods.filter(period => period.pendingDeletion === true).length
}

// ===========================================
// SETTINGS
// ===========================================

export const getSettings = (): Settings => {
  return getFromStorage(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS)
}

export const saveSettings = (settings: Settings, skipSync = false): void => {
  saveToStorage(STORAGE_KEYS.SETTINGS, settings)
  
  // Émettre un événement pour notifier les composants (ex: favicon dynamique)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('settingsChanged', { detail: settings }))
  }
  
  // Planifier une synchronisation DB (sauf si demandé de ne pas le faire)
  if (!skipSync) {
    scheduleDatabaseSync()
  }
}

// Fonction pour incrémenter la version des données (appelée par l'admin après modifications)
export const incrementDataVersion = (): number => {
  const settings = getSettings()
  const newVersion = (settings.dataVersion || 0) + 1
  saveSettings({ ...settings, dataVersion: newVersion })
  return newVersion
}

// Récupérer la version actuelle des données
export const getDataVersion = (): number => {
  const settings = getSettings()
  return settings.dataVersion || 1
}

// Vérifier si un créneau est dans les horaires de travail
export const isSlotWithinWorkingHours = (
  slot: TimeSlot, 
  workingHours: WorkingHours[]
): boolean => {
  const slotDate = new Date(slot.date)
  const dayOfWeek = slotDate.getDay()
  
  const wh = workingHours.find(w => w.dayOfWeek === dayOfWeek)
  
  // Si le jour n'est pas activé, le créneau est hors horaires
  if (!wh || !wh.enabled) {
    return false
  }
  
  // Convertir les heures en minutes pour comparaison
  const [slotHour, slotMin] = slot.time.split(':').map(Number)
  const slotStartMinutes = slotHour * 60 + slotMin
  const slotEndMinutes = slotStartMinutes + slot.duration
  
  const [startH, startM] = wh.startTime.split(':').map(Number)
  const [endH, endM] = wh.endTime.split(':').map(Number)
  const dayStartMinutes = startH * 60 + startM
  const dayEndMinutes = endH * 60 + endM
  
  // Le créneau doit commencer après l'ouverture et finir avant la fermeture
  return slotStartMinutes >= dayStartMinutes && slotEndMinutes <= dayEndMinutes
}

// Trouver les créneaux qui seront hors horaires avec de nouveaux horaires
export const findSlotsOutsideWorkingHours = (
  slots: TimeSlot[],
  workingHours: WorkingHours[]
): TimeSlot[] => {
  return slots.filter(slot => !isSlotWithinWorkingHours(slot, workingHours))
}

// Mettre à jour le statut outsideWorkingHours de tous les créneaux
export const updateSlotsWorkingHoursStatus = (workingHours: WorkingHours[]): number => {
  const slots = getSlots()
  let updatedCount = 0
  
  const updatedSlots = slots.map(slot => {
    const isOutside = !isSlotWithinWorkingHours(slot, workingHours)
    const wasOutside = slot.outsideWorkingHours === true
    
    if (isOutside !== wasOutside) {
      updatedCount++
      return { ...slot, outsideWorkingHours: isOutside }
    }
    return slot
  })
  
  if (updatedCount > 0) {
    saveSlots(updatedSlots)
    incrementDataVersion()
  }
  
  return updatedCount
}

// Récupérer uniquement les créneaux valides pour le client
// Un créneau est visible si :
// - Il est publié (published !== false) OU s'il est marqué pendingDeletion (car la suppression n'est pas confirmée)
// - OU il a des valeurs originales (il était publié avant d'être déplacé)
// - Il n'est PAS hors horaires de travail
// 
// IMPORTANT: Si un créneau a été déplacé/redimensionné mais pas encore publié,
// on affiche la position/durée ORIGINALE pour le client
export const getValidPublishedSlots = (): TimeSlot[] => {
  return getSlots()
    .filter(slot => {
      // Un slot pendingDeletion reste visible côté client jusqu'à confirmation
      const isPublishedOrPending = slot.published !== false || slot.pendingDeletion === true
      // Un slot avec des valeurs originales était publié avant d'être déplacé - il doit rester visible
      const hasOriginalValues = !!(slot.originalDate || slot.originalTime || slot.originalDuration)
      const isWithinWorkingHours = slot.outsideWorkingHours !== true
      
      // Visible si : (publié OU en attente de suppression OU déplacé) ET dans les horaires
      return (isPublishedOrPending || hasOriginalValues) && isWithinWorkingHours
    })
    .map(slot => {
      // Si le créneau a des valeurs originales (non publiées), les utiliser pour le client
      if (slot.originalDate || slot.originalTime || slot.originalDuration) {
        return {
          ...slot,
          date: slot.originalDate || slot.date,
          time: slot.originalTime || slot.time,
          duration: slot.originalDuration || slot.duration,
        }
      }
      return slot
    })
}

// ===========================================
// BOOKINGS
// ===========================================

export const getBookings = (): Booking[] => {
  return getFromStorage(STORAGE_KEYS.BOOKINGS, [])
}

export const saveBookings = (bookings: Booking[], options?: { immediate?: boolean }): void => {
  saveToStorage(STORAGE_KEYS.BOOKINGS, bookings)
  // Déclencher un événement pour la synchronisation en temps réel
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bookingsChanged', { detail: bookings }))
  }
  
  // Si synchronisation immédiate demandée (ex: nouvelle réservation)
  if (options?.immediate) {
    // Incrémenter la version pour que les autres clients détectent le changement
    incrementDataVersion()
    // Synchroniser immédiatement
    syncToDatabase()
  } else {
    // Planifier une synchronisation DB (debounced)
    scheduleDatabaseSync()
  }
}

// ===========================================
// AUTHENTIFICATION
// ===========================================

export const isAuthenticated = (): boolean => {
  return getFromStorage(STORAGE_KEYS.AUTH, false)
}

export const setAuthenticated = (value: boolean): void => {
  saveToStorage(STORAGE_KEYS.AUTH, value)
}

// ===========================================
// THEME
// ===========================================

export const getTheme = (): string => {
  return getFromStorage(STORAGE_KEYS.THEME, "light")
}

export const saveTheme = (theme: string): void => {
  saveToStorage(STORAGE_KEYS.THEME, theme)
}

// ===========================================
// ADMIN CREDENTIALS
// ===========================================

export const getAdminCredentials = (): AdminCredentials => {
  return getFromStorage(STORAGE_KEYS.ADMIN_CREDENTIALS, DEFAULT_ADMIN_CREDENTIALS)
}

export const saveAdminCredentials = (credentials: AdminCredentials): void => {
  saveToStorage(STORAGE_KEYS.ADMIN_CREDENTIALS, credentials)
}

/**
 * Vérifie les credentials admin (côté client)
 * Pour le mode DB, utilisez l'API route /api/auth/login
 */
export const verifyLocalCredentials = (username: string, password: string): boolean => {
  const creds = getAdminCredentials()
  return creds.username === username && creds.password === password
}

// ===========================================
// COMPATIBILITÉ
// ===========================================

// Pour la compatibilité avec l'ancien code
export const ADMIN_CREDENTIALS = DEFAULT_ADMIN_CREDENTIALS

// ===========================================
// EXPORTS DES DEFAULTS
// ===========================================

export { 
  DEFAULT_SPORTS, 
  DEFAULT_SETTINGS, 
  DEFAULT_WORKING_HOURS, 
  DEFAULT_BRANDING,
  DEFAULT_ADMIN_CREDENTIALS,
}
