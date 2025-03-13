import native from '../native.js'

export const crc32 = (buf: Uint8Array) => {
  return native.crc32(buf)
}
