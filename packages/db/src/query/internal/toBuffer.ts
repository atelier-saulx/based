import { BasedDb } from '../../index.js'
import { createSortBuffer } from '../sort.js'
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
    // go go
    // add all info here
  } else if (def.type === QueryDefType.References) {
    // TODO filter edge
    let filter: Buffer

    if (def.filter.size) {
      filter = filterToBuffer(def.filter)
    }

    let sort: Buffer
    const sortOpts = def.sort
    if (sortOpts) {
      // sort = createSortBuffer(def.schema, sortOpts.field, sortOpts.order)
    }

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
