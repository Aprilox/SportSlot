"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import LanguageSwitcher from "@/components/LanguageSwitcher"
import { SUPPORTED_LANGUAGES } from "@/lib/i18n"
import type {
  DateSelectArg,
  DatesSetArg,
  EventClickArg,
  EventContentArg,
  EventDropArg,
} from "@fullcalendar/core"

// Type pour le resize d'événement (compatible avec FullCalendar)
interface EventResizeInfo {
  event: {
    id: string
    start: Date | null
    end: Date | null
    extendedProps?: Record<string, unknown>
  }
  revert: () => void
}
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import timeGridPlugin from "@fullcalendar/timegrid"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useDialog } from "@/components/ui/custom-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Trophy,
  Plus,
  Calendar,
  Users,
  DollarSign,
  LogOut,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ChevronLeft,
  ChevronRight,
  Eraser,
  Building2,
  Palette,
  Mail,
  Phone,
  MapPin,
  Key,
  Eye,
  EyeOff,
  Shield,
  Database,
  HardDrive,
  Upload,
  Link,
  X,
  Image as ImageIcon,
  Move,
  ZoomIn,
  ZoomOut,
  BarChart3,
  TrendingUp,
  PieChart,
  Clock,
  RefreshCw,
  Download,
  UserCheck,
  Target,
} from "lucide-react"
import {
  isAuthenticated,
  setAuthenticated,
  getSports,
  saveSports,
  getSlots,
  saveSlots,
  getSettings,
  saveSettings,
  getAdminCredentials,
  saveAdminCredentials,
  getBookings,
  incrementDataVersion,
  publishAllSlots,
  hasUnpublishedSlots,
  findSlotsOutsideWorkingHours,
  updateSlotsWorkingHoursStatus,
  isSlotWithinWorkingHours,
  getPendingDeletionCount,
  getUnpublishedClosuresCount,
  getPendingClosureDeletionCount,
  saveBookings,
  type Sport,
  type TimeSlot,
  type ClosedPeriod,
  type BrandingSettings,
  type AdminCredentials,
  type WorkingHours,
  type Booking,
} from "@/lib/storage"

const FullCalendar = dynamic(() => import("@fullcalendar/react"), {
  ssr: false,
}) as typeof import("@fullcalendar/react").default

export default function AdminPage() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const { showAlert, showConfirm } = useDialog()
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [sports, setSports] = useState<Sport[]>([])
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [settings, setSettingsState] = useState(getSettings())
  const [editableWorkingHours, setEditableWorkingHours] = useState<WorkingHours[]>(getSettings().workingHours)
  const [isSportDialogOpen, setIsSportDialogOpen] = useState(false)
  const [isVacationDialogOpen, setIsVacationDialogOpen] = useState(false)
  const [editingSport, setEditingSport] = useState<Sport | null>(null)
  const [calendarView, setCalendarView] = useState<"timeGridWeek" | "dayGridMonth">("timeGridWeek")
  const [calendarTitle, setCalendarTitle] = useState("")
  const [calendarDate, setCalendarDate] = useState<Date>(new Date())
  const [calendarMeta, setCalendarMeta] = useState<{
    type: string
    currentStart: Date
    currentEnd: Date
  } | null>(null)
  const [selectedSportFilter, setSelectedSportFilter] = useState<string>("all")
  
  // États pour la vue mobile de l'agenda
  const [isMobileAgendaView, setIsMobileAgendaView] = useState(false)
  const [selectedDayIndex, setSelectedDayIndex] = useState(0) // 0 = premier jour de la semaine affichée
  const [mobileTargetDate, setMobileTargetDate] = useState<Date | null>(null) // Date cible pour navigation mobile
  // Swipe jours (sur la zone du calendrier)
  const [mobileDaySwipeStart, setMobileDaySwipeStart] = useState<number | null>(null)
  const [mobileDaySwipeOffset, setMobileDaySwipeOffset] = useState(0)
  const [isMobileDaySwiping, setIsMobileDaySwiping] = useState(false)
  // Swipe semaines (sur la barre des dates)
  const [mobileWeekSwipeStart, setMobileWeekSwipeStart] = useState<number | null>(null)
  const [mobileWeekSwipeOffset, setMobileWeekSwipeOffset] = useState(0)
  const [isMobileWeekSwiping, setIsMobileWeekSwiping] = useState(false)

  const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null)
  const [isSlotDialogOpen, setIsSlotDialogOpen] = useState(false)
  const [slotForm, setSlotForm] = useState({
    sportId: "" as string,
    maxCapacity: 4,
    price: 50,
    duration: 60,
  })
  
  // Dialog de création de créneau (choix des sports)
  const [createSlotDialog, setCreateSlotDialog] = useState<{
    isOpen: boolean
    date: string
    time: string
    duration: number
    price: number
    maxCapacity: number
    selectedSports: string[]
  }>({ isOpen: false, date: '', time: '', duration: 60, price: 50, maxCapacity: 4, selectedSports: [] })

  const [activeTab, setActiveTab] = useState("agenda")
  
  // Mode de l'agenda : "view" pour consulter, "edit" pour modifier
  const [agendaMode, setAgendaMode] = useState<"view" | "edit">("view")
  
  // Mode d'édition : "slot" pour créer des créneaux, "closure" pour créer des fermetures
  const [editMode, setEditMode] = useState<"slot" | "closure" | "eraser">("slot")
  
  // État pour le mode gomme "peinture" (maintenir clic pour effacer en glissant)
  const [isErasing, setIsErasing] = useState(false)
  const [isRightClicking, setIsRightClicking] = useState(false) // Clic droit pour désélectionner
  
  // Modal de détails de réservation (mode vue)
  const [bookingDetailsModal, setBookingDetailsModal] = useState<{
    isOpen: boolean
    slot: TimeSlot | null
    bookings: Booking[]
  }>({ isOpen: false, slot: null, bookings: [] })
  
  // État pour le test SMTP
  const [smtpTestStatus, setSmtpTestStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [smtpPasswordInput, setSmtpPasswordInput] = useState<string>('')
  
  // Notifications pour les nouvelles réservations
  const [notifications, setNotifications] = useState<Array<{
    id: string
    type: 'booking'
    message: string
    details: string
    timestamp: Date
  }>>([])
  const [lastBookingsCount, setLastBookingsCount] = useState<number>(0)

  // État pour les credentials admin
  const [adminCredentials, setAdminCredentials] = useState<AdminCredentials>(getAdminCredentials())
  
  // États pour la gestion du logo
  const [logoInputMode, setLogoInputMode] = useState<"url" | "upload">("url")
  const [isLogoCropperOpen, setIsLogoCropperOpen] = useState(false)
  const [cropImageSrc, setCropImageSrc] = useState<string>("")
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 })
  const [cropZoom, setCropZoom] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 })
  const [logoUrlInput, setLogoUrlInput] = useState("")
  
  // États pour l'onglet Statistiques
  const [statsSportFilter, setStatsSportFilter] = useState<string>("all")
  const [statsPeriod, setStatsPeriod] = useState<string>("thisMonth")
  // États locaux pour les inputs de date (évite le freeze pendant la saisie)
  const [statsCustomDateStartInput, setStatsCustomDateStartInput] = useState<string>("")
  const [statsCustomDateEndInput, setStatsCustomDateEndInput] = useState<string>("")
  // États validés pour les calculs (mis à jour après debounce)
  const [statsCustomDateStart, setStatsCustomDateStart] = useState<string>("")
  const [statsCustomDateEnd, setStatsCustomDateEnd] = useState<string>("")
  const [statsChartType, setStatsChartType] = useState<"revenue" | "bookings">("revenue")
  
  // États pour la popup d'export PDF
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [exportOptions, setExportOptions] = useState({
    mode: "summary" as "summary" | "detailed",
    period: "current" as "current" | "custom",
    customStartDate: "",
    customEndDate: "",
    includeSportFilter: true,
  })
  
  // Debounce pour les dates personnalisées (évite le freeze)
  useEffect(() => {
    const timer = setTimeout(() => {
      // Valider le format avant de mettre à jour
      if (/^\d{4}-\d{2}-\d{2}$/.test(statsCustomDateStartInput) || statsCustomDateStartInput === "") {
        setStatsCustomDateStart(statsCustomDateStartInput)
      }
    }, 500) // 500ms de délai
    return () => clearTimeout(timer)
  }, [statsCustomDateStartInput])
  
  useEffect(() => {
    const timer = setTimeout(() => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(statsCustomDateEndInput) || statsCustomDateEndInput === "") {
        setStatsCustomDateEnd(statsCustomDateEndInput)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [statsCustomDateEndInput])
  const [isLoadingLogoUrl, setIsLoadingLogoUrl] = useState(false)
  const logoFileInputRef = useRef<HTMLInputElement>(null)
  const cropperRef = useRef<HTMLDivElement>(null)
  const cropImageRef = useRef<HTMLImageElement>(null)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    showCurrent: false,
    showNew: false,
    showConfirm: false,
  })
  const [passwordError, setPasswordError] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState("")

  // État pour le mode de stockage (browser, local, external)
  const [storageMode, setStorageMode] = useState<{
    mode: 'browser' | 'local' | 'external' | 'checking'
    label: string
    icon: string
    color: string
  }>({ mode: 'checking', label: '', icon: '', color: '' })
  
  // État pour le dialog de fermeture simple (un seul jour)
  const [closureDialog, setClosureDialog] = useState<{
    isOpen: boolean
    date: string
    reason: string
    hasSlots: boolean
    slotsCount: number
    bookingsCount: number
  } | null>(null)
  
  // État pour l'édition rapide inline
  const [quickEdit, setQuickEdit] = useState<{
    slotId: string
    field: "price" | "capacity" | "duration" | "sports" | "delete"
    value: string
    position: { x: number; y: number }
    selectedSports?: string[]
  } | null>(null)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/admin/login")
    } else {
      setSports(getSports())
      setSlots(getSlots())
      setBookings(getBookings())
      
      // Migration : s'assurer que branding existe dans les settings
      const currentSettings = getSettings()
      if (!currentSettings.branding) {
        const updatedSettings = {
          ...currentSettings,
          branding: {
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
            timeFormat: "24h" as const,
            contactEmail: "",
            contactPhone: "",
            address: "",
          }
        }
        setSettingsState(updatedSettings)
        saveSettings(updatedSettings)
      }

      // Détecter le mode de stockage
      fetch('/api/config')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setStorageMode({
              mode: data.mode,
              label: i18n.language === 'en' ? data.labelEn : data.label,
              icon: data.icon,
              color: data.color
            })
          } else {
            setStorageMode({ mode: 'browser', label: 'Navigateur', icon: '🌐', color: '#f59e0b' })
          }
        })
        .catch(() => setStorageMode({ mode: 'browser', label: 'Navigateur', icon: '🌐', color: '#f59e0b' }))
      
      // Fin du chargement
      setIsPageLoading(false)
    }
  }, [router])

  // Synchronisation en temps réel des réservations et créneaux avec notifications
  useEffect(() => {
    const handleBookingsChanged = () => {
      const newBookings = getBookings()
      const previousCount = bookings.length
      
      // Détecter les nouvelles réservations
      if (newBookings.length > previousCount) {
        const newOnes = newBookings.slice(previousCount)
        newOnes.forEach(booking => {
          const notification = {
            id: `notif-${Date.now()}-${Math.random()}`,
            type: 'booking' as const,
            message: `🎉 Nouvelle réservation!`,
            details: `${booking.customerName} - ${booking.sportName} - ${booking.numberOfPeople} pers.`,
            timestamp: new Date()
          }
          setNotifications(prev => [notification, ...prev].slice(0, 5))
          
          // Jouer un son de notification (optionnel)
          try {
            const audio = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU')
          } catch {}
        })
      }
      
      setBookings(newBookings)
    }
    
    const handleSlotsChanged = () => {
      setSlots(getSlots())
    }
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sportslot_bookings') {
        handleBookingsChanged()
      }
      if (e.key === 'sportslot_slots') {
        setSlots(getSlots())
      }
    }
    
    window.addEventListener('bookingsChanged', handleBookingsChanged)
    window.addEventListener('slotsChanged', handleSlotsChanged)
    window.addEventListener('storage', handleStorageChange)
    
    return () => {
      window.removeEventListener('bookingsChanged', handleBookingsChanged)
      window.removeEventListener('slotsChanged', handleSlotsChanged)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [bookings.length])

  // Gérer le wheel event avec passive: false pour empêcher le scroll
  useEffect(() => {
    const cropper = cropperRef.current
    if (!cropper || !isLogoCropperOpen) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setCropZoom(z => Math.max(0.5, Math.min(3, z + delta)))
    }

    cropper.addEventListener('wheel', handleWheel, { passive: false })
    return () => cropper.removeEventListener('wheel', handleWheel)
  }, [isLogoCropperOpen])

  // Auto-supprimer les notifications après 8 secondes
  useEffect(() => {
    if (notifications.length === 0) return
    
    const timer = setTimeout(() => {
      setNotifications(prev => prev.slice(0, -1))
    }, 8000)
    
    return () => clearTimeout(timer)
  }, [notifications])

  // Auto-sélectionner le premier sport si "all" n'est plus disponible (> 2 sports)
  useEffect(() => {
    const enabledSports = sports.filter(s => s.enabled)
    const showAllOption = enabledSports.length <= 2
    
    if (!showAllOption && selectedSportFilter === "all" && enabledSports.length > 0) {
      setSelectedSportFilter(enabledSports[0].id)
    }
  }, [sports, selectedSportFilter])

  // Détecter si on est sur mobile pour l'agenda (< 640px)
  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth < 640
      setIsMobileAgendaView(isMobile)
      // Initialiser le jour sélectionné sur aujourd'hui si on passe en mobile
      if (isMobile) {
        const today = new Date()
        const startOfWeek = new Date(calendarDate)
        const day = startOfWeek.getDay()
        const diff = day === 0 ? -6 : 1 - day
        startOfWeek.setDate(startOfWeek.getDate() + diff)
        
        // Calculer l'index du jour actuel par rapport au lundi
        const todayIndex = Math.floor((today.getTime() - startOfWeek.getTime()) / (1000 * 60 * 60 * 24))
        if (todayIndex >= 0 && todayIndex < 7) {
          setSelectedDayIndex(todayIndex)
        }
      }
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [calendarDate])

  const [sportForm, setSportForm] = useState({
    name: "",
    icon: "⚽",
    imageUrl: "",
  })

  const [vacationForm, setVacationForm] = useState({
    startDate: "",
    endDate: "",
    reason: "",
  })

  // État pour le dialog de génération avancée de créneaux
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false)
  const [generateForm, setGenerateForm] = useState({
    startDate: "",
    endDate: "",
    duration: 60,
    sportIds: [] as string[],
    maxCapacity: 4,
    price: 50,
    hasLunchBreak: false,
    lunchBreakStart: "12:00",
    lunchBreakEnd: "14:00",
  })

  const handleLogout = () => {
    setAuthenticated(false)
    router.push("/")
  }

  // Helper pour formater une date en YYYY-MM-DD (timezone local)
  const formatDateLocal = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Ouvrir le dialog de génération avec les valeurs par défaut
  const openGenerateDialog = () => {
    // Passer automatiquement en mode Éditer si on est en mode Vue
    if (agendaMode === "view") {
      setAgendaMode("edit")
    }
    
    const today = new Date()
    const nextWeek = new Date()
    nextWeek.setDate(today.getDate() + 7)
    
    setGenerateForm({
      startDate: formatDateLocal(today),
      endDate: formatDateLocal(nextWeek),
      duration: settings.defaultSlotDuration,
      sportIds: sports.filter(s => s.enabled).map(s => s.id),
      maxCapacity: settings.defaultMaxCapacity,
      price: settings.defaultPrice,
      hasLunchBreak: false,
      lunchBreakStart: "12:00",
      lunchBreakEnd: "14:00",
    })
    setIsGenerateDialogOpen(true)
  }

  // Générer les créneaux avec les paramètres avancés
  const generateSlotsAdvanced = async () => {
    if (!generateForm.startDate || !generateForm.endDate) {
      await showAlert(t('admin.generate.selectDates'), { variant: 'warning' })
      return
    }
    if (generateForm.sportIds.length === 0) {
      await showAlert(t('admin.generate.selectAtLeastOneSport'), { variant: 'warning' })
      return
    }

    const startDate = new Date(generateForm.startDate + "T00:00:00")
    const endDate = new Date(generateForm.endDate + "T23:59:59")

    const newSlots: TimeSlot[] = []

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay()
      const dateStr = formatDateLocal(d)

      // Vérifier si le jour est fermé
      const isClosed = settings.closedPeriods.some((period) => {
        return dateStr >= period.startDate && dateStr <= period.endDate
      })
      if (isClosed) continue

      // Vérifier les horaires de travail pour ce jour
      const workingHour = settings.workingHours.find((wh) => wh.dayOfWeek === dayOfWeek)
      if (!workingHour || !workingHour.enabled) continue

      const [startHour, startMin] = workingHour.startTime.split(":").map(Number)
      const [endHour, endMin] = workingHour.endTime.split(":").map(Number)

      const dayStartMinutes = startHour * 60 + startMin
      const dayEndMinutes = endHour * 60 + endMin

      // Préparer la pause midi si activée
      let lunchStartMinutes = 0
      let lunchEndMinutes = 0
      if (generateForm.hasLunchBreak) {
        const [lunchStartH, lunchStartM] = generateForm.lunchBreakStart.split(":").map(Number)
        const [lunchEndH, lunchEndM] = generateForm.lunchBreakEnd.split(":").map(Number)
        lunchStartMinutes = lunchStartH * 60 + lunchStartM
        lunchEndMinutes = lunchEndH * 60 + lunchEndM
      }

      // Créer un créneau par sport et par slot de temps
      for (let time = dayStartMinutes; time + generateForm.duration <= dayEndMinutes; time += generateForm.duration) {
        // Vérifier si le créneau est pendant la pause midi
        if (generateForm.hasLunchBreak) {
          const slotEnd = time + generateForm.duration
          // Si le créneau chevauche la pause midi, on le saute
          if (time < lunchEndMinutes && slotEnd > lunchStartMinutes) {
            continue
          }
        }

        const hours = Math.floor(time / 60)
        const mins = time % 60
        const timeStr = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`

        // Créer un créneau pour chaque sport sélectionné
        for (const sportId of generateForm.sportIds) {
          // Vérifier si un créneau existe déjà à cette heure pour ce sport
          const exists = slots.some((s) => s.date === dateStr && s.time === timeStr && s.sportId === sportId)

          if (!exists) {
            newSlots.push({
              id: `${Date.now()}-${Math.random()}-${sportId}`,
              sportId: sportId,
              date: dateStr,
              time: timeStr,
              duration: generateForm.duration,
              maxCapacity: generateForm.maxCapacity,
              currentBookings: 0,
              price: generateForm.price,
              published: false, // Nouveau créneau = brouillon (orange)
            })
          }
        }
      }
    }

    if (newSlots.length > 0) {
      const updatedSlots = [...slots, ...newSlots]
      setSlots(updatedSlots)
      saveSlots(updatedSlots)
      setIsGenerateDialogOpen(false)
      await showAlert(`${newSlots.length} ${t('admin.generate.success')}`, { variant: 'success' })
    } else {
      await showAlert(t('admin.generate.noSlots'), { variant: 'warning' })
    }
  }

  const handleSportSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (editingSport) {
      const updatedSports = sports.map((sport) => (sport.id === editingSport.id ? { ...sport, ...sportForm } : sport))
      setSports(updatedSports)
      saveSports(updatedSports, { immediate: true })
    } else {
      const newSport: Sport = {
        id: Date.now().toString(),
        ...sportForm,
        enabled: true,
      }
      const updatedSports = [...sports, newSport]
      setSports(updatedSports)
      saveSports(updatedSports, { immediate: true })
    }

    setSportForm({ name: "", icon: "⚽", imageUrl: "" })
    setEditingSport(null)
    setIsSportDialogOpen(false)
  }

  const handleEditSport = (sport: Sport) => {
    setEditingSport(sport)
    setSportForm({
      name: sport.name,
      icon: sport.icon,
      imageUrl: sport.imageUrl || "",
    })
    setIsSportDialogOpen(true)
  }

  const handleDeleteSport = async (sportId: string) => {
    const sportToDelete = sports.find(s => s.id === sportId)
    if (!sportToDelete) return

    // Trouver tous les créneaux qui utilisent ce sport (seront tous supprimés)
    const affectedSlots = slots.filter(slot => slot.sportId === sportId)

    // Message de confirmation détaillé
    let confirmMessage = `${t('admin.sports.deleteConfirm')}\n\n"${sportToDelete.name}" ${sportToDelete.icon}\n`
    
    if (affectedSlots.length > 0) {
      confirmMessage += `\n⚠️ ${t('admin.sports.deleteWarning') || 'Attention'} :\n`
      confirmMessage += `• ${affectedSlots.length} ${affectedSlots.length > 1 ? t('home.slot.slots') : t('home.slot.slot')} ${t('admin.sports.willBeDeleted') || 'seront supprimés'}\n`
    }

    const confirmed = await showConfirm(confirmMessage, { variant: 'warning', title: t('admin.sports.delete') })
    if (confirmed) {
      // Supprimer le sport
      const updatedSports = sports.filter((s) => s.id !== sportId)
      setSports(updatedSports)

      // Supprimer tous les créneaux de ce sport
      const updatedSlots = slots.filter(slot => slot.sportId !== sportId)

      setSlots(updatedSlots)
      
      // Sauvegarder les deux en même temps avec sync immédiate
      saveSports(updatedSports, { immediate: true })
      saveSlots(updatedSlots, { immediate: true })
    }
  }

  // Vérifier si les horaires de travail ont été modifiés
  const hasWorkingHoursChanged = useMemo(() => {
    return JSON.stringify(editableWorkingHours) !== JSON.stringify(settings.workingHours)
  }, [editableWorkingHours, settings.workingHours])

  // Réinitialiser les horaires éditables aux valeurs sauvegardées
  const resetWorkingHours = () => {
    setEditableWorkingHours(settings.workingHours)
  }

  // Sauvegarder les modifications d'horaires de travail avec vérification des créneaux affectés
  const saveWorkingHours = async () => {
    // Trouver les créneaux qui seront hors horaires avec les nouveaux paramètres
    const affectedSlots = findSlotsOutsideWorkingHours(slots, editableWorkingHours)
    
    // Filtrer les créneaux déjà marqués comme hors horaires (pas de changement pour eux)
    const newlyAffectedSlots = affectedSlots.filter(slot => slot.outsideWorkingHours !== true)
    
    if (newlyAffectedSlots.length > 0) {
      // Afficher une popup de confirmation
      const confirmMessage = `⚠️ ${t('admin.settings.workingHoursWarning') || 'Attention'} !\n\n` +
        `${newlyAffectedSlots.length} ${newlyAffectedSlots.length > 1 ? t('home.slot.slots') : t('home.slot.slot')} ` +
        `${t('admin.settings.slotsOutsideHours') || 'seront hors des nouveaux horaires'}.\n\n` +
        `${t('admin.settings.slotsWillBeRed') || 'Ces créneaux apparaîtront en rouge dans votre agenda et seront invisibles pour les clients'}.\n\n` +
        `${t('common.confirm')} ?`
      
      const confirmed = await showConfirm(confirmMessage, { variant: 'warning' })
      if (!confirmed) {
        return // L'admin a annulé
      }
    }
    
    // Sauvegarder les nouveaux horaires
    const newSettings = { ...settings, workingHours: editableWorkingHours }
    setSettingsState(newSettings)
    saveSettings(newSettings)
    
    // Mettre à jour le statut des créneaux
    const updatedCount = updateSlotsWorkingHoursStatus(editableWorkingHours)
    if (updatedCount > 0) {
      // Recharger les créneaux depuis le storage
      setSlots(getSlots())
    }
  }

  // Gérer les modifications d'horaires de travail (pour le toggle jour uniquement)
  const handleWorkingHoursChange = (newWorkingHours: WorkingHours[]) => {
    setEditableWorkingHours(newWorkingHours)
  }

  const toggleSport = (sportId: string) => {
    const updatedSports = sports.map((sport) => (sport.id === sportId ? { ...sport, enabled: !sport.enabled } : sport))
    setSports(updatedSports)
    saveSports(updatedSports, { immediate: true }) // Sync immédiate pour éviter la perte de données
  }

  const handleAddVacation = (e: React.FormEvent) => {
    e.preventDefault()
    const newVacation: ClosedPeriod = {
      id: Date.now().toString(),
      ...vacationForm,
      published: false, // Non publié par défaut - nécessite confirmation
    }
    const updatedSettings = {
      ...settings,
      closedPeriods: [...settings.closedPeriods, newVacation],
    }
    setSettingsState(updatedSettings)
    saveSettings(updatedSettings)
    setVacationForm({ startDate: "", endDate: "", reason: "" })
    setIsVacationDialogOpen(false)
  }

  const handleDeleteVacation = (id: string) => {
    const updatedSettings = {
      ...settings,
      closedPeriods: settings.closedPeriods.filter((v) => v.id !== id),
    }
    setSettingsState(updatedSettings)
    saveSettings(updatedSettings)
  }

  const handleDeleteSlot = async (slotId: string, skipConfirm = false) => {
    const confirmed = skipConfirm || await showConfirm(t('admin.slots.deleteConfirm'), { variant: 'warning' })
    if (confirmed) {
      const updatedSlots = slots.filter((s) => s.id !== slotId)
      setSlots(updatedSlots)
      saveSlots(updatedSlots)
    }
  }

  // Marquer un slot pour suppression (utilisé par la gomme)
  // NOTE: On ne modifie PAS published - le créneau reste visible côté client jusqu'à confirmation
  const handleMarkForDeletion = (slotId: string) => {
    const updatedSlots = slots.map(slot => 
      slot.id === slotId 
        ? { ...slot, pendingDeletion: true }
        : slot
    )
    setSlots(updatedSlots)
    saveSlots(updatedSlots)
    // Pas d'incrementDataVersion - le client ne doit pas voir le changement
  }

  // Annuler la suppression d'un slot
  const handleCancelDeletion = (slotId: string) => {
    const updatedSlots = slots.map(slot => 
      slot.id === slotId 
        ? { ...slot, pendingDeletion: false }
        : slot
    )
    setSlots(updatedSlots)
    saveSlots(updatedSlots)
    // Pas d'incrementDataVersion - le client ne doit pas voir le changement
  }

  const getSportName = (sportId: string) => {
    const sport = sports.find((s) => s.id === sportId)
    return sport ? sport.name : ""
  }

  // Traduire la raison de fermeture (gère les anciennes valeurs et les nouvelles clés)
  const getClosureReasonText = (reason: string): string => {
    // Essayer d'abord avec la clé directe
    const directTranslation = t(`admin.closureReasons.${reason}`)
    if (directTranslation && !directTranslation.includes('admin.closureReasons.')) {
      return directTranslation
    }
    
    // Mapper les anciennes valeurs vers les clés
    const legacyMapping: Record<string, string> = {
      'Fermé': 'closed',
      'Vacances': 'vacation',
      'Jour férié': 'holiday',
      'Maintenance': 'maintenance',
      'Événement privé': 'privateEvent',
      // English
      'Closed': 'closed',
      'Vacation': 'vacation',
      'Holiday': 'holiday',
      'Private Event': 'privateEvent',
      // German
      'Geschlossen': 'closed',
      'Urlaub': 'vacation',
      'Feiertag': 'holiday',
      'Wartung': 'maintenance',
      'Private Veranstaltung': 'privateEvent',
    }
    
    const mappedKey = legacyMapping[reason]
    if (mappedKey) {
      return t(`admin.closureReasons.${mappedKey}`)
    }
    
    // Retourner la valeur brute si rien ne correspond
    return reason
  }

  const getSportIcon = (sportId: string) => {
    const sport = sports.find((s) => s.id === sportId)
    return sport ? sport.icon : "⚽"
  }

  // Get sport info with optional disabled state
  const getSportInfo = (sportId: string, withDisabledState = false) => {
    const sport = sports.find((s) => s.id === sportId)
    if (!sport) return { icon: "❓", name: "?", disabled: false }
    if (withDisabledState) {
      return { icon: sport.icon, name: sport.name, disabled: !sport.enabled }
    }
    return { icon: sport.icon, name: sport.name, disabled: false }
  }

  // Legacy helper for backwards compatibility
  const getSportIcons = (sportIds: string[], withDisabledState = false) => {
    return sportIds.map((id) => {
      const sport = sports.find((s) => s.id === id)
      if (!sport) return { icon: "❓", disabled: false }
      if (withDisabledState) {
        return { icon: sport.icon, disabled: !sport.enabled, name: sport.name }
      }
      return { icon: sport.icon, disabled: false, name: sport.name }
    })
  }

  // Calculer les dates de début et fin de la période affichée
  const periodDates = useMemo(() => {
    const start = new Date(calendarDate)
    const end = new Date(calendarDate)
    
    if (calendarView === "timeGridWeek") {
      // Trouver le lundi de la semaine
      const day = start.getDay()
      const diff = start.getDate() - day + (day === 0 ? -6 : 1)
      start.setDate(diff)
      start.setHours(0, 0, 0, 0)
      end.setDate(start.getDate() + 6)
      end.setHours(23, 59, 59, 999)
    } else {
      // Premier et dernier jour du mois
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      end.setMonth(end.getMonth() + 1)
      end.setDate(0)
      end.setHours(23, 59, 59, 999)
    }
    
    return { start, end }
  }, [calendarDate, calendarView])

  // Calculer les 7 jours de la semaine pour la navigation mobile
  const weekDays = useMemo(() => {
    const days: { date: Date; dayName: string; dayNumber: number; isToday: boolean }[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const startOfWeek = new Date(calendarDate)
    const day = startOfWeek.getDay()
    const diff = day === 0 ? -6 : 1 - day
    startOfWeek.setDate(startOfWeek.getDate() + diff)
    startOfWeek.setHours(0, 0, 0, 0)
    
    const dayNames = [
      t('admin.agenda.statsPage.days.mon'),
      t('admin.agenda.statsPage.days.tue'),
      t('admin.agenda.statsPage.days.wed'),
      t('admin.agenda.statsPage.days.thu'),
      t('admin.agenda.statsPage.days.fri'),
      t('admin.agenda.statsPage.days.sat'),
      t('admin.agenda.statsPage.days.sun')
    ]
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek)
      d.setDate(startOfWeek.getDate() + i)
      days.push({
        date: d,
        dayName: dayNames[i],
        dayNumber: d.getDate(),
        isToday: d.getTime() === today.getTime()
      })
    }
    
    return days
  }, [calendarDate, t])

  // Synchroniser selectedDayIndex quand mobileTargetDate change
  useEffect(() => {
    if (mobileTargetDate && weekDays.length === 7) {
      const targetTime = mobileTargetDate.getTime()
      const foundIndex = weekDays.findIndex(day => {
        const dayTime = new Date(day.date).setHours(12, 0, 0, 0)
        const targetNormalized = new Date(mobileTargetDate).setHours(12, 0, 0, 0)
        return dayTime === targetNormalized
      })
      if (foundIndex !== -1) {
        setSelectedDayIndex(foundIndex)
      }
      setMobileTargetDate(null) // Réinitialiser après synchronisation
    }
  }, [mobileTargetDate, weekDays])

  // Date du jour sélectionné pour la vue mobile
  const mobileSelectedDate = useMemo(() => {
    if (weekDays.length > 0 && selectedDayIndex >= 0 && selectedDayIndex < 7) {
      return weekDays[selectedDayIndex].date
    }
    return calendarDate
  }, [weekDays, selectedDayIndex, calendarDate])

  // Vue du calendrier (mobile = jour unique, desktop = semaine/mois)
  const effectiveCalendarView = useMemo(() => {
    if (isMobileAgendaView && calendarView === "timeGridWeek") {
      return "timeGridDay"
    }
    return calendarView
  }, [isMobileAgendaView, calendarView])

  // Date effective du calendrier (mobile = jour sélectionné)
  const effectiveCalendarDate = useMemo(() => {
    if (isMobileAgendaView && calendarView === "timeGridWeek") {
      return mobileSelectedDate
    }
    return calendarDate
  }, [isMobileAgendaView, calendarView, mobileSelectedDate, calendarDate])

  // Filtrer les créneaux de la période affichée
  const periodSlots = useMemo(() => {
    return slots.filter((slot) => {
      const slotDate = new Date(slot.date + "T12:00:00")
      return slotDate >= periodDates.start && slotDate <= periodDates.end
    })
  }, [slots, periodDates])

  // Stats dynamiques basées sur la période affichée
  const stats = useMemo(() => {
    const totalSlots = periodSlots.length
    const bookedSlots = periodSlots.filter((s) => s.currentBookings > 0).length
    const totalRevenue = periodSlots.reduce((acc, s) => acc + s.price * s.currentBookings, 0)
    const totalCapacity = periodSlots.reduce((acc, s) => acc + s.maxCapacity, 0)
    const totalHours = periodSlots.reduce((acc, s) => acc + s.duration / 60, 0)
    const totalBookings = periodSlots.reduce((acc, s) => acc + s.currentBookings, 0)
    
    return {
      totalSlots,
      bookedSlots,
      totalRevenue,
      totalCapacity,
      totalHours,
      totalBookings,
    }
  }, [periodSlots])

  // Compter les créneaux non publiés (brouillons, excluant ceux à supprimer)
  const unpublishedCount = useMemo(() => {
    return slots.filter(slot => slot.published === false && !slot.pendingDeletion).length
  }, [slots])

  // Compter les créneaux hors horaires
  const outsideHoursCount = useMemo(() => {
    return slots.filter(slot => slot.outsideWorkingHours === true && !slot.pendingDeletion).length
  }, [slots])

  // Compter les créneaux en attente de suppression
  const pendingDeletionCount = useMemo(() => {
    return slots.filter(slot => slot.pendingDeletion === true).length
  }, [slots])

  // Compter les fermetures non publiées (excluant celles à supprimer)
  const unpublishedClosuresCount = useMemo(() => {
    return settings.closedPeriods.filter(period => period.published !== true && !period.pendingDeletion).length
  }, [settings.closedPeriods])

  // Compter les fermetures en attente de suppression
  const pendingClosureDeletionCount = useMemo(() => {
    return settings.closedPeriods.filter(period => period.pendingDeletion === true).length
  }, [settings.closedPeriods])

  // Total des suppressions en attente
  const totalPendingDeletions = pendingDeletionCount + pendingClosureDeletionCount

  const dayNames = [
    t('home.days.sunday'),
    t('home.days.monday'),
    t('home.days.tuesday'),
    t('home.days.wednesday'),
    t('home.days.thursday'),
    t('home.days.friday'),
    t('home.days.saturday')
  ]

  // Stats par jour pour la vue mois
  const dailyStats = useMemo(() => {
    const statsMap = new Map<string, { 
      slots: number; 
      hours: number; 
      revenue: number; 
      bookings: number;
      capacity: number; 
      hasClosure: boolean;
      unpublished: number; // Créneaux non publiés (orange)
      outsideHours: number; // Créneaux hors horaires (rouge)
      published: number; // Créneaux publiés (bleu)
    }>()
    
    slots.forEach((slot) => {
      const existing = statsMap.get(slot.date) || { 
        slots: 0, hours: 0, revenue: 0, bookings: 0, capacity: 0, hasClosure: false,
        unpublished: 0, outsideHours: 0, published: 0
      }
      
      // Compter selon le statut
      let unpublished = existing.unpublished
      let outsideHours = existing.outsideHours
      let published = existing.published
      
      if (slot.outsideWorkingHours === true) {
        outsideHours++
      } else if (slot.published === false) {
        unpublished++
      } else {
        published++
      }
      
      statsMap.set(slot.date, {
        slots: existing.slots + 1,
        hours: existing.hours + slot.duration / 60,
        revenue: existing.revenue + slot.price * slot.currentBookings,
        bookings: existing.bookings + slot.currentBookings,
        capacity: existing.capacity + slot.maxCapacity,
        hasClosure: existing.hasClosure,
        unpublished,
        outsideHours,
        published,
      })
    })
    
    // Ajouter les fermetures
    settings.closedPeriods.forEach((period) => {
      const start = new Date(period.startDate + "T12:00:00")
      const end = new Date(period.endDate + "T12:00:00")
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = formatDateLocal(d)
        const existing = statsMap.get(dateStr) || { 
          slots: 0, hours: 0, revenue: 0, bookings: 0, capacity: 0, hasClosure: false,
          unpublished: 0, outsideHours: 0, published: 0
        }
        statsMap.set(dateStr, { ...existing, hasClosure: true })
      }
    })
    
    return statsMap
  }, [slots, settings.closedPeriods])

  // Statistiques détaillées pour l'onglet Stats
  const detailedStats = useMemo(() => {
    // Calculer les dates de début et fin selon la période sélectionnée
    const now = new Date()
    let startDate: Date
    let endDate: Date = new Date(now)
    
    switch (statsPeriod) {
      case "thisWeek":
        startDate = new Date(now)
        startDate.setDate(now.getDate() - now.getDay() + 1) // Lundi
        endDate.setDate(startDate.getDate() + 6) // Dimanche
        break
      case "lastWeek":
        startDate = new Date(now)
        startDate.setDate(now.getDate() - now.getDay() - 6) // Lundi semaine dernière
        endDate = new Date(startDate)
        endDate.setDate(startDate.getDate() + 6)
        break
      case "thisMonth":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        break
      case "lastMonth":
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        endDate = new Date(now.getFullYear(), now.getMonth(), 0)
        break
      case "thisYear":
        startDate = new Date(now.getFullYear(), 0, 1)
        endDate = new Date(now.getFullYear(), 11, 31)
        break
      case "last30Days":
        startDate = new Date(now)
        startDate.setDate(now.getDate() - 30)
        break
      case "last90Days":
        startDate = new Date(now)
        startDate.setDate(now.getDate() - 90)
        break
      case "custom":
        // Valider les dates pour éviter le freeze pendant la saisie
        const isValidStart = statsCustomDateStart && /^\d{4}-\d{2}-\d{2}$/.test(statsCustomDateStart)
        const isValidEnd = statsCustomDateEnd && /^\d{4}-\d{2}-\d{2}$/.test(statsCustomDateEnd)
        startDate = isValidStart ? new Date(statsCustomDateStart) : new Date(now.getFullYear(), now.getMonth(), 1)
        endDate = isValidEnd ? new Date(statsCustomDateEnd) : now
        // Vérifier que les dates sont valides (pas NaN)
        if (isNaN(startDate.getTime())) startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        if (isNaN(endDate.getTime())) endDate = now
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }
    startDate.setHours(0, 0, 0, 0)
    endDate.setHours(23, 59, 59, 999)

    // Filtrer les créneaux par période et sport
    const filteredSlots = slots.filter(slot => {
      const slotDate = new Date(slot.date + "T12:00:00")
      if (slotDate < startDate || slotDate > endDate) return false
      if (statsSportFilter !== "all" && slot.sportId !== statsSportFilter) return false
      return true
    })

    // Filtrer les réservations par période et sport
    // Utiliser les données de la réservation directement (pas du slot qui peut être supprimé)
    const filteredBookings = bookings.filter(booking => {
      // Utiliser booking.date directement (snapshot au moment de la réservation)
      const bookingDate = booking.date ? new Date(booking.date + "T12:00:00") : null
      if (!bookingDate) {
        // Fallback: essayer de trouver le slot
        const slot = slots.find(s => s.id === booking.slotId)
        if (!slot) return false
        const slotDate = new Date(slot.date + "T12:00:00")
        if (slotDate < startDate || slotDate > endDate) return false
        if (statsSportFilter !== "all" && slot.sportId !== statsSportFilter) return false
        return true
      }
      if (bookingDate < startDate || bookingDate > endDate) return false
      // Utiliser booking.sportId directement
      if (statsSportFilter !== "all" && booking.sportId !== statsSportFilter) return false
      return true
    })

    // KPIs - utiliser totalPrice de la réservation directement
    const totalRevenue = filteredBookings.reduce((acc, b) => {
      // Utiliser le totalPrice stocké dans la réservation
      return acc + (b.totalPrice || 0)
    }, 0)
    const totalBookings = filteredBookings.length
    const uniqueClients = new Set(filteredBookings.map(b => (b.customerEmail || '').toLowerCase())).size
    const totalPeople = filteredBookings.reduce((acc, b) => acc + (b.numberOfPeople || 0), 0)
    const totalSlots = filteredSlots.length
    const bookedSlots = filteredSlots.filter(s => s.currentBookings > 0).length
    const occupancyRate = totalSlots > 0 ? Math.round((bookedSlots / totalSlots) * 100) : 0
    const avgPerBooking = totalBookings > 0 ? Math.round(totalRevenue / totalBookings) : 0

    // Données par jour pour le graphique
    const revenueByDay: { date: string; value: number; label: string }[] = []
    const bookingsByDay: { date: string; value: number; label: string }[] = []
    const currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      const dateStr = formatDateLocal(currentDate)
      const dayBookings = filteredBookings.filter(b => {
        // Utiliser booking.date directement
        return b.date === dateStr
      })
      const dayRevenue = dayBookings.reduce((acc, b) => {
        // Utiliser totalPrice de la réservation
        return acc + (b.totalPrice || 0)
      }, 0)
      
      revenueByDay.push({
        date: dateStr,
        value: dayRevenue,
        label: currentDate.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })
      })
      bookingsByDay.push({
        date: dateStr,
        value: dayBookings.length,
        label: currentDate.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })
      })
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Répartition par sport
    const bySport: { sportId: string; name: string; icon: string; revenue: number; bookings: number; percentage: number }[] = []
    const enabledSportsForStats = sports.filter(s => s.enabled)
    enabledSportsForStats.forEach(sport => {
      const sportBookings = filteredBookings.filter(b => {
        // Utiliser booking.sportId directement
        return b.sportId === sport.id
      })
      const sportRevenue = sportBookings.reduce((acc, b) => {
        // Utiliser totalPrice de la réservation
        return acc + (b.totalPrice || 0)
      }, 0)
      if (sportBookings.length > 0 || statsSportFilter === "all") {
        bySport.push({
          sportId: sport.id,
          name: sport.name,
          icon: sport.icon,
          revenue: sportRevenue,
          bookings: sportBookings.length,
          percentage: totalRevenue > 0 ? Math.round((sportRevenue / totalRevenue) * 100) : 0
        })
      }
    })

    // Heures populaires (0-23)
    const byHour: { hour: number; bookings: number; revenue: number }[] = Array(24).fill(null).map((_, i) => ({
      hour: i,
      bookings: 0,
      revenue: 0
    }))
    filteredBookings.forEach(booking => {
      // Utiliser booking.time directement
      if (booking.time) {
        const hour = parseInt(booking.time.split(':')[0])
        if (hour >= 0 && hour < 24) {
          byHour[hour].bookings++
          byHour[hour].revenue += booking.totalPrice || 0
        }
      }
    })

    // Jours de la semaine (0=Dim, 1=Lun, ..., 6=Sam)
    const byDayOfWeek: { day: number; bookings: number; revenue: number }[] = Array(7).fill(null).map((_, i) => ({
      day: i,
      bookings: 0,
      revenue: 0
    }))
    filteredBookings.forEach(booking => {
      // Utiliser booking.date directement
      if (booking.date) {
        const dayOfWeek = new Date(booking.date + "T12:00:00").getDay()
        byDayOfWeek[dayOfWeek].bookings++
        byDayOfWeek[dayOfWeek].revenue += booking.totalPrice || 0
      }
    })

    // Top créneaux
    const topSlots = filteredSlots
      .filter(s => s.currentBookings > 0)
      .sort((a, b) => b.currentBookings - a.currentBookings)
      .slice(0, 10)
      .map(slot => {
        const sport = sports.find(s => s.id === slot.sportId)
        return {
          ...slot,
          sportName: sport?.name || 'Unknown',
          sportIcon: sport?.icon || '❓',
          totalRevenue: slot.price * slot.currentBookings
        }
      })

    // Réservations récentes
    const recentBookings = filteredBookings
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map(booking => {
        const slot = slots.find(s => s.id === booking.slotId)
        // Utiliser les données de la réservation directement (elles contiennent un snapshot)
        const sport = sports.find(s => s.id === booking.sportId)
        return {
          ...booking,
          slot: slot || { date: booking.date, time: booking.time, price: booking.totalPrice / (booking.numberOfPeople || 1) },
          sportName: booking.sportName || sport?.name || 'Unknown',
          sportIcon: sport?.icon || '❓'
        }
      })

    return {
      startDate,
      endDate,
      kpis: {
        totalRevenue,
        totalBookings,
        uniqueClients,
        totalPeople,
        totalSlots,
        bookedSlots,
        occupancyRate,
        avgPerBooking
      },
      charts: {
        revenueByDay,
        bookingsByDay,
        bySport,
        byHour,
        byDayOfWeek
      },
      tables: {
        topSlots,
        recentBookings
      }
    }
  }, [slots, bookings, sports, statsSportFilter, statsPeriod, statsCustomDateStart, statsCustomDateEnd, i18n.language])

  // Fonction pour charger une image en base64
  const loadImageAsBase64 = (url: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(img, 0, 0)
            resolve(canvas.toDataURL('image/png'))
          } else {
            resolve(null)
          }
        } catch {
          resolve(null)
        }
      }
      img.onerror = () => resolve(null)
      img.src = url
    })
  }

  // Fonction d'export PDF des statistiques
  const exportStatsPDF = async (options: typeof exportOptions) => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 15
    let yPos = margin
    
    // Déterminer la période à utiliser
    const useSportFilter = options.includeSportFilter ? statsSportFilter : "all"
    
    // Couleurs
    const primaryColor: [number, number, number] = [59, 130, 246] // blue-500
    const secondaryColor: [number, number, number] = [16, 185, 129] // emerald-500
    const textColor: [number, number, number] = [31, 41, 55] // gray-800
    const lightGray: [number, number, number] = [156, 163, 175] // gray-400
    const veryLightGray: [number, number, number] = [243, 244, 246] // gray-100
    
    const currencySymbol = settings.branding?.currencySymbol || '.-'
    
    // ========== EN-TÊTE ==========
    // Bandeau coloré
    doc.setFillColor(...primaryColor)
    doc.rect(0, 0, pageWidth, 45, 'F')
    
    // Logo de l'entreprise (si disponible)
    let logoOffset = 0
    if (settings.branding?.logoUrl) {
      try {
        const logoBase64 = await loadImageAsBase64(settings.branding.logoUrl)
        if (logoBase64) {
          // Ajouter un fond blanc arrondi pour le logo
          doc.setFillColor(255, 255, 255)
          doc.roundedRect(margin - 2, 5, 34, 34, 3, 3, 'F')
          
          // Ajouter le logo
          doc.addImage(logoBase64, 'PNG', margin, 7, 30, 30)
          logoOffset = 38 // Décaler le texte à droite du logo
        }
      } catch (e) {
        console.log('Impossible de charger le logo pour le PDF')
      }
    }
    
    // Nom de l'établissement
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    const establishmentName = settings.branding?.siteName || 'SportSlot'
    doc.text(establishmentName, margin + logoOffset, 20)
    
    // Sous-titre : Rapport de statistiques
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(t('admin.agenda.statsPage.export.title'), margin + logoOffset, 30)
    
    // Date de génération à droite
    doc.setFontSize(9)
    const dateStr = new Date().toLocaleDateString(i18n.language, { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    })
    doc.text(dateStr, pageWidth - margin, 15, { align: 'right' })
    
    // Coordonnées de l'entreprise à droite (si disponibles)
    let contactY = 22
    doc.setFontSize(8)
    if (settings.branding?.contactEmail) {
      doc.text(settings.branding.contactEmail, pageWidth - margin, contactY, { align: 'right' })
      contactY += 5
    }
    if (settings.branding?.contactPhone) {
      doc.text(settings.branding.contactPhone, pageWidth - margin, contactY, { align: 'right' })
      contactY += 5
    }
    if (settings.branding?.address) {
      // Limiter la longueur de l'adresse
      const shortAddress = settings.branding.address.length > 35 
        ? settings.branding.address.substring(0, 35) + '...' 
        : settings.branding.address
      doc.text(shortAddress, pageWidth - margin, contactY, { align: 'right' })
    }
    
    yPos = 55
    
    // ========== PÉRIODE ==========
    doc.setTextColor(...textColor)
    doc.setFillColor(...veryLightGray)
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, 18, 3, 3, 'F')
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(t('admin.agenda.statsPage.export.period') + ' :', margin + 5, yPos + 7)
    
    const periodText = (() => {
      if (options.period === "custom" && options.customStartDate && options.customEndDate) {
        return `${options.customStartDate} - ${options.customEndDate}`
      }
      const periods: Record<string, string> = {
        thisWeek: t('admin.agenda.statsPage.filters.thisWeek'),
        lastWeek: t('admin.agenda.statsPage.filters.lastWeek'),
        thisMonth: t('admin.agenda.statsPage.filters.thisMonth'),
        lastMonth: t('admin.agenda.statsPage.filters.lastMonth'),
        last30Days: t('admin.agenda.statsPage.filters.last30Days'),
        last90Days: t('admin.agenda.statsPage.filters.last90Days'),
        thisYear: t('admin.agenda.statsPage.filters.thisYear'),
        custom: `${statsCustomDateStart || '?'} - ${statsCustomDateEnd || '?'}`
      }
      return periods[statsPeriod] || statsPeriod
    })()
    
    doc.setFont('helvetica', 'normal')
    doc.text(periodText, margin + 35, yPos + 7)
    
    // Sport filtré (si applicable)
    if (useSportFilter !== "all") {
      const sport = sports.find(s => s.id === useSportFilter)
      if (sport) {
        doc.setFont('helvetica', 'bold')
        doc.text('Sport :', margin + 5, yPos + 14)
        doc.setFont('helvetica', 'normal')
        doc.text(sport.name, margin + 27, yPos + 14)
      }
    }
    
    yPos += 28
    
    // ========== KPIS PRINCIPAUX ==========
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...primaryColor)
    doc.text(t('admin.agenda.statsPage.export.summaryShort').toUpperCase(), margin, yPos)
    yPos += 8
    
    autoTable(doc, {
      startY: yPos,
      head: [[
        t('admin.agenda.statsPage.kpis.revenue'),
        t('admin.agenda.statsPage.kpis.bookings'),
        t('admin.agenda.statsPage.kpis.clients'),
        t('admin.agenda.statsPage.kpis.occupancy')
      ]],
      body: [[
        `${detailedStats.kpis.totalRevenue} ${currencySymbol}`,
        String(detailedStats.kpis.totalBookings),
        String(detailedStats.kpis.uniqueClients),
        `${detailedStats.kpis.occupancyRate}%`
      ]],
      theme: 'grid',
      headStyles: { 
        fillColor: primaryColor, 
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        cellPadding: 4
      },
      bodyStyles: {
        fontSize: 12,
        fontStyle: 'bold',
        cellPadding: 5
      },
      styles: { halign: 'center' },
      margin: { left: margin, right: margin }
    })
    
    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
    
    // KPIs secondaires
    autoTable(doc, {
      startY: yPos,
      head: [[
        t('admin.agenda.statsPage.kpis.avgPerBooking'),
        t('admin.agenda.statsPage.kpis.totalSlots'),
        t('admin.agenda.statsPage.kpis.bookedSlots'),
        t('admin.agenda.statsPage.kpis.totalPeople')
      ]],
      body: [[
        `${detailedStats.kpis.avgPerBooking} ${currencySymbol}`,
        String(detailedStats.kpis.totalSlots),
        String(detailedStats.kpis.bookedSlots),
        String(detailedStats.kpis.totalPeople)
      ]],
      theme: 'grid',
      headStyles: { 
        fillColor: [107, 114, 128], 
        textColor: [255, 255, 255],
        fontSize: 9,
        cellPadding: 3
      },
      bodyStyles: {
        fontSize: 10,
        cellPadding: 4
      },
      styles: { halign: 'center' },
      margin: { left: margin, right: margin }
    })
    
    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15
    
    // ========== RÉPARTITION PAR SPORT (avec graphique de barres) ==========
    if (detailedStats.charts.bySport.length > 0) {
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...primaryColor)
      doc.text(t('admin.agenda.statsPage.charts.bySport').toUpperCase(), margin, yPos)
      yPos += 10
      
      // Dessiner des barres de progression pour chaque sport
      const maxRevenue = Math.max(...detailedStats.charts.bySport.map(s => s.revenue), 1)
      const barHeight = 12
      const barMaxWidth = pageWidth - margin * 2 - 80
      
      detailedStats.charts.bySport.forEach((sport, index) => {
        const barWidth = (sport.revenue / maxRevenue) * barMaxWidth
        
        // Nom du sport (sans emoji)
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...textColor)
        doc.text(sport.name, margin, yPos + barHeight / 2 + 1)
        
        // Barre de fond
        doc.setFillColor(...veryLightGray)
        doc.roundedRect(margin + 50, yPos, barMaxWidth, barHeight, 2, 2, 'F')
        
        // Barre de progression
        const colors: [number, number, number][] = [
          [59, 130, 246],   // blue
          [16, 185, 129],   // emerald
          [168, 85, 247],   // purple
          [245, 158, 11],   // amber
          [239, 68, 68],    // red
          [6, 182, 212],    // cyan
        ]
        doc.setFillColor(...colors[index % colors.length])
        if (barWidth > 0) {
          doc.roundedRect(margin + 50, yPos, Math.max(barWidth, 4), barHeight, 2, 2, 'F')
        }
        
        // Valeurs à droite
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...textColor)
        const valueText = `${sport.revenue}${currencySymbol} (${sport.percentage}%)`
        doc.text(valueText, pageWidth - margin, yPos + barHeight / 2 + 1, { align: 'right' })
        
        yPos += barHeight + 6
      })
      
      yPos += 10
    }
    
    // ========== MODE DÉTAILLÉ ==========
    if (options.mode === "detailed") {
      // Nouvelle page si nécessaire
      if (yPos > pageHeight - 80) {
        doc.addPage()
        yPos = margin
      }
      
      // Graphique des heures populaires
      if (detailedStats.charts.byHour.some(h => h.bookings > 0)) {
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...primaryColor)
        doc.text(t('admin.agenda.statsPage.charts.byHour').toUpperCase(), margin, yPos)
        yPos += 10
        
        const hourData = detailedStats.charts.byHour.slice(6, 22) // 6h à 22h
        const maxBookings = Math.max(...hourData.map(h => h.bookings), 1)
        const chartWidth = pageWidth - margin * 2
        const barWidth = chartWidth / hourData.length - 2
        const chartHeight = 30
        
        // Dessiner les barres
        hourData.forEach((hour, index) => {
          const barHeight = (hour.bookings / maxBookings) * chartHeight
          const x = margin + index * (barWidth + 2)
          
          // Barre
          doc.setFillColor(...secondaryColor)
          if (barHeight > 0) {
            doc.rect(x, yPos + chartHeight - barHeight, barWidth, barHeight, 'F')
          }
          
          // Label heure
          doc.setFontSize(6)
          doc.setTextColor(...lightGray)
          doc.text(`${hour.hour + 6}h`, x + barWidth / 2, yPos + chartHeight + 6, { align: 'center' })
        })
        
        yPos += chartHeight + 20
      }
      
      // Nouvelle page pour la liste des réservations
      if (yPos > pageHeight - 60) {
        doc.addPage()
        yPos = margin
      }
      
      // Liste des réservations
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...primaryColor)
      doc.text(t('admin.agenda.statsPage.export.bookingsList').toUpperCase(), margin, yPos)
      yPos += 8
      
      const filteredBookings = detailedStats.tables.recentBookings
      
      if (filteredBookings.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [[
            'Date', 
            t('admin.agenda.statsPage.tables.client'), 
            'Sport', 
            t('admin.agenda.statsPage.tables.people'), 
            t('admin.agenda.statsPage.tables.price')
          ]],
          body: filteredBookings.map(booking => {
            const sport = sports.find(s => s.id === booking.sportId)
            return [
              booking.date || '-',
              booking.customerName || '-',
              sport?.name || '-',
              String(booking.numberOfPeople || 1),
              `${booking.totalPrice || 0} ${currencySymbol}`
            ]
          }),
          theme: 'striped',
          headStyles: { 
            fillColor: primaryColor, 
            textColor: [255, 255, 255],
            fontSize: 9,
            cellPadding: 3
          },
          bodyStyles: {
            fontSize: 8,
            cellPadding: 2
          },
          columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 50 },
            2: { cellWidth: 35 },
            3: { cellWidth: 20, halign: 'center' },
            4: { cellWidth: 30, halign: 'right' }
          },
          margin: { left: margin, right: margin }
        })
      } else {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(...lightGray)
        doc.text(t('admin.agenda.statsPage.charts.noData'), margin, yPos + 5)
      }
    }
    
    // ========== PIED DE PAGE ==========
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      
      // Ligne de séparation
      doc.setDrawColor(...lightGray)
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15)
      
      // Texte du pied de page
      doc.setFontSize(8)
      doc.setTextColor(...lightGray)
      doc.setFont('helvetica', 'normal')
      
      // À gauche : nom de l'établissement
      doc.text(establishmentName, margin, pageHeight - 8)
      
      // Au centre : date de génération
      const footerDate = `${t('admin.agenda.statsPage.export.generatedOn')} ${new Date().toLocaleDateString(i18n.language)}`
      doc.text(footerDate, pageWidth / 2, pageHeight - 8, { align: 'center' })
      
      // À droite : numéro de page
      doc.text(`Page ${i}/${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' })
    }
    
    // Télécharger le PDF
    const fileName = `rapport-statistiques-${new Date().toISOString().split('T')[0]}.pdf`
    doc.save(fileName)
  }

  const parseDateParts = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    const hours = String(date.getHours()).padStart(2, "0")
    const minutes = String(date.getMinutes()).padStart(2, "0")
    return {
      date: `${year}-${month}-${day}`,
      time: `${hours}:${minutes}`,
    }
  }

  const timeStringToMinutes = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number)
    return hours * 60 + minutes
  }

  const minutesToTimeString = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`
  }

  const slotMinTime = useMemo(() => {
    const enabled = settings.workingHours.filter((wh) => wh.enabled)
    if (!enabled.length) return "06:00:00"
    const minMinutes = enabled.reduce((acc, wh) => Math.min(acc, timeStringToMinutes(wh.startTime)), Number.POSITIVE_INFINITY)
    return minutesToTimeString(Number.isFinite(minMinutes) ? minMinutes : 360)
  }, [settings.workingHours])

  const slotMaxTime = useMemo(() => {
    const enabled = settings.workingHours.filter((wh) => wh.enabled)
    if (!enabled.length) return "22:00:00"
    const maxMinutes = enabled.reduce((acc, wh) => Math.max(acc, timeStringToMinutes(wh.endTime)), 0)
    return minutesToTimeString(maxMinutes)
  }, [settings.workingHours])

  const slotDurationStep = useMemo(() => {
    // Grille fixe de 1h pour l'agenda (ne dépend pas de la durée par défaut des créneaux)
    return minutesToTimeString(60)
  }, [])

  const filteredSlots = useMemo(() => {
    let result = slots
    
    // En mode Vue, on ne montre que les créneaux publiés (comme le client les voit)
    if (agendaMode === "view") {
      result = result.filter(s => {
        // Créneaux en attente de suppression = invisibles
        if (s.pendingDeletion === true) return false
        // Créneaux non publiés = invisibles (sauf s'ils ont des valeurs originales)
        if (s.published === false && !s.originalDate && !s.originalTime && !s.originalDuration) return false
        // Créneaux hors horaires = invisibles
        if (s.outsideWorkingHours === true) return false
        return true
      })
    }
    
    // Filtrer par sport si nécessaire
    if (selectedSportFilter !== "all") {
      result = result.filter((s) => s.sportId === selectedSportFilter)
    }
    
    return result
  }, [selectedSportFilter, slots, agendaMode])

  const calendarEvents = useMemo(() => {
    return filteredSlots.map((slot) => {
      const start = new Date(`${slot.date}T${slot.time}`)
      const end = new Date(start.getTime() + slot.duration * 60000)
      const sportInfo = getSportInfo(slot.sportId)
      const availablePlaces = slot.maxCapacity - slot.currentBookings
      const isFullyBooked = availablePlaces === 0
      const isAlmostFull = availablePlaces <= slot.maxCapacity * 0.2
      const isUnpublished = slot.published === false
      const isOutsideWorkingHours = slot.outsideWorkingHours === true
      const isPendingDeletion = slot.pendingDeletion === true

      // Couleurs dynamiques selon le statut
      let eventColor = "#3b82f6" // Bleu par défaut (disponible)
      let borderColor = "#2563eb"
      const hasBookings = slot.currentBookings > 0

      if (isPendingDeletion) {
        // Créneaux à supprimer = Rouge/rose avec pattern barré
        eventColor = "#be123c" // Rose foncé
        borderColor = "#9f1239" // Rose très foncé
      } else if (isOutsideWorkingHours) {
        // Créneaux hors horaires = Rouge vif avec bordure épaisse
        eventColor = "#dc2626" // Rouge vif
        borderColor = "#991b1b" // Rouge foncé
      } else if (isUnpublished) {
        // Créneaux non publiés = Orange vif (brouillon)
        eventColor = "#f97316" // Orange
        borderColor = "#ea580c"
      } else if (isFullyBooked) {
        eventColor = "#7f1d1d" // Rouge très foncé (complet)
        borderColor = "#450a0a"
      } else if (isAlmostFull) {
        eventColor = "#eab308" // Jaune (presque complet)
        borderColor = "#ca8a04"
      } else if (hasBookings) {
        // Créneaux avec réservations = Jaune/Orangé
        eventColor = "#f59e0b" // Ambre/Orangé
        borderColor = "#d97706"
      } else {
        // Bleu pour les créneaux disponibles sans réservation
        eventColor = "#3b82f6"
        borderColor = "#2563eb"
      }

      return {
        id: slot.id,
        title: sportInfo.icon || "🏆",
        start,
        end,
        allDay: false,
        backgroundColor: eventColor,
        borderColor: borderColor,
        textColor: "#ffffff",
        extendedProps: {
          slot,
          type: "slot",
          sportId: slot.sportId,
          isUnpublished,
          isOutsideWorkingHours,
          isPendingDeletion,
          sportInfo,
        },
      }
    })
  }, [filteredSlots, sports])

  // Liste des dates fermées (format YYYY-MM-DD)
  const closedDates = useMemo(() => {
    const dates = new Set<string>()
    settings.closedPeriods.forEach((period) => {
      const start = new Date(period.startDate + "T12:00:00")
      const end = new Date(period.endDate + "T12:00:00")
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.add(formatDateLocal(d))
      }
    })
    return dates
  }, [settings.closedPeriods])

  // Événements de fermeture pour le calendrier (affichage en background)
  const closureEvents = useMemo(() => {
    return settings.closedPeriods
      .filter((period) => {
        // En mode Vue, on ne montre que les fermetures publiées (comme le client les voit)
        if (agendaMode === "view") {
          return period.published === true && !period.pendingDeletion
        }
        return true
      })
      .flatMap((period) => {
        const events = []
        const start = new Date(period.startDate + "T12:00:00")
        const end = new Date(period.endDate + "T12:00:00")
        const isPublished = period.published === true
        const isPendingDeletion = period.pendingDeletion === true
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = formatDateLocal(d)
          
          // Déterminer le titre et la couleur selon le statut
          let title = ""
          let bgColor = ""
          
          if (isPendingDeletion) {
            title = `🗑️ ${getClosureReasonText(period.reason)}`
            bgColor = "#fce7f3" // Rose pour suppression
          } else if (isPublished) {
            title = `📅 ${getClosureReasonText(period.reason)}`
            bgColor = "#fee2e2" // Rouge clair pour publié
          } else {
            title = `🟠 ${getClosureReasonText(period.reason)}`
            bgColor = "#ffedd5" // Orange pour non publié
          }
          
          events.push({
            id: `closure-${period.id}-${dateStr}`,
            title,
            start: dateStr,
            allDay: true,
            display: "background",
            backgroundColor: bgColor,
            extendedProps: {
              type: "closure",
              closureId: period.id,
              date: dateStr,
              isPublished,
              isPendingDeletion,
            },
          })
        }
        return events
      })
  }, [settings.closedPeriods, agendaMode])

  // Événements de résumé pour la vue mois (un par jour avec stats)
  const monthSummaryEvents = useMemo(() => {
    if (calendarView !== "dayGridMonth") return []
    
    const summaryByDate = new Map<string, { slots: number; hours: number; revenue: number; bookings: number; capacity: number }>()
    
    slots.forEach((slot) => {
      const existing = summaryByDate.get(slot.date) || { slots: 0, hours: 0, revenue: 0, bookings: 0, capacity: 0 }
      summaryByDate.set(slot.date, {
        slots: existing.slots + 1,
        hours: existing.hours + slot.duration / 60,
        revenue: existing.revenue + slot.price * slot.currentBookings,
        bookings: existing.bookings + slot.currentBookings,
        capacity: existing.capacity + slot.maxCapacity,
      })
    })
    
    return Array.from(summaryByDate.entries()).map(([date, stats]) => ({
      id: `summary-${date}`,
      start: date,
      allDay: true,
      display: "background",
      backgroundColor: stats.bookings > 0 ? "#dcfce7" : "#f0f9ff",
      extendedProps: {
        type: "summary",
        stats,
        date,
      },
    }))
  }, [slots, calendarView])

  // Combiner les événements
  const allCalendarEvents = useMemo(() => {
    // En vue mois, on n'affiche pas les créneaux individuels, juste les résumés
    if (calendarView === "dayGridMonth") {
      return [...monthSummaryEvents, ...closureEvents]
    }
    return [...calendarEvents, ...closureEvents]
  }, [calendarEvents, closureEvents, monthSummaryEvents])

  // Configurer les heures d'ouverture pour FullCalendar (zones grisées hors ouverture)
  const businessHours = useMemo(() => {
    return settings.workingHours
      .filter(wh => wh.enabled)
      .map(wh => ({
        daysOfWeek: [wh.dayOfWeek],
        startTime: wh.startTime,
        endTime: wh.endTime,
      }))
  }, [settings.workingHours])
  
  // Vérifier si une date a une fermeture
  const isDateClosed = (dateStr: string) => {
    return settings.closedPeriods.some(p => dateStr >= p.startDate && dateStr <= p.endDate)
  }

  // Vérifier si une date a des créneaux
  const getDateSlots = (dateStr: string) => {
    return slots.filter(s => s.date === dateStr)
  }

  // Supprimer la fermeture pour une date
  const removeClosureForDate = async (dateStr: string) => {
    const existingPeriod = settings.closedPeriods.find(p => dateStr >= p.startDate && dateStr <= p.endDate)
    if (!existingPeriod) return
    
    if (existingPeriod.startDate === existingPeriod.endDate) {
      // Fermeture d'un seul jour - supprimer directement
      const updatedSettings = {
        ...settings,
        closedPeriods: settings.closedPeriods.filter(p => p.id !== existingPeriod.id),
      }
      setSettingsState(updatedSettings)
      saveSettings(updatedSettings)
    } else {
      // Période multi-jours - demander confirmation
      const confirmed = await showConfirm(`${t('admin.closures.deleteConfirm')} "${existingPeriod.reason}" ?`, { variant: 'warning' })
      if (confirmed) {
        const updatedSettings = {
          ...settings,
          closedPeriods: settings.closedPeriods.filter(p => p.id !== existingPeriod.id),
        }
        setSettingsState(updatedSettings)
        saveSettings(updatedSettings)
      }
    }
  }

  // Marquer une fermeture pour suppression (utilisé par la gomme)
  const handleMarkClosureForDeletion = (closureId: string) => {
    const updatedClosedPeriods = settings.closedPeriods.map(period => 
      period.id === closureId 
        ? { ...period, pendingDeletion: true }
        : period
    )
    const updatedSettings = { ...settings, closedPeriods: updatedClosedPeriods }
    setSettingsState(updatedSettings)
    saveSettings(updatedSettings)
  }

  // Annuler la suppression d'une fermeture
  const handleCancelClosureDeletion = (closureId: string) => {
    const updatedClosedPeriods = settings.closedPeriods.map(period => 
      period.id === closureId 
        ? { ...period, pendingDeletion: false }
        : period
    )
    const updatedSettings = { ...settings, closedPeriods: updatedClosedPeriods }
    setSettingsState(updatedSettings)
    saveSettings(updatedSettings)
  }

  // Ajouter une fermeture pour une date
  const addClosureForDate = (dateStr: string, reason: string = "closed") => {
    const newClosure: ClosedPeriod = {
      id: `closure-${Date.now()}`,
      startDate: dateStr,
      endDate: dateStr,
      reason: reason || "closed",
      published: false, // Non publié par défaut
    }
    const updatedSettings = {
      ...settings,
      closedPeriods: [...settings.closedPeriods, newClosure],
    }
    setSettingsState(updatedSettings)
    saveSettings(updatedSettings)
  }

  // Confirmer et ajouter la fermeture avec raison
  const confirmClosureWithReason = () => {
    if (!closureDialog) return
    
    // Si il y a des créneaux, les supprimer
    if (closureDialog.hasSlots) {
      const updatedSlots = slots.filter(s => s.date !== closureDialog.date)
      setSlots(updatedSlots)
      saveSlots(updatedSlots)
    }
    
    // Ajouter la fermeture avec la raison
    addClosureForDate(closureDialog.date, closureDialog.reason)
    setClosureDialog(null)
  }

  // Toggle une fermeture pour une date donnée
  const toggleClosureForDate = (dateStr: string) => {
    const isClosed = isDateClosed(dateStr)
    const dateSlots = getDateSlots(dateStr)

    if (isClosed) {
      // Le jour est fermé - retirer la fermeture
      removeClosureForDate(dateStr)
    } else {
      // Le jour n'est pas fermé - ouvrir le dialog pour demander la raison
      const totalBookings = dateSlots.reduce((acc, s) => acc + s.currentBookings, 0)
      setClosureDialog({
        isOpen: true,
        date: dateStr,
        reason: "",
        hasSlots: dateSlots.length > 0,
        slotsCount: dateSlots.length,
        bookingsCount: totalBookings,
      })
    }
  }

  const handleQuickDeleteSlot = (e: React.MouseEvent, slotId: string) => {
    e.stopPropagation()
    e.preventDefault()
    setQuickEdit({
      slotId,
      field: "delete",
      value: "",
      position: { x: e.clientX, y: e.clientY }
    })
  }

  const confirmDelete = (slotId: string) => {
    const updatedSlots = slots.filter((s) => s.id !== slotId)
    setSlots(updatedSlots)
    saveSlots(updatedSlots)
    setQuickEdit(null)
  }

  const openQuickEdit = (
    e: React.MouseEvent,
    slotId: string,
    field: "price" | "capacity" | "duration" | "sports",
    currentValue: number | string[],
  ) => {
    e.stopPropagation()
    e.preventDefault()
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    
    if (field === "sports") {
      setQuickEdit({
        slotId,
        field,
        value: "",
        position: { x: rect.left, y: rect.bottom + 4 },
        selectedSports: currentValue as string[]
      })
    } else {
      setQuickEdit({
        slotId,
        field,
        value: (currentValue as number).toString(),
        position: { x: rect.left, y: rect.bottom + 4 }
      })
    }
  }

  const toggleSportInQuickEdit = (sportId: string) => {
    if (!quickEdit || !quickEdit.selectedSports) return
    const newSports = quickEdit.selectedSports.includes(sportId)
      ? quickEdit.selectedSports.filter(id => id !== sportId)
      : [...quickEdit.selectedSports, sportId]
    
    // Au moins un sport doit être sélectionné
    if (newSports.length === 0) return
    
    setQuickEdit({ ...quickEdit, selectedSports: newSports })
  }

  const saveQuickEdit = () => {
    if (!quickEdit || quickEdit.field === "delete") return
    
    // Changement de sport (single select)
    if (quickEdit.field === "sports" && quickEdit.selectedSports && quickEdit.selectedSports.length > 0) {
      updateSlot(quickEdit.slotId, { sportId: quickEdit.selectedSports[0] })
      setQuickEdit(null)
      return
    }

    const numValue = Number(quickEdit.value)
    if (isNaN(numValue) || numValue <= 0) {
      setQuickEdit(null)
      return
    }

    // Vérifier le chevauchement si on change la durée
    if (quickEdit.field === "duration") {
      const slot = slots.find(s => s.id === quickEdit.slotId)
      if (slot && checkSlotOverlap(quickEdit.slotId, slot.date, slot.time, numValue * 60)) {
        showAlert(t('admin.slots.overlapError'), { variant: 'error' })
        return
      }
    }

    switch (quickEdit.field) {
      case "price":
        updateSlot(quickEdit.slotId, { price: numValue })
        break
      case "capacity":
        updateSlot(quickEdit.slotId, { maxCapacity: numValue })
        break
      case "duration":
        updateSlot(quickEdit.slotId, { duration: numValue * 60 })
        break
    }
    setQuickEdit(null)
  }

  // Sauvegarder directement avec une valeur spécifique (pour les boutons rapides)
  const saveQuickEditWithValue = (value: number) => {
    if (!quickEdit || quickEdit.field === "delete" || quickEdit.field === "sports") return

    // Vérifier le chevauchement si on change la durée
    if (quickEdit.field === "duration") {
      const slot = slots.find(s => s.id === quickEdit.slotId)
      if (slot && checkSlotOverlap(quickEdit.slotId, slot.date, slot.time, value * 60)) {
        showAlert(t('admin.slots.overlapError'), { variant: 'error' })
        return
      }
    }

    switch (quickEdit.field) {
      case "price":
        updateSlot(quickEdit.slotId, { price: value })
        break
      case "capacity":
        updateSlot(quickEdit.slotId, { maxCapacity: value })
        break
      case "duration":
        updateSlot(quickEdit.slotId, { duration: value * 60 })
        break
    }
    setQuickEdit(null)
  }

  const renderEventContent = (eventContent: EventContentArg) => {
    const eventType = eventContent.event.extendedProps?.type
    const viewType = eventContent.view.type
    
    // Les fermetures sont en background, pas besoin de les render
    if (eventType === "closure") {
      return null
    }
    
    // Événement de créneau
    const slot = eventContent.event.extendedProps?.slot as TimeSlot | undefined
    if (!slot) {
      return <div className="p-2 text-white text-xs">{t('home.slot.slot')}</div>
    }
    
    const sportInfo = getSportInfo(slot.sportId, true)
    const availablePlaces = slot.maxCapacity - slot.currentBookings
    const isOutsideWorkingHours = slot.outsideWorkingHours === true
    const isPendingDeletion = slot.pendingDeletion === true

    // Vue Mois : affichage compact (juste un indicateur)
    if (viewType === "dayGridMonth") {
      return (
        <div className={`flex items-center gap-1 px-1 py-0.5 text-xs truncate ${isPendingDeletion ? "line-through opacity-70" : ""}`}>
          {isPendingDeletion && <span title={t('admin.agenda.pendingDeletion')}>🗑️</span>}
          {isOutsideWorkingHours && !isPendingDeletion && <span title={t('admin.settings.slotsOutsideHours')}>⚠️</span>}
          <span className={sportInfo.disabled ? "opacity-40 grayscale" : ""}>{sportInfo.icon}</span>
          <span className="font-medium">{slot.price}{settings.branding?.currencySymbol || ".-"}</span>
          {slot.currentBookings > 0 && (
            <span className="bg-white/30 px-1 rounded text-[10px]">{slot.currentBookings}/{slot.maxCapacity}</span>
          )}
        </div>
      )
    }

    // Vue Semaine : affichage complet avec édition (désactivé en mode gomme ou mode Vue)
    const isEraserMode = editMode === "eraser"
    const isViewMode = agendaMode === "view"
    const isEditDisabled = isEraserMode || isViewMode
    
    return (
      <div className={`h-full p-1 sm:p-2 text-white flex flex-col justify-between group/event relative overflow-hidden ${isEraserMode ? "pointer-events-none" : ""} ${isPendingDeletion ? "pending-deletion" : ""}`}>
        {/* Indicateur suppression en attente */}
        {isPendingDeletion && (
          <div className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 bg-rose-100 text-rose-700 text-[8px] sm:text-[10px] font-bold px-1 sm:px-2 py-0.5 rounded shadow" title={t('admin.agenda.pendingDeletion')}>
            🗑️
          </div>
        )}
        {/* Indicateur hors horaires */}
        {isOutsideWorkingHours && !isPendingDeletion && (
          <div className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 bg-white/90 text-red-600 text-[8px] sm:text-[10px] font-bold px-0.5 sm:px-1 rounded shadow" title={t('admin.settings.slotsOutsideHours')}>
            ⚠️
          </div>
        )}
        <div className="flex items-center justify-between gap-1 min-w-0">
          <div
            className="text-sm sm:text-base px-0.5 sm:px-1 rounded flex items-center gap-0.5 flex-shrink min-w-0 overflow-hidden"
            title={sportInfo.name}
          >
            <span 
              className={`flex-shrink-0 ${sportInfo.disabled ? "opacity-40 grayscale" : ""}`}
              title={sportInfo.disabled ? `${sportInfo.name} (${t('admin.sports.disabled')})` : sportInfo.name}
            >
              {sportInfo.icon}
            </span>
          </div>
          <div
            onClick={isEditDisabled ? undefined : (e) => openQuickEdit(e as any, slot.id, "price", slot.price)}
            className={`text-[10px] sm:text-xs font-bold bg-white/20 px-1 sm:px-1.5 py-0.5 rounded flex-shrink-0 ${isEditDisabled ? "" : "hover:bg-white/40 cursor-pointer transition-colors"}`}
            title={isEditDisabled ? undefined : t('admin.slots.editPrice')}
          >
            {slot.price}{settings.branding?.currencySymbol || ".-"}
          </div>
        </div>
        <div className="flex items-end justify-between gap-1">
          <div className="flex items-center gap-0.5 sm:gap-1 text-[8px] sm:text-[10px]">
            <span
              onClick={isEditDisabled ? undefined : (e) => openQuickEdit(e as any, slot.id, "capacity", slot.maxCapacity)}
              className={`opacity-90 px-0.5 sm:px-1 rounded ${isEditDisabled ? "" : "hover:opacity-100 hover:bg-white/20 cursor-pointer transition-colors"}`}
              title={isEditDisabled ? undefined : t('admin.slots.editCapacity')}
            >
              {availablePlaces}/{slot.maxCapacity}
            </span>
            <span className="opacity-60 hidden sm:inline">•</span>
            <span
              onClick={isEditDisabled ? undefined : (e) => openQuickEdit(e as any, slot.id, "duration", slot.duration / 60)}
              className={`opacity-90 px-0.5 sm:px-1 rounded hidden sm:inline ${isEditDisabled ? "" : "hover:opacity-100 hover:bg-white/20 cursor-pointer transition-colors"}`}
              title={isEditDisabled ? undefined : t('admin.slots.editDuration')}
            >
              {slot.duration/60}h
            </span>
          </div>
          {!isEditDisabled && (
            <button
              onClick={(e) => handleQuickDeleteSlot(e, slot.id)}
              className="opacity-0 group-hover/event:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white rounded p-1 -mr-1 -mb-1"
              title={t('common.delete')}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    )
  }

  const updateSlot = (slotId: string, updates: Partial<TimeSlot>) => {
    const updatedSlots = slots.map((slot) => (slot.id === slotId ? { ...slot, ...updates } : slot))
    setSlots(updatedSlots)
    saveSlots(updatedSlots)
  }

  // Fonction pour effacer un événement (créneau ou fermeture) - marquer pour suppression
  const eraseEvent = (event: any) => {
    const eventType = event.extendedProps?.type
    if (eventType === "closure") {
      const closureId = event.extendedProps?.closureId as string
      const isPendingDeletion = event.extendedProps?.isPendingDeletion
      if (closureId && !isPendingDeletion) {
        // Marquer la fermeture pour suppression
        handleMarkClosureForDeletion(closureId)
      }
    } else {
      const slotId = event.id
      const slot = slots.find(s => s.id === slotId)
      if (slot && !slot.pendingDeletion) {
        // Marquer pour suppression
        handleMarkForDeletion(slotId)
      }
    }
  }

  // Fonction pour annuler la suppression d'un événement (clic droit en mode gomme)
  const uneraseEvent = (event: any) => {
    const eventType = event.extendedProps?.type
    if (eventType === "closure") {
      const closureId = event.extendedProps?.closureId as string
      const isPendingDeletion = event.extendedProps?.isPendingDeletion
      if (closureId && isPendingDeletion) {
        handleCancelClosureDeletion(closureId)
      }
    } else {
      const slotId = event.id
      const slot = slots.find(s => s.id === slotId)
      if (slot && slot.pendingDeletion) {
        handleCancelDeletion(slotId)
      }
    }
  }

  // Supprimer une réservation (annulation par l'admin)
  const handleDeleteBooking = async (booking: Booking) => {
    const confirmMessage = t('admin.agenda.confirmDeleteBooking', { 
      name: booking.customerName,
      people: booking.numberOfPeople 
    })
    
    const confirmed = await showConfirm(confirmMessage, { variant: 'warning', title: t('admin.agenda.cancelBooking') })
    if (!confirmed) return
    
    // Supprimer la réservation
    const updatedBookings = bookings.filter(b => b.id !== booking.id)
    saveBookings(updatedBookings)
    setBookings(updatedBookings)
    
    // Mettre à jour le créneau (décrémenter currentBookings)
    const updatedSlots = slots.map(s => {
      if (s.id === booking.slotId) {
        return { 
          ...s, 
          currentBookings: Math.max(0, s.currentBookings - booking.numberOfPeople)
      }
    }
      return s
    })
    saveSlots(updatedSlots, { immediate: true })
    setSlots(updatedSlots)
    
    // Mettre à jour le modal
    const updatedModalBookings = bookingDetailsModal.bookings.filter(b => b.id !== booking.id)
    const updatedSlot = updatedSlots.find(s => s.id === booking.slotId)
    setBookingDetailsModal({
      ...bookingDetailsModal,
      bookings: updatedModalBookings,
      slot: updatedSlot || bookingDetailsModal.slot
    })
    
    // Incrémenter la version pour synchroniser
    incrementDataVersion()
  }

  const handleCalendarEventClick = (info: EventClickArg) => {
    const eventType = info.event.extendedProps?.type
    
    // MODE VUE : Afficher les détails de réservation
    if (agendaMode === "view") {
      if (eventType === "slot" || !eventType) {
        const slot = slots.find((s) => s.id === info.event.id)
        if (slot) {
          // Récupérer les réservations pour ce créneau
          const slotBookings = bookings.filter(b => b.slotId === slot.id)
          setBookingDetailsModal({
            isOpen: true,
            slot,
            bookings: slotBookings
          })
        }
      }
      return
    }
    
    // MODE ÉDITION
    // Mode gomme : marquer/démarquer pour suppression
    if (editMode === "eraser") {
      // Clic gauche normal : marquer pour suppression
      eraseEvent(info.event)
      return
    }
    
    // Si c'est une fermeture (background event), toggle en mode fermeture
    if (eventType === "closure") {
      const dateStr = info.event.extendedProps?.date as string
      if (dateStr) {
        toggleClosureForDate(dateStr)
      }
      return
    }
    
    // Si c'est un créneau - ouvrir l'édition
    const slot = slots.find((s) => s.id === info.event.id)
    if (slot) {
      handleEditSlot(slot)
    }
  }

  // Handler pour le survol des événements en mode gomme (peinture)
  const handleCalendarEventMouseEnter = (info: any) => {
    if (editMode === "eraser" && isErasing && !isRightClicking) {
      eraseEvent(info.event)
    } else if (editMode === "eraser" && isRightClicking) {
      uneraseEvent(info.event)
    }
  }

  // Vérifier si un créneau chevauche un autre DU MÊME SPORT
  // Les créneaux de sports différents peuvent se chevaucher
  const checkSlotOverlap = (slotId: string, date: string, time: string, duration: number, sportId?: string) => {
    const slotStart = new Date(`${date}T${time}`)
    const slotEnd = new Date(slotStart.getTime() + duration * 60000)
    
    // Si sportId fourni, on cherche le sport du créneau existant
    const existingSlot = slotId ? slots.find(s => s.id === slotId) : null
    const targetSportId = sportId || existingSlot?.sportId
    
    return slots.some(s => {
      if (s.id === slotId) return false // Ignorer le créneau lui-même
      if (s.date !== date) return false // Pas le même jour
      // Les créneaux de sports différents peuvent se chevaucher
      if (targetSportId && s.sportId !== targetSportId) return false
      
      const otherStart = new Date(`${s.date}T${s.time}`)
      const otherEnd = new Date(otherStart.getTime() + s.duration * 60000)
      
      // Vérifier le chevauchement
      return slotStart < otherEnd && slotEnd > otherStart
    })
  }

  const handleCalendarEventDrop = (info: EventDropArg) => {
    const eventType = info.event.extendedProps?.type
    // Ne pas permettre de déplacer les fermetures
    if (eventType === "closure") {
      info.revert()
      return
    }
    if (!info.event.start) return
    
    const { date, time } = parseDateParts(info.event.start)
    const slot = slots.find(s => s.id === info.event.id)
    
    // Vérifier si le jour de destination est désactivé dans les horaires de travail
    const targetDate = new Date(date)
    const targetDayOfWeek = targetDate.getDay()
    const targetWorkingHours = settings.workingHours.find(wh => wh.dayOfWeek === targetDayOfWeek)
    
    if (!targetWorkingHours || !targetWorkingHours.enabled) {
      // Jour désactivé - bloquer le déplacement
      info.revert()
      return
    }
    
    if (slot && checkSlotOverlap(info.event.id, date, time, slot.duration)) {
      info.revert()
      return
    }
    
    if (slot) {
      // Créer un slot temporaire pour vérifier s'il est dans les horaires
      const tempSlot = { ...slot, date, time }
      const isWithinHours = isSlotWithinWorkingHours(tempSlot, settings.workingHours)
      
      // Déterminer les nouvelles valeurs
      const updates: Partial<TimeSlot> = { date, time }
      
      // Si le créneau était publié, sauvegarder les coordonnées originales
      // pour que le client continue de voir le créneau à l'ancienne position
      if (slot.published && !slot.originalDate && !slot.originalTime) {
        updates.originalDate = slot.date
        updates.originalTime = slot.time
      }
      
      if (isWithinHours) {
        // Si le créneau est maintenant dans les horaires, le remettre en brouillon (orange)
        updates.outsideWorkingHours = false
        updates.published = false // Non publié = orange
      } else {
        // Si le créneau est hors horaires (heure hors plage), le marquer comme tel (rouge)
        updates.outsideWorkingHours = true
      }
      
      updateSlot(info.event.id, updates)
    }
  }

  const handleCalendarEventResize = (info: EventResizeInfo) => {
    const eventType = info.event.extendedProps?.type
    // Ne pas permettre de redimensionner les fermetures
    if (eventType === "closure") {
      info.revert()
      return
    }
    if (!info.event.start || !info.event.end) return
    
    const newStart = info.event.start
    const newEnd = info.event.end
    // Arrondir à l'heure (minimum 1h)
    const durationMinutes = Math.round((newEnd.getTime() - newStart.getTime()) / 60000)
    const roundedHours = Math.max(1, Math.round(durationMinutes / 60))
    const duration = roundedHours * 60
    
    // Récupérer la nouvelle heure de début (si redimensionné vers le haut)
    const newTime = `${String(newStart.getHours()).padStart(2, '0')}:${String(newStart.getMinutes()).padStart(2, '0')}`
    const newDate = formatDateLocal(newStart)
    
    // Vérifier si le jour est désactivé dans les horaires de travail
    const targetDayOfWeek = newStart.getDay()
    const targetWorkingHours = settings.workingHours.find(wh => wh.dayOfWeek === targetDayOfWeek)
    
    if (!targetWorkingHours || !targetWorkingHours.enabled) {
      // Jour désactivé - bloquer le redimensionnement
      info.revert()
      return
    }
    
    // Vérifier si le nouveau créneau causerait un chevauchement
    if (checkSlotOverlap(info.event.id, newDate, newTime, duration)) {
      info.revert()
      return
    }
    
    const slot = slots.find(s => s.id === info.event.id)
    if (slot) {
      // Créer un slot temporaire pour vérifier s'il est dans les horaires
      const tempSlot = { ...slot, date: newDate, time: newTime, duration }
      const isWithinHours = isSlotWithinWorkingHours(tempSlot, settings.workingHours)
      
      // Déterminer les nouvelles valeurs
      const updates: Partial<TimeSlot> = { date: newDate, time: newTime, duration }
      
      // Si le créneau était publié, sauvegarder les valeurs originales
      // pour que le client continue de voir le créneau à l'ancienne position/durée
      if (slot.published && !slot.originalDate && !slot.originalTime && !slot.originalDuration) {
        updates.originalDate = slot.date
        updates.originalTime = slot.time
        updates.originalDuration = slot.duration
      }
      
      if (isWithinHours) {
        // Si le créneau est maintenant dans les horaires, le remettre en brouillon (orange)
        updates.outsideWorkingHours = false
        updates.published = false // Non publié = orange
      } else {
        // Si le créneau est hors horaires (heure hors plage), le marquer comme tel (rouge)
        updates.outsideWorkingHours = true
      }
      
      updateSlot(info.event.id, updates)
    }
  }

  const handleCalendarSelect = (selection: DateSelectArg) => {
    // Ne rien faire en mode vue
    if (agendaMode === "view") {
      selection.view.calendar.unselect()
      return
    }
    
    // Uniquement en vue semaine ou jour (mobile)
    if (selection.view.type !== "timeGridWeek" && selection.view.type !== "timeGridDay") {
      selection.view.calendar.unselect()
      return
    }
    
    // Extraire la date correctement en tenant compte du timezone local
    const startDate = selection.start
    const endDate = selection.end
    const year = startDate.getFullYear()
    const month = String(startDate.getMonth() + 1).padStart(2, '0')
    const day = String(startDate.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    
    if (editMode === "slot") {
      // Mode créneau : créer un créneau
      const hours = String(startDate.getHours()).padStart(2, '0')
      const minutes = String(startDate.getMinutes()).padStart(2, '0')
      
      // Calculer la durée en minutes basée sur la sélection (glisser-créer)
      const durationMs = endDate.getTime() - startDate.getTime()
      const durationMinutes = Math.round(durationMs / (1000 * 60))
      
      // Arrondir à l'heure supérieure (minimum 1h)
      const roundedHours = Math.max(1, Math.ceil(durationMinutes / 60))
      const finalDuration = roundedHours * 60
      
      handleCreateSlot(dateStr, `${hours}:${minutes}`, finalDuration)
    } else if (editMode === "closure") {
      // Mode fermeture : toggle la fermeture pour ce jour
      toggleClosureForDate(dateStr)
    }
    selection.view.calendar.unselect()
  }

  const handleCalendarDatesSet = (arg: DatesSetArg) => {
    setCalendarTitle(arg.view.title)
    setCalendarMeta({
      type: arg.view.type,
      currentStart: arg.view.currentStart,
      currentEnd: arg.view.currentEnd,
    })
  }

  const handleCalendarPrev = () => {
    // Calculer la nouvelle date selon la vue
    const newDate = new Date(calendarDate)
    if (calendarView === "timeGridWeek") {
      newDate.setDate(newDate.getDate() - 7)
      // Sur mobile, garder le même jour de la semaine ou aller au lundi
      if (isMobileAgendaView) {
        setSelectedDayIndex(0) // Reset au lundi de la nouvelle semaine
      }
    } else {
      newDate.setMonth(newDate.getMonth() - 1)
    }
    setCalendarDate(newDate)
  }

  const handleCalendarNext = () => {
    // Calculer la nouvelle date selon la vue
    const newDate = new Date(calendarDate)
    if (calendarView === "timeGridWeek") {
      newDate.setDate(newDate.getDate() + 7)
      // Sur mobile, garder le même jour de la semaine ou aller au lundi
      if (isMobileAgendaView) {
        setSelectedDayIndex(0) // Reset au lundi de la nouvelle semaine
      }
    } else {
      newDate.setMonth(newDate.getMonth() + 1)
    }
    setCalendarDate(newDate)
  }

  const handleCalendarToday = () => {
    const today = new Date()
    setCalendarDate(today)
    
    // Sur mobile, sélectionner le jour d'aujourd'hui
    if (isMobileAgendaView && calendarView === "timeGridWeek") {
      const dayOfWeek = today.getDay()
      // Convertir dimanche (0) -> 6, lundi (1) -> 0, etc.
      const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      setSelectedDayIndex(dayIndex)
    }
  }

  const handleViewSwitch = (view: "timeGridWeek" | "dayGridMonth") => {
    setCalendarView(view)
  }
  
  // Aller à une date spécifique en vue semaine
  const goToDateInWeekView = (date: Date) => {
    // Calculer le lundi de la semaine de cette date
    const targetDate = new Date(date)
    targetDate.setHours(12, 0, 0, 0)
    
    const dayOfWeek = targetDate.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(targetDate)
    monday.setDate(targetDate.getDate() + mondayOffset)
    monday.setHours(12, 0, 0, 0)
    
    // Définir calendarDate au lundi de la semaine (pour que weekDays soit cohérent)
    setCalendarDate(monday)
    setCalendarView("timeGridWeek")
    
    // Sur mobile, stocker la date cible pour synchronisation ultérieure
    if (window.innerWidth < 640) {
      setMobileTargetDate(new Date(targetDate))
    }
  }

  // Ref pour stocker les coordonnées Y de départ (pour détecter swipe horizontal vs vertical)
  const mobileDaySwipeStartY = useRef<number | null>(null)

  // Handlers pour le swipe des jours sur mobile (agenda admin)
  // Ne capture que les vrais swipes horizontaux, pas les taps ou drags verticaux
  const handleMobileDaySwipeStart = (e: React.TouchEvent) => {
    if (!isMobileAgendaView || calendarView !== "timeGridWeek") return
    setMobileDaySwipeStart(e.touches[0].clientX)
    mobileDaySwipeStartY.current = e.touches[0].clientY
    setIsMobileDaySwiping(false)
  }

  const handleMobileDaySwipeMove = (e: React.TouchEvent) => {
    if (mobileDaySwipeStart === null || !isMobileAgendaView) return
    
    const diffX = e.touches[0].clientX - mobileDaySwipeStart
    const diffY = mobileDaySwipeStartY.current !== null ? e.touches[0].clientY - mobileDaySwipeStartY.current : 0
    
    // Ne considérer comme swipe que si le mouvement est principalement horizontal
    // (mouvement X > mouvement Y * 1.5) et suffisamment grand
    const isHorizontalSwipe = Math.abs(diffX) > Math.abs(diffY) * 1.5 && Math.abs(diffX) > 30
    
    if (isHorizontalSwipe) {
      setIsMobileDaySwiping(true)
      setMobileDaySwipeOffset(diffX)
    }
  }

  const handleMobileDaySwipeEnd = () => {
    if (!isMobileDaySwiping || !isMobileAgendaView) {
      setMobileDaySwipeStart(null)
      setMobileDaySwipeOffset(0)
      mobileDaySwipeStartY.current = null
      return
    }

    const threshold = 60
    if (mobileDaySwipeOffset > threshold) {
      // Swipe droite = jour précédent
      if (selectedDayIndex > 0) {
        setSelectedDayIndex(selectedDayIndex - 1)
      } else {
        // Passer à la semaine précédente, dernier jour
        handleCalendarPrev()
        setSelectedDayIndex(6)
      }
    } else if (mobileDaySwipeOffset < -threshold) {
      // Swipe gauche = jour suivant
      if (selectedDayIndex < 6) {
        setSelectedDayIndex(selectedDayIndex + 1)
      } else {
        // Passer à la semaine suivante, premier jour
        handleCalendarNext()
        setSelectedDayIndex(0)
      }
    }

    setMobileDaySwipeStart(null)
    setMobileDaySwipeOffset(0)
    setIsMobileDaySwiping(false)
    mobileDaySwipeStartY.current = null
  }

  // Handlers pour le swipe des semaines sur mobile (barre des dates)
  const handleMobileWeekSwipeStart = (e: React.TouchEvent) => {
    if (!isMobileAgendaView || calendarView !== "timeGridWeek") return
    setMobileWeekSwipeStart(e.touches[0].clientX)
    setIsMobileWeekSwiping(false)
  }

  const handleMobileWeekSwipeMove = (e: React.TouchEvent) => {
    if (mobileWeekSwipeStart === null || !isMobileAgendaView) return
    const diff = e.touches[0].clientX - mobileWeekSwipeStart
    if (Math.abs(diff) > 10) {
      setIsMobileWeekSwiping(true)
      setMobileWeekSwipeOffset(diff)
    }
  }

  const handleMobileWeekSwipeEnd = () => {
    if (!isMobileWeekSwiping || !isMobileAgendaView) {
      setMobileWeekSwipeStart(null)
      setMobileWeekSwipeOffset(0)
      return
    }

    const threshold = 50
    if (mobileWeekSwipeOffset > threshold) {
      // Swipe droite = semaine précédente
      handleCalendarPrev()
    } else if (mobileWeekSwipeOffset < -threshold) {
      // Swipe gauche = semaine suivante
      handleCalendarNext()
    }

    setMobileWeekSwipeStart(null)
    setMobileWeekSwipeOffset(0)
    setIsMobileWeekSwiping(false)
  }

  const confirmAndDeleteRange = async (start: Date, end: Date, label: string) => {
    const confirmed = await showConfirm(
      `${t('admin.slots.delete')} ${start.toLocaleDateString(i18n.language)} - ${end.toLocaleDateString(i18n.language)} (${label}) ?`,
      { variant: 'warning' }
    )
    if (confirmed) {
      const updatedSlots = slots.filter((slot) => {
        const slotDate = new Date(`${slot.date}T00:00:00`)
        return slotDate < start || slotDate > end
      })
      setSlots(updatedSlots)
      saveSlots(updatedSlots)
    }
  }

  const handleDeleteVisibleWeek = () => {
    if (!calendarMeta || calendarMeta.type !== "timeGridWeek") return
    const start = new Date(calendarMeta.currentStart)
    const end = new Date(calendarMeta.currentEnd)
    end.setDate(end.getDate() - 1)
    confirmAndDeleteRange(start, end, "semaine")
  }

  const handleDeleteVisibleMonth = () => {
    if (!calendarMeta || calendarMeta.type !== "dayGridMonth") return
    const start = new Date(calendarMeta.currentStart)
    const end = new Date(calendarMeta.currentEnd)
    end.setDate(end.getDate() - 1)
    confirmAndDeleteRange(
      start,
      end,
      start.toLocaleDateString(i18n.language, { month: "long", year: "numeric" }),
    )
  }

  const handleEditSlot = (slot: TimeSlot) => {
    setEditingSlot(slot)
    setSlotForm({
      sportId: slot.sportId,
      maxCapacity: slot.maxCapacity,
      price: slot.price,
      duration: slot.duration,
    })
    setIsSlotDialogOpen(true)
  }

  // Vérifier si une durée est valide pour un jour et une heure donnés
  const isDurationValidForDay = (date: string, time: string, duration: number): { valid: boolean; maxDuration: number; message: string } => {
    const d = new Date(date + "T12:00:00")
    const dayOfWeek = d.getDay()
    const workingHour = settings.workingHours.find((wh) => wh.dayOfWeek === dayOfWeek)
    
    if (!workingHour || !workingHour.enabled) {
      return { valid: false, maxDuration: 0, message: t('admin.slots.noWorkingHours') }
    }

    const [startH, startM] = workingHour.startTime.split(":").map(Number)
    const [endH, endM] = workingHour.endTime.split(":").map(Number)
    const dayStartMinutes = startH * 60 + startM
    const dayEndMinutes = endH * 60 + endM
    const totalDayMinutes = dayEndMinutes - dayStartMinutes

    // Calculer le temps restant depuis l'heure de début du créneau
    const [slotH, slotM] = time.split(":").map(Number)
    const slotStartMinutes = slotH * 60 + slotM
    const remainingMinutes = dayEndMinutes - slotStartMinutes

    if (duration > remainingMinutes) {
      const maxHours = Math.floor(remainingMinutes / 60)
      return { 
        valid: false, 
        maxDuration: remainingMinutes,
        message: `${t('admin.slots.durationTooLong')} ${t('admin.slots.remainingTime')} ${maxHours}h${remainingMinutes % 60 > 0 ? `${remainingMinutes % 60}min` : ''} ${t('admin.slots.beforeClosing')} (${workingHour.endTime}).`
      }
    }

    if (duration > totalDayMinutes) {
      const maxHours = Math.floor(totalDayMinutes / 60)
      return { 
        valid: false, 
        maxDuration: totalDayMinutes,
        message: `${t('admin.slots.durationTooLong')} ${t('admin.slots.dayOnlyLasts')} ${maxHours}h (${workingHour.startTime} - ${workingHour.endTime}).`
      }
    }

    return { valid: true, maxDuration: remainingMinutes, message: "" }
  }

  // Fonction pour changer le mot de passe admin
  const handleChangePassword = () => {
    setPasswordError("")
    setPasswordSuccess("")

    // Vérifier le mot de passe actuel
    if (passwordForm.currentPassword !== adminCredentials.password) {
      setPasswordError(t('admin.settings.security.wrongPassword'))
      return
    }

    // Vérifier que le nouveau mot de passe n'est pas vide
    if (!passwordForm.newPassword.trim()) {
      setPasswordError(t('admin.settings.security.passwordEmpty'))
      return
    }

    // Vérifier que le nouveau mot de passe a au moins 4 caractères
    if (passwordForm.newPassword.length < 4) {
      setPasswordError(t('admin.settings.security.passwordTooShort'))
      return
    }

    // Vérifier que les deux nouveaux mots de passe correspondent
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError(t('admin.settings.security.passwordMismatch'))
      return
    }

    // Sauvegarder le nouveau mot de passe
    const newCredentials = {
      ...adminCredentials,
      password: passwordForm.newPassword,
    }
    saveAdminCredentials(newCredentials)
    setAdminCredentials(newCredentials)

    // Reset le formulaire
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
      showCurrent: false,
      showNew: false,
      showConfirm: false,
    })
    setPasswordSuccess(t('admin.settings.security.passwordChanged'))

    // Effacer le message de succès après 3 secondes
    setTimeout(() => setPasswordSuccess(""), 3000)
  }

  const handleSaveSlot = async () => {
    if (!editingSlot) return

    // Vérifier si la durée est valide pour ce jour
    const durationCheck = isDurationValidForDay(editingSlot.date, editingSlot.time, slotForm.duration)
    if (!durationCheck.valid) {
      await showAlert(durationCheck.message || '', { variant: 'warning' })
      return
    }

    // Vérifier le chevauchement si la durée a changé
    if (slotForm.duration !== editingSlot.duration) {
      if (checkSlotOverlap(editingSlot.id, editingSlot.date, editingSlot.time, slotForm.duration)) {
        await showAlert(t('admin.slots.overlapError'), { variant: 'error' })
        return
      }
    }

    const updatedSlots = slots.map((s) => (s.id === editingSlot.id ? { ...s, ...slotForm } : s))
    setSlots(updatedSlots)
    saveSlots(updatedSlots)
    setIsSlotDialogOpen(false)
    setEditingSlot(null)
  }

  const handleCreateSlot = async (date: string, time: string, duration = settings.defaultSlotDuration) => {
    const enabledSports = sports.filter((s) => s.enabled)
    if (enabledSports.length === 0) {
      await showAlert(t('admin.slots.noSportEnabled'), { variant: 'warning' })
      return
    }

    // Vérifier si le jour est désactivé dans les horaires de travail
    const slotDate = new Date(date)
    const dayOfWeek = slotDate.getDay()
    const workingHour = settings.workingHours.find(wh => wh.dayOfWeek === dayOfWeek)
    
    if (!workingHour || !workingHour.enabled) {
      // Jour désactivé - ne pas permettre la création
      return
    }

    // Vérifier si la durée est valide pour ce jour et cette heure
    const durationCheck = isDurationValidForDay(date, time, duration)
    if (!durationCheck.valid) {
      await showAlert(durationCheck.message || '', { variant: 'warning' })
      return
    }

    // Vérifier si le jour est fermé (période de fermeture)
    if (isDateClosed(date)) {
      const confirmed = await showConfirm(t('admin.agenda.closedDayConfirm'), { variant: 'question' })
      if (confirmed) {
        removeClosureForDate(date)
      } else {
        return
      }
    }

    // Si un sport est sélectionné dans le filtre, créer directement le créneau
    if (selectedSportFilter !== "all") {
      const selectedSport = sports.find((s) => s.id === selectedSportFilter && s.enabled)
      if (!selectedSport) {
        await showAlert(t('admin.sports.notEnabled'), { variant: 'warning' })
        return
      }
      
      // Vérifier si un créneau existe déjà pour ce sport
      if (checkSlotOverlap("", date, time, duration, selectedSportFilter)) {
        return
      }

      const newSlot: TimeSlot = {
        id: `${Date.now()}-${Math.random()}`,
        sportId: selectedSportFilter,
        date,
        time,
        duration,
        maxCapacity: settings.defaultMaxCapacity,
        currentBookings: 0,
        price: settings.defaultPrice,
        published: false,
      }
      const updatedSlots = [...slots, newSlot]
      setSlots(updatedSlots)
      saveSlots(updatedSlots)
    } else {
      // Mode "Tous les sports" - ouvrir dialog pour choisir les sports
      setCreateSlotDialog({
        isOpen: true,
        date,
        time,
        duration,
        price: settings.defaultPrice,
        maxCapacity: settings.defaultMaxCapacity,
        selectedSports: enabledSports.map(s => s.id), // Tous sélectionnés par défaut
      })
    }
  }
  
  // Créer les créneaux après sélection des sports dans le dialog
  const confirmCreateSlots = () => {
    const { date, time, duration, price, maxCapacity, selectedSports } = createSlotDialog
    
    if (selectedSports.length === 0) {
      setCreateSlotDialog({ ...createSlotDialog, isOpen: false })
      return
    }
    
    const newSlots: TimeSlot[] = []
    for (const sportId of selectedSports) {
      // Vérifier qu'un créneau n'existe pas déjà pour ce sport
      if (!checkSlotOverlap("", date, time, duration, sportId)) {
        newSlots.push({
          id: `${Date.now()}-${Math.random()}-${sportId}`,
          sportId,
          date,
          time,
          duration,
          maxCapacity,
          currentBookings: 0,
          price,
          published: false,
        })
      }
    }
    
    if (newSlots.length > 0) {
      const updatedSlots = [...slots, ...newSlots]
      setSlots(updatedSlots)
      saveSlots(updatedSlots)
    }
    
    setCreateSlotDialog({ isOpen: false, date: '', time: '', duration: 60, price: 50, maxCapacity: 4, selectedSports: [] })
  }

  // Écran de chargement
  if (isPageLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gray-200 animate-pulse" />
          <div className="h-6 w-36 mx-auto mb-2 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-4 w-24 mx-auto bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="mx-auto px-2 sm:px-3 lg:px-6 xl:px-8 max-w-[1600px]">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-3">
              <div 
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-white overflow-hidden flex-shrink-0"
                style={{ 
                  backgroundColor: settings.branding?.logoUrl && settings.branding?.logoBackground === false
                    ? "transparent"
                    : (settings.branding?.primaryColor || "#3b82f6")
                }}
              >
                {settings.branding?.logoUrl ? (
                  <img 
                    src={settings.branding.logoUrl} 
                    alt="Logo" 
                    className="w-6 h-6 sm:w-8 sm:h-8 object-contain"
                  />
                ) : (
                  <span className="text-lg sm:text-xl">{settings.branding?.logoIcon || "🏆"}</span>
                )}
              </div>
              <div className="min-w-0">
                <span className="font-bold text-base sm:text-xl text-gray-900 truncate block">
                  {settings.branding?.siteName || "SportSlot"}
                </span>
                <span className="text-[10px] sm:text-xs text-gray-500 hidden sm:inline">{t('admin.title')}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-4">
              {/* Indicateur de mode de stockage */}
              {storageMode.mode !== 'checking' && (
                <div 
                  className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium"
                  style={{ 
                    backgroundColor: `${storageMode.color}20`,
                    color: storageMode.color
                  }}
                  title={
                    storageMode.mode === 'browser' ? t('admin.storage.browserDesc') :
                    storageMode.mode === 'local' ? t('admin.storage.localDesc') :
                    t('admin.storage.externalDesc')
                  }
                >
                  <span>{storageMode.icon}</span>
                  <span className="hidden sm:inline">{storageMode.label}</span>
                </div>
              )}
              
              <LanguageSwitcher variant="compact" />
              
              <Button variant="outline" size="sm" onClick={handleLogout} className="h-8 sm:h-9 px-2 sm:px-3">
                <LogOut className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">{t('nav.logout')}</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto px-2 sm:px-3 lg:px-6 xl:px-8 py-3 sm:py-6 max-w-[1600px]">
        <Card className="p-3 sm:p-4 lg:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4 bg-gray-100 p-0.5 sm:p-1 rounded-lg sm:rounded-xl">
              <TabsTrigger value="agenda" className="rounded-md sm:rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm py-1.5 sm:py-2">
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">{t('admin.tabs.agenda')}</span>
              </TabsTrigger>
              <TabsTrigger value="sports" className="rounded-md sm:rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm py-1.5 sm:py-2">
                <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">{t('admin.tabs.sports')}</span>
              </TabsTrigger>
              <TabsTrigger value="stats" className="rounded-md sm:rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm py-1.5 sm:py-2">
                <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">{t('admin.tabs.stats')}</span>
              </TabsTrigger>
              <TabsTrigger value="slots" className="rounded-md sm:rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm py-1.5 sm:py-2">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">{t('admin.tabs.settings')}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="agenda" className="mt-6">
              {/* Statistiques en ligne */}
              {/* Statistiques dynamiques de la période - grille adaptative */}
              <div className="mb-4 sm:mb-6">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <h3 className="text-xs sm:text-sm font-medium text-gray-500">
                    {t('admin.agenda.stats.title')}
                  </h3>
                  <span className="text-[10px] sm:text-xs text-gray-400">
                    {periodDates.start.toLocaleDateString(i18n.language, { day: "numeric", month: "short" })} - {periodDates.end.toLocaleDateString(i18n.language, { day: "numeric", month: "short" })}
                  </span>
                </div>
                {/* Mobile: scroll horizontal, Tablette: 3 col, Desktop: 6 col */}
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 xl:grid-cols-6 sm:gap-2.5 lg:gap-3 scrollbar-hide">
                  {/* Créneaux */}
                  <div className="flex-shrink-0 w-[105px] sm:w-auto bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg sm:rounded-xl p-2 sm:p-2.5 lg:p-3">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 bg-blue-500 rounded-md sm:rounded-lg flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-base sm:text-lg lg:text-xl font-bold text-blue-900 leading-tight">{stats.totalSlots}</p>
                        <p className="text-[9px] sm:text-[10px] lg:text-xs text-blue-600 font-medium truncate">{t('home.slot.slots')}</p>
                      </div>
                    </div>
                  </div>
                  {/* Réservations */}
                  <div className="flex-shrink-0 w-[105px] sm:w-auto bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-lg sm:rounded-xl p-2 sm:p-2.5 lg:p-3">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 bg-emerald-500 rounded-md sm:rounded-lg flex items-center justify-center flex-shrink-0">
                        <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-base sm:text-lg lg:text-xl font-bold text-emerald-900 leading-tight">{stats.totalBookings}</p>
                        <p className="text-[9px] sm:text-[10px] lg:text-xs text-emerald-600 font-medium truncate">{t('admin.slots.bookings')}</p>
                      </div>
                    </div>
                  </div>
                  {/* Places */}
                  <div className="flex-shrink-0 w-[105px] sm:w-auto bg-gradient-to-br from-violet-50 to-violet-100 border border-violet-200 rounded-lg sm:rounded-xl p-2 sm:p-2.5 lg:p-3">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 bg-violet-500 rounded-md sm:rounded-lg flex items-center justify-center flex-shrink-0">
                        <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-base sm:text-lg lg:text-xl font-bold text-violet-900 leading-tight">{stats.totalCapacity}</p>
                        <p className="text-[9px] sm:text-[10px] lg:text-xs text-violet-600 font-medium truncate">{t('admin.agenda.stats.places')}</p>
                      </div>
                    </div>
                  </div>
                  {/* Monnaie */}
                  <div className="flex-shrink-0 w-[105px] sm:w-auto bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-lg sm:rounded-xl p-2 sm:p-2.5 lg:p-3">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 bg-amber-500 rounded-md sm:rounded-lg flex items-center justify-center flex-shrink-0">
                        <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-base sm:text-lg lg:text-xl font-bold text-amber-900 leading-tight">{stats.totalRevenue}</p>
                        <p className="text-[9px] sm:text-[10px] lg:text-xs text-amber-600 font-medium truncate">{settings.branding?.currency || "CHF"}</p>
                      </div>
                    </div>
                  </div>
                  {/* Heures */}
                  <div className="flex-shrink-0 w-[105px] sm:w-auto bg-gradient-to-br from-cyan-50 to-cyan-100 border border-cyan-200 rounded-lg sm:rounded-xl p-2 sm:p-2.5 lg:p-3">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 bg-cyan-500 rounded-md sm:rounded-lg flex items-center justify-center flex-shrink-0">
                        <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-base sm:text-lg lg:text-xl font-bold text-cyan-900 leading-tight">{stats.totalHours}h</p>
                        <p className="text-[9px] sm:text-[10px] lg:text-xs text-cyan-600 font-medium truncate">{t('admin.agenda.stats.hours')}</p>
                      </div>
                    </div>
                  </div>
                  {/* Remplissage */}
                  <div className="flex-shrink-0 w-[105px] sm:w-auto bg-gradient-to-br from-rose-50 to-rose-100 border border-rose-200 rounded-lg sm:rounded-xl p-2 sm:p-2.5 lg:p-3">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 bg-rose-500 rounded-md sm:rounded-lg flex items-center justify-center flex-shrink-0">
                        <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-base sm:text-lg lg:text-xl font-bold text-rose-900 leading-tight">{stats.totalCapacity > 0 ? Math.round((stats.totalBookings / stats.totalCapacity) * 100) : 0}%</p>
                        <p className="text-[9px] sm:text-[10px] lg:text-xs text-rose-600 font-medium truncate">{t('admin.agenda.stats.fillRate')}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Barre d'outils responsive */}
              <div className="bg-white border border-gray-200 rounded-xl mb-4 shadow-sm overflow-hidden">
                {/* NIVEAU 1 : Navigation et Vue */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between px-2 sm:px-4 py-2 sm:py-3 border-b border-gray-100 bg-gray-50/50 gap-2 sm:gap-0">
                  {/* Navigation */}
                  <div className="flex items-center gap-1.5 sm:gap-3">
                    <button 
                      onClick={handleCalendarToday}
                      className="px-2 sm:px-4 py-2 bg-white hover:bg-gray-100 rounded-lg text-xs sm:text-sm font-semibold text-gray-700 transition-colors border border-gray-200 shadow-sm whitespace-nowrap"
                    >
                      {t('home.stats.todaySlots')}
                    </button>
                    <div className="flex items-center bg-white rounded-lg border border-gray-200 shadow-sm flex-1 sm:flex-none">
                      <button onClick={handleCalendarPrev} className="p-1.5 sm:p-2.5 hover:bg-gray-100 rounded-l-lg transition-colors border-r border-gray-200">
                        <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                      </button>
                      <span className="px-2 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-gray-900 flex-1 sm:min-w-[200px] text-center truncate">
                        {calendarTitle || t('admin.tabs.agenda')}
                      </span>
                      <button onClick={handleCalendarNext} className="p-1.5 sm:p-2.5 hover:bg-gray-100 rounded-r-lg transition-colors border-l border-gray-200">
                        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                      </button>
                    </div>
                  </div>

                  {/* Vue Semaine/Mois + Mode Vue/Édition - scroll horizontal sur tablettes */}
                  <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3 justify-end overflow-x-auto flex-shrink-0">
                    {/* Semaine/Mois */}
                    <div className="flex bg-white rounded-lg p-0.5 border border-gray-200 shadow-sm flex-shrink-0">
                      <button
                        onClick={() => handleViewSwitch("timeGridWeek")}
                        className={`px-2 lg:px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                          calendarView === "timeGridWeek"
                            ? "bg-gray-900 text-white shadow-sm"
                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <span className="hidden md:inline">{t('admin.agenda.views.week')}</span>
                        <span className="md:hidden">S</span>
                      </button>
                      <button
                        onClick={() => handleViewSwitch("dayGridMonth")}
                        className={`px-2 lg:px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                          calendarView === "dayGridMonth"
                            ? "bg-gray-900 text-white shadow-sm"
                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <span className="hidden md:inline">{t('admin.agenda.views.month')}</span>
                        <span className="md:hidden">M</span>
                      </button>
                    </div>

                    {/* Séparateur */}
                    <div className="hidden lg:block h-6 w-px bg-gray-300 flex-shrink-0" />

                    {/* Toggle Vue / Éditer */}
                    <div className="flex bg-gray-100 rounded-lg p-0.5 flex-shrink-0">
                      <button
                        onClick={() => {
                          setAgendaMode("view")
                          setEditMode("slot") // Réinitialiser le mode d'édition
                        }}
                        className={`flex items-center gap-1 px-2 lg:px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                          agendaMode === "view"
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">{t('admin.agenda.viewMode')}</span>
                      </button>
                      <button
                        onClick={() => setAgendaMode("edit")}
                        className={`flex items-center gap-1 px-2 lg:px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                          agendaMode === "edit"
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">{t('admin.agenda.editModeBtn')}</span>
                      </button>
                    </div>

                    {/* Filtre sport (toujours visible) */}
                    {(() => {
                      const enabledSportsCount = sports.filter(s => s.enabled).length
                      const showAllOption = enabledSportsCount <= 2
                      return (
                        <Select value={selectedSportFilter} onValueChange={setSelectedSportFilter}>
                          <SelectTrigger className={`w-auto min-w-[90px] md:min-w-[120px] h-8 text-[11px] md:text-xs rounded-lg px-2 flex-shrink-0 ${selectedSportFilter !== "all" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200"}`}>
                            <SelectValue placeholder="Sport" />
                          </SelectTrigger>
                          <SelectContent>
                            {showAllOption && (
                              <SelectItem value="all">{t('admin.agenda.filters.allSports')}</SelectItem>
                            )}
                            {sports.filter(s => s.enabled).map((sport) => (
                              <SelectItem key={sport.id} value={sport.id}>
                                {sport.icon} {sport.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )
                    })()}
                  </div>
                </div>

                {/* NIVEAU 2 : Outils (visible uniquement en mode édition) */}
                {agendaMode === "edit" && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between px-2 sm:px-4 py-2 sm:py-3 border-t border-gray-100 gap-2 sm:gap-0">
                  {/* Outils d'édition */}
                  <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap">
                    <span className="hidden sm:inline text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('admin.agenda.tools')}</span>
                    <button
                          onClick={() => setEditMode("slot")}
                          className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                            editMode === "slot"
                              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                              : "bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600"
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          <span className="hidden sm:inline">{t('admin.agenda.editMode.slot')}</span>
                          <span className="sm:hidden">+</span>
                        </button>
                        <button
                          onClick={() => setEditMode("closure")}
                          className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                            editMode === "closure"
                              ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                              : "bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600"
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          <span className="hidden sm:inline">{t('admin.agenda.editMode.closure')}</span>
                        </button>
                    <button
                      onClick={() => setEditMode("eraser")}
                      className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                        editMode === "eraser"
                          ? "bg-red-600 text-white shadow-lg shadow-red-600/30"
                          : "bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600"
                      }`}
                    >
                      <Eraser className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">{t('admin.agenda.editMode.eraser')}</span>
                    </button>

                  </div>

                  {/* Actions de publication - responsive */}
                  <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-end">
                    {/* Groupe suppression en attente */}
                    {totalPendingDeletions > 0 && (
                      <div className="flex items-center gap-1 bg-rose-50 rounded-lg p-0.5 sm:p-1 border border-rose-200">
                        {/* Bouton Annuler - désélectionner toutes les suppressions */}
                        <Button
                          onClick={() => {
                            // Désélectionner tous les slots
                            const updatedSlots = slots.map(slot => 
                              slot.pendingDeletion ? { ...slot, pendingDeletion: false } : slot
                            )
                            setSlots(updatedSlots)
                            saveSlots(updatedSlots)
                            // Désélectionner toutes les fermetures
                            const updatedClosedPeriods = settings.closedPeriods.map(p => 
                              p.pendingDeletion ? { ...p, pendingDeletion: false } : p
                            )
                            const updatedSettings = { ...settings, closedPeriods: updatedClosedPeriods }
                            setSettingsState(updatedSettings)
                            saveSettings(updatedSettings)
                            // Pas besoin d'incrementDataVersion car on annule juste la sélection
                          }}
                          title={t('common.cancel')}
                          className="h-8 sm:h-10 px-2 sm:px-3 font-semibold bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 text-xs sm:text-sm"
                        >
                          ↩️ <span className="hidden sm:inline">{t('common.cancel')}</span>
                        </Button>
                        
                        {/* Bouton Confirmer suppression */}
                        <Button
                          onClick={async () => {
                            const confirmMessage = `🗑️ ${totalPendingDeletions} ${t('admin.agenda.pendingDeletion')}.\n\n${t('admin.agenda.deleteOutsideSlots')} ?`
                            const confirmed = await showConfirm(confirmMessage, { variant: 'warning' })
                            if (confirmed) {
                              // Supprimer les slots en attente
                              const updatedSlots = slots.filter(slot => !slot.pendingDeletion)
                              setSlots(updatedSlots)
                              saveSlots(updatedSlots)
                              // Supprimer les fermetures en attente
                              const updatedClosedPeriods = settings.closedPeriods.filter(p => !p.pendingDeletion)
                              const updatedSettings = { ...settings, closedPeriods: updatedClosedPeriods }
                              setSettingsState(updatedSettings)
                              saveSettings(updatedSettings)
                              incrementDataVersion()
                            }
                          }}
                          title={t('admin.agenda.pendingDeletion')}
                          className="h-8 sm:h-10 px-2 sm:px-4 font-semibold bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white shadow-lg shadow-rose-500/30 text-xs sm:text-sm"
                        >
                          🗑️ ({totalPendingDeletions})
                        </Button>
                  </div>
                    )}

                    {/* Indicateur créneaux hors horaires */}
                    {outsideHoursCount > 0 && (
                      <Button
                        onClick={async () => {
                          const confirmMessage = `⚠️ ${outsideHoursCount} ${outsideHoursCount > 1 ? t('home.slot.slots') : t('home.slot.slot')} ${t('admin.settings.slotsOutsideHours')}.\n\n${t('admin.agenda.deleteOutsideSlots')} ?`
                          const confirmed = await showConfirm(confirmMessage, { variant: 'warning' })
                          if (confirmed) {
                            const updatedSlots = slots.filter(slot => slot.outsideWorkingHours !== true)
                            setSlots(updatedSlots)
                            saveSlots(updatedSlots)
                            incrementDataVersion()
                          }
                        }}
                        title={t('admin.agenda.outsideHours')}
                        className="h-8 sm:h-11 px-2 sm:px-5 font-semibold bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg shadow-red-500/30 text-xs sm:text-base"
                      >
                        ⚠️ {outsideHoursCount}
                      </Button>
                    )}

                    {/* Bouton Publier - visible seulement s'il y a quelque chose à publier */}
                    {(() => {
                      const totalChanges = unpublishedCount + unpublishedClosuresCount
                      if (totalChanges === 0) return null
                      return (
                        <Button
                          onClick={async () => {
                            const result = await publishAllSlots()
                            setSlots(getSlots())
                            setSettingsState(getSettings())
                            
                            // Message professionnel
                            let message = ""
                            const hasSlots = result.published > 0
                            const hasClosures = result.publishedClosures > 0
                            const hasDeleted = result.deleted > 0
                            
                            if (hasSlots && hasClosures) {
                              message = t('admin.agenda.publishSuccessBoth', { slots: result.published, closures: result.publishedClosures })
                            } else if (hasSlots) {
                              message = t('admin.agenda.publishSuccessSlots', { count: result.published })
                            } else if (hasClosures) {
                              message = t('admin.agenda.publishOnlyClosures', { count: result.publishedClosures })
                            } else if (hasDeleted) {
                              message = `${result.deleted} ${t('admin.agenda.deleted')}`
                            } else {
                              message = t('admin.agenda.publishNoChanges')
                            }
                            
                            await showAlert(message, { variant: 'success', title: t('admin.agenda.publishSuccess') })
                          }}
                          title={t('admin.agenda.publish')}
                          className="h-8 sm:h-11 px-2 sm:px-5 font-semibold bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg shadow-orange-500/30 animate-pulse text-xs sm:text-base"
                        >
                          🚀 <span className="hidden sm:inline">{t('admin.agenda.publish')}</span> ({totalChanges})
                        </Button>
                      )
                    })()}
                </div>
                </div>
                )}

                {/* Indicateur de mode actif - Visible uniquement en mode édition */}
                {agendaMode === "edit" && editMode === "slot" && (
                  <div className="px-2 sm:px-4 py-1.5 sm:py-2 bg-blue-50 text-blue-700 border-t border-blue-100 text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2">
                    <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="truncate">
                      <span className="hidden sm:inline">{t('admin.agenda.clickToAdd')}</span>
                      <span className="sm:hidden">{t('admin.agenda.holdToAdd') || 'Maintenir appuyé et glisser'}</span>
                    </span>
                    {selectedSportFilter !== "all" && (
                      <span className="ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 bg-blue-200 rounded-full text-[10px] sm:text-xs whitespace-nowrap">
                        {sports.find(s => s.id === selectedSportFilter)?.icon}
                      </span>
                    )}
                  </div>
                )}
                {agendaMode === "edit" && editMode === "closure" && (
                  <div className="px-2 sm:px-4 py-1.5 sm:py-2 bg-orange-50 text-orange-700 border-t border-orange-100 text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2">
                    <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="truncate">
                      <span className="hidden sm:inline">{t('admin.agenda.clickToClose')}</span>
                      <span className="sm:hidden">{t('admin.agenda.holdToClose') || 'Maintenir appuyé pour fermer'}</span>
                    </span>
                  </div>
                )}
                {agendaMode === "edit" && editMode === "eraser" && (
                  <div className="px-2 sm:px-4 py-1.5 sm:py-2 bg-red-50 text-red-700 border-t border-red-100 text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2">
                    <Eraser className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="truncate">{t('admin.agenda.eraserMode')}</span>
                  </div>
                )}
              </div>

              {/* Barre de navigation des jours - Mobile uniquement (swipe pour semaines) */}
              {isMobileAgendaView && calendarView === "timeGridWeek" && (
                <div 
                  className={`sm:hidden bg-white border border-gray-200 rounded-lg mb-2 p-2 ${isMobileWeekSwiping ? 'select-none' : ''}`}
                  style={{
                    transform: `translateX(${mobileWeekSwipeOffset * 0.3}px)`,
                    transition: isMobileWeekSwiping ? 'none' : 'transform 0.2s ease-out'
                  }}
                  onTouchStart={handleMobileWeekSwipeStart}
                  onTouchMove={handleMobileWeekSwipeMove}
                  onTouchEnd={handleMobileWeekSwipeEnd}
                >
                  <div className="flex justify-between items-center">
                    {weekDays.map((day, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedDayIndex(index)}
                        className={`flex flex-col items-center py-1.5 px-1 rounded-lg transition-all flex-1 mx-0.5 ${
                          selectedDayIndex === index 
                            ? 'bg-blue-500 text-white shadow-md' 
                            : day.isToday 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <span className="text-[10px] font-medium uppercase">{day.dayName}</span>
                        <span className={`text-sm font-bold ${selectedDayIndex === index ? 'text-white' : ''}`}>
                          {day.dayNumber}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Zones de swipe pour mobile - permettent de swiper même sur jours fermés */}
              {isMobileAgendaView && calendarView === "timeGridWeek" && (
                <>
                  {/* Zone de swipe gauche (bord de l'écran) */}
                  <div 
                    className="fixed left-0 top-1/4 w-6 h-1/2 z-40 sm:hidden"
                    style={{ touchAction: 'pan-y' }}
                    onTouchStart={handleMobileDaySwipeStart}
                    onTouchMove={(e) => {
                      handleMobileDaySwipeMove(e)
                      if (isMobileDaySwiping) e.preventDefault()
                    }}
                    onTouchEnd={handleMobileDaySwipeEnd}
                  />
                  {/* Zone de swipe droite (bord de l'écran) */}
                  <div 
                    className="fixed right-0 top-1/4 w-6 h-1/2 z-40 sm:hidden"
                    style={{ touchAction: 'pan-y' }}
                    onTouchStart={handleMobileDaySwipeStart}
                    onTouchMove={(e) => {
                      handleMobileDaySwipeMove(e)
                      if (isMobileDaySwiping) e.preventDefault()
                    }}
                    onTouchEnd={handleMobileDaySwipeEnd}
                  />
                </>
              )}

              {/* Zone de swipe pour changer de jour - sous le calendrier sur mobile */}
              {isMobileAgendaView && calendarView === "timeGridWeek" && (
                <div 
                  className="sm:hidden h-12 bg-gradient-to-r from-blue-50 via-white to-blue-50 border border-gray-200 rounded-lg mt-2 flex items-center justify-center text-gray-400 text-xs"
                  style={{ touchAction: 'pan-y' }}
                  onTouchStart={handleMobileDaySwipeStart}
                  onTouchMove={(e) => {
                    handleMobileDaySwipeMove(e)
                    if (isMobileDaySwiping) e.preventDefault()
                  }}
                  onTouchEnd={handleMobileDaySwipeEnd}
                >
                  <span className="flex items-center gap-2">
                    <ChevronLeft className="w-4 h-4" />
                    {t('admin.agenda.swipeToNavigate') || 'Glisser pour changer de jour'}
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              )}

              {/* Calendrier - Wrapper */}
              <div 
                className={`relative bg-white border border-gray-200 rounded-lg overflow-hidden ${editMode === "eraser" ? "eraser-mode" : ""} ${isMobileDaySwiping ? 'select-none pointer-events-none' : ''}`}
                style={{
                  transform: isMobileAgendaView && calendarView === "timeGridWeek" ? `translateX(${mobileDaySwipeOffset * 0.3}px)` : undefined,
                  transition: isMobileDaySwiping ? 'none' : 'transform 0.2s ease-out',
                  minHeight: isMobileAgendaView ? '50vh' : undefined,
                  // Bloquer le scroll de la page en mode édition sur mobile pour permettre la sélection
                  touchAction: isMobileAgendaView && agendaMode === "edit" ? 'none' : undefined
                }}
                onMouseDown={(e) => {
                  if (editMode === "eraser") {
                    if (e.button === 0) {
                      // Clic gauche : marquer pour suppression
                      setIsErasing(true)
                      setIsRightClicking(false)
                    } else if (e.button === 2) {
                      // Clic droit : désélectionner
                      setIsRightClicking(true)
                      setIsErasing(false)
                    }
                  }
                }}
                onMouseUp={() => {
                  setIsErasing(false)
                  setIsRightClicking(false)
                }}
                onMouseLeave={() => {
                  setIsErasing(false)
                  setIsRightClicking(false)
                }}
                onContextMenu={(e) => {
                  if (editMode === "eraser") {
                    e.preventDefault() // Empêcher le menu contextuel
                  }
                }}
              >
                <style jsx global>{`
                  .fc {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  }
                  .fc-theme-standard td,
                  .fc-theme-standard th {
                    border-color: #e5e7eb;
                  }
                  .fc-scrollgrid {
                    border: none !important;
                  }
                  /* Mode gomme - curseur personnalisé */
                  .eraser-mode .fc-event {
                    cursor: crosshair !important;
                  }
                  .eraser-mode .fc-event:hover {
                    opacity: 0.6 !important;
                    outline: 2px dashed #dc2626 !important;
                    outline-offset: 2px;
                  }
                  .eraser-mode .fc-bg-event:hover {
                    opacity: 0.4 !important;
                    outline: 2px dashed #dc2626 !important;
                    outline-offset: -2px;
                  }
                  /* Slots en attente de suppression - effet barré */
                  .pending-deletion {
                    background: repeating-linear-gradient(
                      -45deg,
                      transparent,
                      transparent 5px,
                      rgba(255,255,255,0.15) 5px,
                      rgba(255,255,255,0.15) 10px
                    ) !important;
                    text-decoration: line-through;
                    opacity: 0.85;
                  }
                  .fc-col-header-cell {
                    background-color: #f9fafb;
                    padding: 12px 8px;
                    font-weight: 600;
                    color: #374151;
                    font-size: 13px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    border-bottom: 2px solid #e5e7eb;
                  }
                  .fc-timegrid-slot {
                    height: 60px !important;
                  }
                  .fc-timegrid-slot-lane {
                    height: 60px !important;
                  }
                  .fc-timegrid-slot-label {
                    color: #6b7280;
                    font-size: 12px;
                    font-weight: 500;
                    padding: 8px 12px;
                    vertical-align: top;
                    background-color: #fafafa;
                  }
                  .fc-timegrid-col {
                    background-color: #ffffff;
                  }
                  .fc-event {
                    border-radius: 6px;
                    border: none !important;
                    cursor: pointer;
                    margin: 2px 4px !important;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                  }
                  .fc-event:hover {
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
                    transform: translateY(-1px);
                  }
                  .fc-event-main {
                    padding: 0;
                    height: 100%;
                  }
                  .fc-event-time {
                    display: none;
                  }
                  .fc-day-today {
                    background-color: #eff6ff !important;
                  }
                  .fc-timegrid-now-indicator-line {
                    border-color: #ef4444;
                    border-width: 2px;
                  }
                  .fc-daygrid-day-number {
                    padding: 8px;
                    color: #374151;
                    font-weight: 600;
                    font-size: 14px;
                  }
                  .fc-day-today .fc-daygrid-day-number {
                    background-color: #3b82f6;
                    color: white;
                    border-radius: 50%;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 4px;
                  }
                  .fc-highlight {
                    background-color: #dbeafe !important;
                  }
                  .fc-timegrid-event-harness {
                    margin: 0 2px;
                  }
                  .fc-col-header-cell.fc-day-today {
                    background-color: #dbeafe !important;
                  }
                  /* Ghost/Preview pendant le drag/resize */
                  .fc-event-dragging {
                    opacity: 0.5;
                  }
                  .fc-event-mirror {
                    opacity: 0.8 !important;
                    border: 3px dashed #3b82f6 !important;
                    background: rgba(59, 130, 246, 0.3) !important;
                    box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4) !important;
                  }
                  .fc-event-resizing {
                    opacity: 0.7;
                    border: 2px dashed #10b981 !important;
                  }
                  /* Style pour les jours fermés (background events) */
                  .fc-bg-event {
                    opacity: 0.6 !important;
                  }
                  /* Heures hors ouverture - zones grisées */
                  .fc-non-business {
                    background: repeating-linear-gradient(
                      45deg,
                      #f3f4f6,
                      #f3f4f6 10px,
                      #e5e7eb 10px,
                      #e5e7eb 20px
                    ) !important;
                  }
                  .fc-timegrid-col.fc-day-disabled {
                    background-color: #f3f4f6 !important;
                  }
                  /* ===== VUE MOIS AMÉLIORÉE ===== */
                  .fc-daygrid {
                    background-color: #ffffff;
                  }
                  .fc-daygrid-day {
                    min-height: 100px !important;
                    cursor: pointer;
                    transition: all 0.15s;
                  }
                  .fc-daygrid-day:hover {
                    background-color: #f0f9ff !important;
                    transform: scale(1.02);
                    z-index: 10;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                  }
                  .fc-daygrid-day {
                    min-height: 110px !important;
                  }
                  .fc-daygrid-day-frame {
                    min-height: 110px !important;
                    padding: 0 !important;
                    display: block !important;
                  }
                  .fc-daygrid-day-top,
                  .fc-daygrid-day-events,
                  .fc-daygrid-event-harness,
                  .fc-daygrid-bg-harness,
                  .fc-daygrid-day-bg {
                    display: none !important;
                  }
                  .fc-daygrid-day.fc-day-other {
                    background-color: #f9fafb;
                    opacity: 0.6;
                  }
                  .fc-daygrid-day.fc-day-other:hover {
                    opacity: 0.8;
                  }
                  /* Vue Mois sur mobile - affichage ultra compact */
                  @media (max-width: 640px) {
                    .fc-dayGridMonth-view .fc-col-header-cell {
                      padding: 4px 0 !important;
                      font-size: 9px !important;
                      font-weight: 600 !important;
                    }
                    .fc-dayGridMonth-view .fc-daygrid-day {
                      min-height: 52px !important;
                      max-height: 70px !important;
                    }
                    .fc-dayGridMonth-view .fc-daygrid-day-frame {
                      min-height: 52px !important;
                      padding: 0 !important;
                    }
                    .fc-dayGridMonth-view .fc-daygrid-day-top {
                      display: none !important; /* On gère le numéro nous-mêmes */
                    }
                    .fc-dayGridMonth-view .fc-daygrid-day-events {
                      display: none !important; /* Pas d'événements sur mobile */
                    }
                    .fc-dayGridMonth-view .fc-scrollgrid-sync-table {
                      border-collapse: collapse !important;
                    }
                    .fc-dayGridMonth-view td.fc-daygrid-day {
                      border: 1px solid #e5e7eb !important;
                    }
                  }
                `}</style>
                <FullCalendar
                  key={`${effectiveCalendarView}-${effectiveCalendarDate.toISOString().split('T')[0]}-${i18n.language}-${slots.length}-${unpublishedCount}-${outsideHoursCount}-${pendingDeletionCount}-${unpublishedClosuresCount}-${pendingClosureDeletionCount}-${selectedSportFilter}-${selectedDayIndex}`}
                  plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
                  initialView={effectiveCalendarView}
                  initialDate={effectiveCalendarDate}
                  events={allCalendarEvents}
                  headerToolbar={false}
                  height="auto"
                  slotMinTime={slotMinTime}
                  slotMaxTime={slotMaxTime}
                  slotDuration={slotDurationStep}
                  allDaySlot={false}
                  selectable={agendaMode === "edit" && (calendarView === "timeGridWeek" || effectiveCalendarView === "timeGridDay")}
                  selectMirror={agendaMode === "edit" && editMode === "slot" && (calendarView === "timeGridWeek" || effectiveCalendarView === "timeGridDay")}
                  editable={agendaMode === "edit" && editMode === "slot" && (calendarView === "timeGridWeek" || effectiveCalendarView === "timeGridDay")}
                  eventResizableFromStart={true}
                  eventDisplay="auto"
                  dragScroll={true}
                  eventDragMinDistance={5}
                  snapDuration="01:00:00"
                  slotEventOverlap={false}
                  eventMaxStack={3}
                  eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: settings.branding?.timeFormat === "12h" }}
                  slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: settings.branding?.timeFormat === "12h" }}
                  firstDay={1}
                  nowIndicator
                  expandRows
                  businessHours={businessHours}
                  selectConstraint={editMode === "closure" ? undefined : "businessHours"}
                  eventConstraint="businessHours"
                  longPressDelay={50}
                  selectLongPressDelay={50}
                  eventLongPressDelay={200}
                  select={handleCalendarSelect}
                  eventClick={handleCalendarEventClick}
                  eventDrop={handleCalendarEventDrop}
                  dayCellDidMount={(arg) => {
                    if (calendarView !== "dayGridMonth") return
                    
                    const dateStr = formatDateLocal(arg.date)
                    const dayStats = dailyStats.get(dateStr)
                    const isClosed = dayStats?.hasClosure
                    const hasSlots = dayStats && dayStats.slots > 0
                    const isToday = arg.isToday
                    
                    // Vérifier si le jour de la semaine a des horaires d'ouverture
                    const dayOfWeek = arg.date.getDay()
                    const workingHour = settings.workingHours.find((wh) => wh.dayOfWeek === dayOfWeek)
                    const hasNoWorkingHours = !workingHour || !workingHour.enabled
                    
                    // Vider le contenu existant
                    arg.el.innerHTML = ''
                    
                    // Détecter si on est sur mobile
                    const isMobile = window.innerWidth < 640
                    
                    // Créer le conteneur principal
                    const container = document.createElement('div')
                    const isUnavailable = isClosed || hasNoWorkingHours
                    
                    if (isMobile) {
                      // === VERSION MOBILE : Ultra compact ===
                      container.className = `w-full h-full flex flex-col items-center cursor-pointer p-1 ${isUnavailable ? 'bg-gray-100' : 'hover:bg-gray-50'}`
                      container.style.minHeight = '50px'
                      if (hasNoWorkingHours && !isClosed) {
                        container.style.background = 'repeating-linear-gradient(135deg, transparent, transparent 5px, rgba(156, 163, 175, 0.1) 5px, rgba(156, 163, 175, 0.1) 10px)'
                      }
                      
                      // Numéro du jour
                      const dayNumber = document.createElement('span')
                      if (isToday) {
                        dayNumber.className = 'text-[11px] font-bold bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center'
                      } else {
                        dayNumber.className = `text-[11px] font-medium ${isUnavailable ? 'text-gray-400' : 'text-gray-700'}`
                      }
                      dayNumber.textContent = arg.dayNumberText.replace('日', '')
                      container.appendChild(dayNumber)
                      
                      // Badge de statut
                      if (isClosed) {
                        const badge = document.createElement('div')
                        badge.className = 'mt-1 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full'
                        badge.textContent = '✕'
                        container.appendChild(badge)
                      } else if (hasSlots && !hasNoWorkingHours) {
                        const badge = document.createElement('div')
                        // Calcul du taux de remplissage
                        const mobileFillRate = dayStats!.capacity > 0 ? Math.round((dayStats!.bookings / dayStats!.capacity) * 100) : 0
                        const isMobileFull = mobileFillRate >= 100
                        
                        // Couleur selon statut
                        let bgColor = 'bg-blue-500' // Publiés
                        if (isMobileFull) bgColor = 'bg-rose-700' // Journée complète = rouge foncé
                        else if (dayStats!.outsideHours > 0) bgColor = 'bg-red-500'
                        else if (dayStats!.unpublished > 0 && dayStats!.published === 0) bgColor = 'bg-orange-500'
                        else if (dayStats!.unpublished > 0) bgColor = 'bg-gradient-to-r from-orange-500 to-blue-500'
                        
                        badge.className = `mt-1 ${bgColor} text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center`
                        badge.textContent = isMobileFull ? '✓' : String(dayStats!.slots)
                        container.appendChild(badge)
                        
                        // Petit indicateur de réservations si présentes (sauf si complet)
                        if (dayStats!.bookings > 0 && !isMobileFull) {
                          const bookingDot = document.createElement('div')
                          bookingDot.className = 'mt-0.5 text-[8px] text-green-600 font-bold'
                          bookingDot.textContent = `${dayStats!.bookings}👤`
                          container.appendChild(bookingDot)
                        }
                      } else if (!hasNoWorkingHours) {
                        // Jour ouvert sans créneaux
                        const dash = document.createElement('span')
                        dash.className = 'mt-1 text-gray-300 text-[10px]'
                        dash.textContent = '—'
                        container.appendChild(dash)
                      }
                    } else {
                      // === VERSION DESKTOP : Complète et détaillée ===
                      container.className = `w-full h-full flex flex-col cursor-pointer transition-colors ${isUnavailable ? 'bg-gray-100' : 'hover:bg-gray-50'}`
                      container.style.minHeight = '120px'
                      if (hasNoWorkingHours && !isClosed) {
                        container.style.background = 'repeating-linear-gradient(135deg, transparent, transparent 10px, rgba(156, 163, 175, 0.15) 10px, rgba(156, 163, 175, 0.15) 20px)'
                      }
                      
                      // Header avec numéro du jour
                      const header = document.createElement('div')
                      header.className = 'flex justify-between items-start p-2'
                      
                      const dayNumber = document.createElement('span')
                      if (isToday) {
                        dayNumber.className = 'text-sm font-bold bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center shadow-md'
                      } else {
                        dayNumber.className = 'text-sm font-bold text-gray-700'
                      }
                      dayNumber.textContent = arg.dayNumberText.replace('日', '')
                      header.appendChild(dayNumber)
                      
                      // Badges de statut en haut à droite
                      if (hasSlots && !isClosed && !hasNoWorkingHours) {
                        const statusBadges = document.createElement('div')
                        statusBadges.className = 'flex gap-1'
                        if (dayStats!.outsideHours > 0) {
                          statusBadges.innerHTML += `<span class="bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 rounded-full font-medium" title="${t('admin.settings.slotsOutsideHours')}">⚠️${dayStats!.outsideHours}</span>`
                        }
                        if (dayStats!.unpublished > 0) {
                          statusBadges.innerHTML += `<span class="bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0.5 rounded-full font-medium" title="${t('admin.agenda.unpublished')}">🟠${dayStats!.unpublished}</span>`
                        }
                        if (dayStats!.published > 0) {
                          statusBadges.innerHTML += `<span class="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full font-medium" title="${t('admin.agenda.published')}">🔵${dayStats!.published}</span>`
                        }
                        header.appendChild(statusBadges)
                      } else if (isClosed) {
                        const closedIcon = document.createElement('span')
                        closedIcon.className = 'text-lg'
                        closedIcon.textContent = '🚫'
                        header.appendChild(closedIcon)
                      }
                      
                      container.appendChild(header)
                      
                      // Contenu selon l'état
                      const content = document.createElement('div')
                      content.className = 'flex-1 px-2 pb-2'
                      
                      if (hasSlots && !isClosed && !hasNoWorkingHours) {
                        // Calcul du taux de remplissage
                        const fillRate = dayStats!.capacity > 0 ? Math.round((dayStats!.bookings / dayStats!.capacity) * 100) : 0
                        const isFull = fillRate >= 100
                        
                        // Couleur de fond selon statut
                        let bgClass = 'from-blue-500 to-blue-600'
                        if (isFull) bgClass = 'from-rose-700 to-rose-800' // Journée complète = rouge foncé
                        else if (dayStats!.outsideHours > 0) bgClass = 'from-red-500 to-red-600'
                        else if (dayStats!.unpublished > 0 && dayStats!.published === 0) bgClass = 'from-orange-500 to-orange-600'
                        else if (dayStats!.unpublished > 0) bgClass = 'from-orange-500 to-blue-600'
                        
                        const statsBox = document.createElement('div')
                        statsBox.className = `bg-gradient-to-br ${bgClass} rounded-xl p-2.5 text-xs shadow-md`
                        
                        const slotText = dayStats!.slots > 1 ? t('admin.agenda.slotsCount') : t('admin.agenda.slotCount')
                        const bookingsText = t('admin.slots.bookings')
                        
                        statsBox.innerHTML = `
                          <div class="flex justify-between items-center text-white mb-1.5">
                            <span class="font-semibold text-sm">${dayStats!.slots} ${slotText}</span>
                            <span class="font-bold text-sm bg-white/20 px-2 py-0.5 rounded">${dayStats!.hours}h</span>
                          </div>
                          <div class="grid grid-cols-2 gap-1.5 text-white/90">
                            <div class="bg-white/15 rounded-lg px-2 py-1 text-center">
                              <div class="text-[10px] opacity-80">${bookingsText}</div>
                              <div class="font-bold text-sm">${dayStats!.bookings}/${dayStats!.capacity}</div>
                            </div>
                            <div class="bg-white/15 rounded-lg px-2 py-1 text-center">
                              <div class="text-[10px] opacity-80">${t('admin.agenda.statsPage.kpis.fillRate')}</div>
                              <div class="font-bold text-sm">${fillRate}%</div>
                            </div>
                          </div>
                          ${dayStats!.revenue > 0 ? `
                            <div class="mt-1.5 bg-white/20 rounded-lg px-2 py-1 flex justify-between items-center">
                              <span class="text-white/80 text-[10px]">${t('admin.agenda.statsPage.kpis.revenue')}</span>
                              <span class="font-bold text-white text-sm">${dayStats!.revenue} ${settings.branding?.currency || "CHF"}</span>
                            </div>
                          ` : ''}
                        `
                        content.appendChild(statsBox)
                      } else if (isClosed) {
                        const closedBox = document.createElement('div')
                        closedBox.className = 'bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-3 text-white font-bold text-center shadow-md'
                        closedBox.innerHTML = `
                          <div class="text-2xl mb-1">🚫</div>
                          <div class="text-sm">${t('admin.agenda.closed')}</div>
                        `
                        content.appendChild(closedBox)
                      } else if (hasNoWorkingHours) {
                        const noHoursBox = document.createElement('div')
                        noHoursBox.className = 'border-2 border-dashed border-gray-300 rounded-xl p-3 text-gray-400 text-center flex flex-col items-center justify-center h-full'
                        noHoursBox.innerHTML = `
                          <div class="text-xl mb-1">📅</div>
                          <div class="text-xs">${t('admin.agenda.notWorking')}</div>
                        `
                        content.appendChild(noHoursBox)
                      } else {
                        const emptyBox = document.createElement('div')
                        emptyBox.className = 'border-2 border-dashed border-gray-200 rounded-xl p-3 text-gray-300 text-center flex flex-col items-center justify-center h-full hover:border-blue-300 hover:bg-blue-50/50 transition-colors'
                        emptyBox.innerHTML = `
                          <div class="text-xl mb-1">➕</div>
                          <div class="text-xs">${t('admin.agenda.clickToAdd')}</div>
                        `
                        content.appendChild(emptyBox)
                      }
                      
                      container.appendChild(content)
                    }
                    
                    arg.el.appendChild(container)
                  }}
                  eventResize={handleCalendarEventResize}
                  eventMouseEnter={handleCalendarEventMouseEnter}
                  eventDidMount={(info) => {
                    // Ajouter le gestionnaire de clic droit pour le mode gomme
                    info.el.addEventListener('contextmenu', (e) => {
                      if (editMode === "eraser") {
                        e.preventDefault()
                        e.stopPropagation()
                        // Clic droit simple = désélectionner
                        uneraseEvent(info.event)
                      }
                    })
                  }}
                  datesSet={handleCalendarDatesSet}
                  eventContent={renderEventContent}
                  locale={i18n.language}
                  droppable={false}
                  eventOverlap={(stillEvent, movingEvent) => {
                    // Permettre le chevauchement si les sports sont différents
                    const stillSportId = stillEvent?.extendedProps?.sportId
                    const movingSportId = movingEvent?.extendedProps?.sportId
                    // Si les sports sont différents, autoriser le chevauchement
                    return stillSportId !== movingSportId
                  }}
                  selectOverlap={false}
                  weekends
                  navLinks={true}
                  navLinkDayClick={(date) => {
                    goToDateInWeekView(date)
                  }}
                  dateClick={(info) => {
                    // En vue mois, cliquer sur un jour va à la vue semaine
                    if (info.view.type === "dayGridMonth") {
                      goToDateInWeekView(info.date)
                    }
                    // Note: En vue semaine, le mode fermeture est géré par handleCalendarSelect
                  }}
                />
              </div>

              {/* Panneau des fermetures (visible en mode fermeture) */}
              {editMode === "closure" && (
                <div className="mt-4 bg-red-50 border-2 border-red-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-red-800 flex items-center gap-2">
                        🚫 {t('admin.agenda.closureModeActive')}
                      </h3>
                      <p className="text-sm text-red-600 mt-1">
                        {t('admin.agenda.clickToClose')}
                      </p>
                    </div>
                    <button
                      onClick={() => setIsVacationDialogOpen(true)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm"
                    >
                      + {t('admin.agenda.multiplePeriod')}
                    </button>
                  </div>
                  
                  {settings.closedPeriods.length > 0 && (
                    <div className="border-t border-red-200 pt-3 mt-3">
                      <p className="text-xs font-medium text-red-700 mb-2">{t('admin.agenda.closedDays')} :</p>
                      <div className="flex flex-wrap gap-2">
                        {settings.closedPeriods.map((period) => {
                          const startDate = new Date(period.startDate + "T00:00:00")
                          const endDate = new Date(period.endDate + "T00:00:00")
                          const isPublished = period.published === true
                          
                          return (
                            <div
                              key={period.id}
                              className={`group flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg text-sm border transition-all ${
                                isPublished 
                                  ? "border-red-200 hover:border-red-400" 
                                  : "border-orange-300 hover:border-orange-500"
                              }`}
                            >
                              {/* Indicateur de statut */}
                              <span 
                                className={`w-2 h-2 rounded-full ${isPublished ? "bg-red-500" : "bg-orange-500 animate-pulse"}`}
                                title={isPublished ? t('admin.agenda.published') : t('admin.agenda.unpublishedClosures')}
                              />
                              <span className={`font-medium ${isPublished ? "text-red-800" : "text-orange-700"}`}>
                                {getClosureReasonText(period.reason)}
                              </span>
                              <span className={`text-xs ${isPublished ? "text-red-600" : "text-orange-600"}`}>
                                {startDate.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })}
                                {period.startDate !== period.endDate && (
                                  <> → {endDate.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })}</>
                                )}
                              </span>
                              <button
                                onClick={() => handleDeleteVacation(period.id)}
                                className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-all ${
                                  isPublished ? "hover:bg-red-100 text-red-600" : "hover:bg-orange-100 text-orange-600"
                                }`}
                                title={t('common.delete')}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Génération automatique de créneaux */}
              <Card className="mt-4 p-4 bg-gradient-to-br from-violet-500 to-purple-600 border-0 shadow-lg rounded-xl text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                      <Plus className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{t('admin.generate.title')}</h3>
                      <p className="text-sm text-white/80">{t('admin.generate.settings')}</p>
                    </div>
                  </div>
                  <button 
                    onClick={openGenerateDialog}
                    className="px-6 py-3 rounded-xl bg-white text-violet-600 font-bold hover:bg-white/90 transition-all shadow-lg"
                  >
                    ⚡ {t('admin.generate.generate')}
                  </button>
                </div>
              </Card>

              {/* Dialog de génération avancée */}
              {isGenerateDialogOpen && (
                <div 
                  className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                  onClick={() => setIsGenerateDialogOpen(false)}
                >
                  <div 
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                        <Plus className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">{t('admin.generate.title')}</h2>
                        <p className="text-sm text-gray-500">{t('admin.generate.settings')}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-6">
                      {/* Période */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-700 mb-2 block">📅 {t('admin.generate.startDate')}</Label>
                          <Input
                            type="date"
                            value={generateForm.startDate}
                            onChange={(e) => setGenerateForm({ ...generateForm, startDate: e.target.value })}
                            className="h-11"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-700 mb-2 block">📅 {t('admin.generate.endDate')}</Label>
                          <Input
                            type="date"
                            value={generateForm.endDate}
                            onChange={(e) => setGenerateForm({ ...generateForm, endDate: e.target.value })}
                            className="h-11"
                          />
                        </div>
                      </div>

                      {/* Sports */}
                      <div>
                        <Label className="text-sm font-medium text-gray-700 mb-2 block">🏆 {t('admin.tabs.sports')}</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {sports.filter(s => s.enabled).map((sport) => (
                            <button
                              key={sport.id}
                              onClick={() => {
                                const newSportIds = generateForm.sportIds.includes(sport.id)
                                  ? generateForm.sportIds.filter(id => id !== sport.id)
                                  : [...generateForm.sportIds, sport.id]
                                setGenerateForm({ ...generateForm, sportIds: newSportIds })
                              }}
                              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all ${
                                generateForm.sportIds.includes(sport.id)
                                  ? "bg-violet-100 text-violet-800 border-2 border-violet-400"
                                  : "bg-gray-50 text-gray-700 border-2 border-gray-200 hover:bg-gray-100"
                              }`}
                            >
                              <span className="text-lg">{sport.icon}</span>
                              <span className="font-medium">{sport.name}</span>
                              {generateForm.sportIds.includes(sport.id) && (
                                <span className="ml-auto text-violet-600">✓</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Durée, Prix, Capacité */}
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-700 mb-2 block">⏱️ {t('admin.slots.duration')}</Label>
                          <select
                            value={generateForm.duration}
                            onChange={(e) => setGenerateForm({ ...generateForm, duration: Number(e.target.value) })}
                            className="w-full h-10 px-3 font-medium rounded-lg border-2 border-gray-200 focus:border-violet-400 focus:outline-none bg-white"
                          >
                            {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                              <option key={h} value={h * 60}>{h}h</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-700 mb-2 block">💰 {t('admin.slots.price')} ({settings.branding?.currency || "CHF"})</Label>
                          <Input
                            type="number"
                            value={generateForm.price}
                            onChange={(e) => setGenerateForm({ ...generateForm, price: Number(e.target.value) })}
                            className="h-10"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-700 mb-2 block">👥 {t('admin.slots.capacity')}</Label>
                          <Input
                            type="number"
                            value={generateForm.maxCapacity}
                            onChange={(e) => setGenerateForm({ ...generateForm, maxCapacity: Number(e.target.value) })}
                            className="h-10"
                          />
                        </div>
                      </div>

                      {/* Pause midi */}
                      <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-200">
                        <div className="flex items-center gap-3 mb-3">
                          <button
                            onClick={() => setGenerateForm({ ...generateForm, hasLunchBreak: !generateForm.hasLunchBreak })}
                            className={`w-12 h-7 rounded-full relative transition-all ${
                              generateForm.hasLunchBreak ? "bg-amber-500" : "bg-gray-300"
                            }`}
                          >
                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${
                              generateForm.hasLunchBreak ? "left-6" : "left-1"
                            }`} />
                          </button>
                          <div>
                            <span className="font-medium text-amber-800">🍽️ {t('admin.generate.lunchBreak')}</span>
                            <p className="text-xs text-amber-600">{t('admin.generate.lunchBreakDesc')}</p>
                          </div>
                        </div>
                        {generateForm.hasLunchBreak && (
                          <div className="flex items-center gap-3 mt-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-amber-700">{t('admin.generate.from')}</span>
                              <input
                                type="time"
                                value={generateForm.lunchBreakStart}
                                onChange={(e) => setGenerateForm({ ...generateForm, lunchBreakStart: e.target.value })}
                                className="px-3 py-2 rounded-lg border-2 border-amber-300 focus:border-amber-500 focus:outline-none bg-white font-medium text-gray-700"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-amber-700">{t('admin.generate.to')}</span>
                              <input
                                type="time"
                                value={generateForm.lunchBreakEnd}
                                onChange={(e) => setGenerateForm({ ...generateForm, lunchBreakEnd: e.target.value })}
                                className="px-3 py-2 rounded-lg border-2 border-amber-300 focus:border-amber-500 focus:outline-none bg-white font-medium text-gray-700"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Info horaires */}
                      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                        <p className="text-sm text-blue-800">
                          <span className="font-medium">ℹ️ {t('admin.generate.note')} :</span> {t('admin.generate.noteText')}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-3 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsGenerateDialogOpen(false)}
                          className="flex-1"
                        >
                          {t('common.cancel')}
                        </Button>
                        <Button 
                          onClick={generateSlotsAdvanced} 
                          className="flex-1 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                        >
                          ⚡ {t('admin.generate.generate')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Dialog de création de créneau (choix des sports) */}
              {createSlotDialog.isOpen && (
                <div 
                  className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                  onClick={() => setCreateSlotDialog({ ...createSlotDialog, isOpen: false })}
                >
                  <div 
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                        <Plus className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">{t('admin.slots.createSlot')}</h2>
                        <p className="text-sm text-gray-500">{createSlotDialog.date} • {createSlotDialog.time}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-700 mb-2 block">🏆 {t('admin.slots.selectSports')}</Label>
                        <p className="text-xs text-gray-500 mb-3">{t('admin.slots.selectSportsDesc')}</p>
                        <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                          {sports.filter(s => s.enabled).map((sport) => (
                            <button
                              key={sport.id}
                              onClick={() => {
                                const newSelectedSports = createSlotDialog.selectedSports.includes(sport.id)
                                  ? createSlotDialog.selectedSports.filter(id => id !== sport.id)
                                  : [...createSlotDialog.selectedSports, sport.id]
                                setCreateSlotDialog({ ...createSlotDialog, selectedSports: newSelectedSports })
                              }}
                              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all ${
                                createSlotDialog.selectedSports.includes(sport.id)
                                  ? "bg-blue-100 text-blue-800 border-2 border-blue-400"
                                  : "bg-gray-50 text-gray-700 border-2 border-gray-200 hover:bg-gray-100"
                              }`}
                            >
                              <span className="text-lg">{sport.icon}</span>
                              <span className="font-medium truncate">{sport.name}</span>
                              {createSlotDialog.selectedSports.includes(sport.id) && (
                                <span className="ml-auto text-blue-600">✓</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Prix et Capacité */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-700 mb-2 block">💰 {t('admin.slots.price')} ({settings.branding?.currency || "CHF"})</Label>
                          <Input
                            type="number"
                            value={createSlotDialog.price}
                            onChange={(e) => setCreateSlotDialog({ ...createSlotDialog, price: Number(e.target.value) })}
                            className="h-10"
                          />
                          <div className="flex gap-1 mt-2">
                            {[30, 50, 80, 100].map((p) => (
                              <button
                                key={p}
                                onClick={() => setCreateSlotDialog({ ...createSlotDialog, price: p })}
                                className={`flex-1 text-xs py-1.5 rounded-lg border-2 font-medium transition-all ${
                                  createSlotDialog.price === p
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-blue-50"
                                }`}
                              >
                                {p}.-
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-700 mb-2 block">👥 {t('admin.slots.maxCapacity')}</Label>
                          <Input
                            type="number"
                            value={createSlotDialog.maxCapacity}
                            onChange={(e) => setCreateSlotDialog({ ...createSlotDialog, maxCapacity: Number(e.target.value) })}
                            className="h-10"
                          />
                          <div className="flex gap-1 mt-2">
                            {[2, 4, 6, 8].map((c) => (
                              <button
                                key={c}
                                onClick={() => setCreateSlotDialog({ ...createSlotDialog, maxCapacity: c })}
                                className={`flex-1 text-xs py-1.5 rounded-lg border-2 font-medium transition-all ${
                                  createSlotDialog.maxCapacity === c
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-blue-50"
                                }`}
                              >
                                {c}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Durée */}
                      <div>
                        <Label className="text-sm font-medium text-gray-700 mb-2 block">⏱️ {t('admin.slots.duration')}</Label>
                        <select
                          value={createSlotDialog.duration}
                          onChange={(e) => setCreateSlotDialog({ ...createSlotDialog, duration: Number(e.target.value) })}
                          className="w-full h-11 px-3 font-medium rounded-lg border-2 border-gray-200 focus:border-blue-400 focus:outline-none bg-white mb-2"
                        >
                          {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                            <option key={h} value={h * 60}>{h}h</option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          {[1, 2, 3, 4, 6, 8].map((h) => (
                            <button
                              key={h}
                              onClick={() => setCreateSlotDialog({ ...createSlotDialog, duration: h * 60 })}
                              className={`flex-1 py-2 text-sm rounded-lg border-2 font-medium transition-all ${
                                createSlotDialog.duration === h * 60
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-blue-50"
                              }`}
                            >
                              {h}h
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Résumé */}
                      {createSlotDialog.selectedSports.length > 0 && (
                        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                          <p className="text-sm text-blue-800">
                            <span className="font-medium">📊</span> {createSlotDialog.selectedSports.length} {createSlotDialog.selectedSports.length > 1 ? t('admin.slots.slotsWillBeCreated') : t('admin.slots.slotWillBeCreated')}
                          </p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-3 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setCreateSlotDialog({ ...createSlotDialog, isOpen: false })}
                          className="flex-1"
                        >
                          {t('common.cancel')}
                        </Button>
                        <Button 
                          onClick={confirmCreateSlots}
                          disabled={createSlotDialog.selectedSports.length === 0}
                          className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                        >
                          ✓ {t('common.create')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Dialog d'ajout de fermeture */}
              {isVacationDialogOpen && (
                <div 
                  className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                  onClick={() => setIsVacationDialogOpen(false)}
                >
                  <div 
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">{t('admin.closures.add')}</h2>
                        <p className="text-sm text-gray-500">{t('admin.closures.title')}</p>
                      </div>
                    </div>
                    
                    <form onSubmit={handleAddVacation} className="space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-700 mb-2 block">📅 {t('admin.closures.startDate')}</Label>
                          <Input
                            type="date"
                            value={vacationForm.startDate}
                            onChange={(e) => setVacationForm({ ...vacationForm, startDate: e.target.value })}
                            className="h-11"
                            required
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-700 mb-2 block">📅 {t('admin.closures.endDate')}</Label>
                          <Input
                            type="date"
                            value={vacationForm.endDate}
                            onChange={(e) => setVacationForm({ ...vacationForm, endDate: e.target.value })}
                            className="h-11"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm font-medium text-gray-700 mb-2 block">📝 {t('admin.closures.reason')}</Label>
                        <Input
                          value={vacationForm.reason}
                          onChange={(e) => setVacationForm({ ...vacationForm, reason: e.target.value })}
                          placeholder={t('admin.closures.reason')}
                          className="h-11"
                        />
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {['vacation', 'holiday', 'maintenance', 'privateEvent', 'closed'].map((key) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setVacationForm({ ...vacationForm, reason: key })}
                              className={`px-3 py-1.5 text-xs rounded-lg border-2 font-medium transition-all ${
                                vacationForm.reason === key
                                  ? "bg-orange-500 text-white border-orange-500"
                                  : "bg-gray-50 text-gray-600 border-gray-200 hover:border-orange-300"
                              }`}
                            >
                              {t(`admin.closureReasons.${key}`)}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsVacationDialogOpen(false)}
                          className="flex-1"
                        >
                          {t('common.cancel')}
                        </Button>
                        <Button type="submit" className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">
                          {t('admin.closures.add')}
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Dialog de fermeture d'un jour */}
              {closureDialog && (
                <div 
                  className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                  onClick={() => setClosureDialog(null)}
                >
                  <div 
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                        <span className="text-2xl">🚫</span>
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">{t('admin.closureReasons.closed')}</h2>
                        <p className="text-sm text-gray-500">
                          {new Date(closureDialog.date + "T12:00:00").toLocaleDateString(i18n.language, { 
                            weekday: 'long', 
                            day: 'numeric', 
                            month: 'long' 
                          })}
                        </p>
                      </div>
                    </div>

                    {closureDialog.hasSlots && (
                      <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm text-amber-800 font-medium">
                          ⚠️ {closureDialog.slotsCount} {closureDialog.slotsCount > 1 ? t('home.slot.slots') : t('home.slot.slot')} 
                          {closureDialog.bookingsCount > 0 && (
                            <span> ({closureDialog.bookingsCount} {t('admin.slots.bookings')})</span>
                          )}
                        </p>
                      </div>
                    )}
                    
                    <div className="space-y-5">
                      <div>
                        <Label className="text-sm font-medium text-gray-700 mb-2 block">📝 {t('admin.closures.reason')}</Label>
                        <Input
                          value={closureDialog.reason}
                          onChange={(e) => setClosureDialog({ ...closureDialog, reason: e.target.value })}
                          placeholder={t('admin.closureReasons.holiday')}
                          className="h-11"
                          autoFocus
                        />
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {['closed', 'holiday', 'maintenance', 'privateEvent', 'vacation'].map((key) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setClosureDialog({ ...closureDialog, reason: key })}
                              className={`px-3 py-1.5 text-xs rounded-lg border-2 font-medium transition-all ${
                                closureDialog.reason === key
                                  ? "bg-orange-500 text-white border-orange-500"
                                  : "bg-gray-50 text-gray-600 border-gray-200 hover:border-orange-300"
                              }`}
                            >
                              {t(`admin.closureReasons.${key}`)}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setClosureDialog(null)}
                          className="flex-1"
                        >
                          {t('common.cancel')}
                        </Button>
                        <Button 
                          onClick={confirmClosureWithReason} 
                          className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                        >
                          {t('common.confirm')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Popup d'édition rapide - centré sur mobile */}
              {quickEdit && (
                <div 
                  className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center sm:block" 
                  onClick={() => setQuickEdit(null)}
                >
                  <div
                    className="bg-white rounded-xl shadow-2xl border border-gray-100 p-3 sm:p-4 w-[calc(100%-32px)] sm:w-auto sm:min-w-[220px] max-w-[280px] sm:max-w-none mx-4 sm:mx-0 sm:absolute animate-in fade-in zoom-in-95 duration-150"
                    style={{ 
                      left: typeof window !== 'undefined' && window.innerWidth >= 640 ? Math.min(Math.max(quickEdit.position.x - 110, 16), window.innerWidth - 236) : undefined,
                      top: typeof window !== 'undefined' && window.innerWidth >= 640 ? Math.min(quickEdit.position.y + 8, window.innerHeight - 200) : undefined
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {quickEdit.field === "delete" ? (
                      <>
                        <p className="text-sm font-semibold text-gray-900 mb-3 text-center">{t('admin.slots.delete')} ?</p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => confirmDelete(quickEdit.slotId)}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                          >
                            {t('common.delete')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setQuickEdit(null)}
                            className="flex-1"
                          >
                            {t('common.cancel')}
                          </Button>
                        </div>
                      </>
                    ) : quickEdit.field === "sports" ? (
                      <>
                        <Label className="text-xs font-medium text-gray-500 mb-2 block">{t('admin.slots.sports')}</Label>
                        <div className="space-y-1 mb-3">
                          {sports.filter(s => s.enabled).map((sport) => (
                            <button
                              key={sport.id}
                              onClick={() => toggleSportInQuickEdit(sport.id)}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                                quickEdit.selectedSports?.includes(sport.id)
                                  ? "bg-blue-100 text-blue-800 border-2 border-blue-400"
                                  : "bg-gray-50 text-gray-700 border-2 border-transparent hover:bg-gray-100"
                              }`}
                            >
                              <span className="text-lg">{sport.icon}</span>
                              <span className="font-medium">{sport.name}</span>
                              {quickEdit.selectedSports?.includes(sport.id) && (
                                <span className="ml-auto text-blue-600">✓</span>
                              )}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveQuickEdit} className="flex-1">
                            {t('common.save')}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setQuickEdit(null)} className="flex-1">
                            {t('common.cancel')}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <Label className="text-xs font-medium text-gray-500 mb-2 block">
                          {quickEdit.field === "price" && `💰 ${t('admin.slots.price')} (${settings.branding?.currency || "CHF"})`}
                          {quickEdit.field === "capacity" && `👥 ${t('admin.slots.maxCapacity')}`}
                          {quickEdit.field === "duration" && `⏱️ ${t('admin.slots.duration')}`}
                        </Label>
                        <div className="flex gap-2 mb-2">
                          <Input
                            type="number"
                            value={quickEdit.value}
                            onChange={(e) => setQuickEdit({ ...quickEdit, value: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveQuickEdit()
                              if (e.key === "Escape") setQuickEdit(null)
                            }}
                            className="h-9 text-sm font-medium"
                            autoFocus
                            min={1}
                            step={quickEdit.field === "price" ? 5 : 1}
                          />
                          <Button size="sm" onClick={saveQuickEdit} className="h-9 px-4">
                            OK
                          </Button>
                        </div>
                        {quickEdit.field === "duration" && (
                          <div className="flex gap-1">
                            {[1, 2, 3, 4].map((h) => (
                              <button
                                key={h}
                                onClick={() => saveQuickEditWithValue(h)}
                                className={`flex-1 text-sm py-1.5 rounded-lg border-2 font-medium transition-all ${
                                  quickEdit.value === h.toString()
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-blue-50 hover:border-blue-300"
                                }`}
                              >
                                {h}h
                              </button>
                            ))}
                          </div>
                        )}
                        {quickEdit.field === "capacity" && (
                          <div className="flex gap-1">
                            {[2, 4, 6, 8].map((c) => (
                              <button
                                key={c}
                                onClick={() => saveQuickEditWithValue(c)}
                                className={`flex-1 text-sm py-1.5 rounded-lg border-2 font-medium transition-all ${
                                  quickEdit.value === c.toString()
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-blue-50 hover:border-blue-300"
                                }`}
                              >
                                {c}
                              </button>
                            ))}
                          </div>
                        )}
                        {quickEdit.field === "price" && (
                          <div className="flex gap-1">
                            {[30, 50, 80, 100].map((p) => (
                              <button
                                key={p}
                                onClick={() => saveQuickEditWithValue(p)}
                                className={`flex-1 text-sm py-1.5 rounded-lg border-2 font-medium transition-all ${
                                  quickEdit.value === p.toString()
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-blue-50 hover:border-blue-300"
                                }`}
                              >
                                {p}.-
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="slots" className="space-y-6 pt-4">
              {/* Header avec titre */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{t('admin.settings.title')}</h2>
                  <p className="text-gray-500 mt-1">{t('admin.settings.subtitle')}</p>
                </div>
              </div>

              {/* Horaires de travail - Design moderne */}
              <Card className="p-6 bg-white border-0 shadow-lg rounded-xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div>
                      <h3 className="text-lg font-bold text-gray-900">{t('admin.settings.sections.workingHours')}</h3>
                      <p className="text-sm text-gray-500">{t('admin.settings.sections.workingHoursDesc')}</p>
                  </div>
                  </div>
                  
                  {/* Boutons Enregistrer / Annuler */}
                  {hasWorkingHoursChanged && (
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={resetWorkingHours}
                        variant="outline"
                        className="h-9"
                      >
                        {t('common.cancel')}
                      </Button>
                      <Button
                        onClick={saveWorkingHours}
                        className="h-9 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg"
                      >
                        💾 {t('common.save')}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {editableWorkingHours.map((wh) => (
                    <div 
                      key={wh.dayOfWeek} 
                      className={`p-4 rounded-xl border-2 transition-all ${
                        wh.enabled 
                          ? "bg-blue-50/50 border-blue-200" 
                          : "bg-gray-50 border-gray-100"
                      }`}
                    >
                      <div className="flex items-center gap-4 flex-wrap">
                        {/* Toggle jour */}
                        <button
                          onClick={() => {
                            const updated = editableWorkingHours.map((w) =>
                              w.dayOfWeek === wh.dayOfWeek ? { ...w, enabled: !w.enabled } : w,
                            )
                            setEditableWorkingHours(updated)
                          }}
                          className={`w-12 h-7 rounded-full relative transition-all ${
                            wh.enabled ? "bg-blue-600" : "bg-gray-300"
                          }`}
                        >
                          <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all ${
                            wh.enabled ? "left-6" : "left-1"
                          }`} />
                        </button>

                        {/* Nom du jour */}
                        <span className={`font-semibold w-24 ${wh.enabled ? "text-gray-900" : "text-gray-400"}`}>
                          {dayNames[wh.dayOfWeek]}
                        </span>

                        {wh.enabled && (
                          <div className="flex items-center gap-4 flex-wrap flex-1">
                            {/* Heure début */}
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500">{t('admin.generate.from')}</span>
                              <input
                                type="time"
                                value={wh.startTime}
                                onChange={(e) => {
                                  const updated = editableWorkingHours.map((w) =>
                                    w.dayOfWeek === wh.dayOfWeek ? { ...w, startTime: e.target.value } : w,
                                  )
                                  setEditableWorkingHours(updated)
                                }}
                                className="px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-400 focus:outline-none bg-white font-medium text-gray-700"
                              />
                            </div>

                            {/* Heure fin */}
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500">{t('admin.generate.to')}</span>
                              <input
                                type="time"
                                value={wh.endTime}
                                onChange={(e) => {
                                  const updated = editableWorkingHours.map((w) =>
                                    w.dayOfWeek === wh.dayOfWeek ? { ...w, endTime: e.target.value } : w,
                                  )
                                  setEditableWorkingHours(updated)
                                }}
                                className="px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-400 focus:outline-none bg-white font-medium text-gray-700"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Paramètres par défaut - Design moderne */}
              <Card className="p-6 bg-white border-0 shadow-lg rounded-xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{t('admin.settings.sections.defaults')}</h3>
                    <p className="text-sm text-gray-500">{t('admin.settings.sections.defaultsDesc')}</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-6">
                  {/* Durée */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-gray-700">⏱️ {t('admin.slots.duration')}</Label>
                    <select
                      value={settings.defaultSlotDuration}
                      onChange={(e) => {
                        const newSettings = { ...settings, defaultSlotDuration: Number.parseInt(e.target.value) }
                        setSettingsState(newSettings)
                        saveSettings(newSettings)
                      }}
                      className="w-full h-11 px-3 text-lg font-semibold rounded-lg border-2 border-gray-200 focus:border-emerald-400 focus:outline-none bg-white"
                    >
                      {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                        <option key={h} value={h * 60}>{h}h</option>
                      ))}
                    </select>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((h) => (
                        <button
                          key={h}
                          onClick={() => {
                            const newSettings = { ...settings, defaultSlotDuration: h * 60 }
                            setSettingsState(newSettings)
                            saveSettings(newSettings)
                          }}
                          className={`flex-1 text-xs py-2 rounded-lg border-2 font-medium transition-all ${
                            settings.defaultSlotDuration === h * 60
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-emerald-50 hover:border-emerald-300"
                          }`}
                        >
                          {h}h
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Prix */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-gray-700">💰 {t('admin.slots.price')} ({settings.branding?.currency || "CHF"})</Label>
                    <Input
                      type="number"
                      value={settings.defaultPrice}
                      onChange={(e) => {
                        const newSettings = { ...settings, defaultPrice: Number.parseFloat(e.target.value) }
                        setSettingsState(newSettings)
                        saveSettings(newSettings)
                      }}
                      className="h-11 text-lg font-semibold"
                    />
                    <div className="flex gap-1">
                      {[30, 50, 80, 100].map((p) => (
                        <button
                          key={p}
                          onClick={() => {
                            const newSettings = { ...settings, defaultPrice: p }
                            setSettingsState(newSettings)
                            saveSettings(newSettings)
                          }}
                          className={`flex-1 text-xs py-2 rounded-lg border-2 font-medium transition-all ${
                            settings.defaultPrice === p
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-emerald-50 hover:border-emerald-300"
                          }`}
                        >
                          {p}.-
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Capacité */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-gray-700">👥 {t('admin.slots.maxCapacity')}</Label>
                    <Input
                      type="number"
                      value={settings.defaultMaxCapacity}
                      onChange={(e) => {
                        const newSettings = { ...settings, defaultMaxCapacity: Number.parseInt(e.target.value) }
                        setSettingsState(newSettings)
                        saveSettings(newSettings)
                      }}
                      className="h-11 text-lg font-semibold"
                    />
                    <div className="flex gap-1">
                      {[2, 4, 6, 8].map((c) => (
                        <button
                          key={c}
                          onClick={() => {
                            const newSettings = { ...settings, defaultMaxCapacity: c }
                            setSettingsState(newSettings)
                            saveSettings(newSettings)
                          }}
                          className={`flex-1 text-xs py-2 rounded-lg border-2 font-medium transition-all ${
                            settings.defaultMaxCapacity === c
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-emerald-50 hover:border-emerald-300"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Délai minimum de réservation */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">
                    ⏰ {t('admin.settings.defaults.minBookingAdvance')}
                  </Label>
                  <p className="text-xs text-gray-500 mb-3">{t('admin.settings.defaults.minBookingAdvanceDesc')}</p>
                  <select
                    value={settings.minBookingAdvance || 0}
                    onChange={(e) => {
                      const newSettings = { ...settings, minBookingAdvance: Number.parseInt(e.target.value) }
                      setSettingsState(newSettings)
                      saveSettings(newSettings)
                    }}
                    className="w-full h-11 px-3 rounded-lg border-2 border-gray-200 focus:border-emerald-400 focus:outline-none bg-white"
                  >
                    <option value={0}>{t('admin.settings.defaults.noMinimum')}</option>
                    <option value={1}>1 min</option>
                    <option value={5}>5 min</option>
                    <option value={10}>10 min</option>
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>1h</option>
                    <option value={90}>1h30</option>
                    <option value={120}>2h</option>
                    <option value={150}>2h30</option>
                    <option value={180}>3h</option>
                    <option value={240}>4h</option>
                    <option value={300}>5h</option>
                    <option value={360}>6h</option>
                    <option value={480}>8h</option>
                    <option value={720}>12h</option>
                    <option value={1440}>24h</option>
                    <option value={2880}>48h</option>
                  </select>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {[0, 15, 30, 60, 120, 240].map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          const newSettings = { ...settings, minBookingAdvance: m }
                          setSettingsState(newSettings)
                          saveSettings(newSettings)
                        }}
                        className={`px-3 text-xs py-2 rounded-lg border-2 font-medium transition-all ${
                          (settings.minBookingAdvance || 0) === m
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-emerald-50 hover:border-emerald-300"
                        }`}
                      >
                        {m === 0 ? '0' : m < 60 ? `${m}min` : `${m / 60}h`}
                      </button>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Sécurité - Changement de mot de passe */}
              <Card className="p-6 bg-white border-0 shadow-lg rounded-xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{t('admin.settings.sections.security')}</h3>
                    <p className="text-sm text-gray-500">{t('admin.settings.security.changePassword')}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Nom d'utilisateur (lecture seule) */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">👤 {t('login.username')}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={adminCredentials.username}
                        disabled
                        className="h-11 bg-gray-50 text-gray-500"
                      />
                      <span className="text-xs text-gray-400 whitespace-nowrap">({t('common.none')})</span>
                    </div>
                  </div>

                  {/* Changer le mot de passe */}
                  <form 
                    className="pt-4 border-t border-gray-200"
                    onSubmit={(e) => {
                      e.preventDefault()
                      handleChangePassword()
                    }}
                  >
                    {/* Champ username caché pour l'accessibilité et les gestionnaires de mots de passe */}
                    <input 
                      type="text" 
                      name="username" 
                      autoComplete="username" 
                      value="admin" 
                      readOnly 
                      className="sr-only" 
                      aria-hidden="true"
                      tabIndex={-1}
                    />
                    <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                      <Key className="w-4 h-4" /> {t('admin.settings.security.changePassword')}
                    </h4>
                    
                    <div className="space-y-4">
                      {/* Mot de passe actuel */}
                      <div>
                        <Label className="text-sm font-medium text-gray-700 mb-2 block">{t('admin.settings.security.currentPassword')}</Label>
                        <div className="relative">
                          <Input
                            type={passwordForm.showCurrent ? "text" : "password"}
                            value={passwordForm.currentPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                            placeholder={t('admin.settings.security.currentPassword')}
                            className="h-11 pr-12"
                            autoComplete="current-password"
                          />
                          <button
                            type="button"
                            onClick={() => setPasswordForm({ ...passwordForm, showCurrent: !passwordForm.showCurrent })}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {passwordForm.showCurrent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      {/* Nouveau mot de passe */}
                      <div>
                        <Label className="text-sm font-medium text-gray-700 mb-2 block">{t('admin.settings.security.newPassword')}</Label>
                        <div className="relative">
                          <Input
                            type={passwordForm.showNew ? "text" : "password"}
                            value={passwordForm.newPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                            placeholder={t('admin.settings.security.newPassword')}
                            className="h-11 pr-12"
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() => setPasswordForm({ ...passwordForm, showNew: !passwordForm.showNew })}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {passwordForm.showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{t('admin.settings.security.minChars')}</p>
                      </div>

                      {/* Confirmer le mot de passe */}
                      <div>
                        <Label className="text-sm font-medium text-gray-700 mb-2 block">{t('admin.settings.security.confirmPassword')}</Label>
                        <div className="relative">
                          <Input
                            type={passwordForm.showConfirm ? "text" : "password"}
                            value={passwordForm.confirmPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                            placeholder={t('admin.settings.security.confirmPassword')}
                            className="h-11 pr-12"
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() => setPasswordForm({ ...passwordForm, showConfirm: !passwordForm.showConfirm })}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {passwordForm.showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      {/* Messages d'erreur/succès */}
                      {passwordError && (
                        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {passwordError}
                        </div>
                      )}
                      {passwordSuccess && (
                        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
                          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {passwordSuccess}
                        </div>
                      )}

                      {/* Bouton de sauvegarde */}
                      <Button
                        type="submit"
                        className="w-full h-11 bg-slate-800 hover:bg-slate-900"
                        disabled={!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                      >
                        <Key className="w-4 h-4 mr-2" />
                        {t('admin.settings.security.changePassword')}
                      </Button>
                    </div>
                  </form>
                </div>
              </Card>

              {/* Configuration Email (SMTP) */}
              <Card className="p-6 bg-white border-0 shadow-lg rounded-xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{t('admin.settings.smtp.title')}</h3>
                    <p className="text-sm text-gray-500">{t('admin.settings.smtp.description')}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Activer SMTP */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                      <div className="font-medium text-gray-900">{t('admin.settings.smtp.enabled')}</div>
                      <p className="text-sm text-gray-500">{t('admin.settings.smtp.description')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.smtp?.enabled || false}
                        onChange={(e) => {
                          const newSettings = { 
                            ...settings, 
                            smtp: { 
                              ...settings.smtp,
                              enabled: e.target.checked,
                              host: settings.smtp?.host || '',
                              port: settings.smtp?.port || 587,
                              secure: settings.smtp?.secure || false,
                              user: settings.smtp?.user || '',
                              password: settings.smtp?.password || '',
                              fromEmail: settings.smtp?.fromEmail || '',
                              fromName: settings.smtp?.fromName || '',
                              notifyTeamOnBooking: settings.smtp?.notifyTeamOnBooking || false,
                              teamEmails: settings.smtp?.teamEmails || [],
                              sendConfirmationToClient: settings.smtp?.sendConfirmationToClient || true,
                            } 
                          }
                          setSettingsState(newSettings)
                          saveSettings(newSettings)
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {settings.smtp?.enabled && (
                    <>
                      {/* Configuration serveur */}
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-700 mb-2 block">🖥️ {t('admin.settings.smtp.host')}</Label>
                          <Input
                            value={settings.smtp?.host || ''}
                            onChange={(e) => {
                              const newSettings = { 
                                ...settings, 
                                smtp: { ...settings.smtp!, host: e.target.value } 
                              }
                              setSettingsState(newSettings)
                              saveSettings(newSettings)
                            }}
                            placeholder={t('admin.settings.smtp.hostPlaceholder')}
                            className="h-11"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-700 mb-2 block">🔌 {t('admin.settings.smtp.port')}</Label>
                          <Input
                            type="number"
                            value={settings.smtp?.port || 587}
                            onChange={(e) => {
                              const newSettings = { 
                                ...settings, 
                                smtp: { ...settings.smtp!, port: parseInt(e.target.value) || 587 } 
                              }
                              setSettingsState(newSettings)
                              saveSettings(newSettings)
                            }}
                            className="h-11"
                          />
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-700 mb-2 block">👤 {t('admin.settings.smtp.user')}</Label>
                          <Input
                            value={settings.smtp?.user || ''}
                            onChange={(e) => {
                              const newSettings = { 
                                ...settings, 
                                smtp: { ...settings.smtp!, user: e.target.value } 
                              }
                              setSettingsState(newSettings)
                              saveSettings(newSettings)
                            }}
                            placeholder={t('admin.settings.smtp.userPlaceholder')}
                            className="h-11"
                          />
                        </div>
                        <form onSubmit={(e) => e.preventDefault()}>
                          <Label className="text-sm font-medium text-gray-700 mb-2 block">🔐 {t('admin.settings.smtp.password')}</Label>
                          <div className="relative">
                            <Input
                              type="password"
                              value={smtpPasswordInput}
                              onChange={(e) => {
                                setSmtpPasswordInput(e.target.value)
                                if (e.target.value) {
                                  const newSettings = { 
                                    ...settings, 
                                    smtp: { ...settings.smtp!, password: e.target.value } 
                                  }
                                  setSettingsState(newSettings)
                                  saveSettings(newSettings)
                                }
                              }}
                              onFocus={() => {
                                // Effacer le placeholder quand on focus si un mot de passe existe
                                if (settings.smtp?.password && smtpPasswordInput === '') {
                                  setSmtpPasswordInput('')
                                }
                              }}
                              placeholder={settings.smtp?.password ? '••••••••••••' : t('admin.settings.smtp.passwordPlaceholder')}
                              className="h-11 pr-20"
                              autoComplete="off"
                            />
                            {settings.smtp?.password && (
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">✓ Enregistré</span>
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {settings.smtp?.password 
                              ? t('admin.settings.smtp.passwordSaved')
                              : t('admin.settings.smtp.passwordHint')}
                          </p>
                        </form>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <input
                          type="checkbox"
                          id="smtp-secure"
                          checked={settings.smtp?.secure || false}
                          onChange={(e) => {
                            const newSettings = { 
                              ...settings, 
                              smtp: { ...settings.smtp!, secure: e.target.checked } 
                            }
                            setSettingsState(newSettings)
                            saveSettings(newSettings)
                          }}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <label htmlFor="smtp-secure" className="text-sm text-gray-700 cursor-pointer">
                          🔒 {t('admin.settings.smtp.secure')}
                        </label>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-700 mb-2 block">📧 {t('admin.settings.smtp.fromEmail')}</Label>
                          <Input
                            value={settings.smtp?.fromEmail || ''}
                            onChange={(e) => {
                              const newSettings = { 
                                ...settings, 
                                smtp: { ...settings.smtp!, fromEmail: e.target.value } 
                              }
                              setSettingsState(newSettings)
                              saveSettings(newSettings)
                            }}
                            placeholder={t('admin.settings.smtp.fromEmailPlaceholder')}
                            className="h-11"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-700 mb-2 block">🏷️ {t('admin.settings.smtp.fromName')}</Label>
                          <Input
                            value={settings.smtp?.fromName || ''}
                            onChange={(e) => {
                              const newSettings = { 
                                ...settings, 
                                smtp: { ...settings.smtp!, fromName: e.target.value } 
                              }
                              setSettingsState(newSettings)
                              saveSettings(newSettings)
                            }}
                            placeholder={t('admin.settings.smtp.fromNamePlaceholder')}
                            className="h-11"
                          />
                        </div>
                      </div>

                      {/* Notifications */}
                      <div className="pt-4 border-t border-gray-200">
                        <h4 className="font-medium text-gray-900 mb-4">🔔 {t('admin.settings.smtp.notifications')}</h4>
                        
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            <input
                              type="checkbox"
                              id="smtp-confirm-client"
                              checked={settings.smtp?.sendConfirmationToClient !== false}
                              onChange={(e) => {
                                const newSettings = { 
                                  ...settings, 
                                  smtp: { ...settings.smtp!, sendConfirmationToClient: e.target.checked } 
                                }
                                setSettingsState(newSettings)
                                saveSettings(newSettings)
                              }}
                              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <label htmlFor="smtp-confirm-client" className="text-sm text-gray-700 cursor-pointer">
                              ✉️ {t('admin.settings.smtp.sendConfirmationToClient')}
                            </label>
                          </div>

                          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            <input
                              type="checkbox"
                              id="smtp-notify-team"
                              checked={settings.smtp?.notifyTeamOnBooking || false}
                              onChange={(e) => {
                                const newSettings = { 
                                  ...settings, 
                                  smtp: { ...settings.smtp!, notifyTeamOnBooking: e.target.checked } 
                                }
                                setSettingsState(newSettings)
                                saveSettings(newSettings)
                              }}
                              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <label htmlFor="smtp-notify-team" className="text-sm text-gray-700 cursor-pointer">
                              👥 {t('admin.settings.smtp.notifyTeamOnBooking')}
                            </label>
                          </div>

                          {settings.smtp?.notifyTeamOnBooking && (
                            <div>
                              <Label className="text-sm font-medium text-gray-700 mb-2 block">📬 {t('admin.settings.smtp.teamEmails')}</Label>
                              <Input
                                value={(settings.smtp?.teamEmails || []).join(', ')}
                                onChange={(e) => {
                                  const emails = e.target.value.split(',').map(email => email.trim()).filter(email => email)
                                  const newSettings = { 
                                    ...settings, 
                                    smtp: { ...settings.smtp!, teamEmails: emails } 
                                  }
                                  setSettingsState(newSettings)
                                  saveSettings(newSettings)
                                }}
                                placeholder={t('admin.settings.smtp.teamEmailsPlaceholder')}
                                className="h-11"
                              />
                              <p className="text-xs text-gray-500 mt-1">{t('admin.settings.smtp.teamEmailsHint')}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bouton test email */}
                      <div className="pt-4 border-t border-gray-200">
                        <Button
                          onClick={async () => {
                            if (!settings.smtp?.host || !settings.smtp?.user || !settings.smtp?.password || !settings.smtp?.fromEmail) {
                              await showAlert(t('admin.settings.smtp.fillAllFields'), { variant: 'warning' })
                              return
                            }
                            
                            const testEmail = settings.smtp?.user || settings.smtp?.fromEmail
                            const primaryColor = settings.branding?.primaryColor || '#3b82f6'
                            const siteName = settings.branding?.siteName || 'SportSlot'
                            const logoUrl = settings.branding?.logoUrl || ''
                            const logoIcon = settings.branding?.logoIcon || '🏆'
                            setSmtpTestStatus('sending')
                            
                            try {
                              const response = await fetch('/api/email', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  to: testEmail,
                                  subject: `✅ Test SMTP - ${siteName}`,
                                  html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, Helvetica, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px;">
          <!-- Header -->
          <tr>
            <td style="background: ${primaryColor}; border-radius: 16px 16px 0 0; padding: 40px 30px; text-align: center;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width: 80px; height: 80px; background: rgba(255,255,255,0.2); border-radius: 50%; text-align: center; vertical-align: middle;">
                          <span style="font-size: 40px; line-height: 80px;">✅</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="color: white; font-size: 28px; font-weight: 700; padding-bottom: 10px;">
                    ${t('emails.client.configValid')}
                  </td>
                </tr>
                <tr>
                  <td style="color: rgba(255,255,255,0.9); font-size: 16px;">
                    ${t('emails.client.configValidDesc')}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="background: white; padding: 30px; border-radius: 0 0 16px 16px;">
              <!-- Site Name -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 25px;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0" style="background: ${primaryColor}15; padding: 15px 25px; border-radius: 12px;">
                      <tr>
                        <td style="vertical-align: middle; padding-right: 10px;">
                          ${logoUrl ? `<img src="cid:logo" alt="Logo" width="35" height="35" style="display: block; object-fit: contain;">` : `<span style="font-size: 30px;">${logoIcon}</span>`}
                        </td>
                        <td style="font-size: 20px; font-weight: 700; color: ${primaryColor}; vertical-align: middle;">${siteName}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Config Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; border-radius: 12px; border-left: 4px solid ${primaryColor};">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #1e293b; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 15px;">
                          📊 ${t('emails.client.configDetails')}
                        </td>
                      </tr>
                    </table>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 10px 0; color: #64748b; font-size: 14px; border-bottom: 1px solid #e2e8f0;">${t('emails.client.smtpServer')}</td>
                        <td style="padding: 10px 0; text-align: right; color: #1e293b; font-weight: 600; font-family: monospace; border-bottom: 1px solid #e2e8f0;">${settings.smtp?.host}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; color: #64748b; font-size: 14px; border-bottom: 1px solid #e2e8f0;">Port</td>
                        <td style="padding: 10px 0; text-align: right; color: #1e293b; font-weight: 600; font-family: monospace; border-bottom: 1px solid #e2e8f0;">${settings.smtp?.port}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; color: #64748b; font-size: 14px; border-bottom: 1px solid #e2e8f0;">SSL/TLS</td>
                        <td style="padding: 10px 0; text-align: right; border-bottom: 1px solid #e2e8f0;">
                          <span style="background: ${settings.smtp?.secure ? '#dcfce7' : '#fef9c3'}; color: ${settings.smtp?.secure ? '#166534' : '#854d0e'}; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600;">
                            ${settings.smtp?.secure ? '🔒 ' + t('emails.client.sslEnabled') : '🔓 ' + t('emails.client.sslStarttls')}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; color: #64748b; font-size: 14px;">${t('emails.client.sender')}</td>
                        <td style="padding: 10px 0; text-align: right; color: #1e293b; font-weight: 600;">${settings.smtp?.fromEmail}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Success Message -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 20px; background: #f0fdf4; border-radius: 12px;">
                <tr>
                  <td style="padding: 20px; text-align: center; color: #166534; font-size: 15px;">
                    🎉 ${t('emails.client.successMessage')}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="text-align: center; padding: 25px 20px;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                ${t('emails.client.testSentOn')} ${new Date().toLocaleString(i18n.language, { dateStyle: 'full', timeStyle: 'short' })}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
                                  `,
                                  logoBase64: logoUrl || undefined,
                                  smtpSettings: {
                                    host: settings.smtp.host,
                                    port: settings.smtp.port,
                                    secure: settings.smtp.secure,
                                    user: settings.smtp.user,
                                    password: settings.smtp.password,
                                    fromEmail: settings.smtp.fromEmail,
                                    fromName: settings.smtp.fromName || settings.branding?.siteName || 'SportSlot'
                                  }
                                })
                              })
                              
                              const data = await response.json()
                              if (data.success) {
                                setSmtpTestStatus('success')
                                setTimeout(() => setSmtpTestStatus('idle'), 3000)
                              } else {
                                setSmtpTestStatus('error')
                                await showAlert(`${t('common.error')}: ${data.error}`, { variant: 'error' })
                                setTimeout(() => setSmtpTestStatus('idle'), 3000)
                              }
                            } catch (error) {
                              setSmtpTestStatus('error')
                              await showAlert(`${t('common.error')}: ${error instanceof Error ? error.message : t('common.unknownError')}`, { variant: 'error' })
                              setTimeout(() => setSmtpTestStatus('idle'), 3000)
                            }
                          }}
                          disabled={smtpTestStatus === 'sending'}
                          className={`w-full h-11 ${
                            smtpTestStatus === 'success' 
                              ? 'bg-green-600 hover:bg-green-700' 
                              : smtpTestStatus === 'error'
                              ? 'bg-red-600 hover:bg-red-700'
                              : 'bg-blue-600 hover:bg-blue-700'
                          } text-white`}
                        >
                          {smtpTestStatus === 'sending' ? (
                            <>⏳ {t('common.loading')}</>
                          ) : smtpTestStatus === 'success' ? (
                            <>✅ {t('admin.settings.smtp.testEmailSent')}</>
                          ) : smtpTestStatus === 'error' ? (
                            <>❌ {t('admin.settings.smtp.testEmailError')}</>
                          ) : (
                            <>📧 {t('admin.settings.smtp.testEmail')}</>
                          )}
                        </Button>
                        <p className="text-xs text-gray-500 mt-2 text-center">
                          {t('admin.settings.smtp.testEmailWillBeSentTo')} {settings.smtp?.user || settings.smtp?.fromEmail || '...'}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </Card>

              {/* Personnalisation / Branding - En bas car rarement modifié */}
              <Card className="p-6 bg-white border-0 shadow-lg rounded-xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{t('admin.settings.sections.branding')}</h3>
                    <p className="text-sm text-gray-500">{t('admin.settings.sections.business')}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Nom et description */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700 mb-2 block">🏢 {t('admin.settings.branding.siteName')}</Label>
                      <Input
                        value={settings.branding?.siteName || "SportSlot"}
                        onChange={(e) => {
                          const newSettings = { 
                            ...settings, 
                            branding: { ...settings.branding, siteName: e.target.value } 
                          }
                          setSettingsState(newSettings)
                          saveSettings(newSettings)
                        }}
                        placeholder="SportSlot"
                        className="h-11"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700 mb-2 block">📝 {t('admin.settings.branding.siteDescription')}</Label>
                      <Input
                        value={settings.branding?.siteDescription || ""}
                        onChange={(e) => {
                          const newSettings = { 
                            ...settings, 
                            branding: { ...settings.branding, siteDescription: e.target.value } 
                          }
                          setSettingsState(newSettings)
                          saveSettings(newSettings)
                        }}
                        placeholder={t('home.hero.subtitle')}
                        className="h-11"
                      />
                    </div>
                  </div>

                  {/* Titre de l'onglet */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">🏷️ {t('admin.settings.branding.siteTitle')}</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500 whitespace-nowrap">{settings.branding?.siteName || "SportSlot"} -</span>
                        <Input
                        value={settings.branding?.siteTitle || ""}
                          onChange={(e) => {
                            const newSettings = { 
                              ...settings, 
                            branding: { ...settings.branding, siteTitle: e.target.value } 
                            }
                            setSettingsState(newSettings)
                            saveSettings(newSettings)
                          }}
                        placeholder={t('admin.settings.branding.siteTitlePlaceholder')}
                        className="h-11 flex-1"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{t('admin.settings.branding.siteTitleHint')}</p>
                  </div>

                  {/* Logo */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-3 block">🖼️ {t('admin.settings.branding.logo')}</Label>
                    
                    {/* Si une image est déjà définie */}
                    {settings.branding?.logoUrl ? (
                      <div className="space-y-4">
                        {/* Aperçu de l'image actuelle - responsive */}
                        <div className="p-3 sm:p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
                          <div className="flex items-center gap-3 sm:gap-4">
                            <div 
                              className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg sm:rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0"
                              style={{ 
                                backgroundColor: settings.branding?.logoBackground !== false 
                                  ? (settings.branding?.primaryColor || "#3b82f6") 
                                  : "transparent",
                                backgroundImage: settings.branding?.logoBackground === false 
                                  ? "linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)"
                                  : "none",
                                backgroundSize: "8px 8px",
                                backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px"
                              }}
                            >
                              <img 
                                src={settings.branding.logoUrl} 
                                alt="Logo" 
                                className="w-9 h-9 sm:w-12 sm:h-12 object-contain"
                                onError={(e) => { (e.target as HTMLImageElement).src = '' }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-gray-900">{t('admin.settings.branding.currentImage')}</p>
                              <p className="text-[10px] sm:text-xs text-gray-500 truncate">{settings.branding.logoUrl}</p>
                            </div>
                          </div>
                          {/* Boutons en dessous sur mobile, à côté sur desktop */}
                          <div className="flex gap-2 mt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const newSettings = { 
                                  ...settings, 
                                  branding: { ...settings.branding, logoUrl: "", logoOriginalUrl: "" } 
                                }
                                setSettingsState(newSettings)
                                saveSettings(newSettings)
                              }}
                              className="flex-1 sm:flex-none text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 text-xs sm:text-sm"
                            >
                              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                              {t('common.delete')}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Utiliser l'image originale si disponible, sinon l'image actuelle
                                const originalImage = settings.branding?.logoOriginalUrl || settings.branding?.logoUrl || ""
                                setCropImageSrc(originalImage)
                                setCropPosition({ x: 0, y: 0 })
                                setCropZoom(1)
                                setIsLogoCropperOpen(true)
                              }}
                              className="flex-1 sm:flex-none text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200 text-xs sm:text-sm"
                            >
                              <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                              {t('common.crop')}
                            </Button>
                          </div>
                        </div>

                        {/* Option arrière-plan */}
                        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                          <Checkbox
                            id="logoBackground"
                            checked={settings.branding?.logoBackground !== false}
                            onCheckedChange={(checked) => {
                              const newSettings = { 
                                ...settings, 
                                branding: { ...settings.branding, logoBackground: checked as boolean } 
                              }
                              setSettingsState(newSettings)
                              saveSettings(newSettings)
                            }}
                          />
                          <label htmlFor="logoBackground" className="text-sm text-gray-700 cursor-pointer">
                            {t('admin.settings.branding.logoBackground')}
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Tabs URL / Upload */}
                        <div className="flex gap-2 p-1 bg-gray-100 rounded-lg w-fit">
                          <button
                            onClick={() => setLogoInputMode("url")}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                              logoInputMode === "url" 
                                ? "bg-white text-gray-900 shadow-sm" 
                                : "text-gray-600 hover:text-gray-900"
                            }`}
                          >
                            <Link className="w-4 h-4" />
                            {t('admin.settings.branding.linkUrl')}
                          </button>
                          <button
                            onClick={() => setLogoInputMode("upload")}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                              logoInputMode === "upload" 
                                ? "bg-white text-gray-900 shadow-sm" 
                                : "text-gray-600 hover:text-gray-900"
                            }`}
                          >
                            <Upload className="w-4 h-4" />
                            {t('common.upload')}
                          </button>
                        </div>

                        {logoInputMode === "url" ? (
                          <div>
                            <div className="flex gap-2">
                              <Input
                                value={logoUrlInput}
                                onChange={(e) => setLogoUrlInput(e.target.value)}
                          placeholder="https://exemple.com/mon-logo.png"
                                className="h-11 flex-1"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && logoUrlInput.trim()) {
                                    e.preventDefault()
                                    // Déclencher l'import
                                    setIsLoadingLogoUrl(true)
                                    const img = new Image()
                                    img.crossOrigin = "anonymous"
                                    img.onload = () => {
                                      // Convertir en base64 via canvas
                                      const canvas = document.createElement('canvas')
                                      canvas.width = img.naturalWidth
                                      canvas.height = img.naturalHeight
                                      const ctx = canvas.getContext('2d')
                                      if (ctx) {
                                        ctx.drawImage(img, 0, 0)
                                        const base64 = canvas.toDataURL('image/png')
                                        setCropImageSrc(base64)
                                        setCropPosition({ x: 0, y: 0 })
                                        setCropZoom(1)
                                        setIsLogoCropperOpen(true)
                                      }
                                      setIsLoadingLogoUrl(false)
                                      setLogoUrlInput("")
                                    }
                                    img.onerror = () => {
                                      // Si cross-origin échoue, utiliser l'URL directement
                                      setCropImageSrc(logoUrlInput.trim())
                                      setCropPosition({ x: 0, y: 0 })
                                      setCropZoom(1)
                                      setIsLogoCropperOpen(true)
                                      setIsLoadingLogoUrl(false)
                                      setLogoUrlInput("")
                                    }
                                    img.src = logoUrlInput.trim()
                                  }
                                }}
                              />
                              <Button
                                onClick={() => {
                                  if (!logoUrlInput.trim()) return
                                  setIsLoadingLogoUrl(true)
                                  const img = new Image()
                                  img.crossOrigin = "anonymous"
                                  img.onload = () => {
                                    // Convertir en base64 via canvas
                                    const canvas = document.createElement('canvas')
                                    canvas.width = img.naturalWidth
                                    canvas.height = img.naturalHeight
                                    const ctx = canvas.getContext('2d')
                                    if (ctx) {
                                      ctx.drawImage(img, 0, 0)
                                      const base64 = canvas.toDataURL('image/png')
                                      setCropImageSrc(base64)
                                      setCropPosition({ x: 0, y: 0 })
                                      setCropZoom(1)
                                      setIsLogoCropperOpen(true)
                                    }
                                    setIsLoadingLogoUrl(false)
                                    setLogoUrlInput("")
                                  }
                                  img.onerror = () => {
                                    // Si cross-origin échoue, utiliser l'URL directement
                                    setCropImageSrc(logoUrlInput.trim())
                                    setCropPosition({ x: 0, y: 0 })
                                    setCropZoom(1)
                                    setIsLogoCropperOpen(true)
                                    setIsLoadingLogoUrl(false)
                                    setLogoUrlInput("")
                                  }
                                  img.src = logoUrlInput.trim()
                                }}
                                disabled={!logoUrlInput.trim() || isLoadingLogoUrl}
                                className="h-11 px-6 bg-blue-600 hover:bg-blue-700"
                              >
                                {isLoadingLogoUrl ? (
                                  <span className="flex items-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    {t('common.loading')}
                                  </span>
                                ) : (
                                  t('common.import')
                                )}
                              </Button>
                      </div>
                            <p className="text-xs text-gray-500 mt-1">URL → {t('common.import')}</p>
                          </div>
                        ) : (
                          <div>
                            <input
                              ref={logoFileInputRef}
                              type="file"
                              accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                  const reader = new FileReader()
                                  reader.onload = (event) => {
                                    const result = event.target?.result as string
                                    setCropImageSrc(result)
                                    setIsLogoCropperOpen(true)
                                  }
                                  reader.readAsDataURL(file)
                                }
                                e.target.value = ""
                              }}
                            />
                            <div
                              onClick={() => logoFileInputRef.current?.click()}
                              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-blue-500', 'bg-blue-50') }}
                              onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50') }}
                              onDrop={(e) => {
                                e.preventDefault()
                                e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50')
                                const file = e.dataTransfer.files?.[0]
                                if (file && file.type.startsWith('image/')) {
                                  const reader = new FileReader()
                                  reader.onload = (event) => {
                                    const result = event.target?.result as string
                                    setCropImageSrc(result)
                                    setIsLogoCropperOpen(true)
                                  }
                                  reader.readAsDataURL(file)
                                }
                              }}
                              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
                            >
                              <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
                              <p className="text-sm font-medium text-gray-700">{t('admin.agenda.dragOrClick')}</p>
                              <p className="text-xs text-gray-500 mt-1">PNG, JPG, SVG, WebP • Max 5MB</p>
                            </div>
                          </div>
                        )}

                        {/* Ou choisir une icône */}
                        <div className="pt-2">
                          <p className="text-xs text-gray-500 mb-2">{t('admin.settings.branding.orUseDefaultIcon')} :</p>
                          <div className="flex gap-1.5 flex-wrap">
                          {["🏆", "⚽", "🎾", "🏀", "🎯", "🏋️", "🏊", "⛳", "🎿", "🚴", "🏟️", "💪"].map((icon) => (
                            <button
                              key={icon}
                              onClick={() => {
                                const newSettings = { 
                                  ...settings, 
                                  branding: { ...settings.branding, logoIcon: icon, logoUrl: "" } 
                                }
                                setSettingsState(newSettings)
                                saveSettings(newSettings)
                              }}
                                className={`w-10 h-10 text-xl rounded-lg border-2 transition-all ${
                                !settings.branding?.logoUrl && settings.branding?.logoIcon === icon
                                    ? "bg-blue-100 border-blue-500 scale-110"
                                    : "bg-gray-50 border-gray-200 hover:border-blue-300 hover:scale-105"
                              }`}
                            >
                              {icon}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    )}

                    {/* Aperçu du logo dans le header */}
                    <div className="mt-4 p-4 bg-gradient-to-r from-gray-100 to-gray-50 rounded-xl">
                      <p className="text-xs text-gray-500 mb-2">{t('admin.settings.branding.headerPreview')} :</p>
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden"
                          style={{ 
                            backgroundColor: settings.branding?.logoUrl && settings.branding?.logoBackground !== false
                              ? (settings.branding?.primaryColor || "#3b82f6")
                              : settings.branding?.logoUrl 
                                ? "transparent"
                                : (settings.branding?.primaryColor || "#3b82f6")
                          }}
                        >
                      {settings.branding?.logoUrl ? (
                        <img 
                          src={settings.branding.logoUrl} 
                          alt="Logo" 
                              className="w-7 h-7 object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : (
                            <span className="text-lg">{settings.branding?.logoIcon || "🏆"}</span>
                      )}
                        </div>
                      <span className="font-bold text-gray-900">{settings.branding?.siteName || "SportSlot"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Couleur principale */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
                      <Palette className="w-4 h-4" /> {t('admin.settings.branding.primaryColor')}
                    </Label>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { name: t('admin.settings.branding.colors.blue'), value: "#3b82f6" },
                        { name: t('admin.settings.branding.colors.violet'), value: "#8b5cf6" },
                        { name: t('admin.settings.branding.colors.pink'), value: "#ec4899" },
                        { name: t('admin.settings.branding.colors.red'), value: "#ef4444" },
                        { name: t('admin.settings.branding.colors.orange'), value: "#f97316" },
                        { name: t('admin.settings.branding.colors.green'), value: "#22c55e" },
                        { name: t('admin.settings.branding.colors.emerald'), value: "#10b981" },
                        { name: t('admin.settings.branding.colors.cyan'), value: "#06b6d4" },
                        { name: t('admin.settings.branding.colors.indigo'), value: "#6366f1" },
                        { name: t('admin.settings.branding.colors.gray'), value: "#6b7280" },
                      ].map((color) => (
                        <button
                          key={color.value}
                          onClick={() => {
                            const newSettings = { 
                              ...settings, 
                              branding: { ...settings.branding, primaryColor: color.value } 
                            }
                            setSettingsState(newSettings)
                            saveSettings(newSettings)
                          }}
                          className={`w-10 h-10 rounded-lg border-2 transition-all ${
                            settings.branding?.primaryColor === color.value
                              ? "border-gray-900 scale-110 shadow-lg"
                              : "border-transparent hover:scale-105"
                          }`}
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        />
                      ))}
                      <div className="flex items-center gap-2 ml-2">
                        <input
                          type="color"
                          value={settings.branding?.primaryColor || "#3b82f6"}
                          onChange={(e) => {
                            const newSettings = { 
                              ...settings, 
                              branding: { ...settings.branding, primaryColor: e.target.value } 
                            }
                            setSettingsState(newSettings)
                            saveSettings(newSettings)
                          }}
                          className="w-10 h-10 rounded-lg cursor-pointer border-2 border-gray-200"
                        />
                        <span className="text-xs text-gray-500">{t('admin.settings.branding.custom')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Devise */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700 mb-2 block">💰 {t('admin.settings.branding.currency')}</Label>
                      <select
                        value={settings.branding?.currency || "CHF"}
                        onChange={(e) => {
                          const currencies: Record<string, string> = {
                            "CHF": ".-",
                            "EUR": "€",
                            "USD": "$",
                            "GBP": "£",
                          }
                          const newSettings = { 
                            ...settings, 
                            branding: { 
                              ...settings.branding, 
                              currency: e.target.value,
                              currencySymbol: currencies[e.target.value] || ".-"
                            } 
                          }
                          setSettingsState(newSettings)
                          saveSettings(newSettings)
                        }}
                        className="w-full h-11 px-3 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none bg-white"
                      >
                        <option value="CHF">🇨🇭 CHF - Franc suisse</option>
                        <option value="EUR">🇪🇺 EUR - Euro</option>
                        <option value="USD">🇺🇸 USD - Dollar américain</option>
                        <option value="GBP">🇬🇧 GBP - Livre sterling</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700 mb-2 block">📍 {t('admin.settings.branding.currencySymbol')}</Label>
                      <Input
                        value={settings.branding?.currencySymbol || ".-"}
                        onChange={(e) => {
                          const newSettings = { 
                            ...settings, 
                            branding: { ...settings.branding, currencySymbol: e.target.value } 
                          }
                          setSettingsState(newSettings)
                          saveSettings(newSettings)
                        }}
                        placeholder=".-"
                        className="h-11"
                      />
                      <p className="text-xs text-gray-500 mt-1">Ex: ".-" → 50.- / "€" → 50€</p>
                    </div>
                  </div>

                  {/* Langue par défaut */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">🌐 {t('admin.settings.language.title')}</Label>
                    <Select
                      value={settings.branding?.defaultLanguage || "fr"}
                      onValueChange={(value) => {
                        const newSettings = { 
                          ...settings, 
                          branding: { 
                            ...settings.branding, 
                            defaultLanguage: value
                          } 
                        }
                        setSettingsState(newSettings)
                        saveSettings(newSettings)
                      }}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue>
                          <span className="flex items-center gap-2">
                            {settings.branding?.defaultLanguage === 'fr' && (
                              <svg className="w-5 h-4 rounded-sm shadow-sm" viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
                                <path fill="#002654" d="M0 0h213.3v480H0z"/>
                                <path fill="#fff" d="M213.3 0h213.4v480H213.3z"/>
                                <path fill="#ce1126" d="M426.7 0H640v480H426.7z"/>
                              </svg>
                            )}
                            {settings.branding?.defaultLanguage === 'en' && (
                              <svg className="w-5 h-4 rounded-sm shadow-sm" viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
                                <path fill="#012169" d="M0 0h640v480H0z"/>
                                <path fill="#FFF" d="m75 0 244 181L562 0h78v62L400 241l240 178v61h-80L320 301 81 480H0v-60l239-178L0 64V0h75z"/>
                                <path fill="#C8102E" d="m424 281 216 159v40L369 281h55zm-184 20 6 35L54 480H0l240-179zM640 0v3L391 191l2-44L590 0h50zM0 0l239 176h-60L0 42V0z"/>
                                <path fill="#FFF" d="M241 0v480h160V0H241zM0 160v160h640V160H0z"/>
                                <path fill="#C8102E" d="M0 193v96h640v-96H0zM273 0v480h96V0h-96z"/>
                              </svg>
                            )}
                            {settings.branding?.defaultLanguage === 'de' && (
                              <svg className="w-5 h-4 rounded-sm shadow-sm" viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
                                <path fill="#000" d="M0 0h640v160H0z"/>
                                <path fill="#D00" d="M0 160h640v160H0z"/>
                                <path fill="#FFCE00" d="M0 320h640v160H0z"/>
                              </svg>
                            )}
                            {settings.branding?.defaultLanguage === 'es' && (
                              <svg className="w-5 h-4 rounded-sm shadow-sm" viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
                                <path fill="#AA151B" d="M0 0h640v480H0z"/>
                                <path fill="#F1BF00" d="M0 120h640v240H0z"/>
                              </svg>
                            )}
                            {settings.branding?.defaultLanguage === 'it' && (
                              <svg className="w-5 h-4 rounded-sm shadow-sm" viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
                                <path fill="#009246" d="M0 0h213.3v480H0z"/>
                                <path fill="#fff" d="M213.3 0h213.4v480H213.3z"/>
                                <path fill="#ce2b37" d="M426.7 0H640v480H426.7z"/>
                              </svg>
                            )}
                            {settings.branding?.defaultLanguage === 'pt' && (
                              <svg className="w-5 h-4 rounded-sm shadow-sm" viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
                                <path fill="#006600" d="M0 0h256v480H0z"/>
                                <path fill="#FF0000" d="M256 0h384v480H256z"/>
                                <circle fill="#FFCC00" cx="256" cy="240" r="80"/>
                              </svg>
                            )}
                            {settings.branding?.defaultLanguage === 'nl' && (
                              <svg className="w-5 h-4 rounded-sm shadow-sm" viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
                                <path fill="#21468B" d="M0 0h640v480H0z"/>
                                <path fill="#FFF" d="M0 0h640v320H0z"/>
                                <path fill="#AE1C28" d="M0 0h640v160H0z"/>
                              </svg>
                            )}
                            {!settings.branding?.defaultLanguage && (
                              <svg className="w-5 h-4 rounded-sm shadow-sm" viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
                                <path fill="#002654" d="M0 0h213.3v480H0z"/>
                                <path fill="#fff" d="M213.3 0h213.4v480H213.3z"/>
                                <path fill="#ce1126" d="M426.7 0H640v480H426.7z"/>
                              </svg>
                            )}
                            {SUPPORTED_LANGUAGES.find(l => l.code === (settings.branding?.defaultLanguage || 'fr'))?.name}
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORTED_LANGUAGES.map((lang) => (
                          <SelectItem key={lang.code} value={lang.code}>
                            <span className="flex items-center gap-2">
                              {lang.code === 'fr' && (
                                <svg className="w-5 h-4 rounded-sm shadow-sm" viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
                                  <path fill="#002654" d="M0 0h213.3v480H0z"/>
                                  <path fill="#fff" d="M213.3 0h213.4v480H213.3z"/>
                                  <path fill="#ce1126" d="M426.7 0H640v480H426.7z"/>
                                </svg>
                              )}
                              {lang.code === 'en' && (
                                <svg className="w-5 h-4 rounded-sm shadow-sm" viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
                                  <path fill="#012169" d="M0 0h640v480H0z"/>
                                  <path fill="#FFF" d="m75 0 244 181L562 0h78v62L400 241l240 178v61h-80L320 301 81 480H0v-60l239-178L0 64V0h75z"/>
                                  <path fill="#C8102E" d="m424 281 216 159v40L369 281h55zm-184 20 6 35L54 480H0l240-179zM640 0v3L391 191l2-44L590 0h50zM0 0l239 176h-60L0 42V0z"/>
                                  <path fill="#FFF" d="M241 0v480h160V0H241zM0 160v160h640V160H0z"/>
                                  <path fill="#C8102E" d="M0 193v96h640v-96H0zM273 0v480h96V0h-96z"/>
                                </svg>
                              )}
                              {lang.code === 'de' && (
                                <svg className="w-5 h-4 rounded-sm shadow-sm" viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
                                  <path fill="#000" d="M0 0h640v160H0z"/>
                                  <path fill="#D00" d="M0 160h640v160H0z"/>
                                  <path fill="#FFCE00" d="M0 320h640v160H0z"/>
                                </svg>
                              )}
                              {lang.code === 'es' && (
                                <svg className="w-5 h-4 rounded-sm shadow-sm" viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
                                  <path fill="#AA151B" d="M0 0h640v480H0z"/>
                                  <path fill="#F1BF00" d="M0 120h640v240H0z"/>
                                </svg>
                              )}
                              {lang.code === 'it' && (
                                <svg className="w-5 h-4 rounded-sm shadow-sm" viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
                                  <path fill="#009246" d="M0 0h213.3v480H0z"/>
                                  <path fill="#fff" d="M213.3 0h213.4v480H213.3z"/>
                                  <path fill="#ce2b37" d="M426.7 0H640v480H426.7z"/>
                                </svg>
                              )}
                              {lang.code === 'pt' && (
                                <svg className="w-5 h-4 rounded-sm shadow-sm" viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
                                  <path fill="#006600" d="M0 0h256v480H0z"/>
                                  <path fill="#FF0000" d="M256 0h384v480H256z"/>
                                  <circle fill="#FFCC00" cx="256" cy="240" r="80"/>
                                </svg>
                              )}
                              {lang.code === 'nl' && (
                                <svg className="w-5 h-4 rounded-sm shadow-sm" viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
                                  <path fill="#21468B" d="M0 0h640v480H0z"/>
                                  <path fill="#FFF" d="M0 0h640v320H0z"/>
                                  <path fill="#AE1C28" d="M0 0h640v160H0z"/>
                                </svg>
                              )}
                              {lang.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">
                      {t('admin.settings.language.description')}
                    </p>
                  </div>

                  {/* Format d'heure */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">🕐 {t('admin.settings.timeFormat.title')}</Label>
                    <Select
                      value={settings.branding?.timeFormat || "24h"}
                      onValueChange={(value: "24h" | "12h") => {
                        const newSettings = { 
                          ...settings, 
                          branding: { 
                            ...settings.branding, 
                            timeFormat: value
                          } 
                        }
                        setSettingsState(newSettings)
                        saveSettings(newSettings)
                      }}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue>
                          <span className="flex items-center gap-2">
                            {settings.branding?.timeFormat === "12h" ? "🕐 12h (AM/PM)" : "🕐 24h"}
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24h">
                          <span className="flex items-center gap-2">🕐 24h (14:00, 18:30)</span>
                        </SelectItem>
                        <SelectItem value="12h">
                          <span className="flex items-center gap-2">🕐 12h AM/PM (2:00 PM, 6:30 PM)</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">
                      {t('admin.settings.timeFormat.description')}
                    </p>
                  </div>

                  {/* Contact */}
                  <div className="pt-4 border-t border-gray-200">
                    <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                      <Mail className="w-4 h-4" /> {t('admin.settings.sections.business')}
                    </h4>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-700 mb-2 block">📧 {t('admin.settings.business.email')}</Label>
                        <Input
                          type="email"
                          value={settings.branding?.contactEmail || ""}
                          onChange={(e) => {
                            const newSettings = { 
                              ...settings, 
                              branding: { ...settings.branding, contactEmail: e.target.value } 
                            }
                            setSettingsState(newSettings)
                            saveSettings(newSettings)
                          }}
                          placeholder="contact@exemple.com"
                          className="h-11"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700 mb-2 block">📞 {t('admin.settings.business.phone')}</Label>
                        <Input
                          type="tel"
                          value={settings.branding?.contactPhone || ""}
                          onChange={(e) => {
                            const newSettings = { 
                              ...settings, 
                              branding: { ...settings.branding, contactPhone: e.target.value } 
                            }
                            setSettingsState(newSettings)
                            saveSettings(newSettings)
                          }}
                          placeholder="+41 12 345 67 89"
                          className="h-11"
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <Label className="text-sm font-medium text-gray-700 mb-2 block">📍 {t('admin.settings.business.address')}</Label>
                      <Input
                        value={settings.branding?.address || ""}
                        onChange={(e) => {
                          const newSettings = { 
                            ...settings, 
                            branding: { ...settings.branding, address: e.target.value } 
                          }
                          setSettingsState(newSettings)
                          saveSettings(newSettings)
                        }}
                        placeholder="123 Rue du Sport, 1000 Ville"
                        className="h-11"
                      />
                    </div>
                  </div>
                </div>
              </Card>

            </TabsContent>

            <TabsContent value="sports" className="space-y-6 pt-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{t('admin.sports.title')}</h2>
                  <p className="text-gray-500 mt-1">{sports.filter(s => s.enabled).length} {t('admin.tabs.sports')} / {sports.length}</p>
                </div>
                <button
                  onClick={() => {
                    setEditingSport(null)
                    setSportForm({ name: "", icon: "⚽", imageUrl: "" })
                    setIsSportDialogOpen(true)
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-500/25"
                >
                  <Plus className="w-5 h-5" />
                  {t('admin.sports.add')}
                </button>
              </div>

              {/* Grille des sports */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sports.map((sport) => (
                  <div 
                    key={sport.id} 
                    className={`group relative p-5 rounded-2xl border-2 transition-all ${
                      sport.enabled 
                        ? "bg-white border-gray-100 shadow-lg hover:shadow-xl hover:border-blue-200" 
                        : "bg-gray-50 border-gray-100 opacity-60 hover:opacity-100"
                    }`}
                  >
                    {/* Toggle en haut à droite */}
                    <button
                      onClick={() => toggleSport(sport.id)}
                      className={`absolute top-4 right-4 w-12 h-7 rounded-full transition-all ${
                        sport.enabled ? "bg-blue-600" : "bg-gray-300"
                      }`}
                    >
                      <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all ${
                        sport.enabled ? "left-6" : "left-1"
                      }`} />
                    </button>

                    {/* Contenu principal */}
                    <div className="flex items-center gap-4 mb-4">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-4xl ${
                        sport.enabled 
                          ? "bg-gradient-to-br from-blue-100 to-indigo-100" 
                          : "bg-gray-100"
                      }`}>
                        {sport.imageUrl ? (
                          <img
                            src={sport.imageUrl || "/placeholder.svg"}
                            alt={sport.name}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        ) : (
                          sport.icon
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-xl text-gray-900">{sport.name}</h3>
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full mt-1 ${
                          sport.enabled 
                            ? "bg-green-100 text-green-700" 
                            : "bg-gray-200 text-gray-500"
                        }`}>
                          {sport.enabled ? `✓ ${t('admin.sports.enabled')}` : `✗ ${t('admin.sports.disabled')}`}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => handleEditSport(sport)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-blue-100 hover:text-blue-700 transition-all"
                      >
                        <Edit className="w-4 h-4" />
                        {t('common.edit')}
                      </button>
                      <button 
                        onClick={() => handleDeleteSport(sport.id)}
                        className="px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Carte d'ajout */}
                <button
                  onClick={() => {
                    setEditingSport(null)
                    setSportForm({ name: "", icon: "⚽", imageUrl: "" })
                    setIsSportDialogOpen(true)
                  }}
                  className="p-5 rounded-2xl border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all flex flex-col items-center justify-center min-h-[180px] group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center mb-3 transition-colors">
                    <Plus className="w-7 h-7 text-gray-400 group-hover:text-blue-600" />
                  </div>
                  <span className="font-medium text-gray-500 group-hover:text-blue-600">{t('admin.sports.add')}</span>
                </button>
              </div>
            </TabsContent>

            {/* Onglet Statistiques */}
            <TabsContent value="stats" className="space-y-6 pt-4">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <BarChart3 className="w-6 h-6 text-blue-600" />
                    {t('admin.agenda.statsPage.title')}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">{t('admin.agenda.statsPage.subtitle')}</p>
                </div>
                <div className="flex gap-2 self-start sm:self-auto">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      // Pré-remplir avec les valeurs actuelles
                      setExportOptions({
                        ...exportOptions,
                        period: "current",
                        customStartDate: statsCustomDateStart,
                        customEndDate: statsCustomDateEnd,
                      })
                      setIsExportDialogOpen(true)
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {t('admin.agenda.statsPage.export.button')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Force recalcul en changeant légèrement la période
                      const temp = statsPeriod
                      setStatsPeriod("custom")
                      setTimeout(() => setStatsPeriod(temp), 0)
                    }}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {t('admin.agenda.statsPage.refresh')}
                  </Button>
                </div>
              </div>

              {/* Filtres */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-xl">
                {/* Filtre Sport */}
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">{t('admin.agenda.statsPage.filters.sport')}</Label>
                  <Select value={statsSportFilter} onValueChange={setStatsSportFilter}>
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('admin.agenda.statsPage.filters.allSports')}</SelectItem>
                      {sports.filter(s => s.enabled).map(sport => (
                        <SelectItem key={sport.id} value={sport.id}>
                          <span className="flex items-center gap-2">
                            <span>{sport.icon}</span>
                            <span>{sport.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtre Période */}
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">{t('admin.agenda.statsPage.filters.period')}</Label>
                  <Select value={statsPeriod} onValueChange={setStatsPeriod}>
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="thisWeek">{t('admin.agenda.statsPage.filters.thisWeek')}</SelectItem>
                      <SelectItem value="lastWeek">{t('admin.agenda.statsPage.filters.lastWeek')}</SelectItem>
                      <SelectItem value="thisMonth">{t('admin.agenda.statsPage.filters.thisMonth')}</SelectItem>
                      <SelectItem value="lastMonth">{t('admin.agenda.statsPage.filters.lastMonth')}</SelectItem>
                      <SelectItem value="last30Days">{t('admin.agenda.statsPage.filters.last30Days')}</SelectItem>
                      <SelectItem value="last90Days">{t('admin.agenda.statsPage.filters.last90Days')}</SelectItem>
                      <SelectItem value="thisYear">{t('admin.agenda.statsPage.filters.thisYear')}</SelectItem>
                      <SelectItem value="custom">{t('admin.agenda.statsPage.filters.custom')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Dates personnalisées */}
                {statsPeriod === "custom" && (
                  <>
                    <div>
                      <Label className="text-xs text-gray-500 mb-1 block">{t('admin.agenda.statsPage.filters.from')}</Label>
                      <Input
                        type="date"
                        value={statsCustomDateStartInput}
                        onChange={(e) => setStatsCustomDateStartInput(e.target.value)}
                        className="bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 mb-1 block">{t('admin.agenda.statsPage.filters.to')}</Label>
                      <Input
                        type="date"
                        value={statsCustomDateEndInput}
                        onChange={(e) => setStatsCustomDateEndInput(e.target.value)}
                        className="bg-white"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Période affichée */}
              <div className="text-center text-sm text-gray-500">
                {detailedStats.startDate.toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' })}
                {' → '}
                {detailedStats.endDate.toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>

              {/* KPIs principaux - grille 2x2 sur tablette, 4 colonnes sur grand écran */}
              <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-3">
                {/* Chiffre d'affaires */}
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-2.5 sm:p-3 xl:p-4">
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 xl:w-10 xl:h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 xl:w-5 xl:h-5 text-white" />
                    </div>
                    <TrendingUp className="w-3 h-3 xl:w-4 xl:h-4 text-emerald-600" />
                  </div>
                  <p className="text-base sm:text-lg xl:text-2xl font-bold text-emerald-900 truncate">
                    {detailedStats.kpis.totalRevenue}{settings.branding?.currencySymbol || '.-'}
                  </p>
                  <p className="text-[9px] sm:text-[10px] xl:text-xs text-emerald-600 font-medium">
                    <span className="xl:hidden">{t('admin.agenda.statsPage.kpis.revenueShort')}</span>
                    <span className="hidden xl:inline">{t('admin.agenda.statsPage.kpis.revenue')}</span>
                  </p>
                </div>

                {/* Réservations */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-2.5 sm:p-3 xl:p-4">
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 xl:w-10 xl:h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                      <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 xl:w-5 xl:h-5 text-white" />
                    </div>
                  </div>
                  <p className="text-base sm:text-lg xl:text-2xl font-bold text-blue-900">{detailedStats.kpis.totalBookings}</p>
                  <p className="text-[9px] sm:text-[10px] xl:text-xs text-blue-600 font-medium">
                    <span className="xl:hidden">{t('admin.agenda.statsPage.kpis.bookingsShort')}</span>
                    <span className="hidden xl:inline">{t('admin.agenda.statsPage.kpis.bookings')}</span>
                  </p>
                </div>

                {/* Clients uniques */}
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-2.5 sm:p-3 xl:p-4">
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 xl:w-10 xl:h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                      <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 xl:w-5 xl:h-5 text-white" />
                    </div>
                  </div>
                  <p className="text-base sm:text-lg xl:text-2xl font-bold text-purple-900">{detailedStats.kpis.uniqueClients}</p>
                  <p className="text-[9px] sm:text-[10px] xl:text-xs text-purple-600 font-medium">
                    <span className="xl:hidden">{t('admin.agenda.statsPage.kpis.clientsShort')}</span>
                    <span className="hidden xl:inline">{t('admin.agenda.statsPage.kpis.clients')}</span>
                  </p>
                </div>

                {/* Taux d'occupation */}
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-2.5 sm:p-3 xl:p-4">
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 xl:w-10 xl:h-10 bg-amber-500 rounded-lg flex items-center justify-center">
                      <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 xl:w-5 xl:h-5 text-white" />
                    </div>
                  </div>
                  <p className="text-base sm:text-lg xl:text-2xl font-bold text-amber-900">{detailedStats.kpis.occupancyRate}%</p>
                  <p className="text-[9px] sm:text-[10px] xl:text-xs text-amber-600 font-medium">
                    <span className="xl:hidden">{t('admin.agenda.statsPage.kpis.occupancyShort')}</span>
                    <span className="hidden xl:inline">{t('admin.agenda.statsPage.kpis.occupancy')}</span>
                  </p>
                </div>
              </div>

              {/* KPIs secondaires - grille 2x2 sur tablette, 4 colonnes sur grand écran */}
              <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-3">
                <div className="bg-white border rounded-lg p-2 sm:p-2.5 xl:p-3 text-center">
                  <p className="text-sm sm:text-base xl:text-lg font-bold text-gray-800 truncate">{detailedStats.kpis.avgPerBooking}{settings.branding?.currencySymbol || '.-'}</p>
                  <p className="text-[8px] sm:text-[9px] xl:text-xs text-gray-500">
                    <span className="xl:hidden">{t('admin.agenda.statsPage.kpis.avgPerBookingShort')}</span>
                    <span className="hidden xl:inline">{t('admin.agenda.statsPage.kpis.avgPerBooking')}</span>
                  </p>
                </div>
                <div className="bg-white border rounded-lg p-2 sm:p-2.5 xl:p-3 text-center">
                  <p className="text-sm sm:text-base xl:text-lg font-bold text-gray-800">{detailedStats.kpis.totalSlots}</p>
                  <p className="text-[8px] sm:text-[9px] xl:text-xs text-gray-500">
                    <span className="xl:hidden">{t('admin.agenda.statsPage.kpis.totalSlotsShort')}</span>
                    <span className="hidden xl:inline">{t('admin.agenda.statsPage.kpis.totalSlots')}</span>
                  </p>
                </div>
                <div className="bg-white border rounded-lg p-2 sm:p-2.5 xl:p-3 text-center">
                  <p className="text-sm sm:text-base xl:text-lg font-bold text-gray-800">{detailedStats.kpis.bookedSlots}</p>
                  <p className="text-[8px] sm:text-[9px] xl:text-xs text-gray-500">
                    <span className="xl:hidden">{t('admin.agenda.statsPage.kpis.bookedSlotsShort')}</span>
                    <span className="hidden xl:inline">{t('admin.agenda.statsPage.kpis.bookedSlots')}</span>
                  </p>
                </div>
                <div className="bg-white border rounded-lg p-2 sm:p-2.5 xl:p-3 text-center">
                  <p className="text-sm sm:text-base xl:text-lg font-bold text-gray-800">{detailedStats.kpis.totalPeople}</p>
                  <p className="text-[8px] sm:text-[9px] xl:text-xs text-gray-500">
                    <span className="xl:hidden">{t('admin.agenda.statsPage.kpis.totalPeopleShort')}</span>
                    <span className="hidden xl:inline">{t('admin.agenda.statsPage.kpis.totalPeople')}</span>
                  </p>
                </div>
              </div>

              {/* Graphiques */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Graphique évolution CA/Réservations */}
                <Card className="p-4 pb-6">
                  {/* Header avec toggle */}
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      {statsChartType === "revenue" 
                        ? t('admin.agenda.statsPage.charts.revenueOverTime')
                        : t('admin.agenda.statsPage.charts.bookingsOverTime')}
                    </h3>
                    <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                      <button
                        onClick={() => setStatsChartType("revenue")}
                        className={`px-3 py-1 text-xs rounded-md transition-colors ${
                          statsChartType === "revenue" ? "bg-white shadow text-blue-600" : "text-gray-500"
                        }`}
                      >
                        {t('admin.agenda.statsPage.kpis.revenue')}
                      </button>
                      <button
                        onClick={() => setStatsChartType("bookings")}
                        className={`px-3 py-1 text-xs rounded-md transition-colors ${
                          statsChartType === "bookings" ? "bg-white shadow text-blue-600" : "text-gray-500"
                        }`}
                      >
                        {t('admin.agenda.statsPage.kpis.bookings')}
                      </button>
                    </div>
                  </div>
                  
                  {(() => {
                    const data = statsChartType === "revenue" ? detailedStats.charts.revenueByDay : detailedStats.charts.bookingsByDay
                    if (data.length === 0) {
                      return (
                        <div className="h-36 flex items-center justify-center text-gray-400">
                          {t('admin.agenda.statsPage.charts.noData')}
                        </div>
                      )
                    }
                    
                    const maxValue = Math.max(...data.map(d => d.value), 1)
                    // Limiter à 31 barres max
                    const displayData = data.length > 31 
                      ? data.filter((_, i) => i % Math.ceil(data.length / 31) === 0)
                      : data
                    // Calculer combien de labels afficher (max 7)
                    const labelStep = Math.max(1, Math.ceil(displayData.length / 7))
                    
                    return (
                      <div className="flex flex-col">
                        {/* Zone du graphique */}
                        <div className="h-28 flex items-end gap-0.5 mt-8">
                          {displayData.map((day, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center">
                              <div 
                                className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-pointer group relative"
                                style={{ height: `${Math.max((day.value / maxValue) * 90, 2)}px` }}
                              >
                                {/* Tooltip au-dessus */}
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-lg">
                                  {day.label}: {day.value}{statsChartType === "revenue" ? (settings.branding?.currencySymbol || '.-') : ' rés.'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Labels des dates en dessous */}
                        <div className="flex gap-0.5 border-t border-gray-100 pt-1">
                          {displayData.map((day, i) => (
                            <div key={i} className="flex-1 text-center overflow-hidden">
                              {i % labelStep === 0 && (
                                <span className="text-[8px] text-gray-400">{day.label.split(' ')[0]}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </Card>

                {/* Répartition par sport */}
                <Card className="p-4">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
                    <PieChart className="w-4 h-4 text-purple-600" />
                    {t('admin.agenda.statsPage.charts.bySport')}
                  </h3>
                  
                  {detailedStats.charts.bySport.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-gray-400">
                      {t('admin.agenda.statsPage.charts.noData')}
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                      {detailedStats.charts.bySport.map((sport, i) => {
                        const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500']
                        return (
                          <div key={sport.sportId} className="flex items-center gap-3">
                            <span className="text-xl">{sport.icon}</span>
                            <div className="flex-1">
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="font-medium text-gray-700">{sport.name}</span>
                                <span className="text-gray-500">
                                  {sport.revenue}{settings.branding?.currencySymbol || '.-'} • {sport.bookings} rés.
                                </span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${colors[i % colors.length]} rounded-full transition-all`}
                                  style={{ width: `${sport.percentage}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-sm font-semibold text-gray-600 w-12 text-right">{sport.percentage}%</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </Card>

                {/* Heures populaires */}
                <Card className="p-4">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
                    <Clock className="w-4 h-4 text-amber-600" />
                    {t('admin.agenda.statsPage.charts.byHour')}
                  </h3>
                  
                  {detailedStats.charts.byHour.every(h => h.bookings === 0) ? (
                    <div className="h-36 flex items-center justify-center text-gray-400">
                      {t('admin.agenda.statsPage.charts.noData')}
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      {/* Zone du graphique */}
                      <div className="h-28 flex items-end gap-0.5 mt-8">
                        {detailedStats.charts.byHour.slice(6, 22).map((hour, i) => {
                          const maxBookings = Math.max(...detailedStats.charts.byHour.map(h => h.bookings), 1)
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center">
                              <div 
                                className="w-full bg-amber-400 rounded-t hover:bg-amber-500 transition-colors cursor-pointer group relative"
                                style={{ height: `${Math.max((hour.bookings / maxBookings) * 90, 2)}px` }}
                              >
                                {/* Tooltip au-dessus */}
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-lg">
                                  {hour.hour + 6}h: {hour.bookings} rés.
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      {/* Labels des heures en dessous */}
                      <div className="flex gap-0.5 border-t border-gray-100 pt-1">
                        {detailedStats.charts.byHour.slice(6, 22).map((hour, i) => (
                          <div key={i} className="flex-1 text-center">
                            <span className="text-[8px] text-gray-400">{hour.hour + 6}h</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>

                {/* Jours de la semaine */}
                <Card className="p-4">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
                    <Calendar className="w-4 h-4 text-green-600" />
                    {t('admin.agenda.statsPage.charts.byDay')}
                  </h3>
                  
                  {detailedStats.charts.byDayOfWeek.every(d => d.bookings === 0) ? (
                    <div className="h-36 flex items-center justify-center text-gray-400">
                      {t('admin.agenda.statsPage.charts.noData')}
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      {/* Zone du graphique */}
                      <div className="h-28 flex items-end gap-2 mt-8">
                        {/* Réorganiser: Lun-Dim au lieu de Dim-Sam */}
                        {[1, 2, 3, 4, 5, 6, 0].map((dayIndex) => {
                          const day = detailedStats.charts.byDayOfWeek[dayIndex]
                          const maxBookings = Math.max(...detailedStats.charts.byDayOfWeek.map(d => d.bookings), 1)
                          const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
                          return (
                            <div key={dayIndex} className="flex-1 flex flex-col items-center">
                              <div 
                                className="w-full bg-green-500 rounded-t hover:bg-green-600 transition-colors cursor-pointer group relative"
                                style={{ height: `${Math.max((day.bookings / maxBookings) * 90, 4)}px` }}
                              >
                                {/* Tooltip au-dessus */}
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-lg">
                                  {t(`admin.agenda.statsPage.days.${dayNames[dayIndex]}`)}: {day.bookings} rés.
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      {/* Labels des jours en dessous */}
                      <div className="flex gap-2 border-t border-gray-100 pt-1">
                        {[1, 2, 3, 4, 5, 6, 0].map((dayIndex) => {
                          const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
                          return (
                            <div key={dayIndex} className="flex-1 text-center">
                              <span className="text-xs text-gray-500 font-medium">
                                {t(`admin.agenda.statsPage.days.${dayNames[dayIndex]}`)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              </div>

              {/* Tableaux */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top créneaux */}
                <Card className="p-4">
                  <h3 className="font-semibold text-gray-800 mb-4">{t('admin.agenda.statsPage.tables.topSlots')}</h3>
                  
                  {detailedStats.tables.topSlots.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      {t('admin.agenda.statsPage.charts.noData')}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 border-b">
                            <th className="pb-2 font-medium">{t('admin.agenda.statsPage.tables.date')}</th>
                            <th className="pb-2 font-medium">{t('admin.agenda.statsPage.tables.time')}</th>
                            <th className="pb-2 font-medium">{t('admin.agenda.statsPage.tables.sport')}</th>
                            <th className="pb-2 font-medium text-right">{t('admin.agenda.statsPage.tables.bookingsCount')}</th>
                            <th className="pb-2 font-medium text-right">{t('admin.agenda.statsPage.tables.revenue')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailedStats.tables.topSlots.map((slot) => (
                            <tr key={slot.id} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="py-2 text-gray-700">
                                {new Date(slot.date + "T12:00:00").toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })}
                              </td>
                              <td className="py-2 text-gray-700">{slot.time}</td>
                              <td className="py-2">
                                <span className="flex items-center gap-1">
                                  <span>{slot.sportIcon}</span>
                                  <span className="text-gray-600">{slot.sportName}</span>
                                </span>
                              </td>
                              <td className="py-2 text-right font-medium">{slot.currentBookings}/{slot.maxCapacity}</td>
                              <td className="py-2 text-right font-semibold text-emerald-600">
                                {slot.totalRevenue}{settings.branding?.currencySymbol || '.-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>

                {/* Réservations récentes */}
                <Card className="p-4">
                  <h3 className="font-semibold text-gray-800 mb-4">{t('admin.agenda.statsPage.tables.recentBookings')}</h3>
                  
                  {detailedStats.tables.recentBookings.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      {t('admin.agenda.statsPage.charts.noData')}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 border-b">
                            <th className="pb-2 font-medium">{t('admin.agenda.statsPage.tables.client')}</th>
                            <th className="pb-2 font-medium">{t('admin.agenda.statsPage.tables.sport')}</th>
                            <th className="pb-2 font-medium text-center">{t('admin.agenda.statsPage.tables.people')}</th>
                            <th className="pb-2 font-medium text-right">{t('admin.agenda.statsPage.tables.price')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailedStats.tables.recentBookings.map((booking) => (
                            <tr key={booking.id} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="py-2">
                                <div>
                                  <p className="font-medium text-gray-700">{booking.customerName || '-'}</p>
                                  <p className="text-xs text-gray-400">
                                    {booking.slot 
                                      ? `${new Date(booking.slot.date + "T12:00:00").toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })} ${booking.slot.time}`
                                      : '-'}
                                  </p>
                                </div>
                              </td>
                              <td className="py-2">
                                <span className="flex items-center gap-1">
                                  <span>{booking.sportIcon}</span>
                                  <span className="text-gray-600 text-xs">{booking.sportName}</span>
                                </span>
                              </td>
                              <td className="py-2 text-center">{booking.numberOfPeople || 0}</td>
                              <td className="py-2 text-right font-semibold text-emerald-600">
                                {booking.slot ? (booking.slot.price * (booking.numberOfPeople || 0)) : 0}{settings.branding?.currencySymbol || '.-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </div>

              {/* Comparaison par sport */}
              {statsSportFilter === "all" && detailedStats.charts.bySport.length > 1 && (
                <Card className="p-4">
                  <h3 className="font-semibold text-gray-800 mb-4">{t('admin.agenda.statsPage.tables.sportComparison')}</h3>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b">
                          <th className="pb-2 font-medium">{t('admin.agenda.statsPage.tables.sport')}</th>
                          <th className="pb-2 font-medium text-right">{t('admin.agenda.statsPage.kpis.revenue')}</th>
                          <th className="pb-2 font-medium text-right">{t('admin.agenda.statsPage.kpis.bookings')}</th>
                          <th className="pb-2 font-medium text-right">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailedStats.charts.bySport.sort((a, b) => b.revenue - a.revenue).map((sport) => (
                          <tr key={sport.sportId} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-3">
                              <span className="flex items-center gap-2">
                                <span className="text-xl">{sport.icon}</span>
                                <span className="font-medium text-gray-700">{sport.name}</span>
                              </span>
                            </td>
                            <td className="py-3 text-right font-semibold text-emerald-600">
                              {sport.revenue}{settings.branding?.currencySymbol || '.-'}
                            </td>
                            <td className="py-3 text-right text-gray-600">{sport.bookings}</td>
                            <td className="py-3 text-right">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                {sport.percentage}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="font-bold border-t-2">
                          <td className="pt-3">Total</td>
                          <td className="pt-3 text-right text-emerald-600">
                            {detailedStats.kpis.totalRevenue}{settings.branding?.currencySymbol || '.-'}
                          </td>
                          <td className="pt-3 text-right text-gray-700">{detailedStats.kpis.totalBookings}</td>
                          <td className="pt-3 text-right">100%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </Card>
              )}

            </TabsContent>

          </Tabs>
        </Card>

        {/* Dialog de création/modification de sport - EN DEHORS des Tabs pour un positionnement correct */}
              {isSportDialogOpen && (
                <div 
                  className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                  onClick={() => setIsSportDialogOpen(false)}
                >
                  <div 
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h2 className="text-xl font-bold text-gray-900 mb-6">
                {editingSport ? t('admin.sports.edit') : t('admin.sports.add')}
                    </h2>
                    
                    <form onSubmit={handleSportSubmit} className="space-y-5">
                      {/* Prévisualisation */}
                      <div className="flex items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
                        <div className="w-20 h-20 rounded-2xl bg-white shadow-lg flex items-center justify-center text-5xl">
                          {sportForm.imageUrl ? (
                            <img
                              src={sportForm.imageUrl}
                              alt="Preview"
                              className="w-14 h-14 rounded-xl object-cover"
                            />
                          ) : (
                            sportForm.icon || "⚽"
                          )}
                        </div>
                      </div>

                      {/* Nom */}
                      <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">{t('admin.sports.name')}</Label>
                        <Input
                          value={sportForm.name}
                          onChange={(e) => setSportForm({ ...sportForm, name: e.target.value })}
                    placeholder={t('admin.sports.namePlaceholder')}
                          className="h-11"
                          required
                        />
                      </div>

                      {/* Icône emoji */}
                      <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">{t('admin.sports.icon')} (emoji)</Label>
                        <div className="flex gap-2">
                          <Input
                            value={sportForm.icon}
                            onChange={(e) => setSportForm({ ...sportForm, icon: e.target.value })}
                            placeholder="🏸"
                            className="h-11 w-20 text-center text-2xl"
                            maxLength={2}
                          />
                          <div className="flex gap-1 flex-1 flex-wrap">
                            {["⚽", "🏀", "🎾", "🏸", "🏐", "⛳", "🏓", "🥊"].map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => setSportForm({ ...sportForm, icon: emoji })}
                                className={`w-10 h-10 rounded-lg text-xl transition-all ${
                                  sportForm.icon === emoji
                                    ? "bg-blue-100 border-2 border-blue-400"
                                    : "bg-gray-100 hover:bg-gray-200"
                                }`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* URL image */}
                      <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">{t('admin.sports.imageUrl')}</Label>
                        <Input
                          type="url"
                          value={sportForm.imageUrl}
                          onChange={(e) => setSportForm({ ...sportForm, imageUrl: e.target.value })}
                          placeholder="https://exemple.com/image.png"
                          className="h-11"
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex gap-3 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsSportDialogOpen(false)}
                          className="flex-1"
                        >
                    {t('common.cancel')}
                        </Button>
                        <Button type="submit" className="flex-1">
                    {editingSport ? t('common.save') : t('common.confirm')}
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

        {/* Dialog de modification complète du créneau */}
        {(editingSlot || isSlotDialogOpen) && (
          <div 
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => {
              setEditingSlot(null)
              setIsSlotDialogOpen(false)
            }}
          >
            <div 
              className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-gray-900 mb-6">{t('admin.slots.edit')}</h2>
              
              <div className="space-y-5">
                {/* Sport (lecture seule) */}
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">{t('admin.slots.sport')}</Label>
                  <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-gray-100 border-2 border-gray-200">
                    {(() => {
                      const sport = sports.find(s => s.id === slotForm.sportId)
                      return sport ? (
                        <>
                          <span className="text-xl">{sport.icon}</span>
                          <span className="font-medium text-gray-700">{sport.name}</span>
                        </>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )
                    })()}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {t('admin.slots.sportNotEditable')}
                  </p>
                </div>

                {/* Prix et Capacité */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">💰 {t('admin.slots.price')} ({settings.branding?.currency || "CHF"})</Label>
                    <Input
                      type="number"
                      value={slotForm.price}
                      onChange={(e) => setSlotForm({ ...slotForm, price: Number.parseFloat(e.target.value) })}
                      className="h-10"
                    />
                    <div className="flex gap-1 mt-2">
                      {[30, 50, 80, 100].map((p) => (
                        <button
                          key={p}
                          onClick={() => setSlotForm({ ...slotForm, price: p })}
                          className={`flex-1 text-xs py-1.5 rounded-lg border-2 font-medium transition-all ${
                            slotForm.price === p
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-blue-50"
                          }`}
                        >
                          {p}.-
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">👥 {t('admin.slots.maxCapacity')}</Label>
                    <Input
                      type="number"
                      value={slotForm.maxCapacity}
                      onChange={(e) => setSlotForm({ ...slotForm, maxCapacity: Number.parseInt(e.target.value) })}
                      className="h-10"
                    />
                    <div className="flex gap-1 mt-2">
                      {[2, 4, 6, 8].map((c) => (
                        <button
                          key={c}
                          onClick={() => setSlotForm({ ...slotForm, maxCapacity: c })}
                          className={`flex-1 text-xs py-1.5 rounded-lg border-2 font-medium transition-all ${
                            slotForm.maxCapacity === c
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-blue-50"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Durée */}
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">⏱️ {t('admin.slots.duration')}</Label>
                  <select
                    value={slotForm.duration}
                    onChange={(e) => setSlotForm({ ...slotForm, duration: Number(e.target.value) })}
                    className="w-full h-11 px-3 font-medium rounded-lg border-2 border-gray-200 focus:border-blue-400 focus:outline-none bg-white mb-2"
                  >
                    {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                      <option key={h} value={h * 60}>{h}h</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 6, 8].map((h) => (
                      <button
                        key={h}
                        onClick={() => setSlotForm({ ...slotForm, duration: h * 60 })}
                        className={`flex-1 py-2 text-sm rounded-lg border-2 font-medium transition-all ${
                          slotForm.duration === h * 60
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-blue-50"
                        }`}
                      >
                        {h}h
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions - responsive pour mobile */}
                <div className="flex gap-2 sm:gap-3 pt-2">
                  {editingSlot && (
                    <Button
                      onClick={() => {
                        handleDeleteSlot(editingSlot.id)
                        setEditingSlot(null)
                        setIsSlotDialogOpen(false)
                      }}
                      className="px-2 sm:px-4 bg-red-600 hover:bg-red-700 text-white"
                      title={t('common.delete')}
                    >
                      <Trash2 className="w-4 h-4 sm:mr-2" />
                      <span className="hidden sm:inline">{t('common.delete')}</span>
                    </Button>
                  )}
                  <div className="flex flex-1 gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingSlot(null)
                        setIsSlotDialogOpen(false)
                      }}
                      className="px-3 sm:px-4"
                    >
                      <span className="sm:hidden">{t('common.cancelShort') || '✕'}</span>
                      <span className="hidden sm:inline">{t('common.cancel')}</span>
                    </Button>
                    <Button onClick={handleSaveSlot} className="px-3 sm:px-4">
                      {t('common.save')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer avec informations de contact */}
      {(settings.branding?.contactEmail || settings.branding?.contactPhone || settings.branding?.address) && (
        <footer className="bg-white border-t mt-8">
          <div className="container mx-auto px-4 py-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Logo et nom */}
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white overflow-hidden"
                  style={{ 
                    backgroundColor: settings.branding?.logoUrl && settings.branding?.logoBackground === false
                      ? "transparent"
                      : (settings.branding?.primaryColor || "#3b82f6")
                  }}
                >
                  {settings.branding?.logoUrl ? (
                    <img 
                      src={settings.branding.logoUrl} 
                      alt="Logo" 
                      className="w-6 h-6 object-contain"
                    />
                  ) : (
                    <span className="text-sm">{settings.branding?.logoIcon || "🏆"}</span>
                  )}
                </div>
                <div>
                  <span className="font-semibold text-gray-900">{settings.branding?.siteName || "SportSlot"}</span>
                  {settings.branding?.siteDescription && (
                    <p className="text-xs text-gray-500">{settings.branding.siteDescription}</p>
                  )}
                </div>
              </div>

              {/* Informations de contact */}
              <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-600">
                {settings.branding?.contactPhone && (
                  <a 
                    href={`tel:${settings.branding.contactPhone}`}
                    className="flex items-center gap-1.5 hover:text-gray-900 transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    <span>{settings.branding.contactPhone}</span>
                  </a>
                )}
                {settings.branding?.contactEmail && (
                  <a 
                    href={`mailto:${settings.branding.contactEmail}`}
                    className="flex items-center gap-1.5 hover:text-gray-900 transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    <span>{settings.branding.contactEmail}</span>
                  </a>
                )}
                {settings.branding?.address && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    <span>{settings.branding.address}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </footer>
      )}

      {/* Modal Cropper - Placé à la racine pour un z-index correct */}
      {isLogoCropperOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{t('common.crop')}</h3>
              <button 
                onClick={() => {
                  setIsLogoCropperOpen(false)
                  setCropImageSrc("")
                  setCropZoom(1)
                  setCropPosition({ x: 0, y: 0 })
                  setImageNaturalSize({ width: 0, height: 0 })
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
    </div>
            
            <div className="p-4">
              {/* Zone de preview avec drag */}
              <div 
                ref={cropperRef}
                className="relative w-full aspect-square bg-gray-100 rounded-xl overflow-hidden mb-4 cursor-move select-none"
                style={{
                  backgroundImage: "linear-gradient(45deg, #d1d5db 25%, transparent 25%), linear-gradient(-45deg, #d1d5db 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d1d5db 75%), linear-gradient(-45deg, transparent 75%, #d1d5db 75%)",
                  backgroundSize: "20px 20px",
                  backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px"
                }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  setIsDragging(true)
                  setDragStart({ x: e.clientX - cropPosition.x, y: e.clientY - cropPosition.y })
                }}
                onMouseMove={(e) => {
                  if (!isDragging) return
                  setCropPosition({
                    x: e.clientX - dragStart.x,
                    y: e.clientY - dragStart.y
                  })
                }}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
                onTouchStart={(e) => {
                  const touch = e.touches[0]
                  setIsDragging(true)
                  setDragStart({ x: touch.clientX - cropPosition.x, y: touch.clientY - cropPosition.y })
                }}
                onTouchMove={(e) => {
                  if (!isDragging) return
                  const touch = e.touches[0]
                  setCropPosition({
                    x: touch.clientX - dragStart.x,
                    y: touch.clientY - dragStart.y
                  })
                }}
                onTouchEnd={() => setIsDragging(false)}
              >
                <img 
                  ref={cropImageRef}
                  src={cropImageSrc}
                  alt="Crop preview"
                  className="absolute pointer-events-none"
                  style={{
                    left: '50%',
                    top: '50%',
                    transform: `translate(calc(-50% + ${cropPosition.x}px), calc(-50% + ${cropPosition.y}px)) scale(${cropZoom})`,
                    width: 'auto',
                    height: 'auto',
                    maxWidth: '100%',
                    maxHeight: '100%'
                  }}
                  onLoad={(e) => {
                    const img = e.target as HTMLImageElement
                    setImageNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
                  }}
                  draggable={false}
                />
                {/* Cadre de découpe carré au centre */}
                <div className="absolute inset-0 pointer-events-none">
                  {/* Zone sombre autour */}
                  <div className="absolute inset-0 bg-black/40" style={{
                    clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, 25% 25%, 25% 75%, 75% 75%, 75% 25%, 25% 25%)'
                  }} />
                  {/* Bordure du cadre */}
                  <div className="absolute left-1/4 top-1/4 w-1/2 h-1/2 border-2 border-white rounded-lg shadow-lg" />
                  {/* Grille optionnelle */}
                  <div className="absolute left-1/4 top-1/4 w-1/2 h-1/2 grid grid-cols-3 grid-rows-3">
                    {[...Array(9)].map((_, i) => (
                      <div key={i} className="border border-white/30" />
                    ))}
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <p className="text-xs text-gray-500 text-center mb-3">
                🖱️ {t('admin.settings.branding.dragToPosition')} • {t('admin.settings.branding.scrollToZoom')}
              </p>

              {/* Contrôles zoom */}
              <div className="flex items-center gap-3 mb-4">
                <button 
                  onClick={() => setCropZoom(z => Math.max(0.5, z - 0.1))}
                  className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <ZoomOut className="w-4 h-4 text-gray-600" />
                </button>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.05"
                  value={cropZoom}
                  onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <button 
                  onClick={() => setCropZoom(z => Math.min(3, z + 0.1))}
                  className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <ZoomIn className="w-4 h-4 text-gray-600" />
                </button>
                <span className="text-xs text-gray-500 w-12 text-right">{Math.round(cropZoom * 100)}%</span>
              </div>

              {/* Boutons de préréglage */}
              <div className="flex flex-wrap justify-center gap-2 mb-2">
                <button 
                  onClick={() => { setCropPosition({ x: 0, y: 0 }); setCropZoom(1) }}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1.5"
                  title={t('common.resetZoom')}
                >
                  <Move className="w-3.5 h-3.5" />
                  Reset
                </button>
                <button 
                  onClick={() => setCropPosition({ x: 0, y: 0 })}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  title={t('common.center')}
                >
                  Centrer
                </button>
                <div className="h-6 w-px bg-gray-300 mx-1" />
                <button 
                  onClick={() => setCropZoom(0.5)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    cropZoom === 0.5 ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200'
                  }`}
                  title="Zoom 50%"
                >
                  50%
                </button>
                <button 
                  onClick={() => setCropZoom(1)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    cropZoom === 1 ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200'
                  }`}
                  title="Zoom 100%"
                >
                  100%
                </button>
                <button 
                  onClick={() => setCropZoom(1.5)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    cropZoom === 1.5 ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200'
                  }`}
                  title="Zoom 150%"
                >
                  150%
                </button>
                <button 
                  onClick={() => setCropZoom(2)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    cropZoom === 2 ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200'
                  }`}
                  title="Zoom 200%"
                >
                  200%
                </button>
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50 flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsLogoCropperOpen(false)
                  setCropImageSrc("")
                  setCropZoom(1)
                  setCropPosition({ x: 0, y: 0 })
                  setImageNaturalSize({ width: 0, height: 0 })
                }}
                className="flex-1"
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => {
                  // Créer un canvas pour recadrer l'image
                  const canvas = document.createElement('canvas')
                  const ctx = canvas.getContext('2d')
                  if (!ctx || !cropperRef.current) return

                  const containerSize = cropperRef.current.offsetWidth
                  const cropSize = containerSize * 0.5 // Le carré fait 50% du container
                  const outputSize = 256 // Taille de sortie en pixels

                  canvas.width = outputSize
                  canvas.height = outputSize

                  const img = new Image()
                  img.crossOrigin = "anonymous"
                  img.onload = () => {
                    // Calculer les dimensions de l'image affichée
                    const scale = Math.min(containerSize / img.naturalWidth, containerSize / img.naturalHeight)

                    // Calculer quelle partie de l'image source correspond au crop
                    const sourceScale = 1 / (scale * cropZoom)
                    const sourceCropSize = cropSize * sourceScale

                    // Centre de l'image source
                    const sourceCenterX = img.naturalWidth / 2
                    const sourceCenterY = img.naturalHeight / 2

                    // Décalage dû au drag (en coordonnées source)
                    const offsetX = -cropPosition.x * sourceScale
                    const offsetY = -cropPosition.y * sourceScale

                    // Position de découpe dans l'image source
                    const sourceX = sourceCenterX - sourceCropSize / 2 + offsetX
                    const sourceY = sourceCenterY - sourceCropSize / 2 + offsetY

                    // Dessiner l'image recadrée
                    ctx.drawImage(
                      img,
                      sourceX, sourceY, sourceCropSize, sourceCropSize,
                      0, 0, outputSize, outputSize
                    )

                    // Convertir en base64
                    const croppedImageUrl = canvas.toDataURL('image/png', 0.9)
                    
                    // Sauvegarder l'original seulement si c'est une nouvelle image
                    // (si on recadre une image existante, garder l'original précédent)
                    const originalUrl = settings.branding?.logoOriginalUrl || cropImageSrc
                    
                    const newSettings = { 
                      ...settings, 
                      branding: { 
                        ...settings.branding, 
                        logoUrl: croppedImageUrl, 
                        logoOriginalUrl: originalUrl,
                        logoBackground: true 
                      } 
                    }
                    setSettingsState(newSettings)
                    saveSettings(newSettings)
                    setIsLogoCropperOpen(false)
                    setCropImageSrc("")
                    setCropZoom(1)
                    setCropPosition({ x: 0, y: 0 })
                    setImageNaturalSize({ width: 0, height: 0 })
                  }
                  img.src = cropImageSrc
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {t('common.apply')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de détails des réservations (mode vue) */}
      {bookingDetailsModal.isOpen && bookingDetailsModal.slot && (
        <div 
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setBookingDetailsModal({ isOpen: false, slot: null, bookings: [] })}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 relative"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div 
              className="p-6 text-white relative"
              style={{ backgroundColor: settings.branding?.primaryColor || "#3b82f6" }}
            >
              <button 
                onClick={() => setBookingDetailsModal({ isOpen: false, slot: null, bookings: [] })}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">
                  <span>{getSportInfo(bookingDetailsModal.slot.sportId).icon}</span>
                </span>
                <div>
                  <h2 className="text-xl font-bold">{t('admin.agenda.bookingDetails')}</h2>
                  <p className="text-white/80 text-sm">
                    {new Date(bookingDetailsModal.slot.date).toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })}
                    {' • '}{bookingDetailsModal.slot.time}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4 text-sm">
                <div className="bg-white/20 rounded-lg px-3 py-1.5">
                  <span className="font-medium">{bookingDetailsModal.slot.currentBookings}</span>
                  <span className="text-white/80">/{bookingDetailsModal.slot.maxCapacity} {t('admin.agenda.totalBookings')}</span>
                </div>
                <div className="bg-white/20 rounded-lg px-3 py-1.5">
                  <span className="font-medium">{bookingDetailsModal.slot.maxCapacity - bookingDetailsModal.slot.currentBookings}</span>
                  <span className="text-white/80"> {t('admin.agenda.availablePlaces')}</span>
                </div>
              </div>
            </div>

            {/* Liste des réservations */}
            <div className="p-6 max-h-[400px] overflow-y-auto">
              {bookingDetailsModal.bookings.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>{t('admin.agenda.noBookings')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {bookingDetailsModal.bookings.map((booking) => {
                    const bookingSport = sports.find(s => s.id === booking.sportId)
                    return (
                      <div 
                        key={booking.id}
                        className="p-4 bg-gray-50 rounded-xl border border-gray-100"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="font-semibold text-gray-900">{booking.customerName}</div>
                            <div className="text-sm text-gray-500">{booking.customerEmail}</div>
                            {booking.customerPhone && (
                              <div className="text-sm text-gray-500 flex items-center gap-1">
                                📞 {booking.customerPhone}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div 
                              className="font-bold"
                              style={{ color: settings.branding?.primaryColor || "#3b82f6" }}
                            >
                              {booking.numberOfPeople} {t('admin.agenda.people')}
                            </div>
                            <div className="text-sm text-gray-500">{booking.totalPrice}{settings.branding?.currencySymbol || '.-'}</div>
                          </div>
                        </div>
                        {/* Sport réservé */}
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                          <span>{bookingSport?.icon || "🏃"}</span>
                          <span className="font-medium">{booking.sportName}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-gray-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {t('admin.agenda.bookedOn')} {new Date(booking.createdAt).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 px-2"
                            onClick={() => handleDeleteBooking(booking)}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            {t('admin.agenda.cancelBooking')}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <Button 
                onClick={() => setBookingDetailsModal({ isOpen: false, slot: null, bookings: [] })}
                variant="outline"
              >
                {t('common.close')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog d'export PDF - EN DEHORS des Tabs pour couvrir tout l'écran */}
      {isExportDialogOpen && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsExportDialogOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Download className="w-5 h-5" />
                {t('admin.agenda.statsPage.export.button')}
              </h3>
              <p className="text-blue-100 text-sm mt-1">{t('admin.agenda.statsPage.export.configureExport')}</p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              {/* Type d'export */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">{t('admin.agenda.statsPage.export.exportType')}</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setExportOptions({ ...exportOptions, mode: "summary" })}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      exportOptions.mode === "summary" 
                        ? "border-blue-500 bg-blue-50 text-blue-700" 
                        : "border-gray-200 hover:border-gray-300 text-gray-600"
                    }`}
                  >
                    <span className="text-2xl">📄</span>
                    <span className="text-sm font-medium">{t('admin.agenda.statsPage.export.summaryShort')}</span>
                    <span className="text-xs text-gray-500">{t('admin.agenda.statsPage.export.summaryDesc')}</span>
                  </button>
                  <button
                    onClick={() => setExportOptions({ ...exportOptions, mode: "detailed" })}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      exportOptions.mode === "detailed" 
                        ? "border-blue-500 bg-blue-50 text-blue-700" 
                        : "border-gray-200 hover:border-gray-300 text-gray-600"
                    }`}
                  >
                    <span className="text-2xl">📋</span>
                    <span className="text-sm font-medium">{t('admin.agenda.statsPage.export.detailedShort')}</span>
                    <span className="text-xs text-gray-500">{t('admin.agenda.statsPage.export.detailedDesc')}</span>
                  </button>
                </div>
              </div>

              {/* Période */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">{t('admin.agenda.statsPage.export.period')}</Label>
                <div className="space-y-2">
                  <button
                    onClick={() => setExportOptions({ ...exportOptions, period: "current" })}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                      exportOptions.period === "current" 
                        ? "border-blue-500 bg-blue-50" 
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      exportOptions.period === "current" ? "border-blue-500" : "border-gray-300"
                    }`}>
                      {exportOptions.period === "current" && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">{t('admin.agenda.statsPage.export.currentPeriod')}</p>
                      <p className="text-xs text-gray-500">
                        {(() => {
                          const periods: Record<string, string> = {
                            thisWeek: t('admin.agenda.statsPage.filters.thisWeek'),
                            lastWeek: t('admin.agenda.statsPage.filters.lastWeek'),
                            thisMonth: t('admin.agenda.statsPage.filters.thisMonth'),
                            lastMonth: t('admin.agenda.statsPage.filters.lastMonth'),
                            last30Days: t('admin.agenda.statsPage.filters.last30Days'),
                            last90Days: t('admin.agenda.statsPage.filters.last90Days'),
                            thisYear: t('admin.agenda.statsPage.filters.thisYear'),
                            custom: `${statsCustomDateStart} - ${statsCustomDateEnd}`
                          }
                          return periods[statsPeriod] || statsPeriod
                        })()}
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => setExportOptions({ ...exportOptions, period: "custom" })}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                      exportOptions.period === "custom" 
                        ? "border-blue-500 bg-blue-50" 
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      exportOptions.period === "custom" ? "border-blue-500" : "border-gray-300"
                    }`}>
                      {exportOptions.period === "custom" && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                    </div>
                    <p className="font-medium text-gray-700">{t('admin.agenda.statsPage.export.customPeriod')}</p>
                  </button>
                </div>

                {/* Dates personnalisées */}
                {exportOptions.period === "custom" && (
                  <div className="mt-3 grid grid-cols-2 gap-3 pl-7">
                    <div>
                      <Label className="text-xs text-gray-500 mb-1 block">{t('admin.agenda.statsPage.filters.from')}</Label>
                      <Input
                        type="date"
                        value={exportOptions.customStartDate}
                        onChange={(e) => setExportOptions({ ...exportOptions, customStartDate: e.target.value })}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 mb-1 block">{t('admin.agenda.statsPage.filters.to')}</Label>
                      <Input
                        type="date"
                        value={exportOptions.customEndDate}
                        onChange={(e) => setExportOptions({ ...exportOptions, customEndDate: e.target.value })}
                        className="text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Inclure le filtre sport */}
              {statsSportFilter !== "all" && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{sports.find(s => s.id === statsSportFilter)?.icon}</span>
                    <span className="text-sm text-gray-700">
                      {t('admin.agenda.statsPage.export.includeSportFilter')} "{sports.find(s => s.id === statsSportFilter)?.name}"
                    </span>
                  </div>
                  <Checkbox
                    checked={exportOptions.includeSportFilter}
                    onCheckedChange={(checked) => setExportOptions({ ...exportOptions, includeSportFilter: checked === true })}
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setIsExportDialogOpen(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => {
                  exportStatsPDF(exportOptions)
                  setIsExportDialogOpen(false)
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Download className="w-4 h-4 mr-2" />
                {t('admin.agenda.statsPage.export.generate')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Notifications de nouvelles réservations */}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        {notifications.map((notif, index) => (
          <div
            key={notif.id}
            className="pointer-events-auto bg-white rounded-xl shadow-2xl border border-green-200 p-4 min-w-[320px] max-w-[400px] animate-in slide-in-from-right duration-300"
            style={{ 
              animationDelay: `${index * 100}ms`,
              opacity: 1 - (index * 0.15)
            }}
          >
            <div className="flex items-start gap-3">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg"
                style={{ backgroundColor: settings.branding?.primaryColor || '#3b82f6' }}
              >
                🎉
              </div>
              <div className="flex-1">
                <div className="font-bold text-gray-900">{notif.message}</div>
                <div className="text-sm text-gray-600 mt-0.5">{notif.details}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {notif.timestamp.toLocaleTimeString()}
                </div>
              </div>
              <button
                onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
