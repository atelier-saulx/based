import { getPropType, StrictSchema } from '@based/schema'

const exclude = new Set(['id', 'lastId', 'hash'])
export const schemaLooseEqual = (a: any, b: any, key?: string) => {
  if (a === b) {
    return true
  }
  const typeofA = typeof a
  if (typeofA !== 'object') {
    return exclude.has(key)
  }
  const typeofB = typeof b
  if (typeofA !== typeofB) {
    return exclude.has(key)
  }
  if (a === null || b === null) {
    return false
  }
  if (a.constructor !== b.constructor) {
    return false
  }
  if (Array.isArray(a)) {
    let i = a.length
    if (i !== b.length) {
      return false
    }
    while (i--) {
      if (!schemaLooseEqual(a[i], b[i])) {
        return false
      }
    }
  } else {
    for (const k in a) {
      if (!schemaLooseEqual(a[k], b[k], k)) {
        return false
      }
    }
    for (const k in b) {
      if (k in a) {
        continue
      }
      if (!schemaLooseEqual(a[k], b[k], k)) {
        return false
      }
    }
  }
  return true
}

export const parseSchema = (strictSchema: StrictSchema): StrictSchema => {
  let parsedSchema = strictSchema
  if (strictSchema.props) {
    parsedSchema = { ...strictSchema }
    parsedSchema.types ??= {}
    const props = { ...strictSchema.props }
    for (const key in props) {
      const prop = props[key]
      const propType = getPropType(prop)
      let refProp: any
      if (propType === 'reference') {
        refProp = prop
      } else if (propType === 'references') {
        refProp = prop.items
      }
      if (refProp) {
        const type = parsedSchema.types[refProp.ref]
        const inverseKey = '_' + key
        parsedSchema.types[refProp.ref] = {
          ...type,
          props: {
            ...type.props,
            [inverseKey]: {
              items: {
                ref: '_root',
                prop: key,
              },
            },
          },
        }
        refProp.prop = inverseKey
      }
    }

    // @ts-ignore This creates an internal type to use for root props
    parsedSchema.types._root = {
      id: 1,
      props,
    }

    delete parsedSchema.props
  }

  return parsedSchema
}
