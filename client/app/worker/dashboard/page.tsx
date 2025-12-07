'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import axios from 'axios'
import toast from 'react-hot-toast'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8585/api'

interface Request {
  id: string
  laborType: string
  workType: string
  numberOfWorkers: number
  location: {
    latitude: number
    longitude: number
    address: string
  }
  customer: {
    id: string
    name: string
    phone: string
  }
  status: string
  distance?: string
  createdAt: string
  completedAt?: string
}

interface WorkHistory {
  type: string
  requestId: string
  laborType: string
  workType: string
  location: {
    latitude: number
    longitude: number
    address: string
  }
  status: string
  date: string
  customer: {
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

export default function WorkerDashboard() {
  const router = useRouter()
  const [requests, setRequests] = useState<Request[]>([])
  const [workHistory, setWorkHistory] = useState<WorkHistory[]>([])
  const [available, setAvailable] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [isToggling, setIsToggling] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [isSubmittingRating, setIsSubmittingRating] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [location, setLocation] = useState<{latitude: number, longitude: number} | null>(null)
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
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

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    
    if (!token || !userData) {
      router.push('/')
      return
    }

    const userObj = JSON.parse(userData)
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
    } catch (error) {
      console.error('Error fetching work history:', error)
    } finally {
      setIsLoadingHistory(false)
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
              <div className="flex items-center gap-2 bg-primary-50 px-4 py-2 rounded-full">
                <span className="text-sm text-gray-700">👤</span>
                <span className="text-gray-700 font-medium">{user?.name}</span>
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
              onClick={() => setShowHistory(!showHistory)}
              className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
                showHistory
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {showHistory ? '📋 Available Requests' : '📜 Work History'}
            </button>
            {!showHistory && (
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

        {!available && !showHistory && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-xl p-4 mb-6 animate-pulse">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <p className="text-yellow-800 font-medium">
                You are currently unavailable. Toggle availability to receive new requests.
              </p>
            </div>
          </div>
        )}

        {isLoading || isLoadingHistory ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <>
            {showHistory ? (
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
                            <span className="text-3xl">{getLaborTypeIcon(work.laborType)}</span>
                            <h3 className="text-xl font-bold capitalize text-gray-900">{work.laborType.toLowerCase()}</h3>
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
                      {work.status === 'COMPLETED' && (
                        <button
                          onClick={() => {
                            // Find the full request details
                            const fullRequest = requests.find(r => r.id === work.requestId) || {
                              id: work.requestId,
                              customer: work.customer
                            } as any
                            setSelectedRequest(fullRequest)
                            setShowRatingModal(true)
                          }}
                          className="w-full mt-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white py-2 rounded-lg font-semibold hover:shadow-lg transition-all"
                        >
                          ⭐ Rate Customer
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : (
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
                            <span className="text-3xl">{getLaborTypeIcon(request.laborType)}</span>
                            <h3 className="text-xl font-bold capitalize text-gray-900">{request.laborType.toLowerCase()}</h3>
                          </div>
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
                            <div className="flex items-center gap-2 text-gray-600">
                              <span>👤</span>
                              <span>{request.customer?.name || 'Customer'} - {request.customer?.phone || 'N/A'}</span>
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
      </div>
    </div>
  )
}
