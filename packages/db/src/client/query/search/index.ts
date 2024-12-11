import { STRING } from '../../../server/schema/types.js'
import { QueryDefSearch, QueryDef } from '../types.js'

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

export const search = (def: QueryDef, q: string, s?: Search) => {
  let blocks = 0
  const x = q.toLowerCase().trim().split(' ')
  const bufs = []
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
    size: query.byteLength + 2,
    query,
    fields: [],
  }

  if (typeof s === 'string') {
    s = [s]
  }

  if (!s) {
    s = {}
    for (const k in def.props) {
      const prop = def.props[k]
      // if title / name / headline add ROLE:
      if (prop.typeIndex === STRING) {
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
    const prop = def.props[key]
    if (!prop) {
      throw new Error('field ' + key + ' does not exist on type')
    }
    if (prop.typeIndex !== STRING) {
      throw new Error('Can only search trough strings')
    }
    if (!prop.separate) {
      throw new Error('Cant  search trough fixed len (yet)')
    }
    def.search.size += 2
    def.search.fields.push({ weight: s[key], field: prop.prop })
  }
}

export const searchToBuffer = (search: QueryDefSearch) => {
  const result = Buffer.allocUnsafe(search.size)
  result.writeUint16LE(search.query.byteLength, 0)
  result.set(search.query, 2)
  const offset = search.query.byteLength + 2
  search.fields.sort((a, b) => {
    return a.weight - b.weight
  })
  for (let i = 0; i < search.fields.length * 2; i += 2) {
    const f = search.fields[i / 2]
    result[i + offset] = f.field
    result[i + 1 + offset] = f.weight
  }
  return result
}
