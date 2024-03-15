import { BasedDb } from './index.js'

const storeUint = (buff: Uint8Array, n: number, start: number) => {
  buff[start] = (n >> 24) & 0xff
  buff[start + 1] = (n >> 16) & 0xff
  buff[start + 2] = (n >> 8) & 0xff
  buff[start + 3] = n & 0xff
}

const writeFromSetObj = (obj, tree, schema, buf: Buffer) => {
  for (const key in obj) {
    const t = tree[key]
    const value = obj[key]
    if (typeof value === 'object') {
      writeFromSetObj(value, t, schema, buf)
    } else {
      // if (t.type === 'timestamp') {
      //   view.result[t.index] = BigInt(value)
      // } else {
      // view.result[t.index] = value
      // }
      if (t.type === 'timestamp' || t.type === 'number') {
        buf.writeFloatLE(value, t.start)
      } else if (t.type === 'integer') {
        buf.writeUint32LE(value, t.start)
      } else if (t.type === 'boolean') {
        buf.writeInt8(value ? 1 : 0, t.start)
      }
    }
  }
}

// just use buffer sadnass
export const createBuffer = (obj, schema, buf?: Buffer) => {
  if (!buf) {
    buf = Buffer.alloc(schema.dbMap._len)
  } else {
    // use buff offset
  }
  // const result = {}

  // preAllocated

  writeFromSetObj(obj, schema.dbMap.tree, schema, buf)

  // return createRecord(schema.dbMap.record, result)

  return buf
}

type ValueInner = any

type Value = ValueInner | ValueInner[]

export const set = (db: BasedDb, value: Value) => {
  // const buf = createBuffer(value, db.schemaTypesParsed.vote)
  // const txn = db.env.beginTxn()
  // txn.putBinary(db.dbis.main, 'key', buf)
}
