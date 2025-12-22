import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { SessionStorage } from './session'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8585/api'

// Create axios instance with default config
const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false, // Don't send cookies, we use JWT tokens
  timeout: 30000, // 30 second timeout
})

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Get token from sessionStorage (multi-tab support)
    const token = SessionStorage.getToken()
    
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    // Update last activity on any API call
    SessionStorage.setLastActivity()
    
    return config
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    return response
  },
  (error: AxiosError) => {
    // Handle network errors
    if (!error.response) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Network error:', error.message)
      }
      return Promise.reject({
        message: 'Network error. Please check your connection.',
        isNetworkError: true,
      })
    }

    // Handle 401 Unauthorized - token expired or invalid
    if (error.response.status === 401) {
      // Don't redirect or clear session if this is a login/auth endpoint
      // These endpoints return 401 for invalid credentials, not expired sessions
      const requestUrl = error.config?.url || ''
      const isAuthEndpoint = requestUrl.includes('/auth/login') || 
                             requestUrl.includes('/auth/admin/login') ||
                             requestUrl.includes('/auth/register') ||
                             requestUrl.includes('/auth/forgot-password') ||
                             requestUrl.includes('/auth/reset-password')
      
      if (!isAuthEndpoint) {
        // This is a session expiration - clear token and redirect
        SessionStorage.clear()
        // Redirect to login if not already there
        if (typeof window !== 'undefined' && window.location.pathname !== '/login' && window.location.pathname !== '/') {
          window.location.href = '/login'
        }
        return Promise.reject({
          message: 'Session expired. Please login again.',
          status: 401,
        })
      }
      // For auth endpoints, return the actual error message from the server
      // Don't redirect or clear session - let the login page handle the error
      const errorMessage = 
        (error.response.data as any)?.message || 
        'Invalid credentials. Please try again.'
      
      return Promise.reject({
        message: errorMessage,
        status: 401,
        data: error.response.data,
      })
    }

    // Handle 403 Forbidden
    if (error.response.status === 403) {
      return Promise.reject({
        message: 'Access denied.',
        status: 403,
      })
    }

    // Handle other errors
    const errorMessage = 
      (error.response.data as any)?.message || 
      error.message || 
      'An error occurred'
    
    return Promise.reject({
      message: errorMessage,
      status: error.response.status,
      data: error.response.data,
    })
  }
)

export { apiClient, API_URL }

