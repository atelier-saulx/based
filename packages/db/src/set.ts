import { BasedDb, FieldDef, SchemaTypeDef } from './index.js'
import {
  startDrain,
  modifyBuffer,
  MAX_MODIFY_BUFFER,
  flushBuffer,
} from './operations.js'

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
    modifyBuffer.lastMain = -1
  }

  const field = t.field

  if (!ignoreField && modifyBuffer.field !== field) {
    const len = modifyBuffer.len
    modifyBuffer.buffer[len] = 0
    // make field 2 bytes
    modifyBuffer.buffer[len + 1] = field // 1 byte (max size 255 - 1)
    modifyBuffer.buffer[len + 2] = 4
    modifyBuffer.len += 3
    modifyBuffer.field = field
  }

  if (modifyBuffer.id !== id) {
    const len = modifyBuffer.len
    modifyBuffer.buffer[len] = 1
    modifyBuffer.buffer.writeUInt32LE(id, len + 1)
    modifyBuffer.len += 5
    modifyBuffer.id = id
    modifyBuffer.lastMain = -1
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
        if (refLen + 5 + modifyBuffer.len + 11 > MAX_MODIFY_BUFFER) {
          flushBuffer(db)
        }
        setCursor(db, schema, t, id)
        modifyBuffer.buffer[modifyBuffer.len] = 3
        modifyBuffer.buffer.writeUint32LE(refLen, modifyBuffer.len + 1)
        modifyBuffer.len += 5
        for (let i = 0; i < value.length; i++) {
          modifyBuffer.buffer.writeUint32LE(value[i], i * 4 + modifyBuffer.len)
        }
        modifyBuffer.len += refLen
      } else if (t.type === 'string') {
        const byteLen = Buffer.byteLength(value, 'utf8')
        if (byteLen + 5 + modifyBuffer.len + 11 > MAX_MODIFY_BUFFER) {
          flushBuffer(db)
        }
        setCursor(db, schema, t, id)
        modifyBuffer.buffer[modifyBuffer.len] = 3
        modifyBuffer.buffer.writeUint32LE(byteLen, modifyBuffer.len + 1)
        modifyBuffer.len += 5
        modifyBuffer.buffer.write(value, modifyBuffer.len, 'utf8')
        modifyBuffer.len += byteLen
      } else {
        setCursor(db, schema, t, id, true)
        let mainIndex = modifyBuffer.lastMain
        if (mainIndex === -1) {
          const nextLen = schema.mainLen + 1 + 4
          if (modifyBuffer.len + nextLen > MAX_MODIFY_BUFFER) {
            flushBuffer(db)
          }
          setCursor(db, schema, t, id)
          modifyBuffer.buffer[modifyBuffer.len] = 3
          modifyBuffer.buffer.writeUint32LE(
            schema.mainLen,
            modifyBuffer.len + 1,
          )
          mainIndex = modifyBuffer.lastMain = modifyBuffer.len + 1 + 4
          modifyBuffer.len += nextLen
        }
        if (t.type === 'timestamp' || t.type === 'number') {
          modifyBuffer.buffer.writeFloatLE(value, t.start + mainIndex)
        } else if (t.type === 'integer' || t.type === 'reference') {
          // enum
          modifyBuffer.buffer.writeUint32LE(value, t.start + mainIndex)
        } else if (t.type === 'boolean') {
          modifyBuffer.buffer.writeInt8(value ? 1 : 0, t.start + mainIndex)
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

/*

      // // --------- OPTIMIZATION NEEDED ------------------
      const arr = []
      // let lastTarget
      // // console.log(new Uint8Array(result))
      // let i = 4
      // while (i < result.byteLength) {
      //   // read
      //   const index = result[i]
      //   i++

      //   // read from tree
      //   if (index === 255) {
      //     lastTarget = {
      //       // last id is what we want...
      //       id: result.readUint32LE(i),
      //     }
      //     arr.push(lastTarget)

      //     i += 4
      //   } else if (index === 0) {
      //     for (const f in this.type.fields) {
      //       const field = this.type.fields[f]
      //       if (!field.seperate) {
      //         if (this.includeFields) {
      //           if (!this.includeFields.includes(f)) {
      //             continue
      //           }
      //         }
      //         if (field.type === 'integer' || field.type === 'reference') {
      //           setByPath(
      //             lastTarget,
      //             field.path,
      //             result.readUint32LE(i + field.start),
      //           )
      //         } else if (field.type === 'number') {
      //           setByPath(
      //             lastTarget,
      //             field.path,
      //             result.readFloatLE(i + field.start),
      //           )
      //         }
      //       }
      //     }
      //     i += this.type.mainLen
      //   } else {
      //     const size = result.readUInt16LE(i)
      //     i += 2

      //     // MAKE THIS FAST
      //     for (const f in this.type.fields) {
      //       const field = this.type.fields[f]
      //       if (field.seperate) {
      //         if (field.field === index) {
      //           if (field.type === 'string') {
      //             setByPath(
      //               lastTarget,
      //               field.path,
      //               result.toString('utf8', i, size + i),
      //             )
      //           } else if (field.type === 'references') {
      //             const x = new Array(size / 4)
      //             for (let j = i; j < size / 4; j += 4) {
      //               x[j / 4] = result.readUint32LE(j)
      //             }
      //             setByPath(lastTarget, field.path, x)
      //           }
      //           break
      //         }
      //       }
      //     }
      //     i += size
      //   }
      // }
      // -----------------------------------------------------------------
*/
