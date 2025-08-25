import { inspect } from 'node:util'
import picocolors from 'picocolors'
import { QueryDef } from './types.js'
import { debug, resultToObject, Item, readProps, readId } from './query.js'
import { size, time, inspectData, defHasId, displayTarget } from './display.js'
import { readFloatLE, readUint32 } from '@based/utils'

export { time, size, inspectData }

const BITS_FOR_BYTE_LEN = 21
const FACTOR = 2 ** BITS_FOR_BYTE_LEN
const MASK_B = FACTOR - 1

export class BasedQueryResponse {
  result: Uint8Array
  def: QueryDef
  execTime: number
  end: number

  constructor(
    def: QueryDef,
    result: Uint8Array,
    execTime: number,
    end: number = result.length,
  ) {
    this.def = def
    this.result = result
    this.execTime = execTime
    this.end = end
  }

  get id() {
    return readId(this.def.readSchema, this.result)
  }

  get version() {
    return (this.checksum >>> 0) * FACTOR + (this.result.byteLength & MASK_B)
  }

  get size() {
    return this.result.length
  }

  [inspect.custom](depth: number) {
    const hasId = defHasId(this.def)
    const target = displayTarget(this.def)
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
    debug(this.result, 0, this.end)
    return this
  }

  node(index: number = 0): any {
    // get id as well
    // and potentialy a proxy [i] as well
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
    while (i < result.byteLength - 4) {
      let id = readUint32(result, i)
      i += 4
      let item: Item = {
        id,
      }
      if (this.def.search) {
        item.$searchScore = readFloatLE(result, i)
        i += 4
      }
      const l = readProps(
        this.def.readSchema,
        result,
        i,
        result.byteLength - 4,
        item,
      )
      i += l
      yield item
    }
  }

  inspect(depth: number = 2, raw?: boolean) {
    if (raw) {
      console.dir(this.toObject(), { depth })
    } else {
      console.log(this[inspect.custom](depth))
    }
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

  get checksum() {
    const result = this.result
    const offset = result.byteLength - 4
    return readUint32(result, offset)
  }

  get length() {
    const l = readUint32(this.result, 0)
    return l
  }

  toObject(): any {
    return resultToObject(this.def.readSchema, this.result, this.end - 4, 0)
  }

  toJSON(
    replacer?: (this: any, key: string, value: any) => any,
    space?: string | number,
  ) {
    // TODO: optimize
    return JSON.stringify(this.toObject(), replacer, space)
  }

  toString() {
    return this.toJSON()
  }
}
