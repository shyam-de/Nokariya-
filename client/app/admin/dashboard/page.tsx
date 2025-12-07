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
    email: string
    phone: string
  }
  status: string
  createdAt: string
  completedAt?: string
  deployedWorkers?: any[]
  confirmedWorkers?: any[]
}

export default function AdminDashboard() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending')
  const [requests, setRequests] = useState<Request[]>([])
  const [allRequests, setAllRequests] = useState<Request[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('date')
  const [sortOrder, setSortOrder] = useState('desc')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'customer' as 'customer' | 'worker' | 'admin',
    laborTypes: [] as string[]
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
    
    if (userObj.role?.toLowerCase() !== 'admin') {
      toast.error('Access denied. Admin only.')
      router.push('/')
      return
    }

    fetchPendingRequests()
  }, [])

  useEffect(() => {
    if (activeTab === 'history') {
      fetchAllRequests()
    }
  }, [activeTab, searchQuery, sortBy, sortOrder, statusFilter])

  const fetchPendingRequests = async () => {
    setIsLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/admin/requests/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setRequests(response.data)
    } catch (error: any) {
      console.error('Error fetching requests:', error)
      toast.error(error.response?.data?.message || 'Failed to fetch requests')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchAllRequests = async () => {
    setIsLoadingHistory(true)
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      if (searchQuery) params.append('search', searchQuery)
      if (sortBy) params.append('sortBy', sortBy)
      if (sortOrder) params.append('sortOrder', sortOrder)
      
      const response = await axios.get(`${API_URL}/admin/requests/all?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      let filtered = response.data
      
      // Apply status filter
      if (statusFilter !== 'all') {
        filtered = filtered.filter((r: Request) => r.status === statusFilter)
      }
      
      setAllRequests(filtered)
    } catch (error: any) {
      console.error('Error fetching all requests:', error)
      toast.error(error.response?.data?.message || 'Failed to fetch requests')
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const handleApprove = async (requestId: string) => {
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${API_URL}/admin/requests/${requestId}/approve`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )
      toast.success('Request approved! Workers have been notified.')
      fetchPendingRequests()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to approve request')
    }
  }

  const handleReject = async (requestId: string) => {
    if (!confirm('Are you sure you want to reject this request?')) {
      return
    }
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${API_URL}/admin/requests/${requestId}/reject`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )
      toast.success('Request rejected.')
      fetchPendingRequests()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to reject request')
    }
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
    const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-800', icon: '📋' }
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text} flex items-center gap-1`}>
        <span>{config.icon}</span>
        {status.replace(/_/g, ' ')}
      </span>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreatingUser(true)
    try {
      const token = localStorage.getItem('token')
      const data = {
        ...userFormData,
        role: userFormData.role.toUpperCase(),
        laborTypes: userFormData.laborTypes.map(type => type.toUpperCase())
      }
      
      await axios.post(`${API_URL}/admin/users/create`, data, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      toast.success('User created successfully!')
      setShowCreateUser(false)
      setUserFormData({
        name: '',
        email: '',
        phone: '',
        password: '',
        role: 'customer',
        laborTypes: []
      })
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create user')
    } finally {
      setIsCreatingUser(false)
    }
  }

  const toggleLaborType = (type: string) => {
    if (userFormData.laborTypes.includes(type)) {
      setUserFormData({
        ...userFormData,
        laborTypes: userFormData.laborTypes.filter(t => t !== type)
      })
    } else {
      setUserFormData({
        ...userFormData,
        laborTypes: [...userFormData.laborTypes, type]
      })
    }
  }

  const displayedRequests = activeTab === 'pending' ? requests : allRequests
  const isCurrentlyLoading = activeTab === 'pending' ? isLoading : isLoadingHistory

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-red-50 to-orange-50">
      <nav className="bg-white/90 backdrop-blur-md shadow-lg sticky top-0 z-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent hover:scale-105 transition-transform">
              Nokariya (Admin)
            </Link>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-red-50 px-4 py-2 rounded-full">
                <span className="text-sm text-red-700">👑</span>
                <span className="text-red-700 font-medium">{user?.name}</span>
              </div>
              <button
                onClick={() => {
                  localStorage.removeItem('token')
                  localStorage.removeItem('user')
                  router.push('/')
                }}
                className="px-4 py-2 text-sm text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-l-4 border-red-500">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
              <p className="text-gray-600">Manage requests, users, and monitor platform activity</p>
            </div>
            <button
              onClick={() => setShowCreateUser(!showCreateUser)}
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 transform flex items-center gap-2"
            >
              <span className="text-xl">{showCreateUser ? '✕' : '+'}</span>
              {showCreateUser ? 'Cancel' : 'Create User'}
            </button>
          </div>
        </div>

        {/* Create User Form */}
        {showCreateUser && (
          <div className="bg-white rounded-xl shadow-lg p-8 mb-6 border-2 border-green-200 animate-slide-down">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New User</h2>
            <form onSubmit={handleCreateUser} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  <input
                    type="text"
                    required
                    value={userFormData.name}
                    onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    placeholder="Enter full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    required
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    placeholder="Enter email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    required
                    value={userFormData.phone}
                    onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    placeholder="Enter phone number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={userFormData.password}
                    onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    placeholder="Enter password (min 6 characters)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                  <select
                    required
                    value={userFormData.role}
                    onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value as any, laborTypes: [] })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  >
                    <option value="customer">Customer</option>
                    <option value="worker">Worker</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              {userFormData.role === 'worker' && (
                <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Labor Types (Select all that apply)</label>
                  <div className="flex gap-4 flex-wrap">
                    {['ELECTRICIAN', 'SKILLED', 'UNSKILLED'].map((type) => (
                      <label key={type} className="flex items-center cursor-pointer px-4 py-2 bg-white rounded-full shadow-sm hover:shadow-md transition-all">
                        <input
                          type="checkbox"
                          checked={userFormData.laborTypes.includes(type.toLowerCase())}
                          onChange={() => toggleLaborType(type.toLowerCase())}
                          className="mr-2 w-4 h-4 text-green-600 focus:ring-green-500"
                        />
                        <span className="capitalize">{type.toLowerCase()}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:shadow-xl transition-all duration-200 hover:scale-105 transform font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingUser ? 'Creating...' : 'Create User'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateUser(false)
                    setUserFormData({
                      name: '',
                      email: '',
                      phone: '',
                      password: '',
                      role: 'customer',
                      laborTypes: []
                    })
                  }}
                  className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-lg p-2 mb-6 flex gap-2">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
              activeTab === 'pending'
                ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📋 Pending Requests ({requests.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
              activeTab === 'history'
                ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📜 All History ({allRequests.length})
          </button>
        </div>

        {/* Search and Filter Bar (for History tab) */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">🔍 Search</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by work type, customer, location, status..."
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="date">Date</option>
                  <option value="status">Status</option>
                  <option value="worktype">Work Type</option>
                  <option value="customername">Customer Name</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Order</label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="desc">Newest First</option>
                  <option value="asc">Oldest First</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    statusFilter === 'all'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                {['PENDING_ADMIN_APPROVAL', 'NOTIFIED', 'CONFIRMED', 'DEPLOYED', 'COMPLETED', 'REJECTED'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      statusFilter === status
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {status.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Requests List */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {activeTab === 'pending' ? 'Pending Approval Requests' : 'All Requests History'}
          </h2>
          
          {isCurrentlyLoading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
            </div>
          ) : displayedRequests.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-xl text-gray-500 mb-2">
                {activeTab === 'pending' ? 'No pending requests' : 'No requests found'}
              </p>
              <p className="text-gray-400">
                {activeTab === 'pending' ? 'All clear!' : 'Try adjusting your search or filters'}
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedRequests.map((request) => (
                <div
                  key={request.id}
                  className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 transform border-t-4 border-red-500"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{request.workType}</h3>
                      {getStatusBadge(request.status)}
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      <span>⚡</span>
                      <span className="capitalize">{request.laborType.toLowerCase()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <span>👥</span>
                      <span>{request.numberOfWorkers} worker{request.numberOfWorkers > 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <span>📍</span>
                      <span className="truncate">{request.location?.address || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <span>👤</span>
                      <span>{request.customer?.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <span>📧</span>
                      <span className="truncate">{request.customer?.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <span>📞</span>
                      <span>{request.customer?.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <span>🕒</span>
                      <span>{formatDate(request.createdAt)}</span>
                    </div>
                    {request.completedAt && (
                      <div className="flex items-center gap-2 text-purple-600">
                        <span>✅</span>
                        <span>Completed: {formatDate(request.completedAt)}</span>
                      </div>
                    )}
                  </div>

                  {request.deployedWorkers && request.deployedWorkers.length > 0 && (
                    <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm font-semibold text-green-700 mb-2">
                        🚀 Deployed Workers ({request.deployedWorkers.length})
                      </p>
                      <div className="space-y-1">
                        {request.deployedWorkers.map((dw: any, idx: number) => (
                          <p key={idx} className="text-xs text-green-600">
                            • {dw.worker?.name || 'Worker'}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === 'pending' && (
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={() => handleApprove(request.id)}
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:shadow-lg transition-all font-semibold"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => handleReject(request.id)}
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg hover:shadow-lg transition-all font-semibold"
                      >
                        ✗ Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
