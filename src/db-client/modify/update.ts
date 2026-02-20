import type { SchemaOut } from '../../schema.js'
import type { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import {
  Modify,
  pushModifyUpdateHeader,
  writeModifyUpdateHeaderProps,
  type LangCodeEnum,
} from '../../zigTsExports.js'
import { assignTarget, BasedModify, execHooks, getTypeDef } from './index.js'
import { serializeProps } from './props.js'

export const serializeUpdate = (
  schema: SchemaOut,
  type: string,
  item: number | BasedModify<any>,
  payload: Record<string, any>,
  buf: AutoSizedUint8Array,
  lang: LangCodeEnum,
) => {
  const typeDef = getTypeDef(schema, type)
  const header = assignTarget(item, {
    op: Modify.update,
    type: typeDef.id,
    size: 0,
  })
  const index = pushModifyUpdateHeader(buf, header)
  const start = buf.length
  serializeProps(
    typeDef.tree,
    execHooks(typeDef, payload, 'update'),
    buf,
    Modify.update,
    lang,
  )
  writeModifyUpdateHeaderProps.size(buf.data, buf.length - start, index)
}
