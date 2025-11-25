import type { SchemaOut, SchemaProps } from './schema/index.js'

export const mermaid2 = (schema: SchemaOut) => {
  let mermaid = 'erDiagram'
  let relations = ''

  const parse = (type: string, props: SchemaProps<true>, indent = '') => {
    let entity = indent ? '' : `\n${type} {`
    for (const key in props) {
      const prop = props[key]
      if (prop.type === 'reference') {
        entity += `\n${prop.ref} ${indent}${key}`
        relations += `\n${type} ||--o| ${prop.ref} : ${key}`
      } else if (prop.type === 'references') {
        entity += `\n${prop.items.ref} ${indent}${key}`
        relations += `\n${type} ||--o{ ${prop.items.ref} : ${key}`
      } else {
        entity += `\n${prop.type} ${indent}${key}`
        if (prop.type === 'object') {
          entity += parse(type, prop.props, `${indent}_`)
        } else if (prop.type === 'enum') {
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

  if (schema.types) {
    for (const type in schema.types) {
      mermaid += parse(type, schema.types[type].props)
    }
  }

  return mermaid + relations
}
export const mermaid = (schema: SchemaOut) => {
  let mermaid = 'classDiagram'

  const parse = (type: string, props: SchemaProps, indent = '') => {
    for (const key in props) {
      const prop = props[key]

      if (prop.type === 'reference') {
        mermaid += `\n${type} --> ${prop.ref} : ${key}`
      } else if (prop.type === 'references') {
        mermaid += `\n${type} --> ${prop.items.ref} : ${key}[]`
      } else {
        const propType = prop.type
        mermaid += `\n${type} : ${indent}${key} __${propType}__`
        if (prop.type === 'object') {
          parse(type, prop.props, `${indent}.`)
        }
      }
    }
  }

  if (schema.types) {
    for (const type in schema.types) {
      parse(type, schema.types[type].props)
    }
  }

  return mermaid
}
