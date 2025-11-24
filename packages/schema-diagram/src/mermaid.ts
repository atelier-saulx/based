import {
  isPropType,
  SchemaProps,
  SchemaPropsOneWay,
  StrictSchema,
} from '@based/schema'

export const mermaid2 = (schema: StrictSchema) => {
  let mermaid = 'erDiagram'
  let relations = ''

  const parse = (
    type: string,
    props: SchemaProps | SchemaPropsOneWay,
    indent = '',
  ) => {
    let entity = indent ? '' : `\n${type} {`
    for (const key in props) {
      const prop = props[key]
      if (isPropType('reference', prop)) {
        entity += `\n${prop.ref} ${indent}${key}`
        relations += `\n${type} ||--o| ${prop.ref} : ${key}`
      } else if (isPropType('references', prop)) {
        entity += `\n${prop.items.ref} ${indent}${key}`
        relations += `\n${type} ||--o{ ${prop.items.ref} : ${key}`
      } else {
        entity += `\n${prop.type} ${indent}${key}`
        if (isPropType('object', prop)) {
          entity += parse(type, prop.props, `${indent}_`)
        } else if (isPropType('enum', prop)) {
          entity += '"'
          if (prop.enum.length > 3) {
            const [a, b, c] = prop.enum
            entity += [a, b, c, `+${prop.enum.length - 3}`].join(', ')
          } else {
            entity += prop.enum.join(', ')
          }
          entity += '"'
        }
      }
    }

    if (!indent) {
      entity += '\n}'
    }

    return entity
  }

  if (schema.props) {
    mermaid += parse('_root', schema.props)
  }

  if (schema.types) {
    for (const type in schema.types) {
      mermaid += parse(type, schema.types[type].props)
    }
  }

  return mermaid + relations
}
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
        const propType = prop.type
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
