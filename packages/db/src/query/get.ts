import { BasedQueryResponse } from './BasedQueryResponse.js'
import { Query } from './query.js'
import {
  parseInclude,
  addPathToIntermediateTree,
  convertToIncludeTree,
} from './include.js'
import { createSingleRefBuffer } from './singleRef.js'

const idFieldDef = {
  __isField: true,
  type: 'id',
}

const EMPTY_BUFFER = Buffer.alloc(0)

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

    if (includesMain) {
      if (query.mainLen === query.type.mainLen) {
        // GET ALL MAIN FIELDS
        let m = 0
        for (const key in query.mainIncludes) {
          const v = query.mainIncludes[key]
          const len = v[1].len
          v[0] = m
          m += len
        }
        mainBuffer = EMPTY_BUFFER
      } else {
        // GET SOME MAIN FIELDS
        const size = Object.keys(query.mainIncludes).length
        mainBuffer = Buffer.allocUnsafe(size * 4 + 4)
        mainBuffer.writeUint32LE(query.mainLen, 0)
        let i = 4
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
      mainBuffer = EMPTY_BUFFER
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
    mainBuffer = EMPTY_BUFFER
    query.mainLen = query.type.mainLen
  }

  query.includeTree = convertToIncludeTree(includeTreeIntermediate)

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
    refBuffer = createSingleRefBuffer(query)
  } else {
    refBuffer = EMPTY_BUFFER
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

  console.log('RESULT', new Uint8Array(result))

  const time = performance.now() - d
  const q = new BasedQueryResponse(query, result)
  q.execTime = time
  return q
}
