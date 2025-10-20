'use client'

import { createClient } from '@/lib/client'
import { useCallback, useEffect, useState, useMemo, useRef } from 'react'

interface UseRealtimeChatProps {
  roomName: string
  userId: string
  username: string
  schoolId?: string
  onRoomFull?: () => void
}

export interface ChatMessage {
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

const EVENT_MESSAGE_TYPE = 'message'

export interface OtherUser {
  username: string
  schoolId?: string
}

export function useRealtimeChat({ roomName, userId, username, schoolId, onRoomFull }: UseRealtimeChatProps) {
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const isSubscribingRef = useRef(false)
  const retryCountRef = useRef(0)
  const maxRetries = 3
  
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [channel, setChannel] = useState<ReturnType<typeof supabase.channel> | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null)
  const [retryTrigger, setRetryTrigger] = useState(0)

  useEffect(() => {
    if (!roomName || !username || !userId) {
      console.log('Missing required data:', { roomName, username, userId })
      return
    }

    if (isSubscribingRef.current) {
      console.log('Already subscribing, skipping duplicate subscription')
      return
    }

    isSubscribingRef.current = true
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
      console.log('Full presence state:', state)
      
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
      
      setOnlineUsers(new Set(allUsers))
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
        console.log('Chat channel subscription status:', status, 'Retry count:', retryCountRef.current)
        
        if (status === 'SUBSCRIBED') {
          retryCountRef.current = 0 // Reset retry count on success
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
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Channel error/timeout:', status)
          setIsConnected(false)
          
          // Retry connection if under max retries
          if (retryCountRef.current < maxRetries) {
            retryCountRef.current++
            console.log(`Retrying connection (${retryCountRef.current}/${maxRetries})...`)
            
            // Clean up failed channel
            supabase.removeChannel(newChannel)
            isSubscribingRef.current = false
            
            // Retry after a delay
            setTimeout(() => {
              console.log('Triggering retry by updating retryTrigger')
              setRetryTrigger(prev => prev + 1)
            }, 2000 * retryCountRef.current) // Exponential backoff
          } else {
            console.error('Max retries reached. Connection failed.')
          }
        } else if (status === 'CLOSED') {
          console.log('Channel closed (this is normal on cleanup)')
          setIsConnected(false)
        }
      })

    setChannel(newChannel)

    return () => {
      console.log('Cleaning up channel:', roomName)
      isSubscribingRef.current = false
      retryCountRef.current = 0
      if (newChannel) {
        supabase.removeChannel(newChannel)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName, username, userId, schoolId, retryTrigger])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!channel || !isConnected || !roomName) {
        console.warn('Cannot send message - channel not ready:', { channel: !!channel, isConnected, roomName })
        return
      }

      console.log('Sending message:', content)

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

  const sendLeaveNotification = useCallback(
    async () => {
      if (!channel || !roomName) {
        console.warn('Cannot send leave notification - channel not ready')
        return
      }

      console.log('Sending leave notification for:', username)

      const leaveMessage: ChatMessage = {
        id: crypto.randomUUID(),
        content: `${username} has left the chat`,
        user: {
          name: 'System',
        },
        createdAt: new Date().toISOString(),
        type: 'system',
      }

      try {
        await channel.send({
          type: 'broadcast',
          event: EVENT_MESSAGE_TYPE,
          payload: leaveMessage,
        })
        console.log('Leave notification sent successfully')
      } catch (error) {
        console.error('Failed to send leave notification:', error)
      }
    },
    [channel, username, roomName]
  )

  return { messages, sendMessage, sendLeaveNotification, isConnected, onlineUsers, otherUser }
}
