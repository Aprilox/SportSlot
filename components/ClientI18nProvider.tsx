'use client';

import { ReactNode, useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import { i18next, determineLanguage, getUserLanguage } from '@/lib/i18n';

export default function ClientI18nProvider({ children }: { children: ReactNode }) {
  // Synchroniser la langue au chargement et quand les settings changent
  useEffect(() => {
    const syncLanguage = () => {
      // Si l'utilisateur n'a pas choisi de langue, utiliser la langue par défaut des settings
      const userLang = getUserLanguage();
      if (!userLang) {
        const lang = determineLanguage();
        if (i18next.language !== lang) {
          i18next.changeLanguage(lang);
        }
      }
    };

    // Sync initiale
    syncLanguage();

    // Écouter les changements de settings (quand DataLoader charge depuis la DB)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sportslot_settings') {
        syncLanguage();
      }
    };

    // Écouter aussi les événements custom (même onglet)
    const handleCustomStorage = () => {
      syncLanguage();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('storage', handleCustomStorage);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('storage', handleCustomStorage);
    };
  }, []);

  return <I18nextProvider i18n={i18next}>{children}</I18nextProvider>;
}
