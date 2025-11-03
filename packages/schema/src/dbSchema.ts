import { hash } from '@based/hash'
// import { getPropType } from './parse/utils.js'
import {
  SchemaPropOneWay,
  SchemaProps,
  SchemaTypes,
  StrictSchema,
} from './types.js'
import { deepCopy } from '@based/utils'

export type DbSchema = StrictSchema & { lastId: number; hash?: number }
export type SchemaChecksum = number

function _makeEdgeTypes(
  newTypes: SchemaTypes<true>,
  typeName: string,
  props: SchemaProps<true>,
  propPrefix: string,
): void {
  type EdgeProps = Record<`$${string}`, SchemaPropOneWay>
  const putEdgeProps = (
    typeName: string,
    refPath: string,
    edgeProps: EdgeProps,
  ) => (newTypes[`_${typeName}:${refPath}`] = { props: edgeProps })

  for (const propName in props) {
    const prop = props[propName]
    const propType = prop.type //getPropType(prop)
    const nextPropPrefix = propPrefix ? `${propPrefix}.${propName}` : propName

    if (propType === 'object') {
      _makeEdgeTypes(newTypes, typeName, prop.props, nextPropPrefix)
    } else if (propType === 'reference') {
      const edgeProps: Record<`$${string}`, SchemaPropOneWay> = {}
      Object.keys(prop)
        .filter((k) => k[0] === '$')
        .forEach((k) => (edgeProps[k] = prop[k]))

      if (Object.keys(edgeProps).length > 0) {
        putEdgeProps(typeName, nextPropPrefix, edgeProps)
      }
    } else if (propType === 'references') {
      const edgeProps: Record<`$${string}`, SchemaPropOneWay> = {}
      Object.keys(prop.items)
        .filter((k) => k[0] === '$')
        .forEach((k) => (edgeProps[k] = prop.items[k]))

      if (Object.keys(edgeProps).length > 0) {
        putEdgeProps(typeName, nextPropPrefix, edgeProps)
      }
    }
  }
}

function makeEdgeTypes(types: SchemaTypes<true>): SchemaTypes<true> {
  const newTypes = {}

  for (const typeName in types) {
    const type = types[typeName]
    _makeEdgeTypes(newTypes, typeName, type.props, '')
  }

  return newTypes
}

export const strictSchemaToDbSchema = (schema: StrictSchema): DbSchema => {
  // @ts-ignore
  let dbSchema: DbSchema = deepCopy(schema)

  // reserve 1 for root (even if you dont have it)
  dbSchema.lastId = 1

  // // Make the _root type
  // if (dbSchema.props) {
  //   for (const key in dbSchema.props) {
  //     const prop = dbSchema.props[key]
  //     const propType = getPropType(prop)
  //     let refProp: any

  //     if (propType === 'reference') {
  //       refProp = prop
  //     } else if (propType === 'references') {
  //       refProp = prop.items
  //       prop.items = refProp
  //     }

  //     if (refProp) {
  //       const type = dbSchema.types[refProp.ref]
  //       const inverseKey = '_' + key
  //       dbSchema.types[refProp.ref] = {
  //         ...type,
  //         props: {
  //           ...type.props,
  //           [inverseKey]: {
  //             items: {
  //               ref: '_root',
  //               prop: key,
  //             },
  //           },
  //         },
  //       }
  //       refProp.prop = inverseKey
  //     }
  //   }

  //   dbSchema.types ??= {}
  //   // @ts-ignore This creates an internal type to use for root props
  //   dbSchema.types._root = {
  //     id: 1,
  //     props: dbSchema.props,
  //   }
  //   delete dbSchema.props
  // }
  dbSchema.types ??= {}
  const edgeTypes = makeEdgeTypes(dbSchema.types)
  // Create inverse props for reference(s)
  for (const et in edgeTypes) {
    dbSchema.types[et] = edgeTypes[et]

    for (const key in edgeTypes[et].props) {
      const prop = edgeTypes[et].props[key]
      const propType = prop.type
      let refProp: any

      if (propType === 'reference') {
        refProp = prop
      } else if (propType === 'references') {
        refProp = prop.items
      } else {
        continue // not a ref
      }

      const type = dbSchema.types[refProp.ref]
      const inverseKey = `_${et}_${key}`
      dbSchema.types[refProp.ref] = {
        ...type,
        // @ts-ignore
        props: {
          ...type.props,
          [inverseKey]: {
            items: {
              ref: et,
              prop: key,
            },
          },
        },
      }
      refProp.prop = inverseKey
    }
  }

  // Assign typeIds
  for (const typeName in dbSchema.types) {
    if (!('id' in dbSchema.types[typeName])) {
      dbSchema.lastId++
      dbSchema.types[typeName].id = dbSchema.lastId
    }
  }

  delete dbSchema.hash
  dbSchema.hash = hash(dbSchema)

  return dbSchema
}
