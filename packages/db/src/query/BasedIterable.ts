import { BasedNode } from '../index.js'
import { inspect } from 'node:util'
import { Query } from './query.js'

export class BasedIterable {
  constructor(buffer: Buffer, query: Query) {
    this.#buffer = buffer
    this.#query = query
    // @ts-ignore
    this.#reader = new this.#query.type.ResponseClass(this.#buffer, 0)
  }

  #buffer: Buffer
  #query: Query
  #reader: BasedNode;

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

    return `BasedIterable[${this.#query.type.type}] (${this.length}) ${x}`
  }

  *[Symbol.iterator]() {
    let i = 4
    while (i < this.#buffer.byteLength) {
      // read
      const index = this.#buffer[i]
      i++
      // read from tree
      if (index === 255) {
        // @ts-ignore
        this.#reader.__offset__ = i
        yield this.#reader
        i += 4
      } else if (index === 0) {
        i += this.#query.type.mainLen
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
