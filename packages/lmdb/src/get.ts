import { Buffers } from './types.js'
import { BasedDb } from './index.js'
import { addRead } from './operations.js'

const readFromBuffers = (bufs: Buffers, tree: any): any => {
  const obj = {}
  for (const key in tree) {
    const t = tree[key]

    if (t.type === 'references') {
      if (t.index in bufs) {
        const b = bufs[t.index]
        const len = b.byteLength - 2

        const refLen = len / 4

        const refs: number[] = new Array(refLen)
        for (let i = 0; i < refLen; i++) {
          refs[i] = b.readUint32LE(i * 4 + 2)
        }
        obj[key] = refs
      }
    } else if (t.type === 'string') {
      if (t.index in bufs) {
        obj[key] = bufs[t.index].toString('utf8', 2)
      }
    } else if (!bufs.main) {
      continue
    } else if (t.type === 'boolean') {
      obj[key] = bufs.main.readUInt8(t.start + 2) ? true : false
    } else if (t.type === 'number' || t.type === 'timestamp') {
      obj[key] = bufs.main.readFloatLE(t.start + 2)
    } else if (t.type === 'integer' || t.type === 'reference') {
      // different sizes for ints letsss goooo
      obj[key] = bufs.main.readUint32LE(t.start + 2)
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

  const shard = id % 1e6

  const dbi = Buffer.from(def.dbMap.prefix + 'main' + '_' + shard + '\0')

  const key = Buffer.alloc(4)

  key.writeUint32LE(id)

  console.log(dbi, key)

  const bufs: Buffers = {
    main: addRead(db, dbi, key),
  }

  def.dbMap.entries.forEach((v, k) => {
    console.log('GO', k)
    try {
      bufs[k] = addRead(
        db,
        Buffer.from(def.dbMap.prefix + k + '_' + shard + '\0'),
        key,
      )
    } catch (err) {
      console.log(k, err)
    }
  })

  console.log('FLAP', bufs)

  return parseBuffer(bufs, def)
  // get all value: any

  // get all fields
}
