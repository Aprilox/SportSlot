'use client'

import { useEffect, useRef } from 'react'

/**
 * Hook pour la synchronisation temps réel des données
 * Utilise un polling toutes les 3 secondes pour vérifier les mises à jour
 * 
 * @param onUpdate - Callback appelé quand de nouvelles données sont disponibles
 * @param interval - Intervalle de polling en ms (défaut: 3000)
 */
export function useRealtime(
  onUpdate: (data: { slots: any[], bookings: any[], settings: any }) => void,
  interval: number = 3000
) {
  const versionRef = useRef<number>(0)
  const isPollingRef = useRef<boolean>(false)
  // Stocker le callback dans une ref pour éviter les re-créations
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  useEffect(() => {
    // Récupérer la version initiale depuis les settings en localStorage
    try {
      const settings = JSON.parse(localStorage.getItem('sportslot_settings') || '{}')
      versionRef.current = settings.dataVersion || 0
    } catch {
      versionRef.current = 0
    }

    const checkForUpdates = async () => {
      // Éviter les appels simultanés
      if (isPollingRef.current) return
      isPollingRef.current = true

      try {
        const response = await fetch(`/api/realtime?version=${versionRef.current}`)
        const result = await response.json()

        if (result.success && result.needsSync && result.data) {
          versionRef.current = result.version
          
          // Mettre à jour le localStorage
          if (result.data.slots) {
            localStorage.setItem('sportslot_slots', JSON.stringify(result.data.slots))
          }
          if (result.data.bookings) {
            localStorage.setItem('sportslot_bookings', JSON.stringify(result.data.bookings))
          }
          if (result.data.settings) {
            localStorage.setItem('sportslot_settings', JSON.stringify(result.data.settings))
          }

          // Notifier le composant parent (utiliser la ref pour le callback stable)
          onUpdateRef.current(result.data)
          
          // Déclencher un événement global
          window.dispatchEvent(new Event('storage'))
        } else if (result.success && !result.needsSync) {
          // Mettre à jour la version même si pas de sync nécessaire
          versionRef.current = result.version
        }
      } catch (error) {
        // Ignorer les erreurs silencieusement (le réseau peut être instable)
      } finally {
        isPollingRef.current = false
      }
    }

    // Premier check immédiat
    checkForUpdates()

    // Démarrer le polling
    const pollInterval = setInterval(checkForUpdates, interval)

    // Nettoyer à la destruction
    return () => {
      clearInterval(pollInterval)
    }
  }, [interval]) // Ne dépend plus de onUpdate

  // Fonction pour forcer une synchronisation
  const forceSync = () => {
    versionRef.current = 0 // Forcer une sync complète
  }

  return { forceSync }
}

/**
 * Hook simplifié qui recharge juste les données quand elles changent
 */
export function useRealtimeSlots(
  onSlotsUpdate: (slots: any[]) => void,
  onBookingsUpdate?: (bookings: any[]) => void
) {
  return useRealtime((data) => {
    if (data.slots) {
      onSlotsUpdate(data.slots)
    }
    if (data.bookings && onBookingsUpdate) {
      onBookingsUpdate(data.bookings)
    }
  })
}
