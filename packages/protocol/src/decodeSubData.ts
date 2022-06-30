import fflate from 'fflate'
import { RequestTypes, SubscriptionData } from '@based/types'

let zlib

const SUB_DATA_TYPE = RequestTypes.Subscription

export function decodeSubData(
  chunks: number,
  encodingType: number,
  buff: Uint8Array
): SubscriptionData {
  // | TYPE 1 | CHUNKS 2 | SIZE? 4 |
  // SUB-DATA PROTOCOL
  // | TYPE 1 | CHUNKS 2 | SIZE? 4 | ID 8 | CHECKSUM 8 | DATA |
  const basicLength = 19
  let id = 0
  for (let i = basicLength - 9; i >= basicLength - 16; i--) {
    id = id * 256 + buff[i]
  }
  let checksum = 0
  for (let i = basicLength - 1; i >= basicLength - 8; i--) {
    checksum = checksum * 256 + buff[i]
  }
  let data: any
  if (encodingType === 0) {
    data = JSON.parse(new TextDecoder().decode(buff.slice(basicLength)))
  } else {
    if (typeof window === 'undefined') {
      if (!zlib) {
        try {
          zlib = require('node:zlib')
        } catch (err) {}
      }
      const buffer = zlib.inflateRawSync(buff.slice(basicLength))
      data = JSON.parse(buffer.toString())
    } else {
      const buffer = fflate.inflateSync(buff.slice(basicLength))
      data = JSON.parse(new TextDecoder().decode(buffer))
    }
  }
  return [SUB_DATA_TYPE, id, data, checksum]
}
