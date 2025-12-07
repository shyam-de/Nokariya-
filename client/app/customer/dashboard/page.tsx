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
  createdAt: string
}

export default function CustomerDashboard() {
  const router = useRouter()
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [requests, setRequests] = useState<Request[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
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
    getLocation()
  }, [])

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
          toast.success('Location detected!')
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
      const response = await axios.get(`${API_URL}/requests/my-requests`, {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${API_URL}/requests`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      })
      toast.success('Request created! Workers have been notified.')
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

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/')
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { bg: string; text: string; icon: string } } = {
      'PENDING': { bg: 'bg-gray-100', text: 'text-gray-800', icon: '⏳' },
      'NOTIFIED': { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: '🔔' },
      'CONFIRMED': { bg: 'bg-blue-100', text: 'text-blue-800', icon: '✓' },
      'DEPLOYED': { bg: 'bg-green-100', text: 'text-green-800', icon: '🚀' },
      'COMPLETED': { bg: 'bg-purple-100', text: 'text-purple-800', icon: '✅' }
    }
    const config = statusConfig[status] || statusConfig['PENDING']
    return (
      <span className={`px-4 py-2 rounded-full text-sm font-medium ${config.bg} ${config.text} flex items-center gap-2 animate-pulse`}>
        <span>{config.icon}</span>
        {status}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <nav className="bg-white/80 backdrop-blur-md shadow-lg sticky top-0 z-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent hover:scale-105 transition-transform">
              Nokariya
            </Link>
            <div className="flex items-center gap-4">
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
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-3xl font-bold text-gray-900">My Requests</h2>
          <button
            onClick={() => setShowRequestForm(!showRequestForm)}
            className="group bg-gradient-to-r from-primary-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform flex items-center gap-2"
          >
            <span className="text-xl">{showRequestForm ? '✕' : '+'}</span>
            {showRequestForm ? 'Cancel' : 'New Request'}
          </button>
        </div>

        {showRequestForm && (
          <div className="bg-white rounded-xl shadow-xl p-6 mb-8 border-2 border-primary-200 animate-slide-up">
            <h3 className="text-2xl font-semibold mb-4 text-gray-800">Create New Request</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Labor Type
                  </label>
                  <select
                    value={formData.laborType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        laborType: e.target.value as 'ELECTRICIAN' | 'SKILLED' | 'UNSKILLED'
                      })
                    }
                                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                    required
                  >
                    <option value="ELECTRICIAN">⚡ Electrician</option>
                    <option value="SKILLED">🔧 Skilled Labor</option>
                    <option value="UNSKILLED">👷 Unskilled Labor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Workers
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.numberOfWorkers}
                    onChange={(e) => setFormData({ ...formData, numberOfWorkers: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Work Type
                </label>
                <input
                  type="text"
                  value={formData.workType}
                  onChange={(e) => setFormData({ ...formData, workType: e.target.value })}
                  placeholder="e.g., Electrical repair, Construction work, etc."
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  required
                />
              </div>

              <button
                type="button"
                onClick={getLocation}
                className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-2 hover:scale-105 transition-transform"
              >
                <span className="text-lg">📍</span>
                Use Current Location
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-primary-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isSubmitting ? 'Creating Request...' : 'Create Request'}
              </button>
            </form>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.length === 0 ? (
              <div className="bg-white rounded-xl shadow-lg p-12 text-center border-2 border-dashed border-gray-300">
                <div className="text-6xl mb-4">📋</div>
                <p className="text-xl text-gray-500 mb-2">No requests yet</p>
                <p className="text-gray-400">Create your first request to get started!</p>
              </div>
            ) : (
              requests.map((request) => (
                <div key={request.id} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 transform border-l-4 border-primary-500">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold capitalize text-gray-900">{request.laborType.toLowerCase()}</h3>
                        {getStatusBadge(request.status)}
                      </div>
                      <p className="text-gray-700 text-lg mb-2">{request.workType}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <span>👥</span>
                          {request.numberOfWorkers} worker{request.numberOfWorkers > 1 ? 's' : ''} needed
                        </span>
                        <span className="flex items-center gap-1">
                          <span>📅</span>
                          {new Date(request.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {request.confirmedWorkers && request.confirmedWorkers.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-2">
                        <span>✓</span>
                        Confirmed Workers ({request.confirmedWorkers.length})
                      </p>
                      <div className="space-y-2">
                        {request.confirmedWorkers.map((cw: any, idx: number) => (
                          <div key={idx} className="bg-blue-50 p-3 rounded-lg flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900">{cw.worker?.name || cw.workerId?.name || 'Worker'}</p>
                              <p className="text-sm text-gray-600">{cw.worker?.phone || cw.workerId?.phone || 'N/A'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {request.deployedWorkers && request.deployedWorkers.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-green-200">
                      <p className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-2">
                        <span>🚀</span>
                        Deployed Workers ({request.deployedWorkers.length})
                      </p>
                      <div className="space-y-2">
                        {request.deployedWorkers.map((dw: any, idx: number) => (
                          <div key={idx} className="bg-green-50 p-3 rounded-lg flex items-center justify-between border-2 border-green-200">
                            <div>
                              <p className="font-bold text-green-900">{dw.worker?.name || dw.workerId?.name || 'Worker'}</p>
                              <p className="text-sm text-green-700">{dw.worker?.phone || dw.workerId?.phone || 'N/A'}</p>
                            </div>
                            <span className="text-green-600 text-xl">✓</span>
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
