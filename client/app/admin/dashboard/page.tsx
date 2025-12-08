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
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'history' | 'concerns' | 'workers' | 'customers' | 'systemUsers'>('pending')
  const [requests, setRequests] = useState<Request[]>([])
  const [activeRequests, setActiveRequests] = useState<Request[]>([])
  const [allRequests, setAllRequests] = useState<Request[]>([])
  const [concerns, setConcerns] = useState<any[]>([])
  const [workers, setWorkers] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [systemUsers, setSystemUsers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingActive, setIsLoadingActive] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [isLoadingConcerns, setIsLoadingConcerns] = useState(false)
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(false)
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)
  const [isLoadingSystemUsers, setIsLoadingSystemUsers] = useState(false)
  const [selectedConcern, setSelectedConcern] = useState<any | null>(null)
  const [adminResponse, setAdminResponse] = useState('')
  const [isUpdatingConcern, setIsUpdatingConcern] = useState(false)
  const [concernMessages, setConcernMessages] = useState<{[key: string]: any[]}>({})
  const [isLoadingMessages, setIsLoadingMessages] = useState<{[key: string]: boolean}>({})
  const [newMessage, setNewMessage] = useState('')
  const [user, setUser] = useState<any>(null)
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('date')
  const [sortOrder, setSortOrder] = useState('desc')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [confirmationStatus, setConfirmationStatus] = useState<{[key: string]: any}>({})
  const [isLoadingConfirmation, setIsLoadingConfirmation] = useState<{[key: string]: boolean}>({})
  const [isDeploying, setIsDeploying] = useState<{[key: string]: boolean}>({})
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    phone: '',
    secondaryPhone: '',
    password: '',
    role: 'customer' as 'customer' | 'worker' | 'admin',
    laborType: '' as string, // Single labor type for worker
    isSuperAdmin: false
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

    // Debug: Log user object to check superAdmin field
    console.log('Admin user object:', userObj)
    console.log('SuperAdmin flag:', userObj.superAdmin)

    fetchPendingRequests()
  }, [])

  useEffect(() => {
    if (activeTab === 'history') {
      fetchAllRequests()
    } else if (activeTab === 'active') {
      fetchActiveRequests()
    } else if (activeTab === 'concerns') {
      fetchConcerns()
    } else if (activeTab === 'workers') {
      fetchWorkers()
    } else if (activeTab === 'customers') {
      fetchCustomers()
    } else if (activeTab === 'systemUsers') {
      fetchSystemUsers()
    } else if (activeTab === 'pending') {
      fetchPendingRequests()
    }
  }, [activeTab, searchQuery, sortBy, sortOrder, statusFilter])

  // Auto-refresh confirmation status for NOTIFIED/CONFIRMED requests
  useEffect(() => {
    if (activeTab === 'pending' || activeTab === 'active' || activeTab === 'history') {
      const interval = setInterval(() => {
        // Refresh confirmation status for all NOTIFIED/CONFIRMED requests
        const requestsToCheck = activeTab === 'pending' ? requests : activeTab === 'active' ? activeRequests : allRequests
        requestsToCheck.forEach((request: Request) => {
          if (request.status === 'NOTIFIED' || request.status === 'CONFIRMED') {
            fetchConfirmationStatus(request.id)
          }
        })
      }, 10000) // Refresh every 10 seconds

      return () => clearInterval(interval)
    }
  }, [activeTab, requests, activeRequests, allRequests])

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

  const fetchActiveRequests = async () => {
    setIsLoadingActive(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/admin/requests/active`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setActiveRequests(response.data)
      
      // Auto-fetch confirmation status for all active requests
      response.data.forEach((request: Request) => {
        if (request.status === 'NOTIFIED' || request.status === 'CONFIRMED') {
          fetchConfirmationStatus(request.id)
        }
      })
    } catch (error: any) {
      console.error('Error fetching active requests:', error)
      toast.error(error.response?.data?.message || 'Failed to fetch active requests')
    } finally {
      setIsLoadingActive(false)
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

  const fetchConfirmationStatus = async (requestId: string) => {
    setIsLoadingConfirmation({ ...isLoadingConfirmation, [requestId]: true })
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/admin/requests/${requestId}/confirmation-status`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setConfirmationStatus({ ...confirmationStatus, [requestId]: response.data })
    } catch (error: any) {
      console.error('Error fetching confirmation status:', error)
      toast.error(error.response?.data?.message || 'Failed to fetch confirmation status')
    } finally {
      setIsLoadingConfirmation({ ...isLoadingConfirmation, [requestId]: false })
    }
  }

  const handleDeploy = async (requestId: string) => {
    if (!confirm('Are you sure you want to deploy workers to this customer?')) {
      return
    }
    setIsDeploying({ ...isDeploying, [requestId]: true })
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${API_URL}/admin/requests/${requestId}/deploy`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )
      toast.success('Workers deployed successfully!')
      fetchPendingRequests()
      fetchAllRequests()
      // Refresh confirmation status
      delete confirmationStatus[requestId]
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to deploy workers')
    } finally {
      setIsDeploying({ ...isDeploying, [requestId]: false })
    }
  }

  const fetchConcerns = async () => {
    setIsLoadingConcerns(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/admin/concerns`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      // Filter out RESOLVED concerns - admin only sees active concerns
      const activeConcerns = response.data.filter((concern: any) => concern.status !== 'RESOLVED')
      setConcerns(activeConcerns)
      
      // Fetch messages for all concerns
      activeConcerns.forEach((concern: any) => {
        fetchConcernMessages(concern.id)
      })
      
      // If a concern modal is open, update the selected concern with latest data
      if (selectedConcern) {
        const updatedSelected = activeConcerns.find((c: any) => c.id === selectedConcern.id)
        if (updatedSelected) {
          setSelectedConcern(updatedSelected)
          fetchConcernMessages(updatedSelected.id)
        }
      }
    } catch (error: any) {
      console.error('Error fetching concerns:', error)
      toast.error(error.response?.data?.message || 'Failed to fetch concerns')
    } finally {
      setIsLoadingConcerns(false)
    }
  }

  const fetchWorkers = async () => {
    setIsLoadingWorkers(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/admin/workers`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setWorkers(response.data)
    } catch (error: any) {
      console.error('Error fetching workers:', error)
      toast.error(error.response?.data?.message || 'Failed to fetch workers')
    } finally {
      setIsLoadingWorkers(false)
    }
  }

  const fetchCustomers = async () => {
    setIsLoadingCustomers(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/admin/customers`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setCustomers(response.data)
    } catch (error: any) {
      console.error('Error fetching customers:', error)
      toast.error(error.response?.data?.message || 'Failed to fetch customers')
    } finally {
      setIsLoadingCustomers(false)
    }
  }

  const fetchSystemUsers = async () => {
    setIsLoadingSystemUsers(true)
    try {
      const token = localStorage.getItem('token')
      console.log('Fetching system users with token:', token ? 'present' : 'missing')
      const response = await axios.get(`${API_URL}/admin/system-users`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      console.log('System users response:', response.data)
      setSystemUsers(response.data)
    } catch (error: any) {
      console.error('Error fetching system users:', error)
      console.error('Error response:', error.response)
      console.error('Error response data:', error.response?.data)
      toast.error(error.response?.data?.message || 'Failed to fetch system users')
    } finally {
      setIsLoadingSystemUsers(false)
    }
  }

  const handleToggleVerification = async (workerId: string) => {
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${API_URL}/admin/workers/${workerId}/toggle-verification`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      toast.success('Worker verification status updated')
      fetchWorkers()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update verification status')
    }
  }

  const handleToggleBlock = async (userId: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.post(`${API_URL}/admin/users/${userId}/toggle-block`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      toast.success(response.data.blocked ? 'User blocked successfully' : 'User unblocked successfully')
      if (activeTab === 'workers') {
        fetchWorkers()
      } else if (activeTab === 'customers') {
        fetchCustomers()
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update block status')
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

  const handleUpdateConcernStatus = async (concernId: string, status: string) => {
    setIsUpdatingConcern(true)
    try {
      const token = localStorage.getItem('token')
      const payload: any = {
        status: status
      }
      // Only include adminResponse if it's not empty - this will be added as a message
      if (adminResponse && adminResponse.trim()) {
        payload.adminResponse = adminResponse.trim()
      }
      
      await axios.post(`${API_URL}/admin/concerns/${concernId}/update-status`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      })
      toast.success('Concern status updated successfully!')
      setSelectedConcern(null)
      setAdminResponse('')
      setNewMessage('')
      fetchConcerns()
      // Refresh messages for this concern
      fetchConcernMessages(concernId)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update concern status')
    } finally {
      setIsUpdatingConcern(false)
    }
  }

  const handleAddMessage = async (concernId: string) => {
    if (!newMessage || !newMessage.trim()) {
      toast.error('Please enter a message')
      return
    }
    setIsUpdatingConcern(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${API_URL}/admin/concerns/${concernId}/message`, {
        message: newMessage.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      toast.success('Message added successfully!')
      setNewMessage('')
      fetchConcernMessages(concernId)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add message')
    } finally {
      setIsUpdatingConcern(false)
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
      
      // Validate worker has a labor type selected
      if (userFormData.role === 'worker' && !userFormData.laborType) {
        toast.error('Please select a labor type for the worker')
        setIsCreatingUser(false)
        return
      }
      
      const data = {
        ...userFormData,
        role: userFormData.role.toUpperCase(),
        laborTypes: userFormData.role === 'worker' && userFormData.laborType 
          ? [userFormData.laborType.toUpperCase()] 
          : []
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
        secondaryPhone: '',
        password: '',
        role: 'customer',
        laborType: '',
        isSuperAdmin: false
      })
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create user')
    } finally {
      setIsCreatingUser(false)
    }
  }

  const displayedRequests = activeTab === 'pending' ? requests : activeTab === 'active' ? activeRequests : allRequests
  const isCurrentlyLoading = activeTab === 'pending' ? isLoading : activeTab === 'active' ? isLoadingActive : activeTab === 'history' ? isLoadingHistory : isLoadingConcerns

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
                    onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value as any, laborType: '', isSuperAdmin: false })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  >
                    <option value="customer">Customer</option>
                    <option value="worker">Worker</option>
                    {(user?.superAdmin === true || user?.superAdmin === 'true') && <option value="admin">Admin</option>}
                  </select>
                  {!(user?.superAdmin === true || user?.superAdmin === 'true') && (
                    <p className="text-xs text-gray-500 mt-1">
                      Only super admin can create admin users. 
                      {user?.email === 'admin@nokariya.com' && ' Please log out and log back in to refresh your permissions.'}
                    </p>
                  )}
                </div>
              </div>

              {userFormData.role === 'worker' && (
                <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Labor Type (Select one)</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'electrician', label: '⚡ Electrician' },
                      { value: 'driver', label: '🚗 Driver' },
                      { value: 'rigger', label: '🔩 Rigger' },
                      { value: 'fitter', label: '🔧 Fitter' },
                      { value: 'cook', label: '👨‍🍳 Cook' },
                      { value: 'plumber', label: '🔧 Plumber' },
                      { value: 'carpenter', label: '🪚 Carpenter' },
                      { value: 'painter', label: '🎨 Painter' },
                      { value: 'labour', label: '👷 Labour' },
                      { value: 'raj_mistri', label: '👷‍♂️ Raj Mistri' }
                    ].map((type) => (
                      <label key={type.value} className="flex items-center cursor-pointer px-3 py-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-all border border-gray-200 hover:border-green-300">
                        <input
                          type="radio"
                          name="laborType"
                          value={type.value}
                          checked={userFormData.laborType === type.value}
                          onChange={(e) => setUserFormData({ ...userFormData, laborType: e.target.value })}
                          className="mr-2 w-4 h-4 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-sm">{type.label}</span>
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
                      secondaryPhone: '',
                      password: '',
                      role: 'customer',
                      laborType: '',
                      isSuperAdmin: false
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
            onClick={() => setActiveTab('active')}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
              activeTab === 'active'
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            🚀 Active Requests ({activeRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
              activeTab === 'history'
                ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📜 All Request ({allRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('concerns')}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
              activeTab === 'concerns'
                ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📢 Concerns ({concerns.filter((c: any) => c.status === 'PENDING').length})
          </button>
          <button
            onClick={() => setActiveTab('workers')}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
              activeTab === 'workers'
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            👷 Workers ({workers.length})
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
              activeTab === 'customers'
                ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            👥 Customers ({customers.length})
          </button>
          {(user?.superAdmin === true || user?.superAdmin === 'true') && (
            <button
              onClick={() => setActiveTab('systemUsers')}
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                activeTab === 'systemUsers'
                  ? 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              👨‍💼 System Users ({systemUsers.length})
            </button>
          )}
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

        {/* Requests List or Concerns List */}
        {activeTab === 'concerns' ? (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">All Concerns</h2>
              <button
                onClick={fetchConcerns}
                disabled={isLoadingConcerns}
                className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform disabled:opacity-50 flex items-center gap-2"
              >
                {isLoadingConcerns ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Refreshing...</span>
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    <span>Refresh</span>
                  </>
                )}
              </button>
            </div>
            {isCurrentlyLoading ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
              </div>
            ) : concerns.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📢</div>
                <p className="text-xl text-gray-500 mb-2">No concerns raised yet</p>
                <p className="text-gray-400">All clear, admin!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {concerns.map((concern: any) => (
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
                          <p>
                            <span className="font-semibold">Raised by:</span> {concern.raisedBy?.name || 'Unknown'} ({concern.raisedBy?.email || 'N/A'}) 
                            <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                              concern.raisedBy?.role === 'CUSTOMER' ? 'bg-blue-100 text-blue-800' :
                              concern.raisedBy?.role === 'WORKER' ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {concern.raisedBy?.role === 'CUSTOMER' ? 'Customer' : 
                               concern.raisedBy?.role === 'WORKER' ? 'Worker' : 
                               'Unknown'}
                            </span>
                          </p>
                          {concern.request && (
                            <p><span className="font-semibold">Related Request:</span> {concern.request.workType} (ID: {concern.request.id})</p>
                          )}
                          {concern.relatedTo && (
                            <p><span className="font-semibold">Related to:</span> {concern.relatedTo.name} ({concern.relatedTo.email})</p>
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
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
                            </div>
                          ) : concernMessages[concern.id] && concernMessages[concern.id].length > 0 ? (
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                              {concernMessages[concern.id].map((msg: any) => {
                                const isAdmin = msg.sentBy?.role === 'ADMIN'
                                const isRaisedBy = msg.sentBy?.id === concern.raisedBy?.id
                                return (
                                  <div
                                    key={msg.id}
                                    className={`p-3 rounded-lg ${
                                      isAdmin
                                        ? 'bg-blue-50 border-l-4 border-blue-500'
                                        : isRaisedBy
                                        ? 'bg-green-50 border-l-4 border-green-500'
                                        : 'bg-gray-50 border-l-4 border-gray-400'
                                    }`}
                                  >
                                    <div className="flex justify-between items-start mb-1">
                                      <p className={`font-semibold text-sm ${
                                        isAdmin ? 'text-blue-900' : isRaisedBy ? 'text-green-900' : 'text-gray-900'
                                      }`}>
                                        {msg.sentBy?.name || 'Unknown'}
                                        {isAdmin && <span className="ml-2 text-xs">(Admin)</span>}
                                        {!isAdmin && isRaisedBy && (
                                          <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                                            concern.raisedBy?.role === 'CUSTOMER' ? 'bg-blue-100 text-blue-800' :
                                            concern.raisedBy?.role === 'WORKER' ? 'bg-green-100 text-green-800' :
                                            'bg-gray-100 text-gray-800'
                                          }`}>
                                            {concern.raisedBy?.role === 'CUSTOMER' ? 'Customer' : 
                                             concern.raisedBy?.role === 'WORKER' ? 'Worker' : ''}
                                          </span>
                                        )}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {new Date(msg.createdAt).toLocaleString()}
                                      </p>
                                    </div>
                                    <p className={`text-sm ${
                                      isAdmin ? 'text-blue-700' : isRaisedBy ? 'text-green-700' : 'text-gray-700'
                                    }`}>
                                      {msg.message}
                                    </p>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <p className="text-gray-500 text-sm italic">No messages yet.</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={async () => {
                          // Refresh concerns to get latest user messages before opening modal
                          try {
                            const token = localStorage.getItem('token')
                            const response = await axios.get(`${API_URL}/admin/concerns`, {
                              headers: { Authorization: `Bearer ${token}` }
                            })
                            // Find the updated concern from the fresh response
                            const updatedConcern = response.data.find((c: any) => c.id === concern.id) || concern
                            setSelectedConcern(updatedConcern)
                            setAdminResponse(updatedConcern.adminResponse || '')
                            // Also update the concerns list
                            const activeConcerns = response.data.filter((c: any) => c.status !== 'RESOLVED')
                            setConcerns(activeConcerns)
                          } catch (error: any) {
                            console.error('Error refreshing concern:', error)
                            // Fallback to current concern if refresh fails
                            setSelectedConcern(concern)
                            setAdminResponse(concern.adminResponse || '')
                          }
                        }}
                        className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                      >
                        {concern.status === 'PENDING' ? 'Review & Respond' : 'Update Status'}
                      </button>
                      {concern.status === 'PENDING' && (
                        <button
                          onClick={() => handleUpdateConcernStatus(concern.id, 'DISMISSED')}
                          className="flex-1 bg-gray-500 text-white py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'workers' ? (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">All Workers</h2>
              <button
                onClick={fetchWorkers}
                disabled={isLoadingWorkers}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform disabled:opacity-50 flex items-center gap-2"
              >
                {isLoadingWorkers ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    <span>Refresh</span>
                  </>
                )}
              </button>
            </div>
            
            {isLoadingWorkers ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : workers.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">👷</div>
                <p className="text-xl text-gray-500 mb-2">No workers found</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {workers.map((worker: any) => (
                  <div
                    key={worker.id}
                    className={`bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 transform border-t-4 ${
                      worker.blocked ? 'border-red-500' : worker.verified ? 'border-green-500' : 'border-yellow-500'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{worker.name}</h3>
                        <p className="text-sm text-gray-600 mb-1">📧 {worker.email}</p>
                        <p className="text-sm text-gray-600 mb-1">📞 {worker.phone}</p>
                        {worker.secondaryPhone && (
                          <p className="text-sm text-gray-600 mb-1">📱 {worker.secondaryPhone}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">Labor Types:</span>
                        <div className="flex flex-wrap gap-1">
                          {worker.laborTypes?.map((type: string) => (
                            <span key={type} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                              {type}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">Rating:</span>
                        <span className="text-sm text-gray-600">⭐ {worker.rating || 0.0}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">Total Jobs:</span>
                        <span className="text-sm text-gray-600">{worker.totalJobs || 0}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">Available:</span>
                        <span className={`text-sm ${worker.available ? 'text-green-600' : 'text-red-600'}`}>
                          {worker.available ? '✓ Yes' : '✗ No'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mb-4">
                        <button
                          onClick={() => handleToggleVerification(worker.id)}
                          className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
                            worker.verified
                              ? 'bg-green-500 text-white hover:bg-green-600'
                              : 'bg-yellow-500 text-white hover:bg-yellow-600'
                          }`}
                        >
                          {worker.verified ? '✓ Verified' : '⚠ Not Verified'}
                        </button>
                        <button
                          onClick={() => handleToggleBlock(worker.userId)}
                        className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
                          worker.blocked
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-red-500 text-white hover:bg-red-600'
                        }`}
                      >
                        {worker.blocked ? '🔓 Unblock' : '🚫 Block'}
                      </button>
                    </div>
                    
                    {worker.currentLocation && (
                      <p className="text-xs text-gray-500 mt-2">
                        📍 {worker.currentLocation.address || 'Location not set'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'customers' ? (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">All Customers</h2>
              <button
                onClick={fetchCustomers}
                disabled={isLoadingCustomers}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform disabled:opacity-50 flex items-center gap-2"
              >
                {isLoadingCustomers ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    <span>Refresh</span>
                  </>
                )}
              </button>
            </div>
            
            {isLoadingCustomers ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
              </div>
            ) : customers.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">👥</div>
                <p className="text-xl text-gray-500 mb-2">No customers found</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {customers.map((customer: any) => (
                  <div
                    key={customer.id}
                    className={`bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 transform border-t-4 ${
                      customer.blocked ? 'border-red-500' : 'border-purple-500'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{customer.name}</h3>
                        <p className="text-sm text-gray-600 mb-1">📧 {customer.email}</p>
                        <p className="text-sm text-gray-600 mb-1">📞 {customer.phone}</p>
                        {customer.secondaryPhone && (
                          <p className="text-sm text-gray-600 mb-1">📱 {customer.secondaryPhone}</p>
                        )}
                      </div>
                    </div>
                    
                    {customer.location && (
                      <p className="text-xs text-gray-500 mb-4">
                        📍 {customer.location.address || 'Location not set'}
                      </p>
                    )}
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleBlock(customer.id)}
                        className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
                          customer.blocked
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-red-500 text-white hover:bg-red-600'
                        }`}
                      >
                        {customer.blocked ? '🔓 Unblock' : '🚫 Block'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'systemUsers' ? (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">System Users (Admins)</h2>
              <button
                onClick={fetchSystemUsers}
                disabled={isLoadingSystemUsers}
                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-lg font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform disabled:opacity-50 flex items-center gap-2"
              >
                {isLoadingSystemUsers ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    <span>Refresh</span>
                  </>
                )}
              </button>
            </div>
            
            {isLoadingSystemUsers ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
            ) : systemUsers.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">👨‍💼</div>
                <p className="text-xl text-gray-500 mb-2">No system users found</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {systemUsers.map((systemUser: any) => (
                  <div
                    key={systemUser.id}
                    className={`bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 transform border-t-4 ${
                      systemUser.blocked ? 'border-red-500' : systemUser.superAdmin ? 'border-purple-500' : 'border-blue-500'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{systemUser.name}</h3>
                        <p className="text-sm text-gray-600 mb-1">📧 {systemUser.email}</p>
                        <p className="text-sm text-gray-600 mb-1">📞 {systemUser.phone}</p>
                        {systemUser.secondaryPhone && (
                          <p className="text-sm text-gray-600 mb-1">📱 {systemUser.secondaryPhone}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">Type:</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          systemUser.superAdmin 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {systemUser.superAdmin ? '⭐ Super Admin' : '👨‍💼 Admin'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">Status:</span>
                        <span className={`text-sm ${systemUser.blocked ? 'text-red-600' : 'text-green-600'}`}>
                          {systemUser.blocked ? '🚫 Blocked' : '✓ Active'}
                        </span>
                      </div>
                    </div>
                    
                    {systemUser.location && (
                      <p className="text-xs text-gray-500 mb-4">
                        📍 {systemUser.location.address || 'Location not set'}
                      </p>
                    )}
                    
                    <p className="text-xs text-gray-400 mt-2">
                      Created: {new Date(systemUser.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (activeTab === 'pending' || activeTab === 'active' || activeTab === 'history') ? (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {activeTab === 'pending' ? 'Pending Approval Requests' : activeTab === 'active' ? 'Active Requests (Need Deployment)' : 'All Request'}
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
                      <div className="flex items-center gap-2 text-gray-600 flex-wrap">
                        <span>⚡</span>
                        <div className="flex flex-wrap gap-1">
                          {request.laborTypes && request.laborTypes.length > 0 ? (
                            request.laborTypes.map((type: string, idx: number) => (
                              <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs capitalize">
                                {type.toLowerCase()}
                              </span>
                            ))
                          ) : (
                            <span className="capitalize text-gray-500">N/A</span>
                          )}
                        </div>
                      </div>
                      {request.startDate && request.endDate && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <span>📅</span>
                          <span>{new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}</span>
                          <span className="text-xs">
                            ({Math.ceil((new Date(request.endDate).getTime() - new Date(request.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} days)
                          </span>
                        </div>
                      )}
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

                    {/* Confirmation Status for NOTIFIED/CONFIRMED requests */}
                    {(request.status === 'NOTIFIED' || request.status === 'CONFIRMED') && (
                      <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex justify-between items-center mb-3">
                          <p className="text-sm font-semibold text-blue-700">
                            📊 Confirmation Status
                          </p>
                          <button
                            onClick={() => fetchConfirmationStatus(request.id)}
                            disabled={isLoadingConfirmation[request.id]}
                            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                          >
                            {isLoadingConfirmation[request.id] ? 'Loading...' : '🔄 Refresh'}
                          </button>
                        </div>
                        {isLoadingConfirmation[request.id] ? (
                          <div className="flex justify-center py-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          </div>
                        ) : confirmationStatus[request.id] ? (
                          <div className="space-y-3">
                            {/* Overall Summary */}
                            <div className="bg-white rounded-lg p-3 border-2 border-blue-300">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-bold text-gray-800">Overall Status</span>
                                <span className={`text-sm font-bold ${
                                  confirmationStatus[request.id].allRequirementsMet ? 'text-green-600' : 'text-orange-600'
                                }`}>
                                  {confirmationStatus[request.id].totalConfirmed} / {confirmationStatus[request.id].totalRequired}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-green-50 rounded p-2 border border-green-200">
                                  <div className="text-green-700 font-semibold">✓ Confirmed</div>
                                  <div className="text-green-600 text-lg font-bold">{confirmationStatus[request.id].totalConfirmed}</div>
                                </div>
                                <div className="bg-orange-50 rounded p-2 border border-orange-200">
                                  <div className="text-orange-700 font-semibold">⏳ Pending</div>
                                  <div className="text-orange-600 text-lg font-bold">{confirmationStatus[request.id].totalPending || 0}</div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Per Labor Type Status */}
                            {confirmationStatus[request.id].laborTypeStatus && (
                              <div className="space-y-2">
                                <div className="text-xs font-semibold text-gray-700 mb-1">Per Labor Type:</div>
                                {confirmationStatus[request.id].laborTypeStatus.map((ltStatus: any, idx: number) => (
                                  <div key={idx} className="bg-white rounded p-2 border border-blue-200">
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="text-xs font-semibold text-gray-700 capitalize">
                                        {ltStatus.laborType.toLowerCase().replace('_', ' ')}
                                      </span>
                                      <div className="flex gap-2">
                                        <span className={`text-xs font-semibold ${
                                          ltStatus.canDeploy ? 'text-green-600' : 'text-orange-600'
                                        }`}>
                                          ✓ {ltStatus.confirmed} / {ltStatus.required}
                                        </span>
                                        {ltStatus.pending > 0 && (
                                          <span className="text-xs font-semibold text-orange-600">
                                            ⏳ {ltStatus.pending} pending
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {ltStatus.confirmedWorkers && ltStatus.confirmedWorkers.length > 0 && (
                                      <div className="mt-1 space-y-1">
                                        {ltStatus.confirmedWorkers.slice(0, 3).map((worker: any, wIdx: number) => (
                                          <p key={wIdx} className="text-xs text-gray-600">
                                            • {worker.name} ({worker.phone})
                                          </p>
                                        ))}
                                        {ltStatus.confirmedWorkers.length > 3 && (
                                          <p className="text-xs text-gray-500">
                                            +{ltStatus.confirmedWorkers.length - 3} more
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            {confirmationStatus[request.id].canDeploy && (
                              <div className="mt-3 space-y-2">
                                <div className={`border-2 rounded-lg p-3 text-center ${
                                  confirmationStatus[request.id].allRequirementsMet 
                                    ? 'bg-green-50 border-green-400' 
                                    : 'bg-yellow-50 border-yellow-400'
                                }`}>
                                  <p className={`text-sm font-bold mb-2 ${
                                    confirmationStatus[request.id].allRequirementsMet 
                                      ? 'text-green-700' 
                                      : 'text-yellow-700'
                                  }`}>
                                    {confirmationStatus[request.id].allRequirementsMet 
                                      ? '✅ All Required Workers Confirmed!' 
                                      : '⚠️ Few workers are available to deploy. Check with customer to deploy'}
                                  </p>
                                  <button
                                    onClick={() => handleDeploy(request.id)}
                                    disabled={isDeploying[request.id]}
                                    className="w-full mt-3 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:shadow-lg transition-all font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
                                  >
                                    {isDeploying[request.id] ? 'Deploying...' : '🚀 Deploy Workers to Customer'}
                                  </button>
                                  {!confirmationStatus[request.id].allRequirementsMet && (
                                    <p className="text-xs text-yellow-600 mt-2">
                                      ⏳ {confirmationStatus[request.id].totalConfirmed} confirmed, {confirmationStatus[request.id].totalPending || 0} more worker(s) still pending
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                            {!confirmationStatus[request.id].canDeploy && (
                              <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg p-2 text-center">
                                <p className="text-xs text-orange-700">
                                  ⏳ Waiting for workers to confirm
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => fetchConfirmationStatus(request.id)}
                            className="w-full text-xs px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            Click to view confirmation status
                          </button>
                        )}
                      </div>
                    )}

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

                    {activeTab === 'pending' && request.status === 'PENDING_ADMIN_APPROVAL' && (
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
        ) : null}
      </div>

      {/* Concern Review Modal */}
      {selectedConcern && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Review Concern #{selectedConcern.id}</h3>
            <button
              onClick={() => {
                setSelectedConcern(null)
                setAdminResponse('')
              }}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl"
            >
              &times;
            </button>
            <div className="space-y-4 mb-6">
              <div>
                <p className="font-semibold text-gray-900 mb-1">Type:</p>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  selectedConcern.type === 'WORK_QUALITY' ? 'bg-blue-100 text-blue-800' :
                  selectedConcern.type === 'PAYMENT_ISSUE' ? 'bg-yellow-100 text-yellow-800' :
                  selectedConcern.type === 'BEHAVIOR' ? 'bg-red-100 text-red-800' :
                  selectedConcern.type === 'SAFETY' ? 'bg-orange-100 text-orange-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {selectedConcern.type.replace(/_/g, ' ')}
                </span>
              </div>
              <div>
                <p className="font-semibold text-gray-900 mb-1">Raised by:</p>
                <div className="flex items-center gap-2">
                  <p className="text-gray-700">{selectedConcern.raisedBy?.name} ({selectedConcern.raisedBy?.email})</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    selectedConcern.raisedBy?.role === 'CUSTOMER' ? 'bg-blue-100 text-blue-800' :
                    selectedConcern.raisedBy?.role === 'WORKER' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedConcern.raisedBy?.role === 'CUSTOMER' ? 'Customer' : 
                     selectedConcern.raisedBy?.role === 'WORKER' ? 'Worker' : 
                     'Unknown'}
                  </span>
                </div>
              </div>
              <div>
                <p className="font-semibold text-gray-900 mb-1">Description:</p>
                <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{selectedConcern.description}</p>
              </div>
              
              {/* Conversation Thread */}
              <div className="mb-4">
                <p className="font-semibold text-gray-900 mb-3">Conversation:</p>
                {isLoadingMessages[selectedConcern.id] ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
                  </div>
                ) : concernMessages[selectedConcern.id] && concernMessages[selectedConcern.id].length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
                    {concernMessages[selectedConcern.id].map((msg: any) => {
                      const isAdmin = msg.sentBy?.role === 'ADMIN'
                      const isRaisedBy = msg.sentBy?.id === selectedConcern.raisedBy?.id
                      return (
                        <div
                          key={msg.id}
                          className={`p-3 rounded-lg ${
                            isAdmin
                              ? 'bg-blue-50 border-l-4 border-blue-500'
                              : isRaisedBy
                              ? 'bg-green-50 border-l-4 border-green-500'
                              : 'bg-gray-50 border-l-4 border-gray-400'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <p className={`font-semibold text-sm ${
                              isAdmin ? 'text-blue-900' : isRaisedBy ? 'text-green-900' : 'text-gray-900'
                            }`}>
                              {msg.sentBy?.name || 'Unknown'}
                              {isAdmin && <span className="ml-2 text-xs">(Admin)</span>}
                              {!isAdmin && isRaisedBy && (
                                <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                                  selectedConcern.raisedBy?.role === 'CUSTOMER' ? 'bg-blue-100 text-blue-800' :
                                  selectedConcern.raisedBy?.role === 'WORKER' ? 'bg-green-100 text-green-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {selectedConcern.raisedBy?.role === 'CUSTOMER' ? 'Customer' : 
                                   selectedConcern.raisedBy?.role === 'WORKER' ? 'Worker' : ''}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(msg.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <p className={`text-sm ${
                            isAdmin ? 'text-blue-700' : isRaisedBy ? 'text-green-700' : 'text-gray-700'
                          }`}>
                            {msg.message}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm italic mb-4">No messages yet.</p>
                )}
                
                {/* Add Message Section */}
                <div className="border-t border-gray-200 pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Add Message:</label>
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 mb-2"
                    rows={3}
                    placeholder="Type your message here..."
                  />
                  <button
                    onClick={() => handleAddMessage(selectedConcern.id)}
                    disabled={isUpdatingConcern || !newMessage.trim()}
                    className="w-full bg-gradient-to-r from-red-500 to-pink-500 text-white py-2 rounded-lg font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform disabled:opacity-50"
                  >
                    {isUpdatingConcern ? 'Adding...' : 'Add Message'}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Response (Optional - will be added as message):</label>
                <textarea
                  value={adminResponse}
                  onChange={(e) => setAdminResponse(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  rows={3}
                  placeholder="Enter your response to this concern... (This will be added as a message when updating status)"
                />
                <p className="text-xs text-gray-500 mt-1">This will be added as a message when you update the status</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Update Status:</label>
                <select
                  value={selectedConcern.status}
                  onChange={(e) => {
                    const newStatus = e.target.value
                    handleUpdateConcernStatus(selectedConcern.id, newStatus)
                  }}
                  disabled={isUpdatingConcern}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:opacity-50"
                >
                  <option value="PENDING">Pending</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="DISMISSED">Dismissed</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleUpdateConcernStatus(selectedConcern.id, 'RESOLVED')}
                  disabled={isUpdatingConcern || selectedConcern.status === 'RESOLVED'}
                  className="flex-1 bg-green-500 text-white py-2 rounded-lg font-semibold hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ✓ Mark as Resolved
                </button>
                <button
                  onClick={() => handleUpdateConcernStatus(selectedConcern.id, 'IN_REVIEW')}
                  disabled={isUpdatingConcern || selectedConcern.status === 'IN_REVIEW'}
                  className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🔍 Mark as In Review
                </button>
                <button
                  onClick={() => handleUpdateConcernStatus(selectedConcern.id, 'DISMISSED')}
                  disabled={isUpdatingConcern || selectedConcern.status === 'DISMISSED'}
                  className="flex-1 bg-gray-500 text-white py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ✗ Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
