'use client'

import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { apiClient } from '@/lib/api'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { getLocationFromPinCode } from '@/lib/indianLocationValidation'
import { logger } from '@/lib/logger'

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
  const [workerTypes, setWorkerTypes] = useState<any[]>([])
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
          t('chatbot.quickReplyHelp') || 'How to use KaamKart',
          t('chatbot.quickReplyWhyNotAvailable') || 'Why not able to make available?',
          t('chatbot.quickReplyWhyNotAccept') || 'Why unable to accept new request?'
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
    
    // Handle worker FAQ questions FIRST, before other checks
    // Check for both English and Hindi text
    const lowerReply = reply.toLowerCase()
    const isHindiAvailableQuestion = reply.includes('उपलब्ध') && (reply.includes('क्यों') || reply.includes('नहीं'))
    if (reply.includes('Why not able to make available') || reply.includes('why not able to make available') || (lowerReply.includes('available') && lowerReply.includes('why')) || isHindiAvailableQuestion) {
      // FAQ: Why not able to make available - Only for workers
      if (!user || user.role?.toLowerCase() !== 'worker') {
        addBotMessage(t('chatbot.workerOnly') || 'This information is only available for workers. Please login as a worker to see why you might not be able to make yourself available.')
        return
      }
      addBotMessage(t('chatbot.workerFAQNotAvailable') || 'Currently you are deployed on work, so you are not able to make yourself available. Once you complete your current work assignment, you will be able to make yourself available again.\n\nYou can check your active work in the "Active Work" tab on your dashboard.')
      return
    } else if (reply.includes('Why unable to accept new request') || reply.includes('why unable to accept new request') || (reply.includes('accept') && reply.includes('why') && reply.includes('request'))) {
      // FAQ: Why unable to accept new request - Only for workers
      if (!user || user.role?.toLowerCase() !== 'worker') {
        addBotMessage(t('chatbot.workerOnly') || 'This information is only available for workers. Please login as a worker to see why you might not be able to accept new requests.')
        return
      }
      addBotMessage(t('chatbot.workerFAQNotAccept') || 'Currently you are deployed on work, so you are not able to accept new requests during this period. Once you complete your current work assignment, you will be able to accept new requests again.\n\nYou can check your active work in the "Active Work" tab on your dashboard.')
      return
    }
    
    // Check for admin-specific quick replies first (before generic "request" check)
    if ((reply.includes('Pending') || reply.includes('pending') || reply.includes('लंबित')) && user?.role?.toLowerCase() === 'admin') {
      showPendingRequests()
      return
    } else if (reply.includes('Create') || reply.includes('create') || (reply.includes('request') && !reply.includes('pending')) || reply.includes('नया अनुरोध')) {
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
    } else if (reply.includes('Try Again') || reply.includes('try again')) {
      // Retry concern submission
      if (concernData.type && concernData.description) {
        navigateToConcernForm()
      } else {
        startConcernFlow()
      }
    } else if (reply.includes('Go to Dashboard') || reply.includes('go to dashboard')) {
      // Navigate to dashboard
      if (user?.role?.toLowerCase() === 'customer') {
        router.push('/customer/dashboard?action=raiseConcern')
      } else if (user?.role?.toLowerCase() === 'worker') {
        router.push('/worker/dashboard?action=raiseConcern')
      }
    } else {
      handleUserMessage(reply)
    }
  }

  const startRequestFlow = async () => {
    setCurrentFlow('request')
    setRequestData({})
    setRetryCount({})
    
    const greetings = [
      "Great! I'd be happy to help you create a request. Please select the type of work:",
      "Perfect! Let's get started. What kind of work do you need?",
      "Awesome! To help you find the right workers, please select your work type:"
    ]
    addBotMessage(`${greetings[Math.floor(Math.random() * greetings.length)]}`, 300)
    
    // Fetch worker types from API
    try {
      const response = await apiClient.get('/public/worker-types')
      const types = response.data || []
      const activeTypes = types.filter((t: any) => t.isActive).sort((a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0))
      setWorkerTypes(activeTypes)
      
      setTimeout(() => {
        if (activeTypes.length > 0) {
          // Show all available worker types from API
          const options = activeTypes.map((type: any, index: number) => 
            `${index + 1}. ${type.icon || '🔧'} ${type.displayName || type.name}`
          )
          // Add "Other" option at the end
          options.push(`${activeTypes.length + 1}. Other`)
          addMessage('', 'bot', options)
        } else {
          // Fallback to default options if no active types
          addMessage('', 'bot', [
            '1. Plumbing',
            '2. Electrical',
            '3. Cleaning',
            '4. Construction',
            '5. Painting',
            '6. Carpentry',
            '7. Other'
          ])
        }
      }, 500)
    } catch (error) {
      logger.error('Error fetching worker types:', error)
      // Fallback to default types if API fails
      setWorkerTypes([])
      setTimeout(() => {
        addMessage('', 'bot', [
          '1. Plumbing',
          '2. Electrical',
          '3. Cleaning',
          '4. Construction',
          '5. Painting',
          '6. Carpentry',
          '7. Other'
        ])
      }, 500)
    }
  }

  const startConcernFlow = () => {
    setCurrentFlow('concern')
    setConcernData({})
    addBotMessage(t('chatbot.concernFlowStart') || 'I can help you raise a concern. Please select the type of concern:', 300)
    setTimeout(() => {
      addMessage('', 'bot', [
        '1. Work Quality',
        '2. Payment Issue',
        '3. Behavior',
        '4. Safety',
        '5. Other'
      ])
    }, 500)
  }

  const handleRequestFlow = async (userInput: string) => {
    const step = getRequestStep()
    
    switch (step) {
      case 'workType':
        let selectedWorkType = ''
        const workTypeLowerInput = userInput.toLowerCase().trim()
        
        // Extract number from input (e.g., "1", "2", etc.)
        const numberMatch = workTypeLowerInput.match(/^(\d+)/)
        const selectedIndex = numberMatch ? parseInt(numberMatch[1]) - 1 : -1
        
        // Map numerical or text input to work type from API
        if (workerTypes.length > 0) {
          if (selectedIndex >= 0 && selectedIndex < workerTypes.length) {
            // User selected a number from the list
            selectedWorkType = workerTypes[selectedIndex].displayName || workerTypes[selectedIndex].name
          } else if (selectedIndex === workerTypes.length) {
            // User selected "Other" (last option)
            selectedWorkType = 'Other'
          } else {
            // Try to match by name
            const matchedType = workerTypes.find((type: any) => {
              const typeName = (type.displayName || type.name).toLowerCase()
              return workTypeLowerInput.includes(typeName) || typeName.includes(workTypeLowerInput)
            })
            if (matchedType) {
              selectedWorkType = matchedType.displayName || matchedType.name
            } else if (workTypeLowerInput.includes('other')) {
              selectedWorkType = 'Other'
            } else if (userInput.trim().length >= 2) {
              // User typed custom work type
              selectedWorkType = userInput.trim()
            } else {
              addBotMessage(getEmpatheticResponse('confusion') + ` I didn't understand that work type. Please select from the options above (1-${workerTypes.length + 1}) or type the name.`)
              return
            }
          }
        } else {
          // Fallback to hardcoded types if API data not loaded
          if (workTypeLowerInput.includes('1') || workTypeLowerInput.includes('plumbing') || workTypeLowerInput.includes('plumber')) {
            selectedWorkType = 'Plumbing'
          } else if (workTypeLowerInput.includes('2') || workTypeLowerInput.includes('electrical') || workTypeLowerInput.includes('electrician')) {
            selectedWorkType = 'Electrical'
          } else if (workTypeLowerInput.includes('3') || workTypeLowerInput.includes('cleaning') || workTypeLowerInput.includes('cleaner')) {
            selectedWorkType = 'Cleaning'
          } else if (workTypeLowerInput.includes('4') || workTypeLowerInput.includes('construction') || workTypeLowerInput.includes('builder')) {
            selectedWorkType = 'Construction'
          } else if (workTypeLowerInput.includes('5') || workTypeLowerInput.includes('painting') || workTypeLowerInput.includes('painter')) {
            selectedWorkType = 'Painting'
          } else if (workTypeLowerInput.includes('6') || workTypeLowerInput.includes('carpentry') || workTypeLowerInput.includes('carpenter')) {
            selectedWorkType = 'Carpentry'
          } else if (workTypeLowerInput.includes('7') || workTypeLowerInput.includes('other')) {
            selectedWorkType = 'Other'
          } else if (userInput.trim().length >= 2) {
            // User typed custom work type
            selectedWorkType = userInput.trim()
          } else {
            addBotMessage(getEmpatheticResponse('confusion') + " Please select a work type from the options above or type your custom work type.")
            return
          }
        }
        
        setRequestData({ ...requestData, workType: selectedWorkType })
        const datePrompts = [
          "Perfect! When do you need this work done?",
          "Great! What dates work for you?",
          "Excellent! When should the workers start?"
        ]
        
        addBotMessage(`${datePrompts[Math.floor(Math.random() * datePrompts.length)]}`, 300)
        setTimeout(() => {
          const today = new Date()
          const tomorrow = new Date(today)
          tomorrow.setDate(tomorrow.getDate() + 1)
          const nextWeek = new Date(today)
          nextWeek.setDate(nextWeek.getDate() + 7)
          addMessage('', 'bot', [
            `1. ${t('chatbot.today') || 'Today'} (${formatDate(today)})`,
            `2. ${t('chatbot.tomorrow') || 'Tomorrow'} (${formatDate(tomorrow)})`,
            `3. ${t('chatbot.nextWeek') || 'Next Week'} (${formatDate(nextWeek)})`,
            `4. ${t('chatbot.customDate') || 'Custom Date'}`,
            `5. ${t('chatbot.skip') || 'Skip'}`
          ])
        }, 500)
        setRequestData((prev: any) => ({ ...prev, currentDateStep: 'startDate' }))
        break

      case 'workerTypes':
        const selectedWorkerTypes = userInput.split(',').map(t => t.trim()).filter(t => t)
        setRequestData({ ...requestData, workerTypes: selectedWorkerTypes })
        addBotMessage(t('chatbot.requestFlowWorkerCount') || 'How many workers do you need?', 300)
        setTimeout(() => {
          addMessage('', 'bot', [
            '1',
            '2',
            '3',
            '4',
            '5+'
          ])
        }, 500)
        break

      case 'workerCount':
        // Handle clickable number options or text input
        const workerCountLowerInput = userInput.toLowerCase().trim()
        let workerCountValue = ''
        
        // Check for clickable number options (1, 2, 3, 4, 5+)
        if (workerCountLowerInput === '1' || workerCountLowerInput.includes('one')) {
          workerCountValue = '1'
        } else if (workerCountLowerInput === '2' || workerCountLowerInput.includes('two')) {
          workerCountValue = '2'
        } else if (workerCountLowerInput === '3' || workerCountLowerInput.includes('three')) {
          workerCountValue = '3'
        } else if (workerCountLowerInput === '4' || workerCountLowerInput.includes('four')) {
          workerCountValue = '4'
        } else if (workerCountLowerInput === '5' || workerCountLowerInput.includes('five') || workerCountLowerInput.includes('5+')) {
          workerCountValue = '5+'
        } else {
          // Parse worker counts from text input
          const countMatch = userInput.match(/(\d+)\s*([a-zA-Z\s]+)/g)
          if (!countMatch && !userInput.match(/\d+/)) {
            addBotMessage(t('chatbot.requestFlowWorkerCount') || 'How many workers do you need?', 300)
            setTimeout(() => {
              addMessage('', 'bot', [
                '1',
                '2',
                '3',
                '4',
                '5+'
              ])
            }, 500)
            return
          }
          workerCountValue = userInput
        }
        
        setRequestData({ ...requestData, workerCountText: workerCountValue })
        // Ask for start date first
        const startDatePrompts = [
          "Perfect! When would you like the work to start?",
          "Great! What's your preferred start date?",
          "Excellent! When should the work begin?"
        ]
        addBotMessage(`${startDatePrompts[Math.floor(Math.random() * startDatePrompts.length)]}`, 300)
        setTimeout(() => {
          const today = new Date()
          const tomorrow = new Date(today)
          tomorrow.setDate(tomorrow.getDate() + 1)
          const nextWeek = new Date(today)
          nextWeek.setDate(nextWeek.getDate() + 7)
          addMessage('', 'bot', [
            `1. ${t('chatbot.today') || 'Today'} (${formatDate(today)})`,
            `2. ${t('chatbot.tomorrow') || 'Tomorrow'} (${formatDate(tomorrow)})`,
            `3. ${t('chatbot.nextWeek') || 'Next Week'} (${formatDate(nextWeek)})`,
            `4. ${t('chatbot.customDate') || 'Custom Date'}`,
            `5. ${t('chatbot.skip') || 'Skip'}`
          ])
        }, 500)
        setRequestData((prev: any) => ({ ...prev, currentDateStep: 'startDate' }))
        break

      case 'startDate':
        // Handle clickable date options or text input
        const lowerDateInput = userInput.toLowerCase().trim()
        let selectedStartDate: string | null = null
        
        // Handle clickable options
        if (lowerDateInput.includes('1') || lowerDateInput.includes('today')) {
          selectedStartDate = formatDate(new Date())
        } else if (lowerDateInput.includes('2') || lowerDateInput.includes('tomorrow')) {
          const tomorrow = new Date()
          tomorrow.setDate(tomorrow.getDate() + 1)
          selectedStartDate = formatDate(tomorrow)
        } else if (lowerDateInput.includes('3') || lowerDateInput.includes('next week')) {
          const nextWeek = new Date()
          nextWeek.setDate(nextWeek.getDate() + 7)
          selectedStartDate = formatDate(nextWeek)
        } else if (lowerDateInput.includes('4') || lowerDateInput.includes('custom')) {
          // Ask for custom date input
          addBotMessage(t('chatbot.enterCustomDate') || 'Please enter your start date in YYYY-MM-DD format (e.g., 2025-12-15):', 300)
          setRequestData((prev: any) => ({ ...prev, currentDateStep: 'startDateCustom' }))
          return
        } else if (lowerDateInput.includes('5') || lowerDateInput === 'skip' || lowerDateInput === 'no' || lowerDateInput === 'not needed') {
          setRequestData({ ...requestData, startDate: '', endDate: '', currentDateStep: undefined })
          const locationPrompts = [
            "Perfect! Now, I need your location details.",
            "Great! Where do you need the work done?",
            "Excellent! Where should the workers come?"
          ]
          addBotMessage(`${locationPrompts[Math.floor(Math.random() * locationPrompts.length)]}\n\n${t('chatbot.enterPinCode') || 'Please provide your 6-digit pin code (required):'}`, 300)
          setTimeout(() => {
            addMessage('', 'bot', [
              t('chatbot.useCurrentLocation') || 'Use Current Location'
            ])
          }, 500)
          break
        } else {
          // Try to parse the date - support YYYY-MM-DD format or natural language
          const parsedStart = parseNaturalDate(userInput) || (userInput.match(/^\d{4}-\d{2}-\d{2}$/) ? userInput : null)
          if (parsedStart) {
            selectedStartDate = parsedStart
          } else {
            addBotMessage(t('chatbot.invalidDate') || "Please select a date from the options above or enter a valid date in YYYY-MM-DD format.", 300)
            setTimeout(() => {
              const today = new Date()
              const tomorrow = new Date(today)
              tomorrow.setDate(tomorrow.getDate() + 1)
              const nextWeek = new Date(today)
              nextWeek.setDate(nextWeek.getDate() + 7)
              addMessage('', 'bot', [
                `1. ${t('chatbot.today') || 'Today'} (${formatDate(today)})`,
                `2. ${t('chatbot.tomorrow') || 'Tomorrow'} (${formatDate(tomorrow)})`,
                `3. ${t('chatbot.nextWeek') || 'Next Week'} (${formatDate(nextWeek)})`,
                `4. ${t('chatbot.customDate') || 'Custom Date'}`,
                `5. ${t('chatbot.skip') || 'Skip'}`
              ])
            }, 500)
            return
          }
        }
        
        if (selectedStartDate) {
          setRequestData({ ...requestData, startDate: selectedStartDate, currentDateStep: 'endDate' })
          // Now ask for end date
          const endDatePrompts = [
            "Great! When would you like the work to end?",
            "Perfect! What's your preferred end date?",
            "Excellent! When should the work be completed?"
          ]
          addBotMessage(`${endDatePrompts[Math.floor(Math.random() * endDatePrompts.length)]}`, 300)
          setTimeout(() => {
            const start = new Date(selectedStartDate!)
            const dayAfter = new Date(start)
            dayAfter.setDate(dayAfter.getDate() + 1)
            const weekAfter = new Date(start)
            weekAfter.setDate(weekAfter.getDate() + 7)
            const twoWeeksAfter = new Date(start)
            twoWeeksAfter.setDate(twoWeeksAfter.getDate() + 14)
            addMessage('', 'bot', [
              `1. ${t('chatbot.dayAfterStart') || 'Day After Start'} (${formatDate(dayAfter)})`,
              `2. ${t('chatbot.weekAfterStart') || 'Week After Start'} (${formatDate(weekAfter)})`,
              `3. ${t('chatbot.twoWeeksAfter') || 'Two Weeks After'} (${formatDate(twoWeeksAfter)})`,
              `4. ${t('chatbot.customDate') || 'Custom Date'}`,
              `5. ${t('chatbot.skip') || 'Skip'}`
            ])
          }, 500)
        }
        break
      
      case 'startDateCustom':
        // Handle custom date input
        const parsedCustomStart = parseNaturalDate(userInput) || (userInput.match(/^\d{4}-\d{2}-\d{2}$/) ? userInput : null)
        if (parsedCustomStart) {
          setRequestData({ ...requestData, startDate: parsedCustomStart, currentDateStep: 'endDate' })
          const endDatePrompts = [
            "Great! When would you like the work to end?",
            "Perfect! What's your preferred end date?",
            "Excellent! When should the work be completed?"
          ]
          addBotMessage(`${endDatePrompts[Math.floor(Math.random() * endDatePrompts.length)]}`, 300)
          setTimeout(() => {
            const start = new Date(parsedCustomStart)
            const dayAfter = new Date(start)
            dayAfter.setDate(dayAfter.getDate() + 1)
            const weekAfter = new Date(start)
            weekAfter.setDate(weekAfter.getDate() + 7)
            const twoWeeksAfter = new Date(start)
            twoWeeksAfter.setDate(twoWeeksAfter.getDate() + 14)
            addMessage('', 'bot', [
              `1. ${t('chatbot.dayAfterStart') || 'Day After Start'} (${formatDate(dayAfter)})`,
              `2. ${t('chatbot.weekAfterStart') || 'Week After Start'} (${formatDate(weekAfter)})`,
              `3. ${t('chatbot.twoWeeksAfter') || 'Two Weeks After'} (${formatDate(twoWeeksAfter)})`,
              `4. ${t('chatbot.customDate') || 'Custom Date'}`,
              `5. ${t('chatbot.skip') || 'Skip'}`
            ])
          }, 500)
        } else {
          addBotMessage(t('chatbot.invalidDate') || "Please enter a valid date in YYYY-MM-DD format (e.g., 2025-12-15):", 300)
        }
        break

      case 'endDate':
        // Handle clickable date options or text input
        const lowerEndInput = userInput.toLowerCase().trim()
        let selectedEndDate: string | null = null
        const requestStartDate = requestData.startDate
        
        if (!requestStartDate) {
          addBotMessage(t('chatbot.provideStartDateFirst') || "Please provide a start date first.")
          return
        }
        
        // Handle clickable options
        if (lowerEndInput.includes('1') || lowerEndInput.includes('day after')) {
          const start = new Date(requestStartDate)
          const dayAfter = new Date(start)
          dayAfter.setDate(dayAfter.getDate() + 1)
          selectedEndDate = formatDate(dayAfter)
        } else if (lowerEndInput.includes('2') || lowerEndInput.includes('week after')) {
          const start = new Date(requestStartDate)
          const weekAfter = new Date(start)
          weekAfter.setDate(weekAfter.getDate() + 7)
          selectedEndDate = formatDate(weekAfter)
        } else if (lowerEndInput.includes('3') || lowerEndInput.includes('two weeks')) {
          const start = new Date(requestStartDate)
          const twoWeeksAfter = new Date(start)
          twoWeeksAfter.setDate(twoWeeksAfter.getDate() + 14)
          selectedEndDate = formatDate(twoWeeksAfter)
        } else if (lowerEndInput.includes('4') || lowerEndInput.includes('custom')) {
          // Ask for custom date input
          addBotMessage(t('chatbot.enterCustomEndDate') || 'Please enter your end date in YYYY-MM-DD format (e.g., 2025-12-20):', 300)
          setRequestData((prev: any) => ({ ...prev, currentDateStep: 'endDateCustom' }))
          return
        } else if (lowerEndInput.includes('5') || lowerEndInput === 'skip' || lowerEndInput === 'no' || lowerEndInput === 'not needed') {
          // If start date exists, keep it but skip end date
          if (requestStartDate) {
            setRequestData({ ...requestData, endDate: '', currentDateStep: undefined })
          } else {
            // If no start date, skip both
            setRequestData({ ...requestData, startDate: '', endDate: '', currentDateStep: undefined })
          }
          const locationPrompts = [
            "Perfect! Now, I need your location details.",
            "Great! Where do you need the work done?",
            "Excellent! Where should the workers come?"
          ]
          addBotMessage(`${locationPrompts[Math.floor(Math.random() * locationPrompts.length)]}\n\n${t('chatbot.enterPinCode') || 'Please provide your 6-digit pin code (required):'}`, 300)
          setTimeout(() => {
            addMessage('', 'bot', [
              t('chatbot.useCurrentLocation') || 'Use Current Location'
            ])
          }, 500)
          break
        } else {
          // Try to parse the date - support YYYY-MM-DD format or natural language
          const parsedEnd = parseNaturalDate(userInput) || (userInput.match(/^\d{4}-\d{2}-\d{2}$/) ? userInput : null)
          if (parsedEnd) {
            selectedEndDate = parsedEnd
          } else {
            addBotMessage(t('chatbot.invalidDate') || "Please select a date from the options above or enter a valid date in YYYY-MM-DD format.", 300)
            setTimeout(() => {
              const start = new Date(requestStartDate)
              const dayAfter = new Date(start)
              dayAfter.setDate(dayAfter.getDate() + 1)
              const weekAfter = new Date(start)
              weekAfter.setDate(weekAfter.getDate() + 7)
              const twoWeeksAfter = new Date(start)
              twoWeeksAfter.setDate(twoWeeksAfter.getDate() + 14)
              addMessage('', 'bot', [
                `1. ${t('chatbot.dayAfterStart') || 'Day After Start'} (${formatDate(dayAfter)})`,
                `2. ${t('chatbot.weekAfterStart') || 'Week After Start'} (${formatDate(weekAfter)})`,
                `3. ${t('chatbot.twoWeeksAfter') || 'Two Weeks After'} (${formatDate(twoWeeksAfter)})`,
                `4. ${t('chatbot.customDate') || 'Custom Date'}`,
                `5. ${t('chatbot.skip') || 'Skip'}`
              ])
            }, 500)
            return
          }
        }
        
        if (selectedEndDate) {
          // Validate dates
          const start = new Date(requestStartDate)
          const end = new Date(selectedEndDate)
          if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            addBotMessage(getEmpatheticResponse('error') + " I couldn't understand that date. Please enter a valid date in YYYY-MM-DD format.")
            return
          }
          if (end < start) {
            addBotMessage(getEmpatheticResponse('confusion') + " The end date must be after the start date. Please select a later date.")
            return
          }
          
          setRequestData({ ...requestData, endDate: selectedEndDate })
          const locationPrompts = [
            "Perfect! Now, I need your location details.",
            "Great! Where do you need the work done?",
            "Excellent! Where should the workers come?"
          ]
          addBotMessage(`${locationPrompts[Math.floor(Math.random() * locationPrompts.length)]}\n\nPlease provide your 6-digit pin code (required):\n\nYou can also:\n• Type "use current location" or "my location" for GPS (you'll still need to provide pin code)`)
        }
        break

      case 'dates':
        // Allow skipping dates
        if (userInput.toLowerCase().trim() === 'skip' || userInput.toLowerCase().trim() === 'no' || userInput.toLowerCase().trim() === 'not needed') {
          setRequestData({ ...requestData, startDate: '', endDate: '' })
          const locationPrompts = [
            "Perfect! Now, where do you need the work done? (Optional)",
            "Great! What's the location for this work? (Optional)",
            "Excellent! Where should the workers come? (Optional)"
          ]
          addBotMessage(`${locationPrompts[Math.floor(Math.random() * locationPrompts.length)]}\n\n${t('chatbot.enterPinCode') || 'Please provide your 6-digit pin code (required):'}`, 300)
          setTimeout(() => {
            addMessage('', 'bot', [
              t('chatbot.useCurrentLocation') || 'Use Current Location'
            ])
          }, 500)
          break
        }
        // Try natural language parsing first
        let parsedStartDate: string | null = null
        let parsedEndDate: string | null = null
        
        // Try to parse natural language dates
        const naturalStart = parseNaturalDate(userInput)
        if (naturalStart) {
          parsedStartDate = naturalStart
          // Default end date to 7 days after start
          const end = new Date(naturalStart)
          end.setDate(end.getDate() + 7)
          parsedEndDate = formatDate(end)
        } else {
          // Try comma-separated dates
          const dates = userInput.split(',').map(d => d.trim())
          if (dates.length >= 2) {
            parsedStartDate = parseNaturalDate(dates[0]) || dates[0]
            parsedEndDate = parseNaturalDate(dates[1]) || dates[1]
          } else if (dates.length === 1) {
            parsedStartDate = parseNaturalDate(dates[0]) || dates[0]
            // If only one date provided, ask for end date
            if (parsedStartDate && !parsedEndDate) {
              addBotMessage(getEmpatheticResponse('confusion') + ` I see you mentioned ${parsedStartDate} as the start date. When would you like the work to end?`)
              return
            }
          } else {
            // Try to extract dates from the text
            const datePattern = /(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/g
            const foundDates = userInput.match(datePattern)
            if (foundDates && foundDates.length >= 2) {
              parsedStartDate = parseNaturalDate(foundDates[0]) || foundDates[0]
              parsedEndDate = parseNaturalDate(foundDates[1]) || foundDates[1]
            } else if (foundDates && foundDates.length === 1) {
              parsedStartDate = parseNaturalDate(foundDates[0]) || foundDates[0]
              addBotMessage(getEmpatheticResponse('confusion') + ` I found a start date: ${parsedStartDate}. When would you like the work to end?`)
              return
            }
          }
        }
        
        if (parsedStartDate && parsedEndDate) {
          // Validate dates
          const start = new Date(parsedStartDate)
          const end = new Date(parsedEndDate)
          if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            addBotMessage(getEmpatheticResponse('error') + " I couldn't understand those dates. Could you try again? For example: '2024-12-20 to 2024-12-25' or 'today to tomorrow'")
            return
          }
          if (end < start) {
            addBotMessage(getEmpatheticResponse('confusion') + " It looks like the end date is before the start date. Could you check and provide the correct dates?")
            return
          }
          
          setRequestData({ ...requestData, startDate: parsedStartDate, endDate: parsedEndDate })
          const locationPrompts = [
            "Perfect! Now, I need your location details.",
            "Great! Where do you need the work done?",
            "Excellent! Where should the workers come?"
          ]
          addBotMessage(`${locationPrompts[Math.floor(Math.random() * locationPrompts.length)]}\n\n${t('chatbot.enterPinCode') || 'Please provide your 6-digit pin code (required):'}`, 300)
          setTimeout(() => {
            addMessage('', 'bot', [
              t('chatbot.useCurrentLocation') || 'Use Current Location'
            ])
          }, 500)
        } else {
          const stepKey = 'dates'
          const count = (retryCount[stepKey] || 0) + 1
          setRetryCount({ ...retryCount, [stepKey]: count })
          
          if (count === 1) {
            addBotMessage(getEmpatheticResponse('confusion') + " I need both a start date and end date. You can say:\n• '2024-12-20 to 2024-12-25'\n• 'Today to tomorrow'\n• 'Next week'\n\nOr type 'skip' to continue without dates (optional).\n\nWhat dates work for you?")
          } else {
            addBotMessage("Let me help you with the format. Please provide dates like:\n• Start: 2024-12-20, End: 2024-12-25\n• Or: 'today to next week'\n• Or type 'skip' to continue without dates\n\nWhat are your preferred dates?")
          }
        }
        break

      case 'location':
        const lowerLocation = userInput.toLowerCase()
        
        // Check if user provided a pin code (6 digits) - this is mandatory
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
              addBotMessage(`Perfect! I've detected your location from pin code ${pinCode}:\n\n📍 Address: ${locationData.address}\n🏙️ City: ${locationData.city}\n🗺️ State: ${locationData.state}\n\n${t('chatbot.addOptionalDetails') || 'Would you like to add any additional details?'}`, 300)
              setTimeout(() => {
                addMessage('', 'bot', [
                  t('chatbot.skip') || 'Skip'
                ])
              }, 500)
            } else {
              setIsTyping(false)
              addBotMessage(getEmpatheticResponse('error') + ` I couldn't find location details for pin code ${pinCode}. Please provide a valid 6-digit pin code.`)
            }
          } catch (error) {
            setIsTyping(false)
            addBotMessage(getEmpatheticResponse('error') + " I had trouble fetching location from the pin code. Please provide a valid 6-digit pin code.")
          }
        } else if (lowerLocation.includes('current') || lowerLocation.includes('gps') || lowerLocation.includes('my location') || lowerLocation.includes('here') || lowerLocation.includes('use current')) {
          // If using current location, still need pin code
          setRequestData({ ...requestData, useCurrentLocation: true })
          addBotMessage(t('chatbot.usingCurrentLocation') || "I'll use your current location. However, I still need your 6-digit pin code for verification.\n\nPlease provide your pin code:", 300)
          setTimeout(() => {
            addMessage('', 'bot', [
              t('chatbot.skip') || 'Skip'
            ])
          }, 500)
        } else if (userInput.trim().length < 5) {
          addBotMessage(t('chatbot.enterPinCode') || "Please provide a 6-digit pin code. This is required.", 300)
          setTimeout(() => {
            addMessage('', 'bot', [
              t('chatbot.useCurrentLocation') || 'Use Current Location'
            ])
          }, 500)
        } else {
          // User provided address but no pin code - ask for pin code
          setRequestData({ ...requestData, location: userInput, useCurrentLocation: false })
          addBotMessage(t('chatbot.addressNotedNeedPinCode') || "I've noted your address. However, I need your 6-digit pin code (this is required).\n\nPlease provide your pin code:", 300)
          setTimeout(() => {
            addMessage('', 'bot', [
              t('chatbot.useCurrentLocation') || 'Use Current Location'
            ])
          }, 500)
        }
        break

      case 'optionalFields':
        // Check if pin code is missing - it's mandatory
        if (!requestData.pinCode || requestData.pinCode.length !== 6) {
          // Check if user provided pin code in this input
          const pinCodeMatch = userInput.match(/\b(\d{6})\b/)
          if (pinCodeMatch) {
            const pinCode = pinCodeMatch[1]
            setIsTyping(true)
            try {
              const locationData = await getLocationFromPinCode(pinCode)
              if (locationData) {
                setRequestData({ 
                  ...requestData, 
                  pinCode: pinCode,
                  state: locationData.state || requestData.state,
                  city: locationData.city || requestData.city,
                  location: requestData.location || locationData.address,
                  optionalFieldsAsked: true
                })
                setIsTyping(false)
                addBotMessage(`Perfect! Pin code ${pinCode} verified.\n📍 Address: ${locationData.address}\n🏙️ City: ${locationData.city}\n🗺️ State: ${locationData.state}\n\n${t('chatbot.addOptionalDetails') || 'Would you like to add any optional details?'}`, 300)
                setTimeout(() => {
                  addMessage('', 'bot', [
                    t('chatbot.skip') || 'Skip'
                  ])
                }, 500)
                return
              } else {
                setIsTyping(false)
                addBotMessage(getEmpatheticResponse('error') + ` I couldn't find location details for pin code ${pinCode}. Please provide a valid 6-digit pin code.`)
                return
              }
            } catch (error) {
              setIsTyping(false)
              addBotMessage(getEmpatheticResponse('error') + " I had trouble fetching location from the pin code. Please provide a valid 6-digit pin code.")
              return
            }
          } else {
            // Pin code still missing
            addBotMessage(t('chatbot.enterPinCode') || "I need your 6-digit pin code to proceed. This is required.\n\nPlease provide your pin code:", 300)
            setTimeout(() => {
              addMessage('', 'bot', [
                t('chatbot.useCurrentLocation') || 'Use Current Location'
              ])
            }, 500)
            return
          }
        }
        
        // Handle skip or empty input
        if (userInput.toLowerCase().includes('skip') || userInput.toLowerCase().trim() === '') {
          setRequestData({ ...requestData, optionalFieldsAsked: true })
          addBotMessage(t('chatbot.requestFlowConfirm') || `Please confirm your request:\n\nWork Type: ${requestData.workType || 'Not specified'}\nWorker Types: ${requestData.workerTypes?.join(', ')}\nDates: ${requestData.startDate && requestData.endDate ? `${requestData.startDate} to ${requestData.endDate}` : 'Not specified'}\nLocation: ${requestData.location || 'Current Location'}\nPin Code: ${requestData.pinCode}\n\nType "confirm" to proceed to dashboard or "cancel" to start over.`)
          setTimeout(() => {
            addMessage('', 'bot', [
              'Confirm',
              'Cancel'
            ])
          }, 500)
          return
        }
        
        // Process any text input as optional fields (landmark, area, etc.)
        const optionalFieldsLowerInput = userInput.toLowerCase()
        let landmark = requestData.landmark || ''
        let area = requestData.area || ''
        let state = requestData.state || ''
        let city = requestData.city || ''
        let pinCode = requestData.pinCode || ''
        
        // Parse landmark
        if (optionalFieldsLowerInput.includes('landmark') || optionalFieldsLowerInput.includes('near') || optionalFieldsLowerInput.includes('beside')) {
          const landmarkMatch = userInput.match(/(?:landmark|near|beside)[:\s]+(.+?)(?:\s+(?:area|state|city|pin|pincode)|$)/i)
          if (landmarkMatch) {
            landmark = landmarkMatch[1].trim()
          }
        }
        
        // Parse area
        if (optionalFieldsLowerInput.includes('area')) {
          const areaMatch = userInput.match(/area[:\s]+(.+?)(?:\s+(?:state|city|pin|pincode)|$)/i)
          if (areaMatch) {
            area = areaMatch[1].trim()
          }
        }
        
        // Parse state
        if (optionalFieldsLowerInput.includes('state')) {
          const stateMatch = userInput.match(/state[:\s]+(.+?)(?:\s+(?:city|pin|pincode)|$)/i)
          if (stateMatch) {
            state = stateMatch[1].trim()
          }
        }
        
        // Parse city
        if (optionalFieldsLowerInput.includes('city')) {
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
              logger.error('Error fetching location from pin code:', error)
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
                logger.error('Error fetching location from pin code:', error)
              }
            }
          }
        }
        
        // If no specific keywords found, treat the entire input as landmark
        if (!landmark && !area && !state && !city && !pinCode && userInput.trim()) {
          // Single input - treat as landmark
          landmark = userInput.trim()
        }
        
        // Ensure pin code is set (mandatory) - check from requestData first
        const finalPinCode = pinCode || requestData.pinCode || ''
        if (!finalPinCode || finalPinCode.length !== 6) {
          addBotMessage("I need your 6-digit pin code to proceed. This is required.\n\nPlease provide your pin code:")
          return
        }
        
        // If user input doesn't match any pattern but is not empty, treat it as landmark
        if (!landmark && userInput.trim() && !optionalFieldsLowerInput.includes('skip')) {
          landmark = userInput.trim()
        }
        
        // Update request data with all fields - accept any text input as landmark/area
        setRequestData({ 
          ...requestData, 
          landmark: landmark || requestData.landmark || '',
          area: area || requestData.area || '',
          state: state || requestData.state || '',
          city: city || requestData.city || '',
          pinCode: finalPinCode,
          optionalFieldsAsked: true
        })
        
        // Always proceed to confirmation if pin code is set, regardless of what user typed
        const finalLandmark = landmark || requestData.landmark || ''
        const finalArea = area || requestData.area || ''
        const finalState = state || requestData.state || ''
        const finalCity = city || requestData.city || ''
        
        const confirmText = `Please confirm your request:\n\nWork Type: ${requestData.workType || 'Not specified'}\nWorker Types: ${requestData.workerTypes?.join(', ') || 'Not specified'}\nDates: ${requestData.startDate && requestData.endDate ? `${requestData.startDate} to ${requestData.endDate}` : 'Not specified'}\nLocation: ${requestData.location || 'Current Location'}\nPin Code: ${finalPinCode}${finalLandmark ? `\nLandmark: ${finalLandmark}` : ''}${finalArea ? `\nArea: ${finalArea}` : ''}${finalState ? `\nState: ${finalState}` : ''}${finalCity ? `\nCity: ${finalCity}` : ''}\n\nType "confirm" to proceed to dashboard or "cancel" to start over.`
        addBotMessage(t('chatbot.requestFlowConfirm') || confirmText, 300)
        setTimeout(() => {
          addMessage('', 'bot', [
            'Confirm',
            'Cancel'
          ])
        }, 500)
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
        let concernTypeName = 'Other'
        const concernLowerInput = userInput.toLowerCase()
        if (concernLowerInput.includes('1') || concernLowerInput.includes('quality') || concernLowerInput.includes('work quality')) {
          concernType = 'WORK_QUALITY'
          concernTypeName = 'Work Quality'
        } else if (concernLowerInput.includes('2') || concernLowerInput.includes('payment')) {
          concernType = 'PAYMENT_ISSUE'
          concernTypeName = 'Payment Issue'
        } else if (concernLowerInput.includes('3') || concernLowerInput.includes('behavior')) {
          concernType = 'BEHAVIOR'
          concernTypeName = 'Behavior'
        } else if (concernLowerInput.includes('4') || concernLowerInput.includes('safety')) {
          concernType = 'SAFETY'
          concernTypeName = 'Safety'
        } else if (concernLowerInput.includes('5') || concernLowerInput.includes('other')) {
          concernType = 'OTHER'
          concernTypeName = 'Other'
        }
        
        setConcernData({ ...concernData, type: concernType, typeName: concernTypeName })
        addBotMessage(t('chatbot.concernFlowDescription') || 'Please describe your concern in detail. What happened and how can we help?')
        break

      case 'description':
        // Get typeName from current concernData state (set in previous step)
        const currentTypeName = concernData.typeName || (concernData.type === 'WORK_QUALITY' ? 'Work Quality' : 
          concernData.type === 'PAYMENT_ISSUE' ? 'Payment Issue' :
          concernData.type === 'BEHAVIOR' ? 'Behavior' :
          concernData.type === 'SAFETY' ? 'Safety' : 'Other')
        const finalDescription = userInput.trim()
        const finalConcernData = { ...concernData, description: finalDescription, typeName: currentTypeName }
        setConcernData(finalConcernData)
        
        // Replace placeholders in translation or use direct message
        const confirmMessage = (t('chatbot.concernFlowConfirm') || 'Please confirm:\n\nConcern Type: {type}\nDescription: {description}\n\nClick the buttons below to confirm or cancel.')
          .replace('{type}', finalConcernData.typeName || 'Other')
          .replace('{description}', finalConcernData.description || finalDescription)
          .replace('Type "confirm" to proceed to dashboard or "cancel" to start over.', 'Click the buttons below to confirm or cancel.')
          .replace('डैशबोर्ड पर आगे बढ़ने के लिए "पुष्टि करें" टाइप करें या फिर से शुरू करने के लिए "रद्द करें"।', 'नीचे दिए गए बटन पर क्लिक करें।')
        
        addBotMessage(confirmMessage, 300)
        setTimeout(() => {
          addMessage('', 'bot', [
            'Confirm',
            'Cancel'
          ])
        }, 500)
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
    // Only worker types are required, everything else is optional except pin code
    if (!requestData.workerTypes) return 'workerTypes'
    if (!requestData.workerCountText) return 'workerCount'
    // Optional fields - only ask if not set
    if (requestData.workType === undefined) return 'workType'
    if (requestData.startDate === undefined && requestData.endDate === undefined) return 'dates'
    // Location is required (for pin code), but can be asked in optionalFields if not provided
    if (requestData.location === undefined && requestData.useCurrentLocation === undefined && !requestData.pinCode) return 'location'
    // Pin code is mandatory - check if we have it
    if (!requestData.pinCode || requestData.pinCode.length !== 6) {
      // If we're in optionalFields, we'll handle pin code there
      if (requestData.optionalFieldsAsked === undefined) return 'optionalFields'
      // If optionalFields was asked but pin code still missing, go back to location
      return 'location'
    }
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

  const navigateToConcernForm = async () => {
    // Create concern directly from chatbot
    setIsTyping(true)
    addBotMessage(t('chatbot.creatingConcern') || 'Creating your concern...', 300)
    
    try {
      const data: any = {
        description: concernData.description?.trim() || '',
        type: concernData.type || 'OTHER'
      }
      
      if (concernData.requestId) {
        data.requestId = parseInt(concernData.requestId)
      }
      
      if (concernData.relatedToUserId) {
        data.relatedToUserId = parseInt(concernData.relatedToUserId)
      }
      
      await apiClient.post('/concerns', data)
      
      setIsTyping(false)
      addBotMessage(t('chatbot.concernCreatedSuccess') || '✅ Your concern has been submitted successfully! Our admin team will review it and get back to you soon.', 300)
      
      // Reset concern flow
      setCurrentFlow('none')
      setConcernData({})
      
      setTimeout(() => {
        showQuickReplies()
      }, 2000)
    } catch (error: any) {
      setIsTyping(false)
      const errorMessage = error.response?.data?.message || t('chatbot.concernError') || 'Failed to submit concern. Please try again.'
      addBotMessage(t('chatbot.concernError') || `❌ ${errorMessage}\n\nWould you like to try again or visit your dashboard to submit it manually?`, 300)
      
      setTimeout(() => {
        addMessage('', 'bot', [
          'Try Again',
          'Go to Dashboard'
        ])
      }, 500)
    }
  }

  const showAdminStats = async () => {
    try {
      addBotMessage(t('chatbot.fetchingStats') || 'Fetching statistics...')
      setIsTyping(true)
      
      // Fetch real-time stats from API endpoints
      try {
        // Fetch all stats in parallel
        const [pendingRes, activeRes, workersRes, customersRes, concernsRes] = await Promise.all([
          apiClient.get('/admin/requests/pending').catch(() => ({ data: [] })),
          apiClient.get('/admin/requests/active').catch(() => ({ data: [] })),
          apiClient.get('/admin/workers').catch(() => ({ data: [] })),
          apiClient.get('/admin/customers').catch(() => ({ data: [] })),
          apiClient.get('/admin/concerns').catch(() => ({ data: [] }))
        ])
        
        const pending = Array.isArray(pendingRes.data) ? pendingRes.data.length : 0
        const active = Array.isArray(activeRes.data) ? activeRes.data.length : 0
        const workers = Array.isArray(workersRes.data) ? workersRes.data.length : 0
        const customers = Array.isArray(customersRes.data) ? customersRes.data.length : 0
        const concerns = Array.isArray(concernsRes.data) 
          ? concernsRes.data.filter((c: any) => c.status === 'PENDING' || c.status === 'OPEN').length 
          : 0
        
        setIsTyping(false)
        const statsText = t('chatbot.adminStats')?.replace('{pending}', pending.toString())
          ?.replace('{active}', active.toString())
          ?.replace('{workers}', workers.toString())
          ?.replace('{customers}', customers.toString())
          ?.replace('{concerns}', concerns.toString())
          || `📊 Current Statistics:\n\n• Pending Requests: ${pending}\n• Active Requests: ${active}\n• Total Workers: ${workers}\n• Total Customers: ${customers}\n• Pending Concerns: ${concerns}\n\nVisit your dashboard for detailed information.`
        
        addBotMessage(statsText)
      } catch (apiError: any) {
        setIsTyping(false)
        // Fallback to props if API fails
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
      }
    } catch (error: any) {
      setIsTyping(false)
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
      } else if ((lowerText.includes('why') && lowerText.includes('unable') && lowerText.includes('accept')) ||
                 (lowerText.includes('why') && lowerText.includes('not') && lowerText.includes('able') && lowerText.includes('accept'))) {
        // Handle worker FAQ: Why unable to accept new request?
        addBotMessage(t('chatbot.workerFAQNotAccept') || 'Currently you are deployed on work, so you are not able to accept new requests during this period. Once you complete your current work assignment, you will be able to accept new requests again.\n\nYou can check your active work in the "Active Work" tab on your dashboard.')
        setTimeout(() => showQuickReplies(), 2000)
      } else if ((lowerText.includes('why') && lowerText.includes('not') && lowerText.includes('able') && lowerText.includes('available')) ||
                 (lowerText.includes('why') && lowerText.includes('unable') && lowerText.includes('available')) ||
                 (text.includes('उपलब्ध') && (text.includes('क्यों') || text.includes('नहीं')))) {
        // Handle worker FAQ: Why not able to make available?
        addBotMessage(t('chatbot.workerFAQNotAvailable') || 'Currently you are deployed on work, so you are not able to make yourself available. Once you complete your current work assignment, you will be able to make yourself available again.\n\nYou can check your active work in the "Active Work" tab on your dashboard.')
        setTimeout(() => showQuickReplies(), 2000)
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
      } else if (lowerText.includes('pending') && user?.role?.toLowerCase() === 'admin') {
        // Admin checking pending requests - handle this before generic "request" check
        showPendingRequests()
      } else if ((lowerText.includes('request') || lowerText.includes('create') || lowerText.includes('अनुरोध')) && !lowerText.includes('pending')) {
        // Only check for create request if it's not about pending requests
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
      } else if (user?.role?.toLowerCase() === 'worker' && (
        lowerText.match(/\b(why|how|can't|cannot|unable|not able|not working|disabled|click|accept|available|availability)\b.*\b(available|accept|notification|request|button|toggle|switch)\b/) ||
        lowerText.match(/\b(available|accept|notification|request)\b.*\b(why|how|can't|cannot|unable|not able|not working|disabled|click|button|toggle|switch)\b/)
      )) {
        // Worker asking about availability or accepting requests
        addBotMessage("I understand your concern! 🔍\n\nUntil your current work is not complete, you are not able to:\n\n• Make yourself available\n• Accept new requests from notifications\n\nThis is to ensure you can focus on completing your current assignments before taking on new work. Once you complete your current work, you'll be able to make yourself available and accept new requests again.\n\nYou can check your active work in the 'Active Work' tab on your dashboard.")
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

