import { type SchemaOut } from '../../schema.js'
import type { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import {
  Modify,
  pushModifyCreateHeader,
  type LangCodeEnum,
  writeModifyCreateHeaderProps,
} from '../../zigTsExports.js'
import { getTypeDef, execHooks } from './index.js'
import { serializeProps } from './props.js'
import type { InferPayload, InferTarget } from './types.js'

export const serializeUpsert = <
  S extends SchemaOut = SchemaOut,
  T extends keyof S['types'] & string = keyof S['types'] & string,
>(
  schema: S,
  type: T,
  target: InferTarget<S, T>,
  payload: InferPayload<S, T>,
  buf: AutoSizedUint8Array,
  lang: LangCodeEnum,
  op: typeof Modify.insert | typeof Modify.upsert,
) => {
  const typeDef = getTypeDef(schema, type)
  const index = pushModifyCreateHeader(buf, {
    op,
    type: typeDef.id,
    size: 0,
  })
  // serialize target
  const startTarget = buf.length
  // TODO validate that its only aliases
  serializeProps(typeDef.tree, target, buf, Modify.create, lang)
  writeModifyCreateHeaderProps.size(buf.data, buf.length - startTarget, index)
  // serialize payload
  const sizePos = buf.reserveUint32()
  const startPayload = buf.length
  serializeProps(
    typeDef.tree,
    serializeProps(
      typeDef.tree,
      execHooks(typeDef, payload, 'create'),
      buf,
      Modify.create,
      lang,
    ),
    buf,
    Modify.update,
    lang,
  )
  buf.writeUint32(buf.length - startPayload, sizePos)
}
