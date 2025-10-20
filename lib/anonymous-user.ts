export interface AnonymousUser {
  username: string
  school: string
}

const USER_KEY = 'anonymous_user'

export function getAnonymousUser(): AnonymousUser | null {
  if (typeof window === 'undefined') return null
  const data = localStorage.getItem(USER_KEY)
  return data ? JSON.parse(data) : null
}

export function setAnonymousUser(user: AnonymousUser): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearAnonymousUser(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(USER_KEY)
}

export function hasAnonymousUser(): boolean {
  return getAnonymousUser() !== null
}
