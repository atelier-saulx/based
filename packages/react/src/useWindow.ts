import { useState, useEffect, useContext, useRef } from 'react'
import { Ctx } from './Ctx'
import { BasedClient, BasedQuery } from '@based/client'

const resetHash = (opts) => {
  return `${opts.size}.${opts.persistent}`
}

type UseWindowState = {
  loading: boolean
  items: any[]
  checksum?: number
}

export const useWindow = (
  name: string,
  getPayload: ({ offset, limit }) => any,
  opts: {
    path: string[]
    pages: number[]
    size: number
    persistent?: boolean
  }
): UseWindowState => {
  const [checksum, setCheckum] = useState(0)
  const cache = useRef<UseWindowState>()
  const client: BasedClient = useContext(Ctx)
  const queries = useRef<BasedQuery[]>()
  const unsubs = useRef<{}>()
  const raf = useRef<number>()
  const optsHash = useRef<string>()
  const hash = resetHash(opts)

  if (optsHash.current !== hash) {
    for (const n in unsubs.current) {
      unsubs.current[n]()
    }
    if (raf.current) {
      cancelAnimationFrame(raf.current)
      raf.current = null
    }
    queries.current = []
    unsubs.current = {}
    optsHash.current = hash
  }

  if (!cache.current) {
    cache.current = { items: [], loading: true, checksum: 0 }
  }

  useEffect(() => {
    return () => {
      for (const n in unsubs.current) {
        unsubs.current[n]()
      }
      if (raf.current) {
        cancelAnimationFrame(raf.current)
      }
    }
  }, [])

  if (client && name) {
    const { pages, size, persistent = false, path } = opts
    const active = new Set()

    // add new subs
    pages.forEach((n) => {
      // pages start at 1 => shift to 0
      n -= 1
      active.add(n)
      if (!(n in queries.current)) {
        const payload = getPayload({ offset: n * size, limit: size })
        const q = client.query(name, payload, { persistent })
        queries.current[n] = q
      }
      if (!(n in unsubs.current)) {
        unsubs.current[n] = queries.current[n].subscribe(() => {
          if (!raf.current) {
            raf.current = requestAnimationFrame(() => {
              raf.current = null
              setCheckum(
                queries.current.reduce((combined, { cache }) => {
                  const checksum = cache?.checksum
                  return checksum ? combined + checksum : combined
                }, 0)
              )
            })
          }
        })
      }
    })

    // remove inactive subs
    queries.current.forEach((_, n) => {
      if (n in unsubs.current && !active.has(n)) {
        unsubs.current[n]()
        delete unsubs.current[n]
      }
    })

    if (cache.current.checksum === checksum) {
      return cache.current
    }

    let l = queries.current.length

    while (l--) {
      const q = queries.current[l]
      let i = size * l
      const m = size * l + size
      if (q) {
        if (q.cache) {
          let data = q.cache.value
          if (data) {
            for (const i of path) {
              data = data[i]
            }
            for (let j = 0; i < m; i++) {
              const item = data[j++]
              if (!item) break
              cache.current.items[i] = item
            }
          }
        }
      }
      for (; i < m; i++) {
        if (!(i in cache.current.items)) {
          cache.current.items[i] = null
        }
      }
    }

    cache.current.checksum = checksum
  }

  return cache.current
}
