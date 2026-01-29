import { crc32 } from '../../db-client/crc32.js'
import { registerQuery } from '../../db-client/query/registerQuery.js'
import { ReaderSchema, ReaderSchemaEnum } from '../../protocol/index.js'
import { PropDef, SchemaOut } from '../../schema.js'
import { getTypeDefs } from '../../schema/defs/getTypeDefs.js'
import { TypeDef } from '../../schema/defs/index.js'
import { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import { Ctx, QueryAst } from './ast.js'
import { defaultMultiple } from './multiple.js'
import { getReaderLocales, readSchema } from './readSchema.js'

export const astToQueryCtx = (
  schema: SchemaOut,
  ast: QueryAst,
  query: AutoSizedUint8Array,
  sub: AutoSizedUint8Array,
): {
  query: Uint8Array
  readSchema: ReaderSchema
  subscription: Uint8Array // make this optional ?
} => {
  query.length = 0

  if (!ast.type) {
    throw new Error('Query requires type')
  }

  const typeDefs = getTypeDefs(schema)
  const typeDef = typeDefs.get(ast.type)

  if (!typeDef) {
    throw new Error('Type does not exist')
  }

  const queryIdPos = query.reserveUint32()

  const ctx: Ctx = {
    query,
    sub,
    readSchema: readSchema(),
    locales: getReaderLocales(schema),
  }

  if (!ast.target) {
    defaultMultiple(ast, ctx, typeDef)
  }

  query.pushUint64(schema.hash)
  query.writeUint32(crc32(query.view), queryIdPos)

  // can use same buf for sub
  return {
    query: query.view.slice(),
    readSchema: ctx.readSchema,
    subscription: new Uint8Array(0),
  }
}
