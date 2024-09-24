import {
  PropDef,
  SchemaPropTree,
  isPropDef,
  ID_FIELD_DEF,
} from '../schema/schema.js'
import { QueryIncludeDef } from './types.js'
import { Query } from './query.js'
import { addConditions } from './filter.js'

const EMPTY_BUFFER = Buffer.alloc(0)

export const addInclude = (query: Query, include: QueryIncludeDef) => {
  let includeBuffer: Buffer
  let len = 0
  let mainBuffer: Buffer

  const includeTreeIntermediate = {
    id: ID_FIELD_DEF,
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

        const filterConditions =
          include.referencesFilters[refInclude.fromRef.path.join('.')]
        let filter: Buffer

        if (filterConditions) {
          console.log(filterConditions)
          filter = addConditions(filterConditions, filterConditions.size)
        }

        const filterSize = filter?.byteLength ?? 0

        const multi = refInclude.multiple
        const startSize = multi ? 8 : 6

        const meta = Buffer.allocUnsafe(startSize + filterSize)

        // command meaning include single ref or multiple ref
        meta[0] = multi ? 254 : 255

        // size
        meta.writeUint16LE(size + (multi ? 5 : 3) + filterSize, 1)

        if (multi) {
          meta.writeUint16LE(filterSize, 3)
        }

        if (filter) {
          meta.set(filter, 5)
        }

        // typeId
        meta[(multi ? 5 : 3) + filterSize] = refInclude.schema.idUint8[0]
        meta[(multi ? 6 : 4) + filterSize] = refInclude.schema.idUint8[1]

        // field where ref is stored
        meta[(multi ? 7 : 5) + filterSize] = refInclude.fromRef.prop

        result.push(meta, refBuffer)
      }
    }
    return Buffer.concat(result)
  } else {
    return EMPTY_BUFFER
  }
}

const getAllFieldFromObject = (
  tree: SchemaPropTree | PropDef,
  arr: string[] = [],
) => {
  for (const key in tree) {
    const leaf = tree[key]
    if (!leaf.typeIndex && !leaf.__isPropDef) {
      getAllFieldFromObject(leaf, arr)
    } else {
      arr.push(leaf.path.join('.'))
    }
  }
  return arr
}

const convertToIncludeTree = (tree: SchemaPropTree | PropDef) => {
  const arr = []
  for (const key in tree) {
    const item = tree[key]
    if (item.__isPropDef === true) {
      arr.push(key, item)
    } else {
      arr.push(key, convertToIncludeTree(item))
    }
  }
  return arr
}

const createOrGetRefIncludeDef = (
  ref: PropDef,
  include: QueryIncludeDef,
  query: Query,
  multiple: boolean,
) => {
  if (!include.refIncludes) {
    include.refIncludes = {}
  }

  const field = ref.prop
  if (!include.refIncludes[field]) {
    include.refIncludes[field] = {
      includePath: [...include.includePath, field],
      schema: query.db.schemaTypesParsed[ref.inverseTypeName],
      includeArr: [],
      includeFields: new Set(),
      mainLen: 0,
      referencesFilters: {},
      mainIncludes: {},
      includeTree: [],
      fromRef: ref,
      multiple,
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
  const field = include.schema.props[f]
  const path = f.split('.')

  if (!field) {
    let t: PropDef | SchemaPropTree = include.schema.tree
    for (let i = 0; i < path.length; i++) {
      const p = path[i]
      t = t[p]
      if (!t) {
        return
      }

      // 13: reference
      // 14: references
      if (isPropDef(t) && (t.typeIndex === 13 || t.typeIndex === 14)) {
        const refIncludeDef = createOrGetRefIncludeDef(
          t,
          include,
          query,
          t.typeIndex === 14,
        )
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

  if (field.typeIndex === 13 || field.typeIndex === 14) {
    const refIncludeDef = createOrGetRefIncludeDef(
      field,
      include,
      query,
      field.typeIndex === 14,
    )
    for (const f in refIncludeDef.schema.props) {
      // include all
      if (
        refIncludeDef.schema.props[f].typeIndex !== 13 &&
        refIncludeDef.schema.props[f].typeIndex !== 14
      ) {
        refIncludeDef.includeFields.add(f)
      }
    }
    return
  }

  if (field.seperate) {
    include.includeArr.push(field.prop)
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
