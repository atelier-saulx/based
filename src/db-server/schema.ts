import { DbServer } from './index.js'
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import native, { idGenerator } from '../native.js'
import { schemaToSelvaBuffer } from './schemaSelvaBuffer.js'
import { readUint32, writeUint32 } from '../utils/index.js'
import { OpType } from '../zigTsExports.js'
import { serialize, updateTypeDefs, type SchemaOut } from '../schema/index.js'
import { SCHEMA_FILE } from '../index.js'

const schemaOpId = idGenerator()

async function getSchemaIds(db: DbServer): Promise<Uint32Array> {
  const id = schemaOpId.next().value
  const msg = new Uint8Array(5)

  writeUint32(msg, id, 0)
  msg[4] = OpType.getSchemaIds

  return new Promise<Uint32Array>((resolve) => {
    db.addOpOnceListener(OpType.getSchemaIds, id, (buf: Uint8Array) => {
      const ids = new Uint32Array(buf.length / Uint32Array.BYTES_PER_ELEMENT)
      const tmp = new Uint8Array(ids.buffer)
      tmp.set(buf)
      resolve(ids)
    })
    native.query(msg, db.dbCtxExternal)
  })
}

function setSchemaIds(db: DbServer, ids: Uint32Array): Promise<void> {
  const id = schemaOpId.next().value

  const msg = new Uint8Array(5 + ids.byteLength)

  writeUint32(msg, id, 0)
  msg[4] = OpType.setSchemaIds
  msg.set(new Uint8Array(ids.buffer, ids.byteOffset), 5)

  return new Promise<void>((resolve) => {
    db.addOpOnceListener(OpType.setSchemaIds, id, () => {
      resolve()
    })
    native.modify(msg, db.dbCtxExternal)
  })
}

export const setSchemaOnServer = async (
  server: DbServer,
  schema: SchemaOut,
) => {
  const { schemaTypesParsed, schemaTypesParsedById } = updateTypeDefs(schema)
  server.schema = schema
  server.schemaTypesParsed = schemaTypesParsed
  server.schemaTypesParsedById = schemaTypesParsedById
}

export const writeSchemaFile = async (server: DbServer, schema: SchemaOut) => {
  if (server.fileSystemPath) {
    const schemaFilePath = join(server.fileSystemPath, SCHEMA_FILE)
    try {
      await writeFile(schemaFilePath, serialize(schema))
    } catch (err) {
      throw new Error(`Error writing schema to a file path ${schemaFilePath}}`)
    }
  }
}

export async function createSelvaType(
  server: DbServer,
  typeId: number,
  schema: Uint8Array,
): Promise<void> {
  const msg = new Uint8Array(5 + schema.byteLength)

  writeUint32(msg, typeId, 0)

  msg[4] = OpType.createType
  msg.set(schema, 5)
  return new Promise((resolve, reject) => {
    server.addOpOnceListener(OpType.createType, typeId, (buf: Uint8Array) => {
      const err = readUint32(buf, 0)
      if (err) {
        const errMsg = `Create type ${typeId} failed: ${native.selvaStrerror(err)}`
        server.emit('error', errMsg)
        reject(new Error(errMsg))
      } else {
        resolve()
      }
      server.keepRefAliveTillThisPoint(msg)
    })
    native.modify(msg, server.dbCtxExternal)
  })
}

/**
 * Set schema used in native code.
 * This function should be only called when a new schema is set to an empty DB
 * instance. If a `common.sdb` file is loaded then calling this function isn't
 * necessary because `common.sdb` already contains the required schema.
 */
export const setNativeSchema = async (server: DbServer, schema: SchemaOut) => {
  const types = Object.keys(server.schemaTypesParsed)
  const s = schemaToSelvaBuffer(server.schemaTypesParsed)
  let maxTid = 0

  await Promise.all(
    s.map(async (ab, i) => {
      const type = server.schemaTypesParsed[types[i]]
      maxTid = Math.max(maxTid, type.id)
      try {
        await createSelvaType(server, type.id, new Uint8Array(ab))
      } catch (err) {
        throw new Error(
          `Cannot update schema on selva (native) ${type.type} ${err.message}`,
        )
      }
    }),
  )

  await setSchemaIds(server, new Uint32Array(maxTid))

  if (server.fileSystemPath) {
    server.save({ skipDirtyCheck: true }).catch(console.error)
  }
}
