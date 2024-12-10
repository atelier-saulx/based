import { STRING } from '../../../server/schema/types.js'
import { QueryDefSearch, QueryDef } from '../types.js'

export type Search = {
  [field: string]: number
}

export const search = (def: QueryDef, q: string, s?: Search) => {
  const query = Buffer.from(q.toLowerCase())
  def.search = {
    size: query.byteLength + 2,
    query,
    fields: [],
  }

  if (!s) {
    let w = 10
    s = {}
    // get all string fields
    for (const k in def.props) {
      const prop = def.props[k]
      if (prop.typeIndex === STRING) {
        s[k] = w
      }
      w--
      if (w == 0) {
        break
      }
    }
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
    return a.weight - b.weight > 1 ? 1 : a.weight === b.weight ? 0 : -1
  })
  // .reverse()
  for (let i = 0; i < search.fields.length * 2; i += 2) {
    const f = search.fields[i / 2]
    result[i + offset] = f.field
    result[i + 1 + offset] = f.weight
  }
  return result
}
