import { schemaToSelvaBuffer, updateTypeDefs } from '@based/schema/def'
import { deepCopy, writeUint64 } from '@based/utils'
import { getPropType, serialize, StrictSchema } from '@based/schema'
import { DbServer } from './index.js'
import { DbSchema } from '../schema.js'
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import native from '../native.js'
import { makeTreeKey } from './tree.js'
import { SCHEMA_FILE } from '../types.js'
import { saveSync } from './save.js'
import { hash } from '@saulx/hash'

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

export const setNativeSchema = (server: DbServer, schema: DbSchema) => {
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
    const blockKey = makeTreeKey(1, 1)
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
    //server.verifTree = new VerifTree(.schemaTypesParsed)
  }

  server.verifTree.updateTypes(server.schemaTypesParsed)
  if (server.fileSystemPath) {
    saveSync(server, { skipDirtyCheck: true })
  }
}

export const strictSchemaToDbSchema = (schema: StrictSchema): DbSchema => {
  // @ts-ignore
  let dbSchema: DbSchema = deepCopy(schema)

  // reserve 1 for root (even if you dont have it)
  dbSchema.lastId = 1

  if (dbSchema.props) {
    for (const key in dbSchema.props) {
      const prop = dbSchema.props[key]
      const propType = getPropType(prop)
      let refProp: any

      if (propType === 'reference') {
        refProp = prop
      } else if (propType === 'references') {
        refProp = prop.items
        prop.items = refProp
      }

      if (refProp) {
        const type = dbSchema.types[refProp.ref]
        const inverseKey = '_' + key
        dbSchema.types[refProp.ref] = {
          ...type,
          props: {
            ...type.props,
            [inverseKey]: {
              items: {
                ref: '_root',
                prop: key,
              },
            },
          },
        }
        refProp.prop = inverseKey
      }
    }

    dbSchema.types ??= {}
    // @ts-ignore This creates an internal type to use for root props
    dbSchema.types._root = {
      id: 1,
      props: dbSchema.props,
    }
    delete dbSchema.props
  }

  for (const field in dbSchema.types) {
    if (!('id' in dbSchema.types[field])) {
      dbSchema.lastId++
      dbSchema.types[field].id = dbSchema.lastId
    }
  }

  const { hash: _, ...rest } = dbSchema
  dbSchema.hash = hash(rest)

  return dbSchema
}
