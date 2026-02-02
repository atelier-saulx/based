import {
  Modify,
  ModifyReferences,
  PropType,
  PropTypeSelva,
  pushModifyReferenceMetaHeader,
  pushModifyReferencesHeader,
  pushModifyReferencesMetaHeader,
  pushSelvaSchemaRef,
  writeModifyReferenceMetaHeaderProps,
  writeModifyReferencesHeaderProps,
  writeModifyReferencesMetaHeaderProps,
  type LangCodeEnum,
  type ModifyEnum,
  type PropTypeEnum,
} from '../../../zigTsExports.js'
import { AutoSizedUint8Array } from '../../../utils/AutoSizedUint8Array.js'
import type {
  SchemaProp,
  SchemaReference,
  SchemaReferences,
} from '../../../schema.js'
import { BasePropDef } from './base.js'
import type { PropDef, TypeDef } from '../index.js'
import {
  BasedModify,
  getRealId,
  getTmpId,
  serializeProps,
} from '../../../db-client/modify/index.js'

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
  items: BasedModify[],
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

const isValidRefObj = (item: any) => {
  if (typeof item === 'object' && item !== null) {
    return getRealId(item.id) || getTmpId(item.id) !== undefined
  }
}

const setReferences = (
  buf: AutoSizedUint8Array,
  value: any[],
  prop: BasePropDef & { edges?: TypeDef },
  op: ModifyEnum,
  lang: LangCodeEnum,
) => {
  let offset = 0
  const len = value.length
  while (offset < len) {
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
    } else if (item instanceof BasedModify) {
      throw item
    } else if (typeof item === 'object' && item?.id instanceof BasedModify) {
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
    if (getRealId(item)) {
      const index = pushModifyReferencesHeader(buf, {
        op: ModifyReferences.delIds,
        size: 0,
      })
      const start = buf.length
      offset = serializeIds(buf, value, offset)
      writeModifyReferencesHeaderProps.size(buf.data, buf.length - start, index)
    } else if (getTmpId(item) !== undefined) {
      const index = pushModifyReferencesHeader(buf, {
        op: ModifyReferences.delTmpIds,
        size: 0,
      })
      const start = buf.length
      offset = serializeTmpIds(buf, value, offset)
      writeModifyReferencesHeaderProps.size(buf.data, buf.length - start, index)
    } else if (item instanceof BasedModify) {
      throw item
    } else {
      throw 'bad ref'
    }
  }
}

export const references = class References extends BasePropDef {
  override type: PropTypeEnum = PropType.references
  declare schema: SchemaReferences<true>
  declare ref: TypeDef
  declare refProp: PropDef
  declare edges?: TypeDef
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
    op: ModifyEnum,
    lang: LangCodeEnum,
  ): asserts value is any {
    if (typeof value !== 'object' || value === null) {
      throw new Error('References value must be an object and not null')
    }

    const val = value as {
      add?: any[]
      update?: any[]
      delete?: any[]
    }

    if (Array.isArray(value)) {
      if (op === Modify.update) {
        buf.push(ModifyReferences.clear)
      }
      setReferences(buf, value, this, op, lang)
    }
    if (val.add) {
      setReferences(buf, val.add, this, op, lang)
    }
    if (val.update) {
      setReferences(buf, val.update, this, op, lang)
    }
    if (val.delete) {
      deleteReferences(buf, val.delete)
    }
  }
  override pushSelvaSchema(buf: AutoSizedUint8Array) {
    pushSelvaSchemaRef(buf, {
      type: PropTypeSelva.references,
      flags: makeEdgeConstraintFlags(this.schema.items),
      dstNodeType: this.ref.id,
      inverseField: this.refProp.id,
      edgeNodeType: this.edges?.id ?? 0,
      capped: this.schema.capped ?? 0,
    })
  }
}

export const reference = class Reference extends BasePropDef {
  override type: PropTypeEnum = PropType.reference
  declare schema: SchemaReference<true>
  declare ref: TypeDef
  declare refProp: PropDef
  declare edges?: TypeDef
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
    op: ModifyEnum,
    lang: LangCodeEnum,
  ): asserts value is any {
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

    if (value instanceof BasedModify) {
      throw value
    }

    if (typeof value === 'object' && value !== null) {
      const val = value as { id: any }
      const realId = getRealId(val.id)
      const id = realId || getTmpId(val.id)
      if (id !== undefined) {
        const index = pushModifyReferenceMetaHeader(buf, {
          id,
          isTmp: !realId,
          size: 0,
        })
        const prop = this
        if (prop.edges) {
          const edges = getEdges(val)
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

      if (val.id instanceof BasedModify) {
        throw val.id
      }
    }
  }
  override pushSelvaSchema(buf: AutoSizedUint8Array) {
    pushSelvaSchemaRef(buf, {
      type: PropTypeSelva.reference,
      flags: makeEdgeConstraintFlags(this.schema),
      dstNodeType: this.ref.id,
      inverseField: this.refProp.id,
      edgeNodeType: this.edges?.id ?? 0,
      capped: 0,
    })
  }
}

function makeEdgeConstraintFlags(schema: SchemaReference): number {
  let flags = 0
  flags |= schema.dependent ? 0x01 : 0x00
  return flags
}
