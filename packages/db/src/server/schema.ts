import { schemaToSelvaBuffer, updateTypeDefs } from '@based/schema/def'
import { DbServer } from './index.js'
import { DbSchema } from '../schema.js'
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import native from '../native.js'
import { initCsmt, makeCsmtKey } from './tree.js'
import { writeUint64 } from '@saulx/utils'
import { SCHEMA_FILE } from '../types.js'

export const setSchemaOnServer = (server: DbServer, schema: DbSchema) => {
  server.schema = schema
  server.schemaTypesParsed = {}
  server.schemaTypesParsedById = {}
  updateTypeDefs(schema, server.schemaTypesParsed, server.schemaTypesParsedById)
}

export const writeSchemaFile = async (server: DbServer, schema: DbSchema) => {
  const schemaFilePath = join(server.fileSystemPath, SCHEMA_FILE)
  try {
    await writeFile(schemaFilePath, JSON.stringify(schema))
  } catch (err) {
    throw new Error(`Error writing schema to a file path ${schemaFilePath}}`)
  }
}

export const setNativeSchema = async (server: DbServer, schema: DbSchema) => {
  const types = Object.keys(server.schemaTypesParsed)
  const s = schemaToSelvaBuffer(server.schemaTypesParsed)
  for (let i = 0; i < s.length; i++) {
    const type = server.schemaTypesParsed[types[i]]
    try {
      native.updateSchemaType(
        type.id,
        new Uint8Array(s[i]),
        server.dbCtxExternal,
      )
    } catch (err) {
      throw new Error(
        `Cannot update schema on selva (native) ${type.type} ${err.message}`,
      )
    }
  }

  // Insert a root node
  if (schema.types._root) {
    // TODO fix server add it in schema at least
    const data = [2, 1, 0, 0, 0, 1, 9, 1, 0, 0, 0, 7, 1, 0, 1]
    const blockKey = makeCsmtKey(1, 1)
    const buf = new Uint8Array(8 + data.length + 2 + 8 + 4)
    const view = new DataView(buf.buffer, 0, buf.byteLength)
    // set schema hash
    writeUint64(buf, server.schema.hash, 0)
    // add content
    buf.set(data, 8)
    // add typesLen
    view.setFloat64(8 + data.length, 0, true)
    // add dirty key
    view.setFloat64(8 + data.length + 2, blockKey, true)
    // add dataLen
    view.setUint32(buf.length - 4, data.length, true)
    server.modify(buf)
    initCsmt(server)
  }
}
