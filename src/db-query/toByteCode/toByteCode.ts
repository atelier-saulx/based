import { crc32 } from '../../db-client/crc32.js'
import { registerQuery } from '../../db-client/query/registerQuery.js'
import { PropDef, SchemaOut } from '../../schema.js'
import { getTypeDefs } from '../../schema/defs/getTypeDefs.js'
import { TypeDef } from '../../schema/defs/index.js'
import { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import { QueryAst } from '../ast.js'
import { defaultMultiple } from './multiple.js'

export const queryAstToByteCode = (
  schema: SchemaOut,
  ast: QueryAst,
  buf: AutoSizedUint8Array,
): Uint8Array => {
  buf.length = 0

  if (!ast.type) {
    throw new Error('Query requires type')
  }

  const typeDefs = getTypeDefs(schema)
  const typeDef = typeDefs.get(ast.type)

  if (!typeDef) {
    throw new Error('Type does not exist')
  }

  const queryIdPos = buf.reserveUint32()

  if (!ast.target) {
    defaultMultiple(ast, buf, typeDef)
  }

  buf.pushUint64(schema.hash)
  buf.writeUint32(crc32(buf.view), queryIdPos)

  return buf.view.slice()
}
