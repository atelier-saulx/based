import { BasedQueryResponse } from './BasedQueryResponse.js'
import { Query } from './query.js'
import { addInclude } from './include.js'

const EMPTY_BUFFER = Buffer.alloc(0)

export const get = (query: Query): BasedQueryResponse => {
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

  const d = performance.now()

  const { includeBuffer, mainBuffer, refBuffer } = addInclude(query.includeDef)

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
