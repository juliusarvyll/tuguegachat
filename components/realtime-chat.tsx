import { cn } from '@/lib/utils'
import { ChatMessageItem } from '@/components/chat-message'
import { useChatScroll } from '@/hooks/use-chat-scroll'
import {
  type ChatMessage,
  type OtherUser,
  useRealtimeChat,
} from '@/hooks/use-realtime-chat'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, useRef } from 'react'

interface RealtimeChatProps {
  roomName: string
  username: string
  schoolId?: string
  onMessage?: (messages: ChatMessage[]) => void
  onOnlineUsersChange?: (users: Set<string>) => void
  onOtherUserChange?: (user: OtherUser | null) => void
  onLeaveNotificationReady?: (sendLeave: () => Promise<void>) => void
  onRoomFull?: () => void
  messages?: ChatMessage[]
}

/**
 * Realtime chat component
 * @param roomName - The name of the room to join. Each room is a unique chat.
 * @param username - The username of the user
 * @param onMessage - The callback function to handle the messages. Useful if you want to store the messages in a database.
 * @param messages - The messages to display in the chat. Useful if you want to display messages from a database.
 * @returns The chat component
 */
export const RealtimeChat = ({
  roomName,
  username,
  schoolId,
  onMessage,
  onOnlineUsersChange,
  onOtherUserChange,
  onLeaveNotificationReady,
  onRoomFull,
  messages: initialMessages = [],
}: RealtimeChatProps) => {
  const { containerRef, scrollToBottom } = useChatScroll()

  const {
    messages: realtimeMessages,
    sendMessage,
    sendLeaveNotification,
    isConnected,
    onlineUsers,
    otherUser,
  } = useRealtimeChat({
    roomName,
    username,
    schoolId,
    onRoomFull,
  })
  const [newMessage, setNewMessage] = useState('')

  // Merge realtime messages with initial messages (if any)
  const allMessages = useMemo(() => {
    const mergedMessages = initialMessages ? [...initialMessages, ...realtimeMessages] : realtimeMessages
    // Remove duplicates based on message id
    const uniqueMessages = mergedMessages.filter(
      (msg, index, self) => index === self.findIndex((m) => m.id === msg.id)
    )
    // Sort by creation date
    const sortedMessages = uniqueMessages.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

    return sortedMessages
  }, [initialMessages, realtimeMessages])

  useEffect(() => {
    if (onMessage) {
      onMessage(allMessages)
    }
  }, [allMessages, onMessage])

  useEffect(() => {
    if (onOnlineUsersChange) {
      onOnlineUsersChange(onlineUsers)
    }
  }, [onlineUsers, onOnlineUsersChange])

  useEffect(() => {
    if (onOtherUserChange) {
      onOtherUserChange(otherUser)
    }
  }, [otherUser, onOtherUserChange])

  // Use ref to store the latest sendLeaveNotification without triggering effects
  const sendLeaveRef = useRef(sendLeaveNotification)
  
  useEffect(() => {
    sendLeaveRef.current = sendLeaveNotification
  }, [sendLeaveNotification])

  useEffect(() => {
    if (onLeaveNotificationReady) {
      onLeaveNotificationReady(() => sendLeaveRef.current())
    }
    // Only run once when component mounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onLeaveNotificationReady])

  useEffect(() => {
    // Scroll to bottom whenever messages change
    scrollToBottom()
  }, [allMessages, scrollToBottom])

  const handleSendMessage = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!newMessage.trim() || !isConnected) return

      sendMessage(newMessage)
      setNewMessage('')
    },
    [newMessage, isConnected, sendMessage]
  )

  return (
    <div className="flex flex-col h-full w-full bg-background text-foreground antialiased">
      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {allMessages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground">
            No messages yet. Start the conversation!
          </div>
        ) : null}
        <div className="space-y-1">
          {allMessages.map((message, index) => {
            const prevMessage = index > 0 ? allMessages[index - 1] : null
            const showHeader = !prevMessage || prevMessage.user.name !== message.user.name

            return (
              <div
                key={message.id}
                className="animate-in fade-in slide-in-from-bottom-4 duration-300"
              >
                <ChatMessageItem
                  message={message}
                  isOwnMessage={message.user.name === username}
                  showHeader={showHeader}
                />
              </div>
            )
          })}
        </div>
      </div>

      <form onSubmit={handleSendMessage} className="flex w-full gap-2 border-t border-border p-4">
        <Input
          className={cn(
            'rounded-full bg-background text-sm transition-all duration-300',
            isConnected && newMessage.trim() ? 'w-[calc(100%-36px)]' : 'w-full'
          )}
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          disabled={!isConnected}
        />
        {isConnected && newMessage.trim() && (
          <Button
            className="aspect-square rounded-full animate-in fade-in slide-in-from-right-4 duration-300"
            type="submit"
            disabled={!isConnected}
          >
            <Send className="size-4" />
          </Button>
        )}
      </form>
    </div>
  )
}
