'use client'

import { UsernamePrompt } from '@/components/username-prompt'
import { getAnonymousUser, setAnonymousUser } from '@/lib/anonymous-user'
import { findMatch } from '@/lib/use-matching'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, MessageSquare, Users, Sparkles, GraduationCap } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter } from 'next/navigation'

export default function WaitingRoom() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [searchAttempt, setSearchAttempt] = useState(0)

  useEffect(() => {
    setUser(getAnonymousUser())
  }, [])

  const handleUsernameSubmit = (username: string, school: string) => {
    const newUser = { username, school }
    setAnonymousUser(newUser)
    setUser(newUser)
  }

  const handleStartChat = async () => {
    if (!user) return

    setIsSearching(true)
    setSearchAttempt((prev) => prev + 1)

    try {
      const roomId = await findMatch(user.username)
      
      if (roomId) {
        // Match found! Store room ID in localStorage and navigate to chat
        localStorage.setItem('current_room', roomId)
        router.push('/chat')
      } else {
        // No match found within timeout
        setIsSearching(false)
      }
    } catch (error) {
      setIsSearching(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <UsernamePrompt onSubmit={handleUsernameSubmit} />
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
                      <div className="p-2 bg-background rounded-full">
                        <GraduationCap className="size-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Your school</p>
                        <p className="text-xs text-muted-foreground">{user.school}</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <Sparkles className="size-4 text-primary" />
                      <span className="font-medium">How it works</span>
                    </div>
                    <ul className="space-y-1 text-xs text-muted-foreground ml-6">
                      <li>• Click "Find Someone" to start</li>
                      <li>• We'll match you with a random person</li>
                      <li>• Chat anonymously in real-time</li>
                      <li>• Leave anytime to find someone new</li>
                    </ul>
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

                <Button 
                  onClick={handleStartChat} 
                  className="w-full h-12 text-base"
                  size="lg"
                >
                  <MessageSquare className="size-5 mr-2" />
                  Find Someone to Chat
                </Button>

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
                      <Users className="size-6 text-primary" />
                    </div>
                  </div>
                  <div className="text-center space-y-1">
                    <h3 className="font-semibold text-lg">Finding someone...</h3>
                    <p className="text-sm text-muted-foreground">
                      Looking for available users
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 justify-center">
                  <div className="size-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="size-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="size-2 bg-primary rounded-full animate-bounce" />
                </div>

                <Button 
                  onClick={() => setIsSearching(false)} 
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
