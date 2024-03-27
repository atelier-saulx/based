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
          snurp: {
            type: 'object',
            properties: {
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

  // const x: any = []
  // const d = Date.now()
  // const dbi = db.dbis.main
  // const bla = Buffer.from('bla')
  // const txn = db.env.beginTxn()

  let i = 0
  // for (i = 0; i < 1e9; i++) {
  // txn.putBinary(dbi, i + 'a', bla)
  // x.push([db.dbis.main, i + 'a', bla])
  const buf = createBuffer({ value: 1e3 }, db.schemaTypesParsed.vote)

  console.log('fix', buf)

  console.log(parseBuffer(buf, db.schemaTypesParsed.vote))

  const buf2 = createBuffer({ value: 1e3 }, db.schemaTypesParsed.complex)

  console.log('fix', buf2)

  console.log(parseBuffer(buf2, db.schemaTypesParsed.complex))

  // x.push({
  //   type: 'vote',
  //   value: {
  //     value: i,
  //     vectorClock: i,
  //   },
  // })
  // }
  // txn.commit()

  // await write()

  // await db.set(x)
  // console.log(i, Date.now() - d, 'ms', 'to set 1000k')

  await wait(1e3)

  t.pass()
})
