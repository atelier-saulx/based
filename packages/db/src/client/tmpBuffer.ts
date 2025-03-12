export default function makeTmpBuffer(initialSize: number) {
  let tmpBuffer = new ArrayBuffer(initialSize)

  return {
    getUint8Array: (size: number): Uint8Array => {
      // @ts-ignore
      if (tmpBuffer.maxByteLength < size) {
        // @ts-ignore
        tmpBuffer = new ArrayBuffer(size, { maxByteLength: 1.5 * size | 0 });
      }
      // @ts-ignore
      tmpBuffer.resize(size)

      return new Uint8Array(tmpBuffer)
    }
  }
}
