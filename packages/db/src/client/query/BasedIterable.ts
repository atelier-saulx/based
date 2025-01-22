import { inspect } from 'node:util'
import picocolors from 'picocolors'
import { QueryDef } from './types.js'
import { debug, resultToObject, Item, readAllFields } from './query.js'
import { size, time, inspectData } from './display.js'

export { time, size, inspectData }

export class BasedQueryResponse {
  result: Buffer
  def: QueryDef
  execTime: number
  offset: number
  end: number
  id: number

  constructor(
    id: number,
    def: QueryDef,
    result: Buffer,
    execTime: number,
    offset: number = 0,
    end: number = result.byteLength,
  ) {
    this.id = id
    this.def = def
    this.result = result
    this.execTime = execTime
    this.offset = offset
    this.end = end
  }

  get size() {
    return this.result.byteLength
  }

  [inspect.custom](depth: number) {
    const hasId = 'id' in this.def.target || 'alias' in this.def.target
    const target = hasId
      ? this.def.schema.type +
        ':' +
        ('alias' in this.def.target
          ? inspect(this.def.target.alias)
          : // @ts-ignore
            this.def.target.id)
      : this.def.schema.type
    let str = ''
    str += '\n  execTime: ' + time(this.execTime)
    str += '\n  size: ' + size(this.result.byteLength)
    const dataStr = inspectData(
      this,
      this.def,
      0,
      true,
      hasId && depth == 2 ? 5 : depth,
      hasId,
    )
    str += '\n'
    str += dataStr
    return `${picocolors.bold(`BasedQueryResponse[${target}]`)} {${str}\n}\n`
  }

  debug() {
    debug(this.result, this.offset, this.end)
    return this
  }

  node(index: number = 0): any {
    let i = 0
    if ('id' in this.def.target || 'alias' in this.def.target) {
      return this.toObject()
    }
    if (index < 0) {
      index = this.length + index
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
    let i = 5
    const result = this.result
    while (i < result.byteLength) {
      let id = result.readUInt32LE(i)
      i += 4
      const item: Item = {
        id,
      }
      if (this.def.search) {
        item.$searchScore = result[i]
        i += 1
      }
      const l = readAllFields(this.def, result, i, result.byteLength, item, id)
      i += l
      yield item
    }
  }

  inspect(depth: number = 2) {
    console.log(this[inspect.custom](depth))
    return this
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
