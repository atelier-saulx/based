import { DbServer } from './index.js'
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import native, { idGenerator } from '../native.js'
import { readUint32, writeUint32 } from '../utils/index.js'
import {
  LangCode,
  Modify,
  OpType,
  PropType,
  PropTypeSelva,
  pushSelvaSchemaHeader,
  pushSelvaSchemaMicroBuffer,
  type PropTypeEnum,
} from '../zigTsExports.js'
import {
  BLOCK_CAPACITY_DEFAULT,
  serialize,
  updateTypeDefs,
  type SchemaOut,
} from '../schema/index.js'
import { SCHEMA_FILE } from '../index.js'
import { getTypeDefs } from '../schema/defs/getTypeDefs.js'
import { AutoSizedUint8Array } from '../utils/AutoSizedUint8Array.js'

const schemaOpId = idGenerator()

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

const supportedDefaults = new Set<PropTypeEnum>([
  PropType.binary,
  PropType.string,
  PropType.text,
  PropType.vector,
  PropType.json, // same as binary (Uint8Array)
])
/**
 * Set schema used in native code.
 * This function should be only called when a new schema is set to an empty DB
 * instance. If a `common.sdb` file is loaded then calling this function isn't
 * necessary because `common.sdb` already contains the required schema.
 */
export const setNativeSchema = async (server: DbServer, schema: SchemaOut) => {
  const typeDefs = getTypeDefs(schema)
  let maxTypeId = 0
  await Promise.all(
    typeDefs.values().map((typeDef) => {
      const buf = new AutoSizedUint8Array(4, 65536)
      maxTypeId = Math.max(maxTypeId, typeDef.id)
      let nrFixedFields = 1
      let nrVirtualFields = 0

      for (const prop of typeDef.separate) {
        if (
          'default' in prop.schema &&
          prop.schema.default &&
          supportedDefaults.has(prop.type)
        ) {
          // TODO what is fixedFields exactly
          // could we make a return type in the prop.pushSelvaSchema for this?
          nrFixedFields++
        } else if (
          prop.type === PropType.reference ||
          prop.type === PropType.references
        ) {
          nrFixedFields++
        } else if (
          prop.type === PropType.alias ||
          prop.type === PropType.aliases ||
          prop.type === PropType.colVec
        ) {
          // We assume that these are always the last props!
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
        // TODO put defaults!
        prop.pushSelvaSchema(buf)
      }

      return createSelvaType(server, typeDef.id, buf.view)
    }),
  )

  await setSchemaIds(server, new Uint32Array(maxTypeId))

  if (server.fileSystemPath) {
    server.save({ skipDirtyCheck: true }).catch(console.error)
  }
}
