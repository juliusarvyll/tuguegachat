import { useState } from 'react'
import Image from 'next/image'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { MessageSquare, Sparkles, GraduationCap } from 'lucide-react'
import { SCHOOLS, getSchoolById } from '@/lib/schools'

interface UsernamePromptProps {
  onSubmit: (username: string, school: string) => void
}

export function UsernamePrompt({ onSubmit }: UsernamePromptProps) {
  const [username, setUsername] = useState('')
  const [school, setSchool] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (username.trim() && school) {
      onSubmit(username.trim(), school)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-4 bg-primary/10 rounded-full w-fit">
            <MessageSquare className="size-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome to Anonymous Chat</CardTitle>
          <CardDescription>
            Choose a username and school to start chatting with random strangers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                maxLength={20}
                className="h-12 text-base"
              />
              <p className="text-xs text-muted-foreground">
                This will be your display name in the chat
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="school">
                <GraduationCap className="size-4 inline mr-2" />
                Your School
              </Label>
              <Select value={school} onValueChange={setSchool}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select your school">
                    {school && getSchoolById(school) && (
                      <div className="flex items-center gap-2">
                        <Image
                          src={getSchoolById(school)!.logo}
                          alt={getSchoolById(school)!.name}
                          width={24}
                          height={24}
                          className="rounded object-contain"
                          style={{ height: 'auto' }}
                        />
                        <span>{getSchoolById(school)!.name}</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SCHOOLS.map((school) => (
                    <SelectItem key={school.id} value={school.id}>
                      <div className="flex items-center gap-2">
                        <Image
                          src={school.logo}
                          alt={school.name}
                          width={24}
                          height={24}
                          className="rounded object-contain"
                          style={{ height: 'auto' }}
                        />
                        <span>{school.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                We'll use this to match you with students from similar schools
              </p>
            </div>

            <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="size-4 text-primary" />
                <span className="font-medium">Quick tips</span>
              </div>
              <ul className="space-y-1 text-xs text-muted-foreground ml-6">
                <li>• Choose any username you like</li>
                <li>• Stay anonymous and respectful</li>
                <li>• Messages are not saved</li>
                <li>• Have fun chatting!</li>
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

            <Button type="submit" className="w-full h-12 text-base" disabled={!username.trim() || !school}>
              Continue to Chat
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
