import type { BasedQueryFunction } from '@based/functions'

const schema: BasedQueryFunction = (based, payload, update) => {
  if (based.db.schema) {
    update(based.db.schema)
  }
  based.db.on('schema', update)
  return () => based.db.off('schema', update)
}

export default schema
