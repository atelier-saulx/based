import { DbServer } from './index.js'
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import {
  LangCode,
  Modify,
  PropTypeSelva,
  pushSelvaSchemaHeader,
  pushSelvaSchemaMicroBuffer,
} from '../zigTsExports.js'
import {
  BLOCK_CAPACITY_DEFAULT,
  serialize,
  updateTypeDefs,
  type SchemaOut,
} from '../schema/index.js'
import { SCHEMA_FILE } from '../index.js'
import { getTypeDefs, propIndexOffset } from '../schema/defs/getTypeDefs.js'
import { AutoSizedUint8Array } from '../utils/AutoSizedUint8Array.js'

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

export const makeNativeSchema = (schema: SchemaOut): Uint8Array => {
  const buf = new AutoSizedUint8Array()
  const typeDefs = getTypeDefs(schema)

  for (const typeDef of typeDefs.values()) {
    let nrFixedFields = 1
    let nrVirtualFields = 0

    buf.pushUint16(typeDef.id)
    const typeLenIndex = buf.reserveUint32()
    const startIndex = buf.length

    for (const prop of typeDef.separate) {
      const offset = propIndexOffset(prop)
      if (offset < 0) {
        nrFixedFields++
      } else if (offset > 0) {
        nrVirtualFields++
      }
    }

    pushSelvaSchemaHeader(buf, {
      blockCapacity: typeDef.schema.blockCapacity || BLOCK_CAPACITY_DEFAULT,
      nrFields: 1 + typeDef.separate.length,
      nrFixedFields,
      nrVirtualFields,
      sdbVersion: 8,
    })

    // handle main
    const mainLen = typeDef.main.reduce((len, { size }) => len + size, 0)
    pushSelvaSchemaMicroBuffer(buf, {
      type: PropTypeSelva.microBuffer,
      len: mainLen,
      hasDefault: 1,
    })

    for (const prop of typeDef.main) {
      if ('default' in prop.schema && prop.schema.default) {
        prop.pushValue(buf, prop.schema.default, Modify.create, LangCode.none)
      } else {
        buf.fill(0, buf.length, buf.length + prop.size)
      }
    }

    // handle separate
    for (const prop of typeDef.separate) {
      prop.pushSelvaSchema(buf)
    }

    buf.writeUint32(buf.length - startIndex, typeLenIndex)
  }

  return buf.view
}
