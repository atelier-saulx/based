import test from '../shared/test.js'
import { BasedDb } from '../../src/index.js'
import { create } from '../../src/client/modify/create.js'
import { Ctx } from '../../src/client/modify/Ctx.js'
import { drain } from '../../src/client/modify/drain.js'
import { deepEqual } from '../shared/assert.js'

test('better create', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        timestamp: 'timestamp',
        number: 'number',
        uint8: 'uint8',
        int8: 'int8',
        uint16: 'uint16',
        int16: 'int16',
        uint32: 'uint32',
        int32: 'int32',
      },
    },
  })

  db.client.on('info', console.info)
  db.server.on('info', console.info)

  const ctx = new Ctx(db.client.schema.hash, new Uint8Array(1000))
  const lastUser = async () => (await db.query('user').get()).toObject().at(-1)
  // empty
  create(ctx, db.client.schemaTypesParsed.user, {})
  await drain(db.client, ctx)
  deepEqual(await lastUser(), {
    id: 1,
    timestamp: 0,
    number: 0,
    uint8: 0,
    int8: 0,
    uint16: 0,
    int16: 0,
    uint32: 0,
    int32: 0,
  })
  // fixed
  create(ctx, db.client.schemaTypesParsed.user, {
    timestamp: 9,
    number: 9,
    uint8: 9,
    int8: 9,
    uint16: 9,
    int16: 9,
    uint32: 9,
    int32: 9,
  })
  await drain(db.client, ctx)
  deepEqual(await lastUser(), {
    id: 2,
    timestamp: 9,
    number: 9,
    uint8: 9,
    int8: 9,
    uint16: 9,
    int16: 9,
    uint32: 9,
    int32: 9,
  })
  // another
  create(ctx, db.client.schemaTypesParsed.user, {
    timestamp: 3,
    number: 3,
    uint8: 3,
    int8: 3,
    uint16: 3,
    int16: 3,
    uint32: 3,
    int32: 3,
  })
  await drain(db.client, ctx)
  deepEqual(await lastUser(), {
    id: 3,
    timestamp: 3,
    number: 3,
    uint8: 3,
    int8: 3,
    uint16: 3,
    int16: 3,
    uint32: 3,
    int32: 3,
  })

  // const res = db.create('user', {
  //   name: 'youri',
  //   email: 'power@magic.nl',
  // })

  // await db.drain()
  // const res2 = db.create('user', {
  //   friend: res,
  // })
})
