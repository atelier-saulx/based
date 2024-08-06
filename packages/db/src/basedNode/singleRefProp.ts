import { BasedDb, FieldDef } from '../index.js'
import { BasedNode } from './index.js'

export function singleRefProp(
  ctx: BasedNode,
  field: string,
  fieldDef: FieldDef,
  schemas: BasedDb['schemaTypesParsed'],
  obj?: any,
) {
  const type = fieldDef.allowedType

  return Object.defineProperty(obj ?? ctx, field, {
    enumerable: true,
    set: () => undefined,
    get() {
      const refSchema = schemas[type]
      const refCtx = refSchema.responseCtx
      refCtx.__q = ctx.__q
      refCtx.__o = ctx.__o
      refCtx.__r =
        ctx.__r?.refIncludes[fieldDef.start] ??
        ctx.__q.query.includeDef.refIncludes[fieldDef.start]

      return refCtx
    },
  })
}
