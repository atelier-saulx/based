import { writeInt64, writeUint16, writeUint32 } from '@based/utils'
import native from '../../../native.js'
import { BasedDbQuery } from '../BasedDbQuery.js'

// replace with single
// import { ID } from '../toByteCode/offsets.js'

// CHANGE WITH HEADER
const ID_OFFSET = 3

import { FilterMetaNow, QueryDef, QueryDefFilter, QueryType } from '../types.js'
import { SubscriptionType } from './types.js'

type Fields = { separate: Set<number>; main: Set<number> }

export const collectFilters = (
  filter: QueryDefFilter,
  fields?: Fields,
  nowQueries: FilterMetaNow[] = [],
) => {
  if (filter.hasSubMeta) {
    for (const [, conditions] of filter.conditions) {
      for (const condition of conditions) {
        if (condition.subscriptionMeta) {
          if (condition.subscriptionMeta.now) {
            nowQueries.push(...condition.subscriptionMeta.now)
          }
        }
      }
    }
  }

  if (fields) {
    for (const [prop, conditions] of filter.conditions) {
      fields.separate.add(prop)
      if (prop === 0) {
        for (const condition of conditions) {
          fields.main.add(condition.propDef.start)
        }
      }
    }
  }

  if (filter.or) {
    collectFilters(filter.or, fields, nowQueries)
  }
  if (filter.and) {
    collectFilters(filter.and, fields, nowQueries)
  }

  if (filter.references) {
    for (const ref of filter.references.values()) {
      for (const prop of filter.conditions.keys()) {
        fields.separate.add(prop)
      }
      collectFilters(ref.conditions, undefined, nowQueries)
    }
  }
  return nowQueries
}

export const collectFields = (def: QueryDef) => {
  const fields: Fields = {
    separate: new Set(),
    main: new Set(),
  }
  if (def.include.main.len > 0) {
    for (const [, propDef] of def.include.main.include.values()) {
      fields.main.add(propDef.start)
    }
    // Add 0
    fields.separate.add(0)
  }
  for (const prop of def.include.props.values()) {
    fields.separate.add(prop.def.prop)
  }
  for (const prop of def.references.keys()) {
    fields.separate.add(prop)
  }
  return fields
}

export const collectTypes = (
  def: QueryDef | QueryDefFilter,
  types: Set<number> = new Set(),
) => {
  if ('references' in def) {
    for (const ref of def.references.values()) {
      if ('schema' in ref) {
        types.add(ref.schema.id)
        collectTypes(ref, types)
      } else {
        types.add(ref.conditions.schema.id)
        collectTypes(ref.conditions, types)
      }
    }
  }
  if ('filter' in def && 'references' in def.filter) {
    for (const ref of def.filter.references.values()) {
      types.add(ref.conditions.schema.id)
      collectTypes(ref.conditions)
    }
  }
  return types
}

export const registerSubscription = (query: BasedDbQuery) => {
  if (query.def.queryType === QueryType.id) {
    // @ts-ignore
    const id = query.def.target.id
    const fields = collectFields(query.def)
    const typeId = query.def.schema.id
    const subId = native.crc32(
      query.buffer.subarray(ID_OFFSET + 4, query.buffer.byteLength - 4),
    )
    const headerLen = 18
    const types = collectTypes(query.def)
    const nowQueries = collectFilters(query.def.filter, fields)
    const buffer = new Uint8Array(
      headerLen +
        fields.separate.size +
        types.size * 2 +
        nowQueries.length * 16 +
        fields.main.size * 2,
    )
    buffer[0] = SubscriptionType.singleId
    writeUint32(buffer, subId, 1)
    writeUint16(buffer, typeId, 5)
    writeUint32(buffer, id, 7)
    buffer[11] = fields.separate.size
    writeUint16(buffer, fields.main.size, 12)
    writeUint16(buffer, types.size, 14)
    writeUint16(buffer, nowQueries.length, 16)
    let i = headerLen
    for (const field of fields.separate) {
      buffer[i] = field
      i++
    }
    for (const offset of fields.main) {
      writeUint16(buffer, offset, i)
      i += 2
    }
    for (const type of types) {
      writeUint16(buffer, type, i)
      i += 2
    }
    for (const now of nowQueries) {
      buffer[i] = now.prop.prop
      buffer[i + 1] = now.ctx.operation
      writeUint16(buffer, now.ctx.typeId, i + 2)
      writeInt64(buffer, now.offset, i + 4)
      writeUint32(buffer, now.resolvedByteIndex, i + 12)
      i += 16
    }
    query.subscriptionBuffer = buffer
  } else {
    const typeId = query.def.schema.id
    const types = collectTypes(query.def)
    const nowQueries = collectFilters(query.def.filter, {
      separate: new Set(),
      main: new Set(),
    })
    const typeLen = types.has(typeId) ? types.size - 1 : types.size
    const headerLen = 8
    const buffer = new Uint8Array(
      headerLen + typeLen * 2 + nowQueries.length * 16,
    )
    buffer[0] = SubscriptionType.fullType
    writeUint16(buffer, typeId, 1)
    writeUint16(buffer, typeLen, 3)
    writeUint16(buffer, nowQueries.length, 5) // hopefully you dont have more then 255 now filters...
    let i = headerLen
    for (const typeIdIt of types) {
      if (typeIdIt !== typeId) {
        writeUint16(buffer, typeIdIt, i)
        i += 2
      }
    }
    for (const now of nowQueries) {
      buffer[i] = now.prop.prop
      buffer[i + 1] = now.ctx.operation
      writeUint16(buffer, now.ctx.typeId, i + 2)
      writeInt64(buffer, now.offset, i + 4)
      writeUint32(buffer, now.resolvedByteIndex, i + 12)
      i += 16
    }
    query.subscriptionBuffer = buffer
  }
}
