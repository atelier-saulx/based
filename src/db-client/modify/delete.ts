import type { SchemaOut } from '../../schema.js'
import type { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import { Modify, pushModifyDeleteHeader } from '../../zigTsExports.js'
import { assignTarget, BasedModify, getTypeDef } from './index.js'

export const serializeDelete = <
  S extends SchemaOut = SchemaOut,
  T extends keyof S['types'] & string = keyof S['types'] & string,
>(
  schema: S,
  type: T,
  item: number | BasedModify<any>,
  buf: AutoSizedUint8Array,
) => {
  const typeDef = getTypeDef(schema, type)
  const header = assignTarget(item, {
    op: Modify.delete,
    type: typeDef.id,
  })
  pushModifyDeleteHeader(buf, header)
}
