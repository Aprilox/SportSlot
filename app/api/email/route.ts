import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

interface EmailRequest {
  to: string
  subject: string
  html: string
  logoBase64?: string // Image base64 optionnelle (data:image/png;base64,...)
  smtpSettings: {
    host: string
    port: number
    secure: boolean
    user: string
    password: string
    fromEmail: string
    fromName: string
  }
}

export async function POST(request: Request) {
  try {
    const body: EmailRequest = await request.json()
    const { to, subject, html, logoBase64, smtpSettings } = body

    if (!smtpSettings.host || !smtpSettings.user || !smtpSettings.password) {
      return NextResponse.json(
        { success: false, error: 'Configuration SMTP incomplète' },
        { status: 400 }
      )
    }

    // Déterminer le mode secure automatiquement si nécessaire
    // Port 465 = SSL direct (secure: true)
    // Port 587 = STARTTLS (secure: false)
    // Port 25 = non sécurisé (secure: false)
    const isSecure = smtpSettings.port === 465 ? true : smtpSettings.secure

    // Créer le transporteur SMTP
    const transporter = nodemailer.createTransport({
      host: smtpSettings.host,
      port: smtpSettings.port,
      secure: isSecure,
      auth: {
        user: smtpSettings.user,
        pass: smtpSettings.password,
      },
      // Pour le port 587, utiliser STARTTLS
      ...(smtpSettings.port === 587 && !isSecure ? {
        requireTLS: true,
        tls: {
          rejectUnauthorized: false
        }
      } : {}),
    })

    // Préparer les pièces jointes (logo embarqué avec CID)
    const attachments: nodemailer.SendMailOptions['attachments'] = []
    
    if (logoBase64 && logoBase64.startsWith('data:image/')) {
      // Extraire le type MIME et les données base64
      const matches = logoBase64.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/)
      if (matches) {
        const imageType = matches[1]
        const base64Data = matches[2]
        attachments.push({
          filename: `logo.${imageType === 'jpeg' ? 'jpg' : imageType}`,
          content: Buffer.from(base64Data, 'base64'),
          cid: 'logo', // Content-ID pour référencer dans le HTML avec cid:logo
          contentType: `image/${imageType}`,
          contentDisposition: 'inline'
        })
      }
    }

    // Envoyer l'email
    const info = await transporter.sendMail({
      from: `"${smtpSettings.fromName}" <${smtpSettings.fromEmail}>`,
      to,
      subject,
      html,
      attachments,
    })

    return NextResponse.json({ 
      success: true, 
      messageId: info.messageId 
    })
  } catch (error) {
    console.error('Erreur envoi email:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    )
  }
}

