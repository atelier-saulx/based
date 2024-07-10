import { Query } from './query.js'
import { BasedIterable } from './BasedIterable.js'
import { inspect } from 'node:util'
import picocolors from 'picocolors'

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

  get data() {
    return new BasedIterable(this.buffer, this)
  }

  [inspect.custom](_depth, { nested }) {
    const target = this.query.id
      ? this.query.type.type + ':' + this.query.id
      : this.query.type.type

    let includes = this.query.includeFields
    let str = ''
    if (this.query.conditions) {
      // console.log(this.query.conditions)
      // str += `\n  Filter: ${this.query.conditions}`
    }

    ;(str +=
      '\n  size: ' + picocolors.dim(`${~~((this.size / 1e3) * 100) / 100}kb`)),
      // @ts-ignore
      (str += '\n  data: ' + inspect(this.data, { nested: true }))

    return `${picocolors.bold(`BasedQueryResponse[${target}]`)} {${str}}`
  }
}
