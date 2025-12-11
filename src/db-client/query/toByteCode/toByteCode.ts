import { IntermediateByteCode, QueryDef, QueryDefType } from '../types.js'
import { includeToBuffer } from '../include/toByteCode.js'
import { DbClient } from '../../index.js'
import { ENCODER, writeUint32 } from '../../../utils/index.js'
import { BasedDbQuery } from '../BasedDbQuery.js'
import { resolveMetaIndexes } from '../query.js'
import { crc32 } from '../../crc32.js'
import { byteSize, schemaChecksum } from './utils.js'
import { filterToBuffer } from '../query.js'
import { getIteratorType } from './iteratorType.js'
import {
  ID_PROP,
  PropType,
  QueryHeaderByteSize,
  QueryHeaderSingleByteSize,
  QueryType,
  QueryTypeEnum,
  SortHeaderByteSize,
  writeQueryHeader,
  writeQueryHeaderSingle,
  writeQueryHeaderSingleReference,
  writeSortHeader,
} from '../../../zigTsExports.js'
import { searchToBuffer } from '../search/index.js'
import { debugBuffer } from '../../../sdk.js'

export function defToBuffer(
  db: DbClient,
  def: QueryDef,
): IntermediateByteCode[] {
  const result: IntermediateByteCode = []

  const isReferences = def.type === QueryDefType.References
  const isReferencesEdges =
    def.type === QueryDefType.Edge &&
    def.target.ref?.typeIndex === PropType.references
  const isRootDefault = def.type === QueryDefType.Root
  const isReference = def.type === QueryDefType.Reference
  const isAlias = 'resolvedAlias' in def.target
  //  or id, alias
  if ('id' in def.target || isAlias) {
    const hasFilter = def.filter.size > 0
    const filterSize = def.filter.size
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

      console.log(aliasStr, aliasSize)
    }
    const buffer = new Uint8Array(
      QueryHeaderSingleByteSize + filterSize + aliasSize,
    )
    const op: QueryTypeEnum = isAlias ? QueryType.alias : QueryType.id

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
        filterSize: def.filter.size,
        aliasSize,
      },
      0,
    )
    if (aliasSize > 0) {
      buffer.set(aliasStr, index)
      index += aliasSize
    }
    if (hasFilter) {
      buffer.set(filterToBuffer(def.filter, index), index)
      index += def.filter.size
    }
    // TODO: Need to pass correct stupid nested INDEX for NOW queries
    result.push([
      { buffer, def, needsMetaResolve: def.filter.hasSubMeta },
      include,
    ])
  } else if (isReference) {
    const hasFilter = def.filter.size > 0
    const filterSize = def.filter.size
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
    const buffer = new Uint8Array(QueryHeaderSingleByteSize + filterSize)
    const typeId: number = def.schema!.id
    const edgeTypeId: number =
      (isReferences && def.target.propDef!.edgeNodeTypeId) || 0
    const op: QueryTypeEnum = QueryType.reference
    let index = writeQueryHeaderSingleReference(
      buffer,
      {
        op,
        prop: def.target.propDef!.prop,
        includeSize,
        typeId,
        filterSize: def.filter.size,
        edgeTypeId,
        edgeSize,
        edgeFilterSize: 0, // this is nice
      },
      0,
    )
    if (hasFilter) {
      buffer.set(filterToBuffer(def.filter, index), index)
      index += def.filter.size
    }
    // TODO: Need to pass crrect stupid nested INDEX for NOW queries
    result.push([
      { buffer, def, needsMetaResolve: def.filter.hasSubMeta },
      include,
    ])
    if (edge) {
      result.push(edge)
    }
  } else if (isRootDefault || isReferences || isReferencesEdges) {
    const hasSort = def.sort?.prop !== ID_PROP && !!def.sort
    const hasSearch = !!def.search
    const hasFilter = def.filter.size > 0
    const searchSize = hasSearch ? def.search!.size : 0
    const sortSize = hasSort ? SortHeaderByteSize : 0
    const filterSize = def.filter.size
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
    const buffer = new Uint8Array(
      QueryHeaderByteSize + searchSize + filterSize + sortSize,
    )
    const typeId: number = def.schema!.id
    const edgeTypeId: number =
      (isReferences && def.target.propDef!.edgeNodeTypeId) || 0
    const op: QueryTypeEnum = isReferences
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
        filterSize: def.filter.size,
        searchSize,
        iteratorType: getIteratorType(def),
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
    // TODO: Need to pass crrect stupid nested INDEX for NOW queries
    result.push([
      { buffer, def, needsMetaResolve: def.filter.hasSubMeta },
      include,
    ])
    result.push(edge)
  } else {
    console.error('UNHANDLED QUERY TYPE')
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
