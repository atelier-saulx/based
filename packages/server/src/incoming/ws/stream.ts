import { BinaryMessageHandler } from './types.js'
import {
  decodePayload,
  decodeName,
  readUint8,
  parsePayload,
} from '../../protocol.js'

export const registerStream: BinaryMessageHandler = (
  arr,
  start,
  len,
  isDeflate,
  ctx,
  server
) => {
  // | 4 header | 1 subType = 1 | 3 reqId | 4 content-size | 1 nameLen | 1 mimeLen | name | mime | payload
  if (!ctx.session) {
    return false
  }

  const infoLen = 14

  const reqId = readUint8(arr, start + 5, 3)

  if (reqId === undefined) {
    return false
  }

  const contentSize = readUint8(arr, start + 8, 4)

  if (!contentSize) {
    return false
  }

  const nameLen = readUint8(arr, start + 12, 1)
  const mimeLen = readUint8(arr, start + 13, 1)

  const name = decodeName(arr, start + 14, start + 14 + nameLen)
  const mime = decodeName(
    arr,
    start + infoLen + nameLen,
    start + infoLen + nameLen + mimeLen
  )

  const payload =
    len === nameLen + infoLen + mimeLen
      ? undefined
      : parsePayload(
          decodePayload(
            new Uint8Array(
              arr.slice(start + infoLen + nameLen + mimeLen, start + len)
            ),
            isDeflate
          )
        )

  // active streams on session

  console.log('HELLO REGISTER STREAM', {
    isDeflate,
    contentSize,
    reqId,
    name,
    mime,
    len,
    payload,
  })

  return true
}
