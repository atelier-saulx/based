import { createSortBuffer } from '../sort.js'
import { QueryDef, QueryDefType, includeOp } from '../types.js'
import { includeToBuffer } from '../include/toByteCode.js'
import { searchToBuffer } from '../search/index.js'
import { DbClient } from '../../index.js'
import { concatUint8Arr, writeUint16, writeUint64 } from '@based/utils'
import { defaultQuery } from './default.js'
import { idQuery } from './id.js'
import { aliasQuery } from './alias.js'
import { idsQuery } from './ids.js'
import { referencesQuery } from './references.js'
import { referenceQuery } from './reference.js'
import { aggregatesQuery } from './aggregates.js'
import { BasedDbQuery } from '../BasedDbQuery.js'

const byteSize = (arr: Uint8Array[]) => {
  return arr.reduce((a, b) => {
    return a + b.byteLength
  }, 0)
}

const schemaChecksum = (def: QueryDef) => {
  const checksum = new Uint8Array(8)
  writeUint64(checksum, def.schemaChecksum ?? 0, 0)
  return checksum
}

export function defToBuffer(db: DbClient, def: QueryDef): Uint8Array[] {
  const result: Uint8Array[] = []
  const include = includeToBuffer(db, def)

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
    const metaEdgeBuffer = new Uint8Array(3)
    metaEdgeBuffer[0] = includeOp.EDGE
    writeUint16(metaEdgeBuffer, edgesSize, 1)
    result.push(metaEdgeBuffer, ...edges)
  }

  if (def.type === QueryDefType.Root) {
    result.push(schemaChecksum(def))
  }

  return result
}

export const queryToBuffer = (query: BasedDbQuery) => {
  return concatUint8Arr(defToBuffer(query.db, query.def))
}
