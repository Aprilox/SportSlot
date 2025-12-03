import type React from "react"
import "./globals.css"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import ClientI18nProvider from "@/components/ClientI18nProvider"
import DynamicFavicon from "@/components/DynamicFavicon"
import DynamicTitle from "@/components/DynamicTitle"
import { DataLoader } from "@/components/DataLoader"
import { DialogProvider } from "@/components/ui/custom-dialog"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "SportSlot - Réservation de créneaux sportifs",
  description: "Plateforme professionnelle de réservation pour clubs de sport",
    generator: 'v0.app'
}

export const viewport: Viewport = {
  themeColor: "#3B82F6",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={inter.className}>
      <body>
        <ClientI18nProvider>
          <DataLoader>
            <DialogProvider>
              <DynamicFavicon />
              <DynamicTitle />
              {children}
            </DialogProvider>
          </DataLoader>
        </ClientI18nProvider>
      </body>
    </html>
  )
}
