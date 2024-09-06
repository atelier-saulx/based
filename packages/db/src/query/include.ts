import {
  FieldDef,
  SchemaFieldTree,
  isFieldDef,
  idFieldDef,
} from '../schemaTypeDef.js'
import { QueryIncludeDef } from './types.js'
import { Query } from './query.js'

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

    if (mainBuffer) {
      len = mainBuffer.byteLength + 1 + 2 + include.includeArr.length
      includeBuffer = Buffer.allocUnsafe(len)
      includeBuffer[0] = 0
      includeBuffer.writeInt16LE(mainBuffer.byteLength, 1)
      const offset = 3 + mainBuffer.byteLength
      mainBuffer.copy(includeBuffer, 3)
      for (let i = 0; i < include.includeArr.length; i++) {
        includeBuffer[i + offset] = include.includeArr[i]
      }
    } else {
      includeBuffer = Buffer.from(new Uint8Array(include.includeArr))
    }

    include.includeTree = convertToIncludeTree(includeTreeIntermediate)

    const result: Buffer[] = [includeBuffer]
    if (include.refIncludes) {
      for (const key in include.refIncludes) {
        const refInclude = include.refIncludes[key]
        const refBuffer = addInclude(query, refInclude)
        const size = refBuffer.byteLength
        const meta = Buffer.allocUnsafe(7)
        meta[0] = 255
        meta[1] =
          refInclude.mainLen === 0 && refInclude.includeArr.length === 0 ? 0 : 1
        meta.writeUint16LE(size + 3, 2)

        meta[4] = refInclude.schema.prefix[0]
        meta[5] = refInclude.schema.prefix[1]

        meta[6] = refInclude.fromRef.field

        // meta.writeUint16LE(refInclude.fromRef.start, 6)
        result.push(meta, refBuffer)
      }
    }
    const x = Buffer.concat(result)
    console.log(new Uint8Array(x))
    return x
  } else {
    return EMPTY_BUFFER
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
      arr.push(leaf.path.join('.'))
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

const createOrGetRefIncludeDef = (
  ref: FieldDef,
  include: QueryIncludeDef,
  query: Query,
) => {
  if (!include.refIncludes) {
    include.refIncludes = {}
  }

  // make it field not stat
  const field = ref.field
  if (!include.refIncludes[field]) {
    include.refIncludes[field] = {
      includePath: [...include.includePath, field],
      schema: query.db.schemaTypesParsed[ref.allowedType],
      includeArr: [],
      includeFields: new Set(),
      mainLen: 0,
      mainIncludes: {},
      includeTree: [],
      fromRef: ref,
    }
  }
  const refIncludeDef = include.refIncludes[field]
  return refIncludeDef
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

const parseInclude = (
  query: Query,
  include: QueryIncludeDef,
  f: string,
  includesMain: boolean,
  includeTree: any,
): boolean => {
  const field = include.schema.fields[f]
  const path = f.split('.')

  if (!field) {
    let t: FieldDef | SchemaFieldTree = include.schema.tree
    for (let i = 0; i < path.length; i++) {
      const p = path[i]
      t = t[p]
      if (!t) {
        return
      }
      if (isFieldDef(t) && t.type === 'reference') {
        const ref: FieldDef = t as FieldDef
        const refIncludeDef = createOrGetRefIncludeDef(ref, include, query)
        const field = path.slice(i + 1).join('.')
        refIncludeDef.includeFields.add(field)
        addPathToIntermediateTree(t, includeTree, t.path)
        return
      }
    }

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
    const refIncludeDef = createOrGetRefIncludeDef(field, include, query)
    for (const f in refIncludeDef.schema.fields) {
      if (
        refIncludeDef.schema.fields[f].type !== 'reference' &&
        refIncludeDef.schema.fields[f].type !== 'references'
      ) {
        refIncludeDef.includeFields.add(f)
      }
    }
    return
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
