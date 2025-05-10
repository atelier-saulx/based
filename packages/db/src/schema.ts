import { getPropType, StrictSchema } from '@based/schema'
import { hash } from '@saulx/hash'
import { deepCopy } from '@saulx/utils'

export type DbSchema = StrictSchema & { lastId: number; hash: number }

export type SchemaHasChanged = boolean

// later...
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

export const strictSchemaToDbSchema = (schema: StrictSchema): DbSchema => {
  // @ts-ignore
  let dbSchema: DbSchema = deepCopy(schema)

  // if (Object.keys(this.schema.types).length > 0) {
  //   if (schemaLooseEqual(parsedSchema, this.schema)) {
  //     return this.schema
  //   }
  // }

  // reserve 1 for root (even if you dont have it)
  dbSchema.lastId = 1

  if (schema.props) {
    for (const key in dbSchema.props) {
      const prop = dbSchema.props[key]
      const propType = getPropType(prop)
      let refProp: any

      if (propType === 'reference') {
        refProp = prop
      } else if (propType === 'references') {
        refProp = prop.items
        prop.items = refProp
      }

      if (refProp) {
        const type = dbSchema.types[refProp.ref]
        const inverseKey = '_' + key
        dbSchema.types[refProp.ref] = {
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

    dbSchema.types ??= {}
    // @ts-ignore This creates an internal type to use for root props
    dbSchema.types._root = {
      id: 1,
      props: dbSchema.props,
    }
    delete dbSchema.props
  }

  for (const field in dbSchema.types) {
    if (!('id' in dbSchema.types[field])) {
      dbSchema.lastId++
      dbSchema.types[field].id = dbSchema.lastId
    }
  }
  const { hash: _, ...rest } = dbSchema
  dbSchema.hash = hash(rest)

  return dbSchema
}
