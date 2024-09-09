import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import { BasedDb } from '../src/index.js'
import { join, dirname, resolve } from 'path'
import test from './shared/test.js'
import { deepEqual, equal } from './shared/assert.js'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

await test('simple', async (t) => {
  try {
    await fs.rm(dbFolder, { recursive: true })
  } catch (err) {}

  const db = new BasedDb({
    path: dbFolder,
  })

  await db.start()

  t.after(() => {
    return db.destroy()
  })

  db.updateSchema({
    types: {
      user: {
        fields: {
          name: { type: 'string' },
          articles: {
            type: 'references',
            allowedType: 'article',
            inverseProperty: 'contributors',
          },
        },
      },
      article: {
        fields: {
          name: { type: 'string' },
          contributors: {
            type: 'references',
            allowedType: 'user',
            inverseProperty: 'articles',
          },
        },
      },
    },
  })

  const mrSnurp = db.create('user', {
    name: 'Mr snurp',
  })

  const flippie = db.create('user', {
    name: 'Flippie',
  })

  db.drain()

  const strudelArticle = db.create('article', {
    name: 'The wonders of Strudel',
    contributors: [mrSnurp],
  })

  const piArticle = db.create('article', {
    name: 'Apple Pie is a Lie',
    contributors: [mrSnurp, flippie],
  })

  db.drain()

  deepEqual(db.query('article').include('contributors.name').get().toObject(), [
    // FIXME the contributors should be returned
    { id: strudelArticle },
    { id: piArticle },
  ])
})

await test('one to many', async (t) => {
  try {
    await fs.rm(dbFolder, { recursive: true })
  } catch (err) {}

  const db = new BasedDb({
    path: dbFolder,
  })

  await db.start()

  t.after(() => {
    return db.destroy()
  })

  db.updateSchema({
    types: {
      user: {
        fields: {
          uid: { type: 'integer' },
          name: { type: 'string' },
          resources: {
            type: 'references',
            allowedType: 'resource',
            inverseProperty: 'owner',
          },
        },
      },
      resource: {
        fields: {
          type: { type: 'integer' },
          name: { type: 'string' },
          owner: {
            type: 'reference',
            allowedType: 'user',
            inverseProperty: 'resources',
          },
        },
      },
    },
  })

  const ownerId = db.create('user', {
    uid: 10,
    name: 'toor',
  })
  db.drain()

  for (let i = 0; i < 4; i++) {
    db.create('resource', {
      type: i % 2,
      name: `thing ${i}`,
      owner: ownerId
    })
  }
  db.drain()

  deepEqual(db.query('user').include('resources').get().toObject(), [
    {
      id: 1,
      resources: [
        {
          id: 0,
          type: 0,
          name: 'thing 0',
        },
        {
          id: 1,
          type: 1,
          name: 'thing 1',
        },
        {
          id: 2,
          type: 0,
          name: 'thing 2',
        },
        {
          id: 3,
          type: 1,
          name: 'thing 3',
        },
      ],
    },
  ])
  deepEqual(db.query('user').include('resources.name').get().toObject(), [
    {
      id: 1,
      resources: [
        {
          id: 0,
          name: 'thing 0',
        },
        {
          id: 1,
          name: 'thing 1',
        },
        {
          id: 2,
          name: 'thing 2',
        },
        {
          id: 3,
          name: 'thing 3',
        },
      ],
    },
  ])
})
