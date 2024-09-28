import { BasedQueryResponse } from './BasedQueryResponse.js'
import { Query } from './query.js'
import { addInclude } from './include.js'
import { addConditions } from './filter.js'

export const get = (query: Query): BasedQueryResponse => {
  if (!query.includeDef) {
    // Make a function for this get all except refs
    for (const f in query.schema.props) {
      if (
        query.schema.props[f].typeIndex !== 13 &&
        query.schema.props[f].typeIndex !== 14
      ) {
        query.include(f)
      }
    }
  }

  const includeBuffer = addInclude(query, query.includeDef)

  const conditionsBuffer = addConditions(
    query.conditions,
    query.totalConditionSize,
  )

  let result: Buffer
  const d = performance.now()
  if (query.ids) {
    const start = query.offset ?? 0
    const end = query.limit ?? query.ids.length
    if (query.sortBuffer) {
      if (end < query.ids.length || query.offset) {
        query.ids = query.ids.slice(query.offset, end)
      }
      query.ids.sort((a, b) => (a > b ? 1 : a === b ? 0 : -1))
      const idsBuffer = Buffer.allocUnsafe(query.ids.length * 4)
      for (let i = 0; i < query.ids.length; i++) {
        idsBuffer.writeUInt32LE(query.ids[i], i * 4)
      }
      result = query.db.native.getQueryIdsSort(
        conditionsBuffer,
        query.schema.id,
        start,
        end,
        idsBuffer,
        includeBuffer,
        query.sortBuffer,
        query.sortOrder,
        query.ids[0],
        query.ids[query.ids.length - 1],
      )
    } else {
      if (end < query.ids.length || query.offset) {
        query.ids = query.ids.slice(query.offset, end)
      }
      const idsBuffer = Buffer.allocUnsafe(query.ids.length * 4)
      for (let i = 0; i < query.ids.length; i++) {
        idsBuffer.writeUInt32LE(query.ids[i], i * 4)
      }
      result = query.db.native.getQueryByIds(
        conditionsBuffer,
        query.schema.id,
        idsBuffer,
        includeBuffer,
      )
    }
  } else if (query.id) {
    result = query.db.native.getQueryById(
      conditionsBuffer,
      query.schema.id,
      query.id,
      includeBuffer,
    )
  } else if (query.sortBuffer) {
    const start = query.offset ?? 0
    const end = query.limit ?? 1e3
    result = query.db.native.getQuerySort(
      conditionsBuffer,
      query.schema.id,
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
      query.schema.id,
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
