import { Query } from './query.js'
import { BasedIterable } from './BasedIterable.js'
import { inspect } from 'node:util'
import picocolors from 'picocolors'

const sizeCalc = (size: number) => {
  if (size > 1e6) {
    return `${~~((size / 1e6) * 100) / 100} mb`
  }
  if (size > 1e3) {
    return `${~~((size / 1e3) * 100) / 100} kb`
  }
  return `${size} bytes`
}

const size = (size: number) => {
  const str = sizeCalc(size)
  if (size > 1e3 * 1e3 * 10) {
    return picocolors.red(str)
  } else {
    return picocolors.green(str)
  }
}

const timeCalc = (time: number) => {
  if (time > 1e3) {
    return `${~~((time / 1e3) * 100) / 100} s`
  }
  return `${~~(time * 100) / 100} ms`
}

const time = (time: number) => {
  const str = timeCalc(time)
  if (time > 1e3) {
    return picocolors.red(str)
  } else {
    return picocolors.green(str)
  }
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

    str += '\n  time: ' + time(this.execTime)

    str += '\n  size: ' + size(this.size)
    // @ts-ignore
    str += '\n  data: ' + inspect(this.data, { nested: true })

    return `${picocolors.bold(`BasedQueryResponse[${target}]`)} {${str}}`
  }
}
