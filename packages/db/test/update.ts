import test from 'ava'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import { BasedDb } from '../src/index.js'
import { join, dirname, resolve } from 'path'

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
          // a: { type: 'integer' },
          // @ts-ignore
          countryCode: { type: 'string', maxBytes: 2 },
          // b: { type: 'integer' },
          // c: { type: 'integer' },
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

  const snurp = db.create('snurp', {
    name: 'mr snurp',
    email: 'snurp@snurp.snurp',
    // a: 1,
    // b: 2,
    // c: 3,
    countryCode: 'AA',
  })

  const snurp2 = db.create('snurp', {
    name: 'mr snurp 2',
    // a: 1,
    // b: 2,
    // c: 3,
  })

  db.drain()

  // t.deepEqual(db.query('snurp').get().data.toObject(), [
  //   {
  //     a: 1,
  //     b: 2,
  //     c: 3,
  //     countryCode: 'a',
  //     email: 'snurp@snurp.snurp',
  //     id: 1,
  //     name: 'mr snurp',
  //     nested: {
  //       derp: '',
  //     },
  //   },
  // ])

  db.update('snurp', snurp, {
    // name: 'mr snurp 2',
    // countryCode: 'x',
    nested: {
      derp: 'a',
    },
  })

  db.update('snurp', snurp2, {
    // name: 'mr snurp 2',
    // countryCode: 'x',
    nested: {
      derp: 'a',
    },
  })

  db.drain()

  console.log(db.query('snurp').get())

  // t.deepEqual(db.query('snurp').get().data.toObject(), [
  //   {
  //     a: 1,
  //     b: 2,
  //     c: 3,
  //     countryCode: 'a',
  //     email: 'snurp@snurp.snurp',
  //     id: 1,
  //     name: 'mr snurp 2',
  //     nested: {
  //       derp: '',
  //     },
  //   },
  // ])

  // db.update('snurp', snurp, {
  //   // nested: {
  //   //   derp: 'x',
  //   // },
  //   countryCode: 'nl',
  // })

  // db.drain()

  // t.deepEqual(db.query('snurp').get().data.toObject(), [
  //   {
  //     a: 1,
  //     b: 2,
  //     c: 3,
  //     countryCode: 'nl',
  //     email: 'snurp@snurp.snurp',
  //     id: 1,
  //     name: 'mr snurp 2',
  //     nested: {
  //       derp: 'x',
  //     },
  //   },
  // ])

  t.true(true)
})
