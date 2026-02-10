import type { SchemaOut } from '../../schema.js'
import type { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import {
  Modify,
  pushModifyCreateHeader,
  writeModifyCreateHeaderProps,
  pushModifyCreateRingHeader,
  writeModifyCreateRingHeaderProps,
  type LangCodeEnum,
} from '../../zigTsExports.js'
import { getTypeDef } from './index.js'
import { serializeProps } from './props.js'
import type { InferPayload } from './types.js'

export const serializeCreate = <
  S extends SchemaOut = SchemaOut,
  T extends keyof S['types'] & string = keyof S['types'] & string,
>(
  schema: S,
  type: T,
  payload: InferPayload<S, T>,
  buf: AutoSizedUint8Array,
  lang: LangCodeEnum,
) => {
  const typeDef = getTypeDef(schema, type)
  const maxNodeId = typeDef.schema.capped ?? 0

  if (maxNodeId ?? 0 > 0) {
    const index = pushModifyCreateRingHeader(buf, {
      op: Modify.createRing,
      type: typeDef.id,
      maxNodeId,
      size: 0,
    })
    const start = buf.length

    serializeProps(typeDef.tree, payload, buf, Modify.create, lang)
    writeModifyCreateRingHeaderProps.size(buf.data, buf.length - start, index)
  } else {
    const index = pushModifyCreateHeader(buf, {
      op: Modify.create,
      type: typeDef.id,
      size: 0,
    })
    const start = buf.length

    serializeProps(typeDef.tree, payload, buf, Modify.create, lang)
    writeModifyCreateHeaderProps.size(buf.data, buf.length - start, index)
  }
}
