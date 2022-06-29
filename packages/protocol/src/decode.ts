import { decodeSubData } from './decodeSubData'
import { RequestTypes, ResponseData } from '@based/types'
import { decodeSubDiffData } from './decodeSubDiffData'

const DIFF_TYPE = RequestTypes.SubscriptionDiff
const SUB_DATA_TYPE = RequestTypes.Subscription

export function decode(buff: Uint8Array): ResponseData {
  // | TYPE 1 | CHUNKS 2 | SIZE? 4 |
  const requestType = buff[0] >> 2
  const encodingType = buff[0] & 3
  let chunks = 0
  for (let i = 2; i >= 1; i--) {
    chunks = chunks * 256 + buff[i]
  }
  if (requestType === SUB_DATA_TYPE) {
    return decodeSubData(chunks, encodingType, buff)
  }

  if (requestType === DIFF_TYPE) {
    return decodeSubDiffData(chunks, encodingType, buff)
  }
}
