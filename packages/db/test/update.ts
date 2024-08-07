import test from 'ava'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import { BasedDb } from '../src/index.js'
import { join, dirname, resolve } from 'path'

import dbZig from '../src/db.js'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

test.serial('update', async (t) => {
  try {
    await fs.rm(dbFolder, { recursive: true })
  } catch (err) {}

  await fs.mkdir(dbFolder)

  const db = new BasedDb({
    path: dbFolder,
    // maxModifySize: 1024 * 1024 * 1000,
  })

  db.updateSchema({
    types: {
      mep: {
        fields: {
          a: { type: 'integer' },
          // @ts-ignore
          countryCode: { type: 'string', maxBytes: 10 },
          b: { type: 'integer' },
          c: { type: 'integer' },
        },
      },
      snurp: {
        fields: {
          a: { type: 'integer' },
          // @ts-ignore
          countryCode: { type: 'string', maxBytes: 2 },
          b: { type: 'integer' },
          c: { type: 'integer' },
          name: { type: 'string' },
          email: { type: 'string' },
          nested: {
            type: 'object',
            properties: {
              // @ts-ignore
              derp: { type: 'string', maxBytes: 1 },
            },
          },
        },
      },
    },
  })

  // const snurp = db.create('snurp', {
  //   // name: 'mr snurp',
  //   // email: 'snurp@snurp.snurp',
  //   a: 1,
  //   // b: 2,
  //   // c: 3,
  //   // countryCode: 'NL',
  // })

  // const snurp2 = db.create('snurp', {
  //   name: 'mr snurp 2',
  // })

  // db.drain()

  // t.deepEqual(db.query('snurp').get().data.toObject(), [
  //   {
  //     a: 1,
  //     b: 2,
  //     c: 3,
  //     countryCode: 'NL',
  //     email: 'snurp@snurp.snurp',
  //     id: 1,
  //     name: 'mr snurp',
  //     nested: {
  //       derp: '',
  //     },
  //   },
  //   {
  //     a: 0,
  //     b: 0,
  //     c: 0,
  //     email: '',
  //     countryCode: '',
  //     id: 2,
  //     name: 'mr snurp 2',
  //     nested: {
  //       derp: '',
  //     },
  //   },
  // ])

  // db.update('snurp', snurp, {
  //   name: 'mr snurp!',
  //   nested: {
  //     derp: 'a',
  //   },
  // })

  // db.update('snurp', snurp2, {
  //   name: 'mr snurp 2!',
  //   nested: {
  //     derp: 'b',
  //   },
  // })
  // db.drain()

  const d = Date.now()

  for (let i = 0; i < 10e6; i++) {
    db.create(
      'snurp',
      {
        name: 'mr flap flapperpants ewdknwelkdn welkdhwedlkwehd ewlkd ' + i,
        // a: i,
      },
      // true,
      // false,
      // false,
      // true,
    )
  }
  // check speed
  db.drain()

  console.log('DONE', Date.now() - d, 'ms')

  console.log(await fs.stat(join(__dirname, '../tmp/data.mdb')))

  // const d = Date.now()

  // db.update(
  //   'snurp',
  //   snurp,
  //   {
  //     a: 66,
  //   },
  //   // true,
  //   false,
  //   // false,
  //   // true,
  // )

  // fix
  // console.log('\n\nGO GO GO')
  // for (let i = 3; i < 1 + 1; i++) {
  //   // 5.12820512821 slower...
  //   // going to do with premade main buffer...
  //   // fill in the gaps
  //   // inverts the info
  //   // check if all
  //   db.update(
  //     'snurp',
  //     i,
  //     {
  //       a: i,
  //     },
  //     // true,
  //     true,
  //     // false,
  //     // true,
  //   )
  // }

  // db.drain()

  dbZig.stat()
  t.true(true)
  // process.exit()

  // console.log('DONE', Date.now() - d, 'ms')

  // console.log(db.query('snurp').get())

  // t.true(true)

  // t.deepEqual(db.query('snurp').get().data.toObject(), [
  //   {
  //     a: 1,
  //     b: 2,
  //     c: 3,
  //     countryCode: 'NL',
  //     email: 'snurp@snurp.snurp',
  //     id: 1,
  //     name: 'mr snurp!',
  //     nested: {
  //       derp: 'a',
  //     },
  //   },
  //   {
  //     a: 0,
  //     b: 0,
  //     c: 0,
  //     countryCode: '',
  //     email: '',
  //     id: 2,
  //     name: 'mr snurp 2!',
  //     nested: {
  //       derp: 'b',
  //     },
  //   },
  // ])
})
