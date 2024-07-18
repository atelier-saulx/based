import { BasedQueryResponse } from './BasedQueryResponse.js'
import { Query } from './query.js'
import {
  parseInclude,
  addPathToIntermediateTree,
  convertToIncludeTree,
} from './include.js'

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
        const size = query.mainIncludesSize
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
    const arr = []
    // [len][len][type][type][start][start] [255][len][len][type][type][start][start][1]   ([0][0] | [0][255][offset][offset][len][len][0]) [1][2]

    for (const ref of query.refIncludes) {
      // only do main to start...
      let refsingleBuffer: Buffer
      let size = 6
      if (ref.mainLen) {
        size += 2
        if (ref.mainLen !== ref.schema.mainLen) {
          size += 1
          size += ref.main.length * 4

          refsingleBuffer = Buffer.allocUnsafe(size)

          refsingleBuffer.writeUint16LE(size - 6)

          refsingleBuffer[2] = ref.schema.prefix[0]
          refsingleBuffer[3] = ref.schema.prefix[1]

          refsingleBuffer.writeUint16LE(ref.ref.start, 4)

          refsingleBuffer[6] = 0
          refsingleBuffer[7] = 255

          let i = 8
          for (let x of ref.main) {
            refsingleBuffer.writeUint16LE(x.start, i)
            refsingleBuffer.writeUint16LE(x.len, i + 2)
            i += 4
          }

          refsingleBuffer[size - 1] = 0

          arr.push(refsingleBuffer)
        }
      }
    }
    refBuffer = Buffer.concat(arr)
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
  const time = performance.now() - d
  const q = new BasedQueryResponse(query, result)
  q.execTime = time
  return q
}
