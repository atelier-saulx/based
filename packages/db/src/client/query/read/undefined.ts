// import {
//   STRING,
//   JSON,
//   TypeIndex,
//   BINARY,
//   CARDINALITY,
//   REFERENCES,
//   REFERENCE,
//   VECTOR,
//   PropDefEdge,
//   PropDef,
// } from '@based/schema/def'
// import { QueryDef } from '../types.js'
// import { Item } from './types.js'

// const undefinedValue = (q: QueryDef, def: PropDef | PropDefEdge) => {
//   const typeIndex = def.typeIndex
//   if (typeIndex === STRING) {
//     return ''
//   }
//   if (typeIndex === JSON) {
//     return null
//   }
//   if (typeIndex === BINARY) {
//     return new Uint8Array()
//   }
//   if (typeIndex === CARDINALITY) {
//     return 0
//   }
//   if (typeIndex === REFERENCES) {
//     return []
//   }
//   if (typeIndex === REFERENCE) {
//     return null
//   }
//   // text
//   return undefined
//   //     if (propType === VECTOR) {
//   //     return
//   //   }
// }

// export const undefinedProps = (id: number, q: QueryDef, item: Item) => {
//   for (const k in q.include.propsRead) {
//     if (q.include.propsRead[k] !== id) {
//       //   const prop = q.schema.reverseProps[k]
//       // handle edge
//       // Only relevant for seperate props
//       //   const prop = q.schema.reverseProps[k]
//       //   if (prop.typeIndex === CARDINALITY) {
//       //     addProp(prop, 0, item)
//       //   } else if (prop.typeIndex === TEXT && q.lang.lang == 0) {
//       //     const lan = getEmptyField(prop, item)
//       //     const lang = q.include.langTextFields.get(prop.prop).codes
//       //     if (lang.has(0)) {
//       //       for (const locale in q.schema.locales) {
//       //         if (lan[locale] == undefined) {
//       //           lan[locale] = ''
//       //         }
//       //       }
//       //     } else {
//       //       for (const code of lang) {
//       //         const locale = inverseLangMap.get(code)
//       //         if (!lan[locale]) {
//       //           lan[locale] = ''
//       //         }
//       //       }
//       //     }
//       // } else {
//       //   // selvaStringProp(q, prop, item)
//       // }
//     }
//   }
// }
