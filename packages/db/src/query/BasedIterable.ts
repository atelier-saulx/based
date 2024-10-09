import { inspect } from 'node:util'
import picocolors from 'picocolors'
import { QueryDef } from './types.js'
import { debug, resultToObject } from './query.js'

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

export const inspectData = (q: BasedIterable, nested: boolean) => {
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
  return `${picocolors.bold(`BasedIterable[${q.def.schema.type}]`)} (${q.length}) ${str}`
}

export class BasedIterable {
  result: Buffer
  def: QueryDef
  execTime: number
  offset: number
  end: number

  constructor(
    def: QueryDef,
    result: Buffer,
    execTime: number,
    offset: number = 0,
    end: number = result.byteLength,
  ) {
    this.def = def
    this.result = result
    this.execTime = execTime
    this.offset = offset
    this.end = end
  }

  [inspect.custom](_depth) {
    return 'todo...'
    // const target = this.id ? this.schema.type + ':' + this.id : this.schema.type
    // let str = ''
    // str += '\n  execTime: ' + time(this.execTime)
    // str += '\n  size: ' + size(this.size)
    // const dataStr = inspectData(this, true).replaceAll('\n', '\n  ').trim()
    // str += '\n  ' + dataStr
    // return `${picocolors.bold(`BasedQueryResponse[${target}]`)} {${str}\n}\n`
  }

  debug() {
    return debug(this.result, this.offset, this.end)
  }

  // bit weird...
  node(index: number = 0): any {
    let i = 0
    if ('id' in this.def.target) {
      return this.toObject()
    }
    for (const x of this) {
      if (i === index) {
        return x
      }
      i++
    }
    return null
  }

  *[Symbol.iterator]() {
    const x = this.toObject()

    for (let i = 0; i < x.length; i++) {
      yield x[i]
    }
    // just expand all nested data in a node for now?
  }

  forEach(fn: (item: any, key: number) => void) {
    let i = 0
    for (const item of this) {
      fn(item, ++i)
    }
  }

  map(fn: (item: any, key: number) => any): any[] {
    const arr = new Array(this.length)
    let i = 0
    for (const item of this) {
      arr[i++] = fn(item, i)
    }
    return arr
  }

  get length() {
    return this.result.readUint32LE(this.offset)
  }

  toObject(): any {
    return resultToObject(this.def, this.result, this.end, this.offset)
  }

  toJSON() {
    // TODO: optimize
    return JSON.stringify(this.toObject())
  }

  toString() {
    return this.toJSON()
  }
}
