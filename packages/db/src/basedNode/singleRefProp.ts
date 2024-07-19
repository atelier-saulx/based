import { BasedDb, FieldDef } from '../index.js'
import { BasedNode } from './index.js'

export function singleRefProp(
  ctx: BasedNode,
  field: string,
  fieldDef: FieldDef,
  schemas: BasedDb['schemaTypesParsed'],
) {
  const type = fieldDef.allowedType
  const refSchema = schemas[type]
  const refCtx = refSchema.responseCtx

  return Object.defineProperty(ctx, field, {
    enumerable: true,
    set: () => undefined,
    get() {
      console.log('GET REF FIELD')
      refCtx.__q = this.__q
      // this.__o + more
      refCtx.__o = this.__o

      // make a id for the field for internal mapping...
      console.log(fieldDef)

      refCtx.__r = {
        mainLen: 0,
        mainFields: {},
        // fields , wnat to put single ref in a better format
      }
      console.log('RETURN THIS')

      return refCtx
    },
  })
}
