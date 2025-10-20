import { createClient } from '@/lib/client'
import { getAnonymousUser } from '@/lib/anonymous-user'

const WAITING_CHANNEL = 'waiting-room'
const MATCH_TIMEOUT = 30000 // 30 seconds

export interface WaitingUser {
  username: string
  school: string
  timestamp: number
}

export async function findMatch(username: string): Promise<string | null> {
  const supabase = createClient()
  const currentUser = getAnonymousUser()

  if (!currentUser) {
    return null
  }

  const channel = supabase.channel(WAITING_CHANNEL, {
    config: {
      presence: {
        key: username,
      },
    },
  })

  return new Promise((resolve) => {
    let matched = false
    const timeout = setTimeout(() => {
      if (!matched) {
        supabase.removeChannel(channel)
        resolve(null)
      }
    }, MATCH_TIMEOUT)

    channel
      .on('presence', { event: 'sync' }, () => {
        if (matched) return

        const state = channel.presenceState()
        const waitingUsers = Object.keys(state)
          .filter((user) => user !== username)
          .map((user) => {
            const presences = state[user]
            const presence = Array.isArray(presences) ? presences[0] : presences
            return {
              username: user,
              school: (presence as any)?.school || '',
              timestamp: (presence as any)?.timestamp || 0
            }
          })

        // Find best match - prioritize same school, then any available user
        let bestMatch = null
        let bestScore = 0

        for (const waitingUser of waitingUsers) {
          let score = 0

          // Same school gets highest priority
          if (waitingUser.school === currentUser.school) {
            score += 100
          } else {
            // Any other user gets base points
            score += 10
          }

          if (score > bestScore) {
            bestScore = score
            bestMatch = waitingUser
          }
        }

        if (bestMatch) {
          // Found someone! Match with the best available user
          matched = true
          clearTimeout(timeout)

          const roomId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

          // Broadcast match to both users
          channel.send({
            type: 'broadcast',
            event: 'match-found',
            payload: {
              roomId,
              users: [username, bestMatch.username],
            },
          })

          supabase.removeChannel(channel)
          resolve(roomId)
        }
      })
      .on('broadcast', { event: 'match-found' }, (payload) => {
        if (matched) return

        const { roomId, users } = payload.payload
        if (users.includes(username)) {
          matched = true
          clearTimeout(timeout)
          supabase.removeChannel(channel)
          resolve(roomId)
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            username,
            school: currentUser.school,
            timestamp: Date.now(),
          })
        }
      })
  })
}

export function generateRoomId(): string {
  return `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}
