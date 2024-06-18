import { BasedDb, FieldDef, SchemaTypeDef } from './index.js'
import { startDrain, flushBuffer } from './operations.js'
import snappy from 'snappy'
import zlib from 'node:zlib'

import { createRequire } from 'node:module'
const nodeflate = createRequire(import.meta.url)('../../build/nodeflate.node')
const compressor = nodeflate.newCompressor(3)
const decompressor = nodeflate.newDecompressor()

const setCursor = (
  db: BasedDb,
  schema: SchemaTypeDef,
  t: FieldDef,
  id: number,
  ignoreField?: boolean,
) => {
  // 0 switch field
  // 1 switch id
  // 2 switch type
  const prefix = schema.prefix
  if (
    db.modifyBuffer.typePrefix[0] !== prefix[0] ||
    db.modifyBuffer.typePrefix[1] !== prefix[1]
  ) {
    const len = db.modifyBuffer.len
    db.modifyBuffer.buffer[len] = 2
    db.modifyBuffer.buffer[len + 1] = prefix[0]
    db.modifyBuffer.buffer[len + 2] = prefix[1]
    db.modifyBuffer.len += 3
    db.modifyBuffer.typePrefix = prefix
    db.modifyBuffer.field = -1
    db.modifyBuffer.id = -1
    db.modifyBuffer.lastMain = -1
  }

  const field = t.field

  if (!ignoreField && db.modifyBuffer.field !== field) {
    const len = db.modifyBuffer.len
    db.modifyBuffer.buffer[len] = 0
    // make field 2 bytes
    db.modifyBuffer.buffer[len + 1] = field // 1 byte (max size 255 - 1)
    db.modifyBuffer.buffer[len + 2] = 4
    db.modifyBuffer.len += 3
    db.modifyBuffer.field = field
  }

  if (db.modifyBuffer.id !== id) {
    const len = db.modifyBuffer.len
    db.modifyBuffer.buffer[len] = 1
    db.modifyBuffer.buffer.writeUInt32LE(id, len + 1)
    db.modifyBuffer.len += 5
    db.modifyBuffer.id = id
    db.modifyBuffer.lastMain = -1
  }
}

// modifyBuffer
const addModify = (
  db: BasedDb,
  id: number,
  obj: { [key: string]: any },
  tree: SchemaTypeDef['tree'],
  schema: SchemaTypeDef,
) => {
  for (const key in obj) {
    const leaf = tree[key]
    const value = obj[key]
    if (!leaf.type && !leaf.__isField) {
      addModify(db, id, value, leaf as SchemaTypeDef['tree'], schema)
    } else {
      const t = leaf as FieldDef
      if (t.type === 'references') {
        const refLen = 4 * value.length
        if (refLen + 5 + db.modifyBuffer.len + 11 > db.maxModifySize) {
          flushBuffer(db)
        }
        setCursor(db, schema, t, id)
        db.modifyBuffer.buffer[db.modifyBuffer.len] = 3
        db.modifyBuffer.buffer.writeUint32LE(refLen, db.modifyBuffer.len + 1)
        db.modifyBuffer.len += 5
        for (let i = 0; i < value.length; i++) {
          db.modifyBuffer.buffer.writeUint32LE(
            value[i],
            i * 4 + db.modifyBuffer.len,
          )
        }
        db.modifyBuffer.len += refLen
      } else if (t.type === 'string') {
        // 782 - 821
        // const deflated = zlib.deflateRawSync(value)
        // const x = dbZig.deflate.compress(Buffer.from(value)) (1.5 sec)
        // const buf = Buffer.from(value)
        // const x = compressSync(Buffer.from(value))
        // const x = snappy.compressSync(value)
        // const deflated = zlib.deflateRawSync(buf)
        // const compressed = Buffer.allocUnsafe(Buffer.byteLength(uncompressed))
        // const byteLen = buf.byteLength
        const l = value.length
        const byteLen = l + l
        // const byteLen =//Buffer.byteLength(value, 'utf8')
        // const byteLen = x.byteLength

        // if len > then max buffer size throw error
        if (byteLen + 5 + db.modifyBuffer.len + 11 > db.maxModifySize) {
          flushBuffer(db)
        }
        setCursor(db, schema, t, id)
        db.modifyBuffer.buffer[db.modifyBuffer.len] = 3
        db.modifyBuffer.len += 5

        // deflated.copy(db.modifyBuffer.buffer, db.modifyBuffer.len)
        // const size = byteLen
        const size = db.modifyBuffer.buffer.write(
          value,
          db.modifyBuffer.len,
          'utf8',
        )
        // const size = nodeflate.compress(
        //   compressor,
        //   value,
        //   db.modifyBuffer.buffer,
        //   db.modifyBuffer.len,
        // )
        db.modifyBuffer.buffer.writeUint32LE(size, db.modifyBuffer.len + 1 - 5)

        db.modifyBuffer.len += size
      } else {
        setCursor(db, schema, t, id, true)
        let mainIndex = db.modifyBuffer.lastMain
        if (mainIndex === -1) {
          const nextLen = schema.mainLen + 1 + 4
          if (db.modifyBuffer.len + nextLen > db.maxModifySize) {
            flushBuffer(db)
          }
          setCursor(db, schema, t, id)
          db.modifyBuffer.buffer[db.modifyBuffer.len] = 3
          db.modifyBuffer.buffer.writeUint32LE(
            schema.mainLen,
            db.modifyBuffer.len + 1,
          )
          mainIndex = db.modifyBuffer.lastMain = db.modifyBuffer.len + 1 + 4
          db.modifyBuffer.len += nextLen
        }
        if (t.type === 'timestamp' || t.type === 'number') {
          db.modifyBuffer.buffer.writeFloatLE(value, t.start + mainIndex)
        } else if (t.type === 'integer' || t.type === 'reference') {
          // enum
          db.modifyBuffer.buffer.writeUint32LE(value, t.start + mainIndex)
        } else if (t.type === 'boolean') {
          db.modifyBuffer.buffer.writeInt8(value ? 1 : 0, t.start + mainIndex)
        }
      }
    }
  }
}

export const create = (db: BasedDb, type: string, value: any) => {
  const def = db.schemaTypesParsed[type]
  const id = ++def.lastId
  def.total++
  addModify(db, id, value, def.tree, def)
  if (!db.isDraining) {
    startDrain(db)
  }
  return id
}

export const update = (
  db: BasedDb,
  type: string,
  id: number,
  value: any,
  merge?: boolean,
) => {
  const def = db.schemaTypesParsed[type]
  addModify(db, id, value, def.tree, def)
  if (!db.isDraining) {
    startDrain(db)
  }
}
