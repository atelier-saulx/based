import { writeUint16, writeUint32 } from '@based/utils'
import native from '../../../native.js'
import { BasedDbQuery } from '../BasedDbQuery.js'
import { ID } from '../toByteCode/offsets.js'
import { QueryDef, QueryType } from '../types.js'
import { REFERENCE } from '@based/schema/prop-types'
import { SubscriptionType } from './types.js'

export const collectFields = (def: QueryDef) => {
  const fields: Set<number> = new Set()
  if (def.include.main.len > 0) {
    fields.add(0)
  }

  console.dir(def.include, { depth: 10 })
  for (const prop of def.include.props.values()) {
    // if (prop.def.typeIndex === REFERENCE )
    fields.add(prop.def.prop)
  }
  if (def.filter.size > 0) {
    for (const prop of def.filter.conditions.keys()) {
      fields.add(prop)
    }
    // handle NOW
    console.log('HANDLE FILTER HANDLE REFS!!')
    console.dir(def.filter, { depth: 10 })
  }
  return fields
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
    const headerLen = 11
    const buffer = new Uint8Array(headerLen + fields.size)
    buffer[0] = SubscriptionType.singleId
    writeUint32(buffer, subId, 1)
    writeUint16(buffer, typeId, 5)
    writeUint32(buffer, id, 7)
    let i = 0
    for (const field of fields) {
      buffer[i + headerLen] = field
      i++
    }
    query.subscriptionBuffer = buffer
  } else {
    const typeId = query.def.schema.id
    const buffer = new Uint8Array(3)
    buffer[0] = SubscriptionType.fullType
    writeUint16(buffer, typeId, 1)

    console.log('YO YO YO', buffer)

    query.subscriptionBuffer = buffer
  }
}
