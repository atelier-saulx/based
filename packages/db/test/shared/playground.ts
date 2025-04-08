import { wait } from '@saulx/utils'
import { homedir } from 'os'
import { fileURLToPath } from 'url'
import { BasedDb, compress } from '../../src/index.js'
import { join, dirname, resolve } from 'path'
import fs from 'node:fs/promises'
import oldFs from 'node:fs'
import { italy } from './examples.js'
import { pipeline } from 'node:stream/promises'
import { hash } from '@saulx/hash'
const italyWikipedia = compress(italy)
import test from './test.js'

await test('long running', async (t) => {
  const db = new BasedDb({ path: t.tmp })
  await db.start({ clean: true })

  await db.setSchema({
    types: {
      user: {
        props: {
          isNice: 'boolean',
          powerLevel: 'uint32',
        },
      },
    },
  })

  const ids = []
  for (let i = 0; i < 1e6; i++) {
    ids.push(db.create('user', { isNice: !!(i % 2), powerLevel: i }))
  }

  console.log('set', await db.drain(), 'ms')

  await db.query('user').range(0, 1e6).filter('isNice', false).get().inspect()

  await db.destroy()
  // let scenario1 = 0
  // let scenario2 = 0
  // let scenario3 = 0

  // setInterval(async () => {
  //   const scenario = Math.random()
  //   const index = Math.floor(Math.random() * ids.length)
  //   const id = ids[index]

  //   // await db.query('user', id).get()
  //   if (scenario > 0.5) {
  //     db.update('user', id, { isNice: Math.random() > 0.5 })
  //     await db.query('user', id).get()
  //     scenario1++
  //   } else if (scenario > 0.25) {
  //     db.delete('user', id)
  //     ids[index] = db.create('user', { isNice: Math.random() > 0.5 })
  //     scenario2++
  //   } else {
  //     await db.query('user').get()
  //     scenario3++
  //   }
  // }, 0)

  // setInterval(async () => {
  //   console.log({ scenario1, scenario2, scenario3 })
  // }, 1e3)

  // while (true) {
  //   await wait(1e4)
  // }
})
