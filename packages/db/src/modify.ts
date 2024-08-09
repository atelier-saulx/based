import { BasedDb, FieldDef, SchemaTypeDef } from './index.js'
import { startDrain, flushBuffer } from './operations.js'
// import snappy from 'snappy'

import { createRequire } from 'node:module'
const nodeflate = createRequire(import.meta.url)('../../build/nodeflate.node')
// const compressor = nodeflate.newCompressor(3)
// const decompressor = nodeflate.newDecompressor()

const EMPTY_BUFFER = Buffer.alloc(1000)

const setCursor = (
  db: BasedDb,
  schema: SchemaTypeDef,
  field: number,
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
  merge: boolean,
): boolean => {
  let wroteMain = false
  for (const key in obj) {
    const leaf = tree[key]
    const value = obj[key]
    if (!leaf.type && !leaf.__isField) {
      if (
        addModify(db, id, value, leaf as SchemaTypeDef['tree'], schema, merge)
      ) {
        wroteMain = true
      }
    } else {
      const t = leaf as FieldDef
      if (t.type === 'references') {
        const refLen = 4 * value.length
        if (refLen + 5 + db.modifyBuffer.len + 11 > db.maxModifySize) {
          flushBuffer(db)
        }
        setCursor(db, schema, t.field, id)
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
      } else if (t.type === 'string' && t.seperate === true) {
        // add zstd
        const byteLen = value.length + value.length
        if (byteLen + 5 + db.modifyBuffer.len + 11 > db.maxModifySize) {
          flushBuffer(db)
        }
        setCursor(db, schema, t.field, id)
        db.modifyBuffer.buffer[db.modifyBuffer.len] = 3
        db.modifyBuffer.len += 5
        const size = db.modifyBuffer.buffer.write(
          value,
          db.modifyBuffer.len,
          'utf8',
        )
        db.modifyBuffer.buffer.writeUint32LE(size, db.modifyBuffer.len + 1 - 5)
        db.modifyBuffer.len += size
      } else if (merge) {
        wroteMain = true
        if (!db.modifyBuffer.mergeMain) {
          db.modifyBuffer.mergeMain = []
        }
        db.modifyBuffer.mergeMain.push(t, value)
        db.modifyBuffer.mergeMainSize += t.len + 4
      } else {
        wroteMain = true
        setCursor(db, schema, t.field, id, true)
        let mainIndex = db.modifyBuffer.lastMain
        if (mainIndex === -1) {
          const nextLen = schema.mainLen + 1 + 4
          if (db.modifyBuffer.len + nextLen + 5 > db.maxModifySize) {
            flushBuffer(db)
          }
          setCursor(db, schema, t.field, id)
          db.modifyBuffer.buffer[db.modifyBuffer.len] = merge ? 4 : 3
          db.modifyBuffer.buffer.writeUint32LE(
            schema.mainLen,
            db.modifyBuffer.len + 1,
          )
          mainIndex = db.modifyBuffer.lastMain = db.modifyBuffer.len + 1 + 4
          db.modifyBuffer.len += nextLen
          const size = db.modifyBuffer.len - schema.mainLen
          if (schema.mainLen < 1e3) {
            EMPTY_BUFFER.copy(db.modifyBuffer.buffer, size, 0, schema.mainLen)
          } else {
            for (let x = 0; x < schema.mainLen; x++) {
              db.modifyBuffer.buffer[size + x] = 0
            }
          }
        }
        if (t.type === 'string') {
          const size = db.modifyBuffer.buffer.write(
            value,
            t.start + mainIndex + 1,
            'utf8',
          )
          db.modifyBuffer.buffer[t.start + mainIndex] = size
          if (size + 1 > t.len) {
            console.warn('String does not fit fixed len', value)
          }
        } else if (t.type === 'timestamp' || t.type === 'number') {
          db.modifyBuffer.buffer.writeFloatLE(value, t.start + mainIndex)
        } else if (t.type === 'integer' || t.type === 'reference') {
          db.modifyBuffer.buffer.writeUint32LE(value, t.start + mainIndex)
        } else if (t.type === 'boolean') {
          db.modifyBuffer.buffer.writeInt8(value ? 1 : 0, t.start + mainIndex)
        }
      }
    }
  }
  return wroteMain
}

export const remove = (db: BasedDb, type: string, id: number): boolean => {
  const def = db.schemaTypesParsed[type]
  const nextLen = 1 + 4 + 1
  if (db.modifyBuffer.len + nextLen > db.maxModifySize) {
    flushBuffer(db)
  }
  setCursor(db, def, 0, id)
  db.modifyBuffer.buffer[db.modifyBuffer.len] = 4
  db.modifyBuffer.len++
  if (def.seperate) {
    for (const s of def.seperate) {
      const nextLen = 1 + 4 + 1
      if (db.modifyBuffer.len + nextLen > db.maxModifySize) {
        flushBuffer(db)
      }
      setCursor(db, def, s.field, id)
      db.modifyBuffer.buffer[db.modifyBuffer.len] = 4
      db.modifyBuffer.len++
    }
  }
  return true
}

export const create = (db: BasedDb, type: string, value: any) => {
  const def = db.schemaTypesParsed[type]
  const id = ++def.lastId
  def.total++
  if (!addModify(db, id, value, def.tree, def, false) || def.mainLen === 0) {
    const nextLen = 5 + def.mainLen
    if (db.modifyBuffer.len + nextLen + 5 > db.maxModifySize) {
      flushBuffer(db)
    }
    setCursor(db, def, 0, id)
    db.modifyBuffer.buffer[db.modifyBuffer.len] = 3
    db.modifyBuffer.buffer.writeUint32LE(def.mainLen, db.modifyBuffer.len + 1)
    for (
      let i = db.modifyBuffer.len + 5;
      i < db.modifyBuffer.len + nextLen;
      i++
    ) {
      db.modifyBuffer.buffer[i] = 0
    }
    db.modifyBuffer.len += nextLen
  }
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
  overwrite?: boolean, // default for now
) => {
  const def = db.schemaTypesParsed[type]
  const hasMain = addModify(db, id, value, def.tree, def, !overwrite)

  if (hasMain && !overwrite && db.modifyBuffer.mergeMain !== null) {
    const mergeMain = db.modifyBuffer.mergeMain
    const size = db.modifyBuffer.mergeMainSize
    if (db.modifyBuffer.len + size + 9 > db.maxModifySize) {
      flushBuffer(db)
    }

    setCursor(db, def, 0, id)

    db.modifyBuffer.buffer[db.modifyBuffer.len] = 5
    db.modifyBuffer.len += 1

    db.modifyBuffer.buffer.writeUint32LE(size, db.modifyBuffer.len)
    db.modifyBuffer.len += 4

    for (let i = 0; i < mergeMain.length; i += 2) {
      const t = mergeMain[i]
      const v = mergeMain[i + 1]
      db.modifyBuffer.buffer.writeUint16LE(t.start, db.modifyBuffer.len)
      db.modifyBuffer.len += 2
      db.modifyBuffer.buffer.writeUint16LE(t.len, db.modifyBuffer.len)
      db.modifyBuffer.len += 2
      if (t.type === 'string') {
        const size = db.modifyBuffer.buffer.write(
          v,
          db.modifyBuffer.len + 1,
          'utf8',
        )
        db.modifyBuffer.buffer[db.modifyBuffer.len] = size
        if (size + 1 > t.len) {
          console.warn('String does not fit fixed len', v)
        }
      } else if (t.type === 'timestamp' || t.type === 'number') {
        db.modifyBuffer.buffer.writeFloatLE(v, db.modifyBuffer.len)
      } else if (t.type === 'integer' || t.type === 'reference') {
        db.modifyBuffer.buffer.writeUint32LE(v, db.modifyBuffer.len)
      } else if (t.type === 'boolean') {
        db.modifyBuffer.buffer.writeInt8(v ? 1 : 0, db.modifyBuffer.len)
      }
      db.modifyBuffer.len += t.len
    }
    db.modifyBuffer.mergeMain = null
    db.modifyBuffer.mergeMainSize = 0
  }

  if (!db.isDraining) {
    startDrain(db)
  }
}
