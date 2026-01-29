import {
  ReaderSchemaEnum,
  type ReaderLocales,
  type ReaderSchema,
} from '../../protocol/index.js'
import { SchemaOut } from '../../schema.js'
import { getTypeDefs } from '../../schema/defs/getTypeDefs.js'
import { isPropDef, TypeDef } from '../../schema/defs/index.js'
import { LangCode, PropType } from '../../zigTsExports.js'
import { IncludeCtx, QueryAst } from '../ast.js'
import { prepMain } from '../utils.js'
import { readPropDef } from './propDef.js'

// put all files in here
// rename all this stuff DbQueryReadSchema

export const collect = (
  ast: QueryAst,
  readSchema: ReaderSchema,
  typeDef: TypeDef,
  locales: ReaderLocales,
  ctx: IncludeCtx,
) => {
  // if ast.include.glob === '*' include all from schema
  // same for ast.include.glob === '**'
  for (const field in ast.props) {
    const prop = ctx.tree.get(field)
    const astProp = ast.props[field]
    const include = astProp.include
    if (isPropDef(prop)) {
      if (prop.type === PropType.reference) {
        // reference(astProp, buf, prop)
      } else if (include) {
        if (prop.id === 0) {
          ctx.main.push({ prop, include, start: prop.start })
        } else {
          readSchema.props[prop.id] = readPropDef(prop, locales, include)
        }
      }
    } else {
      if (prop) {
        collect(astProp, readSchema, typeDef, locales, {
          main: ctx.main,
          tree: prop,
        })
      }
    }
  }
  return ctx
}

const toReadSchema = (
  ast: QueryAst,
  type: ReaderSchemaEnum,
  locales: ReaderLocales,
  typeDef: TypeDef,
): ReaderSchema => {
  const readSchema: ReaderSchema = {
    readId: 0,
    props: {},
    search: false,
    main: { len: 0, props: {} },
    refs: {},
    type,
  }
  const ctx = collect(ast, readSchema, typeDef, locales, {
    tree: typeDef.tree,
    main: [],
  })
  prepMain(ctx.main)
  for (const { prop, include, start } of ctx.main) {
    readSchema.main.props[start ?? 0] = readPropDef(prop, locales, include)
    readSchema.main.len += prop.size
  }
  return readSchema
}

export const queryAstToReadSchema = (
  schema: SchemaOut,
  ast: QueryAst,
): ReaderSchema => {
  const locales: ReaderLocales = {}
  for (const lang in schema.locales) {
    locales[LangCode[lang]] = lang
  }
  if (!ast.type) {
    throw new Error('Query requires type')
  }
  const typeDefs = getTypeDefs(schema)
  const typeDef = typeDefs.get(ast.type)
  if (!typeDef) {
    throw new Error('Type does not exist')
  }
  if (!ast.target) {
    console.info('--------------------')
    return toReadSchema(ast, ReaderSchemaEnum.default, locales, typeDef)
  }
  throw new Error('not handled yet...')
}
