import { PropDef } from '../schema/schema.js'
import { BasedDb } from '../index.js'
import { BasedNode } from './index.js'

export function singleRefProp(
  ctx: BasedNode,
  field: string,
  fieldDef: PropDef,
  schemas: BasedDb['schemaTypesParsed'],
  obj?: any,
) {
  const type = fieldDef.inverseTypeName

  return Object.defineProperty(obj ?? ctx, field, {
    enumerable: true,
    set: () => undefined,
    get() {
      const refSchema = schemas[type]
      const refCtx = refSchema.responseCtx
      refCtx.__q = ctx.__q
      refCtx.__o = ctx.__o
      refCtx.__r =
        ctx.__r?.refIncludes[fieldDef.prop] ??
        ctx.__q.includeDef.refIncludes[fieldDef.prop]
      return refCtx
    },
  })
}
