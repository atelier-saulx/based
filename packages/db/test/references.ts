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

  db.drain()
})
