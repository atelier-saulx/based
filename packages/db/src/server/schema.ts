import { DbServer } from './index.js'
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import native from '../native.js'
import { SCHEMA_FILE } from '../types.js'
import { saveSync } from './save.js'
import { schemaToSelvaBuffer } from './schemaSelvaBuffer.js'
import { schemaToTypeDefs, serialize, type SchemaOut } from '@based/schema'

export const setSchemaOnServer = (server: DbServer, schema: SchemaOut) => {
  server.schema = schema
  server.defs = schemaToTypeDefs(schema)
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

/**
 * Set schema used in native code.
 * This function should be only called when a new schema is set to an empty DB
 * instance. If a `common.sdb` file is loaded then calling this function isn't
 * necessary because `common.sdb` already contains the required schema.
 */
export const setNativeSchema = (server: DbServer) => {
  const types = Object.keys(server.defs.byName)
  const s = schemaToSelvaBuffer(server.defs.byName)
  console.log(s)
  let maxTid = 0
  for (let i = 0; i < s.length; i++) {
    const type = server.defs.byName[types[i]]
    maxTid = Math.max(maxTid, type.id)
    console.log(type.id, new Uint8Array(s[i]))
    try {
      native.setSchemaType(server.dbCtxExternal, type.id, new Uint8Array(s[i]))
    } catch (err) {
      throw new Error(
        `Cannot update schema on selva (native) ${type.name} ${err.message}`,
      )
    }
  }

  // Init the last ids
  native.setSchemaIds(new Uint32Array(maxTid), server.dbCtxExternal)

  server.verifTree.updateTypes(server.defs.byName)
  if (server.fileSystemPath) {
    saveSync(server, { skipDirtyCheck: true })
  }
}
