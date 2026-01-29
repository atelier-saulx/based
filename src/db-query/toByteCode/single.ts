import { PropDef, TypeDef } from '../../schema/defs/index.js'
import { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import {
  pushQueryHeaderSingleReference,
  QueryType,
  writeQueryHeaderSingleReferenceProps as props,
} from '../../zigTsExports.js'
import { QueryAst } from '../ast.js'
import { include } from './include.js'

export const reference = (
  ast: QueryAst,
  buf: AutoSizedUint8Array,
  prop: PropDef,
) => {
  const headerIndex = pushQueryHeaderSingleReference(buf, {
    op: QueryType.reference,
    typeId: prop.typeDef.id,
    includeSize: 0,
    edgeTypeId: 0,
    edgeSize: 0,
    prop: prop.id,
  })
  const size = include(ast, buf, prop.typeDef)
  props.includeSize(buf.data, size, headerIndex)
  if (ast.edges) {
    const edges = prop.edges
    if (!edges) {
      throw new Error('Ref does not have edges')
    }
    props.op(buf.data, QueryType.referenceEdge, headerIndex)
    props.edgeTypeId(buf.data, edges.id, headerIndex)
    const size = include(ast.edges, buf, edges)
    props.edgeSize(buf.data, size, headerIndex)
  }
}
