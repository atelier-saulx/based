import { SubscriptionId, SubscriptionMulti } from './types.js'
import { QueryType } from '../../types.js'
import { readUint32, readUint16 } from '@based/utils'
import { ID, IDS } from '../../toByteCode/offsets.js'

const readUint8 = (buffer: Uint8Array, offset: number): number => {
  return buffer[offset]
}

export const getSubscription = (
  query: Uint8Array,
): SubscriptionId | SubscriptionMulti => {
  const queryType: QueryType = readUint8(query, 0)
  const queryId = readUint32(query, query.byteLength - 4)

  if (queryType === QueryType.id) {
    const id = readUint32(query, ID.id)

    console.log('this is a ID', queryId, id)
  } else {
    console.info('its something else!')
  }

  return {} as any
}
