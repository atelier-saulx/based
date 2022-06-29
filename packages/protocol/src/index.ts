import zlib from 'node:zlib'

import fflate from 'fflate'

export const incomingTypes = {}

export const outGoingTypes = {}

const bigObject = []
for (let i = 0; i < 100000; i++) {
  bigObject.push({ x: i })
}

export async function encodeSubData(
  id: number,
  checksum: number,
  data: Object,
  maxChunkSize?: number
): Promise<Uint8Array> {
  // | TYPE 1 | CHUNKS 2 | SIZE? 4 |
  // SUB-DATA PROTOCOL
  // | TYPE 1 | CHUNKS 2 | SIZE? 4 | ID 8 | CHECKSUM 8 | DATA |
  let buffer = Buffer.from(JSON.stringify(data))
  let encodingType = 0
  let chunks = 1
  if (buffer.length > 100) {
    encodingType = 1
    buffer = zlib.deflateRawSync(buffer, {})
  }
  if (maxChunkSize) {
    console.info('maxChunkSize do later')
    chunks = 1000
  }
  if (chunks === 1) {
    const protocolSize = 19
    const array = new Uint8Array(protocolSize + buffer.length)
    array.set(buffer, protocolSize)
    const requestType = 1 // subscriptionData
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
    return array
  } else {
    console.warn('chunk not implemented yet')
    return new Uint8Array(0)
  }
}

export function decodeSubData(buff: Uint8Array) {
  // | TYPE 1 | CHUNKS 2 | SIZE? 4 |
  // SUB-DATA PROTOCOL
  // | TYPE 1 | CHUNKS 2 | SIZE? 4 | ID 8 | CHECKSUM 8 | DATA |
  const requestType = buff[0] >> 2
  const encodingType = buff[0] & 3
  if (requestType === 1) {
    let chunks = 0
    for (let i = 2; i >= 1; i--) {
      chunks = chunks * 256 + buff[i]
    }
    const basicLength = chunks > 1 ? 23 : 19
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
        const buffer = zlib.inflateRawSync(buff.slice(basicLength))
        data = JSON.parse(buffer.toString())
      } else {
        const buffer = fflate.inflateSync(buff.slice(basicLength))
        data = JSON.parse(new TextDecoder().decode(buffer))
      }
    }
    return [1, id, data, checksum]
  }
}

// for publish
// https://github.com/uNetworking/uWebSockets.js/blob/61fa4bd06cf9db078716dc0c70bc5e8274d742f6/examples/PubSub.js
