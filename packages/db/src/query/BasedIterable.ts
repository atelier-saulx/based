import { inspect } from 'node:util'
import { Query } from './query.js'
import { BasedQueryResponse } from './BasedQueryResponse.js'

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

    return `BasedIterable[${this.#query.query.type}] (${this.length}) ${x}`
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
        ctx.__offset__ = i
        ctx.__queryResponse__ = this.#query
        yield ctx
        i += 4
      } else if (index === 0) {
        i += this.#query.query.type.mainLen
      } else {
        const size = this.#buffer.readUInt16LE(i)
        i += 2
        i += size
      }
    }
  }

  map(callbackFn) {
    const arr = new Array(this.length)
    let i = 0
    for (const item of this) {
      arr[i++] = callbackFn(item)
    }
    return arr
  }

  get length() {
    return this.#buffer.readUint32LE(0)
  }
}
