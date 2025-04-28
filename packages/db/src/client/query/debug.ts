import picocolors from 'picocolors'
import { isPropDef, REVERSE_TYPE_INDEX_MAP } from '@based/schema/def'
import { QueryDef, QueryDefType } from './types.js'
import { concatUint8Arr } from '@saulx/utils'

export const debugQueryDef = (q: QueryDef, returnIt?: boolean) => {
  const loggableObject: any = { type: 'bla', schema: null }
  const f = (a) => {
    if (a === null) {
      return null
    }
    if (a instanceof Buffer) {
      // RFE is this necessary?
      return new Uint8Array(a)
    }
    if (a instanceof Uint8Array) {
      return a
    }
    if (a instanceof Set) {
      return a
    }
    if (a instanceof Map) {
      const b = new Map()
      walk(a, b)
      return b
    } else if (typeof a === 'object') {
      if (a.type && a.include && a.filter && a.range) {
        return debugQueryDef(a, true)
      }
      if (isPropDef(a)) {
        return `${a.path.join('.')}: ${a.prop} ${REVERSE_TYPE_INDEX_MAP[a.typeIndex]}`
      } else {
        const b = Array.isArray(a) ? [] : {}
        walk(a, b)
        return b
      }
    }
    return a
  }
  const walk = (a, b) => {
    if (a instanceof Map) {
      a.forEach((v, k) => {
        b.set(k, f(v))
      })
    } else {
      for (const key in a) {
        if (key === 'schema') {
          b[key] = `Schema [${a.schema?.type}]`
        } else {
          b[key] = f(a[key])
        }
      }
    }
  }
  walk(q, loggableObject)
  loggableObject.type = QueryDefType[q.type]
  if (!returnIt) {
    console.dir(loggableObject, { depth: 10 })
  }
  return loggableObject
}

export const debug = (
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
    debug(concatUint8Arr(x), start, end, label)
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
        picocolors.gray(
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
              return picocolors.magenta(v)
            }
            if (a[j + i * w] === 255) {
              return picocolors.blue(v)
            }
            if (a[j + i * w] === 254) {
              return picocolors.green(v)
            }
            if (a[j + i * w] === 252) {
              return picocolors.red(v)
            }
            return v
          })
          .join(' '),
      )
    }
    console.log('')
    // -------------------------
  } else if ('type' in x && 'schema' in x && 'props' in x) {
    debugQueryDef(x)
  }
}
