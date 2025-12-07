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
  status: string
  confirmedWorkers: any[]
  deployedWorkers: any[]
  location: {
    latitude: number
    longitude: number
    address: string
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

export default function CustomerDashboard() {
  const router = useRouter()
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null)
  const [requests, setRequests] = useState<Request[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [isSubmittingRating, setIsSubmittingRating] = useState(false)
  const [formData, setFormData] = useState({
    laborType: 'ELECTRICIAN' as 'ELECTRICIAN' | 'SKILLED' | 'UNSKILLED',
    workType: '',
    numberOfWorkers: 1,
    location: {
      latitude: 0,
      longitude: 0,
      address: ''
    }
  })
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
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    
    if (!token || !userData) {
      router.push('/')
      return
    }

    setUser(JSON.parse(userData))
    fetchRequests()
    fetchProfile()
    getLocation()
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

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData({
            ...formData,
            location: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              address: 'Current Location'
            }
          })
        },
        () => {
          toast.error('Unable to get location')
        }
      )
    }
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
        await axios.get(`${API_URL}/auth/health`, { timeout: 5000 })
      } catch (healthError: any) {
        if (healthError.code === 'ECONNREFUSED' || healthError.code === 'ERR_NETWORK') {
          toast.error('Cannot connect to server. Please check if backend is running on port 8585.')
        }
        return
      }
      
      const response = await axios.get(`${API_URL}/requests/my-requests`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      })
      setRequests(response.data)
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED' || !error.response) {
        toast.error('Cannot connect to server. Please check if backend is running on port 8585.')
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
    setIsSubmitting(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${API_URL}/requests`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      })
      toast.success('Request created! It is now pending admin approval.')
      setShowRequestForm(false)
      setFormData({
        laborType: 'ELECTRICIAN' as const,
        workType: '',
        numberOfWorkers: 1,
        location: formData.location
      })
      fetchRequests()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create request')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdatingProfile(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.put(`${API_URL}/profile`, profileData, {
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

  const handleCompleteRequest = async (requestId: string) => {
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${API_URL}/requests/${requestId}/complete`, {}, {
        headers: { Authorization: `Bearer ${token}` }
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
          await axios.post(`${API_URL}/ratings`, {
            requestId: selectedRequest.id,
            ratedUserId: workerId,
            rating: ratingData.rating,
            comment: ratingData.comment
          }, {
            headers: { Authorization: `Bearer ${token}` }
          })
        }
      }
      
      toast.success('Rating submitted successfully!')
      setShowRatingModal(false)
      setSelectedRequest(null)
      setRatingData({ rating: 5, comment: '' })
      fetchRequests()
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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-4xl font-bold text-gray-900 mb-2">My Requests</h2>
            <p className="text-gray-600">Manage your labor requests and track their status</p>
          </div>
          <button
            onClick={() => setShowRequestForm(true)}
            className="px-6 py-3 bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 transform flex items-center gap-2"
          >
            <span className="text-xl">+</span>
            Create New Request
          </button>
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
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="laborType" className="block text-sm font-medium text-gray-700 mb-1">
                    Labor Type
                  </label>
                  <select
                    id="laborType"
                    value={formData.laborType}
                    onChange={(e) => setFormData({ ...formData, laborType: e.target.value as any })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                    required
                  >
                    <option value="ELECTRICIAN">⚡ Electrician</option>
                    <option value="SKILLED">🔧 Skilled Labor</option>
                    <option value="UNSKILLED">👷 Unskilled Labor</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="workType" className="block text-sm font-medium text-gray-700 mb-1">
                    Work Type
                  </label>
                  <input
                    type="text"
                    id="workType"
                    value={formData.workType}
                    onChange={(e) => setFormData({ ...formData, workType: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                    placeholder="e.g., Wiring, Plumbing, Cleaning"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="numberOfWorkers" className="block text-sm font-medium text-gray-700 mb-1">
                    Number of Workers
                  </label>
                  <input
                    type="number"
                    id="numberOfWorkers"
                    min="1"
                    value={formData.numberOfWorkers}
                    onChange={(e) => setFormData({ ...formData, numberOfWorkers: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                    Location (Auto-detected)
                  </label>
                  <input
                    type="text"
                    id="location"
                    value={formData.location.address}
                    readOnly
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                  />
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
                        <div className="flex items-center gap-2 text-gray-600">
                          <span>⚡</span>
                          <span className="capitalize">{request.laborType.toLowerCase()}</span>
                        </div>
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
                    <button
                      onClick={() => {
                        setSelectedRequest(request)
                        setShowRatingModal(true)
                      }}
                      className="w-full mt-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white py-2 rounded-lg font-semibold hover:shadow-lg transition-all"
                    >
                      ⭐ Rate Workers
                    </button>
                  )}

                  {request.deployedWorkers && request.deployedWorkers.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-green-200">
                      <p className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-2">
                        <span>🚀</span>
                        Deployed Workers ({request.deployedWorkers.length})
                      </p>
                      <div className="space-y-2">
                        {request.deployedWorkers.map((dw: any, idx: number) => (
                          <div key={idx} className="bg-green-50 p-3 rounded-lg border-2 border-green-200">
                            <p className="font-bold text-green-900">{dw.worker?.name || dw.workerId?.name || 'Worker'}</p>
                            <p className="text-sm text-green-700">{dw.worker?.phone || dw.workerId?.phone || 'N/A'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
