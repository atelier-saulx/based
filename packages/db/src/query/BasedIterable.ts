import { inspect } from 'node:util'
import { BasedQueryResponse } from './BasedQueryResponse.js'
import { BasedNode } from '../basedNode/index.js'
import picocolors from 'picocolors'

export class BasedIterable {
  constructor(buffer: Buffer, query: BasedQueryResponse) {
    this.#buffer = buffer
    this.#query = query
  }

  #buffer: Buffer
  #query: BasedQueryResponse;

  [inspect.custom](depth, { nested }) {
    const size = nested ? 1 : 10

    let str = ''
    let i = 0
    for (const x of this) {
      // @ts-ignore
      str += inspect(x, { nested: true })
      i++
      if (i > size) {
        break
      }
      // str += ','
    }

    const length = this.length

    if (length > 5) {
      str +=
        '  ' +
        picocolors.dim(picocolors.italic(`...${length - size} More items\n`))
    }

    str = `[\n${str.replaceAll('\n  }\n  ', '\n  },\n  ')}]\n`

    if (nested) {
      return str
    }

    return `${picocolors.bold(`BasedIterable[${this.#query.query.type.type}]`)} (${this.length}) ${str}`
  }

  *[Symbol.iterator]() {
    let i = 4
    while (i < this.#buffer.byteLength) {
      // read
      const index = this.#buffer[i]
      i++
      // read from tree
      if (index === 255) {
        const ctx = this.#query.query.type.responseCtx
        ctx.__o = i
        ctx.__q = this.#query
        yield ctx
        i += 4
      } else if (index === 0) {
        i += this.#query.query.mainLen
      } else {
        const size = this.#buffer.readUInt16LE(i)
        i += 2
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
    return this.#buffer.readUint32LE(0)
  }

  toObject() {
    const arr = new Array(this.length)
    let i = 0
    for (const item of this) {
      arr[i++] = item.toObject()
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
