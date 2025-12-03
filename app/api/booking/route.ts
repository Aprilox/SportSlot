/**
 * API Route: Réservation
 * POST /api/booking
 * 
 * Gère les réservations de manière atomique pour éviter les problèmes de concurrence
 * Vérifie les places disponibles côté serveur avant de créer la réservation
 */

import { NextRequest, NextResponse } from 'next/server'
import { initializeStorage, isUsingDatabase } from '@/lib/db'
import { withPrisma } from '@/lib/prisma'
import { isDatabaseMode, getStorageMode } from '@/lib/config'

interface BookingRequest {
  slotId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  numberOfPeople: number
  sportId: string
  sportName: string
}

export async function POST(request: NextRequest) {
  try {
    const storageMode = getStorageMode()
    
    // Mode browser = pas de vérification serveur possible
    if (storageMode === 'browser' || !isDatabaseMode()) {
      return NextResponse.json({
        success: false,
        error: 'Mode navigateur - réservation non sécurisée',
        mode: 'browser'
      })
    }
    
    // Initialiser la connexion DB
    await initializeStorage()
    
    if (!isUsingDatabase()) {
      return NextResponse.json({
        success: false,
        error: 'Base de données non disponible'
      }, { status: 500 })
    }
    
    const body: BookingRequest = await request.json()
    const { slotId, customerName, customerEmail, customerPhone, numberOfPeople, sportId, sportName } = body
    
    // Validation des données
    if (!slotId || !customerName || !customerEmail || !numberOfPeople) {
      return NextResponse.json({
        success: false,
        error: 'Données de réservation incomplètes'
      }, { status: 400 })
    }
    
    // Transaction ATOMIQUE avec verrouillage - tout se passe dans une seule transaction
    const result = await withPrisma(async (prisma) => {
      // Utiliser une transaction interactive pour garantir l'atomicité
      return await prisma.$transaction(async (tx) => {
        // 1. Récupérer le slot (dans la transaction pour verrouillage)
        const slot = await tx.timeSlot.findUnique({
          where: { id: slotId }
        })
        
        if (!slot) {
          return { success: false, errorCode: 'SLOT_NOT_FOUND' }
        }
        
        // 2. Vérifier les places disponibles (dans la transaction)
        const availablePlaces = slot.maxCapacity - slot.currentBookings
        
        if (availablePlaces < numberOfPeople) {
          return { 
            success: false, 
            errorCode: 'NOT_ENOUGH_PLACES',
            availablePlaces
          }
        }
        
        // 3. Mettre à jour le slot AVANT de créer la réservation (double vérification)
        // Utiliser updateMany avec condition pour garantir l'atomicité
        const updateResult = await tx.timeSlot.updateMany({
          where: { 
            id: slotId,
            // Condition atomique : vérifier qu'il y a encore assez de places
            currentBookings: { lte: slot.maxCapacity - numberOfPeople }
          },
          data: {
            currentBookings: { increment: numberOfPeople }
          }
        })
        
        // Si aucune ligne n'a été mise à jour, quelqu'un d'autre a réservé entre-temps
        if (updateResult.count === 0) {
          return { 
            success: false, 
            errorCode: 'RACE_CONDITION',
            availablePlaces: 0
          }
        }
        
        // 4. Créer la réservation
        const booking = await tx.booking.create({
          data: {
            customerName,
            customerEmail,
            customerPhone: customerPhone || '',
            numberOfPeople,
            totalPrice: slot.price * numberOfPeople,
            sportId: sportId || '',
            sportName: sportName || 'Sport',
            date: slot.date,
            time: slot.time,
            slotId: slot.id
          }
        })
        
        // 5. Récupérer le slot mis à jour
        const updatedSlot = await tx.timeSlot.findUnique({
          where: { id: slotId }
        })
        
        // 6. Incrémenter la version des données pour la synchronisation
        await tx.settings.update({
          where: { id: 'main' },
          data: {
            dataVersion: { increment: 1 }
          }
        })
        
        return {
          success: true,
          booking: {
            id: booking.id,
            slotId: booking.slotId,
            customerName: booking.customerName,
            customerEmail: booking.customerEmail,
            customerPhone: booking.customerPhone,
            numberOfPeople: booking.numberOfPeople,
            totalPrice: booking.totalPrice,
            sportId: booking.sportId,
            sportName: booking.sportName,
            date: booking.date,
            time: booking.time,
            createdAt: booking.createdAt.toISOString()
          },
          updatedSlot: {
            id: updatedSlot!.id,
            currentBookings: updatedSlot!.currentBookings,
            maxCapacity: updatedSlot!.maxCapacity
          }
        }
      }, {
        // Options de transaction pour SQLite
        maxWait: 5000, // Attendre max 5s pour obtenir le verrou
        timeout: 10000 // Timeout de 10s pour la transaction
      })
    })
    
    if (!result) {
      return NextResponse.json({
        success: false,
        error: 'Erreur lors de la réservation'
      }, { status: 500 })
    }
    
    if (!result.success) {
      return NextResponse.json(result, { status: 409 }) // Conflict
    }
    
    console.log(`✅ Réservation créée: ${result.booking?.customerName} - ${result.booking?.numberOfPeople} place(s)`)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ Erreur réservation:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur serveur'
    }, { status: 500 })
  }
}
