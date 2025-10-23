import { createClient } from '@/lib/client'
import { getAnonymousUser } from '@/lib/anonymous-user'

export interface GroupRoom {
  id: string
  hash: string
  name: string
  createdBy: string
  createdAt: string
  maxUsers: number
  currentUsers: number
  isActive: boolean
  isPublic: boolean
  description?: string
}

export interface GroupRoomUser {
  id: string
  username: string
  schoolId?: string
  joinedAt: string
}

const GROUP_ROOMS_CHANNEL = 'group-rooms'
const ROOM_HASH_LENGTH = 6

// Generate a unique room hash
export function generateRoomHash(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < ROOM_HASH_LENGTH; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Generate a room ID from hash
export function generateGroupRoomId(hash: string): string {
  return `group-${hash.toLowerCase()}`
}

// Validate room hash format
export function isValidRoomHash(hash: string): boolean {
  const regex = /^[A-Z0-9]{6}$/
  return regex.test(hash.toUpperCase())
}

// Create a new group room
export async function createGroupRoom(
  roomName: string, 
  maxUsers: number = 10, 
  isPublic: boolean = false,
  description?: string
): Promise<{ room: GroupRoom; hash: string } | null> {
  const supabase = createClient()
  const currentUser = getAnonymousUser()

  if (!currentUser) {
    console.error('No current user found')
    return null
  }

  const hash = generateRoomHash()
  const roomId = generateGroupRoomId(hash)
  
  const room: GroupRoom = {
    id: roomId,
    hash,
    name: roomName,
    createdBy: currentUser.id,
    createdAt: new Date().toISOString(),
    maxUsers,
    currentUsers: 0,
    isActive: true,
    isPublic,
    description
  }

  // Store room info in localStorage for persistence
  const existingRooms = getStoredGroupRooms()
  existingRooms[roomId] = room
  localStorage.setItem('group_rooms', JSON.stringify(existingRooms))

  console.log('Created group room:', room)
  return { room, hash }
}

// Join a group room by hash
export async function joinGroupRoom(hash: string): Promise<string | null> {
  const supabase = createClient()
  const currentUser = getAnonymousUser()

  if (!currentUser) {
    console.error('No current user found')
    return null
  }

  if (!isValidRoomHash(hash)) {
    console.error('Invalid room hash format')
    return null
  }

  const roomId = generateGroupRoomId(hash)
  console.log('Attempting to join group room:', roomId, 'with hash:', hash)

  // Check if room exists in local storage or create a placeholder
  const existingRooms = getStoredGroupRooms()
  if (!existingRooms[roomId]) {
    // Create a placeholder room entry
    existingRooms[roomId] = {
      id: roomId,
      hash: hash.toUpperCase(),
      name: `Room ${hash.toUpperCase()}`,
      createdBy: 'unknown',
      createdAt: new Date().toISOString(),
      maxUsers: 10,
      currentUsers: 0,
      isActive: true,
      isPublic: false // Default to private for unknown rooms
    }
    localStorage.setItem('group_rooms', JSON.stringify(existingRooms))
  }

  return roomId
}

// Get stored group rooms from localStorage
export function getStoredGroupRooms(): Record<string, GroupRoom> {
  if (typeof window === 'undefined') return {}
  
  const stored = localStorage.getItem('group_rooms')
  return stored ? JSON.parse(stored) : {}
}

// Get room info by hash
export function getRoomByHash(hash: string): GroupRoom | null {
  const rooms = getStoredGroupRooms()
  const roomId = generateGroupRoomId(hash)
  return rooms[roomId] || null
}

// Get all active rooms created by current user
export function getMyGroupRooms(): GroupRoom[] {
  const currentUser = getAnonymousUser()
  if (!currentUser) return []

  const rooms = getStoredGroupRooms()
  return Object.values(rooms).filter(room => 
    room.createdBy === currentUser.id && room.isActive
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

// Check if user can join room (not at max capacity)
export async function canJoinRoom(roomId: string): Promise<boolean> {
  const supabase = createClient()
  
  // Create a temporary channel to check current users
  const channel = supabase.channel(roomId)
  
  return new Promise((resolve) => {
    let resolved = false
    
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        supabase.removeChannel(channel)
        resolve(true) // Default to allowing join if we can't check
      }
    }, 3000)

    channel
      .on('presence', { event: 'sync' }, () => {
        if (resolved) return
        
        const state = channel.presenceState()
        const userCount = Object.keys(state).length
        const room = Object.values(getStoredGroupRooms()).find(r => r.id === roomId)
        const maxUsers = room?.maxUsers || 10
        
        console.log(`Room ${roomId} has ${userCount}/${maxUsers} users`)
        
        resolved = true
        clearTimeout(timeout)
        supabase.removeChannel(channel)
        resolve(userCount < maxUsers)
      })
      .subscribe()
  })
}

// Get all public rooms that are available to join
export function getPublicRooms(): GroupRoom[] {
  const rooms = getStoredGroupRooms()
  return Object.values(rooms).filter(room => 
    room.isPublic && room.isActive
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

// Join a random public room
export async function joinRandomPublicRoom(): Promise<string | null> {
  const publicRooms = getPublicRooms()
  
  if (publicRooms.length === 0) {
    console.log('No public rooms available')
    return null
  }

  // Filter rooms that aren't at capacity
  const availableRooms: GroupRoom[] = []
  
  for (const room of publicRooms) {
    const canJoin = await canJoinRoom(room.id)
    if (canJoin) {
      availableRooms.push(room)
    }
  }

  if (availableRooms.length === 0) {
    console.log('No available public rooms with space')
    return null
  }

  // Select a random available room
  const randomRoom = availableRooms[Math.floor(Math.random() * availableRooms.length)]
  console.log('Joining random public room:', randomRoom.name, randomRoom.id)
  
  return randomRoom.id
}

// Get room statistics for display
export function getRoomStats(): { total: number; public: number; private: number } {
  const rooms = getStoredGroupRooms()
  const activeRooms = Object.values(rooms).filter(room => room.isActive)
  
  return {
    total: activeRooms.length,
    public: activeRooms.filter(room => room.isPublic).length,
    private: activeRooms.filter(room => !room.isPublic).length
  }
}

// Clean up old/inactive rooms
export function cleanupGroupRooms(): void {
  const rooms = getStoredGroupRooms()
  const now = new Date()
  const maxAge = 24 * 60 * 60 * 1000 // 24 hours

  const activeRooms: Record<string, GroupRoom> = {}
  
  Object.values(rooms).forEach(room => {
    const roomAge = now.getTime() - new Date(room.createdAt).getTime()
    if (roomAge < maxAge && room.isActive) {
      activeRooms[room.id] = room
    }
  })

  localStorage.setItem('group_rooms', JSON.stringify(activeRooms))
}
