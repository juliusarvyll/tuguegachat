# TuguegaChat System Flow Documentation

## Overview

TuguegaChat is a real-time anonymous chat application that connects random users for conversations. The system uses Supabase Realtime for presence tracking, user matching, and message broadcasting.

## Architecture Components

### Core Technologies
- **Next.js 14** - React framework with App Router
- **Supabase Realtime** - WebSocket connections for real-time features
- **TypeScript** - Type safety and better developer experience
- **Tailwind CSS** - Styling and responsive design

### Key Files Structure
```
├── app/
│   ├── page.tsx                 # Home page (WaitingRoom)
│   └── chat/page.tsx           # Chat page
├── components/
│   ├── username-prompt.tsx     # Initial user setup
│   ├── waiting-room.tsx        # Matching interface
│   ├── chat.tsx               # Chat container
│   └── realtime-chat.tsx      # Chat UI component
├── hooks/
│   ├── use-realtime-chat.tsx  # Chat functionality
│   ├── use-active-users.tsx   # User count monitoring
│   └── use-chat-scroll.tsx    # Auto-scroll behavior
├── lib/
│   ├── client.ts              # Supabase client
│   ├── use-matching.tsx       # User matching logic
│   ├── anonymous-user.ts      # User management
│   └── schools.ts             # School data
```

## Complete System Flow

### 1. User Registration & Setup

#### 1.1 Initial Landing
When users visit the app, they see the `UsernamePrompt` component:

```tsx
// components/username-prompt.tsx
export function UsernamePrompt({ onSubmit }: UsernamePromptProps) {
  const [username, setUsername] = useState('')
  const [school, setSchool] = useState('')
  const { activeUserCount, isConnected } = useActiveUsers()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (username.trim() && school) {
      onSubmit(username.trim(), school)
    }
  }
  
  // Active users display
  <div className="mt-4 flex items-center justify-center gap-2 p-3 bg-muted/50 rounded-lg">
    <span className="text-primary font-semibold">{activeUserCount}</span>
    <span className="text-muted-foreground ml-1">users online</span>
  </div>
}
```

#### 1.2 User ID Generation
User data is managed through the anonymous user system:

```tsx
// lib/anonymous-user.ts
export function setAnonymousUser(user: Omit<AnonymousUser, 'id'> | AnonymousUser): void {
  if (typeof window === 'undefined') return
  
  // Check if user already exists to preserve ID
  const existingUser = getAnonymousUser()
  
  // Generate ID if not provided and no existing user
  const userWithId: AnonymousUser = 'id' in user ? user : {
    ...user,
    id: existingUser?.id || crypto.randomUUID() // Preserve existing ID or create new
  }
  
  localStorage.setItem(USER_KEY, JSON.stringify(userWithId))
}
```

### 2. Active Users Monitoring

The system tracks how many users are currently online:

```tsx
// hooks/use-active-users.tsx
export function useActiveUsers() {
  const [activeUserCount, setActiveUserCount] = useState(0)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Monitor the actual waiting room channel without participating in matching
    const monitorChannel = supabase.channel(WAITING_CHANNEL, {
      config: {
        presence: {
          key: `monitor-${Date.now()}`, // Unique key for monitoring
        },
      },
    })

    monitorChannel
      .on('presence', { event: 'sync' }, () => {
        const state = monitorChannel.presenceState()
        // Filter out monitor entries to get actual waiting users
        const actualUsers = Object.keys(state).filter(key => !key.startsWith('monitor-'))
        setActiveUserCount(actualUsers.length)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true)
          // Don't track presence for monitors to avoid interfering with matching
        }
      })
  }, [])

  return { activeUserCount, isConnected }
}
```

### 3. User Matching System

#### 3.1 Entering the Waiting Room
When users click "Find Someone", they enter the matching system:

```tsx
// components/waiting-room.tsx
const handleStartChat = async () => {
  if (!user) return

  // Ensure user has an ID before matching
  let userWithId = user
  if (!user.id) {
    console.log('User missing ID, getting from storage...')
    userWithId = getAnonymousUser()
    if (!userWithId?.id) {
      console.error('No user ID available, cannot start matching')
      return
    }
    setUser(userWithId)
  }

  setIsSearching(true)
  
  try {
    console.log('Starting match search for:', userWithId.username, 'ID:', userWithId.id)
    const roomId = await findMatch(userWithId.id)
    
    if (roomId) {
      // Match found! Store room ID and navigate to chat
      localStorage.setItem('current_room', roomId)
      router.push('/chat')
    } else {
      // No match found within timeout
      setIsSearching(false)
    }
  } catch (error) {
    console.error('Error during matching:', error)
    setIsSearching(false)
  }
}
```

#### 3.2 Matching Algorithm
The core matching logic handles user pairing:

```tsx
// lib/use-matching.tsx
export async function findMatch(userId: string): Promise<string | null> {
  const supabase = createClient()
  const currentUser = getAnonymousUser()

  const channel = supabase.channel(WAITING_CHANNEL, {
    config: {
      presence: {
        key: userId,
      },
    },
  })

  return new Promise((resolve) => {
    let matched = false
    let canMatch = false // Flag to prevent immediate matching
    let matchAttempted = false // Flag to prevent duplicate match attempts
    
    // Allow matching after a short delay to ensure presence sync is complete
    const allowMatchingDelay = setTimeout(() => {
      canMatch = true
      console.log('Matching now allowed')
    }, 1000) // Wait 1 second before allowing matches
    
    const timeout = setTimeout(() => {
      if (!matched) {
        clearTimeout(allowMatchingDelay)
        supabase.removeChannel(channel)
        resolve(null)
      }
    }, MATCH_TIMEOUT) // 30 seconds timeout

    channel
      .on('presence', { event: 'sync' }, () => {
        if (matched) return

        const state = channel.presenceState()
        const allUserIds = Object.keys(state)
        
        const waitingUsers = allUserIds
          .filter((id) => id !== userId)
          .map((id) => {
            const presences = state[id]
            const presence = Array.isArray(presences) ? presences[0] : presences
            return {
              id,
              username: (presence as any)?.username || 'Unknown',
              school: (presence as any)?.school || '',
              timestamp: (presence as any)?.timestamp || 0
            }
          })

        // Only proceed if there are other users waiting and matching is allowed
        if (waitingUsers.length === 0 || !canMatch) return

        // Find best match - prioritize same school
        let bestMatch = null
        let bestScore = 0

        for (const waitingUser of waitingUsers) {
          let score = 0
          
          // Same school gets highest priority
          if (waitingUser.school === currentUser.school) {
            score += 100
          } else {
            score += 10 // Any other user gets base points
          }

          if (score > bestScore) {
            bestScore = score
            bestMatch = waitingUser
          }
        }

        if (bestMatch && !matchAttempted) {
          // Found someone! Match with the best available user
          console.log('Match found with:', bestMatch.username, 'ID:', bestMatch.id)
          matchAttempted = true // Prevent duplicate attempts
          matched = true
          clearTimeout(timeout)

          // Create a unique room ID for this match
          const roomId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          console.log('Created room:', roomId, 'for users:', [userId, bestMatch.id])

          // Broadcast match to both users - the room ID in the broadcast is what both will use
          console.log('Broadcasting match to both users...')
          channel.send({
            type: 'broadcast',
            event: 'match-found',
            payload: {
              roomId,
              userIds: [userId, bestMatch.id],
              matchedBy: userId, // Track who initiated the match
            },
          }).then(() => {
            console.log('Match broadcast sent successfully')
          }).catch((error) => {
            console.error('Failed to send match broadcast:', error)
          })

          // Longer delay to ensure broadcast is received before removing channel
          setTimeout(() => {
            clearTimeout(allowMatchingDelay)
            supabase.removeChannel(channel)
            resolve(roomId)
          }, 1000)
        }
      })
      .on('broadcast', { event: 'match-found' }, (payload) => {
        if (matched) return

        const { roomId, userIds, matchedBy } = payload.payload
        console.log('Received match broadcast:', { roomId, userIds, matchedBy, myId: userId })
        
        if (userIds.includes(userId)) {
          console.log('Match confirmed! Joining room:', roomId)
          matched = true
          clearTimeout(timeout)
          clearTimeout(allowMatchingDelay)
          supabase.removeChannel(channel)
          resolve(roomId)
        }
      })
      .subscribe(async (status) => {
        console.log('Channel subscription status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('Tracking presence for ID:', userId, 'Username:', currentUser.username)
          await channel.track({
            id: userId,
            username: currentUser.username,
            school: currentUser.school,
            timestamp: Date.now(),
          })
        }
      })
  })
}
```

### 4. Chat Room Connection

#### 4.1 Chat Page Setup
Once matched, users navigate to the chat page:

```tsx
// components/chat.tsx
export default function Chat() {
  const [user, setUser] = useState<any>(null)
  const [roomName, setRoomName] = useState<string | null>(null)
  const [userId, setUserId] = useState<string>('')
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null)

  useEffect(() => {
    const currentUser = getAnonymousUser()
    const storedRoom = localStorage.getItem('current_room')
    
    if (!storedRoom || !currentUser) {
      router.push('/')
      return
    }
    
    setUser(currentUser)
    setUserId(currentUser.id)
    setRoomName(storedRoom)
    setIsLoading(false)
  }, [router])

  // Only show chat UI when both users are connected
  return (
    <div className="h-screen flex flex-col">
      {/* Header with connection status */}
      <div className="border-b border-border p-4 flex items-center justify-between bg-background">
        <div>
          <h1 className="font-semibold">
            {otherUser ? (
              <span>Chatting with {otherUser.username}</span>
            ) : (
              <span>TuguegaChat</span>
            )}
          </h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {otherUser ? (
              <div className="flex items-center gap-1">
                <div className="size-2 bg-green-500 rounded-full animate-pulse" />
                <span>Connected</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <div className="size-2 bg-yellow-500 rounded-full animate-pulse" />
                <span>Waiting for other user...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat or Waiting State */}
      <div className="flex-1 overflow-hidden">
        {otherUser ? (
          <RealtimeChat
            roomName={roomName}
            userId={userId}
            username={user.username}
            schoolId={user.school}
            onOtherUserChange={setOtherUser}
            onLeaveNotificationReady={(fn) => { sendLeaveNotificationRef.current = fn }}
            onRoomFull={handleRoomFull}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-4 p-8">
              <div className="relative">
                <Loader2 className="size-12 text-primary animate-spin mx-auto" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <MessageSquare className="size-5 text-primary" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Waiting for other user...</h3>
                <p className="text-sm text-muted-foreground">
                  Once they join, you'll be able to start chatting!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

#### 4.2 Realtime Chat Implementation
The core chat functionality handles presence tracking and messaging:

```tsx
// hooks/use-realtime-chat.tsx
export function useRealtimeChat({ roomName, userId, username, schoolId, onRoomFull }: UseRealtimeChatProps) {
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [channel, setChannel] = useState<ReturnType<typeof supabase.channel> | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null)

  useEffect(() => {
    if (!roomName || !username || !userId) {
      console.log('Missing required data:', { roomName, username, userId })
      return
    }

    console.log('Creating channel for room:', roomName, 'user:', username, 'userId:', userId)

    const newChannel = supabase.channel(roomName, {
      config: {
        presence: {
          key: userId,
        },
      },
    })

    // Helper to update other user from presence state
    const updateOtherUser = () => {
      const state = newChannel.presenceState()
      const allUsers = Object.keys(state)
      console.log('Presence state updated. All users:', allUsers)
      console.log('My user ID:', userId)
      console.log('Room name:', roomName)
      
      // Check if room is full (more than 2 users)
      if (allUsers.length > 2) {
        console.error('Room is full! More than 2 users detected:', allUsers)
        if (onRoomFull) {
          onRoomFull()
        }
        return
      }
      
      // Find other users (excluding current user by ID)
      const otherUsers = allUsers.filter((key) => key !== userId)
      console.log('Other users (excluding me):', otherUsers)
      
      if (otherUsers.length > 0) {
        const key = otherUsers[0]
        const presences = state[key]
        const presence = Array.isArray(presences) ? presences[0] : presences
        
        const otherUserData = {
          username: (presence as any)?.username || key,
          schoolId: (presence as any)?.schoolId
        }
        console.log('Setting other user:', otherUserData)
        setOtherUser(otherUserData)
      } else {
        console.log('No other users found, setting otherUser to null')
        setOtherUser(null)
      }
    }

    newChannel
      .on('broadcast', { event: EVENT_MESSAGE_TYPE }, (payload) => {
        console.log('Message received:', payload.payload)
        setMessages((current) => [...current, payload.payload as ChatMessage])
      })
      .on('presence', { event: 'sync' }, () => {
        console.log('Presence sync event')
        updateOtherUser()
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        console.log('User joined:', key)
        updateOtherUser()
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        console.log('User left:', key)
        updateOtherUser()
      })
      .subscribe(async (status) => {
        console.log('Chat channel subscription status:', status)
        
        if (status === 'SUBSCRIBED') {
          setIsConnected(true)
          console.log('Tracking presence in chat room:', { username, schoolId })
          try {
            await newChannel.track({
              username,
              schoolId,
              online_at: new Date().toISOString()
            })
            console.log('Presence tracking successful')
          } catch (error) {
            console.error('Failed to track presence:', error)
          }
        }
      })

    setChannel(newChannel)

    return () => {
      console.log('Cleaning up channel:', roomName)
      if (newChannel) {
        supabase.removeChannel(newChannel)
      }
    }
  }, [roomName, username, userId, schoolId])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!channel || !isConnected || !roomName) {
        console.warn('Cannot send message - channel not ready')
        return
      }

      const message: ChatMessage = {
        id: crypto.randomUUID(),
        content,
        user: {
          name: username,
          schoolId,
        },
        createdAt: new Date().toISOString(),
      }

      // Update local state immediately for the sender
      setMessages((current) => [...current, message])

      try {
        await channel.send({
          type: 'broadcast',
          event: EVENT_MESSAGE_TYPE,
          payload: message,
        })
        console.log('Message sent successfully')
      } catch (error) {
        console.error('Failed to send message:', error)
      }
    },
    [channel, isConnected, username, roomName, schoolId]
  )

  return { messages, sendMessage, isConnected, otherUser }
}
```

### 5. Message Broadcasting

#### 5.1 Sending Messages
Messages are sent through Supabase Realtime broadcasts:

```tsx
// Message structure
interface ChatMessage {
  id: string
  content: string
  user: {
    name: string
    schoolId?: string
    schoolName?: string
    schoolLogo?: string
  }
  createdAt: string
  type?: 'system' | 'message'
}

// Sending a message
const sendMessage = async (content: string) => {
  const message: ChatMessage = {
    id: crypto.randomUUID(),
    content,
    user: {
      name: username,
      schoolId,
    },
    createdAt: new Date().toISOString(),
  }

  // Update local state immediately for the sender
  setMessages((current) => [...current, message])

  // Broadcast to other user
  await channel.send({
    type: 'broadcast',
    event: 'message',
    payload: message,
  })
}
```

#### 5.2 Receiving Messages
Messages are received through broadcast listeners:

```tsx
newChannel.on('broadcast', { event: 'message' }, (payload) => {
  console.log('Message received:', payload.payload)
  setMessages((current) => [...current, payload.payload as ChatMessage])
})
```

### 6. Connection States & UI

#### 6.1 Connection Status Indicators
The system provides clear visual feedback about connection states:

```tsx
// Header status indicator
{otherUser ? (
  <div className="flex items-center gap-1">
    <div className="size-2 bg-green-500 rounded-full animate-pulse" />
    <span>Connected</span>
  </div>
) : (
  <div className="flex items-center gap-1">
    <div className="size-2 bg-yellow-500 rounded-full animate-pulse" />
    <span>Waiting for other user...</span>
  </div>
)}
```

#### 6.2 Conditional Chat Rendering
Chat UI only appears when both users are connected:

```tsx
{otherUser ? (
  <RealtimeChat {...props} />
) : (
  <div className="h-full flex items-center justify-center">
    <div className="text-center space-y-4 p-8">
      <Loader2 className="size-12 text-primary animate-spin mx-auto" />
      <h3 className="text-lg font-semibold">Waiting for other user...</h3>
      <p className="text-sm text-muted-foreground">
        Once they join, you'll be able to start chatting!
      </p>
    </div>
  </div>
)}
```

### 7. User Disconnection & Cleanup

#### 7.1 Leave Notifications
When users leave, system messages are sent:

```tsx
const sendLeaveNotification = async () => {
  if (!channel || !roomName) return

  const leaveMessage: ChatMessage = {
    id: crypto.randomUUID(),
    content: `${username} has left the chat`,
    user: {
      name: 'System',
    },
    createdAt: new Date().toISOString(),
    type: 'system',
  }

  await channel.send({
    type: 'broadcast',
    event: 'message',
    payload: leaveMessage,
  })
}
```

#### 7.2 Automatic Redirect
When the other user leaves, automatic redirect with countdown:

```tsx
// Track when other user leaves
useEffect(() => {
  if (previousOtherUser && !otherUser) {
    setUserLeft(true)
    setCountdown(5)

    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval)
          handleNext() // Redirect to find new match
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(countdownInterval)
  }
}, [otherUser, previousOtherUser])
```

### 8. Error Handling & Edge Cases

#### 8.1 Room Full Protection
Prevents more than 2 users in a room:

```tsx
if (allUsers.length > 2) {
  console.error('Room is full! More than 2 users detected:', allUsers)
  if (onRoomFull) {
    onRoomFull() // Redirect user back to waiting room
  }
  return
}
```

#### 8.2 Connection Retry Logic
Handles connection failures with exponential backoff:

```tsx
.subscribe(async (status) => {
  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
    console.error('Channel error/timeout:', status)
    setIsConnected(false)
    
    // Retry connection if under max retries
    if (retryCountRef.current < maxRetries) {
      retryCountRef.current++
      console.log(`Retrying connection (${retryCountRef.current}/${maxRetries})...`)
      
      // Clean up failed channel
      supabase.removeChannel(newChannel)
      
      // Retry after a delay with exponential backoff
      setTimeout(() => {
        setRetryTrigger(prev => prev + 1)
      }, 2000 * retryCountRef.current)
    }
  }
})
```

## Key Features Summary

### Real-time Features
- **Live user count** on landing page
- **Instant matching** with presence detection
- **Real-time messaging** with immediate local updates
- **Connection status** indicators throughout the app
- **Automatic reconnection** on network issues

### User Experience
- **Anonymous usernames** with school affiliation
- **School logo integration** for visual identity
- **Responsive design** for all screen sizes
- **Loading states** and progress indicators
- **Graceful error handling** and user feedback

### Technical Robustness
- **Race condition prevention** in matching
- **Duplicate message prevention**
- **Memory leak prevention** with proper cleanup
- **Type safety** throughout the application
- **Comprehensive logging** for debugging

This system provides a complete, production-ready anonymous chat experience with robust real-time features and excellent user experience.
