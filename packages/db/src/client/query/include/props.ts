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

export const getAllRefs = (props: QueryDef['props'], affix = ''): string[] => {
  const fields: string[] = []
  for (const key in props) {
    const prop = props[key]
    if (prop.typeIndex === REFERENCE || prop.typeIndex === REFERENCES) {
      fields.push(prop.path.join('.') + affix)
    }
  }
  return fields
}

export const includeField = (def: QueryDef, field: string) => {
  if (field === '*') {
    includeFields(def, getAll(def.props))
  } else if (field === '**') {
    includeFields(def, getAllRefs(def.props))
  } else if (field.startsWith('**.')) {
    includeFields(def, getAllRefs(def.props, field.substring(2)))
  } else {
    def.include.stringFields.add(field)
  }
}

export const includeFields = (def: QueryDef, fields: string[]) => {
  for (const field of fields) {
    includeField(def, field)
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
    def.include.props.set(prop.prop, prop)
  } else {
    def.include.main.len += prop.len
    def.include.main.include[prop.start] = [0, prop as PropDef]
    return true
  }
  return false
}
