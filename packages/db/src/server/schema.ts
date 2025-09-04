import { schemaToSelvaBuffer, updateTypeDefs } from '@based/schema/def'
import { DbSchema, getPropType, serialize, StrictSchema } from '@based/schema'
import { deepCopy } from '@based/utils'
import { DbServer } from './index.js'
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import native from '../native.js'
import { SCHEMA_FILE } from '../types.js'
import { saveSync } from './save.js'
import { hash } from '@based/hash'
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

  delete dbSchema.hash
  dbSchema.hash = hash(dbSchema)

  return dbSchema
}
