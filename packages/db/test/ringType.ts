import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('ring type', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      meas: {
        ringMaxIds: 3,
        props: {
          temperature: 'number',
          humidity: 'number',
        },
      },
    },
  })

  db.create('meas', {
    temperature: 0,
    humidity: 99,
  })
  db.create('meas', {
    temperature: 1,
    humidity: 98,
  })
  db.create('meas', {
    temperature: 2,
    humidity: 97,
  })

  deepEqual((await db.query('meas').get()).toObject(), [
    { id: 1, temperature: 0, humidity: 99 },
    { id: 2, temperature: 1, humidity: 98 },
    { id: 3, temperature: 2, humidity: 97 },
  ])

  db.create('meas', {
    temperature: -100,
    humidity: 1,
  })

  deepEqual((await db.query('meas').get()).toObject(), [
    { id: 1, temperature: -100, humidity: 1 },
    { id: 2, temperature: 1, humidity: 98 },
    { id: 3, temperature: 2, humidity: 97 },
  ])

  db.create('meas', {
    temperature: -50,
    humidity: 1,
  })
  db.create('meas', {
    temperature: -40,
    humidity: 1,
  })

  deepEqual((await db.query('meas').get()).toObject(), [
    { id: 1, temperature: -100, humidity: 1 },
    { id: 2, temperature: -50, humidity: 1 },
    { id: 3, temperature: -40, humidity: 1 },
  ])

  db.create('meas', {
    temperature: -50,
    humidity: 1,
  })
  db.create('meas', {
    temperature: -40,
    humidity: 1,
  })
  db.create('meas', {
    temperature: -50,
    humidity: 1,
  })
  db.create('meas', {
    temperature: -40,
    humidity: 1,
  })
  db.create('meas', {
    temperature: -50,
    humidity: 1,
  })
  db.create('meas', {
    temperature: -40,
    humidity: 1,
  })
})
