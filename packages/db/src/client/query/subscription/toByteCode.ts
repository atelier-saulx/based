import { readFloatLE, readInt64, writeUint16, writeUint32 } from '@based/utils'
import native from '../../../native.js'
import { BasedDbQuery } from '../BasedDbQuery.js'
import { ID } from '../toByteCode/offsets.js'
import { FilterMetaNow, QueryDef, QueryDefFilter, QueryType } from '../types.js'
import { SubscriptionType } from './types.js'

export const collectFilters = (
  filter: QueryDefFilter,
  fields: Set<number>,
  nowQueries: FilterMetaNow[] = [],
) => {
  if (filter.hasSubMeta) {
    for (const [prop, conditions] of filter.conditions) {
      fields.add(prop)
      for (const condition of conditions) {
        if (condition.subscriptionMeta) {
          if (condition.subscriptionMeta.now) {
            nowQueries.push(...condition.subscriptionMeta.now)
          }
        }
      }
    }
  } else {
    for (const prop of filter.conditions.keys()) {
      fields.add(prop)
    }
    if (filter.or) {
      collectFilters(filter.or, fields, nowQueries)
    }
    if (filter.and) {
      collectFilters(filter.and, fields, nowQueries)
    }
  }

  if (filter.references) {
    for (const prop of filter.references.keys()) {
      fields.add(prop)
    }
  }

  return nowQueries
}

export const collectFields = (def: QueryDef) => {
  const fields: Set<number> = new Set()
  if (def.include.main.len > 0) {
    fields.add(0)
  }
  for (const prop of def.include.props.values()) {
    fields.add(prop.def.prop)
  }
  if (def.filter.size > 0) {
    collectFilters(def.filter, fields)
  }
  for (const prop of def.references.keys()) {
    fields.add(prop)
  }
  return fields
}

export const collectTypes = (
  def: QueryDef | QueryDefFilter,
  types: Set<number> = new Set(),
) => {
  if ('references' in def) {
    // handle edges
    for (const ref of def.references.values()) {
      types.add(ref.schema.id)
      collectTypes(ref, types)
    }
  }

  if ('filter' in def && 'references' in def.filter) {
    // TODO: also need to check for NOW FIELD
    for (const ref of def.filter.references.values()) {
      types.add(ref.schema.id)
      collectTypes(ref)
    }
  }

  return types
}

export const registerSubscription = (query: BasedDbQuery) => {
  if (query.def.queryType === QueryType.id) {
    const fields = collectFields(query.def)
    const typeId = query.def.schema.id
    const subId = native.crc32(
      query.buffer.subarray(ID.id + 4, query.buffer.byteLength - 4),
    )
    // @ts-ignore
    const id = query.def.target.id
    const headerLen = 14

    const types = collectTypes(query.def)
    const typeLen = types.size

    const buffer = new Uint8Array(headerLen + fields.size + typeLen * 2)
    buffer[0] = SubscriptionType.singleId
    writeUint32(buffer, subId, 1)
    writeUint16(buffer, typeId, 5)
    writeUint32(buffer, id, 7)
    buffer[11] = fields.size
    writeUint16(buffer, typeLen, 12)

    let i = 0
    for (const field of fields) {
      buffer[i + headerLen] = field
      i++
    }

    for (const type of types) {
      writeUint16(buffer, type, i + headerLen)
      i += 2
    }

    query.subscriptionBuffer = buffer
  } else {
    const typeId = query.def.schema.id
    const types = collectTypes(query.def)

    // fields will be different....
    if (query.def.filter.size > 0) {
      // later need fields ofc...
      const nowQueries = collectFilters(query.def.filter, new Set())

      console.log(
        nowQueries,
        query.buffer,
        query.buffer.subarray(25, 25 + 8),
        readInt64(query.buffer.subarray(25, 25 + 8), 0),
      )
    }

    const typeLen = types.has(typeId) ? types.size - 1 : types.size
    const buffer = new Uint8Array(6 + typeLen * 2)
    buffer[0] = SubscriptionType.fullType
    writeUint16(buffer, typeId, 1)
    writeUint16(buffer, typeLen, 3)
    let i = 6
    for (const typeIdIt of types) {
      if (typeIdIt !== typeId) {
        writeUint16(buffer, typeIdIt, i)
        i += 2
      }
    }
    query.subscriptionBuffer = buffer
  }
}
