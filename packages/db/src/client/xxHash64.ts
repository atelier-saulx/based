import native from '../native.js'

export const xxHash64 = (buf: Buffer) => {
  return native.xxHash64(buf)
}
