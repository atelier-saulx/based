import { BasedQueryResponse } from './BasedQueryResponse.js'
import { Query } from './query.js'
import { addInclude } from './include.js'
import { addConditions } from './filter.js'

export const get = (query: Query): BasedQueryResponse => {
  const start = query.offset ?? 0
  const end = query.limit ?? 1e3

  const d = performance.now()

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

  const conditionsBuffer = addConditions(query.conditions)

  const result: Buffer = query.db.native.getQuery(
    conditionsBuffer,
    query.schema.prefixString,
    query.schema.lastId,
    start,
    end,
    includeBuffer,
  )

  const time = performance.now() - d
  const q = new BasedQueryResponse(query, result)
  q.execTime = time
  return q
}
