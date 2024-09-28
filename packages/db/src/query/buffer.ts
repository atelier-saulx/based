import { BasedQueryResponse } from './BasedQueryResponse.js'
import { Query } from './query.js'
import { addInclude } from './include.js'
import { addConditions } from './filter.js'

export const toBuffer = (
  query: Query,
): {
  include: Buffer
  filter: Buffer
} => {
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

  // query.includeBuffer = includeBuffer

  const conditionsBuffer = addConditions(
    query.conditions,
    query.totalConditionSize,
  )

  return {
    include: includeBuffer,
    filter: conditionsBuffer,
  }
}
