import { FieldDef, SchemaFieldTree } from '../schemaTypeDef.js'
import { Query } from './query.js'
import { RefQueryField } from './types.js'

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
      const endFields = getAllFieldFromObject(tree)
      for (const field of endFields) {
        if (parseInclude(query, field, arr, includesMain, includeTree)) {
          includesMain = true
        }
      }
      return includesMain
    }
    return // undefined
  }

  if (field.type === 'reference') {
    console.log('REF!', field)
    // console.log('REF')
    // // --------------- SINGLE REF ----------------------
    // let r
    // const refField = field
    // let refQueryField: RefQueryField
    // if (!query.refIncludes) {
    //   query.refIncludes = {}
    // }
    // if (!query.refIncludes[refField.start]) {
    //   refQueryField = {
    //     mainIncludes: {},
    //     mainLen: 0,
    //     fields: [],
    //     schema: query.db.schemaTypesParsed[refField.allowedType],
    //     ref: refField,
    //     __isRef: true,
    //   }
    //   query.refIncludes[refField.start] = refQueryField
    // } else {
    //   refQueryField = query.refIncludes[refField.start]
    // }
    // if (addPathToIntermediateTree(refField, includeTree, refField.path)) {
    //   // [len][len][type][type][start][start] [255][len][len][type][type][start][start][1]   ([0][0] | [0][255][offset][offset][len][len][0]) [1][2]
    //   if (!includesMain) {
    //     query.mainIncludes = {}
    //     includesMain = true
    //     arr.push(0)
    //   }
    //   query.mainLen += refField.len
    //   query.mainIncludes[refField.start] = [0, refField]
    //   r = true
    // }
    // const fDef = refField.allowedType
    // const refSchema = query.db.schemaTypesParsed[fDef]
    // // wrong....
    // const fieldP = field.path[1]
    // console.info('???', { fieldP })
    // const x = refSchema.fields[fieldP]
    // if (x) {
    //   if (x.seperate) {
    //     refQueryField.fields.push(x)
    //   } else {
    //     refQueryField.mainLen += x.len
    //     refQueryField.mainIncludes[x.start] = [0, x]
    //   }
    // }
    // return r // result
    // // --------------- END SINGLE REF ----------------------
  }

  addPathToIntermediateTree(field, includeTree, field.path)

  if (field.seperate) {
    arr.push(field.field)
  } else {
    if (!includesMain) {
      query.mainIncludes = {}
      includesMain = true
      arr.push(0)
    }
    query.mainLen += field.len
    query.mainIncludes[field.start] = [0, field]
    return true
  }
}
