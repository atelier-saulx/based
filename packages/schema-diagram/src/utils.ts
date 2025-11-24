import {
  SchemaType,
  SchemaProp,
  type SchemaObject,
  type SchemaOut,
} from '@based/schema'
import { SchemaDiagram } from './SchemaDiagram.js'
import { FilterOps } from './types.js'
import { getByPath, setByPath } from '@based/utils'

export const walkProps = (
  type: SchemaType<true> | SchemaObject<true>,
  collect: { [key: string]: SchemaProp },
  path = [],
) => {
  const target = type.props
  for (const key in target) {
    const schemaProp = target[key]
    const propPath = [...path, key]
    const propType = schemaProp.type
    if (propType === 'object') {
      walkProps(schemaProp, collect, propPath)
    } else {
      // @ts-ignore
      if (propType || schemaProp.items || schemaProp.enum || schemaProp.ref) {
        collect[propPath.join('.')] = schemaProp
      }
    }
  }
}

export const filterSchema = (ctx: SchemaDiagram, ops: FilterOps) => {
  const originalSchema = ctx.origSchema
  const { filter } = ops
  if (filter === '') {
    ctx.schema = originalSchema
    ctx.filterInternal = undefined
  }
  const filteredSchema: SchemaOut = { hash: 0, types: {} }
  const walk = (
    type: SchemaType<true> | SchemaObject<true>,
    path: string[],
    all?: boolean,
  ) => {
    const target = type.props
    path = [...path, 'props']

    for (const key in target) {
      const schemaProp = target[key]
      const propPath = [...path, key]
      const propType = schemaProp.type

      if (all || key.toLowerCase().includes(filter)) {
        if (propType === 'object') {
          walk(schemaProp, propPath, all)
        } else {
          if (
            schemaProp.type === 'reference' ||
            schemaProp.type === 'references'
          ) {
            // @ts-ignore
            const prop = schemaProp.items?.prop || schemaProp.prop
            // @ts-ignore
            const ref = schemaProp.items?.ref || schemaProp.ref

            if (prop) {
              const propPath = prop.split('.').join('.props.').split('.')
              const p = ['types', ref, 'props', ...propPath]
              console.log(p, propPath)

              setByPath(filteredSchema, p, getByPath(originalSchema, p))
            } else {
              if (!getByPath(filteredSchema, ['types', ref])) {
                setByPath(filteredSchema, ['types', ref], { props: {} })
              }
            }
          }
        }
        setByPath(filteredSchema, propPath, schemaProp)
      } else {
        if (propType === 'object') {
          walk(schemaProp, propPath, all)
        }
      }
    }
  }
  for (const t in originalSchema.types) {
    const type = originalSchema.types[t]
    if (t.toLowerCase().includes(filter)) {
      walk(type, ['types', t], true)
    } else {
      walk(type, ['types', t])
    }
  }

  ctx.schema = filteredSchema
  ctx.filterInternal = ops
}
