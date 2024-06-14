import test from 'ava'
import { wait } from '@saulx/utils'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import { BasedDb, readSchemaTypeDefFromBuffer } from '../src/index.js'
import { join, dirname, resolve } from 'path'
import { createRequire } from "node:module"
const selva = createRequire(import.meta.url)("../../build/libselva.node")

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

test.serial.only('query + filter', async (t) => {
  try {
    await fs.rm(dbFolder, { recursive: true })
  } catch (err) {}
  await fs.mkdir(dbFolder)
  const db = new BasedDb({
    path: dbFolder,
  })

  const dbp = selva.db_create()
  db.native = {
    modify: (buff: Buffer, len: number) => {
      console.log('lullz flush buffer', len)
    },
    getQuery: (...args) => {
      console.log('lullllz', args)
      return Buffer.allocUnsafe(0)
    },
  }
  await wait(1)

  db.updateSchema({
    types: {
      simple: {
        prefix: 'aa',
        fields: {
          flap: { type: 'string' },
          refs: { type: 'references', allowedTypes: ['user'] },
          user: { type: 'reference', allowedTypes: ['user'] },
          vectorClock: { type: 'integer' },
          location: {
            type: 'object',
            properties: {
              long: { type: 'number' },
              lat: { type: 'number' },
            },
          },
        },
      },
    },
  })

  console.log(
    'SCHEMA',
    db.schemaTypesParsed.simple.cnt,
    // 66 length
    db.schemaTypesParsed.simple.selvaBuf,
    db.schemaTypesParsed.simple.fieldNames,
  )
  console.log('schema update', selva.db_schema_update(dbp, 0, db.schemaTypesParsed.simple.selvaBuf))
    console.dir(db.schemaTypesParsed.simple, { depth: 100 })

  //console.log(
  //  'SCHEMA BACK',
  //  readSchemaTypeDefFromBuffer(
  //    db.schemaTypesParsed.simple.buf,
  //    db.schemaTypesParsed.simple.fieldNames,
  //  ).cnt,
  //)

  const refs = []
  for (let i = 1; i < 10 - 1; i++) {
    refs.push(i)
  }

  var dx = Date.now()
  console.log('GO!')

  const p = []
  for (let i = 0; i < 1e6 - 1; i++) {
    const node = {
      //user: i,
      // refs: [0, 1, 2], //generateRandomArray(),
      // flap: 'AMAZING 123',
      // flap: 'my flap flap flap 1 epofjwpeojfwe oewjfpowe sepofjw pofwejew op mwepofjwe opfwepofj poefjpwofjwepofj wepofjwepofjwepofjwepofjwepofjwpo wepofj wepofjwepo fjwepofj wepofjwepofjwepofjwepofjc pofjpoejfpweojfpowefjpwoe fjewpofjwpo',
      vectorClock: i % 4,
      location: {
        long: 52,
        lat: 52,
      },
    }
    //selva.db_update(dbp, 0, i, buf)
  }

  console.log(Date.now() - dx, 'ms')

  // orderded DBIs
  // in mem in DB add if query is active this will also create DBIS for SORTING if required

  // READ CACHE SIZE []

  //const d = Date.now()
  //const ids = db
  //  .query('simple')
  //  .filter('vectorClock', '>', 1)
  //  // .filter(['refs', 'has', [2]])
  //  // .or(['refs', 'has', [1234]])
  //  // .sort('vectorClock', 'asc')
  //  .range(0, 1000)
  //  .get()

  //console.info('query result ==', ids, Date.now() - d, 'ms')

  t.true(true)
})
