'use client'

import { UsernamePrompt } from '@/components/username-prompt'
import { GroupRoomDialog } from '@/components/group-room-dialog'
import { getAnonymousUser, setAnonymousUser } from '@/lib/anonymous-user'
import { findMatch } from '@/lib/use-matching'
import { getSchoolById } from '@/lib/schools'
import { canJoinRoom } from '@/lib/group-rooms'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, MessageSquare, Users, Sparkles, GraduationCap, UserPlus, User } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

type ChatType = '1on1' | 'group' | 'solo'
type ViewMode = 'main' | 'group-rooms'

export default function WaitingRoom() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [searchAttempt, setSearchAttempt] = useState(0)
  const [selectedChatType, setSelectedChatType] = useState<ChatType | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('main')

  useEffect(() => {
    setUser(getAnonymousUser())
  }, [])

  const handleUsernameSubmit = (username: string, school: string) => {
    const newUser = { username, school }
    setAnonymousUser(newUser)
    setUser(newUser)
  }

  const handleStartChat = async (chatType: ChatType) => {
    if (!user) return

    // Handle group chat differently - show group room dialog
    if (chatType === 'group') {
      setViewMode('group-rooms')
      return
    }

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

    setSelectedChatType(chatType)
    setIsSearching(true)
    setSearchAttempt((prev) => prev + 1)

    try {
      console.log('Starting chat search for:', userWithId.username, 'ID:', userWithId.id, 'Type:', chatType)
      
      let roomId: string | null = null
      
      if (chatType === 'solo') {
        // For solo chat, create a unique room just for this user
        roomId = `solo-${userWithId.id}-${Date.now()}`
        console.log('Created solo room:', roomId)
      } else {
        // Regular 1-on-1 chat
        roomId = await findMatch(userWithId.id)
      }
      
      console.log('Match result:', roomId)
      
      if (roomId) {
        // Match found! Store room ID and chat type in localStorage and navigate to chat
        console.log('Match found! Navigating to chat with room:', roomId, 'Type:', chatType)
        localStorage.setItem('current_room', roomId)
        localStorage.setItem('chat_type', chatType)
        router.push('/chat')
      } else {
        // No match found within timeout
        console.log('No match found within timeout')
        setIsSearching(false)
        setSelectedChatType(null)
      }
    } catch (error) {
      console.error('Error during matching:', error)
      setIsSearching(false)
      setSelectedChatType(null)
    }
  }

  const handleCancelSearch = () => {
    setIsSearching(false)
    setSelectedChatType(null)
  }

  const handleGroupRoomCreated = async (roomId: string, hash: string) => {
    // Check if room can be joined before navigating
    const canJoin = await canJoinRoom(roomId)
    if (canJoin) {
      localStorage.setItem('current_room', roomId)
      localStorage.setItem('chat_type', 'group')
      localStorage.setItem('room_hash', hash)
      router.push('/chat')
    } else {
      console.error('Cannot join room - it may be full')
      // Could show an error message here
    }
  }

  const handleGroupRoomJoined = async (roomId: string) => {
    // Check if room can be joined before navigating
    const canJoin = await canJoinRoom(roomId)
    if (canJoin) {
      localStorage.setItem('current_room', roomId)
      localStorage.setItem('chat_type', 'group')
      router.push('/chat')
    } else {
      console.error('Cannot join room - it may be full or not exist')
      // Could show an error message here
    }
  }

  const handleBackToMain = () => {
    setViewMode('main')
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <UsernamePrompt onSubmit={handleUsernameSubmit} />
      </div>
    )
  }

  if (viewMode === 'group-rooms') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted/20">
        <GroupRoomDialog
          onRoomCreated={handleGroupRoomCreated}
          onRoomJoined={handleGroupRoomJoined}
          onCancel={handleBackToMain}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted/20">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-4 bg-primary/10 rounded-full w-fit">
              <MessageSquare className="size-12 text-primary" />
            </div>
            <CardTitle className="text-2xl">TuguegaChat</CardTitle>
            <CardDescription>
              Connect with random strangers for anonymous conversations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isSearching ? (
              <>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <div className="p-2 bg-background rounded-full">
                      <Users className="size-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Your profile</p>
                      <p className="text-xs text-muted-foreground">{user.username}</p>
                    </div>
                  </div>

                  {user.school && (
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                      <div className="p-2 bg-background rounded-full flex items-center justify-center">
                        {(() => {
                          const school = getSchoolById(user.school)
                          return school ? (
                            <Image
                              src={school.logo}
                              alt={school.name}
                              width={16}
                              height={16}
                              className="size-4 object-contain"
                            />
                          ) : (
                            <GraduationCap className="size-4" />
                          )
                        })()}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Your school</p>
                        <p className="text-xs text-muted-foreground">
                          {(() => {
                            const school = getSchoolById(user.school)
                            return school ? school.name : user.school
                          })()}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <Sparkles className="size-4 text-primary" />
                      <span className="font-medium">Choose your chat type</span>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">
                      Select how you'd like to chat today
                    </p>
                  </div>

                  <div className="space-y-2 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="flex items-start gap-2">
                      <div className="p-1 bg-amber-100 dark:bg-amber-900/50 rounded-full mt-0.5">
                        <span className="text-amber-600 dark:text-amber-400 text-xs">⚠</span>
                      </div>
                      <div className="text-sm">
                        <p className="font-medium text-amber-800 dark:text-amber-200">
                          Privacy Notice
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                          For your safety, please use an <strong>anonymous username</strong> and avoid sharing personal information.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chat Type Selection */}
                <div className="space-y-3">
                  <Button 
                    onClick={() => handleStartChat('1on1')} 
                    className="w-full h-14 text-base justify-start"
                    variant="outline"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <MessageSquare className="size-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">1-on-1 Chat</p>
                        <p className="text-xs text-muted-foreground">Chat with one random person</p>
                      </div>
                    </div>
                  </Button>

                  <Button 
                    onClick={() => handleStartChat('group')} 
                    className="w-full h-14 text-base justify-start"
                    variant="outline"
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <UserPlus className="size-5 text-primary" />
                      </div>
                      <div className="text-left flex-1">
                        <p className="font-medium">Group Chat Rooms</p>
                        <p className="text-xs text-muted-foreground">Create public/private rooms or join randomly</p>
                      </div>
                    </div>
                  </Button>

                  <Button 
                    onClick={() => handleStartChat('solo')} 
                    className="w-full h-14 text-base justify-start"
                    variant="outline"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <User className="size-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">Solo Anonymous Space</p>
                        <p className="text-xs text-muted-foreground">Private space for thoughts & notes</p>
                      </div>
                    </div>
                  </Button>
                </div>

                {searchAttempt > 0 && (
                  <p className="text-xs text-center text-muted-foreground">
                    No one found? Try again or wait for others to join
                  </p>
                )}
              </>
            ) : (
              <div className="space-y-6 py-8">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <Loader2 className="size-16 text-primary animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      {selectedChatType === 'solo' ? (
                        <User className="size-6 text-primary" />
                      ) : selectedChatType === 'group' ? (
                        <UserPlus className="size-6 text-primary" />
                      ) : (
                        <MessageSquare className="size-6 text-primary" />
                      )}
                    </div>
                  </div>
                  <div className="text-center space-y-1">
                    <h3 className="font-semibold text-lg">
                      {selectedChatType === 'solo' 
                        ? 'Creating your space...' 
                        : selectedChatType === 'group'
                        ? 'Finding group chat...'
                        : 'Finding someone...'
                      }
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedChatType === 'solo' 
                        ? 'Setting up your private anonymous space'
                        : selectedChatType === 'group'
                        ? 'Looking for group conversations to join'
                        : 'Looking for available users'
                      }
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 justify-center">
                  <div className="size-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="size-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="size-2 bg-primary rounded-full animate-bounce" />
                </div>

                <Button 
                  onClick={handleCancelSearch} 
                  variant="outline"
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  )
}
