import { getPropType } from './parse/utils.js'
import { isPropType, StrictSchema } from './types.js'

export const mermaid = (schema: StrictSchema) => {
  let mermaid = 'classDiagram'

  if (schema.types) {
    for (const type in schema.types) {
      for (const key in schema.types[type].props) {
        const prop = schema.types[type].props[key]
        const propType = getPropType(prop)
        if (isPropType('reference', prop)) {
          mermaid += `\n${type} --> ${prop.ref} : ${key}`
        } else if (isPropType('references', prop)) {
          mermaid += `\n${type} --> ${prop.items.ref} : ${key}[]`
        } else {
          mermaid += `\n${type} : ${propType} ${key}`
        }
      }
    }
  }

  return mermaid
}
