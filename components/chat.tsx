'use client'

import { RealtimeChat } from '@/components/realtime-chat'
import { UsernamePrompt } from '@/components/username-prompt'
import { getAnonymousUser, setAnonymousUser } from '@/lib/anonymous-user'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, SkipForward, MessageSquare, Loader2 } from 'lucide-react'
import { type OtherUser } from '@/hooks/use-realtime-chat'

export default function Chat() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [roomName, setRoomName] = useState<string | null>(null)
  const [userId, setUserId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null)
  const [previousOtherUser, setPreviousOtherUser] = useState<OtherUser | null>(null)
  const [userLeft, setUserLeft] = useState(false)
  const [countdown, setCountdown] = useState(5)
  const sendLeaveNotificationRef = useRef<(() => Promise<void>) | null>(null)
  
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

  const handleUsernameSubmit = (username: string, school: string) => {
    const newUser = { username, school }
    setAnonymousUser(newUser)
    setUser(newUser)
  }

  const handleNext = async () => {
    if (sendLeaveNotificationRef.current) {
      await sendLeaveNotificationRef.current()
    }
    localStorage.removeItem('current_room')
    router.push('/')
  }

  const handleLeave = () => {
    localStorage.removeItem('current_room')
    router.push('/')
  }

  const handleRoomFull = () => {
    console.error('Room is full, redirecting to home')
    localStorage.removeItem('current_room')
    router.push('/')
  }

  // Track when other user leaves
  useEffect(() => {
    if (previousOtherUser && !otherUser) {
      setUserLeft(true)
      setCountdown(5)

      const countdownInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval)
            handleNext()
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(countdownInterval)
    }

    if (otherUser) {
      setPreviousOtherUser(otherUser)
      setUserLeft(false)
    }
  }, [otherUser, previousOtherUser])

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <UsernamePrompt onSubmit={handleUsernameSubmit} />
      </div>
    )
  }

  if (isLoading || !roomName) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b border-border p-4 flex items-center justify-between bg-background">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLeave}
            className="rounded-full"
          >
            <ArrowLeft className="size-5" />
          </Button>
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
        <Button
          variant="outline"
          onClick={handleNext}
          className="gap-2"
        >
          <SkipForward className="size-4" />
          Next
        </Button>
      </div>

      {/* User Left Notification */}
      {userLeft && (
        <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border rounded-lg p-8 max-w-md text-center space-y-4 shadow-lg">
            <div className="text-4xl">👋</div>
            <h2 className="text-xl font-semibold">User has left the chat</h2>
            <p className="text-muted-foreground">
              Finding you a new person to chat with in {countdown} seconds...
            </p>
            <Button onClick={handleNext} className="w-full">
              Find Next Person Now
            </Button>
          </div>
        </div>
      )}

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
              <div className="flex items-center gap-2 justify-center">
                <div className="size-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="size-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="size-2 bg-primary rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
