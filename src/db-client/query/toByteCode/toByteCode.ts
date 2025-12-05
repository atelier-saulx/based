import { IntermediateByteCode, QueryDef, QueryDefType } from '../types.js'
import { includeToBuffer } from '../include/toByteCode.js'
import { DbClient } from '../../index.js'
import { writeUint32 } from '../../../utils/index.js'
import { BasedDbQuery } from '../BasedDbQuery.js'
import { aggregateToBuffer, resolveMetaIndexes } from '../query.js'
import { crc32 } from '../../crc32.js'
import { byteSize, schemaChecksum } from './utils.js'
import { filterToBuffer } from '../query.js'
import { getQuerySubType } from './subType.js'
import {
  ID_PROP,
  QueryHeaderByteSize,
  QueryType,
  SortHeaderByteSize,
  writeQueryHeader,
  writeSortHeader,
  // writeAggregateHeader,
  SamplingMode,
} from '../../../zigTsExports.js'
import { searchToBuffer } from '../search/index.js'

export function defToBuffer(
  db: DbClient,
  def: QueryDef,
): IntermediateByteCode[] {
  const result: IntermediateByteCode = []

  const isReferences = def.type === QueryDefType.References
  const isEdges = def.type === QueryDefType.Edge
  // if (def.target.resolvedAlias) {
  // } else if (typeof def.target.id === 'number') {
  // } else if (def.target.ids) {
  // } else {
  // else if (def.type === QueryDefType.Reference) {
  //   // result.push(referenceQuery(def, size))
  // }

  if (def.type === QueryDefType.Root || isReferences || isEdges) {
    const hasSort = def.sort?.prop !== ID_PROP && !!def.sort
    const hasSearch = !!def.search
    const hasFilter = def.filter.size > 0
    const searchSize = hasSearch ? def.search!.size : 0
    const sortSize = hasSort ? SortHeaderByteSize : 0
    const filterSize = def.filter.size

    const include = includeToBuffer(db, def)

    for (const [, ref] of def.references) {
      // pass offset...
      include.push(...defToBuffer(db, ref))
      if (ref.errors) {
        def.errors.push(...ref.errors)
      }
    }

    let edge: IntermediateByteCode[] | undefined = undefined
    const includeSize = byteSize(include)
    let edgeSize = 0

    if (def.edges) {
      // edge = defToBuffer(db, def.edges)
      // if (def.edges.errors) {
      // def.errors.push(...def.edges.errors)
      // }

      edge = includeToBuffer(db, def.edges)
    }

    if (edge) {
      edgeSize = byteSize(edge)
    }

    // const size = (edges ? edgesSize + 3 : 0) + byteSize(include)

    // if (def.aggregate) {
    //   result.push(aggregatesQuery(def))
    //   if (def.type === QueryDefType.Root) {
    //     result.push(schemaChecksum(def))
    //   }
    //   return result
    // }

    // def.type === aggret

    const buffer = new Uint8Array(
      QueryHeaderByteSize + searchSize + filterSize + sortSize,
    )

    // @ts-ignore
    const hasEdges = isReferences && def.target.propDef.edgeNodeTypeId > 0
    const typeId: number = def.schema!.id
    // @ts-ignore
    const edgeTypeId: number = hasEdges ? def.target.propDef.edgeNodeTypeId : 0

    let index = writeQueryHeader(
      buffer,
      {
        op: isReferences ? QueryType.references : QueryType.default,
        prop: isReferences ? def.target.propDef!.prop : ID_PROP,
        // this does not seem nessecary
        size: buffer.byteLength + includeSize, // for top level the byte size is not very important
        typeId,
        offset: def.range.offset,
        limit: def.range.limit,
        sort: hasSort,
        filterSize: def.filter.size,
        searchSize,
        subType: getQuerySubType(def),
        hasEdges,
        edgeTypeId,
        edgeSize,
        edgeFilterSize: 0, // this is nice
      },
      0,
    )

    if (hasSort) {
      index = writeSortHeader(buffer, def.sort!, index)
    }

    if (hasFilter) {
      buffer.set(filterToBuffer(def.filter, index), index)
      index += def.filter.size
    }

    if (hasSearch) {
      buffer.set(searchToBuffer(def.search!), index)
    }

    // need to pass crrect stupid nested INDEX for NOW queries
    result.push([
      { buffer, def, needsMetaResolve: def.filter.hasSubMeta },
      include,
    ])
    if (edge) {
      console.log({ edge })
      result.push(edge)
    }
  } else {
    // flap
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
  const def = query.def!
  const bufs = defToBuffer(query.db, def)
  bufs.push(schemaChecksum(def))
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
