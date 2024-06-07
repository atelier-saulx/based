import { FieldDef, SchemaFieldTree } from '../schemaTypeDef.js'
import { BasedQueryResponse } from './BasedQueryResponse.js'
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

const parseInclude = (
  query: Query,
  f: string,
  arr: number[],
  includesMain: boolean,
): boolean => {
  const field = query.type.fields[f]
  if (!field) {
    const tree = query.type.tree[f]
    if (tree) {
      const endFields = getAllFieldFromObject(tree)
      for (const field of endFields) {
        if (parseInclude(query, field, arr, includesMain)) {
          includesMain = true
        }
      }
      return includesMain
    }
    return
  }
  if (field.seperate) {
    arr.push(field.field)
  } else {
    if (!includesMain) {
      query.mainIncludes = new Map()
      includesMain = true
      arr.push(0)
    }
    query.mainIncludes.set(field.start, [query.mainLen, field.len])
    query.mainLen += field.len
    return true
  }
}

export const get = (query: Query): BasedQueryResponse => {
  let includeBuffer: Buffer
  let len = 0
  let mainBuffer: Buffer

  if (!query.includeFields) {
    len = 1
    const fields = query.type.fields
    for (const f in fields) {
      const field = fields[f]
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
  } else {
    let includesMain = false
    const arr = []
    for (const f of query.includeFields) {
      if (parseInclude(query, f, arr, includesMain)) {
        includesMain = true
      }
    }
    len += arr.length
    includeBuffer = Buffer.from(arr)
    // 16 start and end
    if (query.mainLen === query.type.mainLen) {
      mainBuffer = Buffer.from([0])
    } else {
      const size = query.mainIncludes.size
      mainBuffer = Buffer.allocUnsafe(size * 6 + 1 + 4)
      mainBuffer[0] = 1
      mainBuffer.writeUint32LE(query.mainLen, 1)
      let i = 5
      query.mainIncludes.forEach((v, k) => {
        mainBuffer.writeUint16LE(k, i)
        mainBuffer.writeUint16LE(v[1], i + 2)
        i += 4
      })
    }
  }

  // TODO also without conditions has to work....
  if (query.conditions) {
    const conditions = Buffer.allocUnsafe(query.totalConditionSize)
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

    const start = query.offset ?? 0
    const end = query.limit ?? 1e3

    // console.log({
    //   conditions: new Uint8Array(conditions),
    //   include: new Uint8Array(includeBuffer),
    //   mainBuffer: new Uint8Array(mainBuffer)
    // })

    const result: Buffer = query.db.native.getQuery(
      conditions,
      query.type.prefixString,
      query.type.lastId,
      start,
      end, // def 1k ?
      includeBuffer,
      mainBuffer,
    )

    // console.log('RESULT', new Uint8Array(result))

    return new BasedQueryResponse(query, result)
  } else {
    // what?
  }
}
