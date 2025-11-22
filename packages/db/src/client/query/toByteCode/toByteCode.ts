import {
  IntermediateByteCode,
  QueryDef,
  QueryDefType,
  includeOp,
} from '../types.js'
import { includeToBuffer } from '../include/toByteCode.js'
import { searchToBuffer } from '../search/index.js'
import { DbClient } from '../../index.js'
import { writeUint32, writeUint64 } from '@based/utils'
import { defaultQuery } from './default.js'
import { idQuery } from './id.js'
import { aliasQuery } from './alias.js'
import { idsQuery } from './ids.js'
import { referencesQuery } from './references.js'
import { referenceQuery } from './reference.js'
import { aggregatesQuery } from './aggregates.js'
import { BasedDbQuery } from '../BasedDbQuery.js'
import { resolveMetaIndexes } from '../query.js'
import { crc32 } from '../../crc32.js'
import { SortHeaderByteSize, writeSortHeader } from '../../../zigTsExports.js'

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
    result.push(aggregatesQuery(def))

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
        const sortSize = def.sort ? SortHeaderByteSize : 0
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

        let sortSize = def.sort ? SortHeaderByteSize : 0

        const filterSize = def.filter.size || 0
        result.push(defaultQuery(def, filterSize, sortSize, searchSize, search))
      }
    }
  } else if (def.type === QueryDefType.References) {
    result.push(referencesQuery(def, size))
  } else if (def.type === QueryDefType.Reference) {
    result.push(referenceQuery(def, size))
  }

  result.push(...include)

  if (edges) {
    const metaEdgeBuffer = new Uint8Array(3)
    metaEdgeBuffer[0] = includeOp.EDGE
    metaEdgeBuffer[1] = edgesSize
    metaEdgeBuffer[2] = edgesSize >>> 8
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
  const totalByteLength =
    bufs.reduce((acc, cur) => acc + cur.buffer.byteLength, 0) + 4
  const res = new Uint8Array(totalByteLength)

  const crc32Target = new Uint8Array(4)

  bufs.unshift(crc32Target)

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

  writeUint32(res, crc32(res), 0)

  return res
}
