import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios'

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
    // Get token from localStorage
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
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
      console.error('Network error:', error.message)
      // Could show a toast notification here
      return Promise.reject({
        message: 'Network error. Please check your connection.',
        isNetworkError: true,
      })
    }

    // Handle 401 Unauthorized - token expired or invalid
    if (error.response.status === 401) {
      // Clear invalid token
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        // Redirect to login if not already there
        if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
          window.location.href = '/login'
        }
      }
      return Promise.reject({
        message: 'Session expired. Please login again.',
        status: 401,
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

