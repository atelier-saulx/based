import { langCodesMap } from '@based/schema'
import { STRING, TEXT, VECTOR } from '../../../server/schema/types.js'
import { QueryDefSearch, QueryDef } from '../types.js'
import { FilterOpts, getVectorFn } from '../filter/types.js'

export type Search =
  | string[]
  | {
      [field: string]: number
    }
  | string

const makeSize = (nr: number, u8: boolean = false) => {
  if (u8) {
    const size = Buffer.allocUnsafe(1)
    size[0] = nr
    return size
  }
  const size = Buffer.allocUnsafe(2)
  size.writeUint16LE(nr)
  return size
}

// vector
export const vectorSearch = (
  def: QueryDef,
  q: ArrayBufferView,
  field: string,
  opts: Omit<FilterOpts, 'lowerCase'>,
) => {
  const prop = def.props[field]

  if (!prop) {
    throw new Error(`Cannot find prop ${field}`)
  }
  if (prop.typeIndex !== VECTOR) {
    throw new Error('Can only search trough strings / text')
  }
  // [isVec] [q len] [q len] [field] [fn] [score] [score] [score] [score] [q..]
  let size = 9
  const vec = Buffer.from(q.buffer)
  size += vec.byteLength

  def.search = {
    size: size,
    prop: prop.prop,
    query: vec,
    isVector: true,
    opts,
  }
}

export const search = (def: QueryDef, q: string, s?: Search) => {
  const bufs = []
  let blocks = 0
  const x = q.toLowerCase().trim().split(' ')
  for (const s of x) {
    if (s) {
      const b = Buffer.from(s)
      bufs.push(makeSize(b.byteLength), b)
      blocks++
    }
  }
  bufs.unshift(makeSize(blocks, true))

  const query = Buffer.concat(bufs)

  def.search = {
    size: query.byteLength + 3,
    query,
    fields: [],
    isVector: false,
  }

  if (typeof s === 'string') {
    s = [s]
  }

  if (!s) {
    s = {}
    for (const k in def.props) {
      const prop = def.props[k]
      // if title / name / headline add ROLE:
      if (prop.typeIndex === STRING || prop.typeIndex === TEXT) {
        s[k] = k === 'title' || k === 'name' || k === 'headline' ? 0 : 2
      }
    }
  } else if (Array.isArray(s)) {
    const x: Search = {}
    for (const f of s) {
      x[f] = 0
    }
    s = x
  }
  for (const key in s) {
    let prop = def.props[key]
    let lang = def.lang
    if (!prop) {
      if (key.includes('.')) {
        const k = key.split('.')
        prop = def.props[k.slice(0, -1).join('.')]
        if (prop && prop.typeIndex === TEXT) {
          lang = langCodesMap.get(k[k.length - 1])
        } else {
          throw new Error('field ' + key + ' does not exist on type')
        }
      } else {
        throw new Error('field ' + key + ' does not exist on type')
      }
    }
    if (prop.typeIndex !== STRING && prop.typeIndex !== TEXT) {
      throw new Error('Can only search trough strings / text')
    }
    def.search.size += 5
    def.search.fields.push({
      weight: s[key],
      lang,
      field: prop.prop,
      start: prop.start ?? 0, // also need lang ofc if you have start
    })
  }
}

export const searchToBuffer = (search: QueryDefSearch) => {
  if (search.isVector) {
    // [isVec] [q len] [q len] [field] [fn] [score] [score] [score] [score] [q..]
    const result = Buffer.allocUnsafe(search.size)
    result[0] = 1 // search.isVector 1
    result.writeUint16LE(search.query.byteLength, 1)
    result[3] = search.prop
    result[4] = getVectorFn(search.opts.fn)
    result.set(
      Buffer.from(new Float32Array([search.opts.score ?? 0.5]).buffer),
      5,
    )
    result.set(search.query, 9)
    return result
  } else {
    const result = Buffer.allocUnsafe(search.size)
    result[0] = 0 // search.isVector 0
    result.writeUint16LE(search.query.byteLength, 1)
    result.set(search.query, 3)
    const offset = search.query.byteLength + 3
    // @ts-ignore
    search.fields.sort((a, b) => {
      return a.weight - b.weight
    })
    // @ts-ignore
    for (let i = 0; i < search.fields.length * 5; i += 5) {
      // @ts-ignore
      const f = search.fields[i / 5]
      result[i + offset] = f.field
      result[i + 1 + offset] = f.weight
      result.writeUInt16LE(f.start, i + 2 + offset)
      result[i + 4 + offset] = f.lang
    }
    return result
  }
}
