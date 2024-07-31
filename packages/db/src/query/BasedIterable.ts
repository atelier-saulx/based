import { inspect } from 'node:util'
import { BasedQueryResponse } from './BasedQueryResponse.js'
import { BasedNode } from '../basedNode/index.js'
import picocolors from 'picocolors'
import { QueryIncludeDef } from './types.js'

export class BasedIterable {
  constructor(buffer: Buffer, query: BasedQueryResponse) {
    this.#buffer = buffer
    this.#query = query
  }

  #buffer: Buffer
  #query: BasedQueryResponse;

  [inspect.custom](_depth, { nested }) {
    const length = this.length
    const max = Math.min(length, nested ? 2 : 10)

    let str = ''
    let i = 0

    for (const x of this) {
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
        ',\n' +
        picocolors.dim(picocolors.italic(`...${length - max} More items`))
    }

    str = `[\n  ${str.replaceAll('\n', '\n  ').trim()}\n]`

    if (nested) {
      return str
    }

    return `${picocolors.bold(`BasedIterable[${this.#query.query.type.type}]`)} (${this.length}) ${str}`
  }

  *[Symbol.iterator]() {
    let i = 4
    let currentInclude: QueryIncludeDef
    while (i < this.#buffer.byteLength) {
      // read
      const index = this.#buffer[i]
      i++
      // read from tree

      if (index === 255) {
        currentInclude = this.#query.query.includeDef
        const ctx = this.#query.query.type.responseCtx
        ctx.__o = i
        ctx.__q = this.#query
        ctx.__r = null
        yield ctx
        i += 4
      } else if (index === 254) {
        // 1 = nested, 0 = back to top
        if (this.#buffer[i] === 0) {
          currentInclude = this.#query.query.includeDef
        }

        if (currentInclude.refIncludes) {
          // need to add an end
          const start = this.#buffer.readUint16LE(i + 1)

          if (currentInclude.refIncludes[start]) {
            currentInclude = currentInclude.refIncludes[start]
          } else {
            // console.log('ERROR GET START', start, currentInclude.schema.type)
          }
          // START + ID + IDENTIFIER
          i += 2 + 4 + 1
        }
      } else if (index === 0) {
        // second one as well
        // index === 0  && next cannot be 254
        // now we have the same for fields...
        i += currentInclude.mainLen
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
