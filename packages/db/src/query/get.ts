import { BasedQueryResponse } from './BasedQueryResponse.js'
import { Query } from './query.js'
import { addInclude } from './include.js'
import { addConditions } from './filter.js'

export const get = (query: Query): BasedQueryResponse => {
  if (!query.includeDef) {
    for (const f in query.schema.fields) {
      if (
        query.schema.fields[f].type !== 'reference' &&
        query.schema.fields[f].type !== 'references'
      ) {
        query.include(f)
      }
    }
  }

  const includeBuffer = addInclude(query, query.includeDef)
  const conditionsBuffer = addConditions(query)

  let result: Buffer
  const d = performance.now()

  if (query.ids) {
    const idsBuffer = Buffer.allocUnsafe(query.ids.length * 4)
    for (let i = 0; i < query.ids.length; i++) {
      idsBuffer.writeUInt32LE(query.ids[i], i * 4)
    }
    if (query.sortBuffer) {
      result = query.db.native.getQueryIdsSort(
        conditionsBuffer,
        query.schema.prefixString,
        idsBuffer,
        includeBuffer,
        query.schema.lastId,
        query.sortBuffer,
        query.sortOrder,
      )
    } else {
      result = query.db.native.getQueryByIds(
        conditionsBuffer,
        query.schema.prefixString,
        idsBuffer,
        includeBuffer,
      )
    }
  } else if (query.id) {
    result = query.db.native.getQueryById(
      conditionsBuffer,
      query.schema.prefixString,
      query.id,
      includeBuffer,
    )
  } else if (query.sortBuffer) {
    const start = query.offset ?? 0
    const end = query.limit ?? 1e3
    result = query.db.native.getQuerySort(
      conditionsBuffer,
      query.schema.prefixString,
      query.schema.lastId,
      start,
      end,
      includeBuffer,
      query.sortBuffer,
      query.sortOrder,
    )
  } else {
    const start = query.offset ?? 0
    const end = query.limit ?? 1e3
    result = query.db.native.getQuery(
      conditionsBuffer,
      query.schema.prefixString,
      query.schema.lastId,
      start,
      end,
      includeBuffer,
    )
  }

  const time = performance.now() - d
  const q = new BasedQueryResponse(query, result)
  q.execTime = time
  return q
}
