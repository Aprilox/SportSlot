/**
 * Script de migration : Multi-sport vers Single-sport
 * 
 * Ce script migre les créneaux avec plusieurs sports vers le nouveau modèle
 * où chaque créneau a un seul sport.
 * 
 * Les créneaux avec plusieurs sports seront dupliqués :
 * - 1 créneau avec Tennis+Padel → 2 créneaux (1 Tennis, 1 Padel)
 * - Mêmes paramètres pour les deux
 * 
 * Usage:
 *   npx ts-node scripts/migrate-multisport.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface OldTimeSlot {
  id: string
  date: string
  time: string
  duration: number
  maxCapacity: number
  currentBookings: number
  price: number
  published: boolean
  outsideWorkingHours: boolean
  originalDate: string | null
  originalTime: string | null
  originalDuration: number | null
  sports: { id: string }[]
}

async function migrateMultiSportSlots() {
  console.log('🔄 Début de la migration multi-sport → single-sport...\n')

  try {
    // Récupérer tous les créneaux avec leurs sports
    const slots = await prisma.$queryRaw<OldTimeSlot[]>`
      SELECT ts.*, 
        (SELECT GROUP_CONCAT(s.id) FROM Sport s 
         INNER JOIN _SportToTimeSlot st ON s.id = st.A 
         WHERE st.B = ts.id) as sportIds
      FROM TimeSlot ts
    `

    // Pour chaque créneau, vérifier s'il a plusieurs sports
    let migratedCount = 0
    let skippedCount = 0

    for (const slot of slots) {
      // Récupérer les sports liés à ce créneau
      const linkedSports = await prisma.$queryRaw<{ A: string }[]>`
        SELECT A FROM _SportToTimeSlot WHERE B = ${slot.id}
      `

      if (linkedSports.length <= 1) {
        // Créneau avec 0 ou 1 sport - migration simple
        if (linkedSports.length === 1) {
          // Mettre à jour le sportId
          await prisma.$executeRaw`
            UPDATE TimeSlot SET sportId = ${linkedSports[0].A} WHERE id = ${slot.id}
          `
          console.log(`✓ Créneau ${slot.id} (${slot.date} ${slot.time}): sportId défini`)
        } else {
          console.log(`⚠ Créneau ${slot.id} (${slot.date} ${slot.time}): aucun sport lié, ignoré`)
        }
        skippedCount++
        continue
      }

      // Créneau avec plusieurs sports - duplication nécessaire
      console.log(`🔀 Créneau ${slot.id} (${slot.date} ${slot.time}): ${linkedSports.length} sports → duplication`)

      // Créer un nouveau créneau pour chaque sport après le premier
      for (let i = 0; i < linkedSports.length; i++) {
        const sportId = linkedSports[i].A

        if (i === 0) {
          // Premier sport : mettre à jour le créneau existant
          await prisma.$executeRaw`
            UPDATE TimeSlot SET sportId = ${sportId} WHERE id = ${slot.id}
          `
          console.log(`  → Créneau original mis à jour avec sport ${sportId}`)
        } else {
          // Sports suivants : créer de nouveaux créneaux
          const newId = `${slot.id}-${sportId}`
          await prisma.$executeRaw`
            INSERT INTO TimeSlot (
              id, date, time, duration, maxCapacity, currentBookings, price, 
              published, outsideWorkingHours, originalDate, originalTime, originalDuration,
              sportId, createdAt, updatedAt
            ) VALUES (
              ${newId}, ${slot.date}, ${slot.time}, ${slot.duration}, ${slot.maxCapacity}, 
              ${slot.currentBookings}, ${slot.price}, ${slot.published}, ${slot.outsideWorkingHours},
              ${slot.originalDate}, ${slot.originalTime}, ${slot.originalDuration},
              ${sportId}, datetime('now'), datetime('now')
            )
          `
          console.log(`  → Nouveau créneau ${newId} créé pour sport ${sportId}`)
        }
      }

      migratedCount++
    }

    // Supprimer la table de jonction many-to-many (elle n'est plus utilisée)
    console.log('\n🧹 Nettoyage de la table de jonction _SportToTimeSlot...')
    await prisma.$executeRaw`DELETE FROM _SportToTimeSlot`

    console.log(`\n✅ Migration terminée!`)
    console.log(`   - Créneaux migrés (multi-sport): ${migratedCount}`)
    console.log(`   - Créneaux simples (inchangés): ${skippedCount}`)

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Exécuter la migration
migrateMultiSportSlots()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))

