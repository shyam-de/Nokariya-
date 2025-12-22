'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiClient, API_URL } from '@/lib/api'
import { SessionStorage } from '@/lib/session'
import toast from 'react-hot-toast'
import { useLanguage } from '@/contexts/LanguageContext'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { logger } from '@/lib/logger'

export default function AdminLogin() {
  const router = useRouter()
  const { t, language } = useLanguage()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      if (!formData.email || !formData.password) {
        toast.error(t('login.emailRequired') + ' ' + t('login.passwordRequired'))
        setIsLoading(false)
        return
      }

      const data = { 
        email: formData.email.trim().toLowerCase(), 
        password: formData.password 
      }

      const response = await apiClient.post(`${API_URL}/auth/admin/login`, data)
      
      if (response.data.token && response.data.user) {
        SessionStorage.setToken(response.data.token)
        SessionStorage.setUser(response.data.user)
        
        toast.success(t('login.loginSuccess') || 'Login successful!')
        logger.info('Admin login successful:', response.data.user)
        
        // Redirect to admin dashboard
        router.push('/admin/dashboard')
      } else {
        throw new Error('Invalid response from server')
      }
    } catch (error: any) {
      logger.error('Admin login error:', error)
      const errorMessage = error.response?.data?.message || error.message || t('login.loginFailed') || 'Login failed'
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-red-50 to-orange-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-4">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
              KaamKart
            </h1>
            <p className="text-sm text-gray-600 mt-1" lang={language}>Admin Portal</p>
          </Link>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-xl shadow-2xl p-8 border-2 border-red-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900" lang={language}>
              {t('login.adminLogin') || 'Admin Login'}
            </h2>
            <LanguageSwitcher />
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2" lang={language}>
                {t('login.email') || 'Email'}
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                placeholder={t('login.emailPlaceholder') || 'Enter your email'}
                lang={language}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2" lang={language}>
                {t('login.password') || 'Password'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all pr-12"
                  placeholder={t('login.passwordPlaceholder') || 'Enter your password'}
                  lang={language}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Link 
                href="/login" 
                className="text-sm text-red-600 hover:text-red-700 transition-colors"
                lang={language}
              >
                {t('login.workerCustomerLogin') || 'Worker/Customer Login'}
              </Link>
              <Link 
                href="/forgot-password" 
                className="text-sm text-red-600 hover:text-red-700 transition-colors"
                lang={language}
              >
                {t('login.forgotPassword') || 'Forgot Password?'}
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all duration-200 hover:scale-105 transform disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              lang={language}
            >
              {isLoading ? (t('login.loggingIn') || 'Logging in...') : (t('common.login') || 'Login')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600" lang={language}>
              {t('login.notAdmin') || 'Not an admin?'}{' '}
              <Link href="/" className="text-red-600 hover:text-red-700 font-semibold transition-colors">
                {t('login.backToHome') || 'Back to Home'}
              </Link>
            </p>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p lang={language}>
            {t('login.adminLoginNote') || 'Secure admin access only. Unauthorized access is prohibited.'}
          </p>
        </div>
      </div>
    </div>
  )
}

