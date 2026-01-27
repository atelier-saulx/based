import {
  Modify,
  ModifyReferences,
  PropType,
  pushModifyReferenceMetaHeader,
  pushModifyReferencesHeader,
  pushModifyReferencesMetaHeader,
  writeModifyReferencesHeaderProps,
  writeModifyReferencesMetaHeaderProps,
  type LangCodeEnum,
  type ModifyEnum,
  type PropTypeEnum,
} from '../../../zigTsExports.js'
import type { AutoSizedUint8Array } from '../AutoSizedUint8Array.js'
import type { SchemaProp } from '../../../schema.js'
import { BasePropDef } from './base.js'
import type { PropDef, TypeDef } from './index.js'
import { serializeProps } from '../index.js'

type Edges = Record<`${string}`, unknown> | undefined

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
  // one extra for padding
  buf.pushU32(0)
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
  // one extra for padding
  buf.pushU32(0)
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
  const start = buf.reserveU32()

  for (; i < items.length; i++) {
    const item = items[i]
    if (item === null || typeof item !== 'object') {
      throw 'error'
    }

    // TODO handle tmp id
    if (typeof item.id !== 'number') {
      break
    }

    const index = pushModifyReferencesMetaHeader(buf, {
      id: item.id,
      isTmp: false,
      withIndex: '$index' in item,
      index: item.$index,
      size: 0,
    })

    if (edgesType) {
      const edges = getEdges(item)
      if (edges) {
        const start = buf.length
        serializeProps(edgesType.tree, edges, buf, op, lang)
        writeModifyReferencesMetaHeaderProps.size(
          buf.data,
          buf.length - start,
          index,
        )
      }
    }
  }

  // store the amount of refs (for prealloc)
  buf.setU32(i - offset, start)

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
        const index = pushModifyReferencesHeader(buf, {
          op: ModifyReferences.idsWithMeta,
          size: 0,
        })
        const start = buf.length
        offset = serializeIdsAndMeta(buf, value, op, offset, lang, prop.edges)
        writeModifyReferencesHeaderProps.size(
          buf.data,
          buf.length - start,
          index,
        )
        continue
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
  override type: PropTypeEnum = PropType.references
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

export const reference = class extends BasePropDef {
  override type: PropTypeEnum = PropType.reference
  override pushValue(buf: AutoSizedUint8Array, value: any, op: ModifyEnum) {
    if (typeof value === 'number') {
      pushModifyReferenceMetaHeader(buf, {
        id: value,
        isTmp: false,
        size: 0,
      })
    } else {
      console.error('TODO reference ALL THE CASES')
    }

    // buf.pushU32(value)
  }
}
