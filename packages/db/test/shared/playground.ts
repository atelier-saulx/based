import { wait } from '@saulx/utils'
import { fileURLToPath } from 'url'
import { BasedDb } from '../../src/index.js'
import { join, dirname, resolve } from 'path'
import fs from 'node:fs/promises'
import oldFs from 'node:fs'
import { deflate } from 'node:zlib'
import util from 'util'
const deflap = util.promisify(deflate)

import { italy } from './examples.js'
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
    // noCompression: true,
  })

  await db.start()

  console.log('\nJS GO DO BUT', Date.now(), path)

  db.putSchema({
    types: {
      bla: { props: { name: 'string', x: 'uint16', flap: 'binary' } },
    },
  })

  await db.create('bla', {
    name: 'DERP ',
    x: 1,
  })

  console.log(db.query('bla').sort('x').get())

  console.log('YO', Date.now(), path)

  await wait(100)

  console.log('CLOSE', Date.now(), path)

  var d = Date.now()
  for (let i = 0; i < 1000; i++) {
    db.create('bla', {
      name: italy,
      // flap: Buffer.from(italy, 'utf-8'),
    })
  }
  console.log('DRAIN BOI', Date.now() - d, 'ms', db.drain(), 'ms')

  console.log(db.query('bla').get())

  await db.stop(true)
}

makeDb(dbFolder + '/1')

// await Promise.all([makeDb(dbFolder + '/1'), makeDb(dbFolder + '/2')])

// const f = await fs.writeFile(dbFolder + '/file.txt', '')

// const d = Date.now()
// let bla = []
// const file = oldFs.openSync(dbFolder + '/file.txt', null)
// let b = 0
// for (let i = 0; i < 10e6; i++) {
//   bla.push({
//     name: 'bla',
//     user: 'snur@gmail.com',
//     derp: 'derp derp',
//     i,
//   })
//   b++
//   if (b === 10e3) {
//     await fs.appendFile(
//       dbFolder + '/file.txt',
//       await deflap(Buffer.from(JSON.stringify(bla), 'utf-8')),
//     )
//     b = 0
//     bla = []
//   }
// }

// console.log('DONE', Date.now() - d, 'ms')
