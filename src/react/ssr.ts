import { renderToString } from 'react-dom/server'
import { lastCollected } from './collectQuery.js'
import { meta } from './Head.js'
import type { BasedClientQuery } from '../client/index.js'

// unsubscribe

const isActive: Map<number, { date: number; close?: () => void }> = new Map()

export const syncCacheScript = (queries: BasedClientQuery[]) => {
  const m: any = {}
  for (const q of queries) {
    m[q.id] = q.cache
  }
  return `<script>window.__basedcache__=${JSON.stringify(m)}</script>`
}

const subAsPromise = (q: BasedClientQuery) =>
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
          isActive.delete(k)
          v.close()
        }
      })
      if (isActive.size > 0) {
        clean()
      }
    }, 60e3)
  }
}

export const handleHeadComponents = (html: string) => {
  if (meta.isCalled) {
    const tmpHead = html.match(/<tmphead>(.*?)<\/tmphead>/g)
    const extractedHead = tmpHead
      ? tmpHead.join('\n').replace(/<\/?tmphead>/g, '')
      : ''
    return extractedHead ? `<!-- x6Wa2 -->${extractedHead}<!-- x6Wa2 -->` : ''
  } else {
    return ''
  }
}

// if this is used start clearing stuff
// opts keep cache time do it
export const render = async (
  reactApp: React.ReactElement,
  head?: React.ReactElement,
  depth: number = 0,
): Promise<{ html: string; head: string }> => {
  if (depth > 4) {
    console.warn(
      '@based/react/ssr render: Data depth is larger then 4, this can impact performance significantly',
    )
  }
  let headStr = head ? renderToString(head) : ''
  let html = renderToString(reactApp)
  let collected = lastCollected.q
  let d = Date.now()
  const rdy: Promise<{ id: number; close: () => void }>[] = []

  // HEAD COLLECTOR [] REACT ELEM

  for (const q of lastCollected.q) {
    if (!isActive.has(q.id)) {
      rdy.push(subAsPromise(q))
      isActive.set(q.id, { date: d })
    } else {
      isActive.get(q.id)!.date = d
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
    return render(reactApp, head, ++depth)
  } else {
    headStr = headStr + syncCacheScript(collected)
    lastCollected.q = []
  }

  clean()

  const extractedHeadComponents = handleHeadComponents(html)

  headStr = extractedHeadComponents + headStr

  if (extractedHeadComponents) {
    return {
      html: html.replace(/<tmphead>(.*?)<\/tmphead>/g, ''),
      head: headStr,
    }
  }

  return { html, head: headStr }
}
