'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiClient, API_URL } from '@/lib/api'
import { SessionStorage } from '@/lib/session'
import toast from 'react-hot-toast'
import { useLanguage } from '@/contexts/LanguageContext'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { getLocationFromPinCode } from '@/lib/indianLocationValidation'

export default function Login() {
  const router = useRouter()
  const { t, language } = useLanguage()
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
    workerTypes: [] as string[],
    state: '',
    city: '',
    pinCode: '',
    address: ''
  })

  useEffect(() => {
    // Fetch active labor types
    const fetchLaborTypes = async () => {
      try {
        const response = await apiClient.get('/public/worker-types')
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
          toast.error(t('login.emailRequired') + ' ' + t('login.passwordRequired'))
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
          toast.error(t('login.nameRequired') + ', ' + t('login.emailRequired') + ', ' + t('login.phoneRequired') + ', ' + t('login.passwordRequired'))
          setIsLoading(false)
          return
        }
        
        // Validate state, city, pin code, and address
        if (!formData.state || !formData.city || !formData.pinCode || !formData.address) {
          toast.error(t('login.stateCityPinAddressRequired') || 'State, City, Pin Code, and Address are required')
          setIsLoading(false)
          return
        }
        
        // Validate pin code format
        const pinCodeRegex = /^\d{6}$/
        if (!pinCodeRegex.test(formData.pinCode.trim())) {
          toast.error(t('login.invalidPinCode') || 'Pin Code must be exactly 6 digits')
          setIsLoading(false)
          return
        }
        
        // Basic format validation for state and city (no list validation)
        if (formData.state.trim().length < 2) {
          toast.error(t('login.stateMinLength') || 'State must be at least 2 characters long')
          setIsLoading(false)
          return
        }
        
        if (formData.city.trim().length < 2) {
          toast.error(t('login.cityMinLength') || 'City must be at least 2 characters long')
          setIsLoading(false)
          return
        }
        
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        const trimmedEmail = formData.email.trim().toLowerCase()
        if (!emailRegex.test(trimmedEmail)) {
          toast.error(t('login.invalidEmail'))
          setIsLoading(false)
          return
        }
        
        // Phone validation (basic - should be at least 10 digits)
        const phoneRegex = /^[0-9]{10,15}$/
        // Clean phone numbers (remove non-digits) - used for both validation and data
        const cleanedPhone = formData.phone.replace(/\D/g, '')
        if (!phoneRegex.test(cleanedPhone)) {
          toast.error(t('login.invalidPhone'))
          setIsLoading(false)
          return
        }
        
        // Secondary phone validation (if provided)
        const cleanedSecondaryPhone = formData.secondaryPhone ? formData.secondaryPhone.replace(/\D/g, '') : null
        if (formData.secondaryPhone && cleanedSecondaryPhone && !phoneRegex.test(cleanedSecondaryPhone)) {
          toast.error(t('login.invalidPhone'))
          setIsLoading(false)
          return
        }
        
        if (formData.password.length < 6) {
          toast.error(t('login.passwordRequired'))
          setIsLoading(false)
          return
        }
        
        if (formData.password !== formData.confirmPassword) {
          toast.error(t('login.passwordMismatch'))
          setIsLoading(false)
          return
        }
        
        if (formData.role === 'worker' && formData.workerTypes.length === 0) {
          toast.error(t('login.selectWorkerTypes'))
          setIsLoading(false)
          return
        }
        
        // Convert to uppercase for API enum
        
        data = {
          name: formData.name.trim(),
          email: trimmedEmail,
          phone: cleanedPhone,
          secondaryPhone: cleanedSecondaryPhone,
          password: formData.password,
          role: formData.role.toUpperCase(),
          workerTypes: formData.workerTypes.map(type => type.toUpperCase()),
          location: {
            state: formData.state.trim(),
            city: formData.city.trim(),
            pinCode: formData.pinCode.trim(),
            address: formData.address.trim()
          }
        }
      }

      console.log('Sending request to:', `${API_URL}${endpoint}`)
      const response = await apiClient.post(endpoint, data)
      
      console.log('Response received:', response.data)
      
      if (!response.data.token) {
        toast.error(t('common.error'))
        return
      }
      
      // Use sessionStorage for multi-tab support
      SessionStorage.setToken(response.data.token)
      SessionStorage.setUser(response.data.user)
      SessionStorage.setLastActivity()
      
      toast.success(isLogin ? t('login.loginSuccess') : t('login.registerSuccess'))
      
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
        {/* Language Switcher and Back to Home */}
        <div className="flex justify-between items-center mb-4">
          <Link 
            href="/"
            className="text-primary-600 hover:text-primary-700 font-medium inline-block transition-all duration-200 hover:scale-105 transform"
          >
            ← Back to Home
          </Link>
          <LanguageSwitcher />
        </div>

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
              <h3 className="font-semibold text-gray-800" lang={language}>{t('forgotPassword.title')}</h3>
              <p className="text-sm text-gray-600" lang={language}>{t('forgotPassword.subtitle')}</p>
              <input
                type="email"
                value={forgotPasswordEmail}
                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                placeholder={t('forgotPassword.emailPlaceholder')}
                pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
                title={t('login.invalidEmail')}
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
                    
                    // Email validation for forgot password
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                    const trimmedEmail = forgotPasswordEmail.trim().toLowerCase()
                    if (!emailRegex.test(trimmedEmail)) {
                      toast.error('Please enter a valid email address')
                      return
                    }
                    
                    setIsLoading(true)
                    try {
                      const response = await apiClient.post('/auth/forgot-password', {
                        email: trimmedEmail
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
                  {isLoading ? t('common.loading') : t('forgotPassword.sendResetLink')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false)
                    setForgotPasswordEmail('')
                  }}
                  className="px-4 py-3 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700" lang={language}>
                  {t('common.name')}
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => {
                    // Validate name - no numbers allowed
                    const value = e.target.value
                    // Allow only letters, spaces, and common name characters (apostrophes, hyphens, dots)
                    const nameRegex = /^[a-zA-Z\s'\-\.]*$/
                    if (nameRegex.test(value) || value === '') {
                      setFormData({ ...formData, name: value })
                    }
                  }}
                  onBlur={(e) => {
                    // Show error if name contains numbers
                    const value = e.target.value.trim()
                    if (value && /\d/.test(value)) {
                      toast.error(t('login.nameNoNumbers') || 'Name cannot contain numbers')
                    }
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  placeholder={t('common.name')}
                  pattern="[a-zA-Z\s'\-\.]+"
                  title={t('login.nameNoNumbers') || 'Name should only contain letters, spaces, apostrophes, hyphens, and dots'}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700" lang={language}>
                  {t('common.phone')}
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  placeholder={t('common.phone')}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700" lang={language}>
                  {t('common.secondaryPhone')} ({t('common.cancel')})
                </label>
                <input
                  type="tel"
                  value={formData.secondaryPhone}
                  onChange={(e) => setFormData({ ...formData, secondaryPhone: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  placeholder="Enter secondary phone number (optional, 10-15 digits)"
                  pattern="[0-9]{10,15}"
                  title="Please enter a valid phone number (10-15 digits)"
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700" lang={language}>
              {t('common.email')}
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
              placeholder={t('login.emailPlaceholder')}
              pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
              title={t('login.invalidEmail')}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700" lang={language}>
              {t('common.password')}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                placeholder={t('login.passwordPlaceholder')}
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
              <label className="block text-sm font-medium text-gray-700" lang={language}>
                {t('login.confirmPassword')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  placeholder={t('login.confirmPassword')}
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
                <p className="text-xs text-red-500" lang={language}>{t('login.passwordMismatch')}</p>
              )}
            </div>
          )}

          {/* Location Details - Moved Before Role */}
          {!isLogin && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700" lang={language}>
                {t('login.locationDetails') || 'Location'} <span className="text-red-500">*</span>
              </label>
              
              {/* Pin Code */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1" lang={language}>
                  {t('login.pinCode') || 'Pin Code'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={formData.pinCode}
                  onChange={async (e) => {
                    const value = e.target.value.replace(/\D/g, '') // Only digits
                    if (value.length <= 6) {
                      setFormData({ ...formData, pinCode: value })
                      
                      // Auto-fill state, city, and address when pin code is complete
                      if (value.length === 6) {
                        try {
                          const location = await getLocationFromPinCode(value)
                          if (location) {
                            setFormData(prev => ({
                              ...prev,
                              pinCode: value,
                              state: location.state || prev.state,
                              city: location.city || prev.city,
                              address: location.address || prev.address
                            }))
                            toast.success(t('login.pinCodeDetected') || 'Location detected from Pin Code!')
                          } else {
                            toast.error(t('login.pinCodeNotFound') || 'Pin Code not found. Please enter a valid 6-digit pin code.')
                          }
                        } catch (error) {
                          console.error('Error fetching location from pin code:', error)
                          toast.error(t('login.pinCodeError') || 'Error detecting location from Pin Code. Please try again.')
                        }
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value.trim()
                    if (value && value.length !== 6) {
                      toast.error(t('login.invalidPinCode') || 'Pin Code must be exactly 6 digits')
                    }
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  placeholder={t('login.pinCode') || 'Enter 6-digit Pin Code'}
                  pattern="\d{6}"
                  title={t('login.pinCodeValidation') || 'Pin Code must be exactly 6 digits'}
                  lang={language}
                />
              </div>
              
              {/* Address - Editable, auto-filled from Pin Code but can be modified */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1" lang={language}>
                  {t('login.address') || 'Full Address'} <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm resize-none"
                  placeholder={t('login.addressPlaceholder') || 'Enter your full address (auto-filled from Pin Code, but you can edit)'}
                  rows={3}
                  lang={language}
                />
                <p className="text-xs text-gray-500 mt-1" lang={language}>
                  {t('login.addressHelp') || 'Address will be auto-filled when you enter pin code, but you can edit it if needed'}
                </p>
              </div>
              
              {/* State and City - Read Only */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1" lang={language}>
                    {t('login.state') || 'State'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    readOnly
                    value={formData.state}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg bg-gray-50 text-sm cursor-not-allowed"
                    placeholder={t('login.stateAutoDetected') || 'Auto-detected'}
                    lang={language}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1" lang={language}>
                    {t('login.city') || 'City'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    readOnly
                    value={formData.city}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg bg-gray-50 text-sm cursor-not-allowed"
                    placeholder={t('login.cityAutoDetected') || 'Auto-detected'}
                    lang={language}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Account Type (Renamed from Role) */}
          {!isLogin && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700" lang={language}>
                {t('login.accountType') || 'I am a'} <span className="text-red-500">*</span>
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
                  <span className="group-hover:text-primary-600 transition-colors" lang={language}>{t('login.customer')}</span>
                </label>
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="radio"
                    value="worker"
                    checked={formData.role === 'worker'}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value, workerTypes: [] })}
                    className="mr-2 w-4 h-4 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="group-hover:text-primary-600 transition-colors" lang={language}>{t('login.worker')}</span>
                </label>
              </div>
            </div>
          )}

          {/* Worker Types - Dropdown for Workers */}
          {!isLogin && formData.role === 'worker' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700" lang={language}>
                {t('login.selectWorkerTypes')} <span className="text-red-500">*</span>
              </label>
              {workerTypes.length === 0 ? (
                <p className="text-sm text-gray-500" lang={language}>{t('common.loading')}</p>
              ) : (
                <select
                  required
                  value={formData.workerTypes[0] || ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setFormData({ ...formData, workerTypes: [e.target.value] })
                    }
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  lang={language}
                >
                  <option value="">{t('login.selectWorkerType') || 'Select Worker Type'}</option>
                  {workerTypes
                    .filter(lt => lt.isActive)
                    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
                    .map((type) => (
                      <option key={type.name} value={type.name.toLowerCase()}>
                        {type.icon || '🔧'} {type.displayName || type.name}
                      </option>
                    ))}
                </select>
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
              isLogin ? t('common.login') : t('common.register')
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
                  lang={language}
                >
                  {t('login.forgotPassword')}
                </button>
              )}
              <button
                onClick={() => {
                  setIsLogin(!isLogin)
                  // Reset form data when switching between login and register
                  if (!isLogin) {
                    setFormData({
                      name: '',
                      email: '',
                      phone: '',
                      secondaryPhone: '',
                      password: '',
                      confirmPassword: '',
                      role: 'customer',
                      workerTypes: [],
                      state: '',
                      city: '',
                      pinCode: '',
                      address: ''
                    })
                  }
                }}
                className="text-primary-600 hover:text-primary-700 font-medium transition-all duration-200 hover:scale-105 transform"
                lang={language}
              >
                {isLogin ? t('login.noAccount') + ' ' + t('login.registerNow') : t('login.haveAccount') + ' ' + t('login.loginNow')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
