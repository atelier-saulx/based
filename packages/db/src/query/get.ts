import { FieldDef, SchemaFieldTree } from '../schemaTypeDef.js'
import { BasedQueryResponse } from './BasedQueryResponse.js'
import { Query } from './query.js'

const idFieldDef = {
  __isField: true,
  type: 'id',
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

const addPathToTree = (field: FieldDef, includeTree: any) => {
  const len = field.path.length - 1
  let t = includeTree
  for (let i = 0; i <= len; i++) {
    const key = field.path[i]
    if (i === len) {
      t[key] = field
    } else {
      if (!(key in t)) {
        t[key] = {}
      }
      t = t[key]
    }
  }
}

const parseInclude = (
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
    return
  }

  addPathToTree(field, includeTree)

  if (field.seperate) {
    arr.push(field.field)
  } else {
    if (!includesMain) {
      query.mainIncludes = {}
      query.mainIncludesSize = 0
      includesMain = true
      arr.push(0)
    }

    // if REF e.g. user.string need to add more stuff
    // combine all tings for user in 1 include msg
    // [type 10].[id]0230 4 // selective main as well ofc     // end ref 255

    query.mainIncludesSize++
    query.mainLen += field.len
    query.mainIncludes[field.start] = [0, field]
    return true
  }
}

export const get = (query: Query): BasedQueryResponse => {
  let includeBuffer: Buffer
  let len = 0
  let mainBuffer: Buffer

  const includeTreeIntermediate = {
    id: idFieldDef,
  }

  if (query.includeFields) {
    let includesMain = false
    const arr = []
    for (const f of query.includeFields) {
      if (parseInclude(query, f, arr, includesMain, includeTreeIntermediate)) {
        includesMain = true
      }
    }

    len += arr.length
    includeBuffer = Buffer.from(arr)
    // 16 start and end
    if (includesMain) {
      if (query.mainLen === query.type.mainLen) {
        let m = 0
        for (const key in query.mainIncludes) {
          const v = query.mainIncludes[key]
          const len = v[1].len
          v[0] = m
          m += len
        }
        mainBuffer = Buffer.from([0])
      } else {
        const size = query.mainIncludesSize
        mainBuffer = Buffer.allocUnsafe(size * 4 + 5)
        mainBuffer[0] = 1
        mainBuffer.writeUint32LE(query.mainLen, 1)
        let i = 5
        let m = 0
        for (const key in query.mainIncludes) {
          const v = query.mainIncludes[key]
          mainBuffer.writeUint16LE(v[1].start, i)
          const len = v[1].len
          v[0] = m
          mainBuffer.writeUint16LE(len, i + 2)
          i += 4
          m += len
        }
      }
    } else {
      mainBuffer = Buffer.from([0])
    }
  } else {
    len = 1
    const fields = query.type.fields
    for (const f in fields) {
      const field = fields[f]
      addPathToTree(field, includeTreeIntermediate)
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
    mainBuffer = Buffer.from([0])
    query.mainLen = query.type.mainLen
  }

  query.includeTree = convertToIncludeTree(includeTreeIntermediate)

  const start = query.offset ?? 0
  const end = query.limit ?? 1e3

  let conditions
  if (query.conditions) {
    // flap

    // add FIELD SWAP
    conditions = Buffer.allocUnsafe(query.totalConditionSize)
    let lastWritten = 0
    query.conditions.forEach((v, k) => {
      //
      conditions[lastWritten] = k
      let sizeIndex = lastWritten + 1
      lastWritten += 3
      let conditionSize = 0
      for (const condition of v) {
        conditionSize += condition.byteLength
        conditions.set(condition, lastWritten)
        lastWritten += condition.byteLength
      }
      conditions.writeInt16LE(conditionSize, sizeIndex)
    })
  } else {
    conditions = Buffer.alloc(0)
  }

  const d = performance.now()
  const result: Buffer = query.db.native.getQuery(
    conditions,
    query.type.prefixString,
    query.type.lastId,
    start,
    end, // def 1k ?
    includeBuffer,
    mainBuffer,
  )
  const time = performance.now() - d
  const q = new BasedQueryResponse(query, result)
  q.execTime = time
  return q
}
