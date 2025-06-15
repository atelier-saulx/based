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

const db = new BasedDb({ path: t.tmp })
await db.start({ clean: true })

await db.setSchema({
  types: {
    thing: {
      props: {
        // name: 'string',
        isNice: 'boolean',
        powerLeveL: 'uint32',
        // body: {
        //   // type: 'string',
        // },
      },
    },
  },
})

const ids = []
for (let i = 0; i < 1e6; i++) {
  ids.push(db.create('thing', { isNice: !!(i % 2), powerLevel: i }))
}

console.log('set', await db.drain(), 'ms')

await db.query('thing').range(0, 1e6).filter('isNice', false).get().inspect()

await db.destroy()
