import { createSortBuffer } from '../sort.js'
import {
  IntermediateByteCode,
  QueryDef,
  QueryDefType,
  includeOp,
} from '../types.js'
import { includeToBuffer } from '../include/toByteCode.js'
import { searchToBuffer } from '../search/index.js'
import { DbClient } from '../../index.js'
import { writeUint16, writeUint64 } from '@based/utils'
import { defaultQuery } from './default.js'
import { idQuery } from './id.js'
import { aliasQuery } from './alias.js'
import { idsQuery } from './ids.js'
import { referencesQuery } from './references.js'
import { referenceQuery } from './reference.js'
import { aggregatesQuery } from './aggregates.js'
import { BasedDbQuery } from '../BasedDbQuery.js'
import { resolveMetaIndexes } from '../query.js'
import { off } from 'process'

const byteSize = (arr: IntermediateByteCode[]) => {
  return arr.reduce((a, b) => {
    return a + b.buffer.byteLength
  }, 0)
}

const schemaChecksum = (def: QueryDef): IntermediateByteCode => {
  const checksum = new Uint8Array(8)
  writeUint64(checksum, def.schemaChecksum ?? 0, 0)
  return { buffer: checksum, def }
}

export function defToBuffer(
  db: DbClient,
  def: QueryDef,
): IntermediateByteCode[] {
  const result: IntermediateByteCode[] = []
  const include = includeToBuffer(db, def)

  def.references.forEach((ref) => {
    include.push(...defToBuffer(db, ref))
    if (ref.errors) {
      def.errors.push(...ref.errors)
    }
  })

  let edges: IntermediateByteCode[]
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

  if (def.aggregate) {
<<<<<<< HEAD
    result.push(aggregatesQuery(def))
=======
    const aggregateSize = def.aggregate.size || 0
    if (aggregateSize === 0) {
      throw new Error('Wrong aggregate size (0)')
    }
    const filterSize = def.filter.size || 0

    if (def.type === QueryDefType.References) {
      const buf = new Uint8Array(12 + filterSize + aggregateSize) // op + refSize + filterSize + offset + typeId + refField
      const sz = 9 + filterSize + aggregateSize // filterSize + offset + typeId + refField

      buf[0] = includeOp.REFERENCES_AGGREGATION
      buf[1] = sz
      buf[2] = sz >>> 8
      buf[3] = filterSize
      buf[4] = filterSize >>> 8
      buf[5] = def.range.offset
      buf[6] = def.range.offset >>> 8
      buf[7] = def.range.offset >>> 16
      buf[8] = def.range.offset >>> 24

      if (filterSize) {
        buf.set(filterToBuffer(def.filter), 9)
      }

      // required to get typeEntry and fieldSchema
      buf[9 + filterSize] = def.schema.idUint8[0] // typeId
      buf[9 + 1 + filterSize] = def.schema.idUint8[1] // typeId
      buf[9 + 2 + filterSize] = def.target.propDef.prop // refField
      const aggregateBuffer = aggregateToBuffer(def.aggregate)
      buf.set(aggregateBuffer, 9 + 3 + filterSize)

      result.push(buf)
    } else {
      const buf = new Uint8Array(16 + filterSize + aggregateSize)
      buf[0] = isRootCountOnly(def, filterSize)
        ? QueryType.aggregatesCountType
        : QueryType.aggregates
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
      const aggregateBuffer = aggregateToBuffer(def.aggregate)
      buf[14 + filterSize] = aggregateSize
      buf[15 + filterSize] = aggregateSize >>> 8
      buf.set(aggregateBuffer, 16 + filterSize)
      result.push(buf)
    }
>>>>>>> main

    if (def.type === QueryDefType.Root) {
      result.push(schemaChecksum(def))
    }

    return result
  }

  if (def.type === QueryDefType.Root) {
    if (def.target.resolvedAlias) {
      result.push(aliasQuery(def))
    } else if (typeof def.target.id === 'number') {
      result.push(idQuery(def))
    } else {
      if (def.target.ids) {
        const sortSize = def.sort ? createSortBuffer(def.sort).byteLength : 0
        if (
          !sortSize &&
          (def.range.offset || def.range.limit < (def.target as any).ids.length)
        ) {
          ;(def.target as any).ids = (def.target as any).ids.slice(
            def.range.offset,
            def.range.offset + def.range.limit,
          )
        }
        result.push(idsQuery(def))
      } else {
        let search: Uint8Array
        let searchSize = 0
        if (def.search) {
          search = searchToBuffer(def.search)
          searchSize = def.search.size
        }

        let sort: Uint8Array
        let sortSize = 0
        if (def.sort) {
          sort = createSortBuffer(def.sort)
          sortSize = sort.byteLength
        }

        const filterSize = def.filter.size || 0
        result.push(
          defaultQuery(def, filterSize, sortSize, searchSize, sort, search),
        )
      }
    }
  } else if (def.type === QueryDefType.References) {
    result.push(referencesQuery(def, size))
  } else if (def.type === QueryDefType.Reference) {
    result.push(referenceQuery(def, size))
  }

  result.push(...include)

  if (edges) {
    const metaEdgeBuffer = { buffer: new Uint8Array(3), def }
    metaEdgeBuffer[0] = includeOp.EDGE
    writeUint16(metaEdgeBuffer.buffer, edgesSize, 1)
    result.push(metaEdgeBuffer, ...edges)
  }

  if (def.type === QueryDefType.Root) {
    result.push(schemaChecksum(def))
  }

  return result
}

export const queryToBuffer = (query: BasedDbQuery) => {
  const bufs = defToBuffer(query.db, query.def)
  // allow both uint8 and def
  let totalByteLength = bufs.reduce(
    (acc, cur) => acc + cur.buffer.byteLength,
    0,
  )
  const res = new Uint8Array(totalByteLength)
  let offset = 0
  for (let i = 0; i < bufs.length; i++) {
    const intermediateResult = bufs[i]
    if (intermediateResult instanceof Uint8Array) {
      res.set(intermediateResult, offset)
      offset += intermediateResult.byteLength
    } else {
      if (intermediateResult.needsMetaResolve) {
        if (intermediateResult.def.filter.hasSubMeta) {
          resolveMetaIndexes(intermediateResult.def.filter, offset)
        }
      }
      res.set(intermediateResult.buffer, offset)
      offset += intermediateResult.buffer.byteLength
    }
  }
  return res
}
