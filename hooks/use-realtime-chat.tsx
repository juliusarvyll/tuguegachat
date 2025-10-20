'use client'

import { createClient } from '@/lib/client'
import { useCallback, useEffect, useState, useMemo, useRef } from 'react'

interface UseRealtimeChatProps {
  roomName: string
  username: string
  schoolId?: string
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

export function useRealtimeChat({ roomName, username, schoolId }: UseRealtimeChatProps) {
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [channel, setChannel] = useState<ReturnType<typeof supabase.channel> | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null)

  useEffect(() => {
    if (!roomName || !username) return

    const newChannel = supabase.channel(roomName, {
      config: {
        presence: {
          key: username,
        },
      },
    })

    // Helper to update other user from presence state
    const updateOtherUser = () => {
      const state = newChannel.presenceState()
      const allUsers = Object.keys(state)
      
      // Find other users (excluding current user)
      const otherUsers = allUsers.filter((key) => key !== username)
      
      if (otherUsers.length > 0) {
        const key = otherUsers[0]
        const presences = state[key]
        const presence = Array.isArray(presences) ? presences[0] : presences
        
        setOtherUser({
          username: (presence as any)?.username || key,
          schoolId: (presence as any)?.schoolId
        })
      } else {
        setOtherUser(null)
      }
      
      setOnlineUsers(new Set(allUsers))
    }

    newChannel
      .on('broadcast', { event: EVENT_MESSAGE_TYPE }, (payload) => {
        setMessages((current) => [...current, payload.payload as ChatMessage])
      })
      .on('presence', { event: 'sync' }, updateOtherUser)
      .on('presence', { event: 'join' }, updateOtherUser)
      .on('presence', { event: 'leave' }, updateOtherUser)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true)
          await newChannel.track({
            username,
            schoolId,
            online_at: new Date().toISOString()
          })
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setIsConnected(false)
        }
      })

    setChannel(newChannel)

    return () => {
      supabase.removeChannel(newChannel)
    }
  }, [roomName, username, schoolId, supabase])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!channel || !isConnected || !roomName) {
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
      } catch (error) {
        // Handle error silently
      }
    },
    [channel, isConnected, username, roomName, schoolId]
  )

  const sendLeaveNotification = useCallback(
    async () => {
      if (!channel || !roomName) {
        return
      }

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
      } catch (error) {
        // Handle error silently
      }
    },
    [channel, username, roomName]
  )

  return { messages, sendMessage, sendLeaveNotification, isConnected, onlineUsers, otherUser }
}
