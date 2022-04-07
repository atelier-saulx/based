import { useEffect, useState } from 'react'

const errors = {}
const errorListeners = new Set()
const loadings = new Set()
const loadingListeners = new Set()

let isLoading = false
let lastError = ''
let errorCnt = 0
let errorKey = errorCnt + lastError

export function updateMeta(subKey, loading, error) {
  if (error) {
    lastError = error
    if (subKey in errors) {
      errors[subKey] = error
    } else {
      errors[subKey] = error
      errorCnt++
    }
  } else {
    if (subKey in errors) {
      errorCnt--
      delete errors[subKey]
    }
  }

  const newErrorKey = errorCnt + lastError
  if (newErrorKey !== errorKey) {
    errorKey = newErrorKey
    errorListeners.forEach((fn: Function) => fn(errorKey))
  }

  if (loading) {
    loadings.add(subKey)
  } else {
    loadings.delete(subKey)
  }

  const newLoading = !!loadings.size
  if (newLoading !== isLoading) {
    isLoading = newLoading
    loadingListeners.forEach((fn: Function) => fn(isLoading))
  }
}

export function useLoading() {
  const [, setLoading] = useState(isLoading)

  loadingListeners.add(setLoading)

  useEffect(() => {
    return () => {
      loadingListeners.delete(setLoading)
    }
  }, [])

  return { loading: isLoading }
}

export function useError() {
  const [, setError] = useState(errorKey)

  errorListeners.add(setError)

  useEffect(() => {
    return () => {
      errorListeners.delete(setError)
    }
  }, [])

  return { error: errorCnt ? lastError : null, errors: Object.values(errors) }
}
