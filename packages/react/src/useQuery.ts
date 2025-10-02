import { useContext, useState, useEffect } from 'react'
import { BasedClient, ClientQueryMap as QueryMap } from '@based/client'
import { BasedError } from '@based/errors'
import { Ctx } from './Ctx.js'
import { hooksLoading, useLoadingListeners } from './useLoading.js'
import { collectQuery } from './collectQuery.js'

const IS_NODE = typeof window === 'undefined'

export const useQueries = <T = any>(
  name?: string,
  payloads?: any[],
  opts?: {
    persistent: boolean
  },
): {
  loading: boolean
  data?: T
  error?: BasedError
  checksum?: string
}[] => {
  const client: BasedClient = useContext(Ctx)
  let key = ''
  let sum = ''

  if (client && name) {
    const queries = Array(payloads.length)
    const result = payloads.map((payload, i) => {
      // @ts-ignore
      const q = client.query(name, payload, opts)
      const { id, cache } = q
      queries[i] = q
      key += id

      if (cache) {
        sum += cache.c
        return { loading: false, data: cache.v, checksum: cache.c }
      }

      return { loading: true }
    })

    const [, update] = useState(sum)

    useEffect(() => {
      let raf
      const listener = () => {
        if (!raf) {
          raf = requestAnimationFrame(() => {
            raf = null
            update(
              queries.reduce((sum, { cache }) => {
                return cache ? sum + cache.c : sum
              }, ''),
            )
          })
        }
      }

      const unsubs = queries.map((q) => {
        return q.subscribe(listener)
      })

      return () => {
        unsubs.forEach((unsubscribe) => unsubscribe())
        if (raf) {
          cancelAnimationFrame(raf)
        }
      }
    }, [key])

    return result
  }

  useState(sum)
  useEffect(() => {}, [key])

  return Array(payloads.length).fill({ loading: true })
}

/**
  Hook to observe data
  
  ```javascript
  const { data, error, loading } = useQuery('db', {
    children: { $list: true, id: true, name: true },
  })
  ```
*/
export const useQuery = <N extends keyof QueryMap>(
  name: N,
  payload?: QueryMap[N]['payload'],
  opts?: {
    persistent: boolean
  },
): {
  loading: boolean
  data?: QueryMap[N]['result']
  error?: BasedError
  checksum?: number
} => {
  const client: BasedClient = useContext(Ctx)

  if (client && name) {
    // @ts-ignore
    const q = client.query(name, payload, opts)
    const { id, cache } = q
    const [checksumOrError, update] = useState<number | BasedError>(cache?.c)

    useEffect(() => {
      const unsubscribe = q.subscribe(
        (_, checksum) => {
          update(checksum)
        },
        (err) => {
          update(err)
        },
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

    if (IS_NODE) {
      collectQuery(q)
    }

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

        return { loading: false, data: cache.v, checksum: checksumOrError }
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
