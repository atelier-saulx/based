import native from '../native.js'

export const crc32 = (buf: Buffer) => {
  return native.crc32(buf)
}
