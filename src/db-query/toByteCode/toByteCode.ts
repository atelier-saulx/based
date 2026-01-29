import { crc32 } from '../../db-client/crc32.js'
import { SchemaOut } from '../../schema.js'
import { getTypeDefs } from '../../schema/defs/getTypeDefs.js'
import { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import { QueryAst } from '../ast.js'
import { multiple } from './multiple.js'

export const queryAstToByteCode = (
  schema: SchemaOut,
  ast: QueryAst,
): Uint8Array => {
  // 8 for schema checksum, 4 for query id, and QueryHeader

  if (!ast.type) {
    throw new Error('Query requires type')
  }

  const typeDefs = getTypeDefs(schema)
  const typeDef = typeDefs.get(ast.type)

  if (!typeDef) {
    throw new Error('Type does not exist')
  }

  const buf = new AutoSizedUint8Array(100)

  const queryIdPos = buf.reserveU32()

  if (!ast.target) {
    multiple(ast, buf, typeDef)
  }

  // const checksumPos = buf.reserveU64()
  buf.pushU64(schema.hash)
  // buf.setU64(schema.hash, checksumPos)
  const queryId = crc32(buf.view)
  buf.setU32(queryId, queryIdPos)

  // buf.pack()

  return buf.view
}
