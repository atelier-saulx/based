import { PropDef, SchemaPropTree, SchemaTypeDef } from '../schema/schema.js'
import { BasedNode } from './index.js'
import { readSeperateFieldFromBuffer } from './read.js'
import { singleRefProp } from './singleRefProp.js'
import { BasedDb } from '../index.js'

const defineLeafProp = (leaf: PropDef, node: BasedNode, obj: any) => {
  Object.defineProperty(obj, leaf.path[leaf.path.length - 1], {
    enumerable: true,
    set: () => undefined,
    get: () => {
      return readSeperateFieldFromBuffer(leaf, node)
    },
  })
}

const createObjectFromTree = (
  tree: SchemaPropTree,
  node: BasedNode,
  path: string[],
  obj: any,
  schemas: BasedDb['schemaTypesParsed'],
) => {
  for (const key in tree) {
    const leaf = tree[key]
    if (!leaf.typeIndex && !leaf.__isPropDef) {
      const p = [...path, key]
      const nObj = (obj[key] = {})
      createObjectFromTree(leaf as SchemaPropTree, node, p, nObj, schemas)
    } else {
      const f = leaf as PropDef
      // 13: Reference
      if (leaf.typeIndex === 13) {
        singleRefProp(node, key, f, schemas, obj)
      } else {
        defineLeafProp(f as PropDef, node, obj)
      }
    }
  }
}

export const createObjectProp = (
  schema: SchemaTypeDef,
  node: BasedNode,
  key: string,
  schemas: BasedDb['schemaTypesParsed'],
) => {
  const t = schema.tree[key] as SchemaPropTree
  const obj = {}
  node[key] = obj
  createObjectFromTree(t, node, [key], obj, schemas)
}
