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
      // this.__o + more
      refCtx.__o = this.__o

      refCtx.__r = {
        mainLen: this.__q.query.refIncludes[0].mainLen,
        mainFields: this.__q.query.refIncludes[0].mainIncludes,
        field: fieldDef,
        // fields , wnat to put single ref in a better format
      }

      return refCtx
    },
  })
}
