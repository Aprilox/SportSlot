"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getAdminCredentials, setAuthenticated, getSettings, type Settings } from "@/lib/storage"
import Link from "next/link"
import { Lock, User, ArrowLeft, Eye, EyeOff } from "lucide-react"
import LanguageSwitcher from "@/components/LanguageSwitcher"

type AuthMode = 'browser' | 'local' | 'external' | 'checking'

export default function LoginPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [settings, setSettingsState] = useState<Settings | null>(null)
  const [authMode, setAuthMode] = useState<AuthMode>('checking')

  useEffect(() => {
    const loadedSettings = getSettings()
    setSettingsState(loadedSettings)
    setIsPageLoading(false)
    
    // Détecter le mode d'authentification
    checkAuthMode()
  }, [])

  // Pré-remplir les champs en mode DEMO
  useEffect(() => {
    if (authMode === 'browser') {
      setUsername('admin')
      setPassword('DEMO')
    }
  }, [authMode])

  const checkAuthMode = async () => {
    try {
      const response = await fetch('/api/auth/login')
      const data = await response.json()
      // Mode browser = localStorage, local/external = database
      setAuthMode(data.mode || 'browser')
    } catch {
      // Si l'API n'est pas disponible, utiliser le mode browser
      setAuthMode('browser')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      // Mode local ou external = authentification via DB
      if (authMode === 'local' || authMode === 'external') {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        })
        
        const data = await response.json()
        
        if (data.success) {
          setAuthenticated(true)
          router.push("/admin")
        } else {
          setError("login_error")
          setIsLoading(false)
        }
      } else {
        // Mode browser (DEMO): authentification avec identifiants fixes
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // En mode DEMO, les identifiants sont toujours admin/DEMO
        if (username === 'admin' && password === 'DEMO') {
          setAuthenticated(true)
          router.push("/admin")
        } else {
          setError("login_error")
          setIsLoading(false)
        }
      }
    } catch {
      setError("network_error")
      setIsLoading(false)
    }
  }

  const branding = settings?.branding
  const primaryColor = branding?.primaryColor || "#3b82f6"
  const isTransparent = primaryColor === "transparent"

  // Écran de chargement
  if (isPageLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gray-200 animate-pulse" />
          <div className="h-8 w-40 mx-auto mb-2 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-4 w-24 mx-auto bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Background avec dégradé dynamique */}
      <div 
        className="fixed inset-0 -z-10"
        style={{
          background: isTransparent 
            ? "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)"
            : `linear-gradient(135deg, ${primaryColor}15 0%, ${primaryColor}05 50%, #f8fafc 100%)`
        }}
      />
      
      {/* Pattern décoratif */}
      <div 
        className="fixed inset-0 -z-10 opacity-30"
        style={{
          backgroundImage: `radial-gradient(${isTransparent ? "#94a3b8" : primaryColor}20 1px, transparent 1px)`,
          backgroundSize: "32px 32px"
        }}
      />

      {/* Header minimaliste */}
      <header className="p-4 sm:p-6 flex items-center justify-between">
        <Link 
          href="/" 
          className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600 hover:text-gray-900 transition-colors group"
        >
          <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:-translate-x-1 transition-transform" />
          {t('common.back')}
        </Link>
        <LanguageSwitcher variant="compact" />
      </header>

      {/* Contenu principal */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo et titre */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="flex items-center justify-center gap-3 mb-3 sm:mb-4">
              {!isTransparent && (
                <div 
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center text-white shadow-lg"
                  style={{ backgroundColor: primaryColor }}
                >
                  {branding?.logoUrl ? (
                    <img 
                      src={branding.logoUrl} 
                      alt="Logo" 
                      className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
                    />
                  ) : (
                    <span className="text-xl sm:text-2xl">{branding?.logoIcon || "🏆"}</span>
                  )}
                </div>
              )}
              {isTransparent && branding?.logoUrl && (
                <img 
                  src={branding.logoUrl} 
                  alt="Logo" 
                  className="w-12 h-12 sm:w-14 sm:h-14 object-contain"
                />
              )}
              {isTransparent && !branding?.logoUrl && (
                <span className="text-4xl sm:text-5xl">{branding?.logoIcon || "🏆"}</span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">
              {branding?.siteName || "SportSlot"}
            </h1>
            <p className="text-sm sm:text-base text-gray-500">
              {t('admin.title')}
            </p>
          </div>

          {/* Carte de connexion */}
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-xl border border-white/50 p-5 sm:p-8">
            <div className="text-center mb-5 sm:mb-6">
              <div 
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full mx-auto mb-3 sm:mb-4 flex items-center justify-center"
                style={{ 
                  backgroundColor: isTransparent ? "#f1f5f9" : `${primaryColor}15`,
                }}
              >
                <Lock 
                  className="w-6 h-6 sm:w-7 sm:h-7" 
                  style={{ color: isTransparent ? "#64748b" : primaryColor }}
                />
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">{t('login.title')}</h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">{t('booking.subtitle')}</p>
            </div>

            {/* Encadré DEMO */}
            {authMode === 'browser' && (
              <div className="mb-5 sm:mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🎮</span>
                  <span className="font-semibold text-amber-800">{t('login.demoMode')}</span>
                </div>
                
                {/* Identifiants */}
                <div className="text-sm text-amber-700 space-y-1 mb-3 pb-3 border-b border-amber-200">
                  <p><span className="font-medium">{t('login.username')}:</span> admin</p>
                  <p><span className="font-medium">{t('login.password')}:</span> DEMO</p>
                </div>
                
                {/* Avertissement */}
                <div className="flex gap-2 text-xs text-amber-600">
                  <span className="shrink-0">⚠️</span>
                  <p>{t('login.demoWarning')}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="username" className="text-sm sm:text-base text-gray-700 font-medium">
                  {t('login.username')}
                </Label>
                <div className="relative">
                  <User className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t('login.username')}
                    className="pl-10 sm:pl-12 h-11 sm:h-12 bg-gray-50/50 border-gray-200 rounded-lg sm:rounded-xl focus:ring-2 focus:border-transparent transition-all text-sm sm:text-base"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="password" className="text-sm sm:text-base text-gray-700 font-medium">
                  {t('login.password')}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('login.password')}
                    className="pl-10 sm:pl-12 pr-10 sm:pr-12 h-11 sm:h-12 bg-gray-50/50 border-gray-200 rounded-lg sm:rounded-xl focus:ring-2 focus:border-transparent transition-all text-sm sm:text-base"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-xs sm:text-sm text-red-600 bg-red-50 p-3 sm:p-4 rounded-lg sm:rounded-xl border border-red-100 flex items-center gap-2">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error === "login_error" ? t('login.error') : error === "network_error" ? t('errors.networkError') : error}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full h-11 sm:h-12 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold transition-all shadow-lg hover:shadow-xl"
                style={{ 
                  backgroundColor: isTransparent ? "#1e293b" : primaryColor,
                  color: "white"
                }}
                disabled={isLoading || authMode === 'checking'}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {t('login.submitting')}
                  </span>
                ) : authMode === 'checking' ? (
                  t('common.loading')
                ) : (
                  t('login.submit')
                )}
              </Button>
            </form>
          </div>

          {/* Footer */}
          <div className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-gray-500">
            <p>{branding?.siteDescription || t('home.hero.subtitle')}</p>
          </div>
        </div>
      </main>

      {/* Footer avec informations de contact */}
      {(branding?.contactEmail || branding?.contactPhone) && (
        <footer className="p-4 sm:p-6 text-center text-xs sm:text-sm text-gray-500">
          <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
            {branding?.contactEmail && (
              <a 
                href={`mailto:${branding.contactEmail}`}
                className="hover:text-gray-700 transition-colors break-all"
              >
                {branding.contactEmail}
              </a>
            )}
            {branding?.contactPhone && (
              <a 
                href={`tel:${branding.contactPhone}`}
                className="hover:text-gray-700 transition-colors"
              >
                {branding.contactPhone}
              </a>
            )}
          </div>
        </footer>
      )}
    </div>
  )
}
