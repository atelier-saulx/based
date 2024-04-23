import { BasedDb, getDbiHandler } from './index.js'
import { addWrite, startDrain, modifyBuffer } from './operations.js'
import { Buffers } from './types.js'
// import { deflateSync } from 'node:zlib'

const setCursor = (db, schema, t, id: number) => {
  // 0 switch field
  // 1 switch id
  // 2 switch type

  const prefix = schema.dbMap.prefixUint

  if (
    modifyBuffer.typePrefix[0] !== prefix[0] ||
    modifyBuffer.typePrefix[1] !== prefix[1]
  ) {
    const len = modifyBuffer.len
    modifyBuffer.buffer[len] = 2
    modifyBuffer.buffer[len + 1] = prefix[0]
    modifyBuffer.buffer[len + 2] = prefix[1]
    modifyBuffer.len += 3
    modifyBuffer.typePrefix = prefix
    modifyBuffer.field = -1
    modifyBuffer.id = -1
  }

  if (modifyBuffer.field !== t.index) {
    const len = modifyBuffer.len
    modifyBuffer.buffer[len] = 0
    modifyBuffer.buffer[len + 1] = t.index // make 2 bytes
    modifyBuffer.buffer[len + 2] = 4
    modifyBuffer.len += 3
    modifyBuffer.field = t.index
  }

  if (modifyBuffer.id !== id) {
    const len = modifyBuffer.len
    modifyBuffer.buffer[len] = 1
    modifyBuffer.buffer.writeUInt32LE(id, len + 1)
    modifyBuffer.len += 5
    modifyBuffer.id = id
  }
}

// modifyBuffer

const addModify = (db, id, obj, tree, schema) => {
  for (const key in obj) {
    const t = tree[key]
    const value = obj[key]

    if (!t.type) {
      addModify(db, id, value, t, schema)
    } else {
      if (t.type === 'references') {
        // const refLen = 4 * value.length
        // const valBuf = Buffer.alloc(refLen + 8)
        // valBuf.writeUint32LE(id)
        // valBuf.writeUint32LE(refLen, 4)
        // for (let i = 0; i < value.length; i++) {
        //   valBuf.writeUint32LE(value[i], i * 4 + 8)
        // }
        // buf.set(t.index, valBuf)
      } else if (t.type === 'string') {
        // console.log('|->', value.length)

        setCursor(db, schema, t, id)
        modifyBuffer.buffer[modifyBuffer.len] = 3
        modifyBuffer.buffer.writeUint32LE(value.length, modifyBuffer.len + 1)
        modifyBuffer.len += 5
        modifyBuffer.buffer.write(value, modifyBuffer.len, 'utf8')
        modifyBuffer.len += value.length

        // const valBuf = Buffer.alloc(8)
        // const strBuf = Buffer.from(value)
        // valBuf.writeUint32LE(id)
        // valBuf.writeUint32LE(strBuf.byteLength, 4)
        // const nBuf = Buffer.allocUnsafe(8 + strBuf.byteLength)
        // nBuf.set(valBuf, 0)
        // nBuf.set(strBuf, 8)
        // buf.set(t.index, nBuf)
      } else {
        // setCursor for this will add the operation as well

        // let b
        // if currentDbi && currentKey are the same

        // if (!buf.has(0)) {
        //   b = Buffer.alloc(schema.dbMap._len + 8)
        //   b.writeUint32LE(id)
        //   b.writeUint32LE(schema.dbMap._len, 4)
        //   buf.set(0, b)
        // } else {
        //   b = buf.get(0)
        // }
        if (t.type === 'timestamp' || t.type === 'number') {
          // b.writeFloatLE(value, t.start + 8)
        } else if (t.type === 'integer' || t.type === 'reference') {
          // b.writeUint32LE(value, t.start + 8)
        } else if (t.type === 'boolean') {
          // b.writeInt8(value ? 1 : 0, t.start + 8)
        }
      }
    }
  }
}

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
        const nBuf = Buffer.allocUnsafe(8 + strBuf.byteLength)
        nBuf.set(valBuf, 0)
        nBuf.set(strBuf, 8)
        buf.set(t.index, nBuf)
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

export const createFast = (db: BasedDb, type: string, value: any) => {
  const def = db.schemaTypesParsed[type]
  const id = ++def.meta.lastId
  def.meta.total++

  // getDbiHandler(db, def.dbMap, shard, k)
  addModify(db, id, value, def.dbMap.tree, def)

  // prob do the check here
  if (!db.isDraining) {
    startDrain(db)
  }

  return id
}
