import { FieldDef, SchemaFieldTree, SchemaTypeDef } from '../schemaTypeDef.js'
import { QueryIncludeDef } from './types.js'
import { createSingleRefBuffer } from './singleRef.js'

const idFieldDef = {
  __isField: true,
  type: 'id',
}

const EMPTY_BUFFER = Buffer.alloc(0)

export const addInclude = (include: QueryIncludeDef) => {
  let includeBuffer: Buffer
  let len = 0
  let mainBuffer: Buffer

  const includeTreeIntermediate = {
    id: idFieldDef,
  }

  // has to go to include
  if (include.includeFields) {
    let includesMain = false
    const arr = []
    for (const f of include.includeFields) {
      if (
        parseInclude(include, f, arr, includesMain, includeTreeIntermediate)
      ) {
        includesMain = true
      }
    }

    len += arr.length
    includeBuffer = Buffer.from(arr)

    if (includesMain) {
      if (include.mainLen === include.schema.mainLen) {
        // GET ALL MAIN FIELDS
        let m = 0
        for (const key in include.mainIncludes) {
          const v = include.mainIncludes[key]
          const len = v[1].len
          v[0] = m
          m += len
        }
        mainBuffer = EMPTY_BUFFER
      } else {
        // GET SOME MAIN FIELDS
        const size = Object.keys(include.mainIncludes).length
        mainBuffer = Buffer.allocUnsafe(size * 4 + 4)
        mainBuffer.writeUint32LE(include.mainLen, 0)
        let i = 4
        let m = 0
        for (const key in include.mainIncludes) {
          const v = include.mainIncludes[key]
          mainBuffer.writeUint16LE(v[1].start, i)
          const len = v[1].len
          v[0] = m
          mainBuffer.writeUint16LE(len, i + 2)
          i += 4
          m += len
        }
      }
    } else {
      mainBuffer = EMPTY_BUFFER
    }
  } else {
    len = 1
    const fields = include.schema.fields
    for (const f in fields) {
      const field = fields[f]
      addPathToIntermediateTree(field, includeTreeIntermediate, field.path)
      if (field.seperate) {
        len++
      }
    }
    includeBuffer = Buffer.allocUnsafe(len)
    includeBuffer[0] = 0
    let i = 0
    for (const f in fields) {
      const field = fields[f]
      if (field.seperate) {
        i++
        includeBuffer[i] = field.field
      }
    }
    mainBuffer = EMPTY_BUFFER
    include.mainLen = include.schema.mainLen
  }

  include.includeTree = convertToIncludeTree(includeTreeIntermediate)

  let refBuffer: Buffer
  if (include.refIncludes) {
    refBuffer = createSingleRefBuffer(include)
  } else {
    refBuffer = EMPTY_BUFFER
  }

  return {
    includeBuffer,
    len,
    mainBuffer,
    refBuffer,
  }
}

const getAllFieldFromObject = (
  tree: SchemaFieldTree | FieldDef,
  arr: string[] = [],
) => {
  for (const key in tree) {
    const leaf = tree[key]
    if (!leaf.type && !leaf.__isField) {
      getAllFieldFromObject(leaf, arr)
    } else {
      if (leaf.type === 'reference') {
        console.log('YO LEAF IS REF DO NOTHING FOR NOW...', leaf)
      } else {
        arr.push(leaf.path.join('.'))
      }
    }
  }
  return arr
}

const convertToIncludeTree = (tree: any) => {
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

const addPathToIntermediateTree = (
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

// call it an includeDef OBJECT use for intermediate as well

// clean up other file
const parseInclude = (
  include: QueryIncludeDef, // make a INCLUDE thing
  f: string,
  arr: number[],
  includesMain: boolean,
  includeTree: any,
): boolean => {
  const field = include.schema.fields[f]

  const path = f.split('.')

  // let s = field
  // for (const p of path) {
  //   console.log(p)
  //   if (s && s.type === 'reference') {
  //     console.log('yo ref')
  //   }
  //   // s =
  // }

  if (!field) {
    const tree = include.schema.tree[path[0]]

    if (tree.type === 'reference') {
      console.log('do something...')
    }

    if (tree) {
      const endFields = getAllFieldFromObject(tree)
      for (const field of endFields) {
        if (parseInclude(include, field, arr, includesMain, includeTree)) {
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
      include.mainIncludes = {}
      includesMain = true
      arr.push(0)
    }
    include.mainLen += field.len
    include.mainIncludes[field.start] = [0, field]
    return true
  }
}
