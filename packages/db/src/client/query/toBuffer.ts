import { BasedDb } from '../../index.js'
import { createSortBuffer } from './sort.js'
import { QueryByAliasObj, QueryDef, QueryDefType } from './types.js'
import { includeToBuffer } from './include/toBuffer.js'
import { filterToBuffer } from './query.js'
import { searchToBuffer } from './search/index.js'
import { ALIAS, PropDef } from '../../server/schema/types.js'

import native from '../../native.js'
import { crc32 } from '../crc32.js'
import { DbClient } from '../index.js'

const byteSize = (arr: Buffer[]) => {
  return arr.reduce((a, b) => {
    return a + b.byteLength
  }, 0)
}

const getAliasPropdef = (
  alias: QueryByAliasObj,
  path: string[],
  def: QueryDef,
): { def: PropDef; value: string } | void => {
  const schema = def.schema
  for (const k in alias) {
    if (typeof alias[k] === 'string') {
      const p = path.join('.') + k
      const prop = schema.props[p]
      if (prop.typeIndex === ALIAS) {
        return { def: prop, value: alias[k] }
      }
    } else if (typeof alias[k] === 'object') {
      const propDef = getAliasPropdef(alias[k], [...path, k], def)
      if (propDef) {
        return propDef
      }
    }
  }
}

export function defToBuffer(db: DbClient, def: QueryDef): Buffer[] {
  const result: Buffer[] = []
  const include = includeToBuffer(db, def)

  def.references.forEach((ref) => {
    include.push(...defToBuffer(db, ref))
  })

  let edges: Buffer[]
  let edgesSize = 0

  if (def.edges) {
    edges = includeToBuffer(db, def.edges)
    def.edges.references.forEach((ref) => {
      edges.push(...defToBuffer(db, ref))
    })
    edgesSize = byteSize(edges)
  }

  const size = (edges ? edgesSize + 3 : 0) + byteSize(include)

  if (def.type === QueryDefType.Root) {
    let filter: Buffer
    let filterSize = 0

    let search: Buffer
    let searchSize = 0

    if (def.search) {
      search = searchToBuffer(def.search)
      searchSize = def.search.size
    }

    if (def.filter.size) {
      filter = filterToBuffer(def.filter)
      filterSize = filter.byteLength
    }
    // [type,type]
    // [q type] 0 == id, 1 === ids, 2 === type only
    if (def.target.alias) {
      // put this somehwere else at some point
      try {
        const alias = getAliasPropdef(def.target.alias, [], def)
        if (!alias) {
          throw new Error(
            `Cannot find valid alias type in "${JSON.stringify(def.target.alias)}"`,
          )
        } else {
          const s = Buffer.byteLength(alias.value)

          // filter is nice for things like access
          const buf = Buffer.allocUnsafe(8 + filterSize + s)
          buf[0] = 3
          buf[1] = def.schema.idUint8[0]
          buf[2] = def.schema.idUint8[1]
          buf[3] = alias.def.prop
          buf.writeUint16LE(s, 4)
          buf.write(alias.value, 6)
          buf.writeUint16LE(filterSize, s + 6)
          if (filterSize) {
            buf.set(filter, 8 + s)
          }
          result.push(buf)
        }
      } catch (err) {
        throw new Error(
          `Cannot parse alias object query for type ${def.schema.type}`,
        )
      }
    } else if (def.target.id) {
      // type 0
      // 0: 4 [id]
      // 0: 2 [filterSize]
      const buf = Buffer.allocUnsafe(9 + filterSize)
      buf[0] = 0
      buf[1] = def.schema.idUint8[0]
      buf[2] = def.schema.idUint8[1]
      buf.writeUInt32LE(def.target.id, 3)
      buf.writeUint16LE(filterSize, 7)
      if (filterSize) {
        buf.set(filter, 9)
      }
      result.push(buf)
    } else {
      let sort: Buffer
      let sortSize = 0
      if (def.sort) {
        sort = createSortBuffer(def.sort)
        sortSize = sort.byteLength
      }

      if (def.target.ids) {
        // type 1
        // 1: 4 + ids * 4 [ids len] [id,id,id]
        // 1: 8 [offset, limit]
        // 1: 2 [filter size]
        // ?filter
        // 1: 2 [sort size]
        // ?sort
        if (
          !sortSize &&
          (def.range.offset || def.range.limit < def.target.ids.length)
        ) {
          def.target.ids = def.target.ids.slice(
            def.range.offset,
            def.range.offset + def.range.limit,
          )
        }
        const idsSize = def.target.ids.length * 4
        const buf = Buffer.allocUnsafe(
          21 + idsSize + filterSize + sortSize + searchSize,
        )
        buf[0] = 1
        buf[1] = def.schema.idUint8[0]
        buf[2] = def.schema.idUint8[1]
        buf.writeUint32LE(idsSize, 3)
        buf.set(new Uint8Array(def.target.ids.buffer), 7)
        buf.writeUint32LE(def.range.offset, idsSize + 7)
        buf.writeUint32LE(def.range.limit, idsSize + 11)

        buf.writeUint16LE(filterSize, idsSize + 15)
        if (filterSize) {
          buf.set(filter, idsSize + 17)
        }

        buf.writeUint16LE(sortSize, 17 + filterSize + idsSize)
        if (sortSize) {
          buf.set(sort, 19 + filterSize + idsSize)
        }

        buf.writeUint16LE(searchSize, 19 + filterSize + idsSize + sortSize)
        if (searchSize) {
          buf.set(search, 21 + filterSize + idsSize + sortSize)
        }
        // ----------
        result.push(buf)
      } else {
        // type 2
        // 2: 0
        // 2: 8 [offset, limit]
        // 2: 2 [filter size]
        // ?filter
        // 2: 2 [sort size]
        // ?sort
        const buf = Buffer.allocUnsafe(17 + filterSize + sortSize + searchSize)
        buf[0] = 2
        buf[1] = def.schema.idUint8[0]
        buf[2] = def.schema.idUint8[1]
        buf.writeUint32LE(def.range.offset, 3)
        buf.writeUint32LE(def.range.limit, 7)

        buf.writeUint16LE(filterSize, 11)
        if (filterSize) {
          buf.set(filter, 13)
        }

        buf.writeUint16LE(sortSize, 13 + filterSize)
        if (sortSize) {
          buf.set(sort, 15 + filterSize)
        }

        buf.writeUint16LE(searchSize, 15 + filterSize + sortSize)
        if (searchSize) {
          buf.set(search, 17 + filterSize + sortSize)
        }

        result.push(buf)
      }
    }
  } else if (def.type === QueryDefType.References) {
    // TODO filter edge
    let filter: Buffer
    if (def.filter.size) {
      filter = filterToBuffer(def.filter)
    }
    let sort: Buffer
    if (def.sort) {
      sort = createSortBuffer(def.sort)
    }
    // ADD IT
    // TODO: ADD RANGE [offset,limit] (8 bytes)
    const sortSize = sort?.byteLength ?? 0
    const filterSize = filter?.byteLength ?? 0

    const modsSize = filterSize + sortSize
    const meta = Buffer.allocUnsafe(modsSize + 10 + 8)
    meta[0] = 254
    meta.writeUint16LE(size + 7 + modsSize + 8, 1)
    meta.writeUint16LE(filterSize, 3)
    meta.writeUint16LE(sortSize, 5)

    meta.writeUint32LE(def.range.offset, 7)
    meta.writeUint32LE(def.range.limit, 7 + 4)

    if (filter) {
      meta.set(filter, 15)
    }
    if (sort) {
      meta.set(sort, 15 + filterSize)
    }
    meta[15 + modsSize] = def.schema.idUint8[0]
    meta[15 + 1 + modsSize] = def.schema.idUint8[1]
    meta[15 + 2 + modsSize] = def.target.propDef.prop
    result.push(meta)
  } else if (def.type === QueryDefType.Reference) {
    const meta = Buffer.allocUnsafe(6)
    meta[0] = 255
    meta.writeUint16LE(size + 3, 1)
    meta[3] = def.schema.idUint8[0]
    meta[4] = def.schema.idUint8[1]
    meta[5] = def.target.propDef.prop
    result.push(meta)
  }

  result.push(...include)

  if (edges) {
    const metaEdgeBuffer = Buffer.allocUnsafe(3)
    metaEdgeBuffer[0] = 252
    metaEdgeBuffer.writeUint16LE(edgesSize, 1)
    result.push(metaEdgeBuffer, ...edges)
  }

  // 8 byte crc 32

  return result
}
