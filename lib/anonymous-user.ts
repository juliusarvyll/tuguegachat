export interface AnonymousUser {
  id: string
  username: string
  school: string
}

const USER_KEY = 'anonymous_user'

export function getAnonymousUser(): AnonymousUser | null {
  if (typeof window === 'undefined') return null
  const data = localStorage.getItem(USER_KEY)
  return data ? JSON.parse(data) : null
}

export function setAnonymousUser(user: Omit<AnonymousUser, 'id'> | AnonymousUser): void {
  if (typeof window === 'undefined') return
  
  // Check if user already exists to preserve ID
  const existingUser = getAnonymousUser()
  
  // Generate ID if not provided and no existing user
  const userWithId: AnonymousUser = 'id' in user ? user : {
    ...user,
    id: existingUser?.id || crypto.randomUUID()
  }
  
  localStorage.setItem(USER_KEY, JSON.stringify(userWithId))
}

export function clearAnonymousUser(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(USER_KEY)
}

export function hasAnonymousUser(): boolean {
  return getAnonymousUser() !== null
}
