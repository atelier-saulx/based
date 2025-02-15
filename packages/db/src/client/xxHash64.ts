import native from '../native.js'

export const xxHash64 = (buf: Buffer, target?: Buffer, index?: number) => {
  if (!target) {
    target = Buffer.allocUnsafe(8)
    index = 0
  }
  native.xxHash64(buf, target, index)
  return target
}
