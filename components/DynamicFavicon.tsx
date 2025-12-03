"use client"

import { useEffect, useState } from "react"
import { getSettings } from "@/lib/storage"

export default function DynamicFavicon() {
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null)

  useEffect(() => {
    const updateFavicon = () => {
      const settings = getSettings()
      const logoUrl = settings?.branding?.logoUrl
      const logoIcon = settings?.branding?.logoIcon
      const primaryColor = settings?.branding?.primaryColor || "#3b82f6"
      const logoBackground = settings?.branding?.logoBackground !== false // true par défaut

      if (logoUrl && logoUrl.startsWith("data:image")) {
        // Si on a une image en base64
        if (logoBackground) {
          // Ajouter un fond coloré derrière l'image
          createImageWithBackground(logoUrl, primaryColor).then(setFaviconUrl)
        } else {
          // Utiliser l'image directement (fond transparent)
          setFaviconUrl(logoUrl)
        }
      } else if (logoIcon) {
        // Si on a un emoji, créer un favicon avec l'emoji
        createEmojiCanvas(logoIcon, primaryColor).then(setFaviconUrl)
      } else {
        // Favicon par défaut (emoji trophée)
        createEmojiCanvas("🏆", primaryColor).then(setFaviconUrl)
      }
    }

    // Mise à jour initiale
    updateFavicon()

    // Écouter les changements de localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "sportslot_settings") {
        updateFavicon()
      }
    }

    // Écouter un événement custom pour les changements locaux
    const handleSettingsChange = () => {
      updateFavicon()
    }

    window.addEventListener("storage", handleStorageChange)
    window.addEventListener("settingsChanged", handleSettingsChange)

    // Interval pour vérifier les changements (au cas où)
    const interval = setInterval(updateFavicon, 2000)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("settingsChanged", handleSettingsChange)
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (!faviconUrl) return

    // Mettre à jour le favicon dans le DOM
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement
    if (!link) {
      link = document.createElement("link")
      link.rel = "icon"
      document.head.appendChild(link)
    }
    link.href = faviconUrl

    // Aussi mettre à jour apple-touch-icon
    let appleLink = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement
    if (!appleLink) {
      appleLink = document.createElement("link")
      appleLink.rel = "apple-touch-icon"
      document.head.appendChild(appleLink)
    }
    appleLink.href = faviconUrl
  }, [faviconUrl])

  return null
}

// Fonction pour créer un canvas avec un emoji
async function createEmojiCanvas(emoji: string, bgColor: string): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas")
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext("2d")
    
    if (!ctx) {
      resolve("/icon.svg")
      return
    }

    // Fond avec la couleur primaire
    ctx.fillStyle = bgColor
    ctx.beginPath()
    ctx.roundRect(0, 0, 64, 64, 12)
    ctx.fill()

    // Emoji au centre
    ctx.font = "40px serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(emoji, 32, 35)

    resolve(canvas.toDataURL("image/png"))
  })
}

// Fonction pour créer une image avec un fond coloré
async function createImageWithBackground(imageUrl: string, bgColor: string): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas")
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext("2d")
    
    if (!ctx) {
      resolve(imageUrl)
      return
    }

    const img = new Image()
    img.crossOrigin = "anonymous"
    
    img.onload = () => {
      // Fond avec la couleur primaire et coins arrondis
      ctx.fillStyle = bgColor
      ctx.beginPath()
      ctx.roundRect(0, 0, 64, 64, 12)
      ctx.fill()

      // Calculer la taille de l'image pour qu'elle tienne dans le canvas avec padding
      const padding = 8
      const availableSize = 64 - (padding * 2)
      const scale = Math.min(availableSize / img.width, availableSize / img.height)
      const width = img.width * scale
      const height = img.height * scale
      const x = (64 - width) / 2
      const y = (64 - height) / 2

      // Dessiner l'image centrée
      ctx.drawImage(img, x, y, width, height)

      resolve(canvas.toDataURL("image/png"))
    }

    img.onerror = () => {
      resolve(imageUrl)
    }

    img.src = imageUrl
  })
}
