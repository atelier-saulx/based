import { Buffers } from './types.js'

const readFromBuffers = (bufs: Buffers, tree: any): any => {
  const obj = {}
  for (const key in tree) {
    const t = tree[key]

    if (t.type === 'references') {
      if (t.index in bufs) {
        const b = bufs[t.index]
        const len = b.byteLength
        const refLen = len / 4
        const refs: number[] = new Array(refLen)
        for (let i = 0; i < refLen; i++) {
          refs[i] = b.readUint32LE(i * 4)
        }
        obj[key] = refs
      }
    } else if (t.type === 'string') {
      if (t.index in bufs) {
        obj[key] = bufs[t.index].toString('utf8')
      }
    } else if (!bufs.main) {
      continue
    } else if (t.type === 'boolean') {
      obj[key] = bufs.main.readUInt8(t.start) ? true : false
    } else if (t.type === 'number' || t.type === 'timestamp') {
      obj[key] = bufs.main.readFloatLE(t.start)
    } else if (t.type === 'integer' || t.type === 'reference') {
      // different sizes for ints letsss goooo
      obj[key] = bufs.main.readUint32LE(t.start)
    } else {
      obj[key] = readFromBuffers(bufs, tree[key])
    }
  }
  return obj
}

export const parseBuffer = (buf: Buffers, schema) => {
  return readFromBuffers(buf, schema.dbMap.tree)
}
