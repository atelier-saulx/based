import { langCodesMap } from '@based/schema'
import { STRING, TEXT, VECTOR } from '@based/schema/def'
import { QueryDefSearch, QueryDef } from '../types.js'
import { FilterOpts, getVectorFn } from '../filter/types.js'
import {
  searchDoesNotExist,
  searchIncorrecQueryValue,
  searchIncorrectType,
} from '../validation.js'

export type Search =
  | string[]
  | {
      [field: string]: number
    }
  | string

const ENCODER = new TextEncoder()

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
  // [isVec] [q len] [q len] [field] [fn] [score] [score] [score] [score] [q..]
  let size = 9
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

function concatBufs(bufs: Uint8Array[], totalByteLength: number): Uint8Array {
  const res = new Uint8Array(totalByteLength)
  let off = 0

  for (let i = 0; i < bufs.length; i++) {
    const buf = bufs[i]

    res.set(buf, off)
    off += buf.byteLength
  }

  return res
}

export const search = (def: QueryDef, q: string, s?: Search) => {
  const bufs: Uint8Array[] = []
  let nrBlocks = 0
  let totalByteLength = 1

  if (typeof q !== 'string') {
    searchIncorrecQueryValue(def, q)
    q = ''
  }
  const x = q.toLowerCase().normalize('NFKD').trim().split(' ').map((s) => `  ${s}`)
  for (const s of x) {
    if (s) {
      const buf = ENCODER.encode(s)
      let len = buf.byteLength - 2
      buf[0] = len
      buf[1] = len >>> 8
      bufs.push(buf)
      nrBlocks++
      totalByteLength += len + 2
    }
  }
  bufs.unshift(Uint8Array.from([nrBlocks]))

  const query = concatBufs(bufs, totalByteLength)
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
    result.set(search.query, 9)
    return result
  } else {
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
    for (let i = 0; i < search.fields.length * 5; i += 5) {
      // @ts-ignore
      const f = search.fields[i / 5]
      result[i + offset] = f.field
      result[i + offset + 1] = f.weight
      result[i + offset + 2] = f.start
      result[i + offset + 3] = f.start >>> 8
      result[i + offset + 4] = f.lang
    }
    return result
  }
}
