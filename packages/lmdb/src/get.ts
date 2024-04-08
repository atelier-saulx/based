import { Buffers } from './types.js'
import { BasedDb, getDbiHandler } from './index.js'
import { addRead } from './operations.js'

const readFromBuffers = (bufs: Buffers, tree: any): any => {
  const obj = {}
  const mainB = bufs.get(0)

  for (const key in tree) {
    const t = tree[key]

    if (t.type === 'references') {
      if (bufs.has(t.index)) {
        const b = bufs.get(t.index)
        const len = b.byteLength - 2
        const refLen = len / 4
        const refs: number[] = new Array(refLen)
        for (let i = 0; i < refLen; i++) {
          refs[i] = b.readUint32LE(i * 4 + 2)
        }
        obj[key] = refs
      }
    } else if (t.type === 'string') {
      if (bufs.has(t.index)) {
        obj[key] = bufs.get(t.index).toString('utf8', 2)
      }
    } else if (!mainB) {
      continue
    } else if (t.type === 'boolean') {
      obj[key] = mainB.readUInt8(t.start + 2) ? true : false
    } else if (t.type === 'number' || t.type === 'timestamp') {
      obj[key] = mainB.readFloatLE(t.start + 2)
    } else if (t.type === 'integer' || t.type === 'reference') {
      // different sizes for ints letsss goooo
      obj[key] = mainB.readUint32LE(t.start + 2)
    } else {
      obj[key] = readFromBuffers(bufs, tree[key])
    }
  }
  return obj
}

export const parseBuffer = (buf: Buffers, schema) => {
  return readFromBuffers(buf, schema.dbMap.tree)
}

export const get = (db: BasedDb, type: string, id: number) => {
  const def = db.schemaTypesParsed[type]
  const shard = ~~(id / 1e6)
  const key = Buffer.alloc(4)
  key.writeUint32LE(id)
  const bufs: Buffers = new Map()
  bufs.set(0, addRead(db, getDbiHandler(db, def.dbMap, shard, 0), key))
  def.dbMap.entries.forEach((v, k) => {
    addRead(db, getDbiHandler(db, def.dbMap, shard, k), key)
    try {
      bufs.set(k, addRead(db, getDbiHandler(db, def.dbMap, shard, k), key))
    } catch (err) {
      console.log(k, err)
    }
  })
  return parseBuffer(bufs, def)
}
