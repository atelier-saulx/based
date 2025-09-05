import { hash } from '@based/hash'
import { getPropType } from "./parse/utils.js";
import { StrictSchema } from "./types.js"
import { deepCopy } from '@based/utils'

export type DbSchema = StrictSchema & { lastId: number; hash: number }
export type SchemaChecksum = number

export const strictSchemaToDbSchema = (schema: StrictSchema): DbSchema => {
  // @ts-ignore
  let dbSchema: DbSchema = deepCopy(schema)

  // reserve 1 for root (even if you dont have it)
  dbSchema.lastId = 1

  if (dbSchema.props) {
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

  delete dbSchema.hash
  dbSchema.hash = hash(dbSchema)

  return dbSchema
}
