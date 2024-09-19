import { Query } from './query.js'
import { inspect } from 'node:util'
import picocolors from 'picocolors'
import { QueryIncludeDef } from './types.js'
import { BasedNode } from '../basedNode/index.js'

const decimals = (v) => ~~(v * 100) / 100

const sizeCalc = (size: number) => {
  if (size > 1e6) {
    return `${decimals(size / 1e6)} mb`
  }
  if (size > 1e3) {
    return `${decimals(size / 1e3)} kb`
  }
  return `${size} bytes`
}

const size = (size: number) => {
  const str = sizeCalc(size)
  if (size > 1e3 * 1e3 * 25) {
    return picocolors.red(str)
  } else {
    return picocolors.green(str)
  }
}

const timeCalc = (time: number) => {
  if (time > 1e3) {
    return `${decimals(time / 1e3)} s`
  }
  return `${decimals(time)} ms`
}

const time = (time: number) => {
  const str = timeCalc(time)
  if (time > 1e3) {
    return picocolors.red(str)
  } else {
    return picocolors.green(str)
  }
}

export const inspectData = (q: BasedQueryResponse, nested: boolean) => {
  const length = q.length
  const max = Math.min(length, nested ? 2 : 10)
  let str = ''
  let i = 0
  for (const x of q) {
    // @ts-ignore
    str += inspect(x, { nested: true })
    i++
    if (i >= max) {
      break
    }
    str += ',\n'
  }
  if (length > max) {
    str +=
      ',\n' + picocolors.dim(picocolors.italic(`...${length - max} More items`))
  }
  str = `[\n  ${str.replaceAll('\n', '\n  ').trim()}\n]`
  if (nested) {
    return str
  }
  return `${picocolors.bold(`BasedIterable[${q.query.schema.type}]`)} (${q.length}) ${str}`
}

export class BasedQueryResponse {
  buffer: Buffer
  execTime: number = 0
  // add mainLen thats included
  query: Query

  constructor(query: Query, buffer: Buffer) {
    this.buffer = buffer
    this.query = query
  }

  get size() {
    return this.buffer.byteLength
  }

  [inspect.custom](_depth) {
    const target = this.query.id
      ? this.query.schema.type + ':' + this.query.id
      : this.query.schema.type
    let str = ''
    str += '\n  execTime: ' + time(this.execTime)
    str += '\n  size: ' + size(this.size)
    const dataStr = inspectData(this, true).replaceAll('\n', '\n  ').trim()
    str += '\n  ' + dataStr

    return `${picocolors.bold(`BasedQueryResponse[${target}]`)} {${str}\n}\n`
  }

  // bit weird...
  node(index: number = 0) {
    let i = 0
    for (const x of this) {
      if (i === index) {
        return x
      }
      i++
    }
    return null
  }

  *[Symbol.iterator]() {
    let i = 4
    console.log('')
    const a = [...new Uint8Array(this.buffer)]
    for (let i = 0; i < Math.ceil(this.buffer.byteLength / 20); i++) {
      console.log(
        picocolors.gray(
          a
            .slice(i * 20, (i + 1) * 20)
            .map((v, j) => {
              return String(j + i * 20).padStart(3, '0')
            })
            .join(' '),
        ),
      )
      console.log(
        a
          .slice(i * 20, (i + 1) * 20)
          .map((v) => String(v).padStart(3, '0'))
          .map((v, j) => {
            if (a[j + i * 20] === 255) {
              return picocolors.blue(v)
            }
            if (a[j + i * 20] === 254) {
              return picocolors.green(v)
            }
            return v
          })
          .join(' '),
      )
    }
    console.log('')

    while (i < this.buffer.byteLength) {
      const index = this.buffer[i]
      i++
      if (index === 255) {
        const ctx = this.query.schema.responseCtx
        ctx.__o = i
        ctx.__q = this
        ctx.__r = null
        yield ctx
        i += 4
      } else if (index === 254) {
        const size = this.buffer.readUInt32LE(i + 1)
        i += size + 5
      } else if (index === 0) {
        i += this.query.includeDef.mainLen
      } else {
        const size = this.buffer.readUInt32LE(i)
        i += 4
        i += size
      }
    }
  }

  forEach(fn: (item: BasedNode, key: number) => void) {
    let i = 0
    for (const item of this) {
      fn(item, ++i)
    }
  }

  map(fn: (item: BasedNode, key: number) => any): any[] {
    const arr = new Array(this.length)
    let i = 0
    for (const item of this) {
      arr[i++] = fn(item, i)
    }
    return arr
  }

  get length() {
    return this.buffer.readUint32LE(0)
  }

  toObject() {
    const arr = new Array(this.length)
    let i = 0
    for (const item of this) {
      arr[i++] = item.toObject()
    }
    if (this.query.id) {
      return arr[0] ?? null
    }
    return arr
  }

  toJSON() {
    // TODO: optimize
    return JSON.stringify(this.toObject())
  }

  toString() {
    return this.toJSON()
  }
}
