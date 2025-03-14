export default function makeTmpBuffer(initialSize: number) {
  // @ts-ignore
  let tmpBuffer = new ArrayBuffer(initialSize, { maxByteLength: initialSize })

  return {
    getUint8Array: (size: number): Uint8Array => {
      const opts = {
        maxByteLength: Math.min(Math.round(1.5 * size), 274877906944)
      }
      // @ts-ignore
      if (tmpBuffer.maxByteLength < size) {
        // @ts-ignore
        tmpBuffer = new ArrayBuffer(size, opts)
      }
      // @ts-ignore
      tmpBuffer.resize(size)

      return new Uint8Array(tmpBuffer)
    }
  }
}
