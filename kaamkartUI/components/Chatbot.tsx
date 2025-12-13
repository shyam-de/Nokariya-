'use client'

import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { apiClient } from '@/lib/api'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { getLocationFromPinCode } from '@/lib/indianLocationValidation'

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
  adminStats?: {
    pendingRequests?: number
    activeRequests?: number
    totalWorkers?: number
    totalCustomers?: number
    pendingConcerns?: number
  }
}

type FlowType = 'none' | 'request' | 'concern'

export default function Chatbot({ user, adminStats }: ChatbotProps) {
  const { language, t } = useLanguage()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [currentFlow, setCurrentFlow] = useState<FlowType>('none')
  const [requestData, setRequestData] = useState<any>({})
  const [concernData, setConcernData] = useState<any>({})
  const [conversationContext, setConversationContext] = useState<string[]>([])
  const [retryCount, setRetryCount] = useState<{[key: string]: number}>({})
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
      // Add to conversation context
      setConversationContext(prev => [...prev.slice(-4), `bot: ${text}`])
    }, delay)
  }

  // Natural language date parser
  const parseNaturalDate = (input: string): string | null => {
    const lower = input.toLowerCase().trim()
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const nextWeek = new Date(today)
    nextWeek.setDate(nextWeek.getDate() + 7)
    
    // Handle relative dates
    if (lower.includes('today') || lower.includes('अभी') || lower.includes('आज')) {
      return formatDate(today)
    }
    if (lower.includes('tomorrow') || lower.includes('कल')) {
      return formatDate(tomorrow)
    }
    if (lower.includes('next week') || lower.includes('अगले सप्ताह')) {
      return formatDate(nextWeek)
    }
    
    // Try to parse YYYY-MM-DD format
    const dateMatch = input.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (dateMatch) {
      const year = parseInt(dateMatch[1])
      const month = parseInt(dateMatch[2])
      const day = parseInt(dateMatch[3])
      const date = new Date(year, month - 1, day)
      if (!isNaN(date.getTime())) {
        return formatDate(date)
      }
    }
    
    // Try DD/MM/YYYY or DD-MM-YYYY
    const altDateMatch = input.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
    if (altDateMatch) {
      const day = parseInt(altDateMatch[1])
      const month = parseInt(altDateMatch[2])
      const year = parseInt(altDateMatch[3])
      const date = new Date(year, month - 1, day)
      if (!isNaN(date.getTime())) {
        return formatDate(date)
      }
    }
    
    return null
  }

  const formatDate = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Intelligent intent detection
  const detectIntent = (text: string): string => {
    const lower = text.toLowerCase()
    
    // Greetings
    if (lower.match(/\b(hi|hello|hey|namaste|namaskar|good morning|good afternoon|good evening)\b/)) {
      return 'greeting'
    }
    
    // Request creation
    if (lower.match(/\b(create|new|post|need|want|require|looking for|find|book|hire|get)\b.*\b(request|work|job|service|worker|help|assistant|person)\b/)) {
      return 'create_request'
    }
    
    // Concern raising
    if (lower.match(/\b(concern|issue|problem|complaint|report|wrong|bad|not good|disappointed|unhappy)\b/)) {
      return 'raise_concern'
    }
    
    // Status check
    if (lower.match(/\b(status|update|progress|where|what|how|when)\b.*\b(request|work|job|application)\b/)) {
      return 'check_status'
    }
    
    // Help
    if (lower.match(/\b(help|how|what|explain|guide|tutorial|assist|support)\b/)) {
      return 'help'
    }
    
    // About
    if (lower.match(/\b(what|about|tell|explain|information|info)\b.*\b(kaamkart|platform|service|company)\b/)) {
      return 'about'
    }
    
    // Cancel/Stop
    if (lower.match(/\b(cancel|stop|no|nevermind|forget|ignore|skip)\b/)) {
      return 'cancel'
    }
    
    // Confirmation
    if (lower.match(/\b(yes|yeah|yep|sure|ok|okay|confirm|proceed|continue|go ahead|हाँ|ठीक)\b/)) {
      return 'confirm'
    }
    
    return 'unknown'
  }

  // Generate empathetic response
  const getEmpatheticResponse = (situation: string): string => {
    const responses: {[key: string]: string[]} = {
      error: language === 'hi' 
        ? [
            "मैं समझता हूँ कि यह निराशाजनक हो सकता है। मैं आपकी मदद करता हूँ।",
            "कोई बात नहीं! आइए एक अलग तरीके से कोशिश करते हैं।",
            "ठीक है, मैं आपको कदम दर कदम मार्गदर्शन करता हूँ।"
          ]
        : [
            "I understand that can be frustrating. Let me help you with that.",
            "No worries! Let's try a different approach.",
            "That's okay, let me guide you through this step by step."
          ],
      success: language === 'hi'
        ? [
            "बढ़िया! यह सही है।",
            "उत्कृष्ट! आगे बढ़ते हैं।",
            "परफेक्ट! चलिए जारी रखते हैं।"
          ]
        : [
            "Great! That's perfect.",
            "Excellent! Moving forward.",
            "Perfect! Let's continue."
          ],
      confusion: language === 'hi'
        ? [
            "मैं देख रहा हूँ कि आप अनिश्चित हो सकते हैं। मैं आपके लिए इसे स्पष्ट करता हूँ।",
            "कोई समस्या नहीं! मैं इसे बेहतर तरीके से समझाता हूँ।",
            "मैं भ्रम को समझता हूँ। यहाँ मेरा मतलब था..."
          ]
        : [
            "I see you might be unsure. Let me clarify that for you.",
            "No problem! Let me explain that better.",
            "I understand the confusion. Here's what I meant..."
          ]
    }
    const options = responses[situation] || responses.error
    return options[Math.floor(Math.random() * options.length)]
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
          t('chatbot.quickReplyContact') || 'Contact support',
          t('chatbot.quickReplyHelp') || 'How to use KaamKart'
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
    } else if (reply.includes('Contact') || reply.includes('contact') || reply.includes('support') || reply.includes('सहायता') || reply.includes('संपर्क')) {
      // Contact support should trigger concern flow
      if (!user || (user.role?.toLowerCase() !== 'customer' && user.role?.toLowerCase() !== 'worker')) {
        addBotMessage(t('chatbot.loginRequired') || 'Please login as a customer or worker to contact support.')
        if (!user) {
          setTimeout(() => {
            addBotMessage(t('chatbot.loginPrompt') || 'Would you like to sign up or login? Type "sign up" or "login" to get started!')
          }, 1000)
        }
        return
      }
      addBotMessage(t('chatbot.contactSupportMessage') || 'I\'m here to help! Let me guide you through raising a concern so we can assist you better.')
      setTimeout(() => {
        startConcernFlow()
      }, 1000)
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
    setRetryCount({})
    const greetings = [
      "Great! I'd be happy to help you create a request. What type of work do you need?",
      "Perfect! Let's get started. What kind of work are you looking for?",
      "Awesome! To help you find the right workers, what type of work do you need done?"
    ]
    const examples = language === 'hi' 
      ? "उदाहरण: प्लंबिंग, इलेक्ट्रिकल, क्लीनिंग, कंस्ट्रक्शन"
      : "For example: Plumbing, Electrical, Cleaning, Construction, Painting, etc."
    addBotMessage(`${greetings[Math.floor(Math.random() * greetings.length)]}\n\n${examples}`)
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
        if (userInput.trim().length < 2) {
          addBotMessage(getEmpatheticResponse('confusion') + " Could you please provide more details about the type of work? For example: 'plumbing', 'electrical work', 'house cleaning', etc.")
          return
        }
        setRequestData({ ...requestData, workType: userInput })
        const workerTypePrompts = [
          "Got it! What type of workers do you need for this work?",
          "Perfect! Now, which workers would you like?",
          "Great! What kind of workers are you looking for?"
        ]
        addBotMessage(`${workerTypePrompts[Math.floor(Math.random() * workerTypePrompts.length)]}\n\nYou can mention multiple types like: "Plumber, Electrician" or just one type.`)
        break

      case 'workerTypes':
        const workerTypes = userInput.split(',').map(t => t.trim()).filter(t => t)
        setRequestData({ ...requestData, workerTypes })
        addBotMessage(t('chatbot.requestFlowWorkerCount') || 'How many workers do you need for each type? (e.g., "2 plumbers, 1 electrician")')
        break

      case 'workerCount':
        // Parse worker counts more intelligently
        const countMatch = userInput.match(/(\d+)\s*([a-zA-Z\s]+)/g)
        if (!countMatch && !userInput.match(/\d+/)) {
          addBotMessage(getEmpatheticResponse('confusion') + " I need to know how many workers you need. For example: '2 plumbers' or '1 electrician and 2 cleaners'. Could you provide that?")
          return
        }
        setRequestData({ ...requestData, workerCountText: userInput })
        const datePrompts = [
          "Perfect! When do you need this work done?",
          "Great! What are your preferred dates?",
          "Excellent! When would you like the work to start and end?"
        ]
        addBotMessage(`${datePrompts[Math.floor(Math.random() * datePrompts.length)]}\n\nYou can say:\n• "Today to tomorrow"\n• "2024-12-20 to 2024-12-25"\n• "Next week"\n• Or any date format you prefer!`)
        break

      case 'dates':
        // Try natural language parsing first
        let startDate: string | null = null
        let endDate: string | null = null
        
        // Try to parse natural language dates
        const naturalStart = parseNaturalDate(userInput)
        if (naturalStart) {
          startDate = naturalStart
          // Default end date to 7 days after start
          const end = new Date(naturalStart)
          end.setDate(end.getDate() + 7)
          endDate = formatDate(end)
        } else {
          // Try comma-separated dates
          const dates = userInput.split(',').map(d => d.trim())
          if (dates.length >= 2) {
            startDate = parseNaturalDate(dates[0]) || dates[0]
            endDate = parseNaturalDate(dates[1]) || dates[1]
          } else if (dates.length === 1) {
            startDate = parseNaturalDate(dates[0]) || dates[0]
            // If only one date provided, ask for end date
            if (startDate && !endDate) {
              addBotMessage(getEmpatheticResponse('confusion') + ` I see you mentioned ${startDate} as the start date. When would you like the work to end?`)
              return
            }
          } else {
            // Try to extract dates from the text
            const datePattern = /(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/g
            const foundDates = userInput.match(datePattern)
            if (foundDates && foundDates.length >= 2) {
              startDate = parseNaturalDate(foundDates[0]) || foundDates[0]
              endDate = parseNaturalDate(foundDates[1]) || foundDates[1]
            } else if (foundDates && foundDates.length === 1) {
              startDate = parseNaturalDate(foundDates[0]) || foundDates[0]
              addBotMessage(getEmpatheticResponse('confusion') + ` I found a start date: ${startDate}. When would you like the work to end?`)
              return
            }
          }
        }
        
        if (startDate && endDate) {
          // Validate dates
          const start = new Date(startDate)
          const end = new Date(endDate)
          if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            addBotMessage(getEmpatheticResponse('error') + " I couldn't understand those dates. Could you try again? For example: '2024-12-20 to 2024-12-25' or 'today to tomorrow'")
            return
          }
          if (end < start) {
            addBotMessage(getEmpatheticResponse('confusion') + " It looks like the end date is before the start date. Could you check and provide the correct dates?")
            return
          }
          
          setRequestData({ ...requestData, startDate, endDate })
          const locationPrompts = [
            "Perfect! Now, where do you need the work done?",
            "Great! What's the location for this work?",
            "Excellent! Where should the workers come?"
          ]
          addBotMessage(`${locationPrompts[Math.floor(Math.random() * locationPrompts.length)]}\n\nYou can:\n• Type "use current location" or "my location" for GPS\n• Or type your address`)
        } else {
          const stepKey = 'dates'
          const count = (retryCount[stepKey] || 0) + 1
          setRetryCount({ ...retryCount, [stepKey]: count })
          
          if (count === 1) {
            addBotMessage(getEmpatheticResponse('confusion') + " I need both a start date and end date. You can say:\n• '2024-12-20 to 2024-12-25'\n• 'Today to tomorrow'\n• 'Next week'\n\nWhat dates work for you?")
          } else {
            addBotMessage("Let me help you with the format. Please provide dates like:\n• Start: 2024-12-20, End: 2024-12-25\n• Or: 'today to next week'\n\nWhat are your preferred dates?")
          }
        }
        break

      case 'location':
        const lowerLocation = userInput.toLowerCase()
        if (lowerLocation.includes('current') || lowerLocation.includes('gps') || lowerLocation.includes('my location') || lowerLocation.includes('here')) {
          setRequestData({ ...requestData, useCurrentLocation: true, optionalFieldsAsked: false })
          addBotMessage("Perfect! I'll use your current location. Would you like to add any additional details to help workers find you easily?\n\nOptional details:\n• Landmark (e.g., 'Near City Mall')\n• Area (e.g., 'Downtown')\n• State, City, Pin Code\n\nOr just type 'skip' to continue!")
        } else {
          // Check if user provided a pin code (6 digits)
          const pinCodeMatch = userInput.match(/\b(\d{6})\b/)
          if (pinCodeMatch) {
            const pinCode = pinCodeMatch[1]
            addBotMessage("I see you provided a pin code. Let me fetch the location details...")
            setIsTyping(true)
            try {
              const locationData = await getLocationFromPinCode(pinCode)
              if (locationData) {
                setRequestData({ 
                  ...requestData, 
                  location: locationData.address,
                  pinCode: pinCode,
                  state: locationData.state,
                  city: locationData.city,
                  useCurrentLocation: false,
                  optionalFieldsAsked: false
                })
                setIsTyping(false)
                addBotMessage(`Perfect! I've detected your location from pin code ${pinCode}:\n\n📍 Address: ${locationData.address}\n🏙️ City: ${locationData.city}\n🗺️ State: ${locationData.state}\n\nWould you like to add any additional details?\n\nOptional:\n• Landmark (e.g., 'Near City Mall')\n• Area\n\nOr type 'skip' to proceed!`)
              } else {
                setIsTyping(false)
                addBotMessage(getEmpatheticResponse('error') + ` I couldn't find location details for pin code ${pinCode}. Could you provide the full address instead?`)
              }
            } catch (error) {
              setIsTyping(false)
              addBotMessage(getEmpatheticResponse('error') + " I had trouble fetching location from the pin code. Could you provide the full address instead?")
            }
          } else if (userInput.trim().length < 5) {
            addBotMessage(getEmpatheticResponse('confusion') + " That seems too short for an address. Could you provide:\n• A full address (e.g., '123 Main Street, Mumbai')\n• A 6-digit pin code\n• Or type 'use current location' for GPS")
          } else {
            setRequestData({ ...requestData, location: userInput, useCurrentLocation: false, optionalFieldsAsked: false })
            addBotMessage("Great! I've noted your location. Would you like to add any additional details to help workers find you?\n\nOptional:\n• Landmark (e.g., 'Near City Mall')\n• Area, State, City, Pin Code\n\nOr type 'skip' to proceed!")
          }
        }
        break

      case 'optionalFields':
        setRequestData({ ...requestData, optionalFieldsAsked: true })
        if (userInput.toLowerCase().includes('skip') || userInput.toLowerCase().trim() === '') {
          addBotMessage(t('chatbot.requestFlowConfirm') || `Please confirm your request:\n\nWork Type: ${requestData.workType}\nWorker Types: ${requestData.workerTypes?.join(', ')}\nDates: ${requestData.startDate} to ${requestData.endDate}\nLocation: ${requestData.location || 'Current Location'}\n\nType "confirm" to proceed to dashboard or "cancel" to start over.`)
        } else {
          // Try to parse all optional fields from user input
          const lowerInput = userInput.toLowerCase()
          let landmark = requestData.landmark || ''
          let area = requestData.area || ''
          let state = requestData.state || ''
          let city = requestData.city || ''
          let pinCode = requestData.pinCode || ''
          
          // Parse landmark
          if (lowerInput.includes('landmark') || lowerInput.includes('near') || lowerInput.includes('beside')) {
            const landmarkMatch = userInput.match(/(?:landmark|near|beside)[:\s]+(.+?)(?:\s+(?:area|state|city|pin|pincode)|$)/i)
            if (landmarkMatch) {
              landmark = landmarkMatch[1].trim()
            }
          }
          
          // Parse area
          if (lowerInput.includes('area')) {
            const areaMatch = userInput.match(/area[:\s]+(.+?)(?:\s+(?:state|city|pin|pincode)|$)/i)
            if (areaMatch) {
              area = areaMatch[1].trim()
            }
          }
          
          // Parse state
          if (lowerInput.includes('state')) {
            const stateMatch = userInput.match(/state[:\s]+(.+?)(?:\s+(?:city|pin|pincode)|$)/i)
            if (stateMatch) {
              state = stateMatch[1].trim()
            }
          }
          
          // Parse city
          if (lowerInput.includes('city')) {
            const cityMatch = userInput.match(/city[:\s]+(.+?)(?:\s+(?:pin|pincode)|$)/i)
            if (cityMatch) {
              city = cityMatch[1].trim()
            }
          }
          
          // Parse pin code
          const pinMatch = userInput.match(/(?:pin|pincode)[:\s]*(\d{4,6})/i)
          if (pinMatch) {
            pinCode = pinMatch[1].trim()
            // If pin code is 6 digits, try to fetch location details
            if (pinCode.length === 6) {
              try {
                const locationData = await getLocationFromPinCode(pinCode)
                if (locationData) {
                  state = locationData.state || state
                  city = locationData.city || city
                  if (!requestData.location || requestData.location === '') {
                    setRequestData((prev: any) => ({ ...prev, location: locationData.address }))
                  }
                }
              } catch (error) {
                console.error('Error fetching location from pin code:', error)
              }
            }
          } else {
            // Try to find 6-digit number as pin code
            const digitMatch = userInput.match(/\b(\d{6})\b/)
            if (digitMatch && !pinCode) {
              pinCode = digitMatch[1]
              // Auto-fetch location from pin code
              if (pinCode.length === 6) {
                try {
                  const locationData = await getLocationFromPinCode(pinCode)
                  if (locationData) {
                    state = locationData.state || state
                    city = locationData.city || city
                  if (!requestData.location || requestData.location === '') {
                    setRequestData((prev: any) => ({ ...prev, location: locationData.address }))
                  }
                  }
                } catch (error) {
                  console.error('Error fetching location from pin code:', error)
                }
              }
            }
          }
          
          // If no specific keywords found, try to extract from comma-separated values
          if (!landmark && !area && !state && !city && !pinCode) {
            const parts = userInput.split(',').map(p => p.trim()).filter(p => p)
            if (parts.length > 0) {
              landmark = parts[0]
              if (parts.length > 1) area = parts[1]
              if (parts.length > 2) state = parts[2]
              if (parts.length > 3) city = parts[3]
              if (parts.length > 4) pinCode = parts[4]
            } else {
              landmark = userInput.trim()
            }
          }
          
          setRequestData({ 
            ...requestData, 
            landmark: landmark || requestData.landmark || '',
            area: area || requestData.area || '',
            state: state || requestData.state || '',
            city: city || requestData.city || '',
            pinCode: pinCode || requestData.pinCode || ''
          })
          
          const confirmText = `Please confirm your request:\n\nWork Type: ${requestData.workType}\nWorker Types: ${requestData.workerTypes?.join(', ')}\nDates: ${requestData.startDate} to ${requestData.endDate}\nLocation: ${requestData.location || 'Current Location'}${landmark ? `\nLandmark: ${landmark}` : ''}${area ? `\nArea: ${area}` : ''}${state ? `\nState: ${state}` : ''}${city ? `\nCity: ${city}` : ''}${pinCode ? `\nPin Code: ${pinCode}` : ''}\n\nType "confirm" to proceed to dashboard or "cancel" to start over.`
          addBotMessage(t('chatbot.requestFlowConfirm') || confirmText)
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
      
      // Use real stats if available, otherwise show placeholder
      const pending = adminStats?.pendingRequests ?? 0
      const active = adminStats?.activeRequests ?? 0
      const workers = adminStats?.totalWorkers ?? 0
      const customers = adminStats?.totalCustomers ?? 0
      const concerns = adminStats?.pendingConcerns ?? 0
      
      const statsText = t('chatbot.adminStats')?.replace('{pending}', pending.toString())
        ?.replace('{active}', active.toString())
        ?.replace('{workers}', workers.toString())
        ?.replace('{customers}', customers.toString())
        ?.replace('{concerns}', concerns.toString())
        || `📊 Current Statistics:\n\n• Pending Requests: ${pending}\n• Active Requests: ${active}\n• Total Workers: ${workers}\n• Total Customers: ${customers}\n• Pending Concerns: ${concerns}\n\nVisit your dashboard for detailed information.`
      
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

  const checkRequestStatus = async () => {
    if (!user || user.role?.toLowerCase() !== 'customer') {
      addBotMessage("To check your request status, you need to be logged in as a customer. Would you like to login?")
      return
    }

    try {
      addBotMessage("Let me check your requests for you...")
      const response = await apiClient.get('/requests/my-requests')
      const requests = response.data || []
      
      if (requests.length === 0) {
        addBotMessage("You don't have any requests yet. Would you like to create one? Type 'create request' to get started!")
      } else {
        const pending = requests.filter((r: any) => r.status === 'PENDING_ADMIN_APPROVAL' || r.status === 'PENDING').length
        const active = requests.filter((r: any) => r.status === 'NOTIFIED' || r.status === 'CONFIRMED' || r.status === 'DEPLOYED').length
        const completed = requests.filter((r: any) => r.status === 'COMPLETED').length
        
        const statusText = `Here's your request status:\n\n📋 Total Requests: ${requests.length}\n⏳ Pending: ${pending}\n🔄 Active: ${active}\n✅ Completed: ${completed}\n\nVisit your dashboard to see detailed information about each request!`
        addBotMessage(statusText)
      }
    } catch (error: any) {
      addBotMessage("I couldn't fetch your requests right now. Please try again later or visit your dashboard directly.")
    } finally {
      setTimeout(() => showQuickReplies(), 2000)
    }
  }

  const handleUserMessage = async (text: string) => {
    // Add user message to context
    setConversationContext(prev => [...prev.slice(-4), `user: ${text}`])
    
    if (currentFlow === 'request') {
      await handleRequestFlow(text)
    } else if (currentFlow === 'concern') {
      await handleConcernFlow(text)
    } else {
      // Intelligent intent detection
      const intent = detectIntent(text)
      const lowerText = text.toLowerCase()
      
      if (intent === 'greeting' || lowerText.match(/\b(hello|hi|hey|namaste|namaskar)\b/)) {
        const greetings = [
          "Hello! How can I assist you today?",
          "Hi there! What can I help you with?",
          "Hey! I'm here to help. What do you need?",
          "Namaste! How may I assist you?"
        ]
        addBotMessage(greetings[Math.floor(Math.random() * greetings.length)])
        setTimeout(() => showQuickReplies(), 1000)
      } else if (intent === 'create_request' || lowerText.match(/\b(create|new|post|need|want|require|looking for)\b.*\b(request|work|job|service|worker)\b/)) {
        if (!user || user.role?.toLowerCase() !== 'customer') {
          addBotMessage("I'd love to help you create a request! However, you need to be logged in as a customer. Would you like to login or sign up?")
          setTimeout(() => {
            addBotMessage("Type 'login' to sign in or 'sign up' to create an account!")
          }, 1000)
        } else {
          startRequestFlow()
        }
      } else if (intent === 'raise_concern' || lowerText.match(/\b(concern|issue|problem|complaint|report)\b/)) {
        if (!user || (user.role?.toLowerCase() !== 'customer' && user.role?.toLowerCase() !== 'worker')) {
          addBotMessage("I can help you raise a concern! You'll need to be logged in as a customer or worker. Would you like to login?")
        } else {
          startConcernFlow()
        }
      } else if (intent === 'check_status' || lowerText.match(/\b(status|update|progress|where|what)\b.*\b(request|work|job)\b/)) {
        if (!user || user.role?.toLowerCase() !== 'customer') {
          addBotMessage("To check your request status, you need to be logged in as a customer. Would you like to login?")
        } else {
          checkRequestStatus()
        }
      } else if (intent === 'help' || lowerText.includes('help') || lowerText.includes('मदद')) {
        showHelp()
      } else if (intent === 'about' || lowerText.includes('about') || lowerText.includes('क्या है') || lowerText.includes('कामकार्ट')) {
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
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-full p-3 sm:p-4 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 transform"
        aria-label="Open chat"
        lang={language}
      >
        {isOpen ? (
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-24 sm:right-6 z-50 w-full sm:w-96 h-full sm:h-[600px] bg-white sm:rounded-2xl shadow-2xl flex flex-col border-0 sm:border-2 border-primary-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-600 to-indigo-600 text-white p-4 sm:rounded-t-2xl flex justify-between items-center">
            <div>
              <h3 className="font-bold text-base sm:text-lg" lang={language}>{t('chatbot.title') || 'KaamKart Assistant'}</h3>
              <p className="text-xs opacity-90 hidden sm:block" lang={language}>{t('chatbot.subtitle') || 'We\'re here to help!'}</p>
            </div>
            <button
              onClick={() => {
                setIsOpen(false)
                setCurrentFlow('none')
                setRequestData({})
                setConcernData({})
              }}
              className="text-white hover:text-gray-200 transition-colors p-1"
              aria-label="Close chat"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
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
          <form onSubmit={handleSend} className="p-3 sm:p-4 border-t border-gray-200 bg-white">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={t('chatbot.inputPlaceholder') || 'Type your message...'}
                className="flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                lang={language}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isTyping}
                className="bg-primary-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
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

