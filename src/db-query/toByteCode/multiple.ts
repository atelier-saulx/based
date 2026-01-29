import { PropDef, TypeDef } from '../../schema/defs/index.js'
import { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import {
  pushQueryHeader,
  QueryType,
  ID_PROP,
  QueryHeaderByteSize,
  readQueryHeaderProps,
  writeQueryHeaderProps,
} from '../../zigTsExports.js'
import { QueryAst, QueryAstCtx } from '../ast.js'
import { collect } from './collect.js'
import { includeProps } from './include.js'
import { getIteratorType } from './iteratorType.js'

export const defaultMultiple = (
  ast: QueryAst,
  buf: AutoSizedUint8Array,
  typeDef: TypeDef,
) => {
  let startOffset = buf.length

  const offset = ast.range?.start || 0

  // now include

  // MAKE THIS DEFAULT
  const queryHeaderOffset = pushQueryHeader(buf, {
    op: QueryType.default,
    prop: ID_PROP,
    includeSize: 0,
    typeId: typeDef.id,
    offset,
    limit: (ast.range?.end || 1000) + offset, // fix
    sort: false,
    filterSize: 0,
    searchSize: 0,
    iteratorType: getIteratorType(),
    // make this optional?
    edgeTypeId: 0,
    edgeSize: 0,
    edgeFilterSize: 0, // this is nice
    size: 0, // total size + include // only used in ids now maybe remove?
    // const buffer = new Uint8Array(QueryHeaderByteSize + searchSize + sortSize)
  })

  // make fn for this
  const includeStart = buf.length
  const ctx = collect(ast, buf, typeDef, [])
  includeProps(buf, ctx.main)
  const includeSize = buf.length - includeStart
  writeQueryHeaderProps.includeSize(buf.data, includeSize, 0)
}
