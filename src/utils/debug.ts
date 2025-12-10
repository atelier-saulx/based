import { inspect, styleText } from 'node:util'
import { DbServer } from '../db-server/index.js'
import { concatUint8Arr } from './uint8.js'

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

export const debugBuffer = (
  x: any,
  start: number = 0,
  end: number = 0,
  label?: string,
) => {
  if (x === null || typeof x !== 'object') {
    console.log(x)
    return
  }

  if (Array.isArray(x) && x[0] instanceof Uint8Array) {
    debugBuffer(concatUint8Arr(x), start, end, label)
  } else if (x instanceof Uint8Array) {
    console.log(label || '')
    if (!end) {
      end = x.byteLength
    }

    let len = Math.max(4, String(end - start).length + 1)

    const w = Math.floor(process.stdout.columns / len) || 20
    const a = [...new Uint8Array(x.slice(start, end))]
    for (let i = 0; i < Math.ceil((end - start) / w); i++) {
      console.log(
        styleText(
          'gray',
          a
            .slice(i * w, (i + 1) * w)
            .map((v, j) => {
              return String(j + i * w).padStart(len - 1, '0')
            })
            .join(' '),
        ),
      )
      console.log(
        a
          .slice(i * w, (i + 1) * w)
          .map((v) => String(v).padStart(len - 1, '0'))
          .map((v, j) => {
            if (a[j + i * w] === 253) {
              return styleText('magenta', v)
            }
            if (a[j + i * w] === 255) {
              return styleText('blue', v)
            }
            if (a[j + i * w] === 254) {
              return styleText('green', v)
            }
            if (a[j + i * w] === 252) {
              return styleText('red', v)
            }
            if (a[j + i * w] === 250) {
              return styleText('redBright', v)
            }
            return v
          })
          .join(' '),
      )
    }
    console.log('')
    // -------------------------
  } else {
    console.log(x)
  }
}
