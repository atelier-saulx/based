import { serialize, updateTypeDefs, type SchemaOut } from '@based/schema'
import { DbServer } from './index.js'
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import native from '../native.js'
import { SCHEMA_FILE } from '../types.js'
import { writeCreate } from '../client/modify/create/index.js'
import { Ctx } from '../client/modify/Ctx.js'
import { consume } from '../client/modify/drain.js'
import { schemaToSelvaBuffer } from './schemaSelvaBuffer.js'
import { readUint32, writeUint32 } from '@based/utils'
import { OpType } from '../zigTsExports.js'

export const setSchemaOnServer = (server: DbServer, schema: SchemaOut) => {
  const { schemaTypesParsed, schemaTypesParsedById } = updateTypeDefs(schema)
  server.schema = schema
  server.schemaTypesParsed = schemaTypesParsed
  server.schemaTypesParsedById = schemaTypesParsedById
  server.ids = native.getSchemaIds(server.dbCtxExternal)
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
    })

    native.modifyThread(msg, server.dbCtxExternal)
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

  // Init the last ids
  native.setSchemaIds(new Uint32Array(maxTid), server.dbCtxExternal)

  // Insert a root node
  if (schema.types._root) {
    const tmpArr = new Uint8Array(new ArrayBuffer(1e3, { maxByteLength: 10e3 }))
    const tmpCtx = new Ctx(schema.hash, tmpArr)
    writeCreate(tmpCtx, server.schemaTypesParsed._root, {}, null)
    const buf = consume(tmpCtx)
    server.modify(buf)
  }

  server.blockMap.updateTypes(server.schemaTypesParsed)
  if (server.fileSystemPath) {
    server.save({ skipDirtyCheck: true }).catch(console.error)
  }
}
