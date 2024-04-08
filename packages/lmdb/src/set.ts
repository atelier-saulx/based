import { BasedDb } from './index.js'
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
        const valBuf = Buffer.alloc(refLen + 6)
        valBuf.writeUint32LE(id)
        valBuf.writeUint16LE(refLen, 4)
        for (let i = 0; i < value.length; i++) {
          valBuf.writeUint32LE(value[i], i * 4 + 6)
        }
        buf[t.index] = valBuf
      } else if (t.type === 'string') {
        // TODO: OPTMIZE
        const valBuf = Buffer.alloc(6)
        const strBuf = Buffer.from(value)
        valBuf.writeUint32LE(id)
        valBuf.writeUint16LE(strBuf.byteLength, 4)
        buf[t.index] = Buffer.concat([valBuf, strBuf])
      } else {
        if (!buf.main) {
          buf.main = Buffer.alloc(schema.dbMap._len + 6)
          buf.main.writeUint32LE(id)
          buf.main.writeUint16LE(schema.dbMap._len, 4)
        }
        if (t.type === 'timestamp' || t.type === 'number') {
          buf.main.writeFloatLE(value, t.start + 6)
        } else if (t.type === 'integer' || t.type === 'reference') {
          buf.main.writeUint32LE(value, t.start + 6)
        } else if (t.type === 'boolean') {
          buf.main.writeInt8(value ? 1 : 0, t.start + 6)
        }
      }
    }
  }
}

export const createBuffer = (id: number, obj, schema, buf?: Buffers) => {
  if (!buf) {
    buf = {}
  } else {
    // use buff offset
  }

  writeFromSetObj(id, obj, schema.dbMap.tree, schema, buf)

  return buf
}

// keep index in mem

/*
 update(type: string, id: number, value: any) {
    // return set(this, value)
  }

  create(type: string, value: any) {
    // return set(this, value)
  }
*/

export const create = (db: BasedDb, type: string, value: any) => {
  const def = db.schemaTypesParsed[type]
  const id = ++def.meta.lastId
  def.meta.total++
  // also add id to buf
  const buf = createBuffer(id, value, def)
  const shard = id % 1e6
  for (const b in buf) {
    addWrite(db, Buffer.from(def.dbMap.prefix + b + '_' + shard + '\0'), buf[b])
  }
  return id
}

export const update = (db: BasedDb, type: string, id: number, value: any) => {
  // do a get also pretty poopie make in zig (zero merge to start)
  const buf = createBuffer(id, value, db.schemaTypesParsed[type])
}
