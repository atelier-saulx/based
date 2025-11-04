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

  console.info(queryType)

  return {} as any
}
