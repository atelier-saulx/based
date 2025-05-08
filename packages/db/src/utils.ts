import { inspect } from 'node:util'
import picocolors from 'picocolors'
import { DbServer } from './server/index.js'
import { BasedDbQuery } from './client/query/BasedDbQuery.js'
import { OnError } from './client/query/subscription/types.js'
import { StrictSchema } from '@based/schema'

export const DECODER = new TextDecoder('utf-8')
export const ENCODER = new TextEncoder()

export const debugMode = (target, getInfo = null) => {
  const opts = { showHidden: false, depth: null, colors: true }
  const info = (v) => (typeof v === 'object' ? inspect(v, opts) : v)
  const proto = target.constructor.prototype
  const keys = new Set([
    ...Object.keys(Object.getOwnPropertyDescriptors(proto)),
    ...Object.keys(target),
  ])
  const colors = [
    'red',
    'green',
    'yellow',
    'blue',
    'magenta',
    'cyan',
    'redBright',
    'greenBright',
    'yellowBright',
    'blueBright',
    'magentaBright',
    'cyanBright',
  ]
  let colorKey = 0
  for (const key of keys) {
    const fn = target[key]
    if (typeof fn === 'function') {
      let cnt = 0

      const color = colors[colorKey++ % colors.length]
      target[key] = function () {
        const arr = [picocolors[color](`[${key}:${++cnt}]`)]
        const add = getInfo?.(key)
        if (add) arr.push(add)
        arr.push(...arguments)
        console.info(arr.map(info).join(' '))
        return fn.apply(target, arguments)
      }
    }
  }
}

export const debugServer = (server: DbServer) =>
  debugMode(
    server,
    () =>
      `p: ${server.processingQueries} m: ${server.modifyQueue.length} q: ${server.queryQueue.size}`,
  )

const exclude = new Set(['id', 'lastId', 'hash'])
export const schemaLooseEqual = (a: any, b: any, key?: string) => {
  if (a === b) {
    return true
  }
  const typeofA = typeof a
  if (typeofA !== 'object') {
    return exclude.has(key)
  }
  const typeofB = typeof b
  if (typeofA !== typeofB) {
    return exclude.has(key)
  }
  if (a === null || b === null) {
    return false
  }
  if (a.constructor !== b.constructor) {
    return false
  }
  if (Array.isArray(a)) {
    let i = a.length
    if (i !== b.length) {
      return false
    }
    while (i--) {
      if (!schemaLooseEqual(a[i], b[i])) {
        return false
      }
    }
  } else {
    for (const k in a) {
      if (!schemaLooseEqual(a[k], b[k], k)) {
        return false
      }
    }
    for (const k in b) {
      if (k in a) {
        continue
      }
      if (!schemaLooseEqual(a[k], b[k], k)) {
        return false
      }
    }
  }
  return true
}

export const getDefaultHooks = (server: DbServer, subInterval = 200) => {
  return {
    subscribe(
      q: BasedDbQuery,
      onData: (res: Uint8Array) => void,
      onError: OnError,
    ) {
      let timer: ReturnType<typeof setTimeout>
      let killed = false
      const poll = async () => {
        const res = await server.getQueryBuf(q.buffer)
        if (killed) {
          return
        }
        if (res.byteLength >= 8) {
          onData(res)
        } else if (res.byteLength === 1 && res[0] === 0) {
          console.info('schema mismatch, should resolve after update')
          // ignore update and stop polling
          return
        } else {
          onError(new Error('unexpected error'))
        }
        timer = setTimeout(poll, subInterval)
      }

      poll()

      return () => {
        clearTimeout(timer)
        killed = true
      }
    },
    setSchema(schema: StrictSchema, fromStart: boolean) {
      return Promise.resolve(server.setSchema(schema, fromStart))
    },
    flushModify(buf: Uint8Array) {
      const d = performance.now()
      const offsets = server.modify(buf)
      const dbWriteTime = performance.now() - d
      return Promise.resolve({
        offsets,
        dbWriteTime,
      })
    },
    getQueryBuf(buf: Uint8Array) {
      return Promise.resolve(server.getQueryBuf(buf))
    },
  }
}
