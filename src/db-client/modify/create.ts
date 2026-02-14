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
import { execHooks, getTypeDef } from './index.js'
import { serializeProps } from './props.js'

export const serializeCreate = (
  schema: SchemaOut,
  type: string,
  payload: Record<string, any>,
  buf: AutoSizedUint8Array,
  lang: LangCodeEnum,
) => {
  const typeDef = getTypeDef(schema, type)
  if (typeDef.schema.capped) {
    const index = pushModifyCreateRingHeader(buf, {
      op: Modify.createRing,
      type: typeDef.id,
      maxNodeId: typeDef.schema.capped,
      size: 0,
    })
    const start = buf.length
    serializeProps(
      typeDef.tree,
      execHooks(typeDef, payload, 'create'),
      buf,
      Modify.create,
      lang,
    )
    writeModifyCreateRingHeaderProps.size(buf.data, buf.length - start, index)
  } else {
    const index = pushModifyCreateHeader(buf, {
      op: Modify.create,
      type: typeDef.id,
      size: 0,
    })
    const start = buf.length
    serializeProps(
      typeDef.tree,
      execHooks(typeDef, payload, 'create'),
      buf,
      Modify.create,
      lang,
    )
    writeModifyCreateHeaderProps.size(buf.data, buf.length - start, index)
  }
}
