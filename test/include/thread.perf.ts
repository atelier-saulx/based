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

  for (let i = 0; i < 1e6; i++) {
    db.create('todo', {
      // name: i % 2 ? 'b' : 'a',
      nr: rand(0, 10),
    })
  }

  await db.drain()

  console.log(Date.now() - d, 'ms')

  for (let i = 0; i < 100; i++) {
    todos.push(
      await db.create('todo', {
        // name: i % 2 ? 'b' : 'a',
        nr: rand(0, 10),
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

  for (let i = 1; i < 3; i++) {
    db.query('todo', i)
      .include('nr')
      .subscribe((d) => console.log(d))
  }

  await wait(200)
  console.log(styleText('blue', 'subscribed'))

  d = Date.now()
  for (let i = 1; i < 3; i++) {
    db.update('todo', i, { nr: { increment: 1 } })
  }
  console.log(styleText('blue', 'wait for drain'))
  await db.drain()

  console.log(styleText('blue', 'drain done'))
  const subs = 5e5

  console.log(styleText('blue', `add ${subs} subs`))
  var cnt = 0
  const fn = (d) => cnt++

  for (let j = 0; j < subs / 1000; j++) {
    for (let i = 1; i < 1000; i++) {
      // opt query contructor to be faster and use less mem
      db.query('todo', i + j * 1000)
        .include('nr')
        .subscribe(fn)
    }
    // gc
    await wait(10)
  }
  console.log(styleText('blue', `adding ${subs} subs done`))
  await wait(500)

  const amount = 1e7
  console.log(styleText('blue', `start update ${amount}`))
  d = Date.now()
  for (let i = 1; i < amount; i++) {
    db.update('todo', i, { nr: { increment: 1 } })
    if (i % 1000 === 0) {
      await db.drain()
    }
  }
  console.log(
    styleText('blue', `done update ${amount} ` + (Date.now() - d) + 'ms'),
  )

  console.log('\n--------------------------\n')

  await perf.skip(
    async () => {
      const q: any[] = []
      for (let i = 0; i < 100; i++) {
        q.push(
          db
            .query('todo')
            .range(0, 1e6 + i)
            .include('nr')
            .get(),
          // .inspect(),
        )
      }
      await Promise.all(q)
    },
    '100M Nodes query',
    { repeat: 10 },
  )

  await wait(100)
  console.log('SUBS FIRE?', cnt)
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
