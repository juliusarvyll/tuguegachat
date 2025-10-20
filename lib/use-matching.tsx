import { createClient } from '@/lib/client'
import { getAnonymousUser } from '@/lib/anonymous-user'

const WAITING_CHANNEL = 'waiting-room'
const MATCH_TIMEOUT = 30000 // 30 seconds

export interface WaitingUser {
  id: string
  username: string
  school: string
  timestamp: number
}

export async function findMatch(userId: string): Promise<string | null> {
  const supabase = createClient()
  const currentUser = getAnonymousUser()

  console.log('findMatch called for ID:', userId, 'with user:', currentUser)

  if (!currentUser) {
    console.error('No current user found')
    return null
  }

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
    }, MATCH_TIMEOUT)

    channel
      .on('presence', { event: 'sync' }, () => {
        if (matched) return

        const state = channel.presenceState()
        console.log('Presence sync - current state:', state)
        const allUserIds = Object.keys(state)
        console.log('Total users in waiting room:', allUserIds.length, 'User IDs:', allUserIds)
        
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

        console.log('Waiting users (excluding me):', waitingUsers.length, waitingUsers)

        // Only proceed if there are other users waiting
        if (waitingUsers.length === 0) {
          console.log('No other users in waiting room yet, waiting...')
          return
        }

        // Check if matching is allowed yet
        if (!canMatch) {
          console.log('Matching not allowed yet, waiting for delay...')
          return
        }

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

          // Prefer users who joined earlier (to prevent race conditions)
          if (waitingUser.timestamp < Date.now()) {
            score += 1
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
        } else {
          console.log('Match not for me, ignoring')
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

export function generateRoomId(): string {
  return `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}
