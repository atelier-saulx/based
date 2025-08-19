import type { BasedFunction, BasedQueryFunction } from '@based/functions'

const derp: BasedQueryFunction = (based, payload, update) => {
  return based.db.query('thing').subscribe(update)
}

export default derp
