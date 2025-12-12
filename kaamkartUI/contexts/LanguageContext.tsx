'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Language = 'en' | 'hi'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

// Import translations
const translations = {
  en: require('../messages/en.json'),
  hi: require('../messages/hi.json')
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Load saved language preference
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('language') as Language
      if (saved && (saved === 'en' || saved === 'hi')) {
        setLanguageState(saved)
      }
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', lang)
      // Update HTML lang attribute
      document.documentElement.lang = lang
    }
  }

  const t = (key: string): string => {
    try {
      const keys = key.split('.')
      let value: any = translations[language]
      for (const k of keys) {
        value = value?.[k]
        if (value === undefined) break
      }
      return value || key
    } catch (error) {
      return key
    }
  }

  // Prevent hydration mismatch
  if (!mounted) {
    return <>{children}</>
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    // Return default values during SSR or if provider is not available
    const defaultT = (key: string) => key
    return {
      language: 'en' as Language,
      setLanguage: () => {},
      t: defaultT
    }
  }
  return context
}

