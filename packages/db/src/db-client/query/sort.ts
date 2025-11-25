import { QueryDef } from './types.js'
import { validateSort } from './validation.js'

// NO REF / REFERENCES SUPPORT
export const sort = (def: QueryDef, field: string, order?: 'asc' | 'desc') => {
  if (field === 'id' && order === 'asc') {
    return
  }
  def.sort = validateSort(def, field, order)
}
