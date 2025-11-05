import { writeUint16, writeUint32 } from '@based/utils'
import native from '../../../native.js'
import { BasedDbQuery } from '../BasedDbQuery.js'
import { ID } from '../toByteCode/offsets.js'
import { QueryDef, QueryType } from '../types.js'
import { SubscriptionType } from './types.js'
import { writeU16 } from '../../modify/uint.js'

export const collectFields = (def: QueryDef) => {
  const fields: Set<number> = new Set()
  if (def.include.main.len > 0) {
    fields.add(0)
  }
  for (const prop of def.include.props.values()) {
    fields.add(prop.def.prop)
  }
  if (def.filter.size > 0) {
    for (const prop of def.filter.conditions.keys()) {
      fields.add(prop)
    }
    console.log('HANDLE FILTER HANDLE REFS!! & HANDLE NOW REFS!')
    console.dir(def.filter, { depth: 10 })
  }
  for (const prop of def.references.keys()) {
    // if (prop.def.typeIndex === REFERENCE )
    console.log('INCLUDE REF FIELD', prop)
    fields.add(prop)
  }
  return fields
}

// add handle single id here

// add handle multi id here (for refs)

// for each refs collect types for now (just go trough whole tree and give all schema types)
// there get added in an array

export const collectTypes = (def: QueryDef, types: Set<number> = new Set()) => {
  // handle edges
  for (const ref of def.references.values()) {
    types.add(ref.schema.id)
    collectTypes(ref, types)
  }

  // for const in edges

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

    console.log('collected types', types)

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
    const typeLen = types.has(typeId) ? types.size - 1 : types.size
    if (typeLen) {
      console.log('MULTI: collected types', typeLen, types)
    }

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
