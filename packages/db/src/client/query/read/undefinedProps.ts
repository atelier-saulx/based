import { QueryDef } from '../../../index.js'
import { Item } from './types.js'
// import { addProp } from './addProps.js'
// import { CARDINALITY, PropDef, PropDefEdge, TEXT } from '@based/schema/def'
// import { inverseLangMap } from '@based/schema'

// const getDefaultSeperateValue = (prop: PropDef | PropDefEdge) => {
//   if (
//     prop.typeIndex === TEXT ||
//     prop.typeIndex === STRING ||
//     prop.typeIndex === ALIAS
//   ) {
//     return ''
//   }
//   if (prop.typeIndex === JSON) {
//     return null
//   }
//   if (prop.typeIndex === BINARY) {
//     return new Uint8Array()
//   }
// }

// const getEmptyField = (p: PropDef | PropDefEdge, item: Item) => {
//   let i = p.__isEdge === true ? 1 : 0
//   const path = p.path
//   const len = path.length
//   let select: any = item

//   if (len - i === 1) {
//     const field = path[i]
//     if (!(field in item)) {
//       select = item[field] = {}
//     } else {
//       return item[field]
//     }
//   } else {
//     for (; i < len; i++) {
//       const field = path[i]
//       select = select[field] ?? (select[field] = {})
//     }
//   }
//   return select
// }

export const undefinedProps = (id: number, q: QueryDef, item: Item) => {
  // for (const k in q.include.propsRead) {
  //   if (q.include.propsRead[k] !== id) {
  //     // Only relevant for seperate props
  //     const prop = q.schema.reverseProps[k]
  //     if (prop.typeIndex === CARDINALITY) {
  //       addProp(prop, 0, item)
  //     } else if (prop.typeIndex === TEXT && q.lang.lang == 0) {
  //       const lan = getEmptyField(prop, item)
  //       const lang = q.include.langTextFields.get(prop.prop).codes
  //       if (lang.has(0)) {
  //         for (const locale in q.schema.locales) {
  //           if (lan[locale] == undefined) {
  //             lan[locale] = ''
  //           }
  //         }
  //       } else {
  //         for (const code of lang) {
  //           const locale = inverseLangMap.get(code)
  //           if (!lan[locale]) {
  //             lan[locale] = ''
  //           }
  //         }
  //       }
  //     } else {
  //       // selvaStringProp(q, prop, item)
  //     }
  //   }
  // }
}
