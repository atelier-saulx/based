import { BasedDb } from './index.js'
import { addWrite } from './operations.js'
import { Buffers } from './types.js'

const writeFromSetObj = (obj, tree, schema, buf: Buffers) => {
  for (const key in obj) {
    const t = tree[key]
    const value = obj[key]
    if (!t.type) {
      writeFromSetObj(value, t, schema, buf)
    } else {
      if (t.type === 'references') {
        const valBuf = Buffer.alloc(4 * value.length)
        for (let i = 0; i < value.length; i++) {
          valBuf.writeUint32LE(value[i], i * 4)
        }
        buf[t.index] = valBuf
      } else if (t.type === 'string') {
        buf[t.index] = Buffer.from(value)
      } else {
        if (!buf.main) {
          buf.main = Buffer.alloc(schema.dbMap._len)
        }
        if (t.type === 'timestamp' || t.type === 'number') {
          buf.main.writeFloatLE(value, t.start)
        } else if (t.type === 'integer' || t.type === 'reference') {
          buf.main.writeUint32LE(value, t.start)
        } else if (t.type === 'boolean') {
          buf.main.writeInt8(value ? 1 : 0, t.start)
        }
      }
    }
  }
}

export const createBuffer = (obj, schema, buf?: Buffers) => {
  if (!buf) {
    buf = {}
  } else {
    // use buff offset
  }

  writeFromSetObj(obj, schema.dbMap.tree, schema, buf)

  return buf
}

type ValueInner = any

type Value = ValueInner | ValueInner[]

// keep index in mem

export const set = (db: BasedDb, value: Value) => {
  // first check what you are setting might need multiple fields

  const buf = createBuffer(value, db.schemaTypesParsed.vote)
}
