'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import axios from 'axios'
import toast from 'react-hot-toast'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8585/api'

export default function Login() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const [workerTypes, setLaborTypes] = useState<any[]>([])
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    secondaryPhone: '',
    password: '',
    confirmPassword: '',
    role: 'customer',
    workerTypes: [] as string[]
  })

  useEffect(() => {
    // Fetch active labor types
    const fetchLaborTypes = async () => {
      try {
        const response = await axios.get(`${API_URL}/public/worker-types`)
        setLaborTypes(response.data)
      } catch (error) {
        console.error('Error fetching labor types:', error)
      }
    }
    fetchLaborTypes()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register'
      let data: any
      if (isLogin) {
        if (!formData.email || !formData.password) {
          toast.error('Email and password are required')
          setIsLoading(false)
          return
        }
        data = { 
          email: formData.email.trim().toLowerCase(), 
          password: formData.password 
        }
        console.log('Login attempt:', { email: data.email })
      } else {
        // Validation for registration
        if (!formData.name || !formData.email || !formData.phone || !formData.password) {
          toast.error('Please fill all required fields')
          setIsLoading(false)
          return
        }
        
        if (formData.password.length < 6) {
          toast.error('Password must be at least 6 characters long')
          setIsLoading(false)
          return
        }
        
        if (formData.password !== formData.confirmPassword) {
          toast.error('Passwords do not match')
          setIsLoading(false)
          return
        }
        
        if (formData.role === 'worker' && formData.workerTypes.length === 0) {
          toast.error('Please select a worker type')
          setIsLoading(false)
          return
        }
        
        // Convert to uppercase for API enum
        data = {
          name: formData.name,
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone,
          secondaryPhone: formData.secondaryPhone || null,
          password: formData.password,
          role: formData.role.toUpperCase(),
          workerTypes: formData.workerTypes.map(type => type.toUpperCase())
        }
      }

      console.log('Sending request to:', `${API_URL}${endpoint}`)
      const response = await axios.post(`${API_URL}${endpoint}`, data, {
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      console.log('Response received:', response.data)
      
      if (!response.data.token) {
        toast.error('No token received from server')
        return
      }
      
      localStorage.setItem('token', response.data.token)
      localStorage.setItem('user', JSON.stringify(response.data.user))
      
      toast.success(isLogin ? 'Login successful!' : 'Registration successful!')
      
      const userRole = response.data.user.role?.toLowerCase() || response.data.user.role
      if (userRole === 'customer' || userRole === 'CUSTOMER') {
        router.push('/customer/dashboard')
      } else if (userRole === 'admin' || userRole === 'ADMIN' || userRole === 'system_admin') {
        router.push('/admin/dashboard')
      } else {
        router.push('/worker/dashboard')
      }
    } catch (error: any) {
      console.error('Login/Register error:', error)
      console.error('Error response:', error.response)
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'An error occurred'
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleLaborType = (type: string) => {
    // For workers, only allow one labor type (radio button behavior)
    if (formData.role === 'worker') {
      setFormData({
        ...formData,
        workerTypes: [type] // Only one selection
      })
    } else {
      // For other cases (if any), keep checkbox behavior
      if (formData.workerTypes.includes(type)) {
        setFormData({
          ...formData,
          workerTypes: formData.workerTypes.filter(t => t !== type)
        })
      } else {
        setFormData({
          ...formData,
          workerTypes: [...formData.workerTypes, type]
        })
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md transform hover:scale-105 transition-all duration-300">
        {/* Back to Home */}
        <Link 
          href="/"
          className="text-primary-600 hover:text-primary-700 font-medium mb-4 inline-block transition-all duration-200 hover:scale-105 transform"
        >
          ← Back to Home
        </Link>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            KaamKart
          </h1>
          <p className="text-gray-600">
            {showForgotPassword ? 'Reset Password' : isLogin ? 'Welcome back!' : 'Create your account'}
          </p>
        </div>

        {showForgotPassword ? (
          <div className="space-y-4">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-gray-800">Forgot Password?</h3>
              <p className="text-sm text-gray-600">Enter your email address and we'll send you a link to reset your password.</p>
              <input
                type="email"
                value={forgotPasswordEmail}
                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!forgotPasswordEmail) {
                      toast.error('Please enter your email')
                      return
                    }
                    setIsLoading(true)
                    try {
                      const response = await axios.post(`${API_URL}/auth/forgot-password`, {
                        email: forgotPasswordEmail.trim().toLowerCase()
                      })
                      toast.success(response.data.message || 'Password reset link sent!')
                      setShowForgotPassword(false)
                      setForgotPasswordEmail('')
                    } catch (error: any) {
                      toast.error(error.response?.data?.message || 'Failed to send reset link')
                    } finally {
                      setIsLoading(false)
                    }
                  }}
                  disabled={isLoading}
                  className="flex-1 bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false)
                    setForgotPasswordEmail('')
                  }}
                  className="px-4 py-3 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  placeholder="Enter your full name"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Phone
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  placeholder="Enter your phone number"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Secondary Phone (Optional)
                </label>
                <input
                  type="tel"
                  value={formData.secondaryPhone}
                  onChange={(e) => setFormData({ ...formData, secondaryPhone: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  placeholder="Enter secondary phone number (optional)"
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
              placeholder="Enter your email"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {!isLogin && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
            </div>
          )}

          {!isLogin && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                I am a
              </label>
              <div className="flex gap-4 flex-wrap">
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="radio"
                    value="customer"
                    checked={formData.role === 'customer'}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value, workerTypes: [], password: '', confirmPassword: '' })}
                    className="mr-2 w-4 h-4 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="group-hover:text-primary-600 transition-colors">Customer</span>
                </label>
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="radio"
                    value="worker"
                    checked={formData.role === 'worker'}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="mr-2 w-4 h-4 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="group-hover:text-primary-600 transition-colors">Worker</span>
                </label>
              </div>
            </div>
          )}

          {!isLogin && formData.role === 'worker' && (
            <div className="space-y-2 p-4 bg-primary-50 rounded-lg border-2 border-primary-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Worker Type <span className="text-red-500">*</span> (Select one)
                </label>
              {workerTypes.length === 0 ? (
                <p className="text-sm text-gray-500">Loading worker types...</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {workerTypes
                    .filter(lt => lt.isActive)
                    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
                    .map((type) => (
                    <label key={type.name} className="flex items-center cursor-pointer group hover:bg-white p-2 rounded transition-colors border border-gray-200 hover:border-primary-300">
                      <input
                        type="radio"
                        name="laborType"
                        checked={formData.workerTypes.includes(type.name.toLowerCase())}
                        onChange={() => toggleLaborType(type.name.toLowerCase())}
                        className="mr-2 w-4 h-4 text-primary-600 focus:ring-primary-500"
                        required={formData.role === 'worker'}
                      />
                      <span className="text-sm group-hover:text-primary-600 transition-colors font-medium">
                        {type.icon || '🔧'} {type.displayName || type.name}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-primary-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all duration-200 hover:scale-105 transform disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none relative overflow-hidden"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              isLogin ? 'Login' : 'Register'
            )}
          </button>
        </form>
        )}

        <div className="mt-6 text-center">
          {!showForgotPassword && (
            <>
              {isLogin && (
                <button
                  onClick={() => setShowForgotPassword(true)}
                  className="block w-full mb-3 text-sm text-primary-600 hover:text-primary-700 font-medium transition-all duration-200"
                >
                  Forgot Password?
                </button>
              )}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary-600 hover:text-primary-700 font-medium transition-all duration-200 hover:scale-105 transform"
              >
                {isLogin ? "Don't have an account? Register" : 'Already have an account? Login'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
