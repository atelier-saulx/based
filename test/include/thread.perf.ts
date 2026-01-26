import {
  fastPrng,
  readUint32,
  wait,
  writeUint32,
} from '../../src/utils/index.js'
import test from '../shared/test.js'
import { perf } from '../shared/assert.js'
import { italy } from '../shared/examples.js'
import { BasedDb } from '../../src/index.js'
import { registerQuery } from '../../src/db-client/query/registerQuery.js'
import { register } from 'module'
import native from '../../src/native.js'
import { OpType } from '../../src/zigTsExports.js'
import { styleText } from 'util'
import { registerSubscription } from '../../src/db-client/query/subscription/toByteCode.js'

await test('include', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(async () => {
    console.log('STOP SERVER')
    await db.stop(true)
  })
  //t.after(() => t.backup(db))
  t.after(() => db.stop(true))

  // single ref + edge

  await db.setSchema({
    locales: {
      en: true,
      de: { fallback: ['en'] },
      fr: { fallback: ['en'] },
      nl: { fallback: ['fr', 'en', 'de'] },
      no: true,
    },
    types: {
      simple: {
        props: {
          nr: 'uint32',
          start: 'timestamp',
          end: 'timestamp',
        },
      },
    },
  })

  console.log('SCHEMA DONE')

  const todos: number[] = []
  const rand = fastPrng(233221)

  await wait(100)
  let d = Date.now()

  // db.create('todo', {
  //   flap: 666,
  //   // name: i % 2 ? 'b' : 'a',
  //   nr: 2,
  // })

  for (let i = 0; i < 5e6; i++) {
    db.create('simple', {
      nr: 67,
      // name: i % 2 ? 'b' : 'a',
      // nr: rand(0, 10),
    })
  }

  await db.drain()

  let time = Date.now() - d
  console.log('create 5M', time, 'ms', (1000 / time) * 5e6, 'OPS per second')

  d = Date.now()
  for (let i = 0; i < 5e6; i++) {
    db.update('simple', i + 1, {
      nr: 67,
      // name: i % 2 ? 'b' : 'a',
      // nr: rand(0, 10),
    })
  }

  await db.drain()

  time = Date.now() - d

  console.log('update 5M', time, 'ms', (1000 / time) * 5e6, 'OPS per second')

  let q: any = []

  const x = db.query('simple', 1)

  registerQuery(x)

  // console.log(
  //   x.buffer,
  //   await x.get().then((v) => {
  //     console.log(v)
  //     return v
  //   }),
  //   // x.§
  // )
  // d = Date.now()

  // for (let i = 0; i < 100; i++) {
  //   //.range(0, 1)

  //   writeUint32(x.buffer!, i + 1, 8)
  //   writeUint32(x.buffer!, i + 1, 0)

  //   q.push(db.server.getQueryBuf(x.buffer!))
  // }

  // await Promise.all(q)

  // time = Date.now() - d
  // console.log('READ 5M', time, 'ms', (1000 / time) * 9 * 1e3, 'OPS per second')

  q = []
  d = Date.now()
  for (let i = 0; i < 9; i++) {
    //.range(0, 1)
    q.push(
      db
        .query('simple')
        .range(0, 5e6 + i)
        // .include('id')
        .count()
        .get(),
    )
  }

  await Promise.all(q)

  time = Date.now() - d
  console.log(
    'COUNT ALL (fast path) 5M',
    time,
    'ms',
    (1000 / time) * 1 * 9,
    'OPS per second',
  )

  d = Date.now()
  for (let i = 0; i < 5e6; i++) {
    db.delete('simple', i + 1)
  }

  await db.drain()

  time = Date.now() - d

  console.log('DEL 5M', time, 'ms', (1000 / time) * 5e6, 'OPS per second')

  d = Date.now()

  for (let i = 0; i < 1e7; i++) {
    db.create('simple', {
      nr: 67,
      start: d + i * 1e3,
      end: d + i * 1e3 + 10e3,
      // name: i % 2 ? 'b' : 'a',
      // nr: rand(0, 10),
    })
  }

  await db.drain()

  // {"all_attributes":{"_registerArt":"HRB","_registerNummer":"150148","additional_data":{"AD":true,"CD":true,"DK":true,"HD":false,"SI":true,"UT":true,"VÖ":false},"federal_state":"Hamburg","native_company_number":"Hamburg HRB 150148","registered_office":"Hamburg","registrar":"Hamburg"},"company_number":"K1101R_HRB150148","current_status":"currently registered","jurisdiction_code":"de","name":"olly UG (haftungsbeschränkt)","officers":[{"name":"Oliver Keunecke","other_attributes":{"city":"Hamburg","firstname":"Oliver","flag":"vertretungsberechtigt gemäß allgemeiner Vertretungsregelung","lastname":"Keunecke"},"position":"Geschäftsführer","start_date":"2018-02-06","type":"person"}],"registered_address":"Waidmannstraße 1, 22769 Hamburg.","retrieved_at":"2018-11-09T18:03:03Z"}

  await perf(
    async () => {
      const q: any[] = []
      for (let i = 0; i < 5; i++) {
        q.push(
          db
            .query('simple')
            .include('nr')
            // add more
            // .filter('nr', '=', [1, 1, 1, 100 + i])
            // .filter('nr', '=', [1, 1, 1, 100 + i])
            .filter('nr', '=', 100 + i)
            // .filter('nr', '=', [11, 1e7 + i])
            // .filter('flap', 'eqU32Batch', bigBatch) // should give results
            // .filter('flap', 'eqU32BatchSmall', [1e7 + 1e7 + i]) // should give results
            .get(),
        )
      }
      await Promise.all(q)
    },
    '10M Nodes query',
    { repeat: 100 },
  )

  // time = Date.now() - d
  // console.log('create 5M', time, 'ms', (1000 / time) * 5e6, 'OPS per second')

  db.create('simple', {
    nr: 99,
  })

  // | '='
  // | '<'
  // | '>'
  // | '!='
  // | '>='
  // | '<='
  // | '..'
  // | '!..'
  // | 'exists'
  // | '!exists'
  // | 'like'
  // | '!like'
  // | 'includes'
  // | '!includes'

  await db
    .query('simple')
    .include('nr', 'end', 'start')
    .filter('nr', '>', 90)
    .and('start', '>', Date.now())
    .and('end', '<', Date.now() + 20e3)
    .range(0, 100)

    // .filter('nr', '..', [90, 100])
    // > , >=, <=, <
    // .or('nr', 'equalsU32', 1e7)
    // .or('nr', 'equalsU32', 2)
    // .and('flap', 'equalsU32', 666)
    // .or('nr', 'equalsU32', 10)
    .get()
    .inspect(100)

  await wait(1000)
})

await test.skip('default', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop(true))

  await db.setSchema({
    locales: { en: true, de: true },
    types: {
      user: {
        props: {
          name: {
            type: 'string',
            default: 'habablababalba',
          },
          city: {
            type: 'string',
            maxBytes: 16,
            default: 'N/A',
          },
          bio: {
            type: 'string',
            default: 'dingdong'.repeat(100),
          },
          hack: {
            type: 'string',
            maxBytes: 1024,
            default: 'dingdong'.repeat(100),
          },
          hack2: {
            type: 'string',
            maxBytes: 1024,
            default: 'hack',
          },
          nr: { type: 'uint32', default: 95 },
          body: { type: 'text', default: { en: 'ding', de: 'dong' } }, // compression: 'none'
          special: {
            type: 'vector',
            size: 4,
            baseType: 'number',
            // TODO
            //default: new Uint8Array([0, 0, 0, 0]),
          },
          book: {
            type: 'text',
            default: {
              en: 'haha',
              de: 'hahaha',
            },
          },
        },
      },
    },
  })

  for (let i = 0; i < 10; i++) {
    db.create('user', {})
  }

  console.log('start')
  await perf(
    async () => {
      await db
        .query('user')
        .include('name', 'bio', 'hack', 'hack2', 'book')
        .get()
        .inspect()
    },
    'Dun',
    { repeat: 1 },
  )
  console.log('done')
})
