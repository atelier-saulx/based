import { PropDef, TypeDef } from '../../schema/defs/index.js'
import { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import { pushQueryHeader, QueryType, ID_PROP } from '../../zigTsExports.js'
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

  //   const queryHeaderOffset = pushQueryHeader(buf, {
  //     op,
  //     prop: isReferences ? def.target.propDef!.prop : ID_PROP,
  //     includeSize,
  //     typeId,
  //     offset: def.range.offset,
  //     limit: def.range.limit,
  //     sort: hasSort,
  //     filterSize,
  //     searchSize,
  //     iteratorType: getIteratorType(),
  //     edgeTypeId,
  //     edgeSize,
  //     edgeFilterSize: 0, // this is nice
  //     size: buffer.byteLength + includeSize,
  //   })
}
