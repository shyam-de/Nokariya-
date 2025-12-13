'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import Chatbot from '@/components/Chatbot'
import { SessionStorage } from '@/lib/session'

interface User {
  id: string | number
  name: string
  email: string
  role: string
  [key: string]: any
}

export default function Home() {
  const router = useRouter()
  const { language, t } = useLanguage()
  const [isLoaded, setIsLoaded] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [dismissedAds, setDismissedAds] = useState<Set<number>>(new Set())
  const [currentAdIndex, setCurrentAdIndex] = useState(0)
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0)
  const [storiesPerPage, setStoriesPerPage] = useState(4)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Calculate stories per page based on screen size
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const updateStoriesPerPage = () => {
      const width = window.innerWidth
      if (width < 640) {
        setStoriesPerPage(1) // Mobile: 1 story
      } else if (width < 1024) {
        setStoriesPerPage(2) // Tablet: 2 stories
      } else {
        setStoriesPerPage(4) // Desktop: 4 stories
      }
    }
    
    updateStoriesPerPage()
    window.addEventListener('resize', updateStoriesPerPage)
    return () => window.removeEventListener('resize', updateStoriesPerPage)
  }, [])

  const [user, setUser] = useState<User | null>(null)

  // Helper function to get dashboard URL based on user role
  const getDashboardUrl = useMemo(() => {
    return (user: User | null): string => {
      if (!user) return '/login'
      const role = user.role?.toLowerCase()
      if (role === 'customer') return '/customer/dashboard'
      if (role === 'worker') return '/worker/dashboard'
      return '/admin/dashboard'
    }
  }, [])

  // Helper function to check if user has specific role
  const hasRole = useMemo(() => {
    return (user: User | null, role: string): boolean => {
      return user?.role?.toLowerCase() === role.toLowerCase()
    }
  }, [])

  useEffect(() => {
    // Check if user is already logged in - but don't redirect, allow them to see home page
    if (typeof window === 'undefined') {
      setIsLoaded(true)
      return
    }

    const token = SessionStorage.getToken()
    const userStr = SessionStorage.getUser()
    
    if (token && userStr) {
      try {
        const userObj = userStr as User
        setUser(userObj)
      } catch (e) {
        // Invalid user data, clear it and continue to show home page
        if (typeof window !== 'undefined') {
          SessionStorage.clear()
        }
        // Silently handle error - don't log in production
        if (process.env.NODE_ENV === 'development') {
          console.error('Error parsing user data:', e)
        }
      }
    }
    // Show page immediately (don't wait for API calls)
    setIsLoaded(true)
  }, [])

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8585/api'
  // Using fetch for public endpoints to avoid axios overhead

  // Advertisement data - fetched from API
  const [advertisements, setAdvertisements] = useState<Array<{
    id: number;
    title: string;
    text: string;
    linkUrl?: string;
    linkText?: string;
    imageUrl?: string;
  }>>([])

  // Success stories data - fetched from API
  const [successStories, setSuccessStories] = useState<Array<{
    id: number;
    title: string;
    description: string;
    customerName?: string;
    workerName?: string;
    laborType?: string;
    rating?: number;
    imageUrl?: string;
  }>>([])

  // Labor types data - fetched from API
  const [workerTypes, setLaborTypes] = useState<Array<{
    id: number;
    name: string;
    displayName?: string;
    icon?: string;
    description?: string;
    isActive: boolean;
    displayOrder: number;
  }>>([])

  // Fetch advertisements, success stories, and labor types in parallel for faster loading
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all data in parallel instead of sequentially
        const [adResponse, workerTypesResponse, storiesResponse] = await Promise.all([
          fetch(`${API_URL}/public/advertisements`).catch(() => null),
          fetch(`${API_URL}/public/worker-types`).catch(() => null),
          fetch(`${API_URL}/public/success-stories`).catch(() => null)
        ])

        // Process advertisements
        if (adResponse?.ok) {
          const ads = await adResponse.json()
          setAdvertisements(Array.isArray(ads) ? ads : [])
        }

        // Process worker types
        if (workerTypesResponse?.ok) {
          const types = await workerTypesResponse.json()
          setLaborTypes(Array.isArray(types) ? types.filter((lt: any) => lt.isActive) : [])
        }

        // Process success stories
        if (storiesResponse?.ok) {
          const stories = await storiesResponse.json()
          setSuccessStories(Array.isArray(stories) ? stories : [])
        }
      } catch (error) {
        // Silently handle errors - data will just not display
        // Log only in development
        if (process.env.NODE_ENV === 'development') {
          console.error('Error fetching data:', error)
        }
      }
    }
    fetchData()
  }, [API_URL])

  // Auto-slide success stories
  useEffect(() => {
    if (successStories.length <= storiesPerPage) return // No need to slide if all stories fit on one page
    
    const interval = setInterval(() => {
      setCurrentStoryIndex((prev) => {
        const maxIndex = Math.ceil(successStories.length / storiesPerPage) - 1
        return prev >= maxIndex ? 0 : prev + 1
      })
    }, 5000) // Change slide every 5 seconds
    
    return () => clearInterval(interval)
  }, [successStories.length, storiesPerPage])

  type SliderItem = {
    icon: string;
    title: string;
    description: string;
    color: string;
    isAd?: boolean;
    link?: string;
  }

  const sliderItems: SliderItem[] = [
    {
      icon: '⚡',
      title: language === 'hi' ? t('home.slider1Title') : 'Fast & Reliable Service',
      description: language === 'hi' ? t('home.slider1Description') : 'Get connected with verified workers in minutes, not days',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: '✅',
      title: language === 'hi' ? t('home.slider2Title') : 'Verified Workers Only',
      description: language === 'hi' ? t('home.slider2Description') : 'All workers are verified by our admin team for quality assurance',
      color: 'from-green-500 to-emerald-500'
    },
    {
      icon: '⭐',
      title: language === 'hi' ? t('home.slider3Title') : 'Rated & Reviewed',
      description: language === 'hi' ? t('home.slider3Description') : 'Rate and review workers to help others make informed decisions',
      color: 'from-purple-500 to-pink-500'
    }
  ]

  // Slider items (without advertisements - ads will show separately below)
  const allSliderItems: SliderItem[] = sliderItems

  // Auto-rotate slider
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % allSliderItems.length)
    }, 4000) // Change slide every 4 seconds
    return () => clearInterval(interval)
  }, [allSliderItems.length])

  // Auto-rotate advertisement slider
  useEffect(() => {
    const visibleAds = advertisements.filter(ad => !dismissedAds.has(ad.id || 0))
    if (visibleAds.length <= 1) return
    
    const interval = setInterval(() => {
      setCurrentAdIndex((prev) => (prev + 1) % visibleAds.length)
    }, 5000) // Change ad every 5 seconds
    return () => clearInterval(interval)
  }, [advertisements, dismissedAds])

  // Show page immediately, don't wait for all data to load
  // Content will appear progressively as data loads

  // Labor types are now fetched from API - use the state variable
  const displayLaborTypes = workerTypes
    .filter(lt => lt.isActive)
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
    .map(lt => ({
      icon: lt.icon || '🔧',
      name: lt.displayName || lt.name,
      desc: lt.description || ''
    }))

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {/* Floating Icons - More subtle */}
        <div className="absolute top-20 left-10 text-5xl opacity-5 animate-float-slow">⚡</div>
        <div className="absolute top-40 right-20 text-4xl opacity-5 animate-float-delayed">🔧</div>
        <div className="absolute bottom-40 left-20 text-5xl opacity-5 animate-float-slow">👷</div>
        <div className="absolute bottom-60 right-10 text-5xl opacity-5 animate-float-delayed">🪚</div>
        <div className="absolute top-1/2 left-1/4 text-4xl opacity-5 animate-float-slow">🎨</div>
        <div className="absolute top-1/3 right-1/4 text-5xl opacity-5 animate-float-delayed">💧</div>
        
        {/* Animated Gradient Orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-300 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-blob"></div>
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-blob animation-delay-4000"></div>
      </div>

      {/* Navigation */}
      <nav className="bg-white/90 backdrop-blur-md shadow-sm sticky top-0 z-50 border-b border-gray-200 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 md:h-16">
            <div className="flex items-center">
              <Link href="/" className="text-xl md:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent truncate hover:scale-105 transition-transform">
                KaamKart
              </Link>
              <span className="ml-2 md:ml-3 text-xs md:text-sm text-gray-500 hidden md:inline whitespace-nowrap" lang={language}>{t('home.subtitle')}</span>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-4">
              <LanguageSwitcher />
              {user ? (
                <>
                  <Link
                    href={getDashboardUrl(user)}
                    className="bg-gradient-to-r from-primary-600 to-indigo-600 text-white px-6 py-2 rounded-lg font-semibold hover:shadow-lg transition-all duration-200 hover:scale-105 transform"
                    lang={language}
                  >
                    {t('home.profile') || 'Profile'}
                  </Link>
                  <button
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        SessionStorage.clear()
                        window.location.href = '/'
                      }
                    }}
                    className="text-gray-700 hover:text-red-600 font-medium transition-all duration-200 hover:scale-105"
                    lang={language}
                  >
                    {t('home.logout')}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-gray-700 hover:text-primary-600 font-medium transition-all duration-200 hover:scale-105"
                    lang={language}
                  >
                    {t('home.login')}
                  </Link>
                  <Link
                    href="/login"
                    className="bg-gradient-to-r from-primary-600 to-indigo-600 text-white px-6 py-2 rounded-lg font-semibold hover:shadow-lg transition-all duration-200 hover:scale-105 transform"
                    lang={language}
                  >
                    {t('home.getStarted')}
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Navigation - Language Switcher and Hamburger */}
            <div className="lg:hidden flex items-center gap-2">
              <LanguageSwitcher />
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-gray-700 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all duration-200"
                aria-label="Toggle menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-gray-200 py-4 space-y-2 animate-slide-down">
              <div className="px-4 py-2">
                <LanguageSwitcher />
              </div>
              {user ? (
                <>
                  <Link
                    href={getDashboardUrl(user)}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all duration-200 font-medium"
                    lang={language}
                  >
                    {t('home.dashboard')}
                  </Link>
                  <button
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        SessionStorage.clear()
                        window.location.href = '/'
                      }
                    }}
                    className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all duration-200 font-medium"
                    lang={language}
                  >
                    {t('home.logout')}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all duration-200 font-medium"
                    lang={language}
                  >
                    {t('home.login')}
                  </Link>
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block w-full px-4 py-3 text-center bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all duration-200"
                    lang={language}
                  >
                    {t('home.getStarted')}
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Top Slider Banner - Below Navbar */}
      <div className="relative z-30 bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-600 text-white overflow-hidden mt-0">
        <div className="relative h-12 sm:h-13 md:h-14 flex items-center overflow-hidden">
          {/* Slider Container */}
          <div className="flex w-full h-full relative overflow-hidden">
            {allSliderItems.map((item, index) => {
              const content = (
                <div
                  key={index}
                  className={`absolute inset-0 flex items-center justify-center gap-2 sm:gap-3 px-2 sm:px-4 transition-all duration-500 ease-in-out will-change-transform ${
                    index === currentSlide
                      ? 'opacity-100 translate-x-0 z-10'
                      : index < currentSlide
                      ? 'opacity-0 -translate-x-full z-0 pointer-events-none'
                      : 'opacity-0 translate-x-full z-0 pointer-events-none'
                  }`}
                >
                  <span className={`text-xl sm:text-2xl md:text-3xl flex-shrink-0 ${item.isAd ? 'animate-pulse' : 'animate-bounce-slow'}`}>
                    {item.icon}
                  </span>
                  <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 md:gap-4 min-w-0 flex-1">
                    <span className={`font-bold text-xs sm:text-sm md:text-base ${item.isAd ? 'text-yellow-200' : ''} break-words min-w-0`}>
                      {item.title}
                    </span>
                    {item.description && (
                      <>
                        <span className="hidden sm:inline text-white/80 flex-shrink-0">•</span>
                        <span className="text-[10px] sm:text-xs md:text-sm text-white/90 text-center sm:text-left line-clamp-1 break-words min-w-0">{item.description}</span>
                      </>
                    )}
                  </div>
                  {item.isAd && (
                    <span className="ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-yellow-400 text-yellow-900 text-[10px] sm:text-xs font-bold rounded animate-pulse flex-shrink-0">
                      AD
                    </span>
                  )}
                </div>
              )

              return item.isAd && item.link ? (
                <Link key={`link-${index}`} href={item.link} className="w-full h-full absolute inset-0 z-10">
                  {content}
                </Link>
              ) : (
                <div key={`div-${index}`} className="absolute inset-0 w-full h-full">{content}</div>
              )
            })}
          </div>
          
          {/* Slider Indicators */}
          <div className="absolute right-2 sm:right-4 flex gap-1 sm:gap-2 z-10">
            {allSliderItems.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 ${
                  index === currentSlide ? 'w-4 sm:w-6 bg-white' : 'w-1.5 sm:w-2 bg-white/50'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
        
        {/* Animated Background Stripes */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent animate-slide-right"></div>
        </div>
      </div>

      {/* Advertisement Section - Below Slider (Single Ad Slider) */}
      {(() => {
        const visibleAds = advertisements.filter(ad => !dismissedAds.has(ad.id || 0))
        if (visibleAds.length === 0) return null
        
        const currentAd = visibleAds[currentAdIndex % visibleAds.length]
        
        return (
          <div className="relative z-20 bg-gradient-to-r from-yellow-50 via-orange-50 to-red-50 border-b border-yellow-200">
            <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4">
              <div className="relative flex items-center justify-center">
                <div
                  className="relative flex items-center gap-2 sm:gap-3 md:gap-4 px-3 sm:px-4 py-2 rounded-lg transition-all duration-300 hover:shadow-lg bg-white shadow-md max-w-4xl w-full"
                >
                  {/* Close/Dismiss Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (currentAd.id) {
                        setDismissedAds(prev => {
                          const newSet = new Set(prev)
                          newSet.add(currentAd.id)
                          return newSet
                        })
                        // Adjust index if needed
                        if (currentAdIndex >= visibleAds.length - 1) {
                          setCurrentAdIndex(0)
                        }
                      }
                    }}
                    className="absolute -top-2 -right-2 bg-gray-800 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-gray-900 transition-colors z-10 shadow-lg"
                    aria-label="Dismiss advertisement"
                    title="Close"
                  >
                    <span className="text-xs font-bold">×</span>
                  </button>
                  
                  <div
                    className={`flex items-center gap-3 md:gap-4 w-full ${currentAd.linkUrl ? 'cursor-pointer hover:scale-105' : ''}`}
                    onClick={() => {
                      if (currentAd.linkUrl) {
                        window.open(currentAd.linkUrl, '_blank', 'noopener,noreferrer')
                      }
                    }}
                  >
                    {currentAd.imageUrl && (
                      <img
                        src={currentAd.imageUrl}
                        alt={currentAd.title}
                        className="h-12 w-12 md:h-16 md:w-16 object-cover rounded-lg flex-shrink-0"
                      />
                    )}
                    <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4 flex-1 min-w-0">
                      <div className="text-center md:text-left min-w-0 flex-1">
                        {currentAd.title && (
                          <h3 className="text-sm md:text-base font-bold text-gray-900 mb-1 break-words">{currentAd.title}</h3>
                        )}
                        <p className="text-xs md:text-sm text-gray-700 font-medium break-words">{currentAd.text}</p>
                      </div>
                      {currentAd.linkUrl && currentAd.linkText && (
                        <span className="px-2 sm:px-4 py-1.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs md:text-sm font-semibold rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all whitespace-nowrap flex-shrink-0">
                          {currentAd.linkText} →
                        </span>
                      )}
                    </div>
                    <span className="px-2 py-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded animate-pulse flex-shrink-0">
                      AD
                    </span>
                  </div>
                </div>
                
                {/* Slider Indicators */}
                {visibleAds.length > 1 && (
                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-2">
                    {visibleAds.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentAdIndex(index)}
                        className={`h-2 rounded-full transition-all duration-300 ${
                          index === (currentAdIndex % visibleAds.length) ? 'w-6 bg-yellow-600' : 'w-2 bg-yellow-300'
                        }`}
                        aria-label={`Go to advertisement ${index + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32 relative z-10">
        <div className="text-center">
          <div className="inline-block mb-6 animate-bounce-slow">
              <span className="bg-gradient-to-r from-primary-100 to-indigo-100 text-primary-700 px-4 py-2 rounded-full text-sm font-semibold inline-flex items-center gap-2" lang={language}>
              <span className="animate-pulse">🚀</span> {t('home.badgeFast')} • <span className="animate-pulse">✅</span> {t('home.badgeVerified')} • <span className="animate-pulse">📍</span> {t('home.badgeLocation')}
            </span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight animate-fade-in-up" lang={language}>
            {t('home.heroTitle')}
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-600 mt-2 animate-gradient">
              {t('home.heroSubtitle')}
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-4 max-w-3xl mx-auto leading-relaxed" lang={language}>
            {t('home.heroDescription')}
          </p>
          <p className="text-lg text-gray-500 mb-10 max-w-2xl mx-auto" lang={language}>
            {t('home.heroSubDescription')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-slide-up delay-200">
            <Link
              href={getDashboardUrl(user)}
              className="group bg-gradient-to-r from-primary-600 to-indigo-600 text-white px-10 py-4 rounded-xl font-semibold text-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 transform relative overflow-hidden w-full sm:w-auto"
              lang={language}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                <span>🔍 {t('home.findWorkersNow')}</span>
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-primary-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </Link>
            <Link
              href={getDashboardUrl(user)}
              className="bg-white text-primary-600 px-10 py-4 rounded-xl font-semibold text-lg border-2 border-primary-600 hover:bg-primary-50 transition-all duration-300 hover:scale-105 transform shadow-lg hover:shadow-xl w-full sm:w-auto"
              lang={language}
            >
              👷 {t('home.joinAsWorker')}
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 bg-white/50 rounded-3xl mx-4 mb-20 relative z-10 backdrop-blur-sm">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 animate-fade-in-up" lang={language}>
            {t('home.howItWorksTitle')}
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto animate-fade-in-up animation-delay-200" lang={language}>
            {t('home.howItWorksSubtitle')}
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {/* Step 1 */}
          <div className="group bg-white rounded-2xl shadow-xl p-8 text-center hover:shadow-2xl transition-all duration-300 hover:-translate-y-3 transform border-2 border-transparent hover:border-primary-200 animate-fade-in-up animation-delay-400 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-500/0 via-primary-500/5 to-primary-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
            <div className="bg-gradient-to-br from-primary-100 to-indigo-100 w-24 h-24 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-lg animate-pulse-slow">
              <span className="text-5xl animate-bounce-slow">📝</span>
            </div>
            <div className="bg-primary-600 text-white w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-lg">
              1
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4 group-hover:text-primary-600 transition-colors" lang={language}>
              {t('home.step1Title')}
            </h3>
            <p className="text-gray-600 leading-relaxed" lang={language}>
              {t('home.step1Description')}
            </p>
          </div>

          {/* Step 2 */}
          <div className="group bg-white rounded-2xl shadow-xl p-8 text-center hover:shadow-2xl transition-all duration-300 hover:-translate-y-3 transform border-2 border-transparent hover:border-yellow-200 animate-fade-in-up animation-delay-600 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/0 via-yellow-500/5 to-yellow-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
            <div className="bg-gradient-to-br from-yellow-100 to-orange-100 w-24 h-24 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-lg animate-pulse-slow">
              <span className="text-5xl animate-bounce-slow animation-delay-300">🔔</span>
            </div>
            <div className="bg-yellow-500 text-white w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-lg">
              2
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4 group-hover:text-yellow-600 transition-colors" lang={language}>
              {t('home.step2Title')}
            </h3>
            <p className="text-gray-600 leading-relaxed" lang={language}>
              {t('home.step2Description')}
            </p>
          </div>

          {/* Step 3 */}
          <div className="group bg-white rounded-2xl shadow-xl p-8 text-center hover:shadow-2xl transition-all duration-300 hover:-translate-y-3 transform border-2 border-transparent hover:border-green-200 animate-fade-in-up animation-delay-800 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/0 via-green-500/5 to-green-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
            <div className="bg-gradient-to-br from-green-100 to-emerald-100 w-24 h-24 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-lg animate-pulse-slow">
              <span className="text-5xl animate-bounce-slow animation-delay-600">✅</span>
            </div>
            <div className="bg-green-500 text-white w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-lg">
              3
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4 group-hover:text-green-600 transition-colors" lang={language}>
              {t('home.step3Title')}
            </h3>
            <p className="text-gray-600 leading-relaxed" lang={language}>
              {t('home.step3Description')}
            </p>
          </div>
        </div>
      </section>

      {/* Worker Types Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 animate-fade-in-up" lang={language}>
            {t('home.workerTypesTitle')}
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto animate-fade-in-up animation-delay-200" lang={language}>
            {t('home.workerTypesSubtitle')}
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {displayLaborTypes.map((type, index) => (
            <div
              key={index}
              className="group bg-white border-2 border-gray-200 rounded-2xl p-6 hover:border-primary-400 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 transform cursor-pointer bg-gradient-to-br from-white to-gray-50 relative overflow-hidden animate-fade-in-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500/0 to-indigo-500/0 group-hover:from-primary-500/5 group-hover:to-indigo-500/5 transition-all duration-300"></div>
              <div className="text-6xl mb-4 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300 text-center relative z-10 animate-float-slow" style={{ animationDelay: `${index * 200}ms` }}>
                {type.icon}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2 text-center group-hover:text-primary-600 transition-colors relative z-10">
                {type.name}
              </h3>
              <p className="text-sm text-gray-600 text-center leading-relaxed relative z-10">
                {type.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6" lang={language}>
              {t('home.whyChooseTitle')}
            </h2>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="bg-primary-100 rounded-lg p-3">
                  <span className="text-2xl">✅</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2" lang={language}>{t('home.benefit1Title')}</h3>
                  <p className="text-gray-600" lang={language}>{t('home.benefit1Description')}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="bg-indigo-100 rounded-lg p-3">
                  <span className="text-2xl">📍</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2" lang={language}>{t('home.benefit2Title')}</h3>
                  <p className="text-gray-600" lang={language}>{t('home.benefit2Description')}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="bg-green-100 rounded-lg p-3">
                  <span className="text-2xl">⚡</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2" lang={language}>{t('home.benefit3Title')}</h3>
                  <p className="text-gray-600" lang={language}>{t('home.benefit3Description')}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="bg-yellow-100 rounded-lg p-3">
                  <span className="text-2xl">⭐</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2" lang={language}>{t('home.benefit4Title')}</h3>
                  <p className="text-gray-600" lang={language}>{t('home.benefit4Description')}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-primary-50 to-indigo-50 rounded-3xl p-8 lg:p-12 border-2 border-primary-100 relative overflow-hidden animate-fade-in-up animation-delay-400">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-400/10 via-transparent to-indigo-400/10 animate-gradient-shift"></div>
            <div className="text-center relative z-10">
              <div className="text-8xl mb-6 animate-bounce-slow">🎯</div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4" lang={language}>{t('home.trustedTitle')}</h3>
              <p className="text-xl text-gray-600 mb-8" lang={language}>
                {t('home.trustedDescription')}
              </p>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="animate-count-up">
                  <div className="text-3xl font-bold text-primary-600 animate-pulse-slow">1000+</div>
                  <div className="text-sm text-gray-600" lang={language}>{t('home.workersCount')}</div>
                </div>
                <div className="animate-count-up animation-delay-200">
                  <div className="text-3xl font-bold text-indigo-600 animate-pulse-slow">500+</div>
                  <div className="text-sm text-gray-600" lang={language}>{t('home.customersCount')}</div>
                </div>
                <div className="animate-count-up animation-delay-400">
                  <div className="text-3xl font-bold text-purple-600 animate-pulse-slow">2000+</div>
                  <div className="text-sm text-gray-600" lang={language}>{t('home.jobsDoneCount')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Success Stories Section */}
      {successStories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 animate-fade-in-up" lang={language}>
              {t('home.successStoriesTitle')}
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto animate-fade-in-up animation-delay-200" lang={language}>
              {t('home.successStoriesSubtitle')}
            </p>
          </div>
          <div className="relative">
            {/* Previous Button */}
            {successStories.length > storiesPerPage && (
              <button
                onClick={() => {
                  setCurrentStoryIndex((prev) => Math.max(0, prev - 1))
                }}
                disabled={currentStoryIndex === 0}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-gray-800 text-white rounded-full w-10 h-10 md:w-12 md:h-12 flex items-center justify-center hover:bg-gray-900 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Previous stories"
              >
                <span className="text-xl md:text-2xl font-bold">‹</span>
              </button>
            )}
            
            {/* Stories Container */}
            <div className="overflow-hidden">
              <div
                className="flex gap-4 md:gap-6 lg:gap-8 transition-transform duration-500 ease-in-out"
                style={{
                  transform: `translateX(calc(-${currentStoryIndex} * ((100% + ${(storiesPerPage - 1) * 1.5}rem) / ${storiesPerPage})))`
                }}
              >
                {successStories.map((story, index) => (
                  <div
                    key={story.id}
                    className="flex-shrink-0"
                    style={{ 
                      width: `calc((100% - ${(storiesPerPage - 1) * 1.5}rem) / ${storiesPerPage})`,
                      minWidth: `calc((100% - ${(storiesPerPage - 1) * 1.5}rem) / ${storiesPerPage})`,
                      flexBasis: `calc((100% - ${(storiesPerPage - 1) * 1.5}rem) / ${storiesPerPage})`
                    }}
                  >
                    <div className="bg-white rounded-2xl shadow-xl p-4 md:p-6 lg:p-8 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 transform border-2 border-gray-100 h-full flex flex-col">
                      {story.imageUrl && (
                        <div className="mb-4 md:mb-6 rounded-xl overflow-hidden flex-shrink-0">
                          <img
                            src={story.imageUrl}
                            alt={story.title}
                            className="w-full h-32 md:h-40 lg:h-48 object-cover"
                          />
                        </div>
                      )}
                      <div className="flex items-center gap-2 mb-3 md:mb-4 flex-wrap">
                        {story.rating && (
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <span
                                key={i}
                                className={`text-sm md:text-base lg:text-xl ${
                                  i < story.rating! ? 'text-yellow-400' : 'text-gray-300'
                                }`}
                              >
                                ⭐
                              </span>
                            ))}
                          </div>
                        )}
                        {story.laborType && (
                          <span className="text-xs md:text-sm text-gray-500 bg-gray-100 px-2 md:px-3 py-1 rounded-full">
                            {story.laborType}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base md:text-lg lg:text-xl xl:text-2xl font-bold text-gray-900 mb-2 md:mb-3 line-clamp-2 break-words">{story.title}</h3>
                      <p className="text-xs md:text-sm lg:text-base text-gray-600 mb-3 md:mb-4 leading-relaxed line-clamp-3 flex-grow break-words">{story.description}</p>
                      {(story.customerName || story.workerName) && (
                        <div className="pt-4 border-t border-gray-200">
                          {story.customerName ? (
                            <p className="text-sm text-gray-500 break-words">
                              <span className="font-semibold" lang={language}>{t('home.customerLabel')}:</span> {story.customerName}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-500 break-words">
                              <span className="font-semibold" lang={language}>{t('home.workerLabel')}:</span> {story.workerName}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Next Button */}
            {successStories.length > storiesPerPage && (
              <button
                onClick={() => {
                  const maxIndex = Math.ceil(successStories.length / storiesPerPage) - 1
                  setCurrentStoryIndex((prev) => Math.min(maxIndex, prev + 1))
                }}
                disabled={currentStoryIndex >= Math.ceil(successStories.length / storiesPerPage) - 1}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-gray-800 text-white rounded-full w-10 h-10 md:w-12 md:h-12 flex items-center justify-center hover:bg-gray-900 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Next stories"
              >
                <span className="text-xl md:text-2xl font-bold">›</span>
              </button>
            )}
            
            {/* Slider Indicators */}
            {successStories.length > storiesPerPage && (
              <div className="flex justify-center gap-2 mt-8">
                {Array.from({ length: Math.ceil(successStories.length / storiesPerPage) }).map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentStoryIndex(index)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      index === currentStoryIndex ? 'w-8 bg-primary-600' : 'w-2 bg-gray-300'
                    }`}
                    aria-label={`Go to page ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
        <div className="bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-600 rounded-3xl p-12 lg:p-16 text-center text-white shadow-2xl transform hover:scale-[1.02] transition-transform duration-300 relative overflow-hidden animate-fade-in-up">
          <div className="absolute inset-0 bg-black/10"></div>
          {/* Animated gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-600 animate-gradient-shift opacity-75"></div>
          {/* Floating particles */}
          <div className="absolute top-10 left-10 w-3 h-3 bg-white/30 rounded-full animate-float-slow"></div>
          <div className="absolute top-20 right-20 w-2 h-2 bg-white/40 rounded-full animate-float-delayed"></div>
          <div className="absolute bottom-20 left-20 w-4 h-4 bg-white/20 rounded-full animate-float-slow animation-delay-2000"></div>
          <div className="absolute bottom-10 right-10 w-3 h-3 bg-white/30 rounded-full animate-float-delayed animation-delay-4000"></div>
          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-bold mb-4" lang={language}>{t('home.readyToGetStarted')}</h2>
            <p className="text-xl md:text-2xl mb-8 opacity-95 max-w-2xl mx-auto" lang={language}>
              {t('home.joinThousands')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {user ? (
                <Link
                  href={getDashboardUrl(user)}
                  className="bg-white text-primary-600 px-10 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-all duration-200 hover:scale-110 transform shadow-2xl"
                  lang={language}
                >
                  🚀 {t('home.goToDashboard') || 'Go to Dashboard'}
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="bg-white text-primary-600 px-10 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-all duration-200 hover:scale-110 transform shadow-2xl"
                  lang={language}
                >
                  🚀 {t('home.register') || 'Sign Up Now - It\'s Free!'}
                </Link>
              )}
              {user ? (
                <Link
                  href={getDashboardUrl(user)}
                  className="bg-transparent border-3 border-white text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-white hover:text-primary-600 transition-all duration-200 hover:scale-110 transform"
                  lang={language}
                >
                  👤 {t('home.myAccount') || 'My Account'}
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="bg-transparent border-3 border-white text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-white hover:text-primary-600 transition-all duration-200 hover:scale-110 transform"
                  lang={language}
                >
                  🔑 {t('home.login')}
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-primary-400 to-indigo-400 bg-clip-text text-transparent mb-4">
                KaamKart
              </h3>
              <p className="text-gray-400" lang={language}>
                {t('home.footerTagline') || 'Your trusted platform for connecting with skilled workers and getting work done efficiently.'}
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4" lang={language}>{t('home.quickLinks') || 'Quick Links'}</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/login" className="hover:text-white transition-colors" lang={language}>{t('home.findWorkers') || 'Find Workers'}</Link></li>
                <li><Link href="/login" className="hover:text-white transition-colors" lang={language}>{t('home.joinAsWorker') || 'Join as Worker'}</Link></li>
                <li><Link href="/login" className="hover:text-white transition-colors" lang={language}>{t('common.login') || 'Login'}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4" lang={language}>{t('home.support') || 'Support'}</h4>
              <ul className="space-y-2 text-gray-400">
                <li>📧 support@kaamkart.com</li>
                <li>📞 +91 1234567890</li>
                <li lang={language}>📍 {t('home.available247') || 'Available 24/7'}</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-gray-400">
            <p lang={language}>{t('home.allRightsReserved') || '© 2024 KaamKart. All rights reserved. Made with ❤️ for connecting workers and customers.'}</p>
          </div>
        </div>
      </footer>
      
      {/* Chatbot */}
      <Chatbot user={user} />
    </div>
  )
}
