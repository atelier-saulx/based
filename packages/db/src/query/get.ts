import { FieldDef, SchemaFieldTree, SchemaTypeDef } from '../schemaTypeDef.js'
import { BasedQueryResponse } from './BasedQueryResponse.js'
import { Query } from './query.js'

const getAllFieldFromObject = (
  tree: SchemaFieldTree | FieldDef,
  arr: string[] = [],
) => {
  // make fn and optmize...
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
    // start /w field.start (this allows us to skip pieces of the buffer in zig (later!))
    query.mainIncludes.set(field.start, field.start)
    return true
  }
}

export const get = (query: Query): BasedQueryResponse => {
  let includeBuffer: Buffer
  let len = 0
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
  } else {
    // include main is tmp...
    let includesMain = false // Buffer [0, ]
    const arr = []
    for (const f of query.includeFields) {
      if (parseInclude(query, f, arr, includesMain)) {
        includesMain = true
      }
    }
    len += arr.length
    includeBuffer = Buffer.from(arr)
  }

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
    // })

    const result: Buffer = query.db.native.getQuery(
      conditions,
      query.type.prefixString,
      query.type.lastId,
      start,
      end, // def 1k ?
      includeBuffer,
    )

    // console.log(result)

    // size estimator pretty nice to add

    // buffer.toString('utf8', i, size + i)
    // @ts-ignore
    // console.log({ result, x: result.map((v) => v.toString('utf8')) })

    // result.rem

    return new BasedQueryResponse(query, result)
  } else {
    // what?
  }
}
