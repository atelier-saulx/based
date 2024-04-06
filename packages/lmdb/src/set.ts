import { BasedDb } from './index.js'
import { addWrite } from './batch.js'

console.log('??/', addWrite)

const writeFromSetObj = (obj, tree, schema, buf: Buffer) => {
  for (const key in obj) {
    const t = tree[key]
    const value = obj[key]
    if (typeof value === 'object') {
      writeFromSetObj(value, t, schema, buf)
    } else {
      if (t.type === 'timestamp' || t.type === 'number') {
        buf.writeFloatLE(value, t.start)
      } else if (t.type === 'integer') {
        buf.writeUint32LE(value, t.start)
      } else if (t.type === 'boolean') {
        buf.writeInt8(value ? 1 : 0, t.start)
      }
      // else if type is string add extra key to write
    }
  }
}

export const createBuffer = (obj, schema, buf?: Buffer) => {
  if (!buf) {
    buf = Buffer.alloc(schema.dbMap._len)
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
  // const buf = createBuffer(value, db.schemaTypesParsed.vote)
}
