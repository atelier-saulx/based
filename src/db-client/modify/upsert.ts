import { type SchemaOut } from '../../schema.js'
import type { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import {
  Modify,
  pushModifyUpsertHeader,
  type LangCodeEnum,
  writeModifyUpsertHeaderProps,
} from '../../zigTsExports.js'
import { getTypeDef } from './index.js'
import { serializeProps } from './props.js'
import type { InferPayload, InferTarget } from './types.js'

export const serializeUpsert = <
  S extends SchemaOut = SchemaOut,
  T extends keyof S['types'] & string = keyof S['types'] & string,
>(
  schema: S,
  type: T,
  target: InferTarget<S['types']>[T],
  payload: InferPayload<S['types']>[T],
  buf: AutoSizedUint8Array,
  lang: LangCodeEnum,
) => {
  const typeDef = getTypeDef(schema, type)
  const index = pushModifyUpsertHeader(buf, {
    op: Modify.upsert,
    type: typeDef.id,
    size: 0,
  })
  // serialize target
  const startTarget = buf.length
  // TODO validate that its only aliases
  serializeProps(typeDef.tree, target, buf, Modify.create, lang)
  writeModifyUpsertHeaderProps.size(buf.data, buf.length - startTarget, index)
  // serialize payload
  const sizePos = buf.reserveUint32()
  const startPayload = buf.length
  serializeProps(typeDef.tree, payload, buf, Modify.update, lang)
  console.log('start:', buf.length - startPayload)
  buf.writeUint32(buf.length - startPayload, sizePos)
}
