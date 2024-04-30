import test from 'ava'
import { wait } from '@saulx/utils'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import { BasedDb } from '../src/index.js'
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

  db.native = {
    modify: (buff: Buffer, len: number) => {
      console.log('lullz flush buffer', len)
    },
    getQuery: (...args) => {
      console.log('lullllz', args)
    },
  }

  db.updateSchema({
    types: {
      simple: {
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

  const refs = []
  for (let i = 1; i < 10 - 1; i++) {
    refs.push(i)
  }

  var dx = Date.now()
  console.log('GO!')

  for (let i = 0; i < 100e6 - 1; i++) {
    db.create('simple', {
      user: i,
      // refs: [0, 1, 2], //generateRandomArray(),
      // flap: 'AMAZING 123',
      // flap: 'my flap flap flap 1 epofjwpeojfwe oewjfpowe sepofjw pofwejew op mwepofjwe opfwepofj poefjpwofjwepofj wepofjwepofjwepofjwepofjwepofjwpo wepofj wepofjwepo fjwepofj wepofjwepofjwepofjwepofjc pofjpoejfpweojfpowefjpwoe fjewpofjwpo',
      vectorClock: i % 4,
      location: {
        long: 52,
        lat: 52,
      },
    })
  }

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
