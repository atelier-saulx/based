import type { BasedQueryFunction } from '@based/functions'

const derp: BasedQueryFunction = (
  based,
  { type, start = 0, end = 1000, sort, search } = {},
  update,
) => {
  const query = based.db.query(type).include('*', '**')
  if (sort?.field) {
    query.sort(sort.field, sort.order)
  }
  if (search?.query) {
    query.search(search.query, search.fields)
  }
  return query.range(start, end).subscribe(update)
}

export default derp
