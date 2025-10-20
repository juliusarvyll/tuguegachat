'use client'

import { RealtimeChat } from '@/components/realtime-chat'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { getAnonymousUser } from '@/lib/anonymous-user'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2, GraduationCap, SkipForward } from 'lucide-react'
import { getSchoolById } from '@/lib/schools'
import { type OtherUser } from '@/hooks/use-realtime-chat'
import Image from 'next/image'

export default function ChatPage() {
  const router = useRouter()
  const [roomId, setRoomId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string>('')
  const [username, setUsername] = useState<string>('')
  const [schoolId, setSchoolId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null)
  const [previousOtherUser, setPreviousOtherUser] = useState<OtherUser | null>(null)
  const [userLeft, setUserLeft] = useState(false)
  const [countdown, setCountdown] = useState(5)
  const sendLeaveNotificationRef = useRef<(() => Promise<void>) | null>(null)

  useEffect(() => {
    // Get room ID from localStorage
    const storedRoomId = localStorage.getItem('current_room')
    const user = getAnonymousUser()

    console.log('Chat page loaded - Room:', storedRoomId, 'User:', user)

    if (!storedRoomId || !user) {
      // No room or user found, redirect to home
      console.log('No room or user, redirecting to home')
      router.push('/')
      return
    }

    setRoomId(storedRoomId)
    setUserId(user.id)
    setUsername(user.username)
    setSchoolId(user.school)
    setIsLoading(false)
  }, [router])

  const handleLeaveChat = () => {
    localStorage.removeItem('current_room')
    router.push('/')
  }

  const handleRoomFull = () => {
    console.error('Room is full, redirecting to home')
    localStorage.removeItem('current_room')
    router.push('/')
  }

  const handleNext = async () => {
    // Send leave notification before leaving
    if (sendLeaveNotificationRef.current) {
      await sendLeaveNotificationRef.current()
    }
    localStorage.removeItem('current_room')
    router.push('/')
  }

  // Track when other user leaves
  useEffect(() => {
    if (previousOtherUser && !otherUser) {
      // Other user left
      console.log('Other user left, showing notification')
      setUserLeft(true)
      setCountdown(5)

      // Start countdown
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!roomId || !username) {
    return null
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b border-border p-4 flex items-center justify-between bg-background">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLeaveChat}
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
              {otherUser && otherUser.schoolId && getSchoolById(otherUser.schoolId) ? (
                <>
                  <Image
                    src={getSchoolById(otherUser.schoolId)!.logo}
                    alt={getSchoolById(otherUser.schoolId)!.name}
                    width={16}
                    height={16}
                    className="rounded object-contain"
                    style={{ height: 'auto' }}
                  />
                  <span>{getSchoolById(otherUser.schoolId)!.name}</span>
                </>
              ) : otherUser ? (
                <span>Waiting for school info...</span>
              ) : (
                <span>Waiting for other user...</span>
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

      {/* Chat */}
      <div className="flex-1 overflow-hidden">
        <RealtimeChat 
          roomName={roomId}
          userId={userId}
          username={username}
          schoolId={schoolId}
          onOtherUserChange={setOtherUser}
          onLeaveNotificationReady={(fn) => { sendLeaveNotificationRef.current = fn }}
          onRoomFull={handleRoomFull}
        />
      </div>
    </div>
  )
}
