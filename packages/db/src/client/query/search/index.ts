import { langCodesMap } from '@based/schema'
import { STRING, TEXT, VECTOR } from '@based/schema/def'
import { QueryDefSearch, QueryDef } from '../types.js'
import { FilterOpts, getVectorFn } from '../filter/types.js'
import {
  searchDoesNotExist,
  searchIncorrecQueryValue,
  searchIncorrectType,
} from '../validation.js'
import { ENCODER, concatUint8Arr } from '@saulx/utils'

export type Search =
  | string[]
  | {
      [field: string]: number
    }
  | string

// vector
export const vectorSearch = (
  def: QueryDef,
  q: ArrayBufferView,
  field: string,
  opts: Omit<FilterOpts, 'lowerCase'>,
) => {
  let prop = def.props[field]
  if (!prop) {
    prop = searchDoesNotExist(def, field, true)
  }
  if (prop.typeIndex !== VECTOR) {
    searchIncorrectType(def, prop)
  }
  let size = 17
  const vec = new Uint8Array(q.buffer, 0, q.byteLength)
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
  const bufs: Uint8Array[] = []
  let nrBlocks = 0
  let totalByteLength = 1

  if (typeof q !== 'string') {
    searchIncorrecQueryValue(def, q)
    q = ''
  }
  const x = q.toLowerCase().normalize('NFKD').trim().split(' ')
  for (const s of x) {
    if (s) {
      const buf = ENCODER.encode(s)
      const lenBuf = new Uint8Array(2)

      let len = buf.byteLength
      lenBuf[0] = len
      lenBuf[1] = len >>> 8

      bufs.push(lenBuf, buf)
      nrBlocks++
      totalByteLength += buf.byteLength + 2
    }
  }
  bufs.unshift(Uint8Array.from([nrBlocks]))

  const query = concatUint8Arr(bufs, totalByteLength)

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
    let lang = def.lang.lang
    if (!prop) {
      if (key.includes('.')) {
        const k = key.split('.')
        prop = def.props[k.slice(0, -1).join('.')]
        if (prop && prop.typeIndex === TEXT) {
          lang = langCodesMap.get(k[k.length - 1])
          // incorrect LANG
        } else {
          prop = searchDoesNotExist(def, key, false)
        }
      } else {
        prop = searchDoesNotExist(def, key, false)
      }
    }
    if (prop.typeIndex !== STRING && prop.typeIndex !== TEXT) {
      searchIncorrectType(def, prop)
    }
    def.search.size += 6
    def.search.fields.push({
      typeIndex: prop.typeIndex,
      weight: s[key],
      lang: lang,
      field: prop.prop,
      start: prop.start ?? 0, // also need lang ofc if you have start
    })
  }
}

export const searchToBuffer = (search: QueryDefSearch) => {
  if (search.isVector) {
    /* Vector Binary Schema:
    | Offset | Field    | Size (bytes) | Description                                     |
    |--------|----------|--------------|-------------------------------------------------|
    | 0      | isVector | 1            | Indicates if search is a vector (always 1)      |
    | 1      | queryLen | 2            | Length of the query in bytes (u16)              |
    | 3      | field    | 1            | Field identifier                                |
    | 4      | func     | 1            | Function identifier (enum)                      |
    | 5      | score    | 4            | Score value (f32)                               |
    | 9      | align    | 8            | Space for alignment                             |
    | 17     | query    | queryLen     | Query data (array of f32 values)                |
    */

    const result = new Uint8Array(search.size)
    result[0] = 1 // search.isVector 1
    result[1] = search.query.byteLength
    result[2] = search.query.byteLength >>> 8
    result[3] = search.prop
    result[4] = getVectorFn(search.opts.fn)
    result.set(
      new Uint8Array(new Float32Array([search.opts.score ?? 0.5]).buffer),
      5,
    )
    result.set(search.query, 17)
    return result
  } else {
    /* Non-Vector Search Binary Schema:

    | Offset | Field    | Size (bytes) | Description                                |
    |--------|----------|--------------|--------------------------------------------|
    | 0      | isVector | 1            | Indicates if search is a vector (always 0) |
    | 1      | queryLen | 2            | Length of the query in bytes (u16)         |
    | 3      | query    | queryLen     | Query data                                 |
    | X      | fields   | Variable     | Sorted fields metadata                     |

    ### Fields Metadata Structure:
    Each field entry consists of 6 bytes:

    | Offset | Field     | Size (bytes)| Description                          |
    |--------|-----------|-------------|--------------------------------------|
    | 0      | field     | 1           | Field identifier                     |
    | 1      | typeIndex | 1           | Type index of the field              |
    | 2      | weight    | 1           | Field weight value                   |
    | 3      | start     | 2           | Start position in the query (u16)    |
    | 5      | lang      | 1           | Language identifier                  |

    ### Notes:
    - The number of field entries is inferred from the total packet size.
    - `fields` are sorted by `weight` before being stored in the buffer.*/

    const result = new Uint8Array(search.size)
    result[0] = 0 // search.isVector 0
    result[1] = search.query.byteLength
    result[2] = search.query.byteLength >>> 8
    result.set(search.query, 3)
    const offset = search.query.byteLength + 3
    // @ts-ignore
    search.fields.sort((a, b) => {
      return a.weight - b.weight
    })
    // @ts-ignore
    for (let i = 0; i < search.fields.length * 6; i += 6) {
      // @ts-ignore
      const f = search.fields[Math.floor(i / 6)]
      result[i + offset] = f.field
      result[i + offset + 1] = f.typeIndex
      result[i + offset + 2] = f.weight
      result[i + offset + 3] = f.start
      result[i + offset + 4] = f.start >>> 8
      result[i + offset + 5] = f.lang
    }
    return result
  }
}
