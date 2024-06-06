import { readSeperateFieldFromBuffer, readObjectFromTree } from './read.js'
import { SchemaFieldTree, SchemaTypeDef } from '../schemaTypeDef.js'
import { BasedNode, BasedNodeBase } from './BasedNode.js'
import { prop } from './utils.js'

export * from './BasedNode.js'

export const createBasedNodeReader = (schema: SchemaTypeDef): BasedNode => {
  const ctx: BasedNode = new BasedNodeBase()
  for (const field in schema.fields) {
    const fieldDef = schema.fields[field]
    const { type, path } = fieldDef
    if (path.length > 1) {
      // ADD
      // TMP needs to destructure etc nested objects as well!!!
      if (Object.getOwnPropertyDescriptor(ctx, path[0])) {
        // console.log(str, 'allrdy defined..')
      } else {
        prop(ctx, path[0], {
          get() {
            const tree = schema.tree[path[0]]
            return readObjectFromTree(tree as SchemaFieldTree, this)
          },
        })
      }
    } else if (type === 'string') {
      prop(ctx, field, {
        get() {
          return readSeperateFieldFromBuffer(fieldDef, this)
        },
      })
    } else if (type === 'number') {
      prop(ctx, field, {
        get() {
          return readSeperateFieldFromBuffer(fieldDef, this)
        },
      })
    } else if (type === 'reference') {
      prop(ctx, field, {
        get() {
          return {
            id: readSeperateFieldFromBuffer(fieldDef, this),
          }
        },
      })
    } else if (type === 'integer') {
      prop(ctx, field, {
        get() {
          return readSeperateFieldFromBuffer(fieldDef, this)
        },
      })
    }
  }
  return ctx
}
