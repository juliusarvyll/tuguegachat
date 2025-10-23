'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Hash, Users, Plus, ArrowRight, Copy, Check, Globe, Lock, Shuffle, Eye } from 'lucide-react'
import { createGroupRoom, joinGroupRoom, isValidRoomHash, joinRandomPublicRoom, getPublicRooms, getRoomStats } from '@/lib/group-rooms'

interface GroupRoomDialogProps {
  onRoomCreated: (roomId: string, hash: string) => void
  onRoomJoined: (roomId: string) => void
  onCancel: () => void
}

type DialogMode = 'select' | 'create' | 'join' | 'browse'

export function GroupRoomDialog({ onRoomCreated, onRoomJoined, onCancel }: GroupRoomDialogProps) {
  const [mode, setMode] = useState<DialogMode>('select')
  const [roomName, setRoomName] = useState('')
  const [roomHash, setRoomHash] = useState('')
  const [maxUsers, setMaxUsers] = useState(10)
  const [isPublic, setIsPublic] = useState(false)
  const [roomDescription, setRoomDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdHash, setCreatedHash] = useState('')
  const [hashCopied, setHashCopied] = useState(false)
  const [publicRooms, setPublicRooms] = useState<any[]>([])
  const [roomStats, setRoomStats] = useState({ total: 0, public: 0, private: 0 })

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      setError('Please enter a room name')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const result = await createGroupRoom(
        roomName.trim(), 
        maxUsers, 
        isPublic, 
        roomDescription.trim() || undefined
      )
      if (result) {
        setCreatedHash(result.hash)
        setMode('select') // Show success state
        // Don't automatically join, let user copy hash first
      } else {
        setError('Failed to create room. Please try again.')
      }
    } catch (err) {
      setError('An error occurred while creating the room')
      console.error('Error creating room:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinRoom = async () => {
    const hash = roomHash.trim().toUpperCase()
    
    if (!hash) {
      setError('Please enter a room hash')
      return
    }

    if (!isValidRoomHash(hash)) {
      setError('Invalid room hash format. Use 6 characters (A-Z, 0-9)')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const roomId = await joinGroupRoom(hash)
      if (roomId) {
        onRoomJoined(roomId)
      } else {
        setError('Failed to join room. Please check the hash and try again.')
      }
    } catch (err) {
      setError('An error occurred while joining the room')
      console.error('Error joining room:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinCreatedRoom = () => {
    if (createdHash) {
      onRoomCreated(`group-${createdHash.toLowerCase()}`, createdHash)
    }
  }

  const handleJoinRandomRoom = async () => {
    setIsLoading(true)
    setError('')

    try {
      const roomId = await joinRandomPublicRoom()
      if (roomId) {
        onRoomJoined(roomId)
      } else {
        setError('No available public rooms found. Try creating one!')
      }
    } catch (err) {
      setError('An error occurred while finding a room')
      console.error('Error joining random room:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinPublicRoom = (roomId: string) => {
    onRoomJoined(roomId)
  }

  // Load public rooms and stats when in browse mode
  useEffect(() => {
    if (mode === 'browse' || mode === 'select') {
      setPublicRooms(getPublicRooms())
      setRoomStats(getRoomStats())
    }
  }, [mode])

  const copyHashToClipboard = async () => {
    if (createdHash) {
      try {
        await navigator.clipboard.writeText(createdHash)
        setHashCopied(true)
        setTimeout(() => setHashCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy hash:', err)
      }
    }
  }

  if (createdHash) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-4 bg-green-100 dark:bg-green-900/20 rounded-full w-fit">
            <Check className="size-12 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl">Room Created!</CardTitle>
          <CardDescription>
            Share this hash with others to let them join your room
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Room Hash</Label>
            <div className="flex gap-2">
              <div className="flex-1 p-3 bg-muted rounded-lg font-mono text-lg text-center tracking-wider">
                {createdHash}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={copyHashToClipboard}
                className="shrink-0"
              >
                {hashCopied ? (
                  <Check className="size-4 text-green-600" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Others can use this hash to join your room
            </p>
          </div>

          <div className="space-y-2">
            <Button onClick={handleJoinCreatedRoom} className="w-full">
              <ArrowRight className="size-4 mr-2" />
              Join Your Room
            </Button>
            <Button onClick={onCancel} variant="outline" className="w-full">
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (mode === 'create') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-4 bg-primary/10 rounded-full w-fit">
            <Plus className="size-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Create Group Room</CardTitle>
          <CardDescription>
            Create a new room that others can join with a hash
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="roomName">Room Name</Label>
              <Input
                id="roomName"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Enter room name..."
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="roomDescription">Description (Optional)</Label>
              <Input
                id="roomDescription"
                value={roomDescription}
                onChange={(e) => setRoomDescription(e.target.value)}
                placeholder="What's this room about?"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxUsers">Max Users</Label>
              <Input
                id="maxUsers"
                type="number"
                value={maxUsers}
                onChange={(e) => setMaxUsers(Math.max(2, Math.min(20, parseInt(e.target.value) || 10)))}
                min={2}
                max={20}
              />
              <p className="text-xs text-muted-foreground">
                Between 2-20 users allowed
              </p>
            </div>

            <div className="space-y-3">
              <Label>Room Type</Label>
              <div className="space-y-2">
                <div 
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    !isPublic ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                  }`}
                  onClick={() => setIsPublic(false)}
                >
                  <div className="flex items-center gap-3">
                    <Lock className="size-4" />
                    <div>
                      <p className="font-medium">Private Room</p>
                      <p className="text-xs text-muted-foreground">Only accessible with hash code</p>
                    </div>
                  </div>
                </div>
                <div 
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    isPublic ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                  }`}
                  onClick={() => setIsPublic(true)}
                >
                  <div className="flex items-center gap-3">
                    <Globe className="size-4" />
                    <div>
                      <p className="font-medium">Public Room</p>
                      <p className="text-xs text-muted-foreground">Others can discover and join randomly</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Button 
              onClick={handleCreateRoom} 
              disabled={isLoading || !roomName.trim()}
              className="w-full"
            >
              {isLoading ? 'Creating...' : `Create ${isPublic ? 'Public' : 'Private'} Room`}
            </Button>
            <Button onClick={() => setMode('select')} variant="outline" className="w-full">
              Back
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (mode === 'join') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-4 bg-primary/10 rounded-full w-fit">
            <Hash className="size-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Join Group Room</CardTitle>
          <CardDescription>
            Enter a room hash to join an existing group chat
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="roomHash">Room Hash</Label>
            <Input
              id="roomHash"
              value={roomHash}
              onChange={(e) => setRoomHash(e.target.value.toUpperCase())}
              placeholder="Enter 6-character hash..."
              maxLength={6}
              className="font-mono text-center tracking-wider"
            />
            <p className="text-xs text-muted-foreground">
              Ask the room creator for the 6-character hash
            </p>
          </div>

          <div className="space-y-2">
            <Button 
              onClick={handleJoinRoom} 
              disabled={isLoading || !roomHash.trim()}
              className="w-full"
            >
              {isLoading ? 'Joining...' : 'Join Room'}
            </Button>
            <Button onClick={() => setMode('select')} variant="outline" className="w-full">
              Back
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (mode === 'browse') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-4 bg-primary/10 rounded-full w-fit">
            <Eye className="size-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Public Rooms</CardTitle>
          <CardDescription>
            Browse and join available public rooms
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {publicRooms.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {publicRooms.map((room) => (
                <div 
                  key={room.id}
                  className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => handleJoinPublicRoom(room.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{room.name}</p>
                      {room.description && (
                        <p className="text-xs text-muted-foreground">{room.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Max {room.maxUsers} users • Created {new Date(room.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No public rooms available</p>
              <p className="text-xs text-muted-foreground mt-1">Be the first to create one!</p>
            </div>
          )}

          <div className="space-y-2">
            <Button onClick={() => setMode('select')} variant="outline" className="w-full">
              Back
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Default selection mode
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 p-4 bg-primary/10 rounded-full w-fit">
          <Users className="size-12 text-primary" />
        </div>
        <CardTitle className="text-2xl">Group Rooms</CardTitle>
        <CardDescription>
          Create rooms, join with hash, or find public rooms
        </CardDescription>
        {roomStats.total > 0 && (
          <div className="text-xs text-muted-foreground mt-2">
            {roomStats.public} public • {roomStats.private} private rooms active
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={() => setMode('create')} className="w-full h-14 justify-start">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-full">
              <Plus className="size-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-medium">Create New Room</p>
              <p className="text-xs text-muted-foreground">Start a public or private room</p>
            </div>
          </div>
        </Button>

        <Button 
          onClick={handleJoinRandomRoom} 
          disabled={isLoading || roomStats.public === 0}
          variant="outline" 
          className="w-full h-14 justify-start"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-full">
              <Shuffle className="size-5 text-primary" />
            </div>
            <div className="text-left flex-1">
              <p className="font-medium">{isLoading ? 'Finding Room...' : 'Join Random Room'}</p>
              <p className="text-xs text-muted-foreground">
                {roomStats.public > 0 ? `${roomStats.public} public rooms available` : 'No public rooms available'}
              </p>
            </div>
          </div>
        </Button>

        <Button onClick={() => setMode('browse')} variant="outline" className="w-full h-14 justify-start">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-full">
              <Eye className="size-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-medium">Browse Public Rooms</p>
              <p className="text-xs text-muted-foreground">See all available public rooms</p>
            </div>
          </div>
        </Button>

        <Button onClick={() => setMode('join')} variant="outline" className="w-full h-14 justify-start">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-full">
              <Hash className="size-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-medium">Join with Hash</p>
              <p className="text-xs text-muted-foreground">Enter a room hash to join</p>
            </div>
          </div>
        </Button>

        <Button onClick={onCancel} variant="ghost" className="w-full">
          Cancel
        </Button>
      </CardContent>
    </Card>
  )
}
