import type { BasedQueryFunction } from '@based/functions'

const derp: BasedQueryFunction = (
  based,
  { type, start = 0, end = 1000, sort, order } = {},
  update,
) => {
  const query = based.db.query(type).range(start, end)
  if (sort && order) {
    query.sort(sort, order)
  }
  return query.subscribe(update)
}

export default derp
