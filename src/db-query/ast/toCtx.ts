import { crc32 } from '../../db-client/crc32.js'
import { ReaderSchema, ReaderSchemaEnum } from '../../protocol/index.js'
import { SchemaOut } from '../../schema/index.js'
import { getTypeDefs } from '../../schema/defs/getTypeDefs.js'
import { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import { Ctx, QueryAst } from './ast.js'
import { defaultMultiple } from './multiple.js'
import { getReaderLocales, readSchema } from './readSchema.js'
import { defaultSingle } from './single.js'
import {
  LangCode,
  LangCodeEnum,
  OpType,
  pushSubscriptionHeader,
} from '../../zigTsExports.js'

export const astToQueryCtx = (
  schema: SchemaOut,
  ast: QueryAst,
  query: AutoSizedUint8Array,
  isSubscription = false,
): {
  query: Uint8Array
  readSchema: ReaderSchema
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

  const isSingleQuery = ast.target && !Array.isArray(ast.target)
  const queryIdPos = query.reserveUint32()

  let locale: LangCodeEnum = LangCode.none
  const locales = getReaderLocales(schema)

  if (ast.locale) {
    const code = LangCode[ast.locale]
    if (!(code in locales)) {
      throw new Error(`Invalid locale ${ast.locale}`)
    }
    locale = code
  }

  const ctx: Ctx = {
    query,
    readSchema: readSchema(),
    locales,
    locale: locale,
  }

  if (isSingleQuery) {
    defaultSingle(ast, ctx, typeDef)
    ctx.readSchema.type = ReaderSchemaEnum.single
  } else {
    defaultMultiple(ast, ctx, typeDef)
  }

  query.pushUint64(schema.hash)
  query.writeUint32(crc32(query.view), queryIdPos)

  if (isSubscription) {
    const start = query.reserveUint32()
    pushSubscriptionHeader(query, {
      op: OpType.subscribe,
      fieldsLen: typeDef.separate.length,
      partialLen: typeDef.main.length,
      typeId: typeDef.id,
    })
    if (isSingleQuery) {
      for (const separateProp of typeDef.separate) {
        query.pushUint8(separateProp.id)
      }
      for (const mainProp of typeDef.main) {
        query.pushUint16(mainProp.start)
      }
    } else {
      throw new Error('multi sub not implemented yet')
    }
    const subsSize = query.length - start
    query.writeUint32(subsSize, start)
    const size = query.length
    // shift whole thing forward
    query.set(query.view, subsSize)
    // put the subs buf at the start
    query.set(query.subarray(start + subsSize), 0)
    // shorten to original size
    query.length = size
  }

  // can use same buf for sub
  return {
    query: query.view.slice(),
    readSchema: ctx.readSchema,
  }
}
