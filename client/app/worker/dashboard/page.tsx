'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import axios from 'axios'
import toast from 'react-hot-toast'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8585/api'
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8585'

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
    name: string
    phone: string
  }
  status: string
  distance?: string
}

export default function WorkerDashboard() {
  const router = useRouter()
  const [requests, setRequests] = useState<Request[]>([])
  const [notifications, setNotifications] = useState<Request[]>([])
  const [available, setAvailable] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isToggling, setIsToggling] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [location, setLocation] = useState<{latitude: number, longitude: number} | null>(null)

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
  }, [])

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-green-50">
      <nav className="bg-white/80 backdrop-blur-md shadow-lg sticky top-0 z-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent hover:scale-105 transition-transform">
              Nokariya
            </Link>
            <div className="flex items-center gap-4">
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
          <h2 className="text-3xl font-bold text-gray-900">Available Requests</h2>
          <button
            onClick={fetchAvailableRequests}
            disabled={isLoading}
            className="px-4 py-2 bg-white border-2 border-primary-300 text-primary-600 rounded-lg font-medium hover:bg-primary-50 transition-all duration-200 hover:scale-105 transform disabled:opacity-50"
          >
            {isLoading ? 'Refreshing...' : '🔄 Refresh'}
          </button>
        </div>

        {!available && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-xl p-4 mb-6 animate-pulse">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <p className="text-yellow-800 font-medium">
                You are currently unavailable. Toggle availability to receive new requests.
              </p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
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
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      request.status === 'NOTIFIED' ? 'bg-yellow-100 text-yellow-800 animate-pulse' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {request.status}
                    </span>
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
      </div>
    </div>
  )
}
