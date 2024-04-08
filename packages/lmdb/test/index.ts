import test from 'ava'
import { wait } from '@saulx/utils'
import { dirname } from 'node:path'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import { BasedDb, createBuffer, parseBuffer } from '../src/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))

test('create server', async (t) => {
  const path = __dirname + '/tmp'
  try {
    await fs.rmdir(path, { recursive: true })
  } catch (err) {}
  await fs.mkdir(path)

  const db = new BasedDb({
    path,
  })

  db.updateSchema({
    types: {
      vote: {
        fields: {
          vectorClock: { type: 'integer' },
          value: {
            type: 'integer',
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

  console.dir(db.schemaTypesParsed, { depth: 10 })

  // const buf = createBuffer({ value: 1e3 }, db.schemaTypesParsed.vote)

  // console.log('fix', buf)

  // console.log(parseBuffer(buf, db.schemaTypesParsed.vote))

  // const buf2 = createBuffer({ value: 1e3 }, db.schemaTypesParsed.complex)

  // console.log('fix', buf2)

  // console.log(parseBuffer(buf2, db.schemaTypesParsed.complex))

  // snurp.bla = "yuzi"

  const bufPower = createBuffer(
    { value: 666, gerp: 999, snurp: { bla: 'yuzi', ups: [1, 2, 3] } },
    db.schemaTypesParsed.complex,
  )

  console.log(parseBuffer(bufPower, db.schemaTypesParsed.complex))

  await wait(1e3)

  t.pass()
})
