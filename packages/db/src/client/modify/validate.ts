import { PropDef, PropDefEdge } from '@based/schema/def'

export const validate = (def: PropDef | PropDefEdge, val: any) => {
  if (!def.validation(val, def)) {
    throw [def, val]
  }
}
