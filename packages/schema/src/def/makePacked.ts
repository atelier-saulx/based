import { SchemaTypeDef, PropDef } from './types.js'

export function makePacked(
  result: Partial<SchemaTypeDef>,
  typeName: string,
  vals: PropDef[],
  len: number,
) {
  const encoder = new TextEncoder()

  result.buf = new Uint8Array(len)
  result.buf[0] = result.idUint8[0]
  result.buf[1] = result.idUint8[1]
  const fieldNames = []
  const tNameBuf = encoder.encode(typeName)
  fieldNames.push(tNameBuf)
  let fieldNameLen = tNameBuf.byteLength + 1
  let i = 2
  if (result.mainLen) {
    result.buf[i] = 0
    for (const f of vals) {
      if (!f.separate) {
        i++
        result.buf[i] = f.typeIndex
        const name = encoder.encode(f.path.join('.'))
        fieldNames.push(name)
        fieldNameLen += name.byteLength + 1
      }
    }
    i++
    result.buf[i] = 0
  }
  for (const f of vals) {
    if (f.separate) {
      i++
      result.buf[i] = f.prop
      i++
      result.buf[i] = f.typeIndex
      const name = encoder.encode(f.path.join('.'))
      fieldNames.push(name)
      fieldNameLen += name.byteLength + 1
    }
  }
  result.propNames = new Uint8Array(fieldNameLen)
  let lastWritten = 0
  for (const f of fieldNames) {
    result.propNames[lastWritten] = f.byteLength
    result.propNames.set(f, lastWritten + 1)
    lastWritten += f.byteLength + 1
  }

  let bufLen = result.buf.length
  result.packed = new Uint8Array(2 + bufLen + result.propNames.length)
  result.packed[0] = bufLen
  result.packed[1] = bufLen >>>= 8
  result.packed.set(result.buf, 2)
  result.packed.set(result.propNames, result.buf.length + 2)
}
