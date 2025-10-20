import AppLayout from '@/layouts/app-layout'
import { RealtimeChat } from '@/components/realtime-chat'
import { ActiveUsersSidebar } from '@/components/active-users-sidebar'
import { UsernamePrompt } from '@/components/username-prompt'
import { getAnonymousUser, setAnonymousUser } from '@/lib/anonymous-user'
import { useEffect, useState } from 'react'
import { Link, Head, router } from '@inertiajs/react'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Users, SkipForward, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'

export default function Chat() {
  const [user, setUser] = useState<any>(null)
  const [roomName, setRoomName] = useState<string | null>(null)
  const [onlineCount, setOnlineCount] = useState(0)
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const [selectedUser, setSelectedUser] = useState<string | undefined>()
  
  useEffect(() => {
    setUser(getAnonymousUser())
    // Get room ID from localStorage
    const storedRoom = localStorage.getItem('current_room')
    if (!storedRoom) {
      // No room ID, redirect to home
      router.visit('/')
      return
    }
    setRoomName(storedRoom)
  }, [])
  
  // Check if this is a private message room
  const isPrivateMessage = roomName?.startsWith('dm-') || false
  const otherUsername = isPrivateMessage && user?.username && roomName
    ? roomName.replace('dm-', '').split('-').find((u) => u !== user.username)
    : null

  const handleUsernameSubmit = (username: string, school: string, preferredSchool: string) => {
    const newUser = { username, school, preferredSchool }
    setAnonymousUser(newUser)
    setUser(newUser)
  }

  if (!user) {
    return (
      <AppLayout>
        <Head title="Chat" />
        <UsernamePrompt onSubmit={handleUsernameSubmit} />
      </AppLayout>
    )
  }

  if (!roomName) {
    return (
      <AppLayout>
        <Head title="Chat" />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  // No database persistence - messages only exist in real-time

  const handleOnlineUsersChange = (users: Set<string>) => {
    setOnlineCount(users.size)
    setOnlineUsers(users)
  }

  const handleUserClick = (clickedUser: string) => {
    if (!user) return
    // Create a private room name by sorting usernames alphabetically
    const roomUsers = [user.username, clickedUser].sort()
    const privateRoomName = `dm-${roomUsers.join('-')}`
    router.visit(`/chat/${privateRoomName}`)
  }

  const handleNext = () => {
    toast.info('Finding a new person...')
    // Clear room from localStorage and go back to waiting room
    localStorage.removeItem('current_room')
    router.visit('/', {
      method: 'get',
      preserveState: false,
    })
  }

  const handleLeave = () => {
    // Clear room from localStorage and go back to waiting room
    localStorage.removeItem('current_room')
    router.visit('/', {
      method: 'get',
      preserveState: false,
    })
  }

  return (
    <AppLayout>
      <Head title={`Chat - ${roomName}`} />
      <div className="h-screen flex flex-col">
        <div className="border-b border-border px-4 py-3 flex items-center gap-3">
          <div className="flex-1 flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-full">
              <MessageSquare className="size-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-base">Anonymous Chat</h2>
              <p className="text-xs text-muted-foreground">
                {onlineCount > 1 ? `${onlineCount} people in chat` : 'Waiting for others...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleNext}>
              <SkipForward className="size-4 mr-2" />
              Next
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLeave}>
              <ArrowLeft className="size-4 mr-2" />
              Leave
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <RealtimeChat
            roomName={roomName}
            username={user.username}
            onOnlineUsersChange={handleOnlineUsersChange}
          />
        </div>
      </div>
    </AppLayout>
  )
}
