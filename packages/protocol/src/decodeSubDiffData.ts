import fflate from 'fflate'
import { RequestTypes } from '@based/types'

let zlib

const DIFF_TYPE = RequestTypes.SubscriptionDiff

export function decodeSubDiffData(
  chunks: number,
  encodingType: number,
  buff: Uint8Array
) {
  // | TYPE 1 | CHUNKS 2 | SIZE? 4 |
  // SUB-DATA PROTOCOL
  // | TYPE 1 | CHUNKS 2 | SIZE? 4 | ID 8 | CHECKSUM 8 | FROMCHECKSUM 8 | DIFF |
  const basicLength = 27
  let id = 0
  for (let i = basicLength - (9 + 8); i >= basicLength - (16 + 8); i--) {
    id = id * 256 + buff[i]
  }

  let checksum = 0
  for (let i = basicLength - 9; i >= basicLength - 16; i--) {
    checksum = checksum * 256 + buff[i]
  }

  let fromChecksum = 0
  for (let i = basicLength - 1; i >= basicLength - 8; i--) {
    fromChecksum = fromChecksum * 256 + buff[i]
  }

  let data: any
  if (encodingType === 0) {
    const txt = new TextDecoder().decode(buff.slice(basicLength))
    data = JSON.parse(txt)
  } else {
    if (typeof window === 'undefined') {
      if (!zlib) {
        zlib = require('node:zlib')
      }
      const buffer = zlib.inflateRawSync(buff.slice(basicLength))
      data = JSON.parse(buffer.toString())
    } else {
      const buffer = fflate.inflateSync(buff.slice(basicLength))
      data = JSON.parse(new TextDecoder().decode(buffer))
    }
  }
  return [DIFF_TYPE, id, data, [fromChecksum, checksum]]
}
