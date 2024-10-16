import { inspect } from 'node:util'
import picocolors from 'picocolors'
import { QueryDef } from './types.js'
import { debug, resultToObject, Item, readAllFields } from './query.js'
import { PropDef, PropDefEdge } from '../schema/types.js'

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

const inspectObject = (object: any, q: QueryDef, level: number = 0) => {
  const prefix = ''.padEnd(level * 2 + 2, ' ')
  let str = '{\n'

  for (const key in object) {
    const def: PropDef | PropDefEdge = q.props[key]
    let v = object[key]
    str += prefix + `${key}: `

    if (key === 'id') {
      str += `${v}`
    } else if (!def) {
      // tree
    } else if ('__isPropDef' in def) {
      if (def.typeIndex === 14) {
        if (v instanceof BasedQueryResponse) {
          str += inspectData(v, true)
        }
      } else if (def.typeIndex === 13) {
        if (!v.id) {
          str += 'null'
        } else {
          str += inspectObject(v, q.references.get(def.prop), level + 1).slice(
            0,
            -1,
          )
        }
      } else if (def.typeIndex === 11) {
        if (v === undefined) {
          return ''
        }
        if (v.length > 80) {
          const chars = picocolors.italic(
            picocolors.dim(
              `${~~((Buffer.byteLength(v, 'utf8') / 1e3) * 100) / 100}kb`,
            ),
          )
          v =
            v.slice(0, 80).replace(/\n/g, '\\n ') +
            picocolors.dim('...') +
            '" ' +
            chars
          str += `"${v}`
        } else {
          str += `"${v}"`
        }
      } else if (def.typeIndex === 8) {
        str += `${v} ${picocolors.italic(picocolors.dim(new Date(v).toString().replace(/\(.+\)/, '')))}`
      } else {
        str += v
      }
    } else {
      // str += inspectObject(v, def, level + 1)
    }
    str += '\n'
  }

  str += '}\n'.padStart(level * 2 + 2, ' ')
  return str
}

export const inspectData = (q: BasedQueryResponse, nested: boolean) => {
  const length = q.length
  const max = Math.min(length, nested ? 2 : 10)
  let str = ''
  let i = 0
  for (const x of q) {
    str += inspectObject(x, q.def)
    i++
    if (i >= max) {
      break
    }
    str += ',\n'
  }
  if (length > max) {
    str +=
      ',\n' +
      picocolors.dim(
        picocolors.italic(
          `...${length - max} More item${length - max !== 1 ? 's' : ''}`,
        ),
      )
  }
  str = `[\n  ${str.replaceAll('\n', '\n  ').trim()}\n]`
  if (nested) {
    return str
  }
  return `${picocolors.bold(`BasedIterable[${q.def.schema.type}]`)} (${q.length}) ${str}`
}

export class BasedQueryResponse {
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
    // @ts-ignore
    const target = this.def.target.id
      ? // @ts-ignore
        this.def.schema.type + ':' + this.def.target.id
      : this.def.schema.type
    let str = ''
    str += '\n  execTime: ' + time(this.execTime)
    str += '\n  size: ' + size(this.result.byteLength)
    const dataStr = inspectData(this, true).replaceAll('\n', '\n  ').trim()
    str += '\n  ' + dataStr
    return `${picocolors.bold(`BasedQueryResponse[${target}]`)} {${str}\n}\n`
  }

  debug() {
    return debug(this.result, this.offset, this.end)
  }

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
    let i = 5
    const result = this.result
    while (i < result.byteLength) {
      let id = result.readUInt32LE(i)
      i += 4
      const item: Item = {
        id,
      }
      const l = readAllFields(this.def, result, i, result.byteLength, item, id)
      i += l
      yield item
    }
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
