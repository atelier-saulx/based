import { BasedDb, FieldDef, SchemaTypeDef } from './index.js'
import {decodeMessageWithValues} from './selvad-client/proto-value.js'
import {SELVA_PROTO_LONGLONG, SELVA_PROTO_STRING} from './selvad-client/selva_proto.js'

const buf = Buffer.alloc(1024 * 1024)
let bufIndex = 0
let nrChanges = 0

const modify = (
  db: BasedDb,
  type: string,
  id: number,
  obj: { [key: string]: any },
  tree: SchemaTypeDef['tree'],
  schema: SchemaTypeDef
) => {
  if (bufIndex === 0) {
      buf.writeUint8(SELVA_PROTO_STRING, 0)
      buf.writeUint32LE(16, 4)
      bufIndex += 8 // selva_proto_string

      // modify_header
      const selvaId = `${schema.prefixString}${id}`
      buf.write(selvaId, bufIndex)
      bufIndex += 16
  }

  for (const key in obj) {
    const leaf = tree[key]
    const value = obj[key]
    if (!leaf.type && !leaf.__isField) {
      modify(db, type, id, value, leaf as SchemaTypeDef['tree'], schema)
    } else {
      const t = leaf as FieldDef
      if (t.type === 'string') {
          const byteLen = Buffer.byteLength(value, 'utf8')

          buf.writeUint8(SELVA_PROTO_STRING, bufIndex)
          buf.writeUint32LE(32 + byteLen, bufIndex + 4)
          bufIndex += 8 // selva_proto_string

          // SelvaModifyFieldOp
          buf.writeUint8(1, bufIndex)
          console.log('string', t.field)
          buf.write(`${t.field}`, bufIndex + 8)
          buf.writeBigUint64LE(32n, bufIndex + 16)
          buf.writeBigUint64LE(BigInt(byteLen), bufIndex + 24)
          buf.write(value, bufIndex + 32)
          bufIndex += 32 + byteLen
      } else if (t.type === 'number') {
          buf.writeUint8(SELVA_PROTO_STRING, bufIndex)
          buf.writeUint32LE(32 + 8, bufIndex + 4)
          bufIndex += 8 // selva_proto_string

          // SelvaModifyFieldOp
          buf.writeUint8(6, bufIndex)
          buf.write(`${t.field}`, bufIndex + 8)
          console.log('num', t.field)
          buf.writeBigUint64LE(32n, bufIndex + 16)
          buf.writeBigUint64LE(8n, bufIndex + 24)
          buf.writeDoubleLE(value, bufIndex + 32)
          bufIndex += 32 + 8
      } else if (t.type === 'timestamp' || t.type === 'integer' || t.type === 'boolean') {
          buf.writeUint8(SELVA_PROTO_STRING, bufIndex)
          buf.writeUint32LE(32 + 8, bufIndex + 4)
          bufIndex += 8 // selva_proto_string

          // SelvaModifyFieldOp
          buf.writeUint8(3, bufIndex)
          buf.write(`${t.field}`, bufIndex + 8)
          console.log('num', t.field)
          buf.writeBigUint64LE(32n, bufIndex + 16)
          buf.writeBigUint64LE(8n, bufIndex + 24)
          buf.writeBigInt64LE(BigInt(value), bufIndex + 32)
          bufIndex += 32 + 8
      } else if (t.type === 'reference') {
          // TODO
      } else if (t.type === 'references') {
          // TODO
      }
      nrChanges++
    }
  }
}

export const create = async (db: BasedDb, type: string, value: any) => {
  const def = db.schemaTypesParsed[type]
  const id = ++def.lastId
  def.total++
  modify(db, type, id, value, def.tree, def)
  buf.writeUint32LE(nrChanges, 8 + 12)
  // @ts-ignore
  const resp = await db.client.sendRequest(70, buf)
  console.log(decodeMessageWithValues(resp))
  bufIndex = 0
  nrChanges = 0
  return id
}

export const update = async (
  db: BasedDb,
  type: string,
  id: number,
  value: any,
  merge?: boolean
) => {
  const def = db.schemaTypesParsed[type]
  modify(db, type, id, value, def.tree, def)
  buf.writeUint32LE(nrChanges, 8 + 12)
  // @ts-ignore
  await db.client.sendRequest(70, buf.subarray(0, bufIndex))
  bufIndex = 0
  nrChanges = 0
}
