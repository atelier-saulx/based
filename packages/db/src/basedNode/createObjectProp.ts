import { FieldDef, SchemaFieldTree, SchemaTypeDef } from '../schemaTypeDef.js'
import { BasedNode } from './basedNodeClass.js'
import { readSeperateFieldFromBuffer } from './read.js'
import { prop } from './utils.js'

const defineLeafProp = (leaf: FieldDef, node: BasedNode, obj: any) => {
  prop(obj, leaf.path[leaf.path.length - 1], {
    get: () => {
      // if (node.__q.query.includeFields)
      return readSeperateFieldFromBuffer(leaf, node)
    },
  })
}

const createObjectFromTree = (
  tree: SchemaFieldTree,
  node: BasedNode,
  path: string[],
  obj: any,
) => {
  for (const key in tree) {
    const leaf = tree[key]
    if (!leaf.type && !leaf.__isField) {
      const p = [...path, key]
      const nObj = (obj[key] = {})
      createObjectFromTree(leaf as SchemaFieldTree, node, p, nObj)
    } else {
      defineLeafProp(leaf as FieldDef, node, obj)
    }
  }
}

export const createObjectProp = (
  schema: SchemaTypeDef,
  node: BasedNode,
  key: string,
) => {
  const t = schema.tree[key] as SchemaFieldTree
  const obj = {}
  node[key] = obj
  createObjectFromTree(t, node, [key], obj)
}
