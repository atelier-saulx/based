import {
  Modify,
  ModifyReferences,
  PropType,
  pushModifyReferencesHeader,
  writeModifyReferencesHeaderProps,
  type LangCodeEnum,
  type ModifyEnum,
} from '../../zigTsExports.js'
import type { AutoSizedUint8Array } from '../AutoSizedUint8Array.js'
import type { SchemaProp } from '../../schema.js'
import { BasePropDef } from './base.js'
import type { PropDef, TypeDef } from './index.js'
import { serializeProps } from '../index.js'

type Edges = Record<`${string}`, unknown> | undefined

const hasEdgesAndOrIndex = (obj: Record<string, any>): boolean | void => {
  for (const i in obj) {
    if (i[0] === '$') return true
  }
}

const getEdges = (obj: Record<string, any>): Edges => {
  let edges: Edges
  for (const i in obj) {
    if (i[0] === '$' && i !== '$index') {
      edges ??= {}
      edges[i] = obj[i]
    }
  }
  return edges
}

const serializeIds = (
  buf: AutoSizedUint8Array,
  ids: number[],
  offset: number,
): number => {
  let i = offset
  for (; i < ids.length; i++) {
    const id = ids[i]
    if (typeof id !== 'number') {
      break
    }
    buf.pushU32(id)
  }
  return i
}

const serializeTmpIds = (
  buf: AutoSizedUint8Array,
  items: { tmpId: number }[],
  offset: number,
): undefined | any => {
  let i = offset
  for (; i < items.length; i++) {
    const item = items[i]
    if (typeof item !== 'object' || item === null || !item.tmpId) {
      // TODO handle async await for tmp in other batch
      break
    }
    buf.pushU32(item.tmpId)
  }

  return i
}

const serializeIdsAndMeta = (
  buf: AutoSizedUint8Array,
  items: any[],
  op: ModifyEnum,
  offset: number,
  lang: LangCodeEnum,
  edgesType?: TypeDef,
): number => {
  let i = offset
  for (; i < items.length; i++) {
    const item = items[i]
    if (item === null || typeof item !== 'object') {
      throw 'error'
    }
    const edges = getEdges(item)
    if (typeof item.id !== 'number' || !edges) {
      break
    }
    buf.pushU32(item.id)
    if (edgesType) {
      serializeProps(edgesType.tree, edges, buf, op, lang)
    }
  }
  return i
}

const setReferences = (
  buf: AutoSizedUint8Array,
  value: any[],
  prop: PropDef,
  op: ModifyEnum,
  lang: LangCodeEnum,
) => {
  let offset = 0
  while (offset < value.length) {
    const item = value[offset]

    if (typeof item === 'number') {
      const index = pushModifyReferencesHeader(buf, {
        op: ModifyReferences.ids,
        size: 0,
      })
      const start = buf.length
      offset = serializeIds(buf, value, offset)
      writeModifyReferencesHeaderProps.size(buf.data, buf.length - start, index)
      continue
    }
    if (typeof item === 'object' && item !== null) {
      if (item.tmpId) {
        const index = pushModifyReferencesHeader(buf, {
          op: ModifyReferences.tmpIds,
          size: 0,
        })
        const start = buf.length
        offset = serializeTmpIds(buf, value, offset)
        writeModifyReferencesHeaderProps.size(
          buf.data,
          buf.length - start,
          index,
        )
        continue
      }
      if (typeof item.id === 'number') {
        // TODO can optimize, don't need whole object
        if (hasEdgesAndOrIndex(item)) {
          offset = serializeIdsAndMeta(buf, value, op, offset, lang, prop.edges)
        } else {
          // TODO with index
        }
      }
    }

    throw 'bad ref'
  }
}

const deleteReferences = (buf: AutoSizedUint8Array, value: any[]) => {
  let offset = 0
  while (offset < value.length) {
    const item = value[offset]
    if (typeof item === 'number') {
      const index = pushModifyReferencesHeader(buf, {
        op: ModifyReferences.delIds,
        size: 0,
      })
      const start = buf.length
      offset = serializeIds(buf, value, offset)
      writeModifyReferencesHeaderProps.size(buf.data, buf.length - start, index)
      continue
    }
    if (typeof item === 'object' && item !== null && item.tmpId) {
      const index = pushModifyReferencesHeader(buf, {
        op: ModifyReferences.tmpIds,
        size: 0,
      })
      const start = buf.length
      offset = serializeTmpIds(buf, value, offset)
      writeModifyReferencesHeaderProps.size(buf.data, buf.length - start, index)
      continue
    }
    throw 'bad ref'
  }
}

export const references = class extends BasePropDef {
  override type = PropType.references
  override pushValue(
    buf: AutoSizedUint8Array,
    value: any,
    op: ModifyEnum,
    lang: LangCodeEnum,
  ) {
    if (typeof value !== 'object' || value === null) {
      throw new Error('References value must be an object and not null')
    }
    if (Array.isArray(value)) {
      if (op === Modify.update) {
        buf.push(ModifyReferences.clear)
      }
      setReferences(buf, value, this, op, lang)
    }
    if (value.add) {
      setReferences(buf, value.add, this, op, lang)
    }
    if (value.update) {
      setReferences(buf, value.update, this, op, lang)
    }
    if (value.delete) {
      deleteReferences(buf, value)
    }
  }
}

export const reference = class extends references {
  override type = PropType.references
  override pushValue(buf: AutoSizedUint8Array, value: any, op: ModifyEnum) {
    console.error('TODO reference')
  }
}
