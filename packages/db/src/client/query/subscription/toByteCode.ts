import { writeUint16, writeUint32 } from '@based/utils'
import native from '../../../native.js'
import { BasedDbQuery } from '../BasedDbQuery.js'
import { ID } from '../toByteCode/offsets.js'
import { QueryDef, QueryType } from '../types.js'

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
    const headerLen = 10
    const buffer = new Uint8Array(headerLen + fields.size)
    writeUint32(buffer, subId, 0)
    writeUint16(buffer, typeId, 4)
    writeUint32(buffer, id, 6)
    for (let i = 0; i < fields.size; i++) {
      buffer[i + headerLen] = fields[i]
    }
    query.subscriptionBuffer = buffer
  }
}
