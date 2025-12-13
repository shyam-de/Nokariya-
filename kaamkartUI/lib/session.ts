/**
 * Session management utility for multi-tab support
 * Uses sessionStorage instead of localStorage so each tab can have different accounts
 */

export const SessionStorage = {
  getToken: (): string | null => {
    if (typeof window === 'undefined') return null
    return sessionStorage.getItem('token')
  },

  setToken: (token: string): void => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem('token', token)
  },

  removeToken: (): void => {
    if (typeof window === 'undefined') return
    sessionStorage.removeItem('token')
  },

  getUser: (): any | null => {
    if (typeof window === 'undefined') return null
    const userStr = sessionStorage.getItem('user')
    if (!userStr) return null
    try {
      return JSON.parse(userStr)
    } catch {
      return null
    }
  },

  setUser: (user: any): void => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem('user', JSON.stringify(user))
  },

  removeUser: (): void => {
    if (typeof window === 'undefined') return
    sessionStorage.removeItem('user')
  },

  clear: (): void => {
    if (typeof window === 'undefined') return
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
    sessionStorage.removeItem('lastActivity')
  },

  setLastActivity: (): void => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem('lastActivity', Date.now().toString())
  },

  getLastActivity: (): number | null => {
    if (typeof window === 'undefined') return null
    const lastActivity = sessionStorage.getItem('lastActivity')
    return lastActivity ? parseInt(lastActivity, 10) : null
  }
}

