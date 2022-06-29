import { decodeSubData } from './decodeSubData'

export function decode(buff: Uint8Array) {
  // | TYPE 1 | CHUNKS 2 | SIZE? 4 |
  const requestType = buff[0] >> 2
  const encodingType = buff[0] & 3
  let chunks = 0
  for (let i = 2; i >= 1; i--) {
    chunks = chunks * 256 + buff[i]
  }
  if (requestType === 1) {
    return decodeSubData(chunks, encodingType, buff)
  }
}
