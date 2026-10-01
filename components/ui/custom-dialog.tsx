'use client'

import * as React from 'react'
import { createContext, useContext, useState, useCallback } from 'react'
import { X, AlertCircle, CheckCircle, AlertTriangle, Info, HelpCircle } from 'lucide-react'

// ===========================================
// TYPES
// ===========================================

type DialogType = 'alert' | 'confirm' | 'prompt'
type DialogVariant = 'info' | 'success' | 'warning' | 'error' | 'question'

interface DialogButton {
  label: string
  variant?: 'primary' | 'secondary' | 'danger'
  onClick?: () => void
}

interface DialogConfig {
  type: DialogType
  variant?: DialogVariant
  title?: string
  message: string
  placeholder?: string // Pour prompt
  defaultValue?: string // Pour prompt
  confirmText?: string
  cancelText?: string
  onConfirm?: (value?: string) => void
  onCancel?: () => void
}

interface DialogContextType {
  showAlert: (message: string, options?: Partial<DialogConfig>) => Promise<void>
  showConfirm: (message: string, options?: Partial<DialogConfig>) => Promise<boolean>
  showPrompt: (message: string, options?: Partial<DialogConfig>) => Promise<string | null>
  showDialog: (config: DialogConfig) => Promise<string | boolean | void>
}

// ===========================================
// CONTEXT
// ===========================================

const DialogContext = createContext<DialogContextType | null>(null)

export function useDialog() {
  const context = useContext(DialogContext)
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider')
  }
  return context
}

// ===========================================
// ICONS
// ===========================================

const icons: Record<DialogVariant, React.ReactNode> = {
  info: <Info className="w-6 h-6 text-blue-500" />,
  success: <CheckCircle className="w-6 h-6 text-green-500" />,
  warning: <AlertTriangle className="w-6 h-6 text-amber-500" />,
  error: <AlertCircle className="w-6 h-6 text-red-500" />,
  question: <HelpCircle className="w-6 h-6 text-purple-500" />,
}

const bgColors: Record<DialogVariant, string> = {
  info: 'bg-blue-50',
  success: 'bg-green-50',
  warning: 'bg-amber-50',
  error: 'bg-red-50',
  question: 'bg-purple-50',
}

const borderColors: Record<DialogVariant, string> = {
  info: 'border-blue-200',
  success: 'border-green-200',
  warning: 'border-amber-200',
  error: 'border-red-200',
  question: 'border-purple-200',
}

// ===========================================
// DIALOG COMPONENT
// ===========================================

interface DialogState extends DialogConfig {
  isOpen: boolean
  resolve: (value: any) => void
}

function DialogModal({ state, onClose }: { state: DialogState | null; onClose: (result: any) => void }) {
  const [inputValue, setInputValue] = useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (state?.isOpen && state.type === 'prompt') {
      setInputValue(state.defaultValue || '')
      // Focus l'input après un court délai pour l'animation
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [state?.isOpen, state?.type, state?.defaultValue])

  // Fermer avec Escape
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state?.isOpen) {
        onClose(state.type === 'confirm' ? false : state.type === 'prompt' ? null : undefined)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [state?.isOpen, state?.type, onClose])

  if (!state?.isOpen) return null

  const variant = state.variant || (state.type === 'confirm' ? 'question' : 'info')
  const title = state.title || (
    variant === 'error' ? 'Erreur' :
    variant === 'warning' ? 'Attention' :
    variant === 'success' ? 'Succès' :
    variant === 'question' ? 'Confirmation' :
    'Information'
  )

  const handleConfirm = () => {
    if (state.type === 'prompt') {
      onClose(inputValue)
    } else if (state.type === 'confirm') {
      onClose(true)
    } else {
      onClose(undefined)
    }
  }

  const handleCancel = () => {
    if (state.type === 'confirm') {
      onClose(false)
    } else if (state.type === 'prompt') {
      onClose(null)
    } else {
      onClose(undefined)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && state.type === 'prompt') {
      handleConfirm()
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={handleCancel}
      />
      
      {/* Dialog */}
      <div className="relative w-full max-w-md animate-in zoom-in-95 fade-in duration-200">
        <div className={`relative bg-white rounded-2xl shadow-2xl overflow-hidden border-2 ${borderColors[variant]}`}>
          {/* Header avec icône */}
          <div className={`${bgColors[variant]} px-6 py-4 flex items-center gap-3`}>
            <div className="flex-shrink-0">
              {icons[variant]}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 flex-1">
              {title}
            </h3>
            <button
              onClick={handleCancel}
              className="flex-shrink-0 p-1 rounded-lg hover:bg-black/10 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-5">
            <p className="text-gray-700 text-base leading-relaxed whitespace-pre-wrap">
              {state.message}
            </p>

            {/* Input pour prompt */}
            {state.type === 'prompt' && (
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={state.placeholder || 'Entrez votre réponse...'}
                className="mt-4 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 placeholder:text-gray-400"
              />
            )}
          </div>

          {/* Actions */}
          <div className="px-6 py-4 bg-gray-50 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            {(state.type === 'confirm' || state.type === 'prompt') && (
              <button
                onClick={handleCancel}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-medium text-gray-700 bg-white border-2 border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all"
              >
                {state.cancelText || 'Annuler'}
              </button>
            )}
            <button
              onClick={handleConfirm}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-medium text-white transition-all ${
                variant === 'error' 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : variant === 'warning'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : variant === 'success'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {state.confirmText || (state.type === 'alert' ? 'OK' : 'Confirmer')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===========================================
// PROVIDER
// ===========================================

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialogState, setDialogState] = useState<DialogState | null>(null)

  const showDialog = useCallback((config: DialogConfig): Promise<any> => {
    return new Promise((resolve) => {
      setDialogState({
        ...config,
        isOpen: true,
        resolve,
      })
    })
  }, [])

  const handleClose = useCallback((result: any) => {
    if (dialogState) {
      dialogState.resolve(result)
      setDialogState(null)
    }
  }, [dialogState])

  const showAlert = useCallback((message: string, options?: Partial<DialogConfig>): Promise<void> => {
    return showDialog({
      type: 'alert',
      message,
      ...options,
    }) as Promise<void>
  }, [showDialog])

  const showConfirm = useCallback((message: string, options?: Partial<DialogConfig>): Promise<boolean> => {
    return showDialog({
      type: 'confirm',
      message,
      ...options,
    }) as Promise<boolean>
  }, [showDialog])

  const showPrompt = useCallback((message: string, options?: Partial<DialogConfig>): Promise<string | null> => {
    return showDialog({
      type: 'prompt',
      message,
      ...options,
    }) as Promise<string | null>
  }, [showDialog])

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm, showPrompt, showDialog }}>
      {children}
      <DialogModal state={dialogState} onClose={handleClose} />
    </DialogContext.Provider>
  )
}

// ===========================================
// EXPORT PAR DÉFAUT
// ===========================================

export { DialogContext }
export type { DialogConfig, DialogType, DialogVariant }

