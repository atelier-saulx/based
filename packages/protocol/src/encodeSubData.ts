import zlib from 'node:zlib'

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
