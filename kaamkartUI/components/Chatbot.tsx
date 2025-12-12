'use client'

import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { apiClient } from '@/lib/api'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface Message {
  id: string
  text: string
  sender: 'user' | 'bot'
  timestamp: Date
  quickReplies?: string[]
}

interface ChatbotProps {
  user?: {
    id: string | number
    role: string
    name: string
  } | null
}

type FlowType = 'none' | 'request' | 'concern'

export default function Chatbot({ user }: ChatbotProps) {
  const { language, t } = useLanguage()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [currentFlow, setCurrentFlow] = useState<FlowType>('none')
  const [requestData, setRequestData] = useState<any>({})
  const [concernData, setConcernData] = useState<any>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMsg = user 
        ? t('chatbot.welcomeUser')?.replace('{name}', user.name) || `Hello ${user.name}! How can I help you today?`
        : t('chatbot.welcome') || 'Hello! I\'m your KaamKart assistant. How can I help you?'
      
      addBotMessage(welcomeMsg)
      setTimeout(() => showQuickReplies(), 800)
    }
  }, [isOpen])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const addMessage = (text: string, sender: 'user' | 'bot', quickReplies?: string[]) => {
    const message: Message = {
      id: Date.now().toString() + Math.random(),
      text,
      sender,
      timestamp: new Date(),
      quickReplies
    }
    setMessages(prev => [...prev, message])
    return message
  }

  const addBotMessage = (text: string, delay: number = 500) => {
    setIsTyping(true)
    setTimeout(() => {
      addMessage(text, 'bot')
      setIsTyping(false)
    }, delay)
  }

  const showQuickReplies = () => {
    if (!user) {
      // Not logged in - show general info options
      addBotMessage(
        t('chatbot.quickReplies') || 'You can ask me:',
        300
      )
      setTimeout(() => {
        addMessage('', 'bot', [
          t('chatbot.quickReplyAbout') || 'What is KaamKart?',
          t('chatbot.quickReplyHowItWorks') || 'How does it work?',
          t('chatbot.quickReplySignUp') || 'How to sign up?',
          t('chatbot.quickReplyHelp') || 'General help'
        ])
      }, 600)
    } else if (user?.role?.toLowerCase() === 'customer') {
      addBotMessage(
        t('chatbot.quickReplies') || 'You can ask me:',
        300
      )
      setTimeout(() => {
        addMessage('', 'bot', [
          t('chatbot.quickReplyCreateRequest') || 'Create a new request',
          t('chatbot.quickReplyRaiseConcern') || 'Raise a concern',
          t('chatbot.quickReplyHelp') || 'How to use KaamKart'
        ])
      }, 600)
    } else if (user?.role?.toLowerCase() === 'worker') {
      addBotMessage(
        t('chatbot.quickReplies') || 'You can ask me:',
        300
      )
      setTimeout(() => {
        addMessage('', 'bot', [
          t('chatbot.quickReplyRaiseConcern') || 'Raise a concern',
          t('chatbot.quickReplyHelp') || 'How to use KaamKart',
          t('chatbot.quickReplyContact') || 'Contact support'
        ])
      }, 600)
    } else if (user?.role?.toLowerCase() === 'admin') {
      addBotMessage(
        t('chatbot.quickReplies') || 'You can ask me:',
        300
      )
      setTimeout(() => {
        addMessage('', 'bot', [
          t('chatbot.quickReplyViewStats') || 'View statistics',
          t('chatbot.quickReplyPendingRequests') || 'Pending requests',
          t('chatbot.quickReplyManageWorkers') || 'Manage workers',
          t('chatbot.quickReplyHelp') || 'Admin help'
        ])
      }, 600)
    } else {
      addBotMessage(
        t('chatbot.quickReplies') || 'You can ask me:',
        300
      )
      setTimeout(() => {
        addMessage('', 'bot', [
          t('chatbot.quickReplyHelp') || 'How to use KaamKart',
          t('chatbot.quickReplyContact') || 'Contact support'
        ])
      }, 600)
    }
  }

  const handleQuickReply = async (reply: string) => {
    addMessage(reply, 'user')
    
    if (reply.includes('Create') || reply.includes('create') || reply.includes('request') || reply.includes('नया अनुरोध')) {
      if (!user || user.role?.toLowerCase() !== 'customer') {
        addBotMessage(t('chatbot.loginRequired') || 'Please login as a customer to create requests.')
        if (!user) {
          setTimeout(() => {
            addBotMessage(t('chatbot.loginPrompt') || 'Would you like to sign up or login? Type "sign up" or "login" to get started!')
          }, 1000)
        }
        return
      }
      startRequestFlow()
    } else if (reply.includes('Concern') || reply.includes('concern') || reply.includes('चिंता')) {
      if (!user || (user.role?.toLowerCase() !== 'customer' && user.role?.toLowerCase() !== 'worker')) {
        addBotMessage(t('chatbot.loginRequired') || 'Please login as a customer or worker to raise concerns.')
        if (!user) {
          setTimeout(() => {
            addBotMessage(t('chatbot.loginPrompt') || 'Would you like to sign up or login? Type "sign up" or "login" to get started!')
          }, 1000)
        }
        return
      }
      startConcernFlow()
    } else if (reply.includes('About') || reply.includes('about') || reply.includes('क्या है') || reply.includes('कामकार्ट')) {
      showAboutKaamKart()
    } else if (reply.includes('How') && reply.includes('work') || reply.includes('कैसे काम')) {
      showHowItWorks()
    } else if (reply.includes('Sign up') || reply.includes('sign up') || reply.includes('साइन अप') || reply.includes('रजिस्टर')) {
      showSignUpInfo()
    } else if (reply.includes('Stats') || reply.includes('stats') || reply.includes('statistics') || reply.includes('आंकड़े')) {
      if (user?.role?.toLowerCase() === 'admin') {
        showAdminStats()
      } else {
        addBotMessage(t('chatbot.adminOnly') || 'This feature is only available for admins.')
      }
    } else if (reply.includes('Pending') || reply.includes('pending') || reply.includes('लंबित')) {
      if (user?.role?.toLowerCase() === 'admin') {
        showPendingRequests()
      } else {
        addBotMessage(t('chatbot.adminOnly') || 'This feature is only available for admins.')
      }
    } else if (reply.includes('Manage') || reply.includes('manage') || reply.includes('Workers') || reply.includes('workers') || reply.includes('कर्मचारी')) {
      if (user?.role?.toLowerCase() === 'admin') {
        showManageWorkers()
      } else {
        addBotMessage(t('chatbot.adminOnly') || 'This feature is only available for admins.')
      }
    } else if (reply.includes('Help') || reply.includes('help') || reply.includes('मदद')) {
      showHelp()
    } else {
      handleUserMessage(reply)
    }
  }

  const startRequestFlow = () => {
    setCurrentFlow('request')
    setRequestData({})
    addBotMessage(t('chatbot.requestFlowStart') || 'Great! Let\'s create a request. What type of work do you need? (e.g., Plumbing, Electrical, Cleaning, Construction)')
  }

  const startConcernFlow = () => {
    setCurrentFlow('concern')
    setConcernData({})
    addBotMessage(t('chatbot.concernFlowStart') || 'I can help you raise a concern. What type of concern is this?\n\n1. Work Quality\n2. Payment Issue\n3. Behavior\n4. Safety\n5. Other\n\nPlease type the number or name.')
  }

  const handleRequestFlow = async (userInput: string) => {
    const step = getRequestStep()
    
    switch (step) {
      case 'workType':
        setRequestData({ ...requestData, workType: userInput })
        addBotMessage(t('chatbot.requestFlowWorkerTypes') || 'What type of workers do you need? (e.g., Plumber, Electrician, Cleaner). You can mention multiple types separated by commas.')
        break

      case 'workerTypes':
        const workerTypes = userInput.split(',').map(t => t.trim()).filter(t => t)
        setRequestData({ ...requestData, workerTypes })
        addBotMessage(t('chatbot.requestFlowWorkerCount') || 'How many workers do you need for each type? (e.g., "2 plumbers, 1 electrician")')
        break

      case 'workerCount':
        // Parse worker counts
        setRequestData({ ...requestData, workerCountText: userInput })
        addBotMessage(t('chatbot.requestFlowDates') || 'When do you need the work done?\n\nPlease provide:\n- Start date (YYYY-MM-DD format, e.g., 2024-12-20)\n- End date (YYYY-MM-DD format, e.g., 2024-12-25)\n\nFormat: StartDate, EndDate')
        break

      case 'dates':
        const dates = userInput.split(',').map(d => d.trim())
        if (dates.length === 2) {
          setRequestData({ ...requestData, startDate: dates[0], endDate: dates[1] })
          addBotMessage(t('chatbot.requestFlowLocation') || 'Please provide your location. You can either:\n1. Type "use current location" to use your GPS location\n2. Type your address (State, City, Pin Code, Area)')
        } else {
          addBotMessage(t('chatbot.requestFlowDatesError') || 'Please provide both start and end dates in format: YYYY-MM-DD, YYYY-MM-DD\n\nExample: 2024-12-20, 2024-12-25')
        }
        break

      case 'location':
        if (userInput.toLowerCase().includes('current') || userInput.toLowerCase().includes('gps') || userInput.toLowerCase().includes('location')) {
          setRequestData({ ...requestData, useCurrentLocation: true, optionalFieldsAsked: false })
          addBotMessage(t('chatbot.requestFlowOptionalFields') || 'Great! Now, would you like to add any optional details?\n\nYou can provide:\n- Landmark (e.g., "Near City Mall")\n- Area (e.g., "Downtown Area")\n- Or type "skip" to proceed without optional details')
        } else {
          setRequestData({ ...requestData, location: userInput, useCurrentLocation: false, optionalFieldsAsked: false })
          addBotMessage(t('chatbot.requestFlowOptionalFields') || 'Great! Now, would you like to add any optional details?\n\nYou can provide:\n- Landmark (e.g., "Near City Mall")\n- Area (e.g., "Downtown Area")\n- Or type "skip" to proceed without optional details')
        }
        break

      case 'optionalFields':
        setRequestData({ ...requestData, optionalFieldsAsked: true })
        if (userInput.toLowerCase().includes('skip') || userInput.toLowerCase().trim() === '') {
          addBotMessage(t('chatbot.requestFlowConfirm') || `Please confirm your request:\n\nWork Type: ${requestData.workType}\nWorker Types: ${requestData.workerTypes?.join(', ')}\nDates: ${requestData.startDate} to ${requestData.endDate}\nLocation: ${requestData.location || 'Current Location'}\n\nType "confirm" to proceed to dashboard or "cancel" to start over.`)
        } else {
          // Try to parse landmark and area from user input
          const lowerInput = userInput.toLowerCase()
          let landmark = ''
          let area = ''
          
          // Simple parsing - look for keywords
          if (lowerInput.includes('landmark') || lowerInput.includes('near') || lowerInput.includes('beside')) {
            const landmarkMatch = userInput.match(/(?:landmark|near|beside)[:\s]+(.+?)(?:\s+area|$)/i)
            if (landmarkMatch) {
              landmark = landmarkMatch[1].trim()
            }
          }
          if (lowerInput.includes('area')) {
            const areaMatch = userInput.match(/area[:\s]+(.+)/i)
            if (areaMatch) {
              area = areaMatch[1].trim()
            }
          }
          
          // If no specific keywords, treat as landmark
          if (!landmark && !area) {
            landmark = userInput.trim()
          }
          
          setRequestData({ 
            ...requestData, 
            landmark: landmark || requestData.landmark,
            area: area || requestData.area
          })
          addBotMessage(t('chatbot.requestFlowConfirm') || `Please confirm your request:\n\nWork Type: ${requestData.workType}\nWorker Types: ${requestData.workerTypes?.join(', ')}\nDates: ${requestData.startDate} to ${requestData.endDate}\nLocation: ${requestData.location || 'Current Location'}\nLandmark: ${landmark || 'None'}\nArea: ${area || 'None'}\n\nType "confirm" to proceed to dashboard or "cancel" to start over.`)
        }
        break

      case 'confirm':
        if (userInput.toLowerCase().includes('confirm') || userInput.toLowerCase().includes('yes') || userInput.toLowerCase().includes('हाँ')) {
          navigateToRequestForm()
        } else {
          setCurrentFlow('none')
          setRequestData({})
          addBotMessage(t('chatbot.requestFlowCancelled') || 'Request cancelled. How can I help you?')
          setTimeout(() => showQuickReplies(), 1000)
        }
        break
    }
  }

  const handleConcernFlow = async (userInput: string) => {
    const step = getConcernStep()
    
    switch (step) {
      case 'type':
        let concernType = 'OTHER'
        const lowerInput = userInput.toLowerCase()
        if (lowerInput.includes('1') || lowerInput.includes('quality') || lowerInput.includes('work quality')) {
          concernType = 'WORK_QUALITY'
        } else if (lowerInput.includes('2') || lowerInput.includes('payment')) {
          concernType = 'PAYMENT_ISSUE'
        } else if (lowerInput.includes('3') || lowerInput.includes('behavior')) {
          concernType = 'BEHAVIOR'
        } else if (lowerInput.includes('4') || lowerInput.includes('safety')) {
          concernType = 'SAFETY'
        } else if (lowerInput.includes('5') || lowerInput.includes('other')) {
          concernType = 'OTHER'
        }
        
        setConcernData({ ...concernData, type: concernType })
        addBotMessage(t('chatbot.concernFlowDescription') || 'Please describe your concern in detail. What happened and how can we help?')
        break

      case 'description':
        setConcernData({ ...concernData, description: userInput })
        addBotMessage(t('chatbot.concernFlowConfirm') || `Please confirm:\n\nConcern Type: ${concernData.type}\nDescription: ${userInput}\n\nType "confirm" to proceed to dashboard or "cancel" to start over.`)
        break

      case 'confirm':
        if (userInput.toLowerCase().includes('confirm') || userInput.toLowerCase().includes('yes')) {
          navigateToConcernForm()
        } else {
          setCurrentFlow('none')
          setConcernData({})
          addBotMessage(t('chatbot.concernFlowCancelled') || 'Concern cancelled. How can I help you?')
          setTimeout(() => showQuickReplies(), 1000)
        }
        break
    }
  }

  const getRequestStep = (): string => {
    if (!requestData.workType) return 'workType'
    if (!requestData.workerTypes) return 'workerTypes'
    if (!requestData.workerCountText) return 'workerCount'
    if (!requestData.startDate || !requestData.endDate) return 'dates'
    if (!requestData.location && !requestData.useCurrentLocation) return 'location'
    if (requestData.optionalFieldsAsked === undefined) return 'optionalFields'
    return 'confirm'
  }

  const getConcernStep = (): string => {
    if (!concernData.type) return 'type'
    if (!concernData.description) return 'description'
    return 'confirm'
  }

  const navigateToRequestForm = () => {
    addBotMessage(t('chatbot.navigatingToDashboard') || 'Redirecting you to the request form...')
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        // Store request data in sessionStorage with all optional fields
        const requestDataToStore = {
          ...requestData,
          landmark: requestData.landmark || '',
          area: requestData.area || '',
          state: requestData.state || '',
          city: requestData.city || '',
          pinCode: requestData.pinCode || ''
        }
        sessionStorage.setItem('chatbotRequestData', JSON.stringify(requestDataToStore))
        router.push('/customer/dashboard?action=createRequest')
      }
    }, 1500)
  }

  const navigateToConcernForm = () => {
    addBotMessage(t('chatbot.navigatingToDashboard') || 'Redirecting you to the concern form...')
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        // Store concern data in sessionStorage
        sessionStorage.setItem('chatbotConcernData', JSON.stringify(concernData))
        // Navigate to appropriate dashboard based on user role
        if (user?.role?.toLowerCase() === 'customer') {
          router.push('/customer/dashboard?action=raiseConcern')
        } else if (user?.role?.toLowerCase() === 'worker') {
          router.push('/worker/dashboard?action=raiseConcern')
        }
      }
    }, 1500)
  }

  const showAdminStats = async () => {
    try {
      addBotMessage(t('chatbot.fetchingStats') || 'Fetching statistics...')
      // Calculate stats from available data or use a simple message
      const statsText = t('chatbot.adminStats')?.replace('{pending}', '?')
        ?.replace('{active}', '?')
        ?.replace('{workers}', '?')
        ?.replace('{customers}', '?')
        ?.replace('{concerns}', '?')
        || `📊 Statistics:\n\n• Pending Requests: Check dashboard\n• Active Requests: Check dashboard\n• Total Workers: Check dashboard\n• Total Customers: Check dashboard\n• Pending Concerns: Check dashboard\n\nVisit your dashboard for detailed information.`
      
      addBotMessage(statsText)
    } catch (error: any) {
      addBotMessage(t('chatbot.statsError') || 'Could not fetch statistics. Please try again later.')
    }
  }

  const showPendingRequests = () => {
    addBotMessage(t('chatbot.navigatingToDashboard') || 'Taking you to pending requests...')
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        router.push('/admin/dashboard?tab=pending')
      }
    }, 1000)
  }

  const showManageWorkers = () => {
    addBotMessage(t('chatbot.navigatingToDashboard') || 'Taking you to workers management...')
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        router.push('/admin/dashboard?tab=workers')
      }
    }, 1000)
  }

  const showHelp = () => {
    const helpText = user?.role?.toLowerCase() === 'customer'
      ? t('chatbot.helpCustomer') || 'As a customer, you can:\n\n1. Create work requests\n2. Track your requests\n3. Rate workers after completion\n4. Raise concerns if needed\n\nType "create request" to start a new request or "raise concern" for any issues.'
      : user?.role?.toLowerCase() === 'worker'
      ? t('chatbot.helpWorker') || 'As a worker, you can:\n\n1. Browse available requests\n2. Apply for jobs\n3. Update your availability\n4. Track your work history\n5. Raise concerns if needed\n\nVisit your dashboard to get started!'
      : user?.role?.toLowerCase() === 'admin'
      ? t('chatbot.helpAdmin') || 'As an admin, you can:\n\n1. Approve/reject customer requests\n2. Manage worker verifications\n3. Deploy workers to jobs\n4. Manage concerns and issues\n5. View statistics and reports\n6. Manage worker types and advertisements\n\nType "view stats" for statistics or "pending requests" to see pending items.'
      : t('chatbot.helpGeneral') || 'KaamKart connects customers with skilled workers.\n\n• Customers can post work requests\n• Workers can apply for jobs\n• Secure and reliable service\n\nSign up to get started!'
    
    addBotMessage(helpText)
    setTimeout(() => showQuickReplies(), 2000)
  }

  const showAboutKaamKart = () => {
    const aboutText = t('chatbot.aboutKaamKart') || 'KaamKart is a platform that connects customers with skilled workers.\n\n✨ Key Features:\n• Verified workers only\n• Location-based matching\n• Instant notifications\n• Rating and review system\n• Secure payment processing\n• 24/7 customer support\n\nWhether you need a plumber, electrician, cleaner, or any other service, KaamKart helps you find the right worker quickly and easily!'
    addBotMessage(aboutText)
    setTimeout(() => {
      if (!user) {
        addBotMessage(t('chatbot.signUpPrompt') || 'Ready to get started? Type "sign up" to create an account or "login" if you already have one!')
      }
    }, 2500)
  }

  const showHowItWorks = () => {
    const howItWorksText = t('chatbot.howItWorks') || 'Here\'s how KaamKart works:\n\n📝 Step 1: Create a Request\nTell us what type of worker you need, how many, and where. Our smart system will find the perfect matches near you.\n\n🔔 Step 2: Workers Get Notified\nAvailable workers in your area receive instant notifications. They can confirm their availability right away.\n\n✅ Step 3: Workers Deployed\nOnce confirmed, workers are deployed to your location. Track progress and get your work completed efficiently.\n\n⭐ Step 4: Rate & Review\nAfter completion, rate and review the workers to help others make informed decisions.'
    addBotMessage(howItWorksText)
    setTimeout(() => {
      if (!user) {
        addBotMessage(t('chatbot.signUpPrompt') || 'Ready to get started? Type "sign up" to create an account!')
      }
    }, 3000)
  }

  const showSignUpInfo = () => {
    const signUpText = t('chatbot.signUpInfo') || 'To sign up for KaamKart:\n\n1. Click on "Login" or "Get Started" button on the homepage\n2. Choose your role: Customer or Worker\n3. Fill in your details (name, email, phone)\n4. For workers: Select your worker types\n5. Complete registration\n\nOnce registered:\n• Customers can start creating requests immediately\n• Workers need admin verification before receiving job notifications\n\nType "login" if you already have an account, or visit the login page to get started!'
    addBotMessage(signUpText)
    setTimeout(() => {
      addBotMessage(t('chatbot.navigateToLogin') || 'Would you like me to take you to the login page? Type "yes" to navigate there.')
    }, 2000)
  }

  const handleUserMessage = async (text: string) => {
    if (currentFlow === 'request') {
      await handleRequestFlow(text)
    } else if (currentFlow === 'concern') {
      await handleConcernFlow(text)
    } else {
      // Simple intent detection
      const lowerText = text.toLowerCase()
      
      if (lowerText.includes('hello') || lowerText.includes('hi') || lowerText.includes('hey') || lowerText.includes('नमस्ते')) {
        addBotMessage(t('chatbot.greeting') || 'Hello! How can I help you today?')
        setTimeout(() => showQuickReplies(), 1000)
      } else if (lowerText.includes('help') || lowerText.includes('मदद')) {
        showHelp()
      } else if (lowerText.includes('about') || lowerText.includes('क्या है') || lowerText.includes('कामकार्ट')) {
        showAboutKaamKart()
      } else if ((lowerText.includes('how') && lowerText.includes('work')) || lowerText.includes('कैसे काम')) {
        showHowItWorks()
      } else if (lowerText.includes('sign up') || lowerText.includes('register') || lowerText.includes('साइन अप') || lowerText.includes('रजिस्टर')) {
        showSignUpInfo()
      } else if (lowerText.includes('login') || lowerText.includes('लॉगिन')) {
        if (typeof window !== 'undefined') {
          addBotMessage(t('chatbot.navigatingToLogin') || 'Taking you to the login page...')
          setTimeout(() => {
            window.location.href = '/login'
          }, 1500)
        }
      } else if (lowerText.includes('yes') && messages[messages.length - 2]?.text.includes('login page')) {
        if (typeof window !== 'undefined') {
          addBotMessage(t('chatbot.navigatingToLogin') || 'Taking you to the login page...')
          setTimeout(() => {
            window.location.href = '/login'
          }, 1500)
        }
      } else if (lowerText.includes('request') || lowerText.includes('create') || lowerText.includes('अनुरोध')) {
        if (user?.role?.toLowerCase() === 'customer') {
          startRequestFlow()
        } else {
          addBotMessage(t('chatbot.loginRequired') || 'Please login as a customer to create requests.')
          if (!user) {
            setTimeout(() => {
              addBotMessage(t('chatbot.loginPrompt') || 'Would you like to sign up or login? Type "sign up" or "login" to get started!')
            }, 1000)
          }
        }
      } else if (lowerText.includes('concern') || lowerText.includes('issue') || lowerText.includes('problem') || lowerText.includes('चिंता')) {
        if (user?.role?.toLowerCase() === 'customer' || user?.role?.toLowerCase() === 'worker') {
          startConcernFlow()
        } else {
          addBotMessage(t('chatbot.loginRequired') || 'Please login as a customer or worker to raise concerns.')
          if (!user) {
            setTimeout(() => {
              addBotMessage(t('chatbot.loginPrompt') || 'Would you like to sign up or login? Type "sign up" or "login" to get started!')
            }, 1000)
          }
        }
      } else if (lowerText.includes('stats') || lowerText.includes('statistics') || lowerText.includes('आंकड़े')) {
        if (user?.role?.toLowerCase() === 'admin') {
          showAdminStats()
        } else {
          addBotMessage(t('chatbot.adminOnly') || 'This feature is only available for admins.')
        }
      } else if (lowerText.includes('pending') || lowerText.includes('लंबित')) {
        if (user?.role?.toLowerCase() === 'admin') {
          showPendingRequests()
        } else {
          addBotMessage(t('chatbot.adminOnly') || 'This feature is only available for admins.')
        }
      } else if (lowerText.includes('manage') && lowerText.includes('worker') || lowerText.includes('कर्मचारी')) {
        if (user?.role?.toLowerCase() === 'admin') {
          showManageWorkers()
        } else {
          addBotMessage(t('chatbot.adminOnly') || 'This feature is only available for admins.')
        }
      } else {
        addBotMessage(t('chatbot.defaultResponse') || 'I\'m here to help! You can ask me about:\n\n• Creating requests\n• Raising concerns\n• General help\n\nType "help" for more options or use the quick replies below.')
        setTimeout(() => showQuickReplies(), 1500)
      }
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || isTyping) return

    const userMessage = inputValue.trim()
    addMessage(userMessage, 'user')
    setInputValue('')
    
    await handleUserMessage(userMessage)
  }

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-full p-4 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 transform"
        aria-label="Open chat"
        lang={language}
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col border-2 border-primary-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-600 to-indigo-600 text-white p-4 rounded-t-2xl flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg" lang={language}>{t('chatbot.title') || 'KaamKart Assistant'}</h3>
              <p className="text-xs opacity-90" lang={language}>{t('chatbot.subtitle') || 'We\'re here to help!'}</p>
            </div>
            <button
              onClick={() => {
                setIsOpen(false)
                setCurrentFlow('none')
                setRequestData({})
                setConcernData({})
              }}
              className="text-white hover:text-gray-200 transition-colors"
              aria-label="Close chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div key={message.id}>
                <div
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      message.sender === 'user'
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                    lang={language}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                {/* Quick Replies */}
                {message.quickReplies && message.quickReplies.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {message.quickReplies.map((reply, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleQuickReply(reply)}
                        className="text-left px-4 py-2 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors text-sm w-full"
                        lang={language}
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl px-4 py-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-4 border-t border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={t('chatbot.inputPlaceholder') || 'Type your message...'}
                className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                lang={language}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isTyping}
                className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

