import { BasedDb, FieldDef } from '../index.js'
import { BasedNode } from './index.js'

export function singleRefProp(
  ctx: BasedNode,
  field: string,
  fieldDef: FieldDef,
  schemas: BasedDb['schemaTypesParsed'],
) {
  const type = fieldDef.allowedType

  return Object.defineProperty(ctx, field, {
    enumerable: true,
    set: () => undefined,
    get() {
      const refSchema = schemas[type]
      const refCtx = refSchema.responseCtx
      refCtx.__q = this.__q
      refCtx.__o = this.__o
      refCtx.__r =
        ctx.__r?.refIncludes[fieldDef.start] ??
        this.__q.query.includeDef.refIncludes[fieldDef.start]
      return refCtx
    },
  })
}
