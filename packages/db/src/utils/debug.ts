import { inspect, styleText } from 'node:util'
import { DbServer } from '../db-server/index.js'

export const debugMode = (target, getInfo?: (key: string) => any) => {
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
  ] as const
  let colorKey = 0
  for (const key of keys) {
    const fn = target[key]
    if (typeof fn === 'function') {
      let cnt = 0
      const color = colors[colorKey++ % colors.length]
      target[key] = function () {
        const arr = [styleText(color, `[${key}:${++cnt}]`)]
        const add = getInfo?.(key)
        if (add) arr.push(add)
        arr.push(...arguments)
        console.info(arr.map(info).join(' '))
        return fn.apply(target, arguments)
      }
    }
  }
}

export const debugServer = (server: DbServer) => debugMode(server, () => ``)
