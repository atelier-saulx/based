import { crc32 } from '../../db-client/crc32.js'
import { PropDef, SchemaOut } from '../../schema.js'
import { getTypeDefs } from '../../schema/defs/getTypeDefs.js'
import { TypeDef } from '../../schema/defs/index.js'
import { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import { QueryAst } from '../ast.js'
import { defaultMultiple } from './multiple.js'

export const queryAstToByteCode = (
  schema: SchemaOut,
  ast: QueryAst,
): Uint8Array => {
  if (!ast.type) {
    throw new Error('Query requires type')
  }

  const typeDefs = getTypeDefs(schema)
  const typeDef = typeDefs.get(ast.type)

  if (!typeDef) {
    throw new Error('Type does not exist')
  }

  const buf = new AutoSizedUint8Array(100)

  const queryIdPos = buf.reserveUint32()

  if (!ast.target) {
    defaultMultiple(ast, buf, typeDef)
  }

  buf.pushUint64(schema.hash)
  buf.writeUint32(crc32(buf.view), queryIdPos)

  // buf.pack()

  return buf.view
}
