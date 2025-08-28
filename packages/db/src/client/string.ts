import type { LangCode } from '@based/schema'
import native from '../native.js'
import { makeTmpBuffer, ENCODER, writeUint32 } from '@based/utils'
import { COMPRESSED, NOT_COMPRESSED } from '@based/protocol/db-read'

const { getUint8Array: getTmpBuffer } = makeTmpBuffer(4096) // the usual page size?

export const write = (
  buf: Uint8Array,
  value: string,
  offset: number,
  noCompression: boolean,
  lang?: LangCode,
): number | null => {
  value = value.normalize('NFKD')
  buf[offset] = lang || 0
  const { written: l } = ENCODER.encodeInto(value, buf.subarray(offset + 2))
  let crc = native.crc32(buf.subarray(offset + 2, offset + 2 + l))

  // 50 len maybe if lvl 1
  if (value.length > 200 && !noCompression) {
    const insertPos = offset + 6 + l
    const startPos = offset + 2
    const endPos = offset + 2 + l
    const willEnd = insertPos + l
    if (willEnd > buf.length) {
      return null
    }
    buf.copyWithin(insertPos, startPos, endPos)
    const size = native.compress(buf, offset + 6, l)
    if (size === 0) {
      buf[offset + 1] = NOT_COMPRESSED
      ENCODER.encodeInto(value, buf.subarray(offset + 2))
      writeUint32(buf, crc, offset + l + 2)
      return l + 6
    } else {
      let len = l
      buf[offset + 1] = COMPRESSED
      writeUint32(buf, len, offset + 2)
      writeUint32(buf, crc, offset + size + 6)
      return size + 10
    }
  } else {
    buf[offset + 1] = NOT_COMPRESSED
    writeUint32(buf, crc, offset + l + 2)
    return l + 6
  }
}

export const compress = (str: string): Uint8Array => {
  const len = ENCODER.encode(str).byteLength
  const tmpCompressBlock = getTmpBuffer(len * 3)
  const l = write(tmpCompressBlock, str, 0, false)
  const nBuffer = new Uint8Array(l)
  nBuffer.set(tmpCompressBlock.subarray(0, l))
  return nBuffer
}
