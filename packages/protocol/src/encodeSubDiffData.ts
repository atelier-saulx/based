import zlib from 'node:zlib'
import { RequestTypes } from '@based/types'

const DIFF_TYPE = RequestTypes.SubscriptionDiff

export function encodeSubDiffData(
  id: number,
  checksum: number,
  fromChecksum: number,
  diff: Buffer,
  maxChunkSize?: number
): Uint8Array {
  // | TYPE 1 | CHUNKS 2 | SIZE? 4 |
  // SUB-DATA PROTOCOL
  // | TYPE 1 | CHUNKS 2 | SIZE? 4 | ID 8 | CHECKSUM 8 | FROMCHECKSUM 8 | DIFF |
  let encodingType = 0
  let chunks = 1
  if (diff.length > 100) {
    encodingType = 1
    diff = zlib.deflateRawSync(diff, {})
  }
  if (maxChunkSize) {
    console.info('maxChunkSize do later')
    chunks = 1000
  }
  if (chunks === 1) {
    const protocolSize = 27
    const array = new Uint8Array(protocolSize + diff.length)
    array.set(diff, protocolSize)
    const requestType = DIFF_TYPE
    array[0] = (requestType << 2) + encodingType
    array[1] = 1
    array[2] = 0
    for (let index = 3; index < 3 + 8; index++) {
      const byte = id & 0xff
      array[index] = byte
      id = (id - byte) / 256
    }
    for (let index = 3 + 8; index < 3 + 8 + 8; index++) {
      const byte = checksum & 0xff
      array[index] = byte
      checksum = (checksum - byte) / 256
    }
    for (let index = 3 + 8 + 8; index < 3 + 8 + 8 + 8; index++) {
      const byte = fromChecksum & 0xff
      array[index] = byte
      fromChecksum = (fromChecksum - byte) / 256
    }
    return array
  } else {
    console.warn('chunk not implemented yet')
    return new Uint8Array(0)
  }
}
