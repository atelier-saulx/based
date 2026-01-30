import { IntermediateByteCode, QueryDef, QueryDefType } from '../types.js'
import { includeToBuffer } from '../include/toByteCode.js'
import { DbClient } from '../../index.js'
import { ENCODER, writeUint32 } from '../../../utils/index.js'
import { BasedDbQuery } from '../BasedDbQuery.js'
import { crc32 } from '../../crc32.js'
import { byteSize, schemaChecksum } from './utils.js'
import { filterToBuffer } from '../filter/toByteCode.js'
import { getIteratorType } from './iteratorType.js'
import {
  createQueryHeaderSingleReference,
  ID_PROP,
  QueryHeaderByteSize,
  QueryHeaderSingleByteSize,
  QueryType,
  QueryTypeEnum,
  SortHeaderByteSize,
  writeQueryHeader,
  writeQueryHeaderSingle,
  writeSortHeader,
} from '../../../zigTsExports.js'
import { aggregateToBuffer } from '../aggregates/toByteCode.js'
import { debugBuffer } from '../../../sdk.js'

export function defToBuffer(
  db: DbClient,
  def: QueryDef,
): IntermediateByteCode[] {
  const result: IntermediateByteCode = []

  const isIds = 'ids' in def.target
  const isReferences = def.type === QueryDefType.References
  const isRootDefault = def.type === QueryDefType.Root
  const isReference = def.type === QueryDefType.Reference
  const isAlias = 'resolvedAlias' in def.target
  const isAggregates = def.aggregate !== null

  if ('id' in def.target || isAlias) {
    const include = includeToBuffer(db, def)
    for (const [, ref] of def.references) {
      include.push(...defToBuffer(db, ref))
      if (ref.errors) {
        def.errors.push(...ref.errors)
      }
    }
    let aliasSize = 0
    let aliasStr: Uint8Array = new Uint8Array([])
    if (isAlias) {
      // @ts-ignore
      aliasStr = ENCODER.encode(def.target.resolvedAlias.value)
      aliasSize = aliasStr.byteLength
    }

    const filter = filterToBuffer(def.filter)
    const filterSize = byteSize(filter)
    const hasFilter = filterSize > 0

    const buffer = new Uint8Array(QueryHeaderSingleByteSize + aliasSize)
    const op: QueryTypeEnum = isAlias
      ? hasFilter
        ? QueryType.aliasFilter
        : QueryType.alias
      : hasFilter
        ? QueryType.idFilter
        : QueryType.id

    let index = writeQueryHeaderSingle(
      buffer,
      {
        op,
        // @ts-ignore
        prop: isAlias ? def.target.resolvedAlias.def.prop : 0,
        // @ts-ignore
        id: isAlias ? 0 : def.target.id,
        includeSize: byteSize(include),
        typeId: def.schema!.id,
        filterSize,
        aliasSize,
      },
      0,
    )
    if (aliasSize > 0) {
      buffer.set(aliasStr, index)
      index += aliasSize
    }
    result.push(buffer)
    if (hasFilter) {
      result.push(filter)
    }
    result.push(include)
  } else if (isAggregates) {
    result.push(aggregateToBuffer(def))
    return result
  } else if (isReference) {
    const include = includeToBuffer(db, def)
    for (const [, ref] of def.references) {
      include.push(...defToBuffer(db, ref))
      if (ref.errors) {
        def.errors.push(...ref.errors)
      }
    }
    const includeSize = byteSize(include)
    let edge: IntermediateByteCode[] | undefined = undefined
    let edgeSize = 0
    if (def.edges) {
      edge = includeToBuffer(db, def.edges) || []
      for (const [, ref] of def.edges.references) {
        edge.push(...defToBuffer(db, ref))
        if (ref.errors) {
          def.errors.push(...ref.errors)
        }
      }
      edgeSize = byteSize(edge)
    }
    const typeId: number = def.schema!.id
    const edgeTypeId: number = def.target.propDef!.edgeNodeTypeId || 0
    const op: QueryTypeEnum =
      edgeSize > 0 ? QueryType.referenceEdge : QueryType.reference
    const buffer = createQueryHeaderSingleReference({
      op,
      prop: def.target.propDef!.prop,
      includeSize,
      typeId,
      edgeTypeId,
      edgeSize,
    })
    result.push([buffer, include])
    if (edge) {
      result.push(edge)
    }
  } else if (isRootDefault || isReferences) {
    const hasSort = (def.sort?.prop !== ID_PROP || isReferences) && !!def.sort
    const hasSearch = false // !!def.search
    const filter = filterToBuffer(def.filter)
    const filterSize = byteSize(filter)
    const hasFilter = filterSize > 0
    const searchSize = 0 // hasSearch ? def.search!.size : 0
    const sortSize = hasSort ? SortHeaderByteSize : 0
    const include = includeToBuffer(db, def)
    for (const [, ref] of def.references) {
      include.push(...defToBuffer(db, ref))
      if (ref.errors) {
        def.errors.push(...ref.errors)
      }
    }
    const includeSize = byteSize(include)
    let edge: IntermediateByteCode[] = []
    let edgeSize = 0
    if (def.edges) {
      edge = includeToBuffer(db, def.edges) || []
      for (const [, ref] of def.edges.references) {
        edge.push(...defToBuffer(db, ref))
        if (ref.errors) {
          def.errors.push(...ref.errors)
        }
      }
      edgeSize = byteSize(edge)
    }
    const buffer = new Uint8Array(QueryHeaderByteSize + searchSize + sortSize)
    const typeId: number = def.schema!.id
    const edgeTypeId: number =
      (isReferences && def.target.propDef!.edgeNodeTypeId) || 0
    const op: QueryTypeEnum = isIds
      ? QueryType.ids
      : isReferences
        ? QueryType.references
        : QueryType.default
    let index = writeQueryHeader(
      buffer,
      {
        op,
        prop: isReferences ? def.target.propDef!.prop : ID_PROP,
        includeSize,
        typeId,
        offset: def.range.offset,
        limit: def.range.limit,
        sort: hasSort,
        filterSize,
        searchSize,
        iteratorType: getIteratorType(def, hasFilter),
        edgeTypeId,
        edgeSize,
        edgeFilterSize: 0, // this is nice
        size: buffer.byteLength + includeSize, // is this used? QueryHeaderByteSize + searchSize + sortSize + includeSize
      },
      0,
    )
    if (hasSort) {
      index = writeSortHeader(buffer, def.sort!, index)
    }
    result.push(buffer)
    if (hasFilter) {
      result.push(filter)
    }
    if (hasSearch) {
      // buffer.set(searchToBuffer(def.search!), index)
    }
    result.push(include)
    result.push(edge)
    if (isIds && 'ids' in def.target && def.target.ids) {
      const ids = new Uint8Array(4 + def.target.ids.length * 4)
      writeUint32(ids, def.target.ids.length, 0)
      for (let i = 0; i < def.target.ids.length; i++) {
        writeUint32(ids, def.target.ids[i], i * 4 + 4)
      }
      result.push(ids)
    }
  } else {
    console.error('UNHANDLED QUERY TYPE')
  }

  return result
}

export const combineIntermediateResults = (
  res: Uint8Array,
  offset: number,
  t: IntermediateByteCode,
) => {
  if (Array.isArray(t)) {
    for (const intermediateResult of t) {
      offset = combineIntermediateResults(res, offset, intermediateResult)
    }
  } else {
    res.set(t, offset)
    offset += t.byteLength
  }
  return offset
}

export const queryToBuffer = (query: BasedDbQuery) => {
  const def = query.def!
  const bufs = defToBuffer(query.db, def)
  bufs.push(schemaChecksum(def))
  const queryIdSize = 4 // prob want 8 here...
  const totalByteLength = byteSize(bufs) + queryIdSize
  const res = new Uint8Array(totalByteLength)
  const queryIdTarget = new Uint8Array(4)
  bufs.unshift(queryIdTarget)
  combineIntermediateResults(res, 0, bufs)
  // maybe make these ids 8 bytes seems to short...
  const queryId = crc32(res)
  writeUint32(res, queryId, 0)
  // debugBuffer(res)
  return res
}
