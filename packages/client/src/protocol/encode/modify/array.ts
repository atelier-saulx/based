export function encodeArrayOp(v: any): Buffer {
  const content = new Uint32Array(v)
  return Buffer.from(content.buffer)
}
