import { ReaderSchemaEnum } from '../../protocol/index.js'
import { PropDef, type TypeDef } from '../../schema/defs/index.js'
import {
  pushQueryHeaderSingleReference,
  QueryType,
  writeQueryHeaderSingleReferenceProps as props,
  pushQueryHeaderSingle,
  writeQueryHeaderSingleProps,
  PropType,
  Modify,
} from '../../zigTsExports.js'
import { Ctx, QueryAst } from './ast.js'
import { include } from './include.js'
import { readPropDef, readSchema } from './readSchema.js'

export const defaultSingle = (ast: QueryAst, ctx: Ctx, typeDef: TypeDef) => {
  let id = 0
  let prop = 0
  let aliasProp: PropDef | undefined
  let aliasValue

  // ADD FILTER AND ALIAS

  if (typeof ast.target === 'number') {
    id = ast.target
  } else if (typeof ast.target === 'object' && ast.target !== null) {
    for (const key in ast.target) {
      aliasProp = typeDef.props.get(key)
      if (aliasProp?.type !== PropType.alias) {
        throw new Error('invalid alias target')
      }
      prop = aliasProp.id
      aliasValue = ast.target[key]
      break
    }
  } else {
    throw new Error('ast.target not supported (yet)')
  }

  const headerIndex = pushQueryHeaderSingle(ctx.query, {
    op: aliasProp ? QueryType.alias : QueryType.id,
    includeSize: 0,
    typeId: typeDef.id,
    filterSize: 0,
    aliasSize: 0,
    id,
    prop,
  })

  if (aliasProp) {
    const start = ctx.query.length
    aliasProp.pushValue(ctx.query, aliasValue, Modify.create)
    writeQueryHeaderSingleProps.aliasSize(
      ctx.query.data,
      ctx.query.length - start,
      headerIndex,
    )
  }

  writeQueryHeaderSingleProps.includeSize(
    ctx.query.data,
    include(ast, ctx, typeDef),
    headerIndex,
  )
}

export const reference = (ast: QueryAst, ctx: Ctx, prop: PropDef) => {
  const headerIndex = pushQueryHeaderSingleReference(ctx.query, {
    op: QueryType.reference,
    typeId: prop.ref!.id,
    includeSize: 0,
    edgeTypeId: 0,
    edgeSize: 0,
    prop: prop.id,
  })

  const schema = readSchema()
  ctx.readSchema.refs[prop.id] = {
    schema,
    prop: readPropDef(prop, ctx.locales, ast.include),
  }
  const size = include(
    ast,
    {
      ...ctx,
      readSchema: schema,
    },
    prop.ref!,
  )
  props.includeSize(ctx.query.data, size, headerIndex)

  if (ast.edges) {
    const edges = prop.edges
    if (!edges) {
      throw new Error('Ref does not have edges')
    }
    schema.edges = readSchema(ReaderSchemaEnum.edge)
    props.op(ctx.query.data, QueryType.referenceEdge, headerIndex)
    props.edgeTypeId(ctx.query.data, edges.id, headerIndex)
    const size = include(
      ast.edges,
      {
        ...ctx,
        readSchema: schema.edges,
      },
      edges,
    )

    props.edgeSize(ctx.query.data, size, headerIndex)
  }
}
