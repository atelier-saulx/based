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
      // TODO: fix speed
      const refSchema = schemas[type]
      const refCtx = refSchema.responseCtx
      refCtx.__q = this.__q
      refCtx.__o = this.__o
      refCtx.__r = this.__q.query.refIncludes[fieldDef.start]
      return refCtx
    },
  })
}
