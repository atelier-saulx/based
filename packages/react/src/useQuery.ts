import { useContext, useState, useEffect } from 'react'
import { BasedClient, BasedError } from '@based/client'
import { Ctx } from './Ctx'
import { hooksLoading, useLoadingListeners } from './useLoading'

export const useQuery = <T = any>(
  name?: string,
  payload?: any,
  opts?: {
    persistent: boolean
  }
): {
  loading: boolean
  data?: T
  error?: BasedError
  checksum?: number
} => {
  const client: BasedClient = useContext(Ctx)

  if (client && name) {
    const q = client.query(name, payload, opts)
    const { id, cache } = q
    const [checksumOrError, update] = useState<number | BasedError>(
      cache?.checksum
    )

    useEffect(() => {
      const unsubscribe = q.subscribe(
        (_, checksum) => {
          update(checksum)
        },
        (err) => {
          update(err)
        }
      )
      return () => {
        const isLoading = hooksLoading.size > 0
        if (hooksLoading.delete(id) && !(hooksLoading.size > 0) && isLoading) {
          useLoadingListeners.forEach((fn) => {
            fn(false)
          })
        }
        unsubscribe()
        update(0)
      }
    }, [id])

    if (checksumOrError) {
      const isLoading = hooksLoading.size > 0
      if (hooksLoading.delete(id)) {
        if (!(hooksLoading.size > 0) && isLoading) {
          useLoadingListeners.forEach((fn) => {
            fn(false)
          })
        }
      }

      if (typeof checksumOrError === 'number') {
        if (!cache) {
          return { loading: true }
        }

        return { loading: false, data: cache.value, checksum: checksumOrError }
      }

      return { loading: false, error: checksumOrError }
    }

    const isLoading = hooksLoading.size > 0
    if (hooksLoading.add(id)) {
      if (!isLoading) {
        useLoadingListeners.forEach((fn) => {
          fn(true)
        })
      }
    }

    return { loading: true }
  }

  useState()
  useEffect(() => {}, [null])

  return { loading: true }
}
