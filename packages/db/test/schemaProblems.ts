import test from './shared/test.js'
import { BasedDb } from '../src/index.js'
import { clientWorker } from './shared/startWorker.js'

await test('empty schema dont crash', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return t.backup(db)
  })

  const int = setInterval(async () => {
    await db.save()
  }, 1e3)

  t.after(() => {
    clearInterval(int)
  })

  const q = []
  q.push(
    clientWorker(t, db, async (c) => {
      await c.query('flap').get().inspect()
    }),
  )

  q.push(
    clientWorker(t, db, async (c) => {
      c.query('flap').subscribe(
        (d) => {
          console.log('sub2', d)
        },
        (err) => {
          console.log(err)
        },
      )
      await new Promise((resolve) => setTimeout(resolve, 20000))
    }),
  )

  q.push(
    clientWorker(t, db, async (c) => {
      c.query('flap')
        .include('flap')
        .subscribe(
          (d) => {
            console.log('sub', d)
          },
          (err) => {
            console.log(err)
          },
        )
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }),
  )
  q.push(
    clientWorker(t, db, async (c) => {
      await c.setSchema({
        types: {
          seq: {
            flap: {
              items: {
                ref: 'flap',
                prop: 'seq',
              },
            },
          },
          flap: {
            props: {
              x: 'uint8',
              seq: {
                ref: 'seq',
                prop: 'flap',
              },
            },
          },
        },
      })
      await c.create('flap', {
        x: 10,
      })
      await new Promise((resolve) => setTimeout(resolve, 300))
      await c.setSchema({
        types: {
          seq: {
            flap: {
              items: {
                ref: 'flap',
                prop: 'seq',
              },
            },
          },
          flap: {
            props: {
              x: 'uint32',
              flap: 'int8',
              seq: {
                ref: 'seq',
                prop: 'flap',
              },
            },
          },
        },
      })
      console.log('schema 1 changed')
      await new Promise((resolve) => setTimeout(resolve, 300))
      await c.setSchema({
        types: {
          seq: {
            flap: {
              items: {
                ref: 'flap',
                prop: 'seq',
              },
            },
          },
          flap: {
            props: {
              x: 'uint32',
              flap: 'int8',
              y: 'boolean',
              seq: {
                ref: 'seq',
                prop: 'flap',
              },
            },
          },
        },
      })
      console.log('schema 2 changed')
    }),
    clientWorker(t, db, async (c) => {
      await c.schemaIsSet()
      c.flushTime = 0
      await new Promise((resolve) => setTimeout(resolve, 600))
      for (let i = 0; i < 1e5; i++) {
        await c.create('flap', {
          x: i,
        })
        await c.drain()
      }
      await c.drain()
    }),
    clientWorker(t, db, async (c) => {
      await c.schemaIsSet()
      await new Promise((resolve) => setTimeout(resolve, 600))

      for (let i = 0; i < 5e5; i++) {
        await c.create('flap', {
          x: i,
        })
        if (i % 500 === 0) {
          await c.drain()
        }
      }
      await c.drain()
    }),
    clientWorker(t, db, async (c) => {
      await c.schemaIsSet()
      await new Promise((resolve) => setTimeout(resolve, 600))

      for (let i = 0; i < 5e5; i++) {
        await c.create('flap', {
          x: i,
        })
        if (i % 1500 === 0) {
          await c.drain()
        }
      }
      await c.drain()
    }),
  )

  await Promise.all(q)

  // setSchema (client)
  //   validates the schema
  // setServerLocalSchema(SERVER)
  //   add lastSchemaId and makes checksum
  //   schemaTypesParsed()
  // setLocalSchema (client)
  //   adds client.schema and emits 'schema'
  //   schemaTypesParsed()
  // subscribeSchema (client hook)
  // listen on incoming schema (over network) and calls setLocalSchema
  //   migrateSchema
  // ?
  // schemaIsReady() < remove this
  //  make .once(schema) awaitable
  // never put an empty schema on the top

  // server on schema
  // client on schema
})
