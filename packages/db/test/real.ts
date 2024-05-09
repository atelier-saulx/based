import test from 'ava'
import { wait } from '@saulx/utils'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import { BasedDb, readSchemaTypeDefFromBuffer } from '../src/index.js'
import newClient from '../src/selvad-client/index.js'
import { create, update } from '../src/set2.js'
import { decodeMessageWithValues } from '../src/selvad-client/proto-value.js';
import { join, dirname, resolve } from 'path'

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

  // @ts-ignore
  db.client = newClient(3000, '127.0.0.1')
  db.native = {
    modify: (buff: Buffer, len: number) => {
      console.log('lullz flush buffer', len)
    },
    getQuery: (...args) => {
      console.log('lullllz', args)
      return Buffer.allocUnsafe(0)
    },
  }

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
  const schemaHead = Buffer.alloc(2 * 8)
  schemaHead.writeUInt8(5, 0)
  schemaHead.writeUInt8(1, 4)
  schemaHead.writeUInt8(4, 8)
  schemaHead.writeUint32LE(db.schemaTypesParsed.simple.buf.length, 8 + 4)
  // @ts-ignore
  const schemaResp = decodeMessageWithValues(await db.client.sendRequest(36, Buffer.concat([schemaHead, db.schemaTypesParsed.simple.buf])))
  console.log('schema write:', schemaResp)
  // @ts-ignore
  console.log('schema read:', await db.client.sendRequest(37));

  console.log(
    'SCHEMA',
    db.schemaTypesParsed.simple.cnt,
    // 66 length
    db.schemaTypesParsed.simple.buf,
    db.schemaTypesParsed.simple.fieldNames
  )

  console.log(
    'SCHEMA BACK',
    readSchemaTypeDefFromBuffer(
      db.schemaTypesParsed.simple.buf,
      db.schemaTypesParsed.simple.fieldNames
    ).cnt
  )

  const refs = []
  for (let i = 1; i < 10 - 1; i++) {
    refs.push(i)
  }

  var dx = Date.now()
  console.log('GO!')

  const p = []
  //for (let i = 0; i < 1e6 - 1; i++) {
  for (let i = 0; i < 1e3 - 1; i++) {
    p.push(create(db, 'simple', {
      //user: i,
      // refs: [0, 1, 2], //generateRandomArray(),
      // flap: 'AMAZING 123',
      // flap: 'my flap flap flap 1 epofjwpeojfwe oewjfpowe sepofjw pofwejew op mwepofjwe opfwepofj poefjpwofjwepofj wepofjwepofjwepofjwepofjwepofjwpo wepofj wepofjwepo fjwepofj wepofjwepofjwepofjwepofjc pofjpoejfpweojfpowefjpwoe fjewpofjwpo',
      vectorClock: i % 4,
      location: {
        long: 52,
        lat: 52,
      },
    }))
    if (i % 1000 === 0) await wait(0)
  }
  await Promise.all(p)

  // { set Id, amount: 10 } , checksum

  await wait(0)
  console.log(Date.now() - dx, 'ms')

  // orderded DBIs
  // in mem in DB add if query is active this will also create DBIS for SORTING if required

  // READ CACHE SIZE []

  const d = Date.now()
  const ids = db
    .query('simple')
    .filter(['vectorClock', '>', 1])
    // .filter(['refs', 'has', [2]])
    // .or(['refs', 'has', [1234]])
    // .sort('vectorClock', 'asc')
    .range(0, 1000)
    .get()

  console.info('query result ==', ids, Date.now() - d, 'ms')

  t.true(true)
})
