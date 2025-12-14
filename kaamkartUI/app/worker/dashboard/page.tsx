'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useLanguage } from '@/contexts/LanguageContext'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import Chatbot from '@/components/Chatbot'
import { apiClient } from '@/lib/api'
import { SessionStorage } from '@/lib/session'
import { useAutoLogout } from '@/hooks/useAutoLogout'
import { logger } from '@/lib/logger'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8585/api'

interface Request {
  id: string
  laborTypes: string[]
  startDate?: string
  endDate?: string
  workType: string
  numberOfWorkers: number
  location: {
    latitude: number
    longitude: number
    address: string
  }
  customer?: {
    id: string
    name: string
    phone: string
    email?: string
  }
  status: string
  distance?: string
  createdAt: string
  completedAt?: string
  customerRating?: number
  workerConfirmed?: boolean
}

interface WorkHistory {
  type: string
  requestId: string
  laborTypes: string[]
  startDate?: string
  endDate?: string
  workType: string
  location: {
    latitude: number
    longitude: number
    address: string
  }
  status: string
  date: string
  customer: {
    id: string
    name: string
    phone: string
  }
}

interface Profile {
  id: string
  name: string
  email: string
  phone: string
  location?: {
    latitude: number
    longitude: number
    address: string
  }
}

interface User {
  id: string
  name: string
  email: string
  role: string
  rating?: number
  totalRatings?: number
}

export default function WorkerDashboard() {
  const router = useRouter()
  const { t, language } = useLanguage()
  const [requests, setRequests] = useState<Request[]>([])
  const [workHistory, setWorkHistory] = useState<WorkHistory[]>([])
  const [available, setAvailable] = useState(true)
  const [ratedRequests, setRatedRequests] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [isToggling, setIsToggling] = useState(false)
  const [activeTab, setActiveTab] = useState<'available' | 'activeWork' | 'history' | 'concerns'>('available')
  const [activeWork, setActiveWork] = useState<any[]>([])
  const [isLoadingActiveWork, setIsLoadingActiveWork] = useState(false)
  const [myConcerns, setMyConcerns] = useState<any[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [isLoadingConcerns, setIsLoadingConcerns] = useState(false)
  const [dataLoaded, setDataLoaded] = useState({
    requests: false,
    activeWork: false,
    workHistory: false,
    concerns: false
  })
  const [isUpdatingConcernStatus, setIsUpdatingConcernStatus] = useState(false)
  const [editingConcern, setEditingConcern] = useState<{id: string, status: string, message: string} | null>(null)
  const [concernMessages, setConcernMessages] = useState<{[key: string]: any[]}>({})
  const [isLoadingMessages, setIsLoadingMessages] = useState<{[key: string]: boolean}>({})
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [showConcernModal, setShowConcernModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null)
  const [selectedActiveWork, setSelectedActiveWork] = useState<any | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [isSubmittingRating, setIsSubmittingRating] = useState(false)
  const [location, setLocation] = useState<{latitude: number, longitude: number} | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    secondaryPhone: '',
    location: {
      latitude: 0,
      longitude: 0,
      address: ''
    }
  })
  const [ratingData, setRatingData] = useState({
    rating: 5,
    comment: ''
  })
  const [concernData, setConcernData] = useState({
    requestId: '',
    relatedToUserId: '',
    description: '',
    type: 'OTHER' as 'WORK_QUALITY' | 'PAYMENT_ISSUE' | 'BEHAVIOR' | 'SAFETY' | 'OTHER'
  })
  const [isSubmittingConcern, setIsSubmittingConcern] = useState(false)

  // Auto-logout after 30 minutes of inactivity
  useAutoLogout()

  useEffect(() => {
    // SSR guard
    if (typeof window === 'undefined') return

    const token = SessionStorage.getToken()
    const userData = SessionStorage.getUser()
    
    if (!token || !userData) {
      router.push('/')
      return
    }

    try {
      // Handle case where userData might not be a string
      const userStr = typeof userData === 'string' ? userData : JSON.stringify(userData)
      const userObj = JSON.parse(userStr) as User
      setUser(userObj)
    } catch (error) {
      // Invalid user data, clear and redirect
      logger.error('Error parsing user data:', error)
      SessionStorage.clear()
      router.push('/')
      return
    }

    // Get location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          }
          setLocation(loc)
          updateLocation(loc)
        },
        () => {
          toast.error('Unable to get location')
        }
      )
    }

    fetchAvailableRequests()
    fetchWorkerProfile()
    fetchWorkHistory()
    fetchProfile()
    fetchMyConcerns()
    fetchActiveWork()
    
    // Check for chatbot data in sessionStorage
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const action = urlParams.get('action')
      
      if (action === 'raiseConcern') {
        const chatbotData = sessionStorage.getItem('chatbotConcernData')
        if (chatbotData) {
          try {
            const data = JSON.parse(chatbotData)
            setConcernData({
              type: data.type || 'OTHER',
              description: data.description || '',
              requestId: '',
              relatedToUserId: ''
            })
            setShowConcernModal(true)
            sessionStorage.removeItem('chatbotConcernData')
            // Clean URL
            window.history.replaceState({}, '', '/worker/dashboard')
            toast.success(t('chatbot.concernFormOpened') || 'Concern form opened with your details!')
          } catch (e) {
            logger.error('Error parsing chatbot data:', e)
          }
        }
      }
    }
  }, [])

  const fetchProfile = async () => {
    try {
      const token = SessionStorage.getToken()
      const response = await axios.get(`${API_URL}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setProfile(response.data)
      setProfileData({
        name: response.data.name,
        email: response.data.email,
        phone: response.data.phone,
        secondaryPhone: response.data.secondaryPhone || '',
        location: response.data.location || { latitude: 0, longitude: 0, address: '' }
      })
    } catch (error) {
      logger.error('Error fetching profile:', error)
    }
  }

  const updateLocation = async (loc: {latitude: number, longitude: number}) => {
    try {
      const token = SessionStorage.getToken()
      await axios.put(
        `${API_URL}/workers/location`,
        {
          latitude: loc.latitude,
          longitude: loc.longitude,
          address: 'Current Location'
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )
    } catch (error) {
      logger.error('Error updating location:', error)
    }
  }

  const fetchWorkerProfile = async () => {
    try {
      const token = SessionStorage.getToken()
      const response = await axios.get(`${API_URL}/workers/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setAvailable(response.data.available)
    } catch (error) {
      logger.error('Error fetching profile:', error)
    }
  }

  const fetchAvailableRequests = async () => {
    setIsLoading(true)
    try {
      const token = SessionStorage.getToken()
      const response = await axios.get(`${API_URL}/requests/available`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setRequests(response.data)
      setDataLoaded(prev => ({ ...prev, requests: true }))
    } catch (error) {
      logger.error('Error fetching requests:', error)
      toast.error(t('worker.error'))
      setDataLoaded(prev => ({ ...prev, requests: true }))
    } finally {
      setIsLoading(false)
    }
  }

  const fetchWorkHistory = async () => {
    setIsLoadingHistory(true)
    try {
      const token = SessionStorage.getToken()
      const response = await axios.get(`${API_URL}/workers/history`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      // Filter out DEPLOYED and CONFIRMED - these should only show in Active Work tab
      const historyData = (response.data || []).filter((work: any) => 
        work.status !== 'DEPLOYED' && work.status !== 'CONFIRMED' && work.status !== 'ADMIN_APPROVED'
      )
      setWorkHistory(historyData)
      setDataLoaded(prev => ({ ...prev, workHistory: true }))
      
      // Check which completed requests have been rated
      const ratedSet = new Set<string>()
      for (const work of historyData) {
        if (work.status === 'COMPLETED') {
          try {
            const ratingCheck = await axios.get(`${API_URL}/ratings/check/${work.requestId}`, {
              headers: { Authorization: `Bearer ${token}` }
            })
            if (ratingCheck.data.hasRated) {
              ratedSet.add(work.requestId)
            }
          } catch (error) {
            // Ignore errors for rating check
            logger.error('Error checking rating:', error)
          }
        }
      }
      setRatedRequests(ratedSet)
    } catch (error) {
      logger.error('Error fetching work history:', error)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const fetchActiveWork = async () => {
    setIsLoadingActiveWork(true)
    try {
      // Fetch from work history and filter for active/deployed work
      // Since /api/workers/active-work endpoint doesn't exist, we use history endpoint
      const token = SessionStorage.getToken()
      const historyResponse = await axios.get(`${API_URL}/workers/history`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      // Filter for active work: DEPLOYED, CONFIRMED, or ADMIN_APPROVED statuses
      const deployedWork = (historyResponse.data || []).filter((work: any) => 
        work.status === 'DEPLOYED' || work.status === 'CONFIRMED' || work.status === 'ADMIN_APPROVED'
      )
      setActiveWork(deployedWork)
      setDataLoaded(prev => ({ ...prev, activeWork: true }))
    } catch (error: any) {
      logger.error('Error fetching active work from history:', error)
      // Only show error for non-500 errors (401, 403, etc.)
      if (error.response?.status !== 500 && error.response?.status !== 404) {
        toast.error(error.response?.data?.message || t('worker.error') || 'Failed to fetch active work', { id: 'active-work-error' })
      }
      setActiveWork([])
      setDataLoaded(prev => ({ ...prev, activeWork: true }))
    } finally {
      setIsLoadingActiveWork(false)
    }
  }

  const fetchMyConcerns = async () => {
    setIsLoadingConcerns(true)
    try {
      const token = SessionStorage.getToken()
      const response = await axios.get(`${API_URL}/concerns/my-concerns`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setMyConcerns(response.data)
      setDataLoaded(prev => ({ ...prev, concerns: true }))
      // Fetch messages for all concerns
      response.data.forEach((concern: any) => {
        fetchConcernMessages(concern.id)
      })
    } catch (error) {
      logger.error('Error fetching concerns:', error)
      toast.error(t('worker.error'))
      setDataLoaded(prev => ({ ...prev, concerns: true }))
    } finally {
      setIsLoadingConcerns(false)
    }
  }

  const fetchConcernMessages = async (concernId: string) => {
    setIsLoadingMessages({ ...isLoadingMessages, [concernId]: true })
    try {
      const token = SessionStorage.getToken()
      const response = await axios.get(`${API_URL}/concerns/${concernId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setConcernMessages({ ...concernMessages, [concernId]: response.data })
    } catch (error) {
      logger.error('Error fetching messages:', error)
    } finally {
      setIsLoadingMessages({ ...isLoadingMessages, [concernId]: false })
    }
  }

  const handleConfirm = async (requestId: string) => {
    try {
      const token = SessionStorage.getToken()
      await axios.post(
        `${API_URL}/requests/${requestId}/confirm`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )
      toast.success(t('worker.applicationSubmitted'))
      fetchAvailableRequests()
      // Refresh active work if on that tab
      if (activeTab === 'activeWork') {
        fetchActiveWork()
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('worker.applicationError'))
    }
  }

  // Helper function to mask phone number
  const maskPhone = (phone: string | undefined): string => {
    if (!phone) return '***-***-****'
    if (phone.length <= 4) return '***-***-' + phone.slice(-4)
    return '***-***-' + phone.slice(-4)
  }

  // Helper function to mask email
  const maskEmail = (email: string | undefined): string => {
    if (!email) return '***@***.***'
    const [localPart, domain] = email.split('@')
    if (!domain) return '***@***.***'
    const maskedLocal = localPart.length > 2 
      ? localPart.slice(0, 2) + '***' 
      : '***'
    const [domainName, domainExt] = domain.split('.')
    const maskedDomain = domainName.length > 2 
      ? domainName.slice(0, 2) + '***' 
      : '***'
    return `${maskedLocal}@${maskedDomain}.${domainExt || '***'}`
  }

  // Helper function to mask address (show partial)
  const maskAddress = (address: string | undefined): string => {
    if (!address) return 'Address not available'
    // Show first 20 characters and mask the rest
    if (address.length <= 20) return address
    const visiblePart = address.substring(0, 20)
    const words = visiblePart.split(' ')
    // Show first 2-3 words and mask the rest
    if (words.length <= 2) {
      return words.join(' ') + ' ***'
    }
    return words.slice(0, 2).join(' ') + ' ***'
  }

  const toggleAvailability = async () => {
    setIsToggling(true)
    try {
      const token = SessionStorage.getToken()
      const newAvailability = !available
      await axios.put(
        `${API_URL}/workers/availability`,
        { available: newAvailability },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )
      setAvailable(newAvailability)
      toast.success(`You are now ${newAvailability ? 'available' : 'unavailable'}`)
    } catch (error: any) {
      // Check if worker is deployed
      const errorMessage = error.response?.data?.message || error.message || ''
      if (errorMessage.toLowerCase().includes('deployed') || 
          errorMessage.toLowerCase().includes('active work') ||
          errorMessage.toLowerCase().includes('cannot set availability')) {
        toast.error(t('worker.deployedCannotMakeAvailable') || 'You are deployed on work, not able to make available. Once you complete your current work assignment, you will be able to make yourself available again.')
      } else {
        toast.error(t('worker.failedToUpdateAvailability') || 'Failed to update availability')
      }
    } finally {
      setIsToggling(false)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdatingProfile(true)
    try {
      const token = SessionStorage.getToken()
      const response = await axios.put(`${API_URL}/workers/profile/update`, profileData, {
        headers: { Authorization: `Bearer ${token}` }
      })
      toast.success('Profile updated successfully!')
      setShowProfileModal(false)
      fetchProfile()
      // Update user in localStorage
      const updatedUser = { ...user, ...response.data.user }
      SessionStorage.setUser(updatedUser)
      setUser(updatedUser)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update profile')
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRequest) return

    setIsSubmittingRating(true)
    try {
      const token = SessionStorage.getToken()
      const customerId = selectedRequest.customer?.id
      
      if (customerId) {
        await axios.post(`${API_URL}/ratings`, {
          requestId: selectedRequest.id,
          ratedUserId: customerId,
          rating: ratingData.rating,
          comment: ratingData.comment
        }, {
          headers: { Authorization: `Bearer ${token}` }
        })
      toast.success(t('worker.ratingSubmitted'))
      setShowRatingModal(false)
      if (selectedRequest) {
        setRatedRequests(new Set(Array.from(ratedRequests).concat(selectedRequest.id)))
      }
      setSelectedRequest(null)
      setRatingData({ rating: 5, comment: '' })
      fetchWorkHistory()
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('worker.error'))
    } finally {
      setIsSubmittingRating(false)
    }
  }

  const handleSubmitConcern = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate description is not blank
    if (!concernData.description || !concernData.description.trim()) {
      toast.error(t('worker.concernDescriptionRequired') || 'Please enter a description for your concern')
      return
    }
    
    setIsSubmittingConcern(true)
    try {
      const token = SessionStorage.getToken()
      const data: any = {
        description: concernData.description.trim(),
        type: concernData.type
      }
      
      if (concernData.requestId) {
        data.requestId = parseInt(concernData.requestId)
      }
      
      if (concernData.relatedToUserId) {
        data.relatedToUserId = parseInt(concernData.relatedToUserId)
      }
      
      await axios.post(`${API_URL}/concerns`, data, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      toast.success('Concern submitted successfully! Admin will review it.')
      setShowConcernModal(false)
      setSelectedRequest(null)
      setConcernData({
        requestId: '',
        relatedToUserId: '',
        description: '',
        type: 'OTHER'
      })
      // Refresh concerns list if on concerns tab
      if (activeTab === 'concerns') {
        fetchMyConcerns()
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to submit concern')
    } finally {
      setIsSubmittingConcern(false)
    }
  }

  const handleLogout = () => {
    SessionStorage.clear()
    router.push('/')
  }

  const getLaborTypeIcon = (type: string) => {
    const icons: { [key: string]: string } = {
      'ELECTRICIAN': '⚡',
      'DRIVER': '🚗',
      'RIGGER': '🔩',
      'FITTER': '🔧',
      'COOK': '👨‍🍳',
      'PLUMBER': '🔧',
      'CARPENTER': '🪚',
      'PAINTER': '🎨',
      'UNSKILLED_WORKER': '👷',
      'RAJ_MISTRI': '👷‍♂️'
    }
    return icons[type.toUpperCase()] || '👷'
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { bg: string; text: string; icon: string } } = {
      'PENDING': { bg: 'bg-gray-100', text: 'text-gray-800', icon: '⏳' },
      'PENDING_ADMIN_APPROVAL': { bg: 'bg-orange-100', text: 'text-orange-800', icon: '📝' },
      'ADMIN_APPROVED': { bg: 'bg-blue-100', text: 'text-blue-800', icon: '👍' },
      'NOTIFIED': { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: '🔔' },
      'CONFIRMED': { bg: 'bg-indigo-100', text: 'text-indigo-800', icon: '✅' },
      'DEPLOYED': { bg: 'bg-green-100', text: 'text-green-800', icon: '🚀' },
      'COMPLETED': { bg: 'bg-purple-100', text: 'text-purple-800', icon: '🎉' },
      'CANCELLED': { bg: 'bg-red-100', text: 'text-red-800', icon: '❌' },
      'REJECTED': { bg: 'bg-red-100', text: 'text-red-800', icon: '🚫' }
    }
    const config = statusConfig[status] || statusConfig['PENDING']
    
    // Translate status - use admin status translations (they're shared)
    const statusKey = `status${status.toLowerCase().replace(/_/g, '')}`
    const translatedStatus = t(`admin.${statusKey}`) || status.replace(/_/g, ' ')
    
    return (
      <span className={`px-4 py-2 rounded-full text-sm font-medium ${config.bg} ${config.text} flex items-center gap-2`} lang={language}>
        <span>{config.icon}</span>
        {translatedStatus}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-green-50 to-emerald-50">
      <nav className="bg-white/90 backdrop-blur-md shadow-lg sticky top-0 z-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 md:h-16 items-center">
            <Link href="/" className="text-lg md:text-xl lg:text-2xl font-bold bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent hover:scale-105 transition-transform truncate">
              KaamKart
            </Link>
            
            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-4">
              <LanguageSwitcher />
              <button
                onClick={() => setShowProfileModal(true)}
                className="px-4 py-2 text-sm text-gray-700 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all duration-200 flex items-center gap-2"
                lang={language}
              >
                <span>⚙️</span>
                {t('worker.profile')}
              </button>
              <button
                onClick={() => {
                  setSelectedRequest(null)
                  setShowConcernModal(true)
                }}
                className="px-4 py-2 text-sm text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 flex items-center gap-2"
                lang={language}
              >
                <span>📢</span>
                {t('worker.raiseConcern')}
              </button>
              <button
                onClick={toggleAvailability}
                disabled={isToggling}
                className={`px-6 py-2 rounded-full font-semibold transition-all duration-200 hover:scale-105 transform flex items-center gap-2 ${
                  available
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg hover:shadow-xl'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                } disabled:opacity-50`}
              >
                {isToggling ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <span className="text-lg">{available ? '✓' : '✗'}</span>
                    {available ? 'Available' : 'Unavailable'}
                  </>
                )}
              </button>
              <div className="flex items-center gap-3 bg-primary-50 px-4 py-2 rounded-full">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">👤</span>
                  <span className="text-gray-700 font-medium">{user?.name}</span>
                </div>
                {user?.rating !== undefined && user.rating > 0 && (
                  <div className="flex items-center gap-1 border-l border-primary-200 pl-3">
                    <span className="text-yellow-500 text-sm">⭐</span>
                    <span className="text-xs text-gray-700 font-semibold">
                      {user.rating.toFixed(1)}
                      {user.totalRatings && user.totalRatings > 0 && (
                        <span className="text-gray-500 ml-1">({user.totalRatings})</span>
                      )}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
              >
                Logout
              </button>
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
              <button
                onClick={() => {
                  setShowProfileModal(true)
                  setMobileMenuOpen(false)
                }}
                className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all duration-200 flex items-center gap-2"
              >
                <span>⚙️</span>
                {t('worker.profile')}
              </button>
              <button
                onClick={() => {
                  setSelectedRequest(null)
                  setShowConcernModal(true)
                  setMobileMenuOpen(false)
                }}
                className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 flex items-center gap-2"
                lang={language}
              >
                <span>📢</span>
                {t('worker.raiseConcern')}
              </button>
              <button
                onClick={() => {
                  toggleAvailability()
                  setMobileMenuOpen(false)
                }}
                disabled={isToggling}
                className={`w-full px-4 py-3 text-left rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 ${
                  available
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                    : 'bg-gray-200 text-gray-700'
                } disabled:opacity-50`}
              >
                {isToggling ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <span>{available ? '✓' : '✗'}</span>
                    {available ? 'Available' : 'Unavailable'}
                  </>
                )}
              </button>
              <div className="px-4 py-3 bg-primary-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-gray-700">👤</span>
                  <span className="text-sm text-gray-700 font-medium">{user?.name}</span>
                </div>
                {user?.rating !== undefined && user.rating > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-500 text-sm">⭐</span>
                    <span className="text-xs text-gray-700 font-semibold">
                      {user.rating.toFixed(1)}
                      {user.totalRatings && user.totalRatings > 0 && (
                        <span className="text-gray-500 ml-1">({user.totalRatings})</span>
                      )}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 md:mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-1 md:mb-2" lang={language}>{t('worker.title')}</h2>
            <p className="text-sm md:text-base text-gray-600" lang={language}>{t('worker.availableRequests')}</p>
          </div>
          {activeTab === 'available' && (
            <button
              onClick={fetchAvailableRequests}
              disabled={isLoading}
              className="px-4 py-2 md:px-6 md:py-2 bg-white border-2 border-primary-300 text-primary-600 rounded-lg text-sm md:text-base font-medium hover:bg-primary-50 transition-all duration-200 hover:scale-105 transform disabled:opacity-50 w-full sm:w-auto"
            >
              {isLoading ? t('admin.refreshing') : `🔄 ${t('admin.refresh')}`}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-lg p-2 mb-6 overflow-x-auto">
          <div className="flex gap-2 min-w-max md:min-w-0">
            <button
              onClick={() => setActiveTab('available')}
              className={`px-3 py-2 md:px-4 md:py-3 lg:px-6 whitespace-nowrap rounded-lg text-xs md:text-sm font-semibold transition-all duration-200 ${
                activeTab === 'available'
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="hidden sm:inline">🔔 </span>{t('worker.availableRequests')}{dataLoaded.requests && ` (${requests.length})`}
            </button>
            <button
              onClick={() => {
                setActiveTab('activeWork')
                fetchActiveWork()
              }}
              className={`px-3 py-2 md:px-4 md:py-3 lg:px-6 whitespace-nowrap rounded-lg text-xs md:text-sm font-semibold transition-all duration-200 ${
                activeTab === 'activeWork'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="hidden sm:inline">📍 </span>{t('worker.activeWork')}{dataLoaded.activeWork && ` (${activeWork.length})`}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-2 md:px-4 md:py-3 lg:px-6 whitespace-nowrap rounded-lg text-xs md:text-sm font-semibold transition-all duration-200 ${
                activeTab === 'history'
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="hidden sm:inline">📜 </span>{t('worker.workHistory')}{dataLoaded.workHistory && ` (${workHistory.length})`}
            </button>
            <button
              onClick={() => setActiveTab('concerns')}
              className={`px-3 py-2 md:px-4 md:py-3 lg:px-6 whitespace-nowrap rounded-lg text-xs md:text-sm font-semibold transition-all duration-200 ${
                activeTab === 'concerns'
                  ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="hidden sm:inline">📢 </span>{t('worker.concerns')}{dataLoaded.concerns && ` (${myConcerns.filter((c: any) => c.status === 'PENDING').length > 0 ? myConcerns.filter((c: any) => c.status === 'PENDING').length : myConcerns.length})`}
            </button>
          </div>
        </div>

        {/* Profile Modal */}
        {showProfileModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-lg relative">
              <h3 className="text-2xl font-bold text-gray-900 mb-6" lang={language}>{t('worker.updateProfile')}</h3>
              <button
                onClick={() => setShowProfileModal(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl"
              >
                &times;
              </button>
              <form onSubmit={handleUpdateProfile} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" lang={language}>{t('worker.name') || t('common.name')}</label>
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) => {
                      const value = e.target.value
                      const nameRegex = /^[a-zA-Z\s'\-\.]*$/
                      if (nameRegex.test(value) || value === '') {
                        setProfileData({ ...profileData, name: value })
                      }
                    }}
                    onBlur={(e) => {
                      const value = e.target.value.trim()
                      if (value && /\d/.test(value)) {
                        toast.error(t('login.nameNoNumbers') || 'Name cannot contain numbers')
                      }
                    }}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                    pattern="[a-zA-Z\s'\-\.]+"
                    title={t('login.nameNoNumbers') || 'Name should only contain letters, spaces, apostrophes, hyphens, and dots'}
                    lang={language}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" lang={language}>{t('worker.email')}</label>
                  <input
                    type="email"
                    value={profileData.email}
                    readOnly
                    disabled
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                    lang={language}
                  />
                  <p className="text-xs text-gray-500 mt-1" lang={language}>{t('worker.emailCannotBeChanged') || 'Email cannot be changed'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" lang={language}>{t('worker.phone')}</label>
                  <input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/\D/g, '')
                      if (cleaned.length <= 15) {
                        setProfileData({ ...profileData, phone: cleaned })
                      }
                    }}
                    onBlur={(e) => {
                      const value = e.target.value.trim()
                      if (value && (value.length < 10 || value.length > 15)) {
                        toast.error(t('login.invalidPhone') || 'Please enter a valid phone number (10-15 digits)')
                      }
                    }}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                    minLength={10}
                    maxLength={15}
                    pattern="[0-9]{10,15}"
                    title={t('login.invalidPhone') || 'Please enter a valid phone number (10-15 digits)'}
                    lang={language}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" lang={language}>{t('worker.secondaryPhone')}</label>
                  <input
                    type="tel"
                    value={profileData.secondaryPhone}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/\D/g, '')
                      if (cleaned.length <= 15) {
                        setProfileData({ ...profileData, secondaryPhone: cleaned })
                      }
                    }}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    pattern="[0-9]{10,15}"
                    title={t('login.invalidPhone') || 'Please enter a valid phone number (10-15 digits)'}
                    lang={language}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="w-full bg-gradient-to-r from-primary-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform disabled:opacity-50"
                  lang={language}
                >
                  {isUpdatingProfile ? t('worker.updating') : t('worker.updateProfile')}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Rating Modal */}
        {showRatingModal && selectedRequest && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl p-4 sm:p-6 md:p-8 w-full max-w-lg relative my-auto max-h-[95vh] overflow-y-auto">
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6" lang={language}>{t('worker.rateCustomer')}</h3>
              <button
                onClick={() => {
                  setShowRatingModal(false)
                  setSelectedRequest(null)
                }}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl"
              >
                &times;
              </button>
              <form onSubmit={handleSubmitRating} className="space-y-5">
                <div>
                  <p className="text-sm text-gray-600 mb-2" lang={language}>{t('worker.customerLabel')} {selectedRequest.customer?.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" lang={language}>{t('worker.ratingLabel')}</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRatingData({ ...ratingData, rating: star })}
                        className={`text-4xl ${star <= ratingData.rating ? 'text-yellow-400' : 'text-gray-300'} hover:text-yellow-400 transition-colors`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-gray-600 mt-2" lang={language}>{t('worker.selectedRating')} {ratingData.rating} {t('worker.stars')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" lang={language}>{t('worker.comment')}</label>
                  <textarea
                    value={ratingData.comment}
                    onChange={(e) => setRatingData({ ...ratingData, comment: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    rows={4}
                    placeholder={t('worker.commentPlaceholder')}
                    lang={language}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingRating}
                  className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white py-3 rounded-lg font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform disabled:opacity-50"
                >
                  {isSubmittingRating ? t('worker.submitting') : t('worker.rateCustomer')}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Details Modal for Active Work */}
        {showDetailsModal && selectedActiveWork && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl p-4 sm:p-6 md:p-8 w-full max-w-2xl relative my-auto max-h-[95vh] overflow-y-auto">
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6" lang={language}>
                {t('worker.workDetails') || 'Work Details'}
              </h3>
              <button
                onClick={() => {
                  setShowDetailsModal(false)
                  setSelectedActiveWork(null)
                }}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl"
              >
                &times;
              </button>
              
              <div className="space-y-4 md:space-y-6">
                {/* Work Type and Status */}
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg p-4 border-l-4 border-orange-500">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-lg md:text-xl font-bold text-gray-900 capitalize">
                      {selectedActiveWork.workType || selectedActiveWork.request?.workType || 'Work Assignment'}
                    </h4>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                      selectedActiveWork.status === 'DEPLOYED' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-orange-100 text-orange-800'
                    }`}>
                      {selectedActiveWork.status === 'DEPLOYED' 
                        ? (t('worker.deployed') || 'Deployed')
                        : (t('worker.confirmed') || 'Confirmed')
                      }
                    </span>
                  </div>
                </div>

                {/* Dates */}
                {(selectedActiveWork.startDate || selectedActiveWork.endDate) && (
                  <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
                    <h5 className="text-sm font-semibold text-gray-700 mb-3" lang={language}>
                      {t('worker.workDates') || 'Work Dates'}
                    </h5>
                    <div className="space-y-2">
                      {selectedActiveWork.startDate && (
                        <div className="flex items-center gap-2 text-gray-700">
                          <span className="text-lg">📅</span>
                          <div>
                            <p className="text-xs text-gray-500" lang={language}>{t('worker.startDate') || 'Start Date'}</p>
                            <p className="font-medium">{new Date(selectedActiveWork.startDate).toLocaleDateString('en-IN', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}</p>
                          </div>
                        </div>
                      )}
                      {selectedActiveWork.endDate && (
                        <div className="flex items-center gap-2 text-gray-700">
                          <span className="text-lg">📅</span>
                          <div>
                            <p className="text-xs text-gray-500" lang={language}>{t('worker.endDate') || 'End Date'}</p>
                            <p className="font-medium">{new Date(selectedActiveWork.endDate).toLocaleDateString('en-IN', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}</p>
                          </div>
                        </div>
                      )}
                      {selectedActiveWork.startDate && selectedActiveWork.endDate && (
                        <div className="mt-2 pt-2 border-t border-blue-200">
                          <p className="text-sm text-gray-600">
                            <span className="font-semibold">
                              {Math.ceil((new Date(selectedActiveWork.endDate).getTime() - new Date(selectedActiveWork.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1}
                            </span> {t('worker.days') || 'days'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Customer Information */}
                {(selectedActiveWork.customer || selectedActiveWork.request?.customer) && (
                  <div className="bg-purple-50 rounded-lg p-4 border-l-4 border-purple-500">
                    <h5 className="text-sm font-semibold text-gray-700 mb-3" lang={language}>
                      {t('worker.customerInformation') || 'Customer Information'}
                    </h5>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-gray-700">
                        <span className="text-lg">👤</span>
                        <div>
                          <p className="font-medium">{selectedActiveWork.customer?.name || selectedActiveWork.request?.customer?.name || 'Customer'}</p>
                          {selectedActiveWork.customer?.phone || selectedActiveWork.request?.customer?.phone ? (
                            <p className="text-sm text-gray-600">{selectedActiveWork.customer?.phone || selectedActiveWork.request?.customer?.phone}</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Work Location */}
                {(selectedActiveWork.location || selectedActiveWork.request?.location) && (
                  <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-500">
                    <h5 className="text-sm font-semibold text-gray-700 mb-3" lang={language}>
                      {t('worker.workLocation') || 'Work Location'}
                    </h5>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 text-gray-700">
                        <span className="text-lg">📍</span>
                        <div className="flex-1">
                          <p className="font-medium break-words mb-1">
                            {selectedActiveWork.location?.address || selectedActiveWork.request?.location?.address || 'Address not available'}
                          </p>
                          {(selectedActiveWork.location?.city || selectedActiveWork.request?.location?.city) && (
                            <p className="text-sm text-gray-600">
                              {selectedActiveWork.location?.city || selectedActiveWork.request?.location?.city}
                              {(selectedActiveWork.location?.state || selectedActiveWork.request?.location?.state) && 
                                `, ${selectedActiveWork.location?.state || selectedActiveWork.request?.location?.state}`
                              }
                              {(selectedActiveWork.location?.pinCode || selectedActiveWork.request?.location?.pinCode) && 
                                ` - ${selectedActiveWork.location?.pinCode || selectedActiveWork.request?.location?.pinCode}`
                              }
                            </p>
                          )}
                        </div>
                      </div>
                      {(selectedActiveWork.location?.latitude && selectedActiveWork.location?.longitude) || 
                       (selectedActiveWork.request?.location?.latitude && selectedActiveWork.request?.location?.longitude) ? (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${selectedActiveWork.location?.latitude || selectedActiveWork.request?.location?.latitude},${selectedActiveWork.location?.longitude || selectedActiveWork.request?.location?.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 mt-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white py-2 px-4 rounded-lg font-semibold hover:shadow-lg transition-all duration-200 hover:scale-105 transform"
                        >
                          <span>🗺️</span>
                          <span lang={language}>{t('worker.getDirections') || 'Get Directions'}</span>
                          <span>→</span>
                        </a>
                      ) : null}
                    </div>
                  </div>
                )}

                {/* Worker Types Required */}
                {(selectedActiveWork.laborTypes && selectedActiveWork.laborTypes.length > 0) || 
                 (selectedActiveWork.request?.laborTypes && selectedActiveWork.request?.laborTypes.length > 0) ? (
                  <div className="bg-indigo-50 rounded-lg p-4 border-l-4 border-indigo-500">
                    <h5 className="text-sm font-semibold text-gray-700 mb-3" lang={language}>
                      {t('worker.workerTypesRequired') || 'Worker Types Required'}
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {(selectedActiveWork.laborTypes || selectedActiveWork.request?.laborTypes || []).map((type: string, idx: number) => (
                        <span key={idx} className="inline-block px-3 py-1 bg-indigo-100 text-indigo-800 text-sm rounded-full font-medium">
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Number of Workers */}
                {(selectedActiveWork.numberOfWorkers || selectedActiveWork.request?.numberOfWorkers) && (
                  <div className="bg-yellow-50 rounded-lg p-4 border-l-4 border-yellow-500">
                    <div className="flex items-center gap-2 text-gray-700">
                      <span className="text-lg">👥</span>
                      <div>
                        <p className="text-xs text-gray-500" lang={language}>{t('worker.numberOfWorkers') || 'Number of Workers'}</p>
                        <p className="font-medium text-lg">
                          {selectedActiveWork.numberOfWorkers || selectedActiveWork.request?.numberOfWorkers || 1}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Description */}
                {(selectedActiveWork.description || selectedActiveWork.request?.description) && (
                  <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-gray-400">
                    <h5 className="text-sm font-semibold text-gray-700 mb-2" lang={language}>
                      {t('worker.description') || 'Description'}
                    </h5>
                    <p className="text-sm text-gray-700 break-words">
                      {selectedActiveWork.description || selectedActiveWork.request?.description}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!available && activeTab === 'available' && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-xl p-3 md:p-4 mb-4 md:mb-6 animate-pulse">
            <div className="flex items-center gap-2 md:gap-3">
              <span className="text-xl md:text-2xl">⚠️</span>
              <p className="text-xs md:text-sm lg:text-base text-yellow-800 font-medium" lang={language}>
                {t('worker.unavailableMessage')}
              </p>
            </div>
          </div>
        )}

        {(isLoading || isLoadingHistory || isLoadingConcerns) ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <>
            {activeTab === 'concerns' && (
              <div className="space-y-4 md:space-y-6">
                {myConcerns.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-lg p-6 md:p-8 lg:p-12 text-center border-2 border-dashed border-gray-300">
                    <div className="text-4xl md:text-5xl lg:text-6xl mb-3 md:mb-4">📢</div>
                    <p className="text-base md:text-lg lg:text-xl text-gray-500 mb-2" lang={language}>{t('worker.noConcernsYet')}</p>
                    <p className="text-sm md:text-base text-gray-400" lang={language}>{t('worker.raiseConcernHint')}</p>
                  </div>
                ) : (
                  myConcerns.map((concern: any) => (
                    <div key={concern.id} className="bg-white rounded-xl shadow-lg p-4 md:p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 transform border-l-4 border-red-500">
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4 mb-3 md:mb-4">
                        <div className="flex-1 w-full">
                          <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
                            <h3 className="text-lg md:text-xl font-bold text-gray-900" lang={language}>{t('worker.concernNumber')}{concern.id}</h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              concern.type === 'WORK_QUALITY' ? 'bg-blue-100 text-blue-800' :
                              concern.type === 'PAYMENT_ISSUE' ? 'bg-yellow-100 text-yellow-800' :
                              concern.type === 'BEHAVIOR' ? 'bg-red-100 text-red-800' :
                              concern.type === 'SAFETY' ? 'bg-orange-100 text-orange-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {t(`customer.${concern.type.toLowerCase()}`) || concern.type.replace(/_/g, ' ')}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              concern.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                              concern.status === 'IN_REVIEW' ? 'bg-blue-100 text-blue-800' :
                              concern.status === 'RESOLVED' ? 'bg-green-100 text-green-800' :
                              concern.status === 'DISMISSED' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`} lang={language}>
                              {t(`admin.concernStatus${concern.status.toLowerCase().replace(/_/g, '')}`) || concern.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <div className="space-y-2 text-xs md:text-sm text-gray-600 mb-3 md:mb-4">
                            {concern.request && (
                              <p lang={language}><span className="font-semibold">{t('admin.relatedRequest')}:</span> {concern.request.workType} ({t('admin.id')}: {concern.request.id})</p>
                            )}
                            <p lang={language}><span className="font-semibold">{t('admin.created')}:</span> {new Date(concern.createdAt).toLocaleString()}</p>
                            {concern.resolvedAt && (
                              <p lang={language}><span className="font-semibold">{t('admin.resolved')}:</span> {new Date(concern.resolvedAt).toLocaleString()}</p>
                            )}
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3 md:p-4 mb-3 md:mb-4">
                            <p className="font-semibold text-sm md:text-base text-gray-900 mb-2" lang={language}>{t('admin.description')}:</p>
                            <p className="text-xs md:text-sm lg:text-base text-gray-700" lang={language}>{concern.description}</p>
                          </div>
                          
                          {/* Conversation Thread */}
                          <div className="mb-3 md:mb-4">
                            <p className="font-semibold text-sm md:text-base text-gray-900 mb-2 md:mb-3" lang={language}>{t('admin.conversation')}:</p>
                            {isLoadingMessages[concern.id] ? (
                              <div className="flex justify-center py-3 md:py-4">
                                <div className="animate-spin rounded-full h-5 w-5 md:h-6 md:w-6 border-b-2 border-primary-600"></div>
                              </div>
                            ) : concernMessages[concern.id] && concernMessages[concern.id].length > 0 ? (
                              <div className="space-y-2 md:space-y-3 max-h-64 md:max-h-96 overflow-y-auto">
                                {concernMessages[concern.id].map((msg: any) => {
                                  const isUser = msg.sentBy?.id === concern.raisedBy?.id
                                  const isAdmin = msg.sentBy?.role === 'ADMIN'
                                  return (
                                    <div
                                      key={msg.id}
                                      className={`p-2 md:p-3 rounded-lg ${
                                        isAdmin
                                          ? 'bg-blue-50 border-l-4 border-blue-500'
                                          : isUser
                                          ? 'bg-green-50 border-l-4 border-green-500'
                                          : 'bg-gray-50 border-l-4 border-gray-400'
                                      }`}
                                    >
                                      <div className="flex flex-col sm:flex-row justify-between items-start gap-1 sm:gap-2 mb-1">
                                        <p className={`font-semibold text-xs md:text-sm ${
                                          isAdmin ? 'text-blue-900' : isUser ? 'text-green-900' : 'text-gray-900'
                                        }`}>
                                          {msg.sentBy?.name || 'Unknown'}
                                          {isAdmin && <span className="ml-2 text-xs">(Admin)</span>}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {new Date(msg.createdAt).toLocaleString()}
                                        </p>
                                      </div>
                                      <p className={`text-sm ${
                                        isAdmin ? 'text-blue-700' : isUser ? 'text-green-700' : 'text-gray-700'
                                      }`}>
                                        {msg.message}
                                      </p>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <p className="text-gray-500 text-sm italic" lang={language}>{t('admin.noMessagesYet')}</p>
                            )}
                          </div>
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        {concern.status === 'RESOLVED' ? (
                          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                            <p className="text-green-800 font-semibold flex items-center gap-2" lang={language}>
                              <span>✓</span>
                              {t('worker.concernResolved') || 'This concern has been resolved and cannot be edited.'}
                            </p>
                          </div>
                        ) : editingConcern && editingConcern.id === concern.id ? (
                          <>
                            <label className="block text-sm font-medium text-gray-700 mb-2" lang={language}>{t('admin.updateStatus')}:</label>
                            <select
                              value={editingConcern.status === 'IN_REVIEW' ? 'PENDING' : editingConcern.status}
                              onChange={(e) => {
                                if (editingConcern) {
                                  setEditingConcern({ ...editingConcern, status: e.target.value })
                                }
                              }}
                              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 mb-3"
                              lang={language}
                            >
                              <option value="PENDING">{t('admin.concernStatuspending')}</option>
                              <option value="RESOLVED">{t('admin.concernStatusresolved')}</option>
                            </select>
                            <label className="block text-sm font-medium text-gray-700 mb-2" lang={language}>{t('admin.messagePlaceholder')}</label>
                            <textarea
                              value={editingConcern.message || ''}
                              onChange={(e) => {
                                if (editingConcern) {
                                  setEditingConcern({ ...editingConcern, message: e.target.value })
                                }
                              }}
                              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 mb-3"
                              rows={3}
                              placeholder={t('admin.messagePlaceholder')}
                              lang={language}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={async () => {
                                  if (!editingConcern) return
                                  setIsUpdatingConcernStatus(true)
                                  try {
                                    const token = SessionStorage.getToken()
                                    const payload: any = {
                                      status: editingConcern.status === 'IN_REVIEW' ? 'PENDING' : editingConcern.status
                                    }
                                    // Only include message if it's not empty
                                    if (editingConcern.message && editingConcern.message.trim()) {
                                      payload.message = editingConcern.message.trim()
                                    }
                                    await axios.put(`${API_URL}/concerns/${concern.id}/status`, payload, {
                                      headers: { Authorization: `Bearer ${token}` }
                                    })
                                    toast.success(t('worker.concernStatusUpdated'))
                                    setEditingConcern(null)
                                    fetchMyConcerns()
                                  } catch (error: any) {
                                    toast.error(error.response?.data?.message || t('worker.error'))
                                  } finally {
                                    setIsUpdatingConcernStatus(false)
                                  }
                                }}
                                disabled={isUpdatingConcernStatus}
                                className="flex-1 bg-gradient-to-r from-primary-600 to-indigo-600 text-white py-2 rounded-lg font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform disabled:opacity-50"
                              >
                                {isUpdatingConcernStatus ? t('common.loading') : t('common.save')}
                              </button>
                              <button
                                onClick={() => setEditingConcern(null)}
                                disabled={isUpdatingConcernStatus}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all disabled:opacity-50"
                              >
                                {t('common.cancel')}
                              </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">You can update the status (Pending/Resolved) and optionally add a message</p>
                          </>
                        ) : (
                          <button
                            onClick={() => setEditingConcern({
                              id: concern.id,
                              status: concern.status === 'IN_REVIEW' ? 'PENDING' : concern.status,
                              message: ''
                            })}
                            className="w-full bg-gradient-to-r from-primary-600 to-indigo-600 text-white py-2 rounded-lg font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform"
                          >
                            {t('worker.updateConcernStatus')}
                          </button>
                        )}
                      </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            {activeTab === 'activeWork' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 md:gap-6">
                {isLoadingActiveWork ? (
                  <div className="col-span-1 md:col-span-2 flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
                  </div>
                ) : activeWork.length === 0 ? (
                  <div className="col-span-1 md:col-span-2 bg-white rounded-xl shadow-lg p-6 md:p-8 lg:p-12 text-center border-2 border-dashed border-gray-300">
                    <div className="text-4xl md:text-5xl lg:text-6xl mb-3 md:mb-4">📍</div>
                    <p className="text-base md:text-lg lg:text-xl text-gray-500 mb-2" lang={language}>{t('worker.noActiveWork') || 'No active work assignments'}</p>
                    <p className="text-sm md:text-base text-gray-400" lang={language}>{t('worker.noActiveWorkHelp') || 'When you confirm a job, it will appear here with location and directions.'}</p>
                  </div>
                ) : (
                  activeWork.map((work: any, index: number) => {
                    const workLocation = work.location || work.request?.location
                    const customer = work.customer || work.request?.customer
                    const hasLocation = workLocation?.latitude && workLocation?.longitude
                    const directionsUrl = hasLocation 
                      ? `https://www.google.com/maps/dir/?api=1&destination=${workLocation.latitude},${workLocation.longitude}`
                      : workLocation?.address 
                        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(workLocation.address)}`
                        : null
                    
                    return (
                      <div key={`active-${work.requestId || work.id}-${index}`} className="bg-white rounded-xl shadow-lg p-4 md:p-6 border-t-4 border-orange-500 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 transform">
                        <div className="flex flex-col gap-3 md:gap-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xl md:text-2xl">🔨</span>
                                <h3 className="text-lg md:text-xl font-bold capitalize text-gray-900">
                                  {work.workType || work.request?.workType || 'Work Assignment'}
                                </h3>
                              </div>
                              {work.startDate && work.endDate && (
                                <div className="text-xs md:text-sm text-gray-600 mb-2">
                                  📅 {new Date(work.startDate).toLocaleDateString()} - {new Date(work.endDate).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                            <div className="flex-shrink-0">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                                work.status === 'DEPLOYED' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-orange-100 text-orange-800'
                              }`}>
                                {work.status === 'DEPLOYED' 
                                  ? (t('worker.deployed') || 'Deployed')
                                  : (t('worker.confirmed') || 'Confirmed')
                                }
                              </span>
                            </div>
                          </div>
                          
                          <div className="space-y-2 text-sm">
                            {customer && (
                              <div className="flex items-start gap-2 text-gray-700">
                                <span className="text-lg">👤</span>
                                <div>
                                  <p className="font-medium">{customer.name || 'Customer'}</p>
                                  {customer.phone && (
                                    <p className="text-xs text-gray-500">{customer.phone}</p>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {workLocation && (
                              <div className="flex items-start gap-2 text-gray-700">
                                <span className="text-lg">📍</span>
                                <div className="flex-1">
                                  <p className="font-medium mb-1" lang={language}>{t('worker.workLocation') || 'Work Location'}</p>
                                  <p className="text-sm break-words">{workLocation.address || 'Address not available'}</p>
                                  {workLocation.state && workLocation.city && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      {workLocation.city}, {workLocation.state}
                                      {workLocation.pinCode && ` - ${workLocation.pinCode}`}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {work.laborTypes && work.laborTypes.length > 0 && (
                              <div className="flex items-start gap-2 text-gray-700">
                                <span className="text-lg">🔧</span>
                                <div>
                                  <p className="text-xs text-gray-500 mb-1" lang={language}>{t('worker.workerTypes') || 'Worker Types'}</p>
                                  <div className="flex flex-wrap gap-1">
                                    {work.laborTypes.map((type: string, idx: number) => (
                                      <span key={idx} className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                        {type}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {directionsUrl && (
                            <a
                              href={directionsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full mt-4 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-3 px-4 rounded-lg font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform"
                            >
                              <span>🗺️</span>
                              <span lang={language}>{t('worker.getDirections') || 'Get Directions'}</span>
                              <span>→</span>
                            </a>
                          )}
                          
                          <div className="flex flex-col gap-2 mt-4">
                            {work.requestId && (
                              <button
                                onClick={() => {
                                  setSelectedActiveWork(work)
                                  setShowDetailsModal(true)
                                }}
                                className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-200 transition-all"
                              >
                                {t('worker.viewDetails') || 'View Details'}
                              </button>
                            )}
                            
                            {/* Raise Concern Button */}
                            <button
                              onClick={() => {
                                setConcernData({
                                  ...concernData,
                                  requestId: work.requestId || work.id || '',
                                  relatedToUserId: customer?.id || '',
                                  type: 'OTHER',
                                  description: ''
                                })
                                setShowConcernModal(true)
                              }}
                              className="w-full bg-red-50 text-red-700 py-2 px-4 rounded-lg font-medium hover:bg-red-100 transition-all border border-red-200"
                            >
                              <span className="flex items-center justify-center gap-2">
                                <span>⚠️</span>
                                <span lang={language}>{t('worker.raiseConcern') || 'Raise Concern'}</span>
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
            {activeTab === 'history' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 md:gap-6">
                {workHistory.length === 0 ? (
                  <div className="col-span-1 md:col-span-2 bg-white rounded-xl shadow-lg p-6 md:p-8 lg:p-12 text-center border-2 border-dashed border-gray-300">
                    <div className="text-4xl md:text-5xl lg:text-6xl mb-3 md:mb-4">📚</div>
                    <p className="text-base md:text-lg lg:text-xl text-gray-500 mb-2">{t('worker.noWorkHistoryYet') || 'No work history yet'}</p>
                    <p className="text-sm md:text-base text-gray-400">Complete some jobs to see your history here!</p>
                  </div>
                ) : (
                  workHistory.map((work, index) => (
                    <div key={`${work.requestId}-${index}`} className="bg-white rounded-xl shadow-lg p-4 md:p-6 border-t-4 border-purple-500 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 transform">
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4 mb-3 md:mb-4">
                        <div className="flex-1 w-full">
                          <div className="flex items-center gap-2 md:gap-3 mb-2 flex-nowrap">
                            <span className="text-xl md:text-2xl flex-shrink-0">⚡</span>
                            <h3 className="text-lg md:text-xl font-bold capitalize text-gray-900 flex-1 min-w-0 truncate">
                              {work.workType}
                            </h3>
                            <div className="flex-shrink-0">{getStatusBadge(work.status)}</div>
                          </div>
                          {work.startDate && work.endDate && (
                            <div className="text-xs md:text-sm text-gray-600 mb-2">
                              📅 {new Date(work.startDate).toLocaleDateString()} - {new Date(work.endDate).toLocaleDateString()}
                              <span className="ml-1 md:ml-2 text-xs">
                                ({Math.ceil((new Date(work.endDate).getTime() - new Date(work.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} days)
                              </span>
                            </div>
                          )}
                          <p className="text-gray-700 text-base md:text-lg mb-2 md:mb-3 font-medium">{work.workType}</p>
                          <div className="space-y-2 text-xs md:text-sm">
                            <div className="flex items-center gap-2 text-gray-600">
                              <span>👥</span>
                              <span>Work completed</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <span>📍</span>
                              <span className="break-words">{work.location?.address || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <span>👤</span>
                              <span className="break-words">{work.customer?.name || 'Customer'} - {work.customer?.phone || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <span>📅</span>
                              <span>{new Date(work.date).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      {work.status === 'COMPLETED' && !ratedRequests.has(work.requestId) && (
                        <button
                          onClick={() => {
                            // Create request object with customer info from work history
                            const fullRequest = {
                              id: work.requestId,
                              customer: {
                                id: work.customer.id,
                                name: work.customer.name,
                                phone: work.customer.phone
                              }
                            } as any
                            setSelectedRequest(fullRequest)
                            setShowRatingModal(true)
                          }}
                          className="w-full mt-3 md:mt-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white py-2 md:py-2.5 rounded-lg text-sm md:text-base font-semibold hover:shadow-lg transition-all"
                        >
                          ⭐ {t('worker.rateCustomer')}
                        </button>
                      )}
                      {work.status === 'COMPLETED' && ratedRequests.has(work.requestId) && (
                        <div className="w-full mt-3 md:mt-4 bg-green-50 border-2 border-green-200 text-green-800 py-2 md:py-2.5 rounded-lg text-sm md:text-base font-semibold text-center" lang={language}>
                          ✓ {t('worker.rated') || 'Rated'}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
            {activeTab === 'available' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 md:gap-6">
                {requests.length === 0 ? (
                  <div className="col-span-1 md:col-span-2 bg-white rounded-xl shadow-lg p-6 md:p-8 lg:p-12 text-center border-2 border-dashed border-gray-300">
                    <div className="text-4xl md:text-5xl lg:text-6xl mb-3 md:mb-4">📭</div>
                    <p className="text-base md:text-lg lg:text-xl text-gray-500 mb-2" lang={language}>{t('worker.noRequests')}</p>
                    <p className="text-sm md:text-base text-gray-400" lang={language}>{t('worker.available')}</p>
                  </div>
                ) : (
                  requests.map((request) => (
                      <div key={request.id} className="bg-white rounded-xl shadow-lg p-4 md:p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 transform border-t-4 border-primary-500">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4 mb-3 md:mb-4">
                          <div className="flex-1 w-full">
                            <div className="flex items-center gap-2 md:gap-3 mb-2 flex-nowrap">
                              <span className="text-xl md:text-2xl flex-shrink-0">⚡</span>
                              <h3 className="text-lg md:text-xl font-bold capitalize text-gray-900 flex-1 min-w-0 truncate">{request.workType}</h3>
                              <div className="flex-shrink-0">{getStatusBadge(request.status)}</div>
                            </div>
                            {request.startDate && request.endDate && (
                              <div className="text-xs md:text-sm text-gray-600 mb-2">
                                📅 {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                                <span className="ml-1 md:ml-2 text-xs">
                                  ({Math.ceil((new Date(request.endDate).getTime() - new Date(request.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} days)
                                </span>
                              </div>
                            )}
                            <p className="text-gray-700 text-base md:text-lg mb-2 md:mb-3 font-medium">{request.workType}</p>
                            <div className="space-y-2 text-xs md:text-sm">
                              {/* Show partial/masked address */}
                              {request.location?.address && (
                                <div className="flex items-center gap-2 text-gray-600">
                                  <span>📍</span>
                                  <span className="break-words">{maskAddress(request.location.address)}</span>
                                </div>
                              )}
                              {request.distance && (
                                <div className="flex items-center gap-2 text-primary-600 font-semibold">
                                  <span>📍</span>
                                  <span>{request.distance} km away</span>
                                </div>
                              )}
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2 text-gray-600">
                                  <span>👤</span>
                                  <span className="break-words">
                                    {request.customer?.name || 'Customer'} - {maskPhone(request.customer?.phone)}
                                  </span>
                                </div>
                                {request.customerRating !== undefined && request.customerRating > 0 && (
                                  <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-full border border-yellow-200">
                                    <span className="text-yellow-500 text-xs md:text-sm">⭐</span>
                                    <span className="text-xs text-gray-700 font-semibold">
                                      {request.customerRating.toFixed(1)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleConfirm(request.id)}
                          disabled={!available}
                          className="w-full py-2 md:py-3 rounded-lg text-sm md:text-base font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform disabled:bg-gray-300 disabled:cursor-not-allowed disabled:transform-none disabled:hover:shadow-none flex items-center justify-center gap-2 bg-gradient-to-r from-primary-600 to-indigo-600 text-white"
                        >
                          <span>✓</span>
                          {t('worker.apply')}
                        </button>
                      </div>
                    ))
                )}
              </div>
            )}
          </>
        )}

        {/* Concern Modal */}
        {showConcernModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-4 md:p-6 lg:p-8 w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6" lang={language}>{t('worker.raiseConcern')}</h3>
              <button
                onClick={() => {
                  setShowConcernModal(false)
                  setSelectedRequest(null)
                  setConcernData({
                    requestId: '',
                    relatedToUserId: '',
                    description: '',
                    type: 'OTHER'
                  })
                }}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl"
              >
                &times;
              </button>
              <form onSubmit={handleSubmitConcern} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" lang={language}>{t('worker.concernType')} <span className="text-red-500">*</span></label>
                  <select
                    value={concernData.type}
                    onChange={(e) => setConcernData({ ...concernData, type: e.target.value as any })}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                    lang={language}
                  >
                    <option value="WORK_QUALITY" lang={language}>{t('worker.workQuality')}</option>
                    <option value="PAYMENT_ISSUE" lang={language}>{t('worker.paymentIssue')}</option>
                    <option value="BEHAVIOR" lang={language}>{t('worker.behavior')}</option>
                    <option value="SAFETY" lang={language}>{t('worker.safety')}</option>
                    <option value="OTHER" lang={language}>{t('worker.other')}</option>
                  </select>
                </div>
                {workHistory.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" lang={language}>{t('customer.relatedRequest')}</label>
                    <select
                      value={concernData.requestId}
                      onChange={(e) => setConcernData({ ...concernData, requestId: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      lang={language}
                    >
                      <option value="" lang={language}>{t('customer.none')}</option>
                      {workHistory.map((work: any) => (
                        <option key={work.requestId} value={work.requestId}>
                          {work.workType} - {work.status}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" lang={language}>{t('worker.description')} <span className="text-red-500">*</span></label>
                  <textarea
                    value={concernData.description}
                    onChange={(e) => setConcernData({ ...concernData, description: e.target.value })}
                    onBlur={(e) => {
                      if (!e.target.value.trim()) {
                        toast.error(t('worker.concernDescriptionRequired') || 'Please enter a description for your concern')
                      }
                    }}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    rows={6}
                    placeholder={t('worker.concernDescriptionPlaceholder') || 'Please describe your concern in detail...'}
                    required
                    minLength={10}
                    title={t('worker.concernDescriptionRequired') || 'Please enter at least 10 characters describing your concern'}
                    lang={language}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingConcern || !concernData.description?.trim()}
                  className="w-full bg-gradient-to-r from-red-500 to-pink-500 text-white py-3 rounded-lg font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform disabled:opacity-50"
                  lang={language}
                >
                  {isSubmittingConcern ? t('worker.submitting') : t('worker.submitConcern')}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
      
      {/* Chatbot */}
      {user && <Chatbot user={user} />}
    </div>
  )
}
