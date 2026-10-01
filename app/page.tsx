"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { useDialog } from "@/components/ui/custom-dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import LanguageSwitcher from "@/components/LanguageSwitcher"
import { useRealtime } from "@/hooks/useRealtime"
import { 
  getSports, 
  getValidPublishedSlots, 
  getSettings, 
  getBookings,
  saveBookings,
  saveSlots,
  getDataVersion,
  type Sport, 
  type TimeSlot,
  type Settings,
  type Booking,
  type ClosedPeriod
} from "@/lib/storage"
import { 
  Calendar, 
  Clock, 
  Users, 
  ChevronLeft, 
  ChevronRight,
  MapPin,
  Phone,
  Mail,
  X,
  Check,
  CalendarDays,
  Sparkles
} from "lucide-react"

// Fonction pour formater l'heure selon le format configuré
const formatTimeDisplay = (time: string, timeFormat: "24h" | "12h" = "24h"): string => {
  if (timeFormat === "24h") return time
  
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
}

export default function Home() {
  const { t, i18n } = useTranslation()
  const { showAlert } = useDialog()
  const [isLoading, setIsLoading] = useState(true)
  const [sports, setSports] = useState<Sport[]>([])
  const [selectedSport, setSelectedSport] = useState<string>("all")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [settings, setSettingsState] = useState<Settings | null>(null)
  const [bookings, setBookingsState] = useState<Booking[]>([])
  
  // Modal de réservation
  const [bookingModal, setBookingModal] = useState<{
    isOpen: boolean
    slot: TimeSlot | null
    sport: Sport | null
    availableSports: Sport[]
    selectingSport: boolean
  }>({ isOpen: false, slot: null, sport: null, availableSports: [], selectingSport: false })
  
  const [bookingForm, setBookingForm] = useState({
    name: "",
    email: "",
    phone: "",
    numberOfPeople: 1
  })
  
  const [bookingSuccess, setBookingSuccess] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [dataVersion, setDataVersion] = useState(0)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [closedPeriods, setClosedPeriods] = useState<ClosedPeriod[]>([])
  const [selectedDayIndex, setSelectedDayIndex] = useState(0) // Pour mobile: jour sélectionné dans la semaine
  const [swipeStart, setSwipeStart] = useState<number | null>(null) // Pour le swipe down to close
  const [swipeOffset, setSwipeOffset] = useState(0) // Offset actuel du swipe en px
  const [weekSwipeStart, setWeekSwipeStart] = useState<number | null>(null) // Pour swipe semaine gauche/droite
  const [weekSwipeOffset, setWeekSwipeOffset] = useState(0) // Offset horizontal en px
  const [weekSwipeTransition, setWeekSwipeTransition] = useState(false) // Pour animer le retour
  const [daySwipeStart, setDaySwipeStart] = useState<{ x: number, y: number } | null>(null) // Pour swipe jour
  const [daySwipeOffset, setDaySwipeOffset] = useState(0) // Offset horizontal pour swipe jour
  const [daySwipeTransition, setDaySwipeTransition] = useState(false) // Animation swipe jour
  const [isHorizontalSwipe, setIsHorizontalSwipe] = useState(false) // Pour bloquer scroll vertical

  // Charger les données initiales (uniquement créneaux publiés pour les clients)
  const loadData = useCallback(() => {
    const allSports = getSports()
    const enabled = allSports.filter((s) => s.enabled)
    setSports(enabled)
    setSlots(getValidPublishedSlots()) // Seulement les créneaux publiés ET dans les horaires
    const loadedSettings = getSettings()
    setSettingsState(loadedSettings)
    setBookingsState(getBookings())
    setDataVersion(getDataVersion())
    // Charger uniquement les fermetures publiées
    setClosedPeriods(loadedSettings.closedPeriods.filter(p => p.published === true))
  }, [])

  // Synchronisation temps réel depuis la DB (polling toutes les 3 secondes)
  useRealtime((data) => {
    // Recharger les données depuis le localStorage (mis à jour par le hook)
    loadData()
  }, 3000)

  useEffect(() => {
    loadData()
    setIsLoading(false)
  }, [loadData])

  // Sélectionner le premier sport par défaut quand les sports sont chargés
  useEffect(() => {
    if (sports.length > 0 && selectedSport === "all") {
      setSelectedSport(sports[0].id)
    }
  }, [sports, selectedSport])

  // Sélectionner le jour d'aujourd'hui par défaut (surtout pour mobile)
  useEffect(() => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const todayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    setSelectedDayIndex(todayIndex)
  }, [])

  // Mise à jour de l'heure actuelle (pour auto-grisage des créneaux passés) et écoute des événements locaux
  useEffect(() => {
    // Mettre à jour l'heure actuelle toutes les 30 secondes
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date())
    }, 30000)

    // Écouter les changements de localStorage depuis d'autres onglets ou le hook useRealtime
    const handleStorageChange = () => {
      loadData()
    }
    
    // Écouter les événements de changements locaux (même onglet, même navigateur)
    const handleSlotsChanged = () => {
      loadData()
    }
    
    const handleSportsChanged = () => {
      loadData()
    }
    
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('slotsChanged', handleSlotsChanged)
    window.addEventListener('sportsChanged', handleSportsChanged)

    return () => {
      clearInterval(timeInterval)
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('slotsChanged', handleSlotsChanged)
      window.removeEventListener('sportsChanged', handleSportsChanged)
    }
  }, [loadData])

  // Vérifier si le créneau dans le modal est toujours disponible
  useEffect(() => {
    if (bookingModal.isOpen && bookingModal.slot && !bookingSuccess) {
      // Vérifier si le créneau est passé ou ne respecte plus le délai minimum
      const slotDateTime = new Date(`${bookingModal.slot.date}T${bookingModal.slot.time}`)
      const minAdvance = settings?.minBookingAdvance || 0
      const minBookingTime = new Date(currentTime.getTime() + minAdvance * 60 * 1000)
      
      if (slotDateTime < currentTime || slotDateTime < minBookingTime) {
        // Fermer le modal avec un message
        setBookingModal({ isOpen: false, slot: null, sport: null, availableSports: [], selectingSport: false })
        showAlert(t('home.slot.tooLate'), { variant: 'warning' })
      }
    }
  }, [currentTime, bookingModal.isOpen, bookingModal.slot, settings?.minBookingAdvance, bookingSuccess, showAlert, t])

  // Bloquer le scroll du body quand le modal est ouvert
  useEffect(() => {
    if (bookingModal.isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [bookingModal.isOpen])

  // Branding
  const branding = settings?.branding
  const primaryColor = branding?.primaryColor || "#3b82f6"
  const effectiveColor = primaryColor
  const showLogoBackground = branding?.logoUrl ? (branding?.logoBackground !== false) : true

  // Calculer les heures d'ouverture min/max depuis les paramètres
  const { minHour, maxHour, hoursArray } = useMemo(() => {
    const workingHours = settings?.workingHours || []
    const enabledHours = workingHours.filter(wh => wh.enabled)
    
    if (enabledHours.length === 0) {
      // Valeurs par défaut si aucun horaire configuré
      return { 
        minHour: 9, 
        maxHour: 18, 
        hoursArray: Array.from({ length: 10 }, (_, i) => i + 9) 
      }
    }
    
    // Trouver l'heure d'ouverture la plus tôt
    const minTime = Math.min(...enabledHours.map(wh => {
      const [h] = wh.startTime.split(':').map(Number)
      return h
    }))
    
    // Trouver l'heure de fermeture la plus tard
    const maxTime = Math.max(...enabledHours.map(wh => {
      const [h, m] = wh.endTime.split(':').map(Number)
      // Si minutes > 0, arrondir à l'heure suivante
      return m > 0 ? h + 1 : h
    }))
    
    // Créer le tableau d'heures
    const hours = Array.from({ length: maxTime - minTime }, (_, i) => i + minTime)
    
    return { minHour: minTime, maxHour: maxTime, hoursArray: hours }
  }, [settings?.workingHours])

  // Filtrer les créneaux par sport et par semaine visible
  const getWeekDates = () => {
    const dates: Date[] = []
    const start = new Date(currentDate)
    const day = start.getDay()
    const diff = start.getDate() - day + (day === 0 ? -6 : 1)
    start.setDate(diff)
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(start)
      date.setDate(start.getDate() + i)
      dates.push(date)
    }
    return dates
  }

  const weekDates = getWeekDates()

  const formatDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  // Filtrer les créneaux de la semaine (inclure les passés)
  const filteredSlots = useMemo(() => {
    const weekStart = formatDate(weekDates[0])
    const weekEnd = formatDate(weekDates[6])
    
    return slots.filter(slot => {
      // Filtrer par date (dans la semaine visible)
      if (slot.date < weekStart || slot.date > weekEnd) return false
      
      // Filtrer par sport
      if (selectedSport !== "all") {
        if (slot.sportId !== selectedSport) return false
      }
      
      return true
    })
  }, [slots, selectedSport, weekDates])

  // Vérifier si un créneau est passé ou si le délai minimum n'est pas respecté
  const isSlotPassed = (slot: TimeSlot): boolean => {
    const slotDateTime = new Date(`${slot.date}T${slot.time}`)
    return slotDateTime < currentTime
  }

  // Vérifier si un jour de la semaine est un jour non travaillé
  const isDayDisabled = (date: Date): boolean => {
    const workingHours = settings?.workingHours || []
    const dayOfWeek = date.getDay() // 0=dimanche, 1=lundi, ..., 6=samedi
    
    // Trouver la config pour ce jour par dayOfWeek (pas par index de tableau)
    const dayConfig = workingHours.find(wh => wh.dayOfWeek === dayOfWeek)
    return dayConfig ? !dayConfig.enabled : false
  }

  // Vérifier si une date est dans une période de fermeture
  const getClosureForDate = (date: Date): ClosedPeriod | null => {
    const dateStr = formatDate(date)
    return closedPeriods.find(period => {
      return dateStr >= period.startDate && dateStr <= period.endDate
    }) || null
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

  // Vérifier si un créneau peut être réservé (délai minimum respecté)
  const canBookSlot = (slot: TimeSlot): boolean => {
    if (isSlotPassed(slot)) return false
    
    const minAdvance = settings?.minBookingAdvance || 0
    if (minAdvance <= 0) return true
    
    const slotDateTime = new Date(`${slot.date}T${slot.time}`)
    const minBookingTime = new Date(currentTime.getTime() + minAdvance * 60 * 1000)
    
    return slotDateTime >= minBookingTime
  }

  // Statistiques (uniquement les créneaux futurs disponibles)
  const stats = useMemo(() => {
    const futureSlots = filteredSlots.filter(s => !isSlotPassed(s))
    const available = futureSlots.filter(s => s.maxCapacity > s.currentBookings).length
    const totalPlaces = futureSlots.reduce((acc, s) => acc + (s.maxCapacity - s.currentBookings), 0)
    return { available, totalPlaces }
  }, [filteredSlots])

  const handlePrevWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() - 7)
    setCurrentDate(newDate)
  }

  const handleNextWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + 7)
    setCurrentDate(newDate)
  }

  const handleToday = () => {
    setCurrentDate(new Date())
    // Trouver l'index du jour actuel dans la semaine
    const today = new Date()
    const dayOfWeek = today.getDay()
    // L'index est basé sur lundi=0, mais getDay() retourne dimanche=0
    // Semaine commence lundi, donc lundi=0, mardi=1, ..., dimanche=6
    const todayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    setSelectedDayIndex(todayIndex)
  }

  const getSlotsForDate = (date: Date) => {
    const dateStr = formatDate(date)
    return filteredSlots
      .filter(s => s.date === dateStr)
      .sort((a, b) => a.time.localeCompare(b.time))
  }

  const dayNames = [
    t('home.days.sun'), t('home.days.mon'), t('home.days.tue'), 
    t('home.days.wed'), t('home.days.thu'), t('home.days.fri'), t('home.days.sat')
  ]
  const fullDayNames = [
    t('home.days.sunday'), t('home.days.monday'), t('home.days.tuesday'), 
    t('home.days.wednesday'), t('home.days.thursday'), t('home.days.friday'), t('home.days.saturday')
  ]
  const monthNames = [
    t('home.months.january'), t('home.months.february'), t('home.months.march'),
    t('home.months.april'), t('home.months.may'), t('home.months.june'),
    t('home.months.july'), t('home.months.august'), t('home.months.september'),
    t('home.months.october'), t('home.months.november'), t('home.months.december')
  ]

  const getWeekLabel = () => {
    const start = weekDates[0]
    const end = weekDates[6]
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} - ${end.getDate()} ${monthNames[start.getMonth()]} ${start.getFullYear()}`
    }
    return `${start.getDate()} ${monthNames[start.getMonth()]} - ${end.getDate()} ${monthNames[end.getMonth()]} ${end.getFullYear()}`
  }

  const openBookingModal = (slot: TimeSlot) => {
    // Chaque créneau a maintenant un seul sport
    const sport = sports.find(s => s.id === slot.sportId)
    const availableSports = sport ? [sport] : []
    
    // Le sport est déjà déterminé par le créneau
    const filteredSport = sport || null
    
    if (filteredSport) {
      // Sport filtré disponible - le présélectionner
      setBookingModal({ 
        isOpen: true, 
        slot, 
        sport: filteredSport, 
        availableSports,
        selectingSport: false 
      })
    } else if (availableSports.length > 1) {
      // Plusieurs sports disponibles, demander au client de choisir
      setBookingModal({ 
        isOpen: true, 
        slot, 
        sport: null, 
        availableSports,
        selectingSport: true 
      })
    } else {
      // Un seul sport ou aucun
      const sport = availableSports[0] || sports[0]
      setBookingModal({ 
        isOpen: true, 
        slot, 
        sport, 
        availableSports,
        selectingSport: false 
      })
    }
    // Garder nom/email/téléphone, reset uniquement le nombre de personnes
    setBookingForm(prev => ({ ...prev, numberOfPeople: 1 }))
    setBookingSuccess(false)
  }

  const selectSportForBooking = (sport: Sport) => {
    setBookingModal(prev => ({ 
      ...prev, 
      sport, 
      selectingSport: false 
    }))
  }

  const handleBooking = async () => {
    if (!bookingModal.slot || !bookingForm.name || !bookingForm.email || !bookingForm.phone) return
    
    const slot = bookingModal.slot
    const sport = bookingModal.sport
    const currentSettings = getSettings()
    const storageMode = localStorage.getItem('sportslot_storage_mode')
    
    let newBooking: Booking
    
    // En mode database, utiliser l'API serveur pour une réservation atomique
    if (storageMode === 'local' || storageMode === 'external') {
      try {
        const response = await fetch('/api/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slotId: slot.id,
            customerName: bookingForm.name,
            customerEmail: bookingForm.email,
            customerPhone: bookingForm.phone,
            numberOfPeople: bookingForm.numberOfPeople,
            sportId: sport?.id || '',
            sportName: sport?.name || 'Sport'
          })
        })
        
        const result = await response.json()
        
        if (!result.success) {
          // Fermer le modal de réservation d'abord
          setBookingModal({ isOpen: false, slot: null, sport: null, availableSports: [], selectingSport: false })
          
          // Traduire les codes d'erreur
          let errorMessage = t('booking.error')
          if (result.errorCode === 'SLOT_NOT_FOUND') {
            errorMessage = t('booking.errorMessages.slotNotFound')
          } else if (result.errorCode === 'NOT_ENOUGH_PLACES') {
            errorMessage = t('booking.errorMessages.notEnoughPlaces', { count: result.availablePlaces || 0 })
          } else if (result.errorCode === 'RACE_CONDITION') {
            errorMessage = t('booking.errorMessages.raceCondition')
          } else if (result.error) {
            errorMessage = result.error
          }
          
          // Puis afficher la popup d'erreur
          setBookingError(errorMessage)
          // Recharger les données pour avoir l'état actuel
          loadData()
          return
        }
        
        newBooking = result.booking
        
        // Mettre à jour l'état local avec les données du serveur
        setBookingsState(prev => [...prev, newBooking])
        setSlots(prev => prev.map(s => 
          s.id === slot.id 
            ? { ...s, currentBookings: result.updatedSlot.currentBookings }
            : s
        ))
        
        // Mettre à jour localStorage pour cohérence
        const updatedBookings = [...bookings, newBooking]
        localStorage.setItem('sportslot_bookings', JSON.stringify(updatedBookings))
        const updatedSlots = slots.map(s => 
          s.id === slot.id 
            ? { ...s, currentBookings: result.updatedSlot.currentBookings }
            : s
        )
        localStorage.setItem('sportslot_slots', JSON.stringify(updatedSlots))
        
      } catch (error) {
        // Fermer le modal de réservation d'abord
        setBookingModal({ isOpen: false, slot: null, sport: null, availableSports: [], selectingSport: false })
        // Puis afficher la popup d'erreur
        setBookingError(t('booking.error'))
        return
      }
    } else {
      // Mode browser : réservation locale (moins sécurisé)
      newBooking = {
        id: `booking-${Date.now()}`,
        slotId: slot.id,
        customerName: bookingForm.name,
        customerEmail: bookingForm.email,
        customerPhone: bookingForm.phone,
        numberOfPeople: bookingForm.numberOfPeople,
        totalPrice: slot.price * bookingForm.numberOfPeople,
        sportId: sport?.id || "",
        sportName: sport?.name || "Sport",
        date: slot.date,
        time: slot.time,
        createdAt: new Date().toISOString()
      }
      
      // Sauvegarder localement
      const updatedBookings = [...bookings, newBooking]
      saveBookings(updatedBookings)
      setBookingsState(updatedBookings)
      
      const updatedSlots = slots.map(s => {
        if (s.id === slot.id) {
          return { ...s, currentBookings: s.currentBookings + bookingForm.numberOfPeople }
        }
        return s
      })
      saveSlots(updatedSlots)
      setSlots(updatedSlots)
    }
    
    setBookingSuccess(true)
    
    // Envoyer les emails si SMTP configuré
    const smtp = currentSettings.smtp
    if (smtp?.enabled && smtp?.host && smtp?.user && smtp?.password) {
      const siteName = currentSettings.branding?.siteName || 'SportSlot'
      const currency = currentSettings.branding?.currencySymbol || '.-'
      const formattedDate = new Date(slot.date).toLocaleDateString(i18n.language, { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long',
        year: 'numeric'
      })
      
      const smtpSettings = {
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        user: smtp.user,
        password: smtp.password,
        fromEmail: smtp.fromEmail,
        fromName: smtp.fromName || siteName
      }
      
      // Email de confirmation au client
      const primaryColor = currentSettings.branding?.primaryColor || '#3b82f6'
      const logoUrl = currentSettings.branding?.logoUrl || ''
      const logoIcon = currentSettings.branding?.logoIcon || '🏆'
      
      if (smtp.sendConfirmationToClient) {
        try {
          await fetch('/api/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: bookingForm.email,
              subject: `✅ ${t('booking.success.title')} - ${siteName}`,
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
                        <td style="width: 70px; height: 70px; background: rgba(255,255,255,0.2); border-radius: 16px; text-align: center; vertical-align: middle;">
                          ${logoUrl ? `<img src="cid:logo" alt="Logo" width="45" height="45" style="display: block; margin: 12px auto; object-fit: contain;">` : `<span style="font-size: 36px; line-height: 70px;">${logoIcon}</span>`}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="color: white; font-size: 28px; font-weight: 700; padding-bottom: 10px;">
                    ${t('booking.success.title')}
                  </td>
                </tr>
                <tr>
                  <td style="color: rgba(255,255,255,0.9); font-size: 16px;">
                    ${t('booking.success.message')}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="background: white; padding: 30px; border-radius: 0 0 16px 16px;">
              <!-- Sport Badge -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 25px;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0" style="background: ${primaryColor}15; padding: 12px 24px; border-radius: 50px;">
                      <tr>
                        <td style="color: ${primaryColor}; font-size: 18px; font-weight: 600;">
                          ${sport?.icon || '🏃'} ${newBooking.sportName}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Booking Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">📅 ${t('booking.summary.date')}</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; text-align: right; color: #1e293b; font-size: 15px; font-weight: 600;">${formattedDate}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">🕐 ${t('booking.summary.time')}</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; text-align: right; color: #1e293b; font-size: 15px; font-weight: 600;">${formatTimeDisplay(slot.time, settings?.branding?.timeFormat || "24h")}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">⏱️ ${t('booking.summary.duration')}</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; text-align: right; color: #1e293b; font-size: 15px; font-weight: 600;">${slot.duration / 60}h</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; color: #64748b; font-size: 14px;">👥 ${t('booking.summary.people')}</td>
                        <td style="padding: 12px 0; text-align: right; color: #1e293b; font-size: 15px; font-weight: 600;">${newBooking.numberOfPeople} ${newBooking.numberOfPeople > 1 ? t('home.slot.people') : t('home.slot.person')}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Total -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: ${primaryColor}10; border: 2px solid ${primaryColor}30; border-radius: 12px;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <span style="color: #64748b; font-size: 14px; display: block; margin-bottom: 5px;">${t('booking.summary.total')}</span>
                    <span style="color: ${primaryColor}; font-size: 32px; font-weight: 700;">${newBooking.totalPrice} ${currency}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="text-align: center; padding: 30px 20px;">
              <p style="color: #1e293b; font-size: 14px; font-weight: 600; margin: 0 0 15px 0;">${siteName}</p>
              ${currentSettings.branding?.contactPhone ? `<p style="color: #64748b; font-size: 13px; margin: 0 0 5px 0;">📞 ${currentSettings.branding.contactPhone}</p>` : ''}
              ${currentSettings.branding?.contactEmail ? `<p style="color: #64748b; font-size: 13px; margin: 0 0 5px 0;">✉️ ${currentSettings.branding.contactEmail}</p>` : ''}
              ${currentSettings.branding?.address ? `<p style="color: #64748b; font-size: 13px; margin: 0;">📍 ${currentSettings.branding.address}</p>` : ''}
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
              smtpSettings
            })
          })
        } catch (error) {
          // Erreur silencieuse - l'email n'est pas critique
        }
      }
      
      // Notification à l'équipe
      if (smtp.notifyTeamOnBooking && smtp.teamEmails && smtp.teamEmails.length > 0) {
        try {
          for (const teamEmail of smtp.teamEmails) {
            await fetch('/api/email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: teamEmail.trim(),
                subject: `🆕 New Booking - ${newBooking.customerName} - ${newBooking.sportName}`,
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
            <td style="background: #10b981; border-radius: 16px 16px 0 0; padding: 30px; text-align: center;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom: 15px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 50%; text-align: center; vertical-align: middle;">
                          <span style="font-size: 30px; line-height: 60px;">🎉</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="color: white; font-size: 24px; font-weight: 700;">
                    New Booking!
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="background: white; padding: 30px; border-radius: 0 0 16px 16px;">
              <!-- Client Info -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f0fdf4; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid #10b981;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #166534; font-size: 16px; font-weight: 600; padding-bottom: 15px;">👤 Client Information</td>
                      </tr>
                    </table>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Name</td>
                        <td style="padding: 6px 0; text-align: right; color: #1e293b; font-weight: 600;">${newBooking.customerName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Email</td>
                        <td style="padding: 6px 0; text-align: right;">
                          <a href="mailto:${newBooking.customerEmail}" style="color: ${primaryColor}; text-decoration: none;">${newBooking.customerEmail}</a>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Phone</td>
                        <td style="padding: 6px 0; text-align: right;">
                          <a href="tel:${newBooking.customerPhone}" style="color: ${primaryColor}; text-decoration: none;">${newBooking.customerPhone}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Booking Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; border-radius: 12px; border-left: 4px solid ${primaryColor};">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #1e293b; font-size: 16px; font-weight: 600; padding-bottom: 15px;">📋 ${t('booking.summary.details')}</td>
                      </tr>
                    </table>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">${t('booking.summary.sport')}</td>
                        <td style="padding: 8px 0; text-align: right; color: #1e293b; font-weight: 600;">${sport?.icon || '🏃'} ${newBooking.sportName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">${t('booking.summary.date')}</td>
                        <td style="padding: 8px 0; text-align: right; color: #1e293b; font-weight: 600;">${formattedDate}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">${t('booking.summary.time')}</td>
                        <td style="padding: 8px 0; text-align: right; color: #1e293b; font-weight: 600;">${formatTimeDisplay(slot.time, settings?.branding?.timeFormat || "24h")}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">${t('booking.summary.duration')}</td>
                        <td style="padding: 8px 0; text-align: right; color: #1e293b; font-weight: 600;">${slot.duration / 60}h</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">${t('booking.summary.people')}</td>
                        <td style="padding: 8px 0; text-align: right; color: #1e293b; font-weight: 600;">${newBooking.numberOfPeople}</td>
                      </tr>
                    </table>
                    
                    <!-- Total -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 20px; padding-top: 15px; border-top: 2px dashed #e2e8f0;">
                      <tr>
                        <td width="50%" style="color: #64748b; font-size: 14px; vertical-align: middle;">${t('booking.summary.total')}</td>
                        <td width="50%" style="text-align: right; vertical-align: middle;">
                          <span style="color: #10b981; font-size: 24px; font-weight: 700;">${newBooking.totalPrice} ${currency}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="text-align: center; padding: 25px 20px;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                ${t('booking.email.automaticFrom')} ${siteName}
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
                smtpSettings
              })
            })
          }
        } catch (error) {
          // Erreur silencieuse - l'email n'est pas critique
        }
      }
    }
  }

  const closeBookingModal = () => {
    // Reset le formulaire uniquement après un succès (pour permettre de réessayer si erreur/annulation)
    if (bookingSuccess) {
      setBookingForm({ name: "", email: "", phone: "", numberOfPeople: 1 })
    }
    setBookingModal({ isOpen: false, slot: null, sport: null, availableSports: [], selectingSport: false })
    setBookingSuccess(false)
  }

  const getSportForSlot = (slot: TimeSlot) => {
    const sport = sports.find(s => s.id === slot.sportId)
    return sport ? [sport] : []
  }

  // Écran de chargement
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-200 animate-pulse" />
          <div className="h-6 w-32 mx-auto bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
                <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg overflow-hidden"
                style={{ 
                  backgroundColor: showLogoBackground ? effectiveColor : "transparent",
                  boxShadow: showLogoBackground ? undefined : "none"
                }}
                >
                  {branding?.logoUrl ? (
                    <img src={branding.logoUrl} alt="Logo" className="w-7 h-7 object-contain" />
                  ) : (
                    <span className="text-xl">{branding?.logoIcon || "🏆"}</span>
                  )}
                </div>
              <div>
                <span className="font-bold text-xl text-gray-900">
                  {branding?.siteName || "SportSlot"}
                </span>
                {branding?.siteDescription && (
                  <p className="text-xs text-gray-500 hidden sm:block">{branding.siteDescription}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LanguageSwitcher variant="compact" />
            <Link href="/admin/login">
              <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
                  {t('nav.admin')}
              </Button>
            </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section 
        className="relative py-8 sm:py-16 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${effectiveColor}15 0%, ${effectiveColor}05 100%)`
        }}
      >
        <div 
          className="absolute inset-0 opacity-20 hidden sm:block"
          style={{
            backgroundImage: `radial-gradient(${effectiveColor}30 1px, transparent 1px)`,
            backgroundSize: "24px 24px"
          }}
        />
        <div className="container mx-auto px-4 relative">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/80 backdrop-blur text-xs sm:text-sm font-medium mb-4 sm:mb-6 shadow-sm"
              style={{ color: effectiveColor }}
            >
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {t('home.hero.badge')}
            </div>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-2 sm:mb-4 px-2">
              {t('home.hero.title')}
            </h1>
            <p className="text-base sm:text-xl text-gray-600 mb-4 sm:mb-8 px-4">
              {t('home.hero.subtitle')}
            </p>
            
            {/* Stats rapides */}
            <div className="flex items-center justify-center gap-3 sm:gap-6 flex-wrap">
              <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white rounded-lg sm:rounded-xl shadow-sm">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: effectiveColor }} />
                <span className="font-semibold text-gray-900 text-sm sm:text-base">{stats.available}</span>
                <span className="text-gray-500 text-xs sm:text-sm">{t('home.stats.availableSlots')}</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white rounded-lg sm:rounded-xl shadow-sm">
                <Users className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: effectiveColor }} />
                <span className="font-semibold text-gray-900 text-sm sm:text-base">{stats.totalPlaces}</span>
                <span className="text-gray-500 text-xs sm:text-sm">{t('home.slot.places')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Sport Filter */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">{t('home.filters.title')}</h2>
          <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap scrollbar-hide">
            {sports.map((sport) => (
              <button
                key={sport.id}
                onClick={() => setSelectedSport(sport.id)}
                className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl font-medium transition-all flex items-center gap-2 whitespace-nowrap flex-shrink-0 ${
                  selectedSport === sport.id
                    ? "text-white shadow-lg"
                    : "bg-white text-gray-700 border-2 border-gray-200 hover:border-gray-300"
                }`}
                style={selectedSport === sport.id ? { backgroundColor: effectiveColor } : {}}
              >
                <span className="text-lg sm:text-xl">{sport.icon}</span>
                <span className="text-sm sm:text-base">{sport.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Calendar Navigation */}
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm border">
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleToday}
              className="rounded-lg sm:rounded-xl text-xs sm:text-sm"
            >
              {t('home.stats.todaySlots')}
            </Button>
            <div className="flex items-center bg-gray-100 rounded-lg sm:rounded-xl p-0.5 sm:p-1">
              <Button variant="ghost" size="icon" onClick={handlePrevWeek} className="rounded-md sm:rounded-lg h-8 w-8 sm:h-10 sm:w-10">
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleNextWeek} className="rounded-md sm:rounded-lg h-8 w-8 sm:h-10 sm:w-10">
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </div>
          </div>
          <h2 className="text-sm sm:text-lg font-bold text-gray-900 text-center">{getWeekLabel()}</h2>
        </div>

        {/* Bandeau sport sélectionné - bien visible */}
        {(() => {
          const currentSport = sports.find(s => s.id === selectedSport)
          if (!currentSport) return null
          return (
            <div 
              className="mb-4 p-3 sm:p-4 rounded-xl flex items-center justify-center gap-3 shadow-sm"
              style={{ backgroundColor: `${effectiveColor}15`, borderLeft: `4px solid ${effectiveColor}` }}
            >
              <span className="text-2xl sm:text-3xl">{currentSport.icon}</span>
              <p className="text-lg sm:text-xl font-bold" style={{ color: effectiveColor }}>{currentSport.name}</p>
            </div>
          )
        })()}

        {/* Mobile Day Selector - swipe gauche/droite pour changer de SEMAINE */}
        <div 
          className="mb-3 md:hidden overflow-hidden"
          style={{ touchAction: isHorizontalSwipe ? 'none' : 'pan-y' }}
          onTouchStart={(e) => {
            const touch = e.touches[0]
            setWeekSwipeStart(touch.clientX)
            setWeekSwipeTransition(false)
          }}
          onTouchMove={(e) => {
            if (weekSwipeStart === null) return
            const currentX = e.touches[0].clientX
            const diff = currentX - weekSwipeStart
            
            // Dès qu'on détecte un mouvement horizontal significatif, on bloque
            if (Math.abs(diff) > 8) {
              setIsHorizontalSwipe(true)
              e.preventDefault()
              e.stopPropagation()
              const limitedDiff = Math.sign(diff) * Math.min(Math.abs(diff) * 0.6, 150)
              setWeekSwipeOffset(limitedDiff)
            }
          }}
          onTouchEnd={() => {
            if (weekSwipeStart === null) return
            
            const threshold = 60
            setWeekSwipeTransition(true)
            
            if (weekSwipeOffset > threshold) {
              setWeekSwipeOffset(300)
              setTimeout(() => {
                handlePrevWeek()
                setWeekSwipeOffset(0)
                setWeekSwipeTransition(false)
              }, 200)
            } else if (weekSwipeOffset < -threshold) {
              setWeekSwipeOffset(-300)
              setTimeout(() => {
                handleNextWeek()
                setWeekSwipeOffset(0)
                setWeekSwipeTransition(false)
              }, 200)
            } else {
              setWeekSwipeOffset(0)
            }
            
            setWeekSwipeStart(null)
            setIsHorizontalSwipe(false)
          }}
        >
          <div 
            className="grid grid-cols-7 gap-1 px-1"
            style={{
              transform: `translateX(${weekSwipeOffset}px)`,
              transition: weekSwipeTransition ? 'transform 0.2s ease-out' : 'none',
              opacity: 1 - Math.abs(weekSwipeOffset) / 400,
            }}
          >
            {weekDates.map((date, idx) => {
              const isToday = formatDate(date) === formatDate(new Date())
              const isSelected = idx === selectedDayIndex
              const daySlots = getSlotsForDate(date)
              const futureSlots = daySlots.filter(s => !isSlotPassed(s))
              const availableSlots = futureSlots.filter(s => s.maxCapacity > s.currentBookings && canBookSlot(s))
              const closure = getClosureForDate(date)
              const dayDisabled = isDayDisabled(date)
              const isUnavailable = closure !== null || dayDisabled
              
              // Déterminer si le jour est passé
              const today = new Date()
              today.setHours(0, 0, 0, 0)
              const dateCompare = new Date(date)
              dateCompare.setHours(0, 0, 0, 0)
              const isPastDay = dateCompare < today
              
              // Déterminer le style du jour
              const getDayStyle = () => {
                if (isSelected) {
                  return { backgroundColor: effectiveColor, color: 'white' }
                }
                if (isPastDay) {
                  return { backgroundColor: '#f3f4f6', color: '#9ca3af' } // Gris pâle
                }
                if (isUnavailable) {
                  return { backgroundColor: '#f3f4f6', color: '#9ca3af' } // Gris pâle
                }
                if (availableSlots.length > 0) {
                  return { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', color: '#047857' } // Vert pâle
                }
                if (futureSlots.length > 0 && availableSlots.length === 0) {
                  return { backgroundColor: '#fff7ed', borderColor: '#fed7aa', color: '#c2410c' } // Orange pâle (plein)
                }
                return { backgroundColor: 'white', borderColor: '#e5e7eb', color: '#374151' }
              }
              
              const style = getDayStyle()
              
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDayIndex(idx)}
                  className={`py-1.5 rounded-lg text-center transition-all border ${
                    isSelected ? 'shadow-md border-transparent' : ''
                  } ${isPastDay && !isSelected ? 'opacity-60' : ''}`}
                  style={{
                    backgroundColor: style.backgroundColor,
                    borderColor: style.borderColor || 'transparent',
                    color: style.color
                  }}
                >
                  <div className="text-[9px] font-medium uppercase leading-tight opacity-70">{dayNames[date.getDay()].slice(0, 2)}</div>
                  <div className={`text-sm font-bold leading-tight ${isToday && !isSelected ? 'underline' : ''}`}>
                    {date.getDate()}
                  </div>
                  <div className="text-[8px] leading-tight opacity-70">
                    {isUnavailable || isPastDay ? '—' : availableSlots.length > 0 ? availableSlots.length : futureSlots.length > 0 ? '✗' : '·'}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Calendar Grid - Vue Agenda */}
        {sports.length === 0 ? (
          <Card className="p-8 sm:p-12 text-center bg-white rounded-xl sm:rounded-2xl">
            <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">🏆</div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">{t('home.calendar.noSlots')}</h3>
            <p className="text-sm sm:text-base text-gray-500">{t('home.calendar.selectSport')}</p>
          </Card>
        ) : (
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border overflow-hidden">
            {/* Header des jours - DESKTOP ONLY avec indicateurs de disponibilité */}
            <div className="hidden md:grid grid-cols-[60px_repeat(7,1fr)] border-b">
              {/* Colonne vide pour les heures */}
              <div className="p-2 border-r bg-gray-50" />
              {weekDates.map((date, idx) => {
                const isToday = formatDate(date) === formatDate(new Date())
                const daySlots = getSlotsForDate(date)
                const futureSlots = daySlots.filter(s => !isSlotPassed(s))
                const availableSlots = futureSlots.filter(s => s.maxCapacity > s.currentBookings && canBookSlot(s))
                const closure = getClosureForDate(date)
                const isClosed = closure !== null
                const dayDisabled = isDayDisabled(date)
                const isUnavailable = isClosed || dayDisabled
                
                // Vérifier si le jour est passé
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const dateCompare = new Date(date)
                dateCompare.setHours(0, 0, 0, 0)
                const isPastDay = dateCompare < today
                
                // Déterminer le style du header
                const getHeaderStyle = () => {
                  if (isPastDay) return { bg: 'bg-gray-100', text: 'text-gray-400' }
                  if (isUnavailable) return { bg: 'bg-gray-100', text: 'text-gray-400' }
                  if (isToday) return { bg: 'bg-blue-50', text: 'text-blue-600' }
                  if (availableSlots.length > 0) return { bg: 'bg-emerald-50', text: 'text-emerald-700' }
                  if (futureSlots.length > 0 && availableSlots.length === 0) return { bg: 'bg-amber-50', text: 'text-amber-700' }
                  return { bg: 'bg-gray-50', text: 'text-gray-500' }
                }
                
                const headerStyle = getHeaderStyle()
                
                return (
                  <div 
                    key={idx} 
                    className={`p-3 text-center border-r last:border-r-0 ${headerStyle.bg} ${isPastDay ? 'opacity-60' : ''}`}
                  >
                    <div className={`text-xs font-medium uppercase tracking-wide ${headerStyle.text}`}>
                      {dayNames[date.getDay()]}
                    </div>
                    <div 
                      className={`text-2xl font-bold mt-1 ${isToday ? '' : headerStyle.text}`}
                      style={isToday && !isPastDay ? { color: effectiveColor } : {}}
                    >
                      {date.getDate()}
                    </div>
                    {isClosed ? (
                      <div className="text-xs text-gray-400 font-medium mt-1">
                        {getClosureReasonText(closure.reason)}
                    </div>
                    ) : dayDisabled || isPastDay ? (
                      <div className="text-xs text-gray-400 font-medium mt-1">
                        —
                      </div>
                    ) : (
                      <div className={`text-xs mt-1 font-medium ${
                        availableSlots.length > 0 ? 'text-emerald-600' : 
                        futureSlots.length > 0 ? 'text-amber-600' : 'text-gray-400'
                      }`}>
                        {availableSlots.length > 0 
                          ? `${availableSlots.length} ${t('home.stats.availableSlots')}`
                          : futureSlots.length > 0 
                            ? t('home.slot.full')
                            : '—'
                        }
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Grille horaire avec créneaux - DESKTOP */}
            <div className="hidden md:grid grid-cols-[60px_repeat(7,1fr)] relative" style={{ minHeight: `${hoursArray.length * 80}px` }}>
              {/* Colonne des heures */}
              <div className="border-r bg-gray-50/50">
                {hoursArray.map(hour => (
                  <div 
                    key={hour} 
                    className="h-[80px] border-b flex items-start justify-end pr-2 pt-1"
                  >
                    <span className="text-xs font-medium text-gray-400">
                      {formatTimeDisplay(`${String(hour).padStart(2, '0')}:00`, settings?.branding?.timeFormat || "24h")}
                    </span>
                  </div>
                ))}
              </div>

              {/* Colonnes des jours avec créneaux */}
              {weekDates.map((date, dayIdx) => {
                const daySlots = getSlotsForDate(date)
                const isToday = formatDate(date) === formatDate(new Date())
                const closure = getClosureForDate(date)
                const isClosed = closure !== null
                const dayDisabled = isDayDisabled(date)
                const isUnavailable = isClosed || dayDisabled
                
                return (
                  <div 
                    key={dayIdx} 
                    className={`border-r last:border-r-0 relative ${isToday && !isUnavailable ? 'bg-blue-50/20' : ''}`}
                    style={isUnavailable ? {
                      background: `repeating-linear-gradient(
                        -45deg,
                        #f9fafb,
                        #f9fafb 10px,
                        #f3f4f6 10px,
                        #f3f4f6 20px
                      )`
                    } : {}}
                  >
                    {/* Indicateur de fermeture (discret) */}
                    {isClosed && (
                      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
                        <div className="bg-white/90 rounded px-2 py-0.5 shadow-sm border border-gray-200 text-center">
                          <div className="text-gray-500 font-medium text-[10px] truncate max-w-[80px]">
                            {getClosureReasonText(closure.reason)}
                      </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Lignes de grille pour les heures */}
                    {hoursArray.map(hour => (
                      <div 
                        key={hour} 
                        className="h-[80px] border-b border-dashed border-gray-100"
                      />
                    ))}
                    
                    {/* Créneaux positionnés */}
                    <div className="absolute inset-0 p-1">
                      {daySlots.map((slot, slotIndex) => {
                        const [slotHour, slotMin] = slot.time.split(':').map(Number)
                        const startMinutes = (slotHour - minHour) * 60 + slotMin
                        const top = (startMinutes / 60) * 80 + 2 // 80px par heure + petit offset
                        const slotHeight = (slot.duration / 60) * 80
                        const height = Math.max(slotHeight - 4, 60) // -4px pour l'espacement, min 60px
                        
                        // Calculer position horizontale pour créneaux au même horaire
                        const sameTimeSlots = daySlots.filter(s => s.time === slot.time)
                        const sameTimeIndex = sameTimeSlots.findIndex(s => s.id === slot.id)
                        const sameTimeCount = sameTimeSlots.length
                        const widthPercent = sameTimeCount > 1 ? 100 / sameTimeCount : 100
                        const leftPercent = sameTimeCount > 1 ? sameTimeIndex * widthPercent : 0
                        
                        const isPassed = isSlotPassed(slot)
                        const canBook = canBookSlot(slot)
                        const availability = slot.maxCapacity - slot.currentBookings
                        const isAvailable = availability > 0 && canBook
                        const slotSports = getSportForSlot(slot)
                        
                        // Calculer l'heure de fin
                        const endMinutes = slotHour * 60 + slotMin + slot.duration
                        const endHour = Math.floor(endMinutes / 60)
                        const endMin = endMinutes % 60
                        const endTimeRaw = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`
                        const timeFormat = settings?.branding?.timeFormat || "24h"
                        const startTimeFormatted = formatTimeDisplay(slot.time, timeFormat)
                        const endTime = formatTimeDisplay(endTimeRaw, timeFormat)
                        
                        // Raison d'indisponibilité
                        const getUnavailableReason = () => {
                          if (isPassed) return t('home.slot.passed')
                          if (!canBook) return t('home.slot.tooLate')
                          if (availability <= 0) return t('home.slot.full')
                          return ''
                        }
                        
                        return (
                          <button
                            key={slot.id}
                            onClick={() => isAvailable && openBookingModal(slot)}
                            disabled={!isAvailable}
                            className={`absolute rounded-lg text-left transition-all overflow-hidden ${
                              isPassed
                                ? 'bg-gray-100 border border-gray-200 opacity-50 cursor-not-allowed'
                                : isAvailable
                                  ? 'border-2 hover:shadow-lg hover:scale-[1.02] cursor-pointer'
                                : 'bg-gray-100 border border-gray-200 opacity-60 cursor-not-allowed'
                            }`}
                            style={{ 
                              top: `${top}px`, 
                              height: `${height}px`,
                              left: `calc(${leftPercent}% + 2px)`,
                              width: `calc(${widthPercent}% - 4px)`,
                              borderColor: !isPassed && isAvailable ? effectiveColor : undefined,
                              backgroundColor: !isPassed && isAvailable ? `${effectiveColor}08` : undefined,
                            }}
                          >
                            <div className="p-2 h-full flex flex-col">
                              {/* Bandeau heure en haut */}
                              <div 
                                className={`text-xs font-bold mb-1 ${isPassed ? 'text-gray-400' : ''}`}
                                style={{ color: !isPassed ? effectiveColor : undefined }}
                              >
                                {startTimeFormatted} - {endTime}
                            </div>
                            
                              {/* Contenu - visible si assez de place */}
                              {height >= 70 && (
                                <>
                            {/* Sports */}
                                  <div className="flex items-center gap-1 mb-1 flex-wrap">
                                    {slotSports.slice(0, 3).map(s => (
                                <span key={s.id} className="text-sm" title={s.name}>{s.icon}</span>
                              ))}
                                    {slotSports.length > 3 && (
                                      <span className="text-xs text-gray-400">+{slotSports.length - 3}</span>
                              )}
                            </div>
                            
                            {/* Prix et disponibilité */}
                                  <div className="mt-auto flex items-center justify-between gap-1">
                              <span 
                                      className={`text-sm font-bold ${isPassed ? 'text-gray-400' : ''}`}
                                      style={{ color: !isPassed && isAvailable ? effectiveColor : undefined }}
                              >
                                {slot.price}{branding?.currencySymbol || '.-'}
                              </span>
                                    <span className={`text-xs font-medium whitespace-nowrap ${
                                      isPassed 
                                        ? 'text-gray-400' 
                                        : isAvailable 
                                          ? 'text-green-600' 
                                          : 'text-gray-400'
                                    }`}>
                                      {isAvailable 
                                        ? `${availability} ${availability > 1 ? t('home.slot.places') : t('home.slot.place')}` 
                                        : getUnavailableReason()
                                      }
                              </span>
                                  </div>
                                </>
                              )}
                              
                              {/* Version compacte si peu de place */}
                              {height < 70 && (
                                <div className="flex items-center justify-between gap-1 text-xs">
                                  <div className="flex items-center gap-1">
                                    {slotSports.slice(0, 2).map(s => (
                                      <span key={s.id} className="text-sm">{s.icon}</span>
                                    ))}
                                  </div>
                                  <span 
                                    className={`font-bold ${isPassed ? 'text-gray-400' : ''}`}
                                    style={{ color: !isPassed && isAvailable ? effectiveColor : undefined }}
                                  >
                                    {slot.price}{branding?.currencySymbol || '.-'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Grille horaire - MOBILE (un seul jour) - swipe gauche/droite pour changer de JOUR */}
            <div 
              className="md:hidden relative overflow-hidden"
              style={{ 
                minHeight: `${hoursArray.length * 90}px`,
                touchAction: isHorizontalSwipe ? 'none' : 'pan-y'
              }}
              onTouchStart={(e) => {
                setDaySwipeStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })
                setDaySwipeTransition(false)
              }}
              onTouchMove={(e) => {
                if (daySwipeStart === null) return
                const currentX = e.touches[0].clientX
                const currentY = e.touches[0].clientY
                const diffX = currentX - daySwipeStart.x
                const diffY = currentY - daySwipeStart.y
                
                // Détecter le premier mouvement significatif
                if (!isHorizontalSwipe && (Math.abs(diffX) > 10 || Math.abs(diffY) > 10)) {
                  // Si horizontal > vertical, c'est un swipe de navigation
                  if (Math.abs(diffX) > Math.abs(diffY)) {
                    setIsHorizontalSwipe(true)
                  }
                }
                
                // Si swipe horizontal détecté, bloquer tout et animer
                if (isHorizontalSwipe) {
                  e.preventDefault()
                  e.stopPropagation()
                  const limitedDiff = Math.sign(diffX) * Math.min(Math.abs(diffX) * 0.5, 120)
                  setDaySwipeOffset(limitedDiff)
                }
              }}
              onTouchEnd={() => {
                if (daySwipeStart === null) return
                
                if (isHorizontalSwipe) {
                  const threshold = 50
                  setDaySwipeTransition(true)
                  
                  if (daySwipeOffset > threshold) {
                    setDaySwipeOffset(200)
                    setTimeout(() => {
                      if (selectedDayIndex > 0) {
                        setSelectedDayIndex(selectedDayIndex - 1)
                      } else {
                        handlePrevWeek()
                        setSelectedDayIndex(6)
                      }
                      setDaySwipeOffset(0)
                      setDaySwipeTransition(false)
                    }, 150)
                  } else if (daySwipeOffset < -threshold) {
                    setDaySwipeOffset(-200)
                    setTimeout(() => {
                      if (selectedDayIndex < 6) {
                        setSelectedDayIndex(selectedDayIndex + 1)
                      } else {
                        handleNextWeek()
                        setSelectedDayIndex(0)
                      }
                      setDaySwipeOffset(0)
                      setDaySwipeTransition(false)
                    }, 150)
                  } else {
                    setDaySwipeOffset(0)
                  }
                }
                
                setDaySwipeStart(null)
                setIsHorizontalSwipe(false)
              }}
            >
              {(() => {
                const date = weekDates[selectedDayIndex]
                const daySlots = getSlotsForDate(date)
                const closure = getClosureForDate(date)
                const isClosed = closure !== null
                const dayDisabled = isDayDisabled(date)
                const isUnavailable = isClosed || dayDisabled
                
                return (
                  <div 
                    className="grid grid-cols-[45px_1fr] relative"
                    style={{
                      transform: `translateX(${daySwipeOffset}px)`,
                      transition: daySwipeTransition ? 'transform 0.15s ease-out' : 'none',
                      opacity: 1 - Math.abs(daySwipeOffset) / 300,
                      ...(isUnavailable ? {
                        background: `repeating-linear-gradient(
                          -45deg,
                          #f9fafb,
                          #f9fafb 10px,
                          #f3f4f6 10px,
                          #f3f4f6 20px
                        )`
                      } : {})
                    }}
                  >
                    {/* Colonne des heures */}
                    <div className="border-r bg-gray-50/50">
                      {hoursArray.map(hour => (
                        <div 
                          key={hour} 
                          className="h-[90px] border-b flex items-start justify-end pr-1.5 pt-1"
                        >
                          <span className="text-[10px] font-medium text-gray-400">
                            {settings?.branding?.timeFormat === "12h" 
                              ? formatTimeDisplay(`${String(hour).padStart(2, '0')}:00`, "12h").replace(':00', '')
                              : `${String(hour).padStart(2, '0')}h`}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Colonne du jour avec créneaux */}
                    <div className="relative">
                      {/* Indicateur de fermeture */}
                      {isClosed && (
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
                          <div className="bg-white/90 rounded px-3 py-1 shadow-sm border border-gray-200 text-center">
                            <div className="text-gray-500 font-medium text-xs">
                              {getClosureReasonText(closure.reason)}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Lignes de grille pour les heures */}
                      {hoursArray.map(hour => (
                        <div 
                          key={hour} 
                          className="h-[90px] border-b border-dashed border-gray-100"
                        />
                      ))}
                      
                      {/* Créneaux positionnés */}
                      <div className="absolute inset-0 p-1">
                        {daySlots.map((slot, slotIndex) => {
                          const [slotHour, slotMin] = slot.time.split(':').map(Number)
                          const startMinutes = (slotHour - minHour) * 60 + slotMin
                          const top = (startMinutes / 60) * 90 + 2
                          const slotHeight = (slot.duration / 60) * 90
                          const height = Math.max(slotHeight - 4, 75)
                          
                          // Calculer position horizontale pour créneaux au même horaire
                          const sameTimeSlots = daySlots.filter(s => s.time === slot.time)
                          const sameTimeIndex = sameTimeSlots.findIndex(s => s.id === slot.id)
                          const sameTimeCount = sameTimeSlots.length
                          const widthPercent = sameTimeCount > 1 ? 100 / sameTimeCount : 100
                          const leftPercent = sameTimeCount > 1 ? sameTimeIndex * widthPercent : 0
                          
                          const isPassed = isSlotPassed(slot)
                          const canBook = canBookSlot(slot)
                          const availability = slot.maxCapacity - slot.currentBookings
                          const isAvailable = availability > 0 && canBook
                          const slotSports = getSportForSlot(slot)
                          
                          const endMinutes = slotHour * 60 + slotMin + slot.duration
                          const endHour = Math.floor(endMinutes / 60)
                          const endMin = endMinutes % 60
                          const endTimeRaw = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`
                          const timeFormat = settings?.branding?.timeFormat || "24h"
                          const startTimeFormatted = formatTimeDisplay(slot.time, timeFormat)
                          const endTime = formatTimeDisplay(endTimeRaw, timeFormat)
                          
                          const getUnavailableReason = () => {
                            if (isPassed) return t('home.slot.passed')
                            if (!canBook) return t('home.slot.tooLate')
                            if (availability <= 0) return t('home.slot.full')
                            return ''
                          }
                          
                          return (
                            <button
                              key={slot.id}
                              onClick={() => isAvailable && openBookingModal(slot)}
                              disabled={!isAvailable}
                              className={`absolute rounded-lg text-left transition-all overflow-hidden ${
                                isPassed
                                  ? 'bg-gray-100 border border-gray-200 opacity-50 cursor-not-allowed'
                                  : isAvailable
                                    ? 'border-2 hover:shadow-lg cursor-pointer'
                                    : 'bg-gray-100 border border-gray-200 opacity-60 cursor-not-allowed'
                              }`}
                              style={{ 
                                top: `${top}px`, 
                                height: `${height}px`,
                                left: `calc(${leftPercent}% + 2px)`,
                                width: `calc(${widthPercent}% - 4px)`,
                                borderColor: !isPassed && isAvailable ? effectiveColor : undefined,
                                backgroundColor: !isPassed && isAvailable ? `${effectiveColor}08` : undefined,
                              }}
                            >
                              <div className="p-2 h-full flex flex-col">
                                <div 
                                  className={`text-xs font-bold ${isPassed ? 'text-gray-400' : ''}`}
                                  style={{ color: !isPassed ? effectiveColor : undefined }}
                                >
                                  {startTimeFormatted} - {endTime}
                  </div>
                                
                                <div className="flex items-center gap-1 mt-1">
                                  {slotSports.slice(0, 3).map(s => (
                                    <span key={s.id} className="text-sm" title={s.name}>{s.icon}</span>
                                  ))}
                                </div>
                                
                                <div className="mt-auto flex items-center justify-between gap-1">
                                  <span 
                                    className={`text-sm font-bold ${isPassed ? 'text-gray-400' : ''}`}
                                    style={{ color: !isPassed && isAvailable ? effectiveColor : undefined }}
                                  >
                                    {slot.price}{branding?.currencySymbol || '.-'}
                                  </span>
                                  <span className={`text-[10px] font-medium ${
                                    isPassed 
                                      ? 'text-gray-400' 
                                      : isAvailable 
                                        ? 'text-green-600' 
                                        : 'text-gray-400'
                                  }`}>
                                    {isAvailable 
                                      ? `${availability} ${availability > 1 ? t('home.slot.places') : t('home.slot.place')}` 
                                      : getUnavailableReason()
                                    }
                                  </span>
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )}

        {/* Info Section */}
        {(branding?.contactPhone || branding?.contactEmail || branding?.address) && (
          <div className="mt-8 sm:mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {branding?.contactPhone && (
              <Card className="p-4 sm:p-6 bg-white rounded-xl sm:rounded-2xl text-center hover:shadow-md transition-shadow">
                <div 
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full mx-auto mb-3 sm:mb-4 flex items-center justify-center"
                  style={{ backgroundColor: `${effectiveColor}15` }}
                >
                  <Phone className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: effectiveColor }} />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">{t('footer.phone')}</h3>
                <a href={`tel:${branding.contactPhone}`} className="text-gray-600 hover:text-gray-900 text-sm sm:text-base">
                  {branding.contactPhone}
                </a>
              </Card>
            )}
            {branding?.contactEmail && (
              <Card className="p-4 sm:p-6 bg-white rounded-xl sm:rounded-2xl text-center hover:shadow-md transition-shadow">
                <div 
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full mx-auto mb-3 sm:mb-4 flex items-center justify-center"
                  style={{ backgroundColor: `${effectiveColor}15` }}
                >
                  <Mail className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: effectiveColor }} />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">{t('footer.email')}</h3>
                <a href={`mailto:${branding.contactEmail}`} className="text-gray-600 hover:text-gray-900 text-sm sm:text-base break-all">
                  {branding.contactEmail}
                </a>
              </Card>
            )}
            {branding?.address && (
              <Card className="p-4 sm:p-6 bg-white rounded-xl sm:rounded-2xl text-center hover:shadow-md transition-shadow">
                <div 
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full mx-auto mb-3 sm:mb-4 flex items-center justify-center"
                  style={{ backgroundColor: `${effectiveColor}15` }}
                >
                  <MapPin className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: effectiveColor }} />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">{t('footer.address')}</h3>
                <p className="text-gray-600 text-sm sm:text-base">{branding.address}</p>
              </Card>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white overflow-hidden"
                style={{ 
                  backgroundColor: showLogoBackground ? effectiveColor : "transparent"
                }}
                >
                  {branding?.logoUrl ? (
                    <img src={branding.logoUrl} alt="Logo" className="w-5 h-5 object-contain" />
                  ) : (
                    <span className="text-sm">{branding?.logoIcon || "🏆"}</span>
                  )}
                </div>
              <span className="font-semibold text-gray-900">{branding?.siteName || "SportSlot"}</span>
            </div>
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} {branding?.siteName || "SportSlot"}. {t('footer.rights')}.
            </p>
          </div>
        </div>
      </footer>

      {/* Modal de réservation */}
      {bookingModal.isOpen && bookingModal.slot && (
        <div 
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
          onClick={closeBookingModal}
          style={{ 
            opacity: swipeOffset > 0 ? Math.max(0.3, 1 - swipeOffset / 300) : 1,
            transition: swipeOffset === 0 ? 'opacity 0.2s ease-out' : 'none'
          }}
        >
          <div 
            className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
            style={{ 
              transform: `translateY(${swipeOffset}px)`,
              transition: swipeOffset === 0 ? 'transform 0.3s ease-out' : 'none'
            }}
          >
            {/* Header du modal - avec swipe down to close sur mobile */}
            <div 
              className="p-4 sm:p-6 pt-3 sm:pt-6 text-white relative rounded-t-3xl sm:rounded-t-3xl touch-pan-y"
              style={{ backgroundColor: effectiveColor }}
              onTouchStart={(e) => {
                setSwipeStart(e.touches[0].clientY)
              }}
              onTouchMove={(e) => {
                if (swipeStart === null) return
                const diff = e.touches[0].clientY - swipeStart
                // Limiter le swipe vers le haut et appliquer une résistance vers le bas
                if (diff > 0) {
                  // Résistance progressive (plus on descend, plus c'est dur)
                  setSwipeOffset(Math.min(diff * 0.8, 250))
                } else {
                  setSwipeOffset(0)
                }
              }}
              onTouchEnd={() => {
                // Si on a assez descendu, fermer le modal
                if (swipeOffset > 120) {
                  // Animation de sortie
                  setSwipeOffset(500)
                  setTimeout(() => {
                    closeBookingModal()
                    setSwipeOffset(0)
                  }, 200)
                } else {
                  // Revenir à la position initiale avec animation
                  setSwipeOffset(0)
                }
                setSwipeStart(null)
              }}
            >
              {/* Handle bar pour mobile - indique qu'on peut swiper */}
              <div className="sm:hidden flex justify-center mb-2 cursor-grab active:cursor-grabbing">
                <div 
                  className="w-12 h-1.5 rounded-full transition-all duration-200"
                  style={{ 
                    backgroundColor: swipeOffset > 120 ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)',
                    width: swipeOffset > 120 ? '60px' : '48px'
                  }}
                />
              </div>
              <button 
                onClick={closeBookingModal}
                className="absolute top-3 sm:top-4 right-3 sm:right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              {bookingSuccess ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 rounded-full bg-white/20 mx-auto mb-4 flex items-center justify-center">
                    <Check className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold">{t('booking.success.title')}</h2>
                  <p className="text-white/80 mt-2">{t('booking.success.message')}</p>
                </div>
              ) : bookingModal.selectingSport ? (
                <>
                  <div className="text-center mb-4">
                    <h2 className="text-2xl font-bold">{t('booking.selectSport')}</h2>
                    <p className="text-white/80">{t('booking.selectSportDesc')}</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-lg">
                      <Calendar className="w-4 h-4" />
                      {new Date(bookingModal.slot.date).toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                    <div className="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-lg">
                      <Clock className="w-4 h-4" />
                      {formatTimeDisplay(bookingModal.slot.time, settings?.branding?.timeFormat || "24h")} ({bookingModal.slot.duration / 60}h)
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-4 pr-10">
                    {bookingModal.sport && (
                      <span className="text-4xl">{bookingModal.sport.icon}</span>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-bold">{bookingModal.sport?.name || t('booking.title')}</h2>
                        {/* Bouton pour changer de sport si plusieurs disponibles */}
                        {bookingModal.availableSports.length > 1 && (
                          <button
                            onClick={() => setBookingModal(prev => ({ ...prev, selectingSport: true, sport: null }))}
                            className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-xs font-medium transition-colors"
                          >
                            ✏️
                          </button>
                        )}
                      </div>
                      <p className="text-white/80">{t('booking.subtitle')}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-lg">
                      <Calendar className="w-4 h-4" />
                      {new Date(bookingModal.slot.date).toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                    <div className="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-lg">
                      <Clock className="w-4 h-4" />
                      {formatTimeDisplay(bookingModal.slot.time, settings?.branding?.timeFormat || "24h")} ({bookingModal.slot.duration / 60}h)
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Corps du modal */}
            <div className="p-4 sm:p-6 pb-8 sm:pb-6">
              {bookingModal.selectingSport ? (
                <div className="space-y-3">
                  {bookingModal.availableSports.map(sport => (
                    <button
                      key={sport.id}
                      onClick={() => selectSportForBooking(sport)}
                      className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-gray-400 transition-all flex items-center gap-4 text-left hover:bg-gray-50"
                      style={{ 
                        borderColor: 'transparent',
                        backgroundColor: `${effectiveColor}10`
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = effectiveColor
                        e.currentTarget.style.backgroundColor = `${effectiveColor}20`
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'transparent'
                        e.currentTarget.style.backgroundColor = `${effectiveColor}10`
                      }}
                    >
                      <span className="text-4xl">{sport.icon}</span>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{sport.name}</div>
                      </div>
                      <div className="text-gray-400">→</div>
                    </button>
                  ))}
                </div>
              ) : bookingSuccess ? (
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">{t('booking.summary.title')}</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t('booking.summary.sport')}</span>
                        <span className="font-medium">{bookingModal.sport?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t('booking.summary.date')}</span>
                        <span className="font-medium">
                          {new Date(bookingModal.slot.date).toLocaleDateString(i18n.language)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t('booking.summary.time')}</span>
                        <span className="font-medium">{formatTimeDisplay(bookingModal.slot.time, settings?.branding?.timeFormat || "24h")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t('booking.summary.people')}</span>
                        <span className="font-medium">{bookingForm.numberOfPeople}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <span className="text-gray-900 font-semibold">{t('booking.summary.total')}</span>
                        <span className="font-bold" style={{ color: effectiveColor }}>
                          {bookingModal.slot.price * bookingForm.numberOfPeople}{branding?.currencySymbol || '.-'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={closeBookingModal}
                    className="w-full h-12 rounded-xl text-white"
                    style={{ backgroundColor: effectiveColor }}
                  >
                    {t('common.close')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Prix */}
                  <div className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: `${effectiveColor}10` }}>
                    <span className="text-gray-600">{t('booking.summary.pricePerPerson')}</span>
                    <span className="text-2xl font-bold" style={{ color: effectiveColor }}>
                      {bookingModal.slot.price}{branding?.currencySymbol || '.-'}
                    </span>
                  </div>
                  
                  {/* Formulaire */}
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700 mb-2 block">{t('booking.form.name')}</Label>
                      <Input
                        value={bookingForm.name}
                        onChange={e => setBookingForm({ ...bookingForm, name: e.target.value })}
                        placeholder={t('booking.form.namePlaceholder')}
                        className="h-12 rounded-xl"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700 mb-2 block">{t('booking.form.email')}</Label>
                      <Input
                        type="email"
                        value={bookingForm.email}
                        onChange={e => setBookingForm({ ...bookingForm, email: e.target.value })}
                        placeholder={t('booking.form.emailPlaceholder')}
                        className="h-12 rounded-xl"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700 mb-2 block">{t('booking.form.phone')}</Label>
                      <Input
                        type="tel"
                        value={bookingForm.phone}
                        onChange={e => setBookingForm({ ...bookingForm, phone: e.target.value })}
                        placeholder={t('booking.form.phonePlaceholder')}
                        className="h-12 rounded-xl"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700 mb-2 block">{t('booking.form.people')}</Label>
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setBookingForm({ ...bookingForm, numberOfPeople: Math.max(1, bookingForm.numberOfPeople - 1) })}
                          className="rounded-xl"
                        >
                          -
                        </Button>
                        <span className="text-2xl font-bold w-12 text-center">{bookingForm.numberOfPeople}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const maxAvailable = bookingModal.slot!.maxCapacity - bookingModal.slot!.currentBookings
                            setBookingForm({ ...bookingForm, numberOfPeople: Math.min(maxAvailable, bookingForm.numberOfPeople + 1) })
                          }}
                          className="rounded-xl"
                        >
                          +
                        </Button>
                        <span className="text-sm text-gray-500">
                          (max {bookingModal.slot.maxCapacity - bookingModal.slot.currentBookings})
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Total et bouton */}
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-gray-600">{t('booking.summary.total')}</span>
                      <span className="text-2xl font-bold" style={{ color: effectiveColor }}>
                        {bookingModal.slot.price * bookingForm.numberOfPeople}{branding?.currencySymbol || '.-'}
                      </span>
                    </div>
                    <Button 
                      onClick={handleBooking}
                      disabled={!bookingForm.name || !bookingForm.email || !bookingForm.phone}
                      className="w-full h-12 rounded-xl text-white font-semibold"
                      style={{ backgroundColor: effectiveColor }}
                    >
                      {t('booking.submit')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Popup d'erreur de réservation */}
      {bookingError && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200"
            style={{ borderTop: `4px solid #ef4444` }}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {t('booking.errorTitle')}
                </h3>
                <p className="text-gray-600">
                  {bookingError}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                onClick={() => setBookingError(null)}
                className="px-6 py-2 rounded-xl text-white font-medium"
                style={{ backgroundColor: effectiveColor }}
              >
                {t('common.close')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
