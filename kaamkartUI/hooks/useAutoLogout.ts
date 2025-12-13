'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { SessionStorage } from '@/lib/session'
import toast from 'react-hot-toast'

const INACTIVITY_TIMEOUT = 30 * 60 * 1000 // 30 minutes in milliseconds
const WARNING_TIME = 5 * 60 * 1000 // 5 minutes before logout (show warning)
const CHECK_INTERVAL = 60 * 1000 // Check every minute

export const useAutoLogout = () => {
  const router = useRouter()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const warningShownRef = useRef(false)
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const logout = useCallback(() => {
    SessionStorage.clear()
    toast.error('Session expired due to inactivity. Please login again.')
    router.push('/login')
  }, [router])

  const resetTimer = useCallback(() => {
    // Clear existing timers
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current)
    }
    warningShownRef.current = false

    // Update last activity
    SessionStorage.setLastActivity()

    // Check if user is logged in
    const token = SessionStorage.getToken()
    if (!token) return

    const now = Date.now()
    const lastActivity = SessionStorage.getLastActivity() || now
    const timeSinceActivity = now - lastActivity

    // If already past warning time, show warning immediately
    if (timeSinceActivity >= INACTIVITY_TIMEOUT - WARNING_TIME && !warningShownRef.current) {
      const timeUntilLogout = INACTIVITY_TIMEOUT - timeSinceActivity
      if (timeUntilLogout > 0) {
        const minutes = Math.ceil(timeUntilLogout / 60000)
        toast.error(`You will be logged out in ${minutes} minute${minutes > 1 ? 's' : ''} due to inactivity.`, {
          duration: 10000
        })
        warningShownRef.current = true
      }
    }

    // Set warning timer if not shown yet
    if (!warningShownRef.current) {
      const timeUntilWarning = INACTIVITY_TIMEOUT - WARNING_TIME - timeSinceActivity
      if (timeUntilWarning > 0) {
        warningTimeoutRef.current = setTimeout(() => {
          const minutes = Math.ceil(WARNING_TIME / 60000)
          toast.error(`You will be logged out in ${minutes} minute${minutes > 1 ? 's' : ''} due to inactivity.`, {
            duration: 10000
          })
          warningShownRef.current = true
        }, timeUntilWarning)
      }
    }

    // Set logout timer
    const timeUntilLogout = INACTIVITY_TIMEOUT - timeSinceActivity
    if (timeUntilLogout > 0) {
      timeoutRef.current = setTimeout(() => {
        logout()
      }, timeUntilLogout)
    } else {
      // Already past timeout, logout immediately
      logout()
    }
  }, [logout])

  useEffect(() => {
    // Check if user is logged in
    const token = SessionStorage.getToken()
    if (!token) return

    // Initialize timer
    resetTimer()

    // Track user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    const handleActivity = () => {
      resetTimer()
    }

    // Add event listeners
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    // Periodic check (every minute) to handle cases where events might be missed
    const intervalId = setInterval(() => {
      const lastActivity = SessionStorage.getLastActivity()
      if (lastActivity) {
        const timeSinceActivity = Date.now() - lastActivity
        if (timeSinceActivity >= INACTIVITY_TIMEOUT) {
          logout()
        } else {
          // Update timer based on actual last activity
          resetTimer()
        }
      }
    }, CHECK_INTERVAL)

    // Cleanup
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity)
      })
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current)
      }
      clearInterval(intervalId)
    }
  }, [resetTimer, logout])

  return { resetTimer }
}

