import { fastPrng, wait } from '../../src/utils/index.js'
import test from '../shared/test.js'
import { perf } from '../shared/assert.js'
import { BasedDb } from '../../src/index.js'
import { registerQuery } from '../../src/db-client/query/registerQuery.js'

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

  const client = await db.setSchema({
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
          // inverse: { ref: 'simple',}
          target: { ref: 'simple', prop: 'target' },
        },
      },
    },
  })

  const todos: number[] = []
  const rand = fastPrng(233221)

  await wait(100)
  let d = Date.now()

  for (let i = 0; i < 5e6; i++) {
    client.create('simple', {
      nr: 67,
      // name: i % 2 ? 'b' : 'a',
      // nr: rand(0, 10),
    })
  }

  await client.drain()

  let time = Date.now() - d
  console.log('create 5M', time, 'ms', (1000 / time) * 5e6, 'OPS per second')

  d = Date.now()
  for (let i = 0; i < 5e6; i++) {
    client.update('simple', i + 1, {
      nr: 67,
      // name: i % 2 ? 'b' : 'a',
      // nr: rand(0, 10),
    })
  }

  await client.drain()

  time = Date.now() - d

  console.log('update 5M', time, 'ms', (1000 / time) * 5e6, 'OPS per second')

  let q: any = []

  const x = client.query('simple', 1)

  registerQuery(x)

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
      client
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
    client.delete('simple', i + 1)
  }

  await client.drain()

  time = Date.now() - d

  console.log('DEL 5M', time, 'ms', (1000 / time) * 5e6, 'OPS per second')

  const simple = await client.create('simple', {
    nr: 1001,
  })

  const simple2 = await client.create('simple', {
    nr: 1002,
  })

  d = Date.now()

  for (let i = 0; i < 10e6; i++) {
    client.create('simple', {
      nr: 67,
      start: d + i * 1e3,
      end: d + i * 1e3 + 10e3,
      target: i % 2 ? simple2 : simple,
      // name: i % 2 ? 'b' : 'a',
      // nr: rand(0, 10),
    })
  }

  await db.drain()
  time = Date.now() - d

  console.log(
    'CREATE + REF 10M',
    time,
    'ms',
    (1000 / time) * 10e6,
    'OPS per second',
  )

  await perf(
    async () => {
      const q: any[] = []
      for (let i = 0; i < 5; i++) {
        q.push(
          client
            .query('simple')
            .include('id', 'nr')
            // .range(0, 10e6 + i)
            .filter('nr', '=', 100 + i)
            .get(),
        )
      }
      await Promise.all(q)
    },
    '1M Nodes include',
    { repeat: 100 },
  )

  await perf(
    async () => {
      const q: any[] = []
      for (let i = 0; i < 5; i++) {
        q.push(
          client
            .query('simple')
            .include('id', 'nr')
            // .range(0, 10e6 + i)
            .filter('nr', '=', 100 + i)
            .get(),
        )
      }
      await Promise.all(q)
    },
    '10M Nodes query',
    { repeat: 100 },
  )

  client.create('simple', {
    nr: 100,
    // name: i % 2 ? 'b' : 'a',
    // nr: rand(0, 10),
  })

  await client
    .query('simple')
    .include('nr') //  'start', 'end', 'target'
    .filter('target.nr', '>', 1001)
    // .or('nr', '=', 100)
    // .or('nr', '=', 200)
    // .or((p) => {
    //   p.filter('nr', 10).and('nr', 20)
    // })
    // .and((p) => {
    //   p.filter('y', 20)
    //   p.or('x', 10)
    // })

    /*
    {
      filter: {
        props: {nr" '>' 10001}
        and: {
          props: { y: [10]}
          or: { props: { x: 10}}
        }
      }
    
    }
  
    {
      filter: {
        props: {nr" '>' 10001}
        or: {
          props: { nr: [10,20]}
        }
      }
    
    }

    {
      filter: {
        props: {nr" '>' 10001}
        or: {
          or: {
          }
        }
      }
    
    }

    */

    .range(0, 10e6)
    .get()
    .inspect()

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
            baseType: 'float64',
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
