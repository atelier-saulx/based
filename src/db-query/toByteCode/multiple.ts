import { PropDef, TypeDef } from '../../schema/defs/index.js'
import { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import {
  pushQueryHeader,
  QueryType,
  ID_PROP,
  QueryHeaderByteSize,
} from '../../zigTsExports.js'
import { QueryAst } from '../ast.js'
import { getIteratorType } from './iteratorType.js'

export const multiple = (
  ast: QueryAst,
  buf: AutoSizedUint8Array,
  typeDef: TypeDef,
  prop?: PropDef,
) => {
  let startOffset = buf.length

  console.log('start here', startOffset)

  const offset = ast.range?.start || 0

  const queryHeaderOffset = pushQueryHeader(buf, {
    op: prop ? QueryType.references : QueryType.default,
    prop: prop ? prop.id : ID_PROP,
    includeSize: 0,
    typeId: prop?.typeDef.id || typeDef.id,
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

  //   use offset to write includeSize and filterSize
}
