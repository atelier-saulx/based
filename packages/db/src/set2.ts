import { BasedDb, FieldDef, SchemaTypeDef } from './index.js'
import {SELVA_PROTO_STRING} from './selvad-client/selva_proto.js'

const modify = (
  db: BasedDb,
  state: { buf: Buffer; bufIndex: number; nrChanges: number; },
  type: string,
  id: number | null,
  obj: { [key: string]: any },
  tree: SchemaTypeDef['tree'],
  schema: SchemaTypeDef
) => {
  const buf = state.buf
  if (state.bufIndex === 0) {
      buf.writeUint8(SELVA_PROTO_STRING, 0)
      buf.writeUint32LE(16, 4)
      state.bufIndex += 8 // selva_proto_string

      // modify_header
      const selvaId = `${schema.prefixString}${id || ''}`.padEnd(8, '\0')
      buf.write(selvaId, state.bufIndex)
      state.bufIndex += 16
  }

  for (const key in obj) {
    const leaf = tree[key]
    const value = obj[key]
    if (!leaf.type && !leaf.__isField) {
      modify(db, state, type, id, value, leaf as SchemaTypeDef['tree'], schema)
    } else {
      const t = leaf as FieldDef
      if (t.type === 'string') {
          const byteLen = Buffer.byteLength(value, 'utf8')

          buf.writeUint8(SELVA_PROTO_STRING, state.bufIndex)
          buf.writeUint32LE(32 + byteLen, state.bufIndex + 4)
          state.bufIndex += 8 // selva_proto_string

          // SelvaModifyFieldOp
          buf.writeUint8(1, state.bufIndex)
          buf.write(`${t.selvaField}`, state.bufIndex + 8)
          buf.writeBigUint64LE(32n, state.bufIndex + 16)
          buf.writeBigUint64LE(BigInt(byteLen), state.bufIndex + 24)
          buf.write(value, state.bufIndex + 32)
          state.bufIndex += 32 + byteLen
      } else if (t.type === 'number') {
          buf.writeUint8(SELVA_PROTO_STRING, state.bufIndex)
          buf.writeUint32LE(32 + 8, state.bufIndex + 4)
          state.bufIndex += 8 // selva_proto_string

          // SelvaModifyFieldOp
          buf.writeUint8(6, state.bufIndex)
          buf.write(`${t.selvaField}`, state.bufIndex + 8)
          buf.writeBigUint64LE(32n, state.bufIndex + 16)
          buf.writeBigUint64LE(8n, state.bufIndex + 24)
          buf.writeDoubleLE(value, state.bufIndex + 32)
          state.bufIndex += 32 + 8
      } else if (t.type === 'timestamp' || t.type === 'integer' || t.type === 'boolean') {
          buf.writeUint8(SELVA_PROTO_STRING, state.bufIndex)
          buf.writeUint32LE(32 + 8, state.bufIndex + 4)
          state.bufIndex += 8 // selva_proto_string

          // SelvaModifyFieldOp
          buf.writeUint8(3, state.bufIndex)
          buf.write(`${t.selvaField}`, state.bufIndex + 8)
          buf.writeBigUint64LE(32n, state.bufIndex + 16)
          buf.writeBigUint64LE(8n, state.bufIndex + 24)
          buf.writeBigInt64LE(BigInt(value), state.bufIndex + 32)
          state.bufIndex += 32 + 8
      } else if (t.type === 'reference') {
          // TODO
      } else if (t.type === 'references') {
          // TODO
      }
      state.nrChanges++
    }
  }
}

export const create = async (db: BasedDb, type: string, value: any) => {
  const def = db.schemaTypesParsed[type]
  const id = ++def.lastId
  def.total++

  // TODO We often need more frames
  // @ts-ignore
  const [frame, payload] = await db.client.newFrame(70, db.client.newSeqno())
  const state = {
      buf: payload,
      bufIndex: 0,
      nrChanges: 0,
  }
  modify(db, state, type, id, value, def.tree, def)
  payload.writeUint32LE(state.nrChanges, 8 + 12)
  // @ts-ignore
  const p = db.client.sendFrame(frame, state.bufIndex, { firstFrame: true, lastFrame: true, batch: true })
  await p // TODO We probably should parse and return errors
  return id
}

export const createBatch = async (db: BasedDb, type: string, values: any[]) => {
  const def = db.schemaTypesParsed[type]
  const cmdid = 70
  // @ts-ignore
  const seqno = db.client.newSeqno()

  await new Promise(async (resolve) => {
    const errors = []

    for (let i = 0; i < values.length; i++) {
      const value = values[i]
      //const id = ++def.lastId
      def.total++
      // @ts-ignore
      const [frame, payload] = await db.client.newFrame(cmdid, seqno)
      const state = {
          buf: payload,
          bufIndex: 0,
          nrChanges: 0,
      }
      // TODO Large modify support
      modify(db, state, type, null, value, def.tree, def)
      payload.writeUint32LE(state.nrChanges, 8 + 12)
      // @ts-ignore
      db.client.sendFrameWithCb(frame, state.bufIndex, { firstFrame: true, lastFrame: true, batch: i != values.length - 1 }, (buf: Buffer, err?: Error) => {
          if (err) {
            // TODO
            errors.push({ id: 0, err })
          }
          if (i == values.length - 1) resolve(errors)
      })
    }
  })
}

export const update = async (
  db: BasedDb,
  type: string,
  id: number,
  value: any,
  merge?: boolean
) => {
  const def = db.schemaTypesParsed[type]

  // TODO We often need more frames
  // @ts-ignore
  const [frame, payload] = await db.client.newFrame(70, db.client.newSeqno())
  const state = {
      buf: payload,
      bufIndex: 0,
      nrChanges: 0,
  }
  modify(db, state, type, id, value, def.tree, def)
  payload.writeUint32LE(state.nrChanges, 8 + 12)

  // @ts-ignore
  const p = db.client.sendFrame(frame, state.bufIndex, { firstFrame: true, lastFrame: true, batch: true })
  await p // TODO We probably should parse and return errors
}
