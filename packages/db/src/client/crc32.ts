import native from '../native.ts'

export const crc32 = (buf: Uint8Array) => {
  return native.crc32(buf)
}
