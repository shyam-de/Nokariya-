'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import axios from 'axios'
import toast from 'react-hot-toast'

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
  }
  status: string
  distance?: string
  createdAt: string
  completedAt?: string
  customerRating?: number
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
  const [requests, setRequests] = useState<Request[]>([])
  const [workHistory, setWorkHistory] = useState<WorkHistory[]>([])
  const [available, setAvailable] = useState(true)
  const [ratedRequests, setRatedRequests] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [isToggling, setIsToggling] = useState(false)
  const [activeTab, setActiveTab] = useState<'available' | 'history' | 'concerns'>('available')
  const [myConcerns, setMyConcerns] = useState<any[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [isLoadingConcerns, setIsLoadingConcerns] = useState(false)
  const [isUpdatingConcernStatus, setIsUpdatingConcernStatus] = useState(false)
  const [editingConcern, setEditingConcern] = useState<{id: string, status: string, message: string} | null>(null)
  const [concernMessages, setConcernMessages] = useState<{[key: string]: any[]}>({})
  const [isLoadingMessages, setIsLoadingMessages] = useState<{[key: string]: boolean}>({})
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [showConcernModal, setShowConcernModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [isSubmittingRating, setIsSubmittingRating] = useState(false)
  const [location, setLocation] = useState<{latitude: number, longitude: number} | null>(null)
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

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    
    if (!token || !userData) {
      router.push('/')
      return
    }

    const userObj = JSON.parse(userData) as User
    setUser(userObj)

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
  }, [])

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token')
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
      console.error('Error fetching profile:', error)
    }
  }

  const updateLocation = async (loc: {latitude: number, longitude: number}) => {
    try {
      const token = localStorage.getItem('token')
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
      console.error('Error updating location:', error)
    }
  }

  const fetchWorkerProfile = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/workers/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setAvailable(response.data.available)
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

  const fetchAvailableRequests = async () => {
    setIsLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/requests/available`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setRequests(response.data)
    } catch (error) {
      console.error('Error fetching requests:', error)
      toast.error('Failed to fetch requests')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchWorkHistory = async () => {
    setIsLoadingHistory(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/workers/history`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setWorkHistory(response.data)
      
      // Check which completed requests have been rated
      const ratedSet = new Set<string>()
      for (const work of response.data) {
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
            console.error('Error checking rating:', error)
          }
        }
      }
      setRatedRequests(ratedSet)
    } catch (error) {
      console.error('Error fetching work history:', error)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const fetchMyConcerns = async () => {
    setIsLoadingConcerns(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/concerns/my-concerns`, {
        headers: { Authorization: `Bearer ${token}` }
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
      const response = await axios.get(`${API_URL}/concerns/${concernId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setConcernMessages({ ...concernMessages, [concernId]: response.data })
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setIsLoadingMessages({ ...isLoadingMessages, [concernId]: false })
    }
  }

  const handleConfirm = async (requestId: string) => {
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${API_URL}/requests/${requestId}/confirm`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )
      toast.success('Request confirmed! 🎉')
      fetchAvailableRequests()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to confirm request')
    }
  }

  const toggleAvailability = async () => {
    setIsToggling(true)
    try {
      const token = localStorage.getItem('token')
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
    } catch (error) {
      toast.error('Failed to update availability')
    } finally {
      setIsToggling(false)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdatingProfile(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.put(`${API_URL}/workers/profile/update`, profileData, {
        headers: { Authorization: `Bearer ${token}` }
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

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRequest) return

    setIsSubmittingRating(true)
    try {
      const token = localStorage.getItem('token')
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
      toast.success('Rating submitted successfully!')
      setShowRatingModal(false)
      if (selectedRequest) {
        setRatedRequests(new Set(Array.from(ratedRequests).concat(selectedRequest.id)))
      }
      setSelectedRequest(null)
      setRatingData({ rating: 5, comment: '' })
      fetchWorkHistory()
      }
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
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/')
  }

  const getLaborTypeIcon = (type: string) => {
    const icons: { [key: string]: string } = {
      'ELECTRICIAN': '⚡',
      'SKILLED': '🔧',
      'UNSKILLED': '👷'
    }
    return icons[type] || '👷'
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-green-50 to-emerald-50">
      <nav className="bg-white/90 backdrop-blur-md shadow-lg sticky top-0 z-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent hover:scale-105 transition-transform">
              Nokariya
            </Link>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowProfileModal(true)}
                className="px-4 py-2 text-sm text-gray-700 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all duration-200 flex items-center gap-2"
              >
                <span>⚙️</span>
                Profile
              </button>
              <button
                onClick={() => {
                  setSelectedRequest(null)
                  setShowConcernModal(true)
                }}
                className="px-4 py-2 text-sm text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 flex items-center gap-2"
              >
                <span>📢</span>
                Raise Concern
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
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-4xl font-bold text-gray-900 mb-2">Worker Dashboard</h2>
            <p className="text-gray-600">Find work opportunities and manage your profile</p>
          </div>
          <div className="flex space-x-4">
            <button
              onClick={() => setActiveTab('available')}
              className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
                activeTab === 'available'
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              📋 Available Requests
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
                activeTab === 'history'
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              📜 Work History
            </button>
            <button
              onClick={() => setActiveTab('concerns')}
              className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
                activeTab === 'concerns'
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              📢 My Concerns
            </button>
            {activeTab === 'available' && (
              <button
                onClick={fetchAvailableRequests}
                disabled={isLoading}
                className="px-6 py-2 bg-white border-2 border-primary-300 text-primary-600 rounded-lg font-medium hover:bg-primary-50 transition-all duration-200 hover:scale-105 transform disabled:opacity-50"
              >
                {isLoading ? 'Refreshing...' : '🔄 Refresh'}
              </button>
            )}
          </div>
        </div>

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
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Rate Customer</h3>
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
                  <p className="text-sm text-gray-600 mb-2">Customer: {selectedRequest.customer?.name}</p>
                </div>
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
                    placeholder="Share your experience with this customer..."
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

        {!available && activeTab === 'available' && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-xl p-4 mb-6 animate-pulse">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <p className="text-yellow-800 font-medium">
                You are currently unavailable. Toggle availability to receive new requests.
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
              <div className="space-y-6">
                {myConcerns.length === 0 ? (
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
                              concern.status === 'DISMISSED' ? 'bg-red-100 text-red-800' :
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
                                    await axios.put(`${API_URL}/concerns/${concern.id}/status`, payload, {
                                      headers: { Authorization: `Bearer ${token}` }
                                    })
                                    toast.success('Concern updated successfully!')
                                    setEditingConcern(null)
                                    fetchMyConcerns()
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
            )}
            {activeTab === 'history' && (
              <div className="grid md:grid-cols-2 gap-6">
                {workHistory.length === 0 ? (
                  <div className="col-span-2 bg-white rounded-xl shadow-lg p-12 text-center border-2 border-dashed border-gray-300">
                    <div className="text-6xl mb-4">📚</div>
                    <p className="text-xl text-gray-500 mb-2">No work history yet</p>
                    <p className="text-gray-400">Complete some jobs to see your history here!</p>
                  </div>
                ) : (
                  workHistory.map((work, index) => (
                    <div key={`${work.requestId}-${index}`} className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-purple-500 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 transform">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="flex flex-wrap gap-1 mb-2">
                              {work.laborTypes && work.laborTypes.length > 0 ? (
                                work.laborTypes.map((type: string, idx: number) => (
                                  <span key={idx} className="text-2xl">{getLaborTypeIcon(type)}</span>
                                ))
                              ) : (
                                <span className="text-2xl">⚡</span>
                              )}
                            </div>
                            <h3 className="text-xl font-bold capitalize text-gray-900 mb-2">
                              {work.workType}
                            </h3>
                            {work.laborTypes && work.laborTypes.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {work.laborTypes.map((type: string, idx: number) => (
                                  <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs capitalize">
                                    {type.toLowerCase()}
                                  </span>
                                ))}
                              </div>
                            )}
                            {work.startDate && work.endDate && (
                              <div className="text-sm text-gray-600 mb-2">
                                📅 {new Date(work.startDate).toLocaleDateString()} - {new Date(work.endDate).toLocaleDateString()}
                                <span className="ml-2 text-xs">
                                  ({Math.ceil((new Date(work.endDate).getTime() - new Date(work.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} days)
                                </span>
                              </div>
                            )}
                          </div>
                          <p className="text-gray-700 text-lg mb-3 font-medium">{work.workType}</p>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2 text-gray-600">
                              <span>👥</span>
                              <span>Work completed</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <span>📍</span>
                              <span>{work.location?.address || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <span>👤</span>
                              <span>{work.customer?.name || 'Customer'} - {work.customer?.phone || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <span>📅</span>
                              <span>{new Date(work.date).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        {getStatusBadge(work.status)}
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
                          className="w-full mt-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white py-2 rounded-lg font-semibold hover:shadow-lg transition-all"
                        >
                          ⭐ Rate Customer
                        </button>
                      )}
                      {work.status === 'COMPLETED' && ratedRequests.has(work.requestId) && (
                        <div className="w-full mt-4 bg-green-50 border-2 border-green-200 text-green-800 py-2 rounded-lg font-semibold text-center">
                          ✓ Rated
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
            {activeTab === 'available' && (
              <div className="grid md:grid-cols-2 gap-6">
                {requests.length === 0 ? (
                  <div className="col-span-2 bg-white rounded-xl shadow-lg p-12 text-center border-2 border-dashed border-gray-300">
                    <div className="text-6xl mb-4">📭</div>
                    <p className="text-xl text-gray-500 mb-2">No available requests at the moment</p>
                    <p className="text-gray-400">Check back later or make sure you're available!</p>
                  </div>
                ) : (
                  requests.map((request) => (
                    <div key={request.id} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 transform border-t-4 border-primary-500">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="flex flex-wrap gap-1">
                              {request.laborTypes && request.laborTypes.length > 0 ? (
                                request.laborTypes.map((type: string, idx: number) => (
                                  <span key={idx} className="text-2xl">{getLaborTypeIcon(type)}</span>
                                ))
                              ) : (
                                <span className="text-2xl">⚡</span>
                              )}
                            </div>
                            <h3 className="text-xl font-bold capitalize text-gray-900">{request.workType}</h3>
                          </div>
                          {request.laborTypes && request.laborTypes.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {request.laborTypes.map((type: string, idx: number) => (
                                <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs capitalize">
                                  {type.toLowerCase()}
                                </span>
                              ))}
                            </div>
                          )}
                          {request.startDate && request.endDate && (
                            <div className="text-sm text-gray-600 mb-2">
                              📅 {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                              <span className="ml-2 text-xs">
                                ({Math.ceil((new Date(request.endDate).getTime() - new Date(request.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} days)
                              </span>
                            </div>
                          )}
                          <p className="text-gray-700 text-lg mb-3 font-medium">{request.workType}</p>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2 text-gray-600">
                              <span>👥</span>
                              <span>{request.numberOfWorkers} worker{request.numberOfWorkers > 1 ? 's' : ''} needed</span>
                            </div>
                            {request.distance && (
                              <div className="flex items-center gap-2 text-primary-600 font-semibold">
                                <span>📍</span>
                                <span>{request.distance} km away</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-gray-600">
                                <span>👤</span>
                                <span>{request.customer?.name || 'Customer'} - {request.customer?.phone || 'N/A'}</span>
                              </div>
                              {request.customerRating !== undefined && request.customerRating > 0 && (
                                <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-full border border-yellow-200">
                                  <span className="text-yellow-500 text-sm">⭐</span>
                                  <span className="text-xs text-gray-700 font-semibold">
                                    {request.customerRating.toFixed(1)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        {getStatusBadge(request.status)}
                      </div>

                      <button
                        onClick={() => handleConfirm(request.id)}
                        disabled={!available}
                        className="w-full bg-gradient-to-r from-primary-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform disabled:bg-gray-300 disabled:cursor-not-allowed disabled:transform-none disabled:hover:shadow-none flex items-center justify-center gap-2"
                      >
                        <span>✓</span>
                        Confirm Request
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
            <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Raise a Concern</h3>
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
                {workHistory.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Related Request (Optional)</label>
                    <select
                      value={concernData.requestId}
                      onChange={(e) => setConcernData({ ...concernData, requestId: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">None</option>
                      {workHistory.map((work: any) => (
                        <option key={work.requestId} value={work.requestId}>
                          {work.workType} - {work.status}
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
      </div>
    </div>
  )
}
