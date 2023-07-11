import { useState, useEffect } from 'react'

export const useLoadingListeners: Set<Function> = new Set()
export const hooksLoading: Set<number> = new Set()
export const useLoading = () => {
  const [isLoading, setLoading] = useState(hooksLoading.size > 0)
  useEffect(() => {
    useLoadingListeners.add(setLoading)
    return () => {
      useLoadingListeners.delete(setLoading)
    }
  }, [])
  return isLoading
}
