'use client'

import { useEffect } from 'react'
import { clearAnonymousUser } from '@/lib/anonymous-user'

export function ClearStorageOnReload() {
  useEffect(() => {
    // Clear localStorage on mount (page load/reload)
    const handleBeforeUnload = () => {
      localStorage.removeItem('current_room')
      clearAnonymousUser()
    }

    // Clear on initial load
    localStorage.removeItem('current_room')
    clearAnonymousUser()

    // Also clear when user navigates away or closes tab
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  return null
}
