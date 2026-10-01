"use client"

import { useEffect } from "react"
import { getSettings } from "@/lib/storage"

export default function DynamicTitle() {
  useEffect(() => {
    const updateTitle = () => {
      const settings = getSettings()
      const siteName = settings?.branding?.siteName || "SportSlot"
      const siteTitle = settings?.branding?.siteTitle || ""
      
      if (siteTitle) {
        document.title = `${siteName} - ${siteTitle}`
      } else {
        document.title = siteName
      }
    }

    // Mise à jour initiale
    updateTitle()

    // Écouter les changements de localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "sportslot_settings") {
        updateTitle()
      }
    }

    // Écouter un événement custom pour les changements locaux
    const handleSettingsChange = () => {
      updateTitle()
    }

    window.addEventListener("storage", handleStorageChange)
    window.addEventListener("settingsChanged", handleSettingsChange)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("settingsChanged", handleSettingsChange)
    }
  }, [])

  return null
}
