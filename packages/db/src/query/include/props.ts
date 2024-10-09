import { QueryDef } from '../types.js'

export const getAll = (props: QueryDef['props']): string[] => {
  const fields: string[] = []
  for (const key in props) {
    const prop = props[key]
    if (prop.typeIndex !== 13 && prop.typeIndex !== 14) {
      fields.push(prop.path.join('.'))
    }
  }
  return fields
}

// export const getAllProps = (def: QueryDef) => {
//   const f: number[] = []
//   for (const key in def.props) {
//     f.push(def.props[key].prop)
//   }
//   return f
// }

export const includeFields = (def: QueryDef, fields: string[]) => {
  for (const field of fields) {
    if (field === '*') {
      console.log(getAll(def.props))
      includeFields(def, getAll(def.props))
      // includeAllProps(def)
    } else {
      def.include.stringFields.add(field)
      // do something...
    }
  }
}

// export const includeAllProps = (def: QueryDef) => {
//   for (const key in def.props) {
//     const prop = def.props[key]
//     if (prop.typeIndex !== 13 && prop.typeIndex !== 14) {
//       def.include.props.add(prop.prop)
//     }
//   }
// }

// export const includeProps = (def: QueryDef, fields: number[]) => {
//   for (const elem of fields) {
//     def.include.props.add(elem)
//   }
// }

// export const includeProp = (def: QueryDef, field: string) => {
//   const p = def.props[field]
//   if (p) {
//     def.include.props.add(p.prop)
//     return true
//   }
//   return false
// }
