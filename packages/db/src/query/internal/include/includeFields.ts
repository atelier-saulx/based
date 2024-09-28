import { QueryDef, QueryDefType } from '../types.js'

// todo bit innefcient can change this later
export const includeAll = (props: QueryDef['props']): string[] => {
  const fields: string[] = []
  for (const key in props) {
    const prop = props[key]
    if (prop.typeIndex !== 13 && prop.typeIndex !== 14) {
      fields.push(prop.path.join('.'))
    }
  }
  return fields
}

export const includeFields = (def: QueryDef, fields: string[]) => {
  for (const field of fields) {
    if (field === '*') {
      includeFields(def, includeAll(def.props))
    } else {
      def.include.stringFields.add(field)
      // do something...
    }
  }
}
