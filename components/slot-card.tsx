"use client"

import type { Slot } from "@/lib/types"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, Users, Euro } from "lucide-react"
import Link from "next/link"

interface SlotCardProps {
  slot: Slot
}

export function SlotCard({ slot }: SlotCardProps) {
  const availableSpots = slot.maxCapacity - slot.currentBookings

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-2">
            {slot.sport === "golf" ? "Golf" : "Tennis"}
          </div>
          <h3 className="font-serif text-xl font-bold text-foreground">
            {slot.startTime} - {slot.endTime}
          </h3>
        </div>
        {slot.available ? (
          <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">Disponible</span>
        ) : (
          <span className="px-2 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-medium">Complet</span>
        )}
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span>{new Date(slot.date).toLocaleDateString("fr-FR")}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>2 heures</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>
            {availableSpots} place{availableSpots > 1 ? "s" : ""} disponible
            {availableSpots > 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Euro className="w-4 h-4" />
          <span>{slot.pricePerPerson}€ par personne</span>
        </div>
      </div>

      <Button asChild disabled={!slot.available} className="w-full rounded-full">
        <Link href={`/reserve/${slot.id}`}>{slot.available ? "Réserver" : "Complet"}</Link>
      </Button>
    </Card>
  )
}
