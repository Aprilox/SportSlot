'use client'

import { useEffect, useState, useRef } from 'react'

/**
 * Composant qui charge les données depuis la DB au démarrage
 * et les synchronise avec localStorage pour que l'app fonctionne normalement
 * 
 * Modes supportés:
 * - browser: Données dans localStorage uniquement (pas de sync nécessaire)
 * - local: DB SQLite locale → sync vers localStorage
 * - external: DB externe → sync vers localStorage
 */
export function DataLoader({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasLoadedRef = useRef(false) // Éviter les rechargements multiples (Fast Refresh)

  useEffect(() => {
    async function loadData() {
      try {
        // Vérifier si une synchronisation est en cours (éviter d'écraser des modifications)
        // Seulement si on a déjà chargé une fois
        if (hasLoadedRef.current) {
          const pendingSync = localStorage.getItem('sportslot_pending_sync')
          if (pendingSync === 'true') {
            setIsLoading(false)
            return
          }
        }
        
        // Appeler l'API pour récupérer les données et le mode
        const response = await fetch('/api/data')
        const result = await response.json()

        // Mode browser = on garde les données localStorage existantes
        if (result.mode === 'browser') {
          hasLoadedRef.current = true
          setIsLoading(false)
          return
        }

        // Mode database (local ou external) = on charge depuis la DB
        if (result.success && result.mode === 'database') {
          // EN MODE DATABASE : on écrase TOUJOURS le localStorage avec les données DB
          // Même si les données sont vides, c'est la DB qui fait foi !
          
          // Vider d'abord le localStorage pour éviter les données orphelines
          localStorage.removeItem('sportslot_settings')
          localStorage.removeItem('sportslot_sports')
          localStorage.removeItem('sportslot_slots')
          localStorage.removeItem('sportslot_bookings')
          
          // Puis remplir avec les données de la DB (si elles existent)
          if (result.data?.settings) {
            localStorage.setItem('sportslot_settings', JSON.stringify(result.data.settings))
          }
          if (result.data?.sports) {
            localStorage.setItem('sportslot_sports', JSON.stringify(result.data.sports))
          }
          if (result.data?.slots) {
            localStorage.setItem('sportslot_slots', JSON.stringify(result.data.slots))
          }
          if (result.data?.bookings) {
            localStorage.setItem('sportslot_bookings', JSON.stringify(result.data.bookings))
          }
          
          // Marquer la synchronisation
          localStorage.setItem('sportslot_last_db_sync', Date.now().toString())
          localStorage.setItem('sportslot_storage_mode', result.storageMode)
          
          // Déclencher un événement pour que les composants se mettent à jour
          window.dispatchEvent(new Event('storage'))
        }
        
        hasLoadedRef.current = true
      } catch (err) {
        // En cas d'erreur, on continue avec les données localStorage existantes
        hasLoadedRef.current = true
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  // Afficher un loader pendant le chargement initial
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center text-red-600">
          <p>Erreur: {error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
          >
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
