import type { SchemaOut } from '../../schema.js'
import type { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import {
  Modify,
  pushModifyUpdateHeader,
  writeModifyUpdateHeaderProps,
  type LangCodeEnum,
} from '../../zigTsExports.js'
import { assignTarget, BasedModify, getTypeDef } from './index.js'
import { serializeProps } from './props.js'
import type { InferPayload } from './types.js'

export const serializeUpdate = <
  S extends SchemaOut = SchemaOut,
  T extends keyof S['types'] & string = keyof S['types'] & string,
>(
  schema: S,
  type: T,
  item: number | BasedModify<any>,
  payload: InferPayload<S, T>,
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
  serializeProps(typeDef.tree, payload, buf, Modify.update, lang)
  writeModifyUpdateHeaderProps.size(buf.data, buf.length - start, index)
}
