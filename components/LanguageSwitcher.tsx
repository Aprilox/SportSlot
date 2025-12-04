'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { SUPPORTED_LANGUAGES, changeLanguage } from '@/lib/i18n';

interface LanguageSwitcherProps {
  variant?: 'default' | 'compact' | 'minimal';
  className?: string;
}

// Composant pour afficher un drapeau
const Flag = ({ code, className = "w-5 h-4" }: { code: string; className?: string }) => {
  const flags: Record<string, JSX.Element> = {
    fr: (
      <svg className={className} viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
        <path fill="#002654" d="M0 0h213.3v480H0z"/>
        <path fill="#fff" d="M213.3 0h213.4v480H213.3z"/>
        <path fill="#ce1126" d="M426.7 0H640v480H426.7z"/>
      </svg>
    ),
    en: (
      <svg className={className} viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
        <path fill="#012169" d="M0 0h640v480H0z"/>
        <path fill="#FFF" d="m75 0 244 181L562 0h78v62L400 241l240 178v61h-80L320 301 81 480H0v-60l239-178L0 64V0h75z"/>
        <path fill="#C8102E" d="m424 281 216 159v40L369 281h55zm-184 20 6 35L54 480H0l240-179zM640 0v3L391 191l2-44L590 0h50zM0 0l239 176h-60L0 42V0z"/>
        <path fill="#FFF" d="M241 0v480h160V0H241zM0 160v160h640V160H0z"/>
        <path fill="#C8102E" d="M0 193v96h640v-96H0zM273 0v480h96V0h-96z"/>
      </svg>
    ),
    de: (
      <svg className={className} viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
        <path fill="#000" d="M0 0h640v160H0z"/>
        <path fill="#D00" d="M0 160h640v160H0z"/>
        <path fill="#FFCE00" d="M0 320h640v160H0z"/>
      </svg>
    ),
    es: (
      <svg className={className} viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
        <path fill="#AA151B" d="M0 0h640v480H0z"/>
        <path fill="#F1BF00" d="M0 120h640v240H0z"/>
      </svg>
    ),
    it: (
      <svg className={className} viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
        <path fill="#009246" d="M0 0h213.3v480H0z"/>
        <path fill="#fff" d="M213.3 0h213.4v480H213.3z"/>
        <path fill="#ce2b37" d="M426.7 0H640v480H426.7z"/>
      </svg>
    ),
    pt: (
      <svg className={className} viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
        <path fill="#006600" d="M0 0h256v480H0z"/>
        <path fill="#FF0000" d="M256 0h384v480H256z"/>
        <circle fill="#FFCC00" cx="256" cy="240" r="80"/>
      </svg>
    ),
    nl: (
      <svg className={className} viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
        <path fill="#21468B" d="M0 0h640v480H0z"/>
        <path fill="#FFF" d="M0 0h640v320H0z"/>
        <path fill="#AE1C28" d="M0 0h640v160H0z"/>
      </svg>
    ),
  };

  return flags[code] || <span className="text-xs font-bold">{code.toUpperCase()}</span>;
};

export default function LanguageSwitcher({ variant = 'default', className = '' }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language) || SUPPORTED_LANGUAGES[0];

  // Fermer le dropdown si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectLanguage = (code: string) => {
    changeLanguage(code);
    setIsOpen(false);
  };

  // Version minimale - juste les drapeaux
  if (variant === 'minimal') {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        {SUPPORTED_LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleSelectLanguage(lang.code)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all p-1.5 ${
              i18n.language === lang.code
                ? 'bg-gray-200 scale-110 ring-2 ring-blue-500'
                : 'hover:bg-gray-100 opacity-70 hover:opacity-100'
            }`}
            title={lang.name}
          >
            <Flag code={lang.code} className="w-5 h-4 rounded-sm shadow-sm" />
          </button>
        ))}
      </div>
    );
  }

  // Version compacte - bouton avec dropdown
  if (variant === 'compact') {
    return (
      <div ref={dropdownRef} className={`relative ${className}`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900"
        >
          <Flag code={currentLang.code} className="w-5 h-4 rounded-sm shadow-sm" />
          <span className="text-sm font-medium">{currentLang.code.toUpperCase()}</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 py-1 min-w-[160px] z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleSelectLanguage(lang.code)}
                className={`w-full px-3 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                  i18n.language === lang.code ? 'bg-blue-50' : ''
                }`}
              >
                <Flag code={lang.code} className="w-6 h-4 rounded-sm shadow-sm" />
                <span className="text-sm flex-1 text-left font-medium">{lang.name}</span>
                {i18n.language === lang.code && (
                  <Check className="w-4 h-4 text-blue-600" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Version par défaut - bouton avec icône globe et dropdown
  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all text-gray-700"
      >
        <Globe className="w-4 h-4" />
        <Flag code={currentLang.code} className="w-5 h-4 rounded-sm shadow-sm" />
        <span className="text-sm font-medium">{currentLang.name}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-gray-200 py-2 min-w-[200px] z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider border-b mb-1 pb-2">
            Langue / Language
          </div>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelectLanguage(lang.code)}
              className={`w-full px-3 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                i18n.language === lang.code ? 'bg-blue-50' : ''
              }`}
            >
              <Flag code={lang.code} className="w-6 h-5 rounded-sm shadow-sm" />
              <div className="flex-1 text-left">
                <span className="text-sm font-medium">{lang.name}</span>
              </div>
              {i18n.language === lang.code && (
                <Check className="w-4 h-4 text-blue-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
