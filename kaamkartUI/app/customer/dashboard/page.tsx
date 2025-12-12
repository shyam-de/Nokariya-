'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiClient, API_URL } from '@/lib/api'
import toast from 'react-hot-toast'

interface Request {
  id: string
  workerTypes: string[]
  workerTypeRequirements?: Array<{ laborType: string; numberOfWorkers: number }>
  workType: string
  numberOfWorkers: number
  status: string
  startDate?: string
  endDate?: string
  confirmedWorkers: any[]
  deployedWorkers: any[]
  location: {
    latitude: number
    longitude: number
    address: string
    landmark?: string
  }
  createdAt: string
  completedAt?: string
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

export default function CustomerDashboard() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'requests' | 'concerns'>('requests')
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [showConcernModal, setShowConcernModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null)
  const [selectedRequestForConcern, setSelectedRequestForConcern] = useState<Request | null>(null)
  const [requests, setRequests] = useState<Request[]>([])
  const [myConcerns, setMyConcerns] = useState<any[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [ratedRequests, setRatedRequests] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingConcerns, setIsLoadingConcerns] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [isSubmittingRating, setIsSubmittingRating] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [workerTypes, setLaborTypes] = useState<any[]>([])
  const [formData, setFormData] = useState({
    workerTypeRequirements: [] as Array<{ laborType: string; numberOfWorkers: number }>,
    workType: '',
    startDate: '',
    endDate: '',
    location: {
      latitude: 0,
      longitude: 0,
      address: '',
      landmark: '',
      state: '',
      city: '',
      pinCode: '',
      area: ''
    }
  })
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
  const [isUpdatingConcernStatus, setIsUpdatingConcernStatus] = useState(false)
  const [editingConcern, setEditingConcern] = useState<{id: string, status: string, message: string} | null>(null)
  const [concernMessages, setConcernMessages] = useState<{[key: string]: any[]}>({})
  const [isLoadingMessages, setIsLoadingMessages] = useState<{[key: string]: boolean}>({})
  const [userMessage, setUserMessage] = useState('')
  const [isSubmittingMessage, setIsSubmittingMessage] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    
    if (!token || !userData) {
      router.push('/')
      return
    }

    const userObj = JSON.parse(userData) as User
    setUser(userObj)
    fetchRequests()
    fetchProfile()
    fetchLaborTypes()
    // Location will only be detected when user clicks "Detect Current Location" button
  }, [])

  const fetchLaborTypes = async () => {
    try {
      const response = await apiClient.get('/public/worker-types')
      setLaborTypes(response.data)
    } catch (error) {
      console.error('Error fetching labor types:', error)
    }
  }

  useEffect(() => {
    if (activeTab === 'concerns') {
      fetchMyConcerns()
    }
  }, [activeTab])

  const fetchProfile = async () => {
    try {
      const response = await apiClient.get('/profile')
      setProfile(response.data)
      setProfileData({
        name: response.data.name,
        email: response.data.email,
        phone: response.data.phone,
        secondaryPhone: response.data.secondaryPhone || '',
        location: response.data.location || { latitude: 0, longitude: 0, address: '' }
      })
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData({
            ...formData,
            location: {
              ...formData.location,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              // Don't overwrite address if user has already entered it
              address: formData.location.address || 'Current Location'
            }
          })
        },
        () => {
          toast.error('Unable to get location. Please fill in address fields instead.')
        }
      )
    } else {
      toast.error('Geolocation is not supported by your browser. Please fill in address fields.')
    }
  }

  const clearLocation = () => {
    setFormData({
      ...formData,
      location: {
        ...formData.location,
        latitude: 0,
        longitude: 0,
        address: formData.location.address // Keep the address if user entered it
      }
    })
  }

  const fetchRequests = async () => {
    setIsLoading(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        toast.error('No authentication token found. Please login again.')
        router.push('/login')
        return
      }
      
      try {
        await apiClient.get('/auth/health', { timeout: 5000 })
      } catch (healthError: any) {
        if (healthError.code === 'ECONNREFUSED' || healthError.code === 'ERR_NETWORK') {
          toast.error('Cannot connect to server. Please check if API is running on port 8585.')
        }
        return
      }
      
      const response = await apiClient.get('/requests/my-requests', {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      })
      setRequests(response.data)
      
      // Check which completed requests have been rated
      const ratedSet = new Set<string>()
      for (const request of response.data) {
        if (request.status === 'COMPLETED') {
          try {
            const ratingCheck = await apiClient.get(`/ratings/check/${request.id}`, {
            })
            if (ratingCheck.data.hasRated) {
              ratedSet.add(request.id)
            }
          } catch (error) {
            // Ignore errors for rating check
            console.error('Error checking rating:', error)
          }
        }
      }
      setRatedRequests(ratedSet)
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED' || !error.response) {
        toast.error('Cannot connect to server. Please check if API is running on port 8585.')
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error('Session expired. Please login again.')
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        router.push('/login')
      } else {
        toast.error(error.response?.data?.message || 'Failed to fetch requests')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.workerTypeRequirements.length === 0) {
      toast.error('Please add at least one labor type requirement')
      return
    }
    
    // Validate all requirements have labor type selected
    console.log('Form data before validation:', formData.workerTypeRequirements)
    const invalidRequirements = formData.workerTypeRequirements.filter((req, idx) => {
      const isEmpty = !req.laborType || 
                      req.laborType === '' || 
                      req.laborType.trim() === '' ||
                      req.laborType === 'Select Worker Type'
      if (isEmpty) {
        console.log(`Requirement ${idx + 1} is invalid:`, req)
      }
      return isEmpty
    })
    
    if (invalidRequirements.length > 0) {
      const invalidIndices = invalidRequirements.map((_, idx) => {
        const actualIdx = formData.workerTypeRequirements.findIndex(r => r === invalidRequirements[idx])
        return actualIdx + 1
      })
      toast.error(`Please select worker type for requirement${invalidIndices.length > 1 ? 's' : ''} ${invalidIndices.join(', ')}`)
      return
    }
    
    // Validate all requirements have number of workers > 0
    const invalidWorkerCounts = formData.workerTypeRequirements.filter(req => 
      !req.numberOfWorkers || 
      req.numberOfWorkers < 1 ||
      isNaN(req.numberOfWorkers)
    )
    if (invalidWorkerCounts.length > 0) {
      toast.error('Please enter a valid number of workers (at least 1) for all requirements')
      return
    }
    
    // Validate all requirements have number of workers > 0
    const invalidWorkerCounts = formData.workerTypeRequirements.filter(req => 
      !req.numberOfWorkers || 
      req.numberOfWorkers < 1 ||
      isNaN(req.numberOfWorkers)
    )
    if (invalidWorkerCounts.length > 0) {
      toast.error('Please enter a valid number of workers (at least 1) for all requirements')
      return
    }
    
    if (!formData.startDate || !formData.endDate) {
      toast.error('Please select start and end dates')
      return
    }
    
    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      toast.error('End date must be after start date')
      return
    }
    
    // Validate location: either current location (lat/long) OR address fields (State, City, Pin Code) required
    const hasCurrentLocation = formData.location.latitude !== 0 && formData.location.longitude !== 0
    const hasAddressFields = formData.location.state && formData.location.city && formData.location.pinCode
    
    if (!hasCurrentLocation && !hasAddressFields) {
      toast.error('Please either use current location or fill in State, City, and Pin Code')
      return
    }
    
    setIsSubmitting(true)
    try {
      const token = localStorage.getItem('token')
      const requestData = {
        workerTypeRequirements: formData.workerTypeRequirements.map(req => ({
          laborType: req.laborType.toUpperCase(),
          numberOfWorkers: req.numberOfWorkers
        })),
        workType: formData.workType,
        startDate: formData.startDate,
        endDate: formData.endDate,
        location: {
          latitude: formData.location.latitude,
          longitude: formData.location.longitude,
          address: formData.location.address,
          landmark: formData.location.landmark || null,
          state: formData.location.state || null,
          city: formData.location.city || null,
          pinCode: formData.location.pinCode || null,
          area: formData.location.area || null
        }
      }
      console.log('Sending request data:', JSON.stringify(requestData, null, 2))
      const response = await apiClient.post('/requests', requestData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      console.log('Request created successfully:', response.data)
      toast.success('Request created! It is now pending admin approval.')
      setShowRequestForm(false)
      setFormData({
        workerTypeRequirements: [],
        workType: '',
        startDate: '',
        endDate: '',
        location: {
          latitude: 0,
          longitude: 0,
          address: '',
          landmark: '',
          state: '',
          city: '',
          pinCode: '',
          area: ''
        }
      })
      fetchRequests()
    } catch (error: any) {
      console.error('Error creating request:', error)
      console.error('Error response:', error.response)
      console.error('Error response data:', error.response?.data)
      
      let errorMessage = 'Failed to create request'
      
      if (error.response?.data) {
        // Handle validation errors
        if (error.response.data.errors) {
          const errors = error.response.data.errors
          errorMessage = Object.entries(errors)
            .map(([field, msg]) => `${field}: ${msg}`)
            .join(', ')
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message
        }
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdatingProfile(true)
    try {
      const token = localStorage.getItem('token')
      const response = await apiClient.put('/profile', profileData, {
      })
      toast.success('Profile updated successfully!')
      setShowProfileModal(false)
      fetchProfile()
      // Update user in localStorage
      const updatedUser = { ...user, ...response.data.user }
      localStorage.setItem('user', JSON.stringify(updatedUser))
      setUser(updatedUser)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update profile')
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const handleCompleteRequest = async (requestId: string) => {
    try {
      const token = localStorage.getItem('token')
      await apiClient.post(`/requests/${requestId}/complete`, {}, {
      })
      toast.success('Request marked as completed!')
      fetchRequests()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to complete request')
    }
  }

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRequest) return

    setIsSubmittingRating(true)
    try {
      const token = localStorage.getItem('token')
      const deployedWorkers = selectedRequest.deployedWorkers || []
      
      // Rate each deployed worker
      for (const dw of deployedWorkers) {
        const workerId = dw.worker?.id || dw.workerId
        if (workerId) {
          await apiClient.post('/ratings', {
            requestId: selectedRequest.id,
            ratedUserId: workerId,
            rating: ratingData.rating,
            comment: ratingData.comment
          }, {
          })
        }
      }
      
      toast.success('Rating submitted successfully!')
      setShowRatingModal(false)
      if (selectedRequest) {
        setRatedRequests(new Set(Array.from(ratedRequests).concat(selectedRequest.id)))
      }
      setSelectedRequest(null)
      setRatingData({ rating: 5, comment: '' })
      fetchRequests()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to submit rating')
    } finally {
      setIsSubmittingRating(false)
    }
  }

  const handleSubmitConcern = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingConcern(true)
    try {
      const token = localStorage.getItem('token')
      const data: any = {
        description: concernData.description,
        type: concernData.type
      }
      
      if (concernData.requestId) {
        data.requestId = parseInt(concernData.requestId)
      }
      
      if (concernData.relatedToUserId) {
        data.relatedToUserId = parseInt(concernData.relatedToUserId)
      }
      
      await apiClient.post('/concerns', data, {
      })
      
      toast.success('Concern submitted successfully! Admin will review it.')
      setShowConcernModal(false)
      setSelectedRequestForConcern(null)
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

  const fetchMyConcerns = async () => {
    setIsLoadingConcerns(true)
    try {
      const token = localStorage.getItem('token')
      const response = await apiClient.get('/concerns/my-concerns', {
      })
      setMyConcerns(response.data)
      // Fetch messages for all concerns
      response.data.forEach((concern: any) => {
        fetchConcernMessages(concern.id)
      })
    } catch (error) {
      console.error('Error fetching concerns:', error)
      toast.error('Failed to fetch concerns')
    } finally {
      setIsLoadingConcerns(false)
    }
  }

  const fetchConcernMessages = async (concernId: string) => {
    setIsLoadingMessages({ ...isLoadingMessages, [concernId]: true })
    try {
      const token = localStorage.getItem('token')
      const response = await apiClient.get(`/concerns/${concernId}/messages`, {
      })
      setConcernMessages({ ...concernMessages, [concernId]: response.data })
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setIsLoadingMessages({ ...isLoadingMessages, [concernId]: false })
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/')
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
    return (
      <span className={`px-4 py-2 rounded-full text-sm font-medium ${config.bg} ${config.text} flex items-center gap-2`}>
        <span>{config.icon}</span>
        {status.replace(/_/g, ' ')}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      <nav className="bg-white/90 backdrop-blur-md shadow-lg sticky top-0 z-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 md:h-16 items-center">
            <Link href="/" className="text-lg md:text-xl lg:text-2xl font-bold bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent hover:scale-105 transition-transform truncate">
              KaamKart
            </Link>
            
            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-4">
              <button
                onClick={() => setShowProfileModal(true)}
                className="px-4 py-2 text-sm text-gray-700 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all duration-200 flex items-center gap-2"
              >
                <span>⚙️</span>
                Profile
              </button>
              <button
                onClick={() => {
                  setSelectedRequestForConcern(null)
                  setShowConcernModal(true)
                }}
                className="px-4 py-2 text-sm text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 flex items-center gap-2"
              >
                <span>📢</span>
                Raise Concern
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

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-gray-700 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all duration-200"
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

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-gray-200 py-4 space-y-2 animate-slide-down">
              <button
                onClick={() => {
                  setShowProfileModal(true)
                  setMobileMenuOpen(false)
                }}
                className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all duration-200 flex items-center gap-2"
              >
                <span>⚙️</span>
                Profile
              </button>
              <button
                onClick={() => {
                  setSelectedRequestForConcern(null)
                  setShowConcernModal(true)
                  setMobileMenuOpen(false)
                }}
                className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 flex items-center gap-2"
              >
                <span>📢</span>
                Raise Concern
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-4xl font-bold text-gray-900 mb-2">Customer Dashboard</h2>
            <p className="text-gray-600">Manage your labor requests and track their status</p>
          </div>
          {activeTab === 'requests' && (
            <button
              onClick={() => setShowRequestForm(true)}
              className="px-6 py-3 bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 transform flex items-center gap-2"
            >
              <span className="text-xl">+</span>
              Create New Request
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-lg p-2 mb-6 overflow-x-auto">
          <div className="flex gap-2 min-w-max md:min-w-0">
            <button
              onClick={() => setActiveTab('requests')}
              className={`px-3 py-2 md:px-4 md:py-3 lg:px-6 whitespace-nowrap rounded-lg text-xs md:text-sm font-semibold transition-all duration-200 ${
                activeTab === 'requests'
                  ? 'bg-gradient-to-r from-primary-600 to-indigo-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="hidden sm:inline">📋 </span>My <span className="hidden md:inline">Requests</span> ({requests.length})
            </button>
            <button
              onClick={() => setActiveTab('concerns')}
              className={`px-3 py-2 md:px-4 md:py-3 lg:px-6 whitespace-nowrap rounded-lg text-xs md:text-sm font-semibold transition-all duration-200 ${
                activeTab === 'concerns'
                  ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="hidden sm:inline">📢 </span>My <span className="hidden md:inline">Concerns</span> ({myConcerns.filter((c: any) => c.status === 'PENDING').length > 0 ? myConcerns.filter((c: any) => c.status === 'PENDING').length : myConcerns.length})
            </button>
          </div>
        </div>

        {/* Request Form Modal */}
        {showRequestForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Create New Request</h3>
              <button
                onClick={() => setShowRequestForm(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl"
              >
                &times;
              </button>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Section 1: Work Details */}
                <div className="border-b-2 border-gray-200 pb-4">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span>📝</span> Work Details
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="workType" className="block text-sm font-medium text-gray-700 mb-1">
                        Work Type <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="workType"
                        value={formData.workType}
                        onChange={(e) => setFormData({ ...formData, workType: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                        placeholder="e.g., Wiring, Plumbing, Cleaning, Construction"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Labor Requirements */}
                <div className="border-b-2 border-gray-200 pb-4">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span>👷</span> Labor Requirements <span className="text-red-500">*</span>
                  </h4>
                  <div className="space-y-3 max-h-64 overflow-y-auto p-3 border-2 border-gray-300 rounded-lg bg-gray-50">
                    {formData.workerTypeRequirements.map((req, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-primary-200 shadow-sm">
                        <div className="flex-1">
                          <select
                            value={req.laborType || ''}
                            onChange={(e) => {
                              const updated = [...formData.workerTypeRequirements]
                              updated[index] = {
                                ...updated[index],
                                laborType: e.target.value
                              }
                              setFormData({ ...formData, workerTypeRequirements: updated })
                              console.log('Updated requirement:', updated[index])
                            }}
                            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            required
                          >
                            <option value="">Select Worker Type</option>
                            {workerTypes
                              .filter(lt => lt.isActive)
                              .filter(lt => !formData.workerTypeRequirements.some((r, i) => i !== index && r.laborType === lt.name))
                              .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
                              .map((type) => (
                                <option key={type.name} value={type.name}>
                                  {type.icon || '🔧'} {type.displayName || type.name}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div className="w-24">
                          <input
                            type="number"
                            min="1"
                            value={req.numberOfWorkers}
                            onChange={(e) => {
                              const updated = [...formData.workerTypeRequirements]
                              updated[index].numberOfWorkers = parseInt(e.target.value) || 1
                              setFormData({ ...formData, workerTypeRequirements: updated })
                            }}
                            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            placeholder="Count"
                            required
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = formData.workerTypeRequirements.filter((_, i) => i !== index)
                            setFormData({ ...formData, workerTypeRequirements: updated })
                          }}
                          className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          workerTypeRequirements: [...formData.workerTypeRequirements, { laborType: '', numberOfWorkers: 1 }]
                        })
                      }}
                      className="w-full px-4 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors font-medium border-2 border-dashed border-primary-300"
                    >
                      + Add Labor Type
                    </button>
                  </div>
                  {formData.workerTypeRequirements.length === 0 && (
                    <p className="text-xs text-red-500 mt-2">Please add at least one labor type requirement</p>
                  )}
                  {formData.workerTypeRequirements.length > 0 && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-800 font-semibold">
                        Total Workers Required: {
                          formData.workerTypeRequirements.reduce((sum, req) => sum + (req.numberOfWorkers || 0), 0)
                        }
                      </p>
                    </div>
                  )}
                </div>

                {/* Section 3: Schedule */}
                <div className="border-b-2 border-gray-200 pb-4">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span>📅</span> Schedule <span className="text-red-500">*</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        id="startDate"
                        value={formData.startDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        id="endDate"
                        value={formData.endDate}
                        min={formData.startDate || new Date().toISOString().split('T')[0]}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                        required
                      />
                    </div>
                  </div>
                  {formData.startDate && formData.endDate && new Date(formData.endDate) < new Date(formData.startDate) && (
                    <p className="text-xs text-red-500 mt-2">⚠️ End date must be after start date</p>
                  )}
                  {formData.startDate && formData.endDate && new Date(formData.endDate) >= new Date(formData.startDate) && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800">
                        <span className="font-semibold">Duration:</span> {
                          Math.ceil((new Date(formData.endDate).getTime() - new Date(formData.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
                        } day(s)
                      </p>
                    </div>
                  )}
                </div>

                {/* Section 4: Location */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span>📍</span> Location <span className="text-red-500">*</span>
                  </h4>
                  
                  {/* Current Location Toggle Button */}
                  <div className="mb-4">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={formData.location.latitude !== 0 && formData.location.longitude !== 0 ? clearLocation : getLocation}
                        className={`px-4 py-2 rounded-lg transition-all font-medium flex items-center gap-2 text-sm ${
                          formData.location.latitude !== 0 && formData.location.longitude !== 0
                            ? 'bg-green-500 hover:bg-green-600 text-white'
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                        }`}
                      >
                        <span>📍</span>
                        {formData.location.latitude !== 0 && formData.location.longitude !== 0 
                          ? 'Using Current Location' 
                          : 'Use Current Location'}
                      </button>
                      {formData.location.latitude !== 0 && formData.location.longitude !== 0 && (
                        <span className="text-xs text-green-600 font-medium">✓ Location detected</span>
                      )}
                    </div>
                  </div>

                  {/* Address Fields */}
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                        Full Address
                      </label>
                      <input
                        type="text"
                        id="address"
                        value={formData.location.address}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          location: { ...formData.location, address: e.target.value }
                        })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                        placeholder="Enter complete address (e.g., House No, Street, Area, City, State)"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="landmark" className="block text-sm font-medium text-gray-700 mb-1">
                        Landmark (Optional)
                      </label>
                      <input
                        type="text"
                        id="landmark"
                        value={formData.location.landmark || ''}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          location: { ...formData.location, landmark: e.target.value }
                        })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                        placeholder="e.g., Near ABC Mall, Behind XYZ Building"
                      />
                    </div>

                    {/* Only show address details if current location is NOT detected */}
                    {formData.location.latitude === 0 || formData.location.longitude === 0 ? (
                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-2">
                          Address Details <span className="text-red-500">*</span>
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label htmlFor="state" className="block text-xs font-medium text-gray-700 mb-1">
                              State <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              id="state"
                              value={formData.location.state || ''}
                              onChange={(e) => setFormData({ 
                                ...formData, 
                                location: { ...formData.location, state: e.target.value }
                              })}
                              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                              placeholder="State"
                            />
                          </div>
                          <div>
                            <label htmlFor="city" className="block text-xs font-medium text-gray-700 mb-1">
                              City <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              id="city"
                              value={formData.location.city || ''}
                              onChange={(e) => setFormData({ 
                                ...formData, 
                                location: { ...formData.location, city: e.target.value }
                              })}
                              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                              placeholder="City"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div>
                            <label htmlFor="pinCode" className="block text-xs font-medium text-gray-700 mb-1">
                              Pin Code <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              id="pinCode"
                              value={formData.location.pinCode || ''}
                              onChange={(e) => setFormData({ 
                                ...formData, 
                                location: { ...formData.location, pinCode: e.target.value }
                              })}
                              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                              placeholder="Pin Code"
                            />
                          </div>
                          <div>
                            <label htmlFor="area" className="block text-xs font-medium text-gray-700 mb-1">
                              Area
                            </label>
                            <input
                              type="text"
                              id="area"
                              value={formData.location.area || ''}
                              onChange={(e) => setFormData({ 
                                ...formData, 
                                location: { ...formData.location, area: e.target.value }
                              })}
                              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                              placeholder="Area/Locality"
                            />
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-primary-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isSubmitting ? 'Creating Request...' : 'Submit Request'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Profile Modal */}
        {showProfileModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-lg relative">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Edit Profile</h3>
              <button
                onClick={() => setShowProfileModal(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl"
              >
                &times;
              </button>
              <form onSubmit={handleUpdateProfile} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Phone (Optional)</label>
                  <input
                    type="tel"
                    value={profileData.secondaryPhone}
                    onChange={(e) => setProfileData({ ...profileData, secondaryPhone: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="w-full bg-gradient-to-r from-primary-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform disabled:opacity-50"
                >
                  {isUpdatingProfile ? 'Updating...' : 'Update Profile'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Rating Modal */}
        {showRatingModal && selectedRequest && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-lg relative">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Rate Workers</h3>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rating (1-5 stars)</label>
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
                  <p className="text-sm text-gray-600 mt-2">Selected: {ratingData.rating} star{ratingData.rating !== 1 ? 's' : ''}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Comment (Optional)</label>
                  <textarea
                    value={ratingData.comment}
                    onChange={(e) => setRatingData({ ...ratingData, comment: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    rows={4}
                    placeholder="Share your experience..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingRating}
                  className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white py-3 rounded-lg font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform disabled:opacity-50"
                >
                  {isSubmittingRating ? 'Submitting...' : 'Submit Rating'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Concern Modal */}
        {showConcernModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Raise a Concern</h3>
              <button
                onClick={() => {
                  setShowConcernModal(false)
                  setSelectedRequestForConcern(null)
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Concern Type <span className="text-red-500">*</span></label>
                  <select
                    value={concernData.type}
                    onChange={(e) => setConcernData({ ...concernData, type: e.target.value as any })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  >
                    <option value="WORK_QUALITY">Work Quality</option>
                    <option value="PAYMENT_ISSUE">Payment Issue</option>
                    <option value="BEHAVIOR">Behavior</option>
                    <option value="SAFETY">Safety</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                {requests.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Related Request (Optional)</label>
                    <select
                      value={concernData.requestId}
                      onChange={(e) => setConcernData({ ...concernData, requestId: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">None</option>
                      {requests.map((req) => (
                        <option key={req.id} value={req.id}>
                          {req.workType} - {req.status}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-red-500">*</span></label>
                  <textarea
                    value={concernData.description}
                    onChange={(e) => setConcernData({ ...concernData, description: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    rows={6}
                    placeholder="Please describe your concern in detail..."
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingConcern}
                  className="w-full bg-gradient-to-r from-red-500 to-pink-500 text-white py-3 rounded-lg font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform disabled:opacity-50"
                >
                  {isSubmittingConcern ? 'Submitting...' : 'Submit Concern'}
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'concerns' ? (
          <div className="space-y-6">
            {isLoadingConcerns ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            ) : myConcerns.length === 0 ? (
              <div className="bg-white rounded-xl shadow-lg p-12 text-center border-2 border-dashed border-gray-300">
                <div className="text-6xl mb-4">📢</div>
                <p className="text-xl text-gray-500 mb-2">No concerns raised yet</p>
                <p className="text-gray-400">Click "Raise Concern" to submit a concern</p>
              </div>
            ) : (
              myConcerns.map((concern: any) => (
                <div key={concern.id} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 transform border-l-4 border-red-500">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">Concern #{concern.id}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          concern.type === 'WORK_QUALITY' ? 'bg-blue-100 text-blue-800' :
                          concern.type === 'PAYMENT_ISSUE' ? 'bg-yellow-100 text-yellow-800' :
                          concern.type === 'BEHAVIOR' ? 'bg-red-100 text-red-800' :
                          concern.type === 'SAFETY' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {concern.type.replace(/_/g, ' ')}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          concern.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                          concern.status === 'IN_REVIEW' ? 'bg-blue-100 text-blue-800' :
                          concern.status === 'RESOLVED' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {concern.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm text-gray-600 mb-4">
                        {concern.request && (
                          <p><span className="font-semibold">Related Request:</span> {concern.request.workType} (ID: {concern.request.id})</p>
                        )}
                        <p><span className="font-semibold">Created:</span> {new Date(concern.createdAt).toLocaleString()}</p>
                        {concern.resolvedAt && (
                          <p><span className="font-semibold">Resolved:</span> {new Date(concern.resolvedAt).toLocaleString()}</p>
                        )}
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <p className="font-semibold text-gray-900 mb-2">Description:</p>
                        <p className="text-gray-700">{concern.description}</p>
                      </div>
                      
                      {/* Conversation Thread */}
                      <div className="mb-4">
                        <p className="font-semibold text-gray-900 mb-3">Conversation:</p>
                        {isLoadingMessages[concern.id] ? (
                          <div className="flex justify-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                          </div>
                        ) : concernMessages[concern.id] && concernMessages[concern.id].length > 0 ? (
                          <div className="space-y-3 max-h-96 overflow-y-auto">
                            {concernMessages[concern.id].map((msg: any) => {
                              const isUser = msg.sentBy?.id === concern.raisedBy?.id
                              const isAdmin = msg.sentBy?.role === 'ADMIN'
                              return (
                                <div
                                  key={msg.id}
                                  className={`p-3 rounded-lg ${
                                    isAdmin
                                      ? 'bg-blue-50 border-l-4 border-blue-500'
                                      : isUser
                                      ? 'bg-green-50 border-l-4 border-green-500'
                                      : 'bg-gray-50 border-l-4 border-gray-400'
                                  }`}
                                >
                                  <div className="flex justify-between items-start mb-1">
                                    <p className={`font-semibold text-sm ${
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
                          <p className="text-gray-500 text-sm italic">No messages yet. Start the conversation by updating the concern.</p>
                        )}
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        {concern.status === 'RESOLVED' ? (
                          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                            <p className="text-green-800 font-semibold flex items-center gap-2">
                              <span>✓</span>
                              This concern has been resolved and cannot be edited.
                            </p>
                          </div>
                        ) : editingConcern && editingConcern.id === concern.id ? (
                          <>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Update Status:</label>
                            <select
                              value={editingConcern.status === 'IN_REVIEW' ? 'PENDING' : editingConcern.status}
                              onChange={(e) => {
                                if (editingConcern) {
                                  setEditingConcern({ ...editingConcern, status: e.target.value })
                                }
                              }}
                              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 mb-3"
                            >
                              <option value="PENDING">Pending</option>
                              <option value="RESOLVED">Resolved</option>
                            </select>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Message (Optional):</label>
                            <textarea
                              value={editingConcern.message || ''}
                              onChange={(e) => {
                                if (editingConcern) {
                                  setEditingConcern({ ...editingConcern, message: e.target.value })
                                }
                              }}
                              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 mb-3"
                              rows={3}
                              placeholder="Add a message or update about this concern (optional)..."
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={async () => {
                                  if (!editingConcern) return
                                  setIsUpdatingConcernStatus(true)
                                  try {
                                    const token = localStorage.getItem('token')
                                    const payload: any = {
                                      status: editingConcern.status === 'IN_REVIEW' ? 'PENDING' : editingConcern.status
                                    }
                                    // Only include message if it's not empty
                                    if (editingConcern.message && editingConcern.message.trim()) {
                                      payload.message = editingConcern.message.trim()
                                    }
                                    await apiClient.put(`/concerns/${concern.id}/status`, payload, {
                                    })
                                    toast.success('Concern updated successfully!')
                                    setEditingConcern(null)
                                    fetchMyConcerns()
                                    // Refresh messages for this concern
                                    fetchConcernMessages(concern.id)
                                  } catch (error: any) {
                                    toast.error(error.response?.data?.message || 'Failed to update concern')
                                  } finally {
                                    setIsUpdatingConcernStatus(false)
                                  }
                                }}
                                disabled={isUpdatingConcernStatus}
                                className="flex-1 bg-gradient-to-r from-primary-600 to-indigo-600 text-white py-2 rounded-lg font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform disabled:opacity-50"
                              >
                                {isUpdatingConcernStatus ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={() => setEditingConcern(null)}
                                disabled={isUpdatingConcernStatus}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all disabled:opacity-50"
                              >
                                Cancel
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
                            Update Concern
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <>
            {isLoading ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {requests.length === 0 ? (
                  <div className="col-span-full bg-white rounded-xl shadow-lg p-12 text-center border-2 border-dashed border-gray-300">
                    <div className="text-6xl mb-4">📝</div>
                    <p className="text-xl text-gray-500 mb-2">No requests created yet</p>
                    <p className="text-gray-400">Click "Create New Request" to get started!</p>
                  </div>
                ) : (
                  requests.map((request) => (
                <div key={request.id} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 transform border-t-4 border-primary-500">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold capitalize text-gray-900 mb-2">{request.workType}</h3>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2 text-gray-600 flex-wrap">
                          <span>⚡</span>
                          {request.workerTypes && request.workerTypes.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {request.workerTypes.map((type: string, idx: number) => (
                                <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs capitalize">
                                  {type.toLowerCase()}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="capitalize text-gray-500">N/A</span>
                          )}
                        </div>
                        {request.startDate && request.endDate && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <span>📅</span>
                            <span>{new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-gray-600">
                          <span>👥</span>
                          <span>{request.numberOfWorkers} worker{request.numberOfWorkers > 1 ? 's' : ''} needed</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <span>📍</span>
                          <span>{request.location?.address || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <span>🕒</span>
                          <span>{new Date(request.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>

                  {request.status === 'DEPLOYED' && (
                    <button
                      onClick={() => handleCompleteRequest(request.id)}
                      className="w-full mt-4 bg-green-500 text-white py-2 rounded-lg font-semibold hover:bg-green-600 transition-colors"
                    >
                      Mark as Completed
                    </button>
                  )}

                  {request.status === 'COMPLETED' && request.deployedWorkers && request.deployedWorkers.length > 0 && (
                    <div className="flex gap-2 mt-4">
                      {!ratedRequests.has(request.id) ? (
                        <button
                          onClick={() => {
                            setSelectedRequest(request)
                            setShowRatingModal(true)
                          }}
                          className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-white py-2 rounded-lg font-semibold hover:shadow-lg transition-all"
                        >
                          ⭐ Rate Workers
                        </button>
                      ) : (
                        <div className="flex-1 bg-green-50 border-2 border-green-200 text-green-800 py-2 rounded-lg font-semibold text-center">
                          ✓ Rated
                        </div>
                      )}
                      <button
                        onClick={() => {
                          setSelectedRequestForConcern(request)
                          setConcernData({
                            ...concernData,
                            requestId: request.id
                          })
                          setShowConcernModal(true)
                        }}
                        className="flex-1 bg-gradient-to-r from-red-500 to-pink-500 text-white py-2 rounded-lg font-semibold hover:shadow-lg transition-all"
                      >
                        📢 Concern
                      </button>
                    </div>
                  )}
                  {request.status !== 'COMPLETED' && (
                    <button
                      onClick={() => {
                        setSelectedRequestForConcern(request)
                        setConcernData({
                          ...concernData,
                          requestId: request.id
                        })
                        setShowConcernModal(true)
                      }}
                      className="w-full mt-4 bg-gradient-to-r from-red-500 to-pink-500 text-white py-2 rounded-lg font-semibold hover:shadow-lg transition-all"
                    >
                      📢 Raise Concern
                    </button>
                  )}

                  {request.deployedWorkers && request.deployedWorkers.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-green-200">
                      <p className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-2">
                        <span>🚀</span>
                        Deployed Workers ({request.deployedWorkers.length})
                      </p>
                      <div className="space-y-2">
                        {request.deployedWorkers.map((dw: any, idx: number) => {
                          const workerName = dw.worker?.name || dw.workerId?.name || 'Worker'
                          const workerPhone = dw.worker?.phone || dw.workerId?.phone || 'N/A'
                          // Get rating from workerRating field (set by API)
                          const workerRating = dw.workerRating !== undefined && dw.workerRating !== null ? dw.workerRating : 0.0
                          const ratingValue = typeof workerRating === 'number' ? workerRating : parseFloat(String(workerRating)) || 0.0
                          const numStars = Math.max(1, Math.min(5, Math.round(ratingValue)))
                          const ratingStars = '⭐'.repeat(numStars)
                          
                          return (
                            <div key={idx} className="bg-green-50 p-3 rounded-lg border-2 border-green-200">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-bold text-green-900">{workerName}</p>
                                  <p className="text-sm text-green-700">{workerPhone}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-green-600 font-semibold">Rating</p>
                                  <div className="flex items-center gap-1">
                                    <span className="text-yellow-500 text-sm">{ratingStars}</span>
                                    <span className="text-xs text-green-700 font-semibold">({ratingValue.toFixed(1)})</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
