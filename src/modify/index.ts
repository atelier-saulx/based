import { SchemaOut } from '../schema.js'
import {
  Modify,
  pushModifyCreateHeader,
  pushModifyDeleteHeader,
  pushModifyMainHeader,
  pushModifyPropHeader,
  pushModifyUpdateHeader,
  writeModifyCreateHeaderProps,
  writeModifyPropHeaderProps,
  writeModifyUpdateHeaderProps,
  type LangCodeEnum,
  type ModifyEnum,
} from '../zigTsExports.js'
import { AutoSizedUint8Array } from './AutoSizedUint8Array.js'
import type { PropDef, PropTree, TypeDef } from './defs/index.js'
import { InferPayload } from './types.js'
import { getTypeDefs } from './defs/getTypeDefs.js'
export { getTypeDefs }

export const serializeProps = (
  tree: PropTree,
  data: any,
  buf: AutoSizedUint8Array,
  op: ModifyEnum,
  lang: LangCodeEnum,
) => {
  for (const key in data) {
    const def = tree.get(key)
    if (def === undefined) {
      continue
    }
    const val = data[key]
    if (def.constructor === Map) {
      if (val !== null && typeof val === 'object') {
        serializeProps(def, val, buf, op, lang)
      }
    } else {
      const prop = def as PropDef
      if (prop.size) {
        pushModifyMainHeader(buf, prop)
        prop.pushValue(buf, val, op, lang)
      } else {
        const index = pushModifyPropHeader(buf, prop)
        const start = buf.length
        prop.pushValue(buf, val, op, lang)
        writeModifyPropHeaderProps.size(buf.data, buf.length - start, index)
      }
    }
  }
}

const getTypeDef = (schema: SchemaOut, type: string) => {
  const typeDef = getTypeDefs(schema).get(type)
  if (!typeDef) {
    throw new Error(`Type ${type} not found`)
  }
  return typeDef
}

export const serializeCreate = <
  S extends SchemaOut = SchemaOut,
  T extends keyof S['types'] & string = keyof S['types'] & string,
>(
  schema: S,
  type: T,
  payload: InferPayload<S['types']>[T],
  buf: AutoSizedUint8Array,
  lang: LangCodeEnum,
) => {
  const typeDef = getTypeDef(schema, type)
  const index = pushModifyCreateHeader(buf, {
    op: Modify.create,
    type: typeDef.id,
    size: 0,
  })
  const start = buf.length
  serializeProps(typeDef.tree, payload, buf, Modify.create, lang)
  writeModifyCreateHeaderProps.size(buf.data, buf.length - start, index)
}

export const serializeUpdate = <
  S extends SchemaOut = SchemaOut,
  T extends keyof S['types'] & string = keyof S['types'] & string,
>(
  schema: S,
  type: T,
  id: number,
  payload: InferPayload<S['types']>[T],
  buf: AutoSizedUint8Array,
  lang: LangCodeEnum,
) => {
  const typeDef = getTypeDef(schema, type)
  const index = pushModifyUpdateHeader(buf, {
    op: Modify.update,
    type: typeDef.id,
    id,
    size: 0,
  })
  const start = buf.length
  serializeProps(typeDef.tree, payload, buf, Modify.update, lang)
  writeModifyUpdateHeaderProps.size(buf.data, buf.length - start, index)
}

export const serializeDelete = <
  S extends SchemaOut = SchemaOut,
  T extends keyof S['types'] & string = keyof S['types'] & string,
>(
  schema: S,
  type: T,
  id: number,
  buf: AutoSizedUint8Array,
) => {
  const typeDef = getTypeDef(schema, type)
  pushModifyDeleteHeader(buf, {
    op: Modify.delete,
    type: typeDef.id,
    id,
  })
}
