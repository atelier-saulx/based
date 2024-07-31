import { BasedDb, FieldDef } from '../index.js'
import { BasedNode } from './index.js'
import { readSeperateFieldFromBuffer } from './read.js'

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
      // console.log('get dat ref', this.__q)

      // TODO: fix speed
      const refSchema = schemas[type]
      const refCtx = refSchema.responseCtx

      refCtx.__q = this.__q
      refCtx.__o = this.__o

      // console.info('GET REF', field, 'ctx ref ->', ctx.__r?.fromRef.path)

      refCtx.__r =
        ctx.__r?.refIncludes[fieldDef.start] ??
        this.__q.query.includeDef.refIncludes[fieldDef.start]

      return refCtx
    },
  })
}
