import native from '../native.js'
import { Ctx } from './modify/Ctx.js'
import { resize } from './modify/resize.js'
import { ENCODER, makeTmpBuffer, writeUint32 } from '../utils/uint8.js'
import { COMPRESSED, NOT_COMPRESSED } from '../protocol/index.js'
import { LangCode, LangCodeEnum } from '../zigTsExports.js'

const { getUint8Array: getTmpBuffer } = makeTmpBuffer(4096) // the usual page size?

// export const write = (
//   ctx: Ctx,
//   value: string,
//   offset: number,
//   noCompression: boolean,
//   lang?: LangCodeEnum,
// ): number | null => {
//   const buf = ctx.buf
//   value = value.normalize('NFKD')
//   buf[offset] = lang || 0
//   const { written: l } = ENCODER.encodeInto(value, buf.subarray(offset + 2))
//   let crc = native.crc32(buf.subarray(offset + 2, offset + 2 + l))
//   // 50 len maybe if lvl 1
//   if (value.length > 200 && !noCompression) {
//     const insertPos = offset + 6 + l
//     const startPos = offset + 2
//     const endPos = offset + 2 + l
//     const willEnd = insertPos + l
//     resize(ctx, willEnd)
//     buf.copyWithin(insertPos, startPos, endPos)
//     const size = native.compress(buf, offset + 6, l)
//     if (size === 0) {
//       resize(ctx, l + 6)
//       buf[offset + 1] = NOT_COMPRESSED
//       ENCODER.encodeInto(value, buf.subarray(offset + 2))
//       writeUint32(buf, crc, offset + l + 2)
//       return l + 6
//     } else {
//       resize(ctx, size + 10)
//       let len = l
//       buf[offset + 1] = COMPRESSED
//       writeUint32(buf, len, offset + 2)
//       writeUint32(buf, crc, offset + size + 6)
//       return size + 10
//     }
//   } else {
//     buf[offset + 1] = NOT_COMPRESSED
//     writeUint32(buf, crc, offset + 2 + l)
//     return l + 6
//   }
// }

// TODO olli - this is broken does not compress big strings
// does not resize the mod context so keep mod version as well
// also a lot slower then the function above (scince it resizes the mod buffer if it does not fit)
export function writeRaw(
  dst: Uint8Array,
  s: Uint8Array | string,
  offset: number,
  lang: LangCodeEnum,
  noCompression: boolean,
): number {
  if (s instanceof Uint8Array) {
    dst.set(s, offset)
    return dst.byteLength
  } else if (noCompression) {
    const value = s.normalize('NFKD')
    dst[offset] = lang
    dst[offset + 1] = NOT_COMPRESSED
    const l = native.stringToUint8Array(value, dst, offset + 2)
    let crc = native.crc32(dst.subarray(offset + 2, offset + 2 + l))
    writeUint32(dst, crc, offset + 2 + l)
    return l + 6
  } else {
    // Try to compress
    const value = s.normalize('NFKD')
    const l = native.stringByteLength(value)

    console.log('COMPRESS', l, dst.byteLength - offset < 2 * l + 10)

    // this is all broken
    if (l <= 200 || dst.byteLength - offset < 2 * l + 10) {
      console.log('writeRaw ?', l)

      return writeRaw(dst, s, offset, lang, true)
    }

    const insertPos = offset + 6 + l
    const endPos = insertPos + l
    native.stringToUint8Array(value, dst, insertPos)
    const crc = native.crc32(dst.subarray(insertPos, endPos))
    const size = native.compress(dst, offset + 6, l)
    if (size == 0) {
      // Didn't compress
      return writeRaw(dst, s, offset, lang, true)
    }

    dst[offset] = lang
    dst[offset + 1] = COMPRESSED
    writeUint32(dst, l, offset + 2) // uncompressed size
    writeUint32(dst, crc, offset + size + 6)
    return size + 10
  }
}

export const write = (
  ctx: Ctx,
  value: string,
  offset: number,
  noCompression: boolean,
  lang?: LangCodeEnum,
): number | null => {
  resize(ctx, native.stringByteLength(value) * 2 + 10)
  return writeRaw(ctx.buf, value, offset, lang || LangCode.none, noCompression)
}

export const stringCompress = (str: string): Uint8Array => {
  const len = ENCODER.encode(str).byteLength
  const tmpCompressBlock = getTmpBuffer(len * 3)
  const l = writeRaw(tmpCompressBlock, str, 0, LangCode.none, false)
  const nBuffer = new Uint8Array(l)
  nBuffer.set(tmpCompressBlock.subarray(0, l))
  return nBuffer
}
