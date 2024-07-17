import { FieldDef, SchemaFieldTree } from '../schemaTypeDef.js'
import { BasedQueryResponse } from './BasedQueryResponse.js'
import { Query } from './query.js'

const idFieldDef = {
  __isField: true,
  type: 'id',
}

const defEmptyBuffer = Buffer.from(new Uint8Array([0]))

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
    // singleRefBuffer

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
      mainBuffer = defEmptyBuffer //Buffer.from([0])
    }
  } else {
    len = 1
    const fields = query.type.fields
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
    mainBuffer = defEmptyBuffer
    query.mainLen = query.type.mainLen
  }

  query.includeTree = convertToIncludeTree(includeTreeIntermediate)

  // console.dir(
  //   { includeTreeIntermediate, includeTree: query.includeTree },
  //   { depth: null },
  // )

  const start = query.offset ?? 0
  const end = query.limit ?? 1e3

  let conditions
  if (query.conditions) {
    conditions = Buffer.allocUnsafe(query.totalConditionSize)
    let lastWritten = 0
    query.conditions.forEach((v, k) => {
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

  let refBuffer: Buffer
  if (query.refIncludes) {
    const arr = []
    // [len][len][type][type][start][start] [255][len][len][type][type][start][start][1]   ([0][0] | [0][255][offset][offset][len][len][0]) [1][2]

    for (const ref of query.refIncludes) {
      // only do main to start...
      console.info({ ref })
      let refsingleBuffer: Buffer
      let size = 6
      if (ref.mainLen) {
        size += 2
        if (ref.mainLen !== ref.schema.mainLen) {
          size += 1
          size += ref.main.length * 4

          refsingleBuffer = Buffer.allocUnsafe(size)

          refsingleBuffer.writeUint16LE(size - 6)

          console.log('PREFIX', ref.schema.prefix)

          refsingleBuffer[2] = ref.schema.prefix[0]
          refsingleBuffer[3] = ref.schema.prefix[1]

          refsingleBuffer.writeUint16LE(ref.ref.start, 4)

          refsingleBuffer[6] = 0
          refsingleBuffer[7] = 255

          let i = 8
          for (let x of ref.main) {
            // lengte van 4
            // start, len

            refsingleBuffer.writeUint16LE(x.start, i)
            refsingleBuffer.writeUint16LE(x.len, i + 2)

            i += 4
          }

          refsingleBuffer[size - 1] = 0

          console.log('HELLO')
          arr.push(refsingleBuffer)
        }
      }
    }
    refBuffer = Buffer.concat(arr)

    console.info('>>>', new Uint8Array(refBuffer))
  } else {
    refBuffer = defEmptyBuffer
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
    refBuffer,
  )
  const time = performance.now() - d
  const q = new BasedQueryResponse(query, result)
  q.execTime = time
  return q
}
