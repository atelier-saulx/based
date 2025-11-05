import { SubscriptionId, SubscriptionMulti } from './types.js'
import { QueryType } from '../../types.js'
import { readUint32 } from '@based/utils'
import { ID } from '../../toByteCode/offsets.js'

// recursive

export const getSubscription = (
  query: Uint8Array,
): SubscriptionId | SubscriptionMulti => {
  const queryType: QueryType = query[0]
  const queryId = readUint32(query, query.byteLength - 4)

  if (queryType === QueryType.id) {
    const id = readUint32(query, ID.id)
    console.log('this is a ID', queryId, id)
    // functions can be the same
    //  get references, get fields, get filters
  } else {
    console.info('its something else!', queryType)
  }

  return {} as any
}
