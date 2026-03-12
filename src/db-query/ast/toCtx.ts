import { crc32 } from '../../db-client/crc32.js'
import { ReadSchema, ReadSchemaEnum } from '../../protocol/index.js'
import { SchemaOut } from '../../schema/index.js'
import {
  getLocaleFallbacks,
  getLocaleReadSchema,
  getTypeDefs,
} from '../../schema/defs/getTypeDefs.js'
import { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import { Ctx, QueryAst } from './ast.js'
import { defaultMultiple } from './multiple.js'
import { readSchema } from './readSchema.js'
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
  readSchema: ReadSchema
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
  const locales = getLocaleReadSchema(schema)

  if (ast.locale) {
    const code = LangCode[ast.locale]
    if (!(code in locales)) {
      throw new Error(`Invalid locale ${ast.locale}`)
    }
    locale = code
  }

  // optmize this
  const ctx: Ctx = {
    query,
    readSchema: readSchema(), // make weakmap as well
    locales,
    locale: locale,
    localeFallbacks: getLocaleFallbacks(schema),
    // LocaleFallBackOverwrite ADD THIS
  }

  if (isSingleQuery) {
    defaultSingle(ast, ctx, typeDef)
    ctx.readSchema.type = ReadSchemaEnum.single
  } else {
    defaultMultiple(ast, ctx, typeDef)
  }

  query.pushUint64(schema.hash)
  query.writeUint32(crc32(query.view), queryIdPos)

  if (isSubscription) {
    const start = query.reserveUint32()
    const seperateKeys = Object.keys(ctx.readSchema.props)
    const mainKeys = Object.keys(ctx.readSchema.main.props)
    pushSubscriptionHeader(query, {
      op: OpType.subscribe,
      fieldsLen: seperateKeys.length,
      partialLen: mainKeys.length,
      typeId: typeDef.id,
    })
    if (isSingleQuery) {
      for (const key of seperateKeys) {
        query.pushUint8(Number(key))
      }
      for (const key of mainKeys) {
        query.pushUint16(Number(key))
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
  console.log(query.view.slice())
  return {
    query: query.view.slice(),
    readSchema: ctx.readSchema,
  }
}
