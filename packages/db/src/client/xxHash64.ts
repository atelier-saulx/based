import native from '../native.js'

export const xxHash64 = (buf: Uint8Array, target?: Uint8Array, index?: number) => {
  if (!target) {
    target = new Uint8Array(8)
    index = 0
  }
  native.xxHash64(buf, target, index)
  return target
}
