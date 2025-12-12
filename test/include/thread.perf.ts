import { fastPrng, readUint32, wait } from '../../src/utils/index.js'
import test from '../shared/test.js'
import { perf } from '../shared/assert.js'
import { italy } from '../shared/examples.js'
import { BasedDb } from '../../src/index.js'
import { registerQuery } from '../../src/db-client/query/registerQuery.js'
import { register } from 'module'

await test('include', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop(true))
  //t.after(() => t.backup(db))

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
            items: { ref: 'user', prop: 'currentTodo' },
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
  const rand = fastPrng()

  for (let i = 0; i < 1e3; i++) {
    todos.push(
      await db.create('todo', {
        name: 'a',
        nr: rand(0, 1e5),
      }),
    )
  }

  let d = Date.now()

  const x = ['nr', 'nr1', 'nr2', 'nr3', 'nr4', 'nr5', 'nr6']

  for (let i = 0; i < 1e3; i++) {
    db.create('user', {
      nr: 1e5 - i,
      nr1: 1e5 - i,
      nr2: 1e5 - i,
      nr3: 1e5 - i,
      nr4: 1e5 - i,
      nr5: 1e5 - i,
      nr6: 1e5 - i,
      name: 'mr snurp ' + i,
      currentTodo: todos[0],
      email: `beerdejim+${i}@gmail.com`,
      todos: todos.slice(0, rand(0, 10)).map((v) => ({
        id: v,
        $status: 'nothing',
      })),

      // { id: todo2, $status: 'nothing', $name: 'blurf' }, // $name: 'blurf'
      // todos: [todo, todo2], // this doesnot work with edges...
      // body: {
      //   nl: 'x',
      //   fr: 'B',
      //   de: '🇮🇹🇮🇹🇮🇹🇮🇹🇮🇹🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇮🇹🤪🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇮🇹ewpofjwoif jweofhjweoifhweoifhweoihfoiwehfoiwehfoeiwhfoiewhfoiwehfoweihf eowifhowi efhwoefhweo ifhoeiw hoiewhfoiew foi oeiwfh ewoifhwe oioiweh ',
      //   en: italy,
      // },
    })
  }

  // // update works
  // for (let i = 1; i < 1000; i++) {
  //   db.update('user', {
  //     id: i,
  //     flap: '💩',
  //   })
  // }
  await db.drain()
  console.log(Date.now() - d, 'ms')

  console.log('\n--------------------------\nStart quer222y!!!!!!!!!')

  // await db.query('user', 1).include('id', 'name').get().inspect()
  // const result = await db
  //   .query('user')
  //   .include('id')
  //   // .query('user', { email: 'beerdejim+10@gmail.com' })
  //   // .include('id', 'todos.$status')
  //   .range(0, 1e5)

  //   .include((t) => {
  //     t('todos').include('nr') //.sort('nr') // 'desc'
  //   })
  //   .get()
  //   .inspect()

  const result = await db
    .query('todo', [3, 10, 20])
    .include('id', 'nr')
    // .query('user', { email: 'beerdejim+10@gmail.com' })
    // .include('id', 'todos.$status')
    .range(0, 1e5)

    // .include((t) => {
    //   t('todos').include('nr') //.sort('nr') // 'desc'
    // })
    .get()
    .inspect()

  // .debug()
  // const idBufs: any = []
  // for (let i = 0; i < 1000; i++) {
  //   idBufs.push(registerQuery(db.query('user', i + 1).include('id', 'name')))
  // }

  // await perf.skip(
  //   async () => {
  //     const q: any[] = []
  //     for (let i = 0; i < 1000; i++) {
  //       q.push(db.server.getQueryBuf(idBufs[i]))
  //     }
  //     await Promise.all(q)
  //   },
  //   'single id',
  //   { repeat: 10 },
  // )

  // const y = await db
  //   .query('user')
  //   // .locale('nl', ['no', 'de'])
  //   // .include('body', { meta: true, end: 10 })
  //   // .include('name', { meta: 'only' })
  //   // .include('nr') //  'flap'
  //   // .include('todos.id') // 'todos.$status'

  //   // .include('todos.id', 'todos.$status', 'nr') // 'todos.$status'
  //   // .include('nr')
  //   .include('currentTodo')
  //   // 'currentTodo.nr',
  //   // .include(x)
  //   .range(0, 1)
  //   // .sort('nr', 'desc')
  //   .get()
  //   .debug()

  // x.debug()

  // y.inspect()

  // console.log('drain done')
  // ;(
  //   await db
  //     .query('user')
  //     // .locale('nl', ['fr', 'no', 'de'])
  //     // .include('name')

  //     .include('name', { meta: 'only' })
  //     .range(0, 2)
  //     .get()
  // )
  //   .inspect(2, true)
  //   .debug()
  // .toObject(),

  // await db.query('user').include('todos.nr').range(0, 1).get().inspect()

  await perf.skip(
    async () => {
      const q: any[] = []
      for (let i = 0; i < 10; i++) {
        q.push(
          db
            .query('user')
            .include('id')
            .include('name')
            .range(0, 1e5 + i)
            // .sort(x[i % x.length])

            .get(),
          // .inspect(),
        )
      }
      await Promise.all(q)
    },
    'Nodes',
    { repeat: 10 },
  )

  await wait(100)
})

await test('default', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop(true))
  //t.after(() => t.backup(db))

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
