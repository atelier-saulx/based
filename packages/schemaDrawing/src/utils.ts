import { SchemaType, SchemaProp, Schema } from '@based/schema'
import { Ctx } from './ctx.js'
import { FilterOps } from './types.js'

export const walkProps = (
  type: SchemaType,
  collect: { [key: string]: SchemaProp },
  path = [],
) => {
  const target = type.props
  for (const key in target) {
    const schemaProp = target[key]
    const propPath = [...path, key]
    const propType = schemaProp.type
    if (propType === 'object' || 'props' in schemaProp) {
      walkProps(schemaProp, collect, propPath)
    } else {
      if (propType || schemaProp.items || schemaProp.enum || schemaProp.ref) {
        collect[propPath.join('.')] = schemaProp
      }
    }
  }
}

export const filterSchema = (ctx: Ctx, ops: FilterOps) => {}
