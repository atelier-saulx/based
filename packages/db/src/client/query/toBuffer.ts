import { createSortBuffer } from './sort.js'
import { QueryDef, QueryDefType } from './types.js'
import { includeToBuffer } from './include/toBuffer.js'
import { filterToBuffer } from './query.js'
import { searchToBuffer } from './search/index.js'
import { DbClient } from '../index.js'
import { createAggFlagBuffer } from './aggregation.js'
import { ENCODER } from '../../utils.js'

const byteSize = (arr: Uint8Array[]) => {
  return arr.reduce((a, b) => {
    return a + b.byteLength
  }, 0)
}

export function defToBuffer(db: DbClient, def: QueryDef): Uint8Array[] {
  const result: Uint8Array[] = []
  const include = includeToBuffer(db, def)

  // ---------------------------------------
  def.references.forEach((ref) => {
    include.push(...defToBuffer(db, ref))
    if (ref.errors) {
      def.errors.push(...ref.errors)
    }
  })

  let edges: Uint8Array[]
  let edgesSize = 0

  if (def.edges) {
    edges = includeToBuffer(db, def.edges)
    def.edges.references.forEach((ref) => {
      edges.push(...defToBuffer(db, ref))
      if (ref.errors) {
        def.errors.push(...ref.errors)
      }
    })
    edgesSize = byteSize(edges)
  }

  const size = (edges ? edgesSize + 3 : 0) + byteSize(include)
  // ---------------------------------------
  // move down and will handle size after store the size Var
  // only for references | edges

  if (def.type === QueryDefType.Root) {
    let search: Uint8Array
    let searchSize = 0
    const filterSize = def.filter.size || 0

    if (def.search) {
      search = searchToBuffer(def.search)
      searchSize = def.search.size
    }

    if (def.target.resolvedAlias) {
      const alias = def.target.resolvedAlias
      const aliasStr = ENCODER.encode(alias.value)
      const aliasLen = aliasStr.byteLength
      const buf = new Uint8Array(8 + filterSize + aliasLen)
      buf[0] = 3
      buf[1] = def.schema.idUint8[0]
      buf[2] = def.schema.idUint8[1]
      buf[3] = alias.def.prop
      buf[4] = aliasLen
      buf[5] = aliasLen >>> 8
      buf.set(aliasStr, 6)
      buf[6 + aliasLen] = filterSize
      buf[7 + aliasLen] = filterSize >>> 8
      if (filterSize) {
        buf.set(filterToBuffer(def.filter), 8 + aliasLen)
      }
      result.push(buf)
    } else if (def.target.id) {
      const buf = new Uint8Array(9 + filterSize)
      buf[0] = 0
      buf[1] = def.schema.idUint8[0]
      buf[2] = def.schema.idUint8[1]
      buf[3] = def.target.id
      buf[4] = def.target.id >>> 8
      buf[5] = def.target.id >>> 16
      buf[6] = def.target.id >>> 24
      buf[7] = filterSize
      buf[8] = filterSize >>> 8
      if (filterSize) {
        buf.set(filterToBuffer(def.filter), 9)
      }
      result.push(buf)
    } else {
      let sort: Uint8Array
      let sortSize = 0
      if (def.sort) {
        sort = createSortBuffer(def.sort)
        sortSize = sort.byteLength
      }

      let aggregation: Uint8Array
      if (def.aggregation) {
        aggregation = createAggFlagBuffer(def.aggregation)
      }

      if (def.target.ids) {
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
        const buf = new Uint8Array(
          21 + idsSize + filterSize + sortSize + searchSize,
        )
        buf[0] = 1
        buf[1] = def.schema.idUint8[0]
        buf[2] = def.schema.idUint8[1]
        buf[3] = idsSize
        buf[4] = idsSize >>> 8
        buf[5] = idsSize >>> 16
        buf[6] = idsSize >>> 24
        buf.set(new Uint8Array(def.target.ids.buffer), 7)
        buf[idsSize + 7] = def.range.offset
        buf[idsSize + 8] = def.range.offset >>> 8
        buf[idsSize + 9] = def.range.offset >>> 16
        buf[idsSize + 10] = def.range.offset >>> 24
        buf[idsSize + 11] = def.range.limit
        buf[idsSize + 12] = def.range.limit >>> 8
        buf[idsSize + 13] = def.range.limit >>> 16
        buf[idsSize + 14] = def.range.limit >>> 24
        buf[idsSize + 15] = filterSize
        buf[idsSize + 16] = filterSize >>> 8
        if (filterSize) {
          // just write it here dont do set
          buf.set(filterToBuffer(def.filter), idsSize + 17)
        }

        buf[17 + filterSize + idsSize] = sortSize
        buf[18 + filterSize + idsSize] = sortSize >>> 8
        if (sortSize) {
          buf.set(sort, 19 + filterSize + idsSize)
        }

        buf[19 + filterSize + idsSize + sortSize] = searchSize
        buf[20 + filterSize + idsSize + sortSize] = searchSize >>> 8
        if (searchSize) {
          buf.set(search, 21 + filterSize + idsSize + sortSize)
        }
        // ----------
        result.push(buf)
      } else {
        const buf = new Uint8Array(18 + filterSize + sortSize + searchSize)
        buf[0] = 2
        buf[1] = def.schema.idUint8[0]
        buf[2] = def.schema.idUint8[1]
        buf[3] = def.range.offset
        buf[4] = def.range.offset >>> 8
        buf[5] = def.range.offset >>> 16
        buf[6] = def.range.offset >>> 24
        buf[7] = def.range.limit
        buf[8] = def.range.limit >>> 8
        buf[9] = def.range.limit >>> 16
        buf[10] = def.range.limit >>> 24
        buf[11] = filterSize
        buf[12] = filterSize >>> 8

        if (filterSize) {
          buf.set(filterToBuffer(def.filter), 13)
        }

        buf[13 + filterSize] = sortSize
        buf[14 + filterSize] = sortSize >>> 8
        if (sortSize) {
          buf.set(sort, 15 + filterSize)
        }

        buf[15 + filterSize + sortSize] = searchSize
        buf[16 + filterSize + sortSize] = searchSize >>> 8
        if (searchSize) {
          buf.set(search, 17 + filterSize + sortSize)
        }

        if (aggregation) {
          buf.set(aggregation, 17 + filterSize + sortSize + searchSize)
        }

        result.push(buf)
      }
    }
  } else if (def.type === QueryDefType.References) {
    const filterSize = def.filter.size || 0
    let sort: Uint8Array
    if (def.sort) {
      sort = createSortBuffer(def.sort)
    }
    const sortSize = sort?.byteLength ?? 0
    const modsSize = filterSize + sortSize
    const meta = new Uint8Array(modsSize + 10 + 8)
    const sz = size + 7 + modsSize + 8
    meta[0] = 254
    meta[1] = sz
    meta[2] = sz >>> 8
    meta[3] = filterSize
    meta[4] = filterSize >>> 8
    meta[5] = sortSize
    meta[6] = sortSize >>> 8
    meta[7] = def.range.offset
    meta[8] = def.range.offset >>> 8
    meta[9] = def.range.offset >>> 16
    meta[10] = def.range.offset >>> 24
    meta[11] = def.range.limit
    meta[12] = def.range.limit >>> 8
    meta[13] = def.range.limit >>> 16
    meta[14] = def.range.limit >>> 24

    if (filterSize) {
      meta.set(filterToBuffer(def.filter), 15)
    }
    if (sort) {
      meta.set(sort, 15 + filterSize)
    }
    meta[15 + modsSize] = def.schema.idUint8[0]
    meta[15 + 1 + modsSize] = def.schema.idUint8[1]
    meta[15 + 2 + modsSize] = def.target.propDef.prop
    result.push(meta)
  } else if (def.type === QueryDefType.Reference) {
    const meta = new Uint8Array(6)
    const sz = size + 3
    meta[0] = 255
    meta[1] = sz
    meta[2] = sz >>> 8
    meta[3] = def.schema.idUint8[0]
    meta[4] = def.schema.idUint8[1]
    meta[5] = def.target.propDef.prop
    result.push(meta)
  }

  result.push(...include)

  if (edges) {
    const metaEdgeBuffer = new Uint8Array(3)
    metaEdgeBuffer[0] = 252
    metaEdgeBuffer[1] = edgesSize
    metaEdgeBuffer[2] = edgesSize >>> 8
    result.push(metaEdgeBuffer, ...edges)
  }

  return result
}
