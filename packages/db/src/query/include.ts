import { FieldDef, SchemaFieldTree } from '../schemaTypeDef.js'
import { Query } from './query.js'

const getAllFieldFromObject = (
  tree: SchemaFieldTree | FieldDef,
  arr: string[] = [],
) => {
  for (const key in tree) {
    const leaf = tree[key]
    if (!leaf.type && !leaf.__isField) {
      getAllFieldFromObject(leaf, arr)
    } else {
      arr.push(leaf.path.join('.'))
    }
  }
  return arr
}

export const convertToIncludeTree = (tree: any) => {
  const arr = []
  for (const key in tree) {
    const item = tree[key]
    if (item.__isField === true) {
      arr.push(key, item)
    } else {
      arr.push(key, convertToIncludeTree(item))
    }
  }
  return arr
}

export const addPathToIntermediateTree = (
  field: any,
  includeTree: any,
  path: string[],
): boolean => {
  const len = path.length - 1
  let t = includeTree
  for (let i = 0; i <= len; i++) {
    const key = path[i]
    if (i === len) {
      if (t[key]) {
        return false
      }
      t[key] = field
    } else {
      if (!(key in t)) {
        t[key] = {}
      }
      t = t[key]
    }
  }
  return true
}

// clean up other file
export const parseInclude = (
  query: Query,
  f: string,
  arr: number[],
  includesMain: boolean,
  includeTree: any,
): boolean => {
  const field = query.type.fields[f]
  if (!field) {
    const path = f.split('.')
    const tree = query.type.tree[path[0]]
    if (tree) {
      if (tree.type === 'reference') {
        // go go go
        let r
        const refField = tree as FieldDef
        const refDef2 = {
          // @ts-ignore (ignore typescript error, TODO: later)
          main: [],
          mainIncludes: {},
          mainLen: 0,
          fields: [],
          schema: query.db.schemaTypesParsed[refField.allowedType],
          ref: refField,
          __isField: true,
        }

        if (!query.refIncludes) {
          query.refIncludes = []
        }
        query.refIncludes.push(refDef2)

        if (addPathToIntermediateTree(refDef2, includeTree, refField.path)) {
          // [len][len][type][type][start][start] [255][len][len][type][type][start][start][1]   ([0][0] | [0][255][offset][offset][len][len][0]) [1][2]
          if (!includesMain) {
            query.mainIncludes = {}
            query.mainIncludesSize = 0
            includesMain = true
            arr.push(0)
          }
          query.mainIncludesSize++
          query.mainLen += refField.len
          query.mainIncludes[refField.start] = [0, refField]
          r = true
        }

        const fDef = refField.allowedType
        const refSchema = query.db.schemaTypesParsed[fDef]
        const fieldP = path[1]
        const f = includeTree[refField.path[0]]

        // add as ref field

        const x = refSchema.fields[fieldP]

        if (x) {
          if (x.seperate) {
            f.fields.push(x)
          } else {
            f.mainLen += x.len
            f.mainIncludes[x.start] = [0, x]
            f.main.push(x)
          }
        }

        return r // result
      } else {
        // not returned
        const endFields = getAllFieldFromObject(tree)
        for (const field of endFields) {
          if (parseInclude(query, field, arr, includesMain, includeTree)) {
            includesMain = true
          }
        }
        return includesMain
      }
    }
    return // undefined
  }

  addPathToIntermediateTree(field, includeTree, field.path)

  if (field.seperate) {
    arr.push(field.field)
  } else {
    if (!includesMain) {
      query.mainIncludes = {}
      query.mainIncludesSize = 0
      includesMain = true
      // do different?
      arr.push(0)
    }

    // [len][len][type][type][start][start] [255][len][len][type][type][start][start][1]   ([0][0] | [0][255][offset][offset][len][len][0]) [1][2]

    // if REF e.g. user.string need to add more stuff
    // combine all tings for user in 1 include msg
    // [type 10].[id]0230 4 // selective main as well ofc     // end ref 255

    // [255] // [255]

    query.mainIncludesSize++
    query.mainLen += field.len
    query.mainIncludes[field.start] = [0, field]
    // combine all tings for user in 1 include msg
    return true
  }
}
