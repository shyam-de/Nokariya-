'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function Home() {
  const router = useRouter()
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token')
    const user = localStorage.getItem('user')
    
    if (token && user) {
      try {
        const userObj = JSON.parse(user)
        if (userObj.role === 'customer') {
          router.push('/customer/dashboard')
        } else if (userObj.role === 'worker') {
          router.push('/worker/dashboard')
        }
      } catch (e) {
        // Invalid user data, continue to show home page
        console.error('Error parsing user data:', e)
      }
    }
    // Always set loaded to true to show the page
    setIsLoaded(true)
  }, [router])

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent">
                Nokariya
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-gray-700 hover:text-primary-600 font-medium transition-all duration-200 hover:scale-105"
              >
                Login
              </Link>
              <Link
                href="/login"
                className="bg-gradient-to-r from-primary-600 to-indigo-600 text-white px-6 py-2 rounded-lg font-semibold hover:shadow-lg transition-all duration-200 hover:scale-105 transform"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 animate-fade-in">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 animate-slide-up">
            Connect with Labor Workers
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-indigo-600 mt-2">
              Instantly
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto animate-slide-up delay-100">
            Find skilled electricians, skilled and unskilled laborers near you. 
            Post your requirements and get connected with verified workers in minutes.
          </p>
          <div className="flex gap-4 justify-center animate-slide-up delay-200">
            <Link
              href="/login"
              className="group bg-gradient-to-r from-primary-600 to-indigo-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 transform relative overflow-hidden"
            >
              <span className="relative z-10">Find Workers</span>
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-primary-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </Link>
            <Link
              href="/login"
              className="bg-white text-primary-600 px-8 py-4 rounded-lg font-semibold text-lg border-2 border-primary-600 hover:bg-primary-50 transition-all duration-300 hover:scale-105 transform shadow-lg hover:shadow-xl"
            >
              Join as Worker
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          How It Works
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="group bg-white rounded-xl shadow-lg p-8 text-center hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 transform cursor-pointer">
            <div className="bg-gradient-to-br from-primary-100 to-indigo-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
              <span className="text-4xl">📝</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-primary-600 transition-colors">
              Post Your Request
            </h3>
            <p className="text-gray-600">
              Specify the type of labor you need, number of workers, and your location. 
              We'll find the best matches for you.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="group bg-white rounded-xl shadow-lg p-8 text-center hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 transform cursor-pointer">
            <div className="bg-gradient-to-br from-yellow-100 to-orange-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
              <span className="text-4xl">🔔</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-primary-600 transition-colors">
              Workers Get Notified
            </h3>
            <p className="text-gray-600">
              Nearby available workers receive instant notifications about your request. 
              They can confirm their availability immediately.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="group bg-white rounded-xl shadow-lg p-8 text-center hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 transform cursor-pointer">
            <div className="bg-gradient-to-br from-green-100 to-emerald-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
              <span className="text-4xl">✅</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-primary-600 transition-colors">
              Workers Deployed
            </h3>
            <p className="text-gray-600">
              Once workers confirm, they're automatically deployed to your location. 
              Get your work done quickly and efficiently.
            </p>
          </div>
        </div>
      </section>

      {/* Labor Types Section */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Types of Labor Available
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="group border-2 border-primary-200 rounded-xl p-6 hover:border-primary-400 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 transform cursor-pointer bg-gradient-to-br from-white to-primary-50">
              <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300">⚡</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors">Electricians</h3>
              <p className="text-gray-600">
                Professional electricians for all your electrical needs - repairs, installations, and maintenance.
              </p>
            </div>
            <div className="group border-2 border-primary-200 rounded-xl p-6 hover:border-primary-400 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 transform cursor-pointer bg-gradient-to-br from-white to-primary-50">
              <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300">🔧</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors">Skilled Labor</h3>
              <p className="text-gray-600">
                Experienced skilled workers for construction, carpentry, plumbing, and specialized tasks.
              </p>
            </div>
            <div className="group border-2 border-primary-200 rounded-xl p-6 hover:border-primary-400 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 transform cursor-pointer bg-gradient-to-br from-white to-primary-50">
              <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300">👷</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors">Unskilled Labor</h3>
              <p className="text-gray-600">
                General labor workers for loading, unloading, cleaning, and other manual tasks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-600 rounded-2xl p-12 text-center text-white shadow-2xl transform hover:scale-105 transition-transform duration-300">
          <h2 className="text-4xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of customers and workers already using Nokariya
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/login"
              className="bg-white text-primary-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-all duration-200 hover:scale-110 transform shadow-lg"
            >
              Sign Up Now
            </Link>
            <Link
              href="/login"
              className="bg-transparent border-2 border-white text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white hover:text-primary-600 transition-all duration-200 hover:scale-110 transform"
            >
              Login
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="opacity-75">© 2024 Nokariya. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
