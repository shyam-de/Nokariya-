/**
 * Environment variable validation
 * Validates required environment variables at startup
 */

const requiredEnvVars = [
  'NEXT_PUBLIC_API_URL',
] as const

const optionalEnvVars = [] as const

export function validateEnv() {
  if (typeof window === 'undefined') {
    // Server-side validation
    const missing: string[] = []
    
    requiredEnvVars.forEach((varName) => {
      if (!process.env[varName]) {
        missing.push(varName)
      }
    })

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}\n` +
        'Please check your .env file or environment configuration.'
      )
    }
  } else {
    // Client-side validation (only for public vars)
    const missing: string[] = []
    
    requiredEnvVars.forEach((varName) => {
      if (!process.env[varName]) {
        missing.push(varName)
      }
    })

    if (missing.length > 0) {
      console.error(
        `Missing required environment variables: ${missing.join(', ')}\n` +
        'The application may not work correctly.'
      )
    }
  }
}

// Validate on import (client-side)
if (typeof window !== 'undefined') {
  try {
    validateEnv()
  } catch (error) {
    // Don't throw in client-side, just log
    console.error('Environment validation error:', error)
  }
}

