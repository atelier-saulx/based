import { BasedClient, BasedQuery } from '@based/client'
import { renderToString } from 'react-dom/server'
import { createInlineCache } from '@based/client/ssr'
import { lastCollected } from './collectQuery.js'

// unsubscribe

const isActive: Map<number, { date: number; close?: () => void }> = new Map()

export const syncCacheScript = (queries: BasedQuery[]) => {
  const m: any = {}
  for (const q of queries) {
    m[q.id] = q.cache
  }
  return `<script>window.__basedcache__=${JSON.stringify(m)}</script>`
}

const subAsPromise = (q: BasedQuery) =>
  new Promise<{ id: number; close: () => void }>((resolve) => {
    let isresolved = false
    const rdy = () => {
      if (!isresolved) {
        isresolved = true
        resolve({ close, id: q.id })
      }
    }
    var close = q.subscribe(rdy, rdy)
  })

let isCleaning = false

const clean = () => {
  if (!isCleaning) {
    isCleaning = true
    setTimeout(() => {
      isCleaning = false
      const now = Date.now()
      isActive.forEach((v, k) => {
        if (v.close && v.date < now + 60e3) {
          v.close()
          isActive.delete(k)
        }
      })
      if (isActive.size > 0) {
        clean()
      }
    }, 60e3)
  }
}

// if this is used start clearing stuff
// opts keep cache time do it
export const render = async (
  reactApp: React.ReactElement,
  head?: React.ReactElement,
): Promise<{ html: string; head: string }> => {
  let headStr = head ? renderToString(head) : ''
  let html = renderToString(reactApp)
  let collected = lastCollected.q
  let d = Date.now()
  const rdy: Promise<{ id: number; close: () => void }>[] = []
  for (const q of lastCollected.q) {
    if (!isActive.has(q.id)) {
      rdy.push(subAsPromise(q))
      isActive.set(q.id, { date: d })
    } else {
      isActive.get(q.id).date = d
    }
  }
  if (rdy.length > 0) {
    collected = [...lastCollected.q]
    lastCollected.q = []
    const closers = await Promise.all(rdy)
    d = Date.now()
    for (const { id, close } of closers) {
      isActive.set(id, {
        close,
        date: d,
      })
    }
    headStr = head
      ? renderToString(head) + syncCacheScript(collected)
      : syncCacheScript(collected)
    html = renderToString(reactApp)
  } else {
    headStr = headStr + syncCacheScript(collected)
    lastCollected.q = []
  }

  clean()

  return { html, head: headStr }
}
