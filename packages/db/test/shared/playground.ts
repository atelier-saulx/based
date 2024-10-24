import { wait } from '@saulx/utils'
import { fileURLToPath } from 'url'
import { BasedDb } from '../../src/index.js'
import { join, dirname, resolve } from 'path'
import fs from 'node:fs/promises'
// import { italy } from './examples.js'
// import * as q from '../../src/query/query.js'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

await wait(100)

try {
  await fs.rm(dbFolder, { recursive: true })
} catch (err) {}

// dbFolder

const makeDb = async (path: string) => {
  const db = new BasedDb({
    path,
  })

  await db.start()

  console.log('\nJS GO DO BUT')

  db.putSchema({
    types: {
      bla: { props: { name: 'string' } },
    },
  })

  await db.create('bla', {
    name: 'DERP ',
  })

  console.log(db.query('bla').get())

  console.log('YO')

  await wait(100)

  await db.stop()
}

await Promise.all([makeDb(dbFolder + '/1'), makeDb(dbFolder + '/2')])
