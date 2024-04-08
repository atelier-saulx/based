import { BasedDb, getDbiHandler } from './index.js'
import { addWrite } from './operations.js'
import { Buffers } from './types.js'

const writeFromSetObj = (id, obj, tree, schema, buf: Buffers) => {
  for (const key in obj) {
    const t = tree[key]
    const value = obj[key]
    if (!t.type) {
      writeFromSetObj(id, value, t, schema, buf)
    } else {
      if (t.type === 'references') {
        const refLen = 4 * value.length
        const valBuf = Buffer.alloc(refLen + 8)
        valBuf.writeUint32LE(id)
        valBuf.writeUint32LE(refLen, 4)
        for (let i = 0; i < value.length; i++) {
          valBuf.writeUint32LE(value[i], i * 4 + 8)
        }
        buf.set(t.index, valBuf)
      } else if (t.type === 'string') {
        const valBuf = Buffer.alloc(8)
        const strBuf = Buffer.from(value)
        valBuf.writeUint32LE(id)
        valBuf.writeUint32LE(strBuf.byteLength, 4)
        // TODO shitty
        buf.set(t.index, Buffer.concat([valBuf, strBuf]))
      } else {
        let b
        if (!buf.has(0)) {
          b = Buffer.alloc(schema.dbMap._len + 8)
          b.writeUint32LE(id)
          b.writeUint32LE(schema.dbMap._len, 4)
          buf.set(0, b)
        } else {
          b = buf.get(0)
        }
        if (t.type === 'timestamp' || t.type === 'number') {
          b.writeFloatLE(value, t.start + 8)
        } else if (t.type === 'integer' || t.type === 'reference') {
          b.writeUint32LE(value, t.start + 8)
        } else if (t.type === 'boolean') {
          b.writeInt8(value ? 1 : 0, t.start + 8)
        }
      }
    }
  }
}

export const createBuffer = (id: number, obj, schema, buf?: Buffers) => {
  if (!buf) {
    buf = new Map()
  } else {
    // use buff offset
  }
  writeFromSetObj(id, obj, schema.dbMap.tree, schema, buf)
  return buf
}

export const create = (db: BasedDb, type: string, value: any) => {
  const def = db.schemaTypesParsed[type]
  const id = ++def.meta.lastId
  def.meta.total++
  const buf = createBuffer(id, value, def)
  const shard = ~~(id / 1e6)

  buf.forEach((v, k) => {
    addWrite(db, getDbiHandler(db, def.dbMap, shard, k), v)
  })
  return id
}

export const update = (db: BasedDb, type: string, id: number, value: any) => {
  const def = db.schemaTypesParsed[type]
  const buf = createBuffer(id, value, def)
  const shard = ~~(id / 1e6)
  buf.forEach((v, k) => {
    addWrite(db, getDbiHandler(db, def.dbMap, shard, k), v)
  })
}

// optmize schema def
