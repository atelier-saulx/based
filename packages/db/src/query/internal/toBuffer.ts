import { BasedDb } from '../../index.js'
import { createSortBuffer } from './sort.js'
import { QueryDef, QueryDefType } from './types.js'
import { includeToBuffer } from './include/toBuffer.js'
import { filterToBuffer } from './internal.js'

const byteSize = (arr: Buffer[]) => {
  return arr.reduce((a, b) => {
    return a + b.byteLength
  }, 0)
}

export function defToBuffer(db: BasedDb, def: QueryDef): Buffer[] {
  const result: Buffer[] = []
  const include = includeToBuffer(db, def)

  def.references.forEach((ref) => {
    include.push(...defToBuffer(db, ref))
  })

  let edges: Buffer[]
  let edgesSize = 0

  if (def.edges) {
    edges = includeToBuffer(db, def.edges)
    edgesSize = byteSize(edges)
  }

  const size = (edges ? edgesSize + 3 : 0) + byteSize(include)

  if (def.type === QueryDefType.Root) {
    // [type,type]
    // [q type] 0 == id, 1 === ids, 2 === type only
    if (def.target.id) {
      // 0: 4 [id]
      const buf = Buffer.allocUnsafe(6)
      buf[0] = def.schema.idUint8[0]
      buf[1] = def.schema.idUint8[1]
      buf.writeUInt32LE(def.target.id, 2)
      result.push(buf)
    } else {
      let filter: Buffer
      let filterSize = 0
      if (def.filter.size) {
        filter = filterToBuffer(def.filter)
        filterSize = filter.byteLength
      }
      let sort: Buffer
      let sortSize = 0
      if (def.sort) {
        sort = createSortBuffer(def.sort)
        sortSize = sort.byteLength
      }
      if (def.target.ids) {
        // 1: 4 + ids * 4 [ids len] [id,id,id]
        // 1,2: 8 [offset, limit]
        // 1,2: 2 [filter size]
        // ?filter
        // 1,2: 2 [sort size]
        // ?sort
        const idsSize = def.target.ids.length * 4
        const buf = Buffer.allocUnsafe(18 + idsSize + filterSize + sortSize)
        buf[0] = def.schema.idUint8[0]
        buf[1] = def.schema.idUint8[1]
        buf.writeUint32LE(idsSize, 2)
        buf.set(new Uint8Array(def.target.ids.buffer), 6)
        buf.writeUint32LE(def.range.offset, idsSize + 6)
        buf.writeUint32LE(def.range.limit, idsSize + 10)
        buf.writeUint16LE(filterSize, idsSize + 14)
        if (filterSize) {
          buf.set(filter, idsSize + 16)
        }
        buf.writeUint16LE(sortSize, 16 + filterSize + idsSize)
        if (sortSize) {
          buf.set(sort, 18 + filterSize + idsSize)
        }
        result.push(buf)
      } else {
        // 2: 0
        // 1,2: 8 [offset, limit]
        // 1,2: 2 [filter size]
        // ?filter
        // 1,2: 2 [sort size]
        // ?sort
        const buf = Buffer.allocUnsafe(14 + filterSize + sortSize)
        buf[0] = def.schema.idUint8[0]
        buf[1] = def.schema.idUint8[1]
        buf.writeUint32LE(def.range.offset, 2)
        buf.writeUint32LE(def.range.limit, 6)
        buf.writeUint16LE(filterSize, 10)
        if (filterSize) {
          buf.set(filter, 12)
        }
        buf.writeUint16LE(sortSize, 12 + filterSize)
        if (sortSize) {
          buf.set(sort, 14 + filterSize)
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

    // ADD RANGE [offset,limit] (8 bytes)

    const sortSize = sort?.byteLength ?? 0
    const filterSize = filter?.byteLength ?? 0
    const modsSize = filterSize + sortSize
    const meta = Buffer.allocUnsafe(modsSize + 10)
    meta[0] = 254
    meta.writeUint16LE(size + 7 + modsSize, 1)
    meta.writeUint16LE(filterSize, 3)
    meta.writeUint16LE(sortSize, 5)
    if (filter) {
      meta.set(filter, 7)
    }
    if (sort) {
      meta.set(sort, 7 + filterSize)
    }
    meta[7 + modsSize] = def.schema.idUint8[0]
    meta[8 + modsSize] = def.schema.idUint8[1]
    meta[9 + modsSize] = def.target.propDef.prop
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
    metaEdgeBuffer[0] = 253
    metaEdgeBuffer.writeUint16LE(edgesSize, 1)
    result.push(metaEdgeBuffer, ...edges)
  }

  return result
}
