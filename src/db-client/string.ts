import native from '../native.js'
import { Ctx } from './modify/Ctx.js'
import { resize } from './modify/resize.js'
import { ENCODER, makeTmpBuffer, writeUint32 } from '../utils/uint8.js'
import { COMPRESSED, NOT_COMPRESSED } from '../protocol/index.js'
import { LangCode, LangCodeEnum } from '../zigTsExports.js'

const { getUint8Array: getTmpBuffer } = makeTmpBuffer(4096) // the usual page size?

export const write = (
  ctx: Ctx,
  value: string,
  offset: number,
  lang: LangCodeEnum,
  noCompression: boolean,
): number => {
  const buf = ctx.buf
  value = value.normalize('NFKD')
  buf[offset] = lang
  const { written: l } = ENCODER.encodeInto(value, buf.subarray(offset + 2))
  let crc = native.crc32(buf.subarray(offset + 2, offset + 2 + l))
  if (value.length > 200 && !noCompression) {
    const insertPos = offset + 6 + l
    const startPos = offset + 2
    const endPos = offset + 2 + l
    const willEnd = insertPos + l
    resize(ctx, willEnd)
    buf.copyWithin(insertPos, startPos, endPos)
    const size = native.compress(buf, offset + 6, l)
    if (size === 0) {
      resize(ctx, l + 6)
      buf[offset + 1] = NOT_COMPRESSED
      ENCODER.encodeInto(value, buf.subarray(offset + 2))
      writeUint32(buf, crc, offset + l + 2)
      return l + 6
    } else {
      resize(ctx, size + 10)
      let len = l
      buf[offset + 1] = COMPRESSED
      writeUint32(buf, len, offset + 2)
      writeUint32(buf, crc, offset + size + 6)
      return size + 10
    }
  } else {
    buf[offset + 1] = NOT_COMPRESSED
    writeUint32(buf, crc, offset + 2 + l)
    return l + 6
  }
}

export const stringCompress = (str: string): Uint8Array => {
  const s = str.normalize('NFKD')
  const len = ENCODER.encode(s).byteLength
  const tmpCompressBlock = getTmpBuffer(2 * len + 10)
  const l = write({ buf: tmpCompressBlock } as Ctx, str, 0, LangCode.none, false)
  const nBuffer = new Uint8Array(l)
  nBuffer.set(tmpCompressBlock.subarray(0, l))
  return nBuffer
}
