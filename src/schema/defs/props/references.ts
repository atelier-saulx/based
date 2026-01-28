import {
  Modify,
  ModifyReferences,
  PropType,
  pushModifyReferenceMetaHeader,
  pushModifyReferencesHeader,
  pushModifyReferencesMetaHeader,
  writeModifyReferenceMetaHeaderProps,
  writeModifyReferencesHeaderProps,
  writeModifyReferencesMetaHeaderProps,
  type LangCodeEnum,
  type ModifyEnum,
  type PropTypeEnum,
} from '../../../zigTsExports.js'
import type { AutoSizedUint8Array } from '../../../utils/AutoSizedUint8Array.js'
import type { SchemaProp } from '../../../schema.js'
import { BasePropDef } from './base.js'
import type { PropDef, TypeDef } from '../index.js'
import { ModifyCmd, serializeProps } from '../../../db-client/modify/index.js'

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
  buf.pushUint32(0)
  for (; i < ids.length; i++) {
    const id = getRealId(ids[i])
    if (!id) break
    buf.pushUint32(id)
  }
  return i
}

const serializeTmpIds = (
  buf: AutoSizedUint8Array,
  items: ModifyCmd[],
  offset: number,
): undefined | any => {
  let i = offset
  // one extra for padding
  buf.pushUint32(0)
  for (; i < items.length; i++) {
    const tmpId = getTmpId(items[i])
    if (tmpId === undefined) break
    buf.pushUint32(tmpId)
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
  const start = buf.reserveUint32()

  for (; i < items.length; i++) {
    const item = items[i]
    if (!isValidRefObj(item)) {
      break
    }
    const realId = getRealId(item.id)
    const id = realId || getTmpId(item.id)
    if (id === undefined) {
      break
    }
    const index = pushModifyReferencesMetaHeader(buf, {
      id: id,
      isTmp: !realId,
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
  buf.writeUint32(i - offset, start)

  return i
}

const getRealId = (item: any) => {
  if (typeof item === 'number') return item
  if (item instanceof ModifyCmd) return item.id
}

const getTmpId = (item: any) => {
  if (item instanceof ModifyCmd) return item.tmpId
}

const isValidRefObj = (item: any) =>
  (typeof item === 'object' && item !== null && getRealId(item.id)) ||
  getTmpId(item.id) !== undefined

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
    if (getRealId(item)) {
      const index = pushModifyReferencesHeader(buf, {
        op: ModifyReferences.ids,
        size: 0,
      })
      const start = buf.length
      offset = serializeIds(buf, value, offset)
      writeModifyReferencesHeaderProps.size(buf.data, buf.length - start, index)
    } else if (getTmpId(item) !== undefined) {
      const index = pushModifyReferencesHeader(buf, {
        op: ModifyReferences.tmpIds,
        size: 0,
      })
      const start = buf.length
      offset = serializeTmpIds(buf, value, offset)
      writeModifyReferencesHeaderProps.size(buf.data, buf.length - start, index)
    } else if (isValidRefObj(item)) {
      const index = pushModifyReferencesHeader(buf, {
        op: ModifyReferences.idsWithMeta,
        size: 0,
      })
      const start = buf.length
      offset = serializeIdsAndMeta(buf, value, op, offset, lang, prop.edges)
      writeModifyReferencesHeaderProps.size(buf.data, buf.length - start, index)
    } else if (item instanceof ModifyCmd) {
      throw item
    } else if (item.id instanceof ModifyCmd) {
      throw item.id
    } else {
      throw 'bad ref!'
    }
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

export const references = class References extends BasePropDef {
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

export const reference = class Reference extends BasePropDef {
  override type: PropTypeEnum = PropType.reference
  override pushValue(
    buf: AutoSizedUint8Array,
    value: any,
    lang: LangCodeEnum,
    op: ModifyEnum,
  ) {
    const id = getRealId(value)
    if (id) {
      pushModifyReferenceMetaHeader(buf, {
        id,
        isTmp: false,
        size: 0,
      })
      return
    }
    const tmpId = getTmpId(value)
    if (tmpId !== undefined) {
      pushModifyReferenceMetaHeader(buf, {
        id: tmpId,
        isTmp: true,
        size: 0,
      })
      return
    }

    if (value instanceof ModifyCmd) {
      throw value
    }

    if (typeof value === 'object' && value !== null) {
      const realId = getRealId(value.id)
      const id = realId || getTmpId(value.id)
      if (id !== undefined) {
        const index = pushModifyReferenceMetaHeader(buf, {
          id,
          isTmp: !realId,
          size: 0,
        })
        const prop: PropDef = this
        if (prop.edges) {
          const edges = getEdges(value)
          if (edges) {
            const start = buf.length
            serializeProps(prop.edges.tree, edges, buf, op, lang)
            writeModifyReferenceMetaHeaderProps.size(
              buf.data,
              buf.length - start,
              index,
            )
          }
        }
        return
      }

      if (value.id instanceof ModifyCmd) {
        throw value.id
      }
    }
  }
}
