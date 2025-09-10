import { schemaToSelvaBuffer, updateTypeDefs } from '@based/schema/def'
import { DbSchema, serialize } from '@based/schema'
import { DbServer } from './index.js'
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import native from '../native.js'
import { SCHEMA_FILE } from '../types.js'
import { saveSync } from './save.js'
import { writeCreate } from '../client/modify/create/index.js'
import { Ctx } from '../client/modify/Ctx.js'
import { consume } from '../client/modify/drain.js'

export const setSchemaOnServer = (server: DbServer, schema: DbSchema) => {
  const { schemaTypesParsed, schemaTypesParsedById } = updateTypeDefs(schema)
  server.schema = schema
  server.schemaTypesParsed = schemaTypesParsed
  server.schemaTypesParsedById = schemaTypesParsedById
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
      native.setSchemaType(type.id, new Uint8Array(s[i]), server.dbCtxExternal)
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
