import {
  PropDef,
  PropDefEdge,
  REFERENCE,
  REFERENCES,
} from '../../../server/schema/types.js'
import { QueryDef } from '../types.js'

export const getAll = (props: QueryDef['props']): string[] => {
  const fields: string[] = []
  for (const key in props) {
    const prop = props[key]
    if (prop.typeIndex !== REFERENCE && prop.typeIndex !== REFERENCES) {
      fields.push(prop.path.join('.'))
    }
  }
  return fields
}

export const includeFields = (def: QueryDef, fields: string[]) => {
  for (const field of fields) {
    if (field === '*') {
      includeFields(def, getAll(def.props))
    } else {
      def.include.stringFields.add(field)
    }
  }
}

export const includeAllProps = (def: QueryDef) => {
  for (const key in def.props) {
    const prop = def.props[key]
    if (prop.typeIndex !== REFERENCE && prop.typeIndex !== REFERENCES) {
      includeProp(def, prop)
    }
  }
}

export const includeProp = (def: QueryDef, prop: PropDef | PropDefEdge) => {
  if (!prop || prop.typeIndex === REFERENCE || prop.typeIndex === REFERENCES) {
    return false
  }
  if (prop.separate) {
    def.include.props.add(prop.prop)
  } else {
    def.include.main.len += prop.len
    def.include.main.include[prop.start] = [0, prop as PropDef]
    return true
  }
  return false
}
