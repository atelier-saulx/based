import { inspect } from 'node:util'
import picocolors from 'picocolors'
import { DbServer } from './server/index.js'

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
