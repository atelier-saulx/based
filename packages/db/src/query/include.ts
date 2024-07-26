import { FieldDef, SchemaFieldTree, isFieldDef } from '../schemaTypeDef.js'
import { QueryIncludeDef } from './types.js'
import { Query } from './query.js'

const idFieldDef = {
  __isField: true,
  type: 'id',
}

const EMPTY_BUFFER = Buffer.alloc(0)

export const addInclude = (query: Query, include: QueryIncludeDef) => {
  let includeBuffer: Buffer
  let len = 0
  let mainBuffer: Buffer

  const includeTreeIntermediate = {
    id: idFieldDef,
  }

  // has to go to include
  if (include.includeFields) {
    let includesMain = false
    for (const f of include.includeFields) {
      if (
        parseInclude(query, include, f, includesMain, includeTreeIntermediate)
      ) {
        includesMain = true
      }
    }

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
        mainBuffer = Buffer.allocUnsafe(size * 4 + 2)
        mainBuffer.writeUint16LE(include.mainLen, 0)
        let i = 2
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
    }

    include.includeTree = convertToIncludeTree(includeTreeIntermediate)

    if (mainBuffer) {
      len = mainBuffer.byteLength + 1 + 2 + include.includeArr.length
      includeBuffer = Buffer.allocUnsafe(len)
      includeBuffer[0] = 0
      includeBuffer.writeInt16LE(mainBuffer.byteLength, 1)

      console.info(len, {
        mainBuffer,
        arr: include.includeArr,
        mainLen: include.mainLen,
      })

      const offset = 3 + mainBuffer.byteLength

      mainBuffer.copy(includeBuffer, 3)

      for (let i = 0; i < include.includeArr.length; i++) {
        includeBuffer[i + offset] = include.includeArr[i]
      }
      return includeBuffer
    }

    return Buffer.from(new Uint8Array(include.includeArr))
  } else {
    return EMPTY_BUFFER
  }

  // ATTACH AT END [255]
  // let refBuffer: Buffer
  // if (include.refIncludes) {
  //   // const arr: Buffer[] = []
  //   for (const key in include.refIncludes) {
  //     const refInclude = include.refIncludes[key]

  //     const buffers = addInclude(query, refInclude)

  //     console.log({ buffers, refInclude })

  //     //

  //     // include buffer same for everything

  //     // arr.push(createSingleRefBuffer(refInclude))
  //   }
  //   refBuffer = EMPTY_BUFFER
  // } else {
  //   refBuffer = EMPTY_BUFFER
  // }

  // if (mainBuffer.byteLength) {
  //   includeBuffer
  // }
}

// REF IN BUFFER AT THE (single Buffer)
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
  query: Query,
  include: QueryIncludeDef, // make a INCLUDE thing
  f: string,
  includesMain: boolean,
  includeTree: any,
): boolean => {
  const field = include.schema.fields[f]

  const path = f.split('.')

  let t: FieldDef | SchemaFieldTree = include.schema.tree
  for (let i = 0; i < path.length; i++) {
    const p = path[i]
    t = t[p]
    if (!t) {
      return
    }
    if (isFieldDef(t) && t.type === 'reference') {
      const ref: FieldDef = t as FieldDef

      if (!include.refIncludes) {
        include.refIncludes = {}
      }

      const start = ref.start

      if (!include.refIncludes[start]) {
        include.refIncludes[start] = {
          schema: query.db.schemaTypesParsed[ref.allowedType],
          includeArr: [],
          includeFields: new Set(),
          mainLen: 0,
          mainIncludes: {},
          includeTree: [],
          fromRef: ref,
        }
      }

      const refIncludeDef = include.refIncludes[start]

      const field = path.slice(i + 1).join('.')
      refIncludeDef.includeFields.add(field)
      return
    }
  }

  if (!field) {
    const tree = include.schema.tree[path[0]]

    if (tree) {
      const endFields = getAllFieldFromObject(tree)
      for (const field of endFields) {
        if (parseInclude(query, include, field, includesMain, includeTree)) {
          includesMain = true
        }
      }
      return includesMain
    }
    return
  }

  addPathToIntermediateTree(field, includeTree, field.path)

  if (field.type === 'reference') {
    console.info('TODO: HANDLE INCLUDE TOTAL REF')
  }

  if (field.seperate) {
    include.includeArr.push(field.field)
  } else {
    if (!includesMain) {
      include.mainIncludes = {}
      includesMain = true
    }
    include.mainLen += field.len
    include.mainIncludes[field.start] = [0, field]
    return true
  }
}
