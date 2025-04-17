import {
  isPropType,
  SchemaProps,
  SchemaPropsOneWay,
  StrictSchema,
  getPropType,
} from '@based/schema'

export const mermaid = (schema: StrictSchema) => {
  let mermaid = 'classDiagram'

  const parse = (
    type: string,
    props: SchemaProps | SchemaPropsOneWay,
    indent = '',
  ) => {
    for (const key in props) {
      const prop = props[key]

      if (isPropType('reference', prop)) {
        mermaid += `\n${type} --> ${prop.ref} : ${key}`
      } else if (isPropType('references', prop)) {
        mermaid += `\n${type} --> ${prop.items.ref} : ${key}[]`
      } else {
        const propType = getPropType(prop)
        mermaid += `\n${type} : ${indent}${key} __${propType}__`
        if (isPropType('object', prop)) {
          parse(type, prop.props, `${indent}.`)
        }
      }
    }
  }

  if (schema.props) {
    parse('_root', schema.props)
  }

  if (schema.types) {
    for (const type in schema.types) {
      parse(type, schema.types[type].props)
    }
  }

  return mermaid
}
