import { fastPrng, readUint32, wait } from '../../src/utils/index.js'
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
      todo: {
        props: {
          name: 'string',
          nr: { type: 'uint32' },
          flap: { type: 'uint32' },
          workingOnIt: {
            items: { ref: 'user', prop: 'currentTodo', $derp: 'boolean' },
          },

          // creator: { ref: 'user', prop: 'createdTodos' },
          assignees: {
            items: {
              ref: 'user',
              prop: 'todos',
              $status: ['inProgress', 'blocked', 'nothing'],
              // $nr: 'number',
              // $name: 'string',
            },
          },
          done: 'boolean',
        },
      },
      user: {
        props: {
          name: 'string',
          currentTodo: {
            ref: 'todo',
            prop: 'workingOnIt',
          },
          todos: { items: { ref: 'todo', prop: 'assignees' } },
          nr: { type: 'uint32' },
          nr1: { type: 'uint32' },
          nr2: { type: 'uint32' },
          nr3: { type: 'uint32' },
          nr4: { type: 'uint32' },
          nr5: { type: 'uint32' },
          nr6: { type: 'uint32' },
          email: 'alias',
        },
      },
    },
  })

  console.log('SCHEMA DONE')

  const todos: number[] = []
  const rand = fastPrng(233221)
  let d = Date.now()

  db.create('todo', {
    flap: 666,
    // name: i % 2 ? 'b' : 'a',
    nr: 2,
  })

  for (let i = 0; i < 1e7; i++) {
    db.create('todo', {
      flap: 67,
      // name: i % 2 ? 'b' : 'a',
      nr: rand(0, 10),
    })
  }

  await db.drain()

  // console.log(Date.now() - d, 'ms')

  for (let i = 0; i < 3; i++) {
    todos.push(
      await db.create('todo', {
        name: i % 2 ? 'b' : 'a',
        nr: i % 2 ? 1 : 2,
        flap: 99,
      }),
    )
  }

  const mrX = await db.create('user', {
    name: 'Mr X',
    currentTodo: { id: todos[0], $derp: true },
    email: `beerdejim@gmail.com`,
    nr: 67,
  })

  const mrY = await db.create('user', {
    name: 'Mr Y',
    currentTodo: { id: todos[1], $derp: false },
    email: `beerdejim+1@gmail.com`,
    nr: 68,
  })

  // now include edge
  await db.query('user').include('currentTodo').get().inspect()

  const x = ['nr', 'nr1', 'nr2', 'nr3', 'nr4', 'nr5', 'nr6']

  // for (let i = 1; i < 3; i++) {
  //   db.query('todo', i)
  //     .include('nr')
  //     .subscribe((d) => console.log(d))
  // }

  // await wait(200)
  // console.log(styleText('blue', 'subscribed'))

  d = Date.now()
  for (let i = 1; i < 3; i++) {
    db.update('todo', i, { nr: { increment: 1 } })
  }
  console.log(styleText('blue', 'wait for drain'))
  await db.drain()

  console.log(styleText('blue', 'drain done'))
  // const subs = 1e4

  // console.log(styleText('blue', `add ${subs} subs`))
  // var cnt = 0
  // const fn = (d) => cnt++

  // const q = db.query('todo', 1).include('nr')

  // for (let j = 0; j < subs / 1000; j++) {
  //   for (let i = 1; i < 1000; i++) {
  //     // opt query contructor to be faster and use less mem
  //     // @ts-ignore
  //     q.target.id = i + j * 1000
  //     q.subscriptionBuffer = undefined
  //     q.buffer = undefined
  //     registerQuery(q)
  //     const buf = registerSubscription(q)
  //     db.server.subscribe(buf, fn)
  //   }
  //   await wait(1)
  // }

  // console.log(styleText('blue', `adding ${subs} subs done`))
  // await wait(500)

  // const amount = 1e5
  // console.log(styleText('blue', `start update ${amount}`))
  // d = Date.now()
  // for (let i = 1; i < amount; i++) {
  //   db.update('todo', i, { nr: { increment: 1 } })
  //   // if (i % 1000 === 0) {
  //   // await db.drain()
  //   // }
  // }
  // await db.drain()
  // console.log(
  //   styleText('blue', `done update ${amount} ` + (Date.now() - d) + 'ms'),
  // )

  console.log('\n--------------------------\n')

  await perf.skip(
    async () => {
      const q: any[] = []
      for (let i = 0; i < 5; i++) {
        q.push(
          db
            .query('todo')
            .include('nr', 'name')
            // .filter('nr', 'equalsU32', 1e7 + i)
            .filter('flap', 'equalsU32Or', [20, 1e7 + i]) // should give results
            .or('nr', 'equalsU32Or', [1e7, 1e7 + 1, 1e7 + 2, 1e7 + i]) // lets start with this...
            .get(),
        )
      }
      await Promise.all(q)
    },
    '10M Nodes query',
    { repeat: 100 },
  )

  // await wait(100)
  // console.log('SUBS FIRE?', cnt)

  // await db
  //   .query('todo', 1)
  //   .include('nr', 'name')
  //   .filter('nr', 'equalsU32', 1e7) // lets start with this...
  //   .get()
  //   .inspect()

  await db.update('todo', 1, { nr: 2 })

  // console.log('derp')

  // db.query('todo', 1)
  //   .include('nr', 'name')
  //   .filter('nr', 'equals', 2) // lets start with this...
  //   .get()
  // .inspect()

  // make or function
  // .and

  // db.query('todo').include('nr', 'flap').filter('nr','equalsU32', 10 )

  /*
    if ((nr = 1 && flap = 2) || (nr = 4 && (flap = 5 || nr = 11)))
    q.filter(nr, 1).and(flap, 2).or((f) => {
      f.filter(nr, 4).and(f => f.filter('flap', 5).or(nr, 11))
    })

    // if ((nr = 1 && flap = 2) || (nr = 4 && (flap = 5 || nr = 11)))
    q.filter(nr, 1, flap, 2).or(nr, 4, f => f(flap, 5).or(nr, 11))
  */

  // await db
  //   .query('todo')
  //   .include('nr')
  //   // .filter('nr', 'equalsU32', 2e7)
  //   // .or('nr', 'equalsU32', 1e7)
  //   // .or('nr', 'equalsU32', 2)
  //   // .or('nr', 'equalsU32', 10)
  //   .get()
  //   .inspect(1000)

  await db
    .query('user')
    .include('currentTodo')
    // if single ref
    .filter('currentTodo.nr', 'equalsU32', 1)
    .or('nr', 'equalsU32', 1e7)
    .or('flap', 'equalsU32', 2)
    // .and('flap', 'equalsU32', 666)
    // .or('nr', 'equalsU32', 10)
    .get()
    .inspect(100)

  // await db
  //   .query('todo')
  //   .include('nr', 'name', 'flap')
  //   .filter('nr', 'equalsU32Or', [11, 12, 13])
  //   // .or('nr', 'equalsU32', 1e7)
  //   // .or('nr', 'equalsU32', 2)
  //   // .and('flap', 'equalsU32', 666)
  //   // .or('nr', 'equalsU32', 10)
  //   .get()
  //   .inspect(100)

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
