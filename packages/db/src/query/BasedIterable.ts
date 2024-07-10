import { inspect } from 'node:util'
import { BasedQueryResponse } from './BasedQueryResponse.js'
import { BasedNode } from '../basedNode/index.js'

export class BasedIterable {
  constructor(buffer: Buffer, query: BasedQueryResponse) {
    this.#buffer = buffer
    this.#query = query
  }

  #buffer: Buffer
  #query: BasedQueryResponse;

  [inspect.custom]() {
    const arr = new Array(this.length)
    let i = 0
    for (const x of this) {
      arr[i] = { id: x.id }
      i++
      if (i > 100) {
        // arr.push(`... ${this.length - 50} more items`)
        break
      }
    }

    const x = inspect(arr)

    return `BasedIterable[${this.#query.query.type.type}] (${this.length}) ${x}`
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
}
