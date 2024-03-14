type View = { view?: DataView; arr?: Uint8Array; resul?: any }

const readUint = (buff: Uint8Array, start: number): number => {
  return (
    ((buff[start] << 24) |
      (buff[start + 1] << 16) |
      (buff[start + 2] << 8) |
      buff[start + 3]) >>>
    0
  )
}

const readFromBuffer = (buf: Buffer, tree: any): any => {
  const obj = {}
  for (const key in tree) {
    const t = tree[key]
    if (t.type === 'boolean') {
      obj[key] = buf.readUInt8(t.start) ? true : false
    } else if (t.type === 'number' || t.type === 'timestamp') {
      obj[key] = buf.readFloatLE(t.start)
    } else if (t.type === 'string') {
    } else if (t.type === 'integer') {
      obj[key] = buf.readUint32LE(t.start)
    } else {
      obj[key] = readFromBuffer(buf, tree[key])
    }
  }
  return obj
}

export const parseBuffer = (buf: Buffer, schema) => {
  return readFromBuffer(buf, schema.dbMap.tree)
}
