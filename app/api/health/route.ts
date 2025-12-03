/**
 * API Route: Health Check
 * GET /api/health
 * 
 * Vérifie l'état de l'application et de la connexion DB
 */

import { NextResponse } from 'next/server'
import { healthCheck } from '@/lib/prisma'
import { config } from '@/lib/config'

export async function GET() {
  try {
    const dbHealth = await healthCheck()
    
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: config.isDevelopment ? 'development' : 'production',
      storage: {
        mode: dbHealth.mode,
        status: dbHealth.status,
        message: dbHealth.message
      }
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: (error as Error).message
    }, { status: 500 })
  }
}



