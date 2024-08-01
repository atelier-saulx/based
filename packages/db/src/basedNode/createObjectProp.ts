import { FieldDef, SchemaFieldTree, SchemaTypeDef } from '../schemaTypeDef.js'
import { BasedNode } from './index.js'
import { readSeperateFieldFromBuffer } from './read.js'
import { singleRefProp } from './singleRefProp.js'
import { BasedDb } from '../index.js'

const defineLeafProp = (leaf: FieldDef, node: BasedNode, obj: any) => {
  Object.defineProperty(obj, leaf.path[leaf.path.length - 1], {
    enumerable: true,
    set: () => undefined,
    get: () => {
      return readSeperateFieldFromBuffer(leaf, node)
    },
  })
}

const createObjectFromTree = (
  tree: SchemaFieldTree,
  node: BasedNode,
  path: string[],
  obj: any,
  schemas: BasedDb['schemaTypesParsed'],
) => {
  for (const key in tree) {
    const leaf = tree[key]
    if (!leaf.type && !leaf.__isField) {
      const p = [...path, key]
      const nObj = (obj[key] = {})
      createObjectFromTree(leaf as SchemaFieldTree, node, p, nObj, schemas)
    } else {
      const f = leaf as FieldDef
      if (leaf.type === 'reference') {
        singleRefProp(node, key, f, schemas, obj)
      } else {
        defineLeafProp(f as FieldDef, node, obj)
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
  const t = schema.tree[key] as SchemaFieldTree
  const obj = {}
  node[key] = obj
  createObjectFromTree(t, node, [key], obj, schemas)
}
