import { wait } from '@based/utils'
import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { Worker } from 'node:worker_threads'
await test.skip('instantModify', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => db.destroy())

  await db.setSchema({
    locales: {
      en: {},
      it: { fallback: 'en' },
      fi: { fallback: 'en' },
    },
    types: {
      country: {
        name: 'alias',
        displayName: 'string',
        voteType: ['sms_text', 'sms_suffix', 'online', 'call_suffix'],
        dialCode: 'uint16',
        maxVotes: 'uint8',
        isTerritoryOf: {
          ref: 'country',
          prop: 'overseasTerritories',
        },
        price: 'uint16',
        destination: 'string',
        votingText: 'string',
        votingLegal: 'string',
        broadcaster: 'string',
        privacyUrl: 'string',
      },
    },
  })

  let i = 100
  let id = 1
  const items = []
  while (i--) {
    const item = {
      name: 'alias',
      displayName: 'string',
      voteType: ['sms_text', 'sms_suffix', 'online', 'call_suffix'][
        ~~(Math.random() * 3)
      ],
      dialCode: i,
      maxVotes: 20,
      // isTerritoryOf: {
      //   ref: 'country',
      //   prop: 'overseasTerritories',
      // },
      price: i,
      destination: 'string',
      votingText: 'string',
      votingLegal: 'string',
      broadcaster: 'string',
      privacyUrl: 'string',
    }

    items.push({
      id: id++,
      item,
    })

    db.create('country', item)
  }

  await db.drain()
  await db.save()

  // now capture the updates
  const updates = []
  // @ts-ignore
  db.client.hooks.flushModify = (buf) => {
    updates.push(new Uint8Array(buf))
    return Promise.resolve({ offsets: {} })
  }

  for (const { id, item } of items) {
    db.update('country', id, {
      ...item,
      displayName: 'update ' + id,
    })
  }

  await db.drain()
  // await db.stop()

  const db2 = new BasedDb({
    path: t.tmp,
  })
  t.after(() => db2.destroy())

  const __dirname = dirname(fileURLToPath(import.meta.url))
  const wPath = join(__dirname, `../src/server/worker.js`)
  const worker = new Worker(wPath, {
    workerData: {
      nothing: true,
    },
  })
  let j = 1000
  await db2.start()
  while (j--) {
    // db2.query('country').get().toObject()
    for (const update of updates) {
      db2.server.modify(update)
    }
  }

  // console.log('AFTER:', await db2.query('country').get().toObject())
  await db2.destroy()
})
