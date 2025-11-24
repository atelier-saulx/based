import {
  IntermediateByteCode,
  QueryDef,
  QueryDefType,
  includeOp,
} from '../types.js'
import { includeToBuffer } from '../include/toByteCode.js'
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
import { byteSize, schemaChecksum } from './utils.js'

export function defToBuffer(
  db: DbClient,
  def: QueryDef,
): IntermediateByteCode[] {
  const result: IntermediateByteCode = []

  // def.references.forEach((ref) => {
  //   include.push(...defToBuffer(db, ref))
  //   if (ref.errors) {
  //     def.errors.push(...ref.errors)
  //   }
  // })

  // let edges: IntermediateByteCode[]
  // let edgesSize = 0

  // if (def.edges) {
  //   edges = includeToBuffer(db, def.edges)
  //   def.edges.references.forEach((ref) => {
  //     edges.push(...defToBuffer(db, ref))
  //     if (ref.errors) {
  //       def.errors.push(...ref.errors)
  //     }
  //   })
  //   edgesSize = byteSize(edges)
  // }

  // const size = (edges ? edgesSize + 3 : 0) + byteSize(include)

  // if (def.aggregate) {
  //   result.push(aggregatesQuery(def))
  //   if (def.type === QueryDefType.Root) {
  //     result.push(schemaChecksum(def))
  //   }
  //   return result
  // }

  if (def.type === QueryDefType.Root) {
    if (def.target.resolvedAlias) {
      // result.push(aliasQuery(def))
    } else if (typeof def.target.id === 'number') {
      // result.push(idQuery(def))
    } else if (def.target.ids) {
      //   if (
      //     !def.sort &&
      //     (def.range.offset || def.range.limit < (def.target as any).ids.length)
      //   ) {
      //     ;(def.target as any).ids = (def.target as any).ids.slice(
      //       def.range.offset,
      //       def.range.offset + def.range.limit,
      //     )
      //   }
      //   result.push(idsQuery(def))
    } else {
      result.push(defaultQuery(db, def))
    }
  } else if (def.type === QueryDefType.References) {
    // result.push(referencesQuery(def, size))
  } else if (def.type === QueryDefType.Reference) {
    // result.push(referenceQuery(def, size))
  }

  return result
}

const combineIntermediateResults = (
  res: Uint8Array,
  offset: number,
  t: IntermediateByteCode,
) => {
  if (Array.isArray(t)) {
    for (const intermediateResult of t) {
      offset = combineIntermediateResults(res, offset, intermediateResult)
    }
  } else if (t instanceof Uint8Array) {
    res.set(t, offset)
    offset += t.byteLength
  } else {
    if (t.needsMetaResolve) {
      if (t.def.filter.hasSubMeta) {
        resolveMetaIndexes(t.def.filter, offset)
      }
    }
    res.set(t.buffer, offset)
    offset += t.buffer.byteLength
  }
  return offset
}

export const queryToBuffer = (query: BasedDbQuery) => {
  const bufs = defToBuffer(query.db, query.def)
  bufs.push(schemaChecksum(query.def))
  const queryIdSize = 4
  const totalByteLength = byteSize(bufs) + queryIdSize
  const res = new Uint8Array(totalByteLength)
  const queryIdTarget = new Uint8Array(4)
  bufs.unshift(queryIdTarget)
  combineIntermediateResults(res, 0, bufs)
  const queryId = crc32(res)
  writeUint32(res, queryId, 0)
  return res
}
