import { readSeperateFieldFromBuffer } from './read.js'
import { SchemaFieldTree, SchemaTypeDef } from '../schemaTypeDef.js'
import { BasedNode, BasedNodeBase } from './basedNode.js'
import { prop } from './utils.js'
import { createObjectProp } from './createObjectProp.js'

export * from './basedNode.js'

export const createBasedNodeReader = (schema: SchemaTypeDef): BasedNode => {
  const ctx: BasedNode = new BasedNodeBase()
  ctx.__t = new Map()

  for (const field in schema.fields) {
    const fieldDef = schema.fields[field]
    const { path } = fieldDef
    if (path.length > 1) {
      if (!Object.getOwnPropertyDescriptor(ctx, path[0])) {
        createObjectProp(schema, ctx, path[0])
      }
    } else {
      prop(ctx, field, {
        get() {
          return readSeperateFieldFromBuffer(fieldDef, ctx)
        },
      })
    }
  }
  return ctx
}
