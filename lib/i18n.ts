import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import fr from '../locales/fr.json';
import de from '../locales/de.json';

// Liste des langues supportées
export const SUPPORTED_LANGUAGES = [
  { code: 'fr', name: 'Français', flag: 'FR' },
  { code: 'en', name: 'English', flag: 'EN' },
  { code: 'de', name: 'Deutsch', flag: 'DE' },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

// Clé localStorage pour la langue utilisateur
const USER_LANGUAGE_KEY = 'sportslot_user_language';

// Récupérer la langue sauvegardée par l'utilisateur
export const getUserLanguage = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(USER_LANGUAGE_KEY);
};

// Sauvegarder la langue choisie par l'utilisateur
export const saveUserLanguage = (lang: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_LANGUAGE_KEY, lang);
};

// Récupérer la langue par défaut depuis les settings
export const getDefaultLanguage = (): string => {
  if (typeof window === 'undefined') return 'fr';
  try {
    const settings = localStorage.getItem('sportslot_settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      return parsed.branding?.defaultLanguage || 'fr';
    }
  } catch {
    // Ignore
  }
  return 'fr';
};

// Déterminer la langue à utiliser
export const determineLanguage = (): string => {
  // 1. Langue choisie par l'utilisateur (prioritaire)
  const userLang = getUserLanguage();
  if (userLang && SUPPORTED_LANGUAGES.some(l => l.code === userLang)) {
    return userLang;
  }
  
  // 2. Langue par défaut configurée par l'admin
  const defaultLang = getDefaultLanguage();
  if (SUPPORTED_LANGUAGES.some(l => l.code === defaultLang)) {
    return defaultLang;
  }
  
  // 3. Fallback
  return 'fr';
};

// Initialiser i18next
const initI18n = () => {
  const initialLanguage = typeof window !== 'undefined' ? determineLanguage() : 'fr';
  
  i18next.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      de: { translation: de },
    },
    lng: initialLanguage,
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });
};

initI18n();

// Fonction pour changer la langue
export const changeLanguage = (lang: string): void => {
  if (SUPPORTED_LANGUAGES.some(l => l.code === lang)) {
    saveUserLanguage(lang);
    i18next.changeLanguage(lang);
  }
};

// Fonction pour réinitialiser à la langue par défaut (efface la préférence utilisateur)
export const resetToDefaultLanguage = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(USER_LANGUAGE_KEY);
  const defaultLang = getDefaultLanguage();
  i18next.changeLanguage(defaultLang);
};

export { i18next };
export default i18next;
