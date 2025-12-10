import { readUint32, wait } from '../../src/utils/index.js'
import test from '../shared/test.js'
import { perf } from '../shared/assert.js'
import { italy } from '../shared/examples.js'
import { BasedDb } from '../../src/index.js'
import { registerQuery } from '../../src/db-client/query/registerQuery.js'

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

          // creator: { ref: 'user', prop: 'createdTodos' },
          assignees: {
            items: {
              ref: 'user',
              prop: 'todos',
              $status: ['inProgress', 'blocked', 'nothing'],
              // $name: 'string',
            },
          },
          done: 'boolean',
        },
      },
      user: {
        props: {
          name: 'string',
          todos: { items: { ref: 'todo', prop: 'assignees' } },
          nr: { type: 'uint32' },
          nr1: { type: 'uint32' },
          nr2: { type: 'uint32' },
          nr3: { type: 'uint32' },
          nr4: { type: 'uint32' },
          nr5: { type: 'uint32' },
          nr6: { type: 'uint32' },
        },
      },
    },
  })

  console.log('SCHEMA DONE')

  const todo = await db.create('todo', {
    name: 'TODO A',
    nr: 67,
  })

  const todo2 = await db.create('todo', {
    name: 'TODO B',
    nr: 68,
  })

  console.log({ todo, todo2 })
  let d = Date.now()

  const x = ['nr', 'nr1', 'nr2', 'nr3', 'nr4', 'nr5', 'nr6']

  for (let i = 0; i < 1e5; i++) {
    db.create('user', {
      nr: 1e5 - i,
      nr1: 1e5 - i,
      nr2: 1e5 - i,
      nr3: 1e5 - i,
      nr4: 1e5 - i,
      nr5: 1e5 - i,
      nr6: 1e5 - i,

      // name: 'A',
      // flap: '⚡️',

      // adding edge here makes it 20x slower (can be better)
      todos: [
        // need to write an 8 byte empty thing for edges
        { id: todo, $status: 'blocked' }, //  $name: 'bla'
        // { id: todo2, $status: 'nothing' }, //  $name: 'blurf'
        // { id: todo2, $status: 'nothing', $name: 'blurf' }, // $name: 'blurf'
      ],
      // todos: [todo, todo2], // this doesnot work with edges...

      // derp: 'hello',
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

  console.log('\n--------------------------\nStart query!!!!!!!!!')

  const y = await db
    .query('user')
    // .locale('nl', ['no', 'de'])
    // .include('body', { meta: true, end: 10 })
    // .include('name', { meta: 'only' })
    // .include('nr') //  'flap'
    // .include('todos.id') // 'todos.$status'

    // .include('todos.id', 'todos.$status', 'nr') // 'todos.$status'
    .include('nr')
    .range(0, 100)
    .sort('nr', 'desc')
    .get()

  // x.debug()

  y.inspect()

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
      for (let i = 0; i < 1; i++) {
        q.push(
          db
            .query('user')
            .include('id')
            .include('name')
            .range(0, 1e5 + i)
            .sort(x[i % x.length])
            .get(),
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
