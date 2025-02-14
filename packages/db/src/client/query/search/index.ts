import { langCodesMap } from '@based/schema'
import { STRING, TEXT, VECTOR } from '../../../server/schema/types.js'
import { QueryDefSearch, QueryDef } from '../types.js'
import { FilterOpts } from '../filter/types.js'

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
  opts: Omit<FilterOpts, 'lowerCase'>,
) => {
  // [isVec] [q len] [q len] [fn] [score] [score] [score] [score] [q..]
  // else {
  //   const b = Buffer.from(q.buffer)
  //   bufs.push(makeSize(1, true), makeSize(b.byteLength), b)
  // }
  // if (isVector) {
  //   for (const k in def.props) {
  //     if (def.props[k].typeIndex === VECTOR) {
  //       s[k] = 0.5
  //     }
  //   }
  // } else {
  //       x[f] = isVector ? 0.5 : 0
  // if (
  //   (isVector && prop.typeIndex !== VECTOR) ||
  //   (!isVector && prop.typeIndex !== STRING && prop.typeIndex !== TEXT)
  // ) {
  //   throw new Error('Can only search trough strings / text')
  // }
  // return bufs
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

/*
  if (search.isVector) {
    // is vector
    search.fields.sort((a, b) => {
      return a.weight - b.weight
    })
    // is vector...
    for (let i = 0; i < search.fields.length * 8; i += 8) {
      const f = search.fields[i / 8]
      result[i + offset] = f.field
      // longer for float
      result.set(
        Buffer.from(new Float32Array([f.weight]).buffer),
        i + 1 + offset,
      )
      result.writeUInt16LE(f.start, i + 5 + offset)
      result[i + 7 + offset] = f.lang
    }
  } else {
*/

export const searchToBuffer = (search: QueryDefSearch) => {
  const result = Buffer.allocUnsafe(search.size)
  result[0] = 0 // search.isVector ? 1 :
  result.writeUint16LE(search.query.byteLength, 1)
  result.set(search.query, 3)
  const offset = search.query.byteLength + 3
  search.fields.sort((a, b) => {
    return a.weight - b.weight
  })
  for (let i = 0; i < search.fields.length * 5; i += 5) {
    const f = search.fields[i / 5]
    result[i + offset] = f.field
    result[i + 1 + offset] = f.weight
    result.writeUInt16LE(f.start, i + 2 + offset)
    result[i + 4 + offset] = f.lang
  }
  return result
}
