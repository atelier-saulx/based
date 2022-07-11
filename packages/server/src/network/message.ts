import uws from '@based/uws'
import zlib from 'zlib'

const decodeHeader = (
  nr: number
): { type: number; isDeflate: boolean; len: number } => {
  const len = nr >> 4
  const meta = nr & 15
  const type = meta >> 1
  const isDeflate = meta & 1
  return {
    type,
    isDeflate: isDeflate === 1,
    len,
  }
}

const textDecoder = new TextDecoder()

const readUint8 = (buff: Uint8Array, start: number, len: number): number => {
  let n = 0
  const s = len - 1 + start
  for (let i = s; i >= start; i--) {
    n = n * 256 + buff[i]
  }
  return n
}

/*
function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}
*/

const reader = (arr: Uint8Array, start: number): number => {
  const { len, isDeflate, type } = decodeHeader(readUint8(arr, start, 4))
  if (type === 0) {
    const reqId = readUint8(arr, start + 4, 3)
    const namelen = arr[7]
    const name = new Uint8Array(arr.slice(start + 8, start + 8 + namelen))
    const nameParsed = textDecoder.decode(name)

    // TEMP
    const payload = new Uint8Array(
      arr.slice(start + 8 + namelen, start + len + 4)
    )
    let p
    // this will happen in the worker not here...
    if (!isDeflate) {
      p = textDecoder.decode(payload)
    } else {
      const buffer = zlib.inflateRawSync(payload)
      p = textDecoder.decode(buffer)
    }
    console.info(nameParsed, reqId, isDeflate, p)
  }
  return len + 4 + start
}

export const message = (ws: uws.WebSocket, msg, isBinary) => {
  if (!isBinary) {
    ws.close()
    return
  }

  const uint8View = new Uint8Array(msg)
  const len = uint8View.length

  let next = 0
  while (next < len) {
    const n = reader(uint8View, next)
    if (n === undefined) {
      return
    }
    next = n
  }
}
