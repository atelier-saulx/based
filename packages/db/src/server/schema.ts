import { updateTypeDefs } from '@based/schema/def'
import type { DbSchema, serialize } from '@based/schema'
import { DbServer } from './index.ts'
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import native from '../native.ts'
import { SCHEMA_FILE } from '../types.ts'
import { saveSync } from './save.ts'
import { writeCreate } from '../client/modify/create/index.ts'
import { Ctx } from '../client/modify/Ctx.ts'
import { consume } from '../client/modify/drain.ts'
import { schemaToSelvaBuffer } from './schemaSelvaBuffer.ts'

export const setSchemaOnServer = (server: DbServer, schema: DbSchema) => {
  const { schemaTypesParsed, schemaTypesParsedById } = updateTypeDefs(schema)
  server.schema = schema
  server.schemaTypesParsed = schemaTypesParsed
  server.schemaTypesParsedById = schemaTypesParsedById
  server.ids = native.getSchemaIds(server.dbCtxExternal)
}

export const writeSchemaFile = async (server: DbServer, schema: DbSchema) => {
  if (server.fileSystemPath) {
    const schemaFilePath = join(server.fileSystemPath, SCHEMA_FILE)
    try {
      await writeFile(schemaFilePath, serialize(schema))
    } catch (err) {
      throw new Error(`Error writing schema to a file path ${schemaFilePath}}`)
    }
  }
}

/**
 * Set schema used in native code.
 * This function should be only called when a new schema is set to an empty DB
 * instance. If a `common.sdb` file is loaded then calling this function isn't
 * necessary because `common.sdb` already contains the required schema.
 */
export const setNativeSchema = (server: DbServer, schema: DbSchema) => {
  const types = Object.keys(server.schemaTypesParsed)
  const s = schemaToSelvaBuffer(server.schemaTypesParsed)
  let maxTid = 0
  for (let i = 0; i < s.length; i++) {
    const type = server.schemaTypesParsed[types[i]]
    maxTid = Math.max(maxTid, type.id)
    try {
      native.setSchemaType(server.dbCtxExternal, type.id, new Uint8Array(s[i]))
    } catch (err) {
      throw new Error(
        `Cannot update schema on selva (native) ${type.type} ${err.message}`,
      )
    }
  }

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

  server.verifTree.updateTypes(server.schemaTypesParsed)
  if (server.fileSystemPath) {
    saveSync(server, { skipDirtyCheck: true })
  }
}
