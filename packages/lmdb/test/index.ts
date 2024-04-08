import test from 'ava'
import { wait } from '@saulx/utils'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import { BasedDb, createBuffer, parseBuffer } from '../src/index.js'
import { join, dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))

const relativePath = '../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

test('create server', async (t) => {
  try {
    await fs.rmdir(dbFolder, { recursive: true })
  } catch (err) {}
  await fs.mkdir(dbFolder)

  const db = new BasedDb({
    path: dbFolder,
  })

  db.updateSchema({
    types: {
      vote: {
        fields: {
          refs: { type: 'references' },
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
      complex: {
        fields: {
          flap: {
            type: 'integer',
          },
          value: {
            type: 'integer',
          },
          nip: {
            type: 'string',
          },
          mep: {
            type: 'number',
          },
          created: {
            type: 'timestamp',
          },
          updated: {
            type: 'timestamp',
          },
          gerp: {
            type: 'reference',
            allowedTypes: ['vote'],
          },
          snurp: {
            type: 'object',
            properties: {
              ups: { type: 'references', allowedTypes: ['vote'] },
              derp: { type: 'integer' },
              bla: { type: 'string' },
              hup: {
                type: 'object',
                properties: {
                  start: {
                    type: 'timestamp',
                  },
                  x: { type: 'integer' },
                  isDope: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
  })

  // const buf = createBuffer({ value: 1e3 }, db.schemaTypesParsed.vote)

  // console.log('fix', buf)

  // console.log(parseBuffer(buf, db.schemaTypesParsed.vote))

  // const buf2 = createBuffer({ value: 1e3 }, db.schemaTypesParsed.complex)

  // console.log('fix', buf2)

  // console.log(parseBuffer(buf2, db.schemaTypesParsed.complex))

  // snurp.bla = "yuzi"

  // const bufPower = createBuffer(
  //   0,
  //   { value: 666, gerp: 999, snurp: { bla: 'yuzi', ups: [1, 2, 3] } },
  //   db.schemaTypesParsed.complex,
  // )

  // for (const key in bufPower) {
  //   bufPower[key] = bufPower[key].slice(6)
  // }

  // console.log(parseBuffer(bufPower, db.schemaTypesParsed.complex))

  const id = db.create('complex', {
    value: 666,
    nip: 'FRANKO!',
    gerp: 999,
    snurp: { bla: 'yuzi', ups: [1, 2, 3, 4, 5] },
  })

  console.log(id)

  console.info(db.get('complex', id))

  const arr = []
  for (let i = 0; i < 1e4; i++) {
    arr.push(i)
  }

  const id2 = db.create('vote', {
    user: 1,
    vectorClock: 20,
    location: {
      long: 52.0123,
      lat: 52.213,
    },
    refs: arr,
  })

  console.info(db.get('vote', id2))

  await wait(2e3)

  t.pass()
})
