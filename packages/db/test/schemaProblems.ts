import test from './shared/test.js'
import { BasedDb } from '../src/index.js'
import { clientWorker } from './shared/startWorker.js'

await test('empty schema dont crash', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  const q = []
  q.push(
    clientWorker(t, db, async (c) => {
      await c.query('flap').get().inspect()
    }),
  )

  q.push(
    clientWorker(t, db, async (c) => {
      await c.setSchema({
        types: {
          flap: {
            props: {
              x: 'uint8',
            },
          },
        },
      })
      await c.create('flap', {
        x: 10,
      })
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
