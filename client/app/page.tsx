'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function Home() {
  const router = useRouter()
  const [isLoaded, setIsLoaded] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)

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

  // Advertisement data - can be fetched from API or set dynamically
  const [advertisement, setAdvertisement] = useState<{
    text: string;
    link?: string;
    image?: string;
  } | null>(null)

  // Example: You can fetch advertisement from API
  useEffect(() => {
    // Simulate fetching advertisement - replace with actual API call
    // const fetchAd = async () => {
    //   const response = await fetch('/api/advertisements/active')
    //   const data = await response.json()
    //   if (data.active) {
    //     setAdvertisement(data)
    //   }
    // }
    // fetchAd()
    
    // For now, set to null (no ad) - you can set this to show an ad
    // setAdvertisement({
    //   text: '🎉 Special Offer: Get 20% off on your first booking!',
    //   link: '/promotions'
    // })
  }, [])

  type SliderItem = {
    icon: string;
    title: string;
    description: string;
    color: string;
    isAd?: boolean;
    link?: string;
  }

  const sliderItems: SliderItem[] = [
    {
      icon: '⚡',
      title: 'Fast & Reliable Service',
      description: 'Get connected with verified workers in minutes, not days',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: '✅',
      title: 'Verified Workers Only',
      description: 'All workers are verified by our admin team for quality assurance',
      color: 'from-green-500 to-emerald-500'
    },
    {
      icon: '⭐',
      title: 'Rated & Reviewed',
      description: 'Rate and review workers to help others make informed decisions',
      color: 'from-purple-500 to-pink-500'
    }
  ]

  // Include advertisement in slider if available
  const allSliderItems: SliderItem[] = advertisement 
    ? [
        {
          icon: '📢',
          title: advertisement.text,
          description: advertisement.link ? 'Click to learn more' : '',
          isAd: true,
          link: advertisement.link,
          color: 'from-orange-500 to-red-500'
        },
        ...sliderItems
      ]
    : sliderItems

  // Auto-rotate slider
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % allSliderItems.length)
    }, 4000) // Change slide every 4 seconds
    return () => clearInterval(interval)
  }, [allSliderItems.length])

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const laborTypes = [
    { icon: '⚡', name: 'Electrician', desc: 'Electrical repairs, installations & maintenance' },
    { icon: '🚗', name: 'Driver', desc: 'Professional drivers for all your transportation needs' },
    { icon: '🔩', name: 'Rigger', desc: 'Expert rigging and lifting services' },
    { icon: '🔧', name: 'Fitter', desc: 'Mechanical fitting and assembly work' },
    { icon: '👨‍🍳', name: 'Cook', desc: 'Professional cooking and kitchen services' },
    { icon: '🔧', name: 'Plumber', desc: 'Plumbing repairs, installations & maintenance' },
    { icon: '🪚', name: 'Carpenter', desc: 'Carpentry, furniture & woodwork' },
    { icon: '🎨', name: 'Painter', desc: 'Interior & exterior painting services' },
    { icon: '👷', name: 'Labour', desc: 'General labor for all manual tasks' },
    { icon: '👷‍♂️', name: 'Raj Mistri', desc: 'Supervisor & foreman for construction projects' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {/* Floating Icons - More subtle */}
        <div className="absolute top-20 left-10 text-5xl opacity-5 animate-float-slow">⚡</div>
        <div className="absolute top-40 right-20 text-4xl opacity-5 animate-float-delayed">🔧</div>
        <div className="absolute bottom-40 left-20 text-5xl opacity-5 animate-float-slow">👷</div>
        <div className="absolute bottom-60 right-10 text-5xl opacity-5 animate-float-delayed">🪚</div>
        <div className="absolute top-1/2 left-1/4 text-4xl opacity-5 animate-float-slow">🎨</div>
        <div className="absolute top-1/3 right-1/4 text-5xl opacity-5 animate-float-delayed">💧</div>
        
        {/* Animated Gradient Orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-300 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-blob"></div>
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-blob animation-delay-4000"></div>
      </div>

      {/* Navigation */}
      <nav className="bg-white/90 backdrop-blur-md shadow-sm sticky top-0 z-50 border-b border-gray-200 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Nokariya
              </h1>
              <span className="ml-3 text-sm text-gray-500 hidden sm:inline">Your Trusted Labor Connection Platform</span>
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

      {/* Top Slider Banner - Below Navbar */}
      <div className="relative z-40 bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-600 text-white overflow-hidden">
        <div className="relative h-12 md:h-14 flex items-center">
          {/* Slider Container */}
          <div className="flex w-full h-full relative">
            {allSliderItems.map((item, index) => {
              const content = (
                <div
                  className={`absolute inset-0 flex items-center justify-center gap-3 px-4 transition-all duration-500 ease-in-out ${
                    index === currentSlide
                      ? 'opacity-100 translate-x-0'
                      : index < currentSlide
                      ? 'opacity-0 -translate-x-full'
                      : 'opacity-0 translate-x-full'
                  }`}
                >
                  <span className={`text-2xl md:text-3xl ${item.isAd ? 'animate-pulse' : 'animate-bounce-slow'}`}>
                    {item.icon}
                  </span>
                  <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4">
                    <span className={`font-bold text-sm md:text-base ${item.isAd ? 'text-yellow-200' : ''} whitespace-nowrap`}>
                      {item.title}
                    </span>
                    {item.description && (
                      <>
                        <span className="hidden md:inline text-white/80">•</span>
                        <span className="text-xs md:text-sm text-white/90 text-center md:text-left">{item.description}</span>
                      </>
                    )}
                  </div>
                  {item.isAd && (
                    <span className="ml-2 px-2 py-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded animate-pulse">
                      AD
                    </span>
                  )}
                </div>
              )

              return item.isAd && item.link ? (
                <Link key={index} href={item.link} className="w-full h-full">
                  {content}
                </Link>
              ) : (
                <div key={index}>{content}</div>
              )
            })}
          </div>
          
          {/* Slider Indicators */}
          <div className="absolute right-4 flex gap-2">
            {allSliderItems.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === currentSlide ? 'w-6 bg-white' : 'w-2 bg-white/50'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
        
        {/* Animated Background Stripes */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent animate-slide-right"></div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32 relative z-10">
        <div className="text-center">
          <div className="inline-block mb-6 animate-bounce-slow">
            <span className="bg-gradient-to-r from-primary-100 to-indigo-100 text-primary-700 px-4 py-2 rounded-full text-sm font-semibold inline-flex items-center gap-2">
              <span className="animate-pulse">🚀</span> Fast • <span className="animate-pulse">✅</span> Verified • <span className="animate-pulse">📍</span> Location-Based
            </span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight animate-fade-in-up">
            Find Skilled Workers
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-600 mt-2 animate-gradient">
              Near You Instantly
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-4 max-w-3xl mx-auto leading-relaxed">
            Connect with verified electricians, plumbers, carpenters, drivers, and more
          </p>
          <p className="text-lg text-gray-500 mb-10 max-w-2xl mx-auto">
            Post your requirement, get matched with nearby workers, and get your work done quickly and efficiently
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-slide-up delay-200">
            <Link
              href="/login"
              className="group bg-gradient-to-r from-primary-600 to-indigo-600 text-white px-10 py-4 rounded-xl font-semibold text-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 transform relative overflow-hidden w-full sm:w-auto"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                <span>🔍 Find Workers Now</span>
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-primary-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </Link>
            <Link
              href="/login"
              className="bg-white text-primary-600 px-10 py-4 rounded-xl font-semibold text-lg border-2 border-primary-600 hover:bg-primary-50 transition-all duration-300 hover:scale-105 transform shadow-lg hover:shadow-xl w-full sm:w-auto"
            >
              👷 Join as Worker
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 bg-white/50 rounded-3xl mx-4 mb-20 relative z-10 backdrop-blur-sm">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 animate-fade-in-up">
            How It Works
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto animate-fade-in-up animation-delay-200">
            Simple, fast, and reliable - Get connected with workers in just 3 easy steps
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {/* Step 1 */}
          <div className="group bg-white rounded-2xl shadow-xl p-8 text-center hover:shadow-2xl transition-all duration-300 hover:-translate-y-3 transform border-2 border-transparent hover:border-primary-200 animate-fade-in-up animation-delay-400 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-500/0 via-primary-500/5 to-primary-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
            <div className="bg-gradient-to-br from-primary-100 to-indigo-100 w-24 h-24 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-lg animate-pulse-slow">
              <span className="text-5xl animate-bounce-slow">📝</span>
            </div>
            <div className="bg-primary-600 text-white w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-lg">
              1
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4 group-hover:text-primary-600 transition-colors">
              Post Your Request
            </h3>
            <p className="text-gray-600 leading-relaxed">
              Tell us what type of worker you need, how many, and where. Our smart system will find the perfect matches near you.
            </p>
          </div>

          {/* Step 2 */}
          <div className="group bg-white rounded-2xl shadow-xl p-8 text-center hover:shadow-2xl transition-all duration-300 hover:-translate-y-3 transform border-2 border-transparent hover:border-yellow-200 animate-fade-in-up animation-delay-600 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/0 via-yellow-500/5 to-yellow-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
            <div className="bg-gradient-to-br from-yellow-100 to-orange-100 w-24 h-24 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-lg animate-pulse-slow">
              <span className="text-5xl animate-bounce-slow animation-delay-300">🔔</span>
            </div>
            <div className="bg-yellow-500 text-white w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-lg">
              2
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4 group-hover:text-yellow-600 transition-colors">
              Workers Get Notified
            </h3>
            <p className="text-gray-600 leading-relaxed">
              Available workers in your area receive instant notifications. They can confirm their availability right away.
            </p>
          </div>

          {/* Step 3 */}
          <div className="group bg-white rounded-2xl shadow-xl p-8 text-center hover:shadow-2xl transition-all duration-300 hover:-translate-y-3 transform border-2 border-transparent hover:border-green-200 animate-fade-in-up animation-delay-800 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/0 via-green-500/5 to-green-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
            <div className="bg-gradient-to-br from-green-100 to-emerald-100 w-24 h-24 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-lg animate-pulse-slow">
              <span className="text-5xl animate-bounce-slow animation-delay-600">✅</span>
            </div>
            <div className="bg-green-500 text-white w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-lg">
              3
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4 group-hover:text-green-600 transition-colors">
              Workers Deployed
            </h3>
            <p className="text-gray-600 leading-relaxed">
              Once confirmed, workers are deployed to your location. Track progress and get your work completed efficiently.
            </p>
          </div>
        </div>
      </section>

      {/* Labor Types Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 animate-fade-in-up">
            All Types of Workers Available
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto animate-fade-in-up animation-delay-200">
            From electricians to cooks, we have verified workers for every need
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {laborTypes.map((type, index) => (
            <div
              key={index}
              className="group bg-white border-2 border-gray-200 rounded-2xl p-6 hover:border-primary-400 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 transform cursor-pointer bg-gradient-to-br from-white to-gray-50 relative overflow-hidden animate-fade-in-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500/0 to-indigo-500/0 group-hover:from-primary-500/5 group-hover:to-indigo-500/5 transition-all duration-300"></div>
              <div className="text-6xl mb-4 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300 text-center relative z-10 animate-float-slow" style={{ animationDelay: `${index * 200}ms` }}>
                {type.icon}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2 text-center group-hover:text-primary-600 transition-colors relative z-10">
                {type.name}
              </h3>
              <p className="text-sm text-gray-600 text-center leading-relaxed relative z-10">
                {type.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Why Choose Nokariya?
            </h2>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="bg-primary-100 rounded-lg p-3">
                  <span className="text-2xl">✅</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Verified Workers</h3>
                  <p className="text-gray-600">All workers are verified by our admin team for quality and reliability</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="bg-indigo-100 rounded-lg p-3">
                  <span className="text-2xl">📍</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Location-Based Matching</h3>
                  <p className="text-gray-600">Find workers near you for faster service and lower costs</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="bg-green-100 rounded-lg p-3">
                  <span className="text-2xl">⚡</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Instant Connection</h3>
                  <p className="text-gray-600">Get connected with workers in minutes, not days</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="bg-yellow-100 rounded-lg p-3">
                  <span className="text-2xl">⭐</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Rating System</h3>
                  <p className="text-gray-600">Rate and review workers to help others make informed decisions</p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-primary-50 to-indigo-50 rounded-3xl p-8 lg:p-12 border-2 border-primary-100 relative overflow-hidden animate-fade-in-up animation-delay-400">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-400/10 via-transparent to-indigo-400/10 animate-gradient-shift"></div>
            <div className="text-center relative z-10">
              <div className="text-8xl mb-6 animate-bounce-slow">🎯</div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">Trusted by Thousands</h3>
              <p className="text-xl text-gray-600 mb-8">
                Join our growing community of customers and workers
              </p>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="animate-count-up">
                  <div className="text-3xl font-bold text-primary-600 animate-pulse-slow">1000+</div>
                  <div className="text-sm text-gray-600">Workers</div>
                </div>
                <div className="animate-count-up animation-delay-200">
                  <div className="text-3xl font-bold text-indigo-600 animate-pulse-slow">500+</div>
                  <div className="text-sm text-gray-600">Customers</div>
                </div>
                <div className="animate-count-up animation-delay-400">
                  <div className="text-3xl font-bold text-purple-600 animate-pulse-slow">2000+</div>
                  <div className="text-sm text-gray-600">Jobs Done</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
        <div className="bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-600 rounded-3xl p-12 lg:p-16 text-center text-white shadow-2xl transform hover:scale-[1.02] transition-transform duration-300 relative overflow-hidden animate-fade-in-up">
          <div className="absolute inset-0 bg-black/10"></div>
          {/* Animated gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-600 animate-gradient-shift opacity-75"></div>
          {/* Floating particles */}
          <div className="absolute top-10 left-10 w-3 h-3 bg-white/30 rounded-full animate-float-slow"></div>
          <div className="absolute top-20 right-20 w-2 h-2 bg-white/40 rounded-full animate-float-delayed"></div>
          <div className="absolute bottom-20 left-20 w-4 h-4 bg-white/20 rounded-full animate-float-slow animation-delay-2000"></div>
          <div className="absolute bottom-10 right-10 w-3 h-3 bg-white/30 rounded-full animate-float-delayed animation-delay-4000"></div>
          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-xl md:text-2xl mb-8 opacity-95 max-w-2xl mx-auto">
              Join thousands of customers and workers already using Nokariya to connect and get work done
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/login"
                className="bg-white text-primary-600 px-10 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-all duration-200 hover:scale-110 transform shadow-2xl"
              >
                🚀 Sign Up Now - It's Free!
              </Link>
              <Link
                href="/login"
                className="bg-transparent border-3 border-white text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-white hover:text-primary-600 transition-all duration-200 hover:scale-110 transform"
              >
                🔑 Login to Your Account
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-primary-400 to-indigo-400 bg-clip-text text-transparent mb-4">
                Nokariya
              </h3>
              <p className="text-gray-400">
                Your trusted platform for connecting with skilled workers and getting work done efficiently.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/login" className="hover:text-white transition-colors">Find Workers</Link></li>
                <li><Link href="/login" className="hover:text-white transition-colors">Join as Worker</Link></li>
                <li><Link href="/login" className="hover:text-white transition-colors">Login</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li>📧 support@nokariya.com</li>
                <li>📞 +91 1234567890</li>
                <li>📍 Available 24/7</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-gray-400">
            <p>© 2024 Nokariya. All rights reserved. Made with ❤️ for connecting workers and customers.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
