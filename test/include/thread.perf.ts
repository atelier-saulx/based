import { wait } from '../../src/utils/index.js'
import test from '../shared/test.js'
import { perf } from '../shared/assert.js'
import { italy } from '../shared/examples.js'
import { BasedDb } from '../../src/index.js'

await test('include', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop(true))
  // t.after(() => t.backup(db))

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
          creator: { ref: 'user', prop: 'createdTodos' },
          assignee: {
            ref: 'user',
            prop: 'todos',
            $status: ['inProgress', 'blocked', 'nothing'],
          },
          done: 'boolean',
        },
      },
      user: {
        props: {
          flap: { enum: ['⚡️', '🤪', '💩'] }, // default: '🤪'
          derp: ['hello', 'bye'],
          name: { type: 'string' }, // default: 'xxxx'
          nr: { type: 'uint32', default: 22 },
          body: { type: 'text' }, // compression: 'none'
        },
      },
    },
  })

  console.log('SCHEMA DONE')

  db.create('todo', {
    name: 'A',
  })

  const todo = await db.create('todo', {
    name: 'TODO',
  })

  const todo2 = await db.create('todo', {
    name: 'TODO2',
  })

  console.log({ todo, todo2 })

  for (let i = 0; i < 1; i++) {
    db.create('user', {
      nr: i + 67,
      name: 'A',
      flap: '⚡️',
      todos: [{ id: todo, $status: 'blocked' }, todo2],
      derp: 'hello',
      body: {
        nl: 'x',
        fr: 'B',
        de: '🇮🇹🇮🇹🇮🇹🇮🇹🇮🇹🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇮🇹🤪🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇮🇹ewpofjwoif jweofhjweoifhweoifhweoihfoiwehfoiwehfoeiwhfoiewhfoiwehfoweihf eowifhowi efhwoefhweo ifhoeiw hoiewhfoiew foi oeiwfh ewoifhwe oioiweh ',
        en: italy,
      },
    })
  }

  // // update works
  // for (let i = 1; i < 1000; i++) {
  //   db.update('user', {
  //     id: i,
  //     flap: '💩',
  //   })
  // }

  console.log('start query')

  await db.drain()

  console.log('yes?')

  const x = await db
    .query('user')
    // .locale('nl', ['no', 'de'])
    // .include('body', { meta: true, end: 10 })
    // .include('name', { meta: 'only' })
    .include('nr') //  'flap'
    .include('todos.name')
    // .include('name')
    .range(0, 2)
    .get()

  x.debug()

  x.inspect(10)

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

  // await db.query('user').include('name', 'body').range(0, 1).get().inspect()

  // await perf(
  //   async () => {
  //     const q: any[] = []
  //     for (let i = 0; i < 1000; i++) {
  //       q.push(
  //         db
  //           .query('user')
  //           // .locale('nl', ['fr', 'no', 'de'])
  //           .include('nr')
  //           // .include('name', 'body', { end: 2 })
  //           .range(0, 1000 + i)
  //           .get(),
  //         // .inspect(),
  //       )
  //     }
  //     await Promise.all(q)
  //   },
  //   'Nodes',
  //   { repeat: 10 },
  // )

  console.log('done')

  // await wait(100)
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
