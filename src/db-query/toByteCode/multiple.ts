import { PropDef, TypeDef } from '../../schema/defs/index.js'
import { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import {
  pushQueryHeader,
  QueryType,
  ID_PROP,
  writeQueryHeaderProps,
} from '../../zigTsExports.js'
import { QueryAst } from '../ast.js'
import { include } from './include.js'
import { getIteratorType } from './iteratorType.js'

export const defaultMultiple = (
  ast: QueryAst,
  buf: AutoSizedUint8Array,
  typeDef: TypeDef,
) => {
  const rangeStart = ast.range?.start || 0
  const queryHeaderOffset = pushQueryHeader(buf, {
    op: QueryType.default,
    prop: ID_PROP,
    includeSize: 0,
    typeId: typeDef.id,
    offset: rangeStart,
    limit: (ast.range?.end || 1000) + rangeStart,
    sort: false,
    filterSize: 0,
    searchSize: 0,
    iteratorType: getIteratorType(),
    edgeTypeId: 0,
    edgeSize: 0,
    edgeFilterSize: 0,
    size: 0, // total size + include // only used in ids now maybe remove?
    // const buffer = new Uint8Array(QueryHeaderByteSize + searchSize + sortSize)
  })
  writeQueryHeaderProps.includeSize(
    buf.data,
    include(ast, buf, typeDef),
    queryHeaderOffset,
  )
}
