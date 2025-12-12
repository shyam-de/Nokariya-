'use client'

import { useLanguage } from '@/contexts/LanguageContext'

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()

  return (
    <div className="flex items-center gap-2 bg-white rounded-lg shadow-md p-1">
      <button
        onClick={() => setLanguage('en')}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          language === 'en' 
            ? 'bg-blue-500 text-white shadow-sm' 
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        English
      </button>
      <button
        onClick={() => setLanguage('hi')}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          language === 'hi' 
            ? 'bg-blue-500 text-white shadow-sm' 
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        हिंदी
      </button>
    </div>
  )
}

