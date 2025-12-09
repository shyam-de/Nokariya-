'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import axios from 'axios'
import toast from 'react-hot-toast'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8585/api'

export default function Login() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    secondaryPhone: '',
    password: '',
    role: 'customer',
    laborTypes: [] as string[]
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register'
      let data: any
      if (isLogin) {
        if (!formData.email || !formData.password) {
          toast.error('Email and password are required')
          return
        }
        data = { 
          email: formData.email.trim().toLowerCase(), 
          password: formData.password 
        }
        console.log('Login attempt:', { email: data.email })
      } else {
        // Convert to uppercase for API enum
        data = {
          ...formData,
          email: formData.email.trim().toLowerCase(),
          role: formData.role.toUpperCase(),
          laborTypes: formData.laborTypes.map(type => type.toUpperCase())
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
        laborTypes: [type] // Only one selection
      })
    } else {
      // For other cases (if any), keep checkbox behavior
      if (formData.laborTypes.includes(type)) {
        setFormData({
          ...formData,
          laborTypes: formData.laborTypes.filter(t => t !== type)
        })
      } else {
        setFormData({
          ...formData,
          laborTypes: [...formData.laborTypes, type]
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
            {isLogin ? 'Welcome back!' : 'Create your account'}
          </p>
        </div>

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
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
              placeholder="Enter your password"
            />
          </div>

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
                    onChange={(e) => setFormData({ ...formData, role: e.target.value, laborTypes: [] })}
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
                  Labor Type <span className="text-red-500">*</span> (Select one)
                </label>
              <div className="grid grid-cols-2 gap-2">
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
                  <label key={type.value} className="flex items-center cursor-pointer group hover:bg-white p-2 rounded transition-colors border border-gray-200 hover:border-primary-300">
                    <input
                      type="radio"
                      name="laborType"
                      checked={formData.laborTypes.includes(type.value)}
                      onChange={() => toggleLaborType(type.value)}
                      className="mr-2 w-4 h-4 text-primary-600 focus:ring-primary-500"
                      required={formData.role === 'worker'}
                    />
                    <span className="text-sm group-hover:text-primary-600 transition-colors font-medium">{type.label}</span>
                  </label>
                ))}
              </div>
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

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary-600 hover:text-primary-700 font-medium transition-all duration-200 hover:scale-105 transform"
          >
            {isLogin ? "Don't have an account? Register" : 'Already have an account? Login'}
          </button>
        </div>
      </div>
    </div>
  )
}
