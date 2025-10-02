import { useState, useEffect, useContext, useRef } from 'react'
import { Ctx } from './Ctx.js'
import { BasedClient, BasedClientQuery as BasedQuery } from '@based/client'
import { hash } from '@based/hash'

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
  },
  dependencies?: any,
): UseWindowState => {
  const [checksum, setCheckum] = useState(0)
  const cache = useRef<UseWindowState>()
  const client: BasedClient = useContext(Ctx)
  const queries = useRef<BasedQuery[]>()
  const unsubs = useRef<{}>()
  const raf = useRef<number>()
  const currModifyHash = useRef<string>()
  const currResetHash = useRef<number>()
  const modifyHash = `${opts.size}.${opts.persistent}`

  if (dependencies) {
    // complete reset
    const resetHash = hash(dependencies)
    if (currResetHash.current !== resetHash) {
      currResetHash.current = resetHash
      currModifyHash.current = null
      cache.current = null
    }
  }

  if (currModifyHash.current !== modifyHash) {
    // reset queries but keep cache
    for (const n in unsubs.current) {
      unsubs.current[n]()
    }
    if (raf.current) {
      cancelAnimationFrame(raf.current)
      raf.current = null
    }
    queries.current = []
    unsubs.current = {}
    currModifyHash.current = modifyHash

    if (!cache.current) {
      cache.current = { items: [], loading: true, checksum: 0 }
    }
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
      if (n in unsubs.current) return
      unsubs.current[n] = queries.current[n].subscribe(() => {
        if (raf.current) return
        raf.current = requestAnimationFrame(() => {
          raf.current = null
          setCheckum(
            queries.current.reduce((combined, { cache }) => {
              const checksum = cache?.c
              return checksum ? combined + checksum : combined
            }, 0),
          )
        })
      })
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
    cache.current.items = []
    cache.current.loading = false
    cache.current.checksum = checksum

    while (l--) {
      let i = size * l
      const q = queries.current[l]
      const m = i + size

      if (q) {
        if (q.cache) {
          let data = q.cache.v
          for (const i of path) {
            data = data?.[i]
          }
          if (data) {
            for (let j = 0; i < m; i++) {
              const item = data[j++]
              if (!item) break
              cache.current.items[i] = item
            }
          }
        } else {
          cache.current.loading = true
        }
      }

      // // fill up empty items with null
      // for (; i < m; i++) {
      //   if (!(i in cache.current.items)) {
      //     cache.current.items[i] = null
      //   }
      // }
    }
  }

  return cache.current
}
