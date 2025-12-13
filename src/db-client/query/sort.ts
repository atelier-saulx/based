import { QueryDef } from './types.js'
import { validateSort } from './validation.js'

export const sort = (def: QueryDef, field: string) => {
  // this is slightly lame... maybe just add validate here...
  def.sort = validateSort(def, field)
}
