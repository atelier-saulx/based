import { inspect } from 'node:util'
import picocolors from 'picocolors'
import { QueryDef } from './types.js'
import { debug, resultToObject, Item, readAllFields } from './query.js'
import { BINARY, PropDef, PropDefEdge, STRING } from '../schema/types.js'

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

const inspectObject = (
  object: any,
  q: QueryDef,
  path: string,
  level: number,
  isLast: boolean,
  isFirst: boolean,
  isObject: boolean,
  depth: number,
) => {
  const prefix = ''.padEnd(level, ' ')
  let str = ''
  if (isFirst || isObject) {
    str = '{\n'
  } else {
    str = prefix + '{\n'
  }
  const prefixBody = ''.padEnd(level + 3, ' ')
  let edges = []
  for (const k in object) {
    const key = path ? path + '.' + k : k
    const def: PropDef | PropDefEdge = q.props[key]
    let v = object[k]
    const isEdge = k[0] === '$'

    if (isEdge) {
      edges.push({ k, v })
      // collect at end...
      // str += prefixBody + picocolors.bold(`${k}: `)
    } else {
      str += prefixBody + `${k}: `
    }

    if (isEdge) {
      // str += `${v}`
      // str += ',\n'
    } else if (key === 'id') {
      // @ts-ignore
      str += v + picocolors.italic(picocolors.dim(` ${q.target.type}`))

      // str += picocolors.blue(`${v}`) + picocolors.dim(` ${q.target.type}`)
      str += ',\n'
    } else if (!def) {
      str += inspectObject(v, q, key, level + 2, false, false, true, depth) + ''
    } else if ('__isPropDef' in def) {
      if (def.typeIndex === 14) {
        str += inspectData(
          v,
          q.references.get(def.prop),
          level + 2,
          false,
          depth,
        )
      } else if (def.typeIndex === 13) {
        if (!v.id) {
          str += 'null'
        } else {
          str += inspectObject(
            v,
            q.references.get(def.prop),
            key,
            level + 2,
            false,
            false,
            true,
            depth,
          )
        }
        str += ',\n'
      } else if (def.typeIndex === BINARY) {
        if (v === undefined) {
          return ''
        }
        const nr = 12
        const isLarger = v.length > nr
        const arr = isLarger ? [...v.slice(0, nr)] : [...v]
        const x = [...v.slice(0, nr)].map((v) => {
          return `${v}`.padStart(3, '0') + ' '
        })
        str +=
          picocolors.blue(x.join('')) +
          (isLarger ? picocolors.dim('... ') : '') +
          picocolors.italic(
            picocolors.dim(
              `${~~((Buffer.byteLength(v, 'utf8') / 1e3) * 100) / 100}kb`,
            ),
          )
      } else if (def.typeIndex === STRING) {
        if (v === undefined) {
          return ''
        }
        if (v.length > 40) {
          const chars = picocolors.italic(
            picocolors.dim(
              `${~~((Buffer.byteLength(v, 'utf8') / 1e3) * 100) / 100}kb`,
            ),
          )
          v =
            v.slice(0, 40).replace(/\n/g, '\\n ') +
            picocolors.dim('...') +
            '" ' +
            chars
          str += `"${v}`
        } else {
          str += `"${v}"`
        }
      } else if (def.typeIndex === 1) {
        str += `${v} ${picocolors.italic(picocolors.dim(new Date(v).toString().replace(/\(.+\)/, '')))}`
      } else {
        // if (typeof v === 'number') {
        //   str += picocolors.blue(v)
        // } else {
        str += v
        // }
      }
      str += ',\n'
    } else {
      str += ',\n'
    }
  }

  for (const edge of edges) {
    str += prefixBody + picocolors.bold(`${edge.k}: `) + edge.v + ',\n'
  }

  if (isObject) {
    str += prefix + ' },\n'
  } else if (isLast) {
    str += prefix + '}'
  } else {
    str += prefix + '},\n'
  }
  return str
}

export const inspectData = (
  q: BasedQueryResponse,
  def: QueryDef,
  level: number,
  top: boolean,
  depth: number,
  hasId: boolean = false,
) => {
  const length = q.length
  const max = Math.min(length, depth)
  const prefix = top ? '  ' : ''
  let str: string
  let i = 0
  if (hasId) {
    str = prefix
    level = level + 1
  } else if (top) {
    level = level + 3
    str = prefix + '[\n' + prefix + '  '
  } else {
    str = prefix + '['
  }
  for (const x of q) {
    str += inspectObject(
      x,
      def,
      '',
      level + 1,
      i === max - 1,
      i === 0,
      false,
      depth,
    )
    i++
    if (i >= max) {
      break
    }
  }
  if (length > max) {
    const morePrefix = ''.padStart(top ? 2 : level + 3, ' ')
    str +=
      ',\n' +
      picocolors.dim(
        picocolors.italic(
          prefix +
            morePrefix +
            `...${length - max} More item${length - max !== 1 ? 's' : ''}\n`,
        ),
      )
    if (hasId) {
      str += ''
    } else if (top) {
      str += prefix + ']'
    } else {
      str += prefix + ']'.padStart(level + 2, ' ')
    }
  } else if (hasId) {
  } else if (top) {
    str += '\n' + prefix + ']'
  } else {
    str += ']'
  }
  return str
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

  [inspect.custom](depth: number) {
    const hasId = 'id' in this.def.target
    const target = hasId
      ? // @ts-ignore
        this.def.schema.type + ':' + this.def.target.id
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

  inspect(depth: number) {
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
