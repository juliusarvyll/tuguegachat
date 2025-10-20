'use client'

import { createClient } from '@/lib/client'
import { useEffect, useState, useRef } from 'react'

const WAITING_CHANNEL = 'waiting-room'

export function useActiveUsers() {
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const [activeUserCount, setActiveUserCount] = useState(0)
  const [isConnected, setIsConnected] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    // Monitor the actual waiting room channel without participating in matching
    const monitorChannel = supabase.channel(WAITING_CHANNEL, {
      config: {
        presence: {
          key: `monitor-${Date.now()}`, // Unique key for monitoring
        },
      },
    })

    channelRef.current = monitorChannel

    monitorChannel
      .on('presence', { event: 'sync' }, () => {
        const state = monitorChannel.presenceState()
        // Filter out monitor entries to get actual waiting users
        const actualUsers = Object.keys(state).filter(key => !key.startsWith('monitor-'))
        console.log('Active users count updated:', actualUsers.length)
        setActiveUserCount(actualUsers.length)
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        if (!key.startsWith('monitor-')) {
          const state = monitorChannel.presenceState()
          const actualUsers = Object.keys(state).filter(k => !k.startsWith('monitor-'))
          setActiveUserCount(actualUsers.length)
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (!key.startsWith('monitor-')) {
          const state = monitorChannel.presenceState()
          const actualUsers = Object.keys(state).filter(k => !k.startsWith('monitor-'))
          setActiveUserCount(actualUsers.length)
        }
      })
      .subscribe(async (status) => {
        console.log('Active users monitor status:', status)
        if (status === 'SUBSCRIBED') {
          setIsConnected(true)
          // Don't track presence for monitors to avoid interfering with matching
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsConnected(false)
        }
      })

    return () => {
      console.log('Cleaning up active users monitor')
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [supabase])

  return { activeUserCount, isConnected }
}
