import { BasedDb } from '../src/index.js'
import { deepEqual, throws } from './shared/assert.js'
import test from './shared/test.js'

await test('min / max', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => db.destroy())

  await db.setSchema({
    locales: { en: {}, de: {} },
    types: {
      user: {
        props: {
          u32: { type: 'uint32', max: 20, min: 10, step: 10 },
          u8: { type: 'uint8', max: 20, min: 10, step: 10 },
          i8: { type: 'int8', max: 20, min: 10, step: 10 },
          i32: { type: 'int32', max: 20, min: 10, step: 10 },
          u16: { type: 'uint16', max: 20, min: 10, step: 10 },
          i16: { type: 'int16', max: 20, min: 10, step: 10 },
          number: { type: 'number', max: 20, min: 10, step: 10 },
          numberMax: { type: 'number', max: 20, min: 10, step: 10 },
          date: { type: 'timestamp', max: 20, min: 10, step: 10 },
        },
      },
    },
  })

  throws(async () => {
    db.create('user', {
      u32: 30,
    })
  }, 'Trying to set too large value on u32')

  throws(async () => {
    db.create('user', {
      u32: 0,
    })
  }, 'Trying to set too small value on u32')

  throws(async () => {
    db.create('user', {
      u8: 30,
    })
  }, 'Trying to set too large value on u8')

  throws(async () => {
    db.create('user', {
      u8: 0,
    })
  }, 'Trying to set too small value on u8')

  throws(async () => {
    db.create('user', {
      i8: 30,
    })
  }, 'Trying to set too large value on i8')

  throws(async () => {
    db.create('user', {
      i8: 0,
    })
  }, 'Trying to set too small value on i8')

  throws(async () => {
    db.create('user', {
      i32: 30,
    })
  }, 'Trying to set too large value on i32')

  throws(async () => {
    db.create('user', {
      i32: 0,
    })
  }, 'Trying to set too small value on i32')

  throws(async () => {
    db.create('user', {
      u16: 30,
    })
  }, 'Trying to set too large value on u16')

  throws(async () => {
    db.create('user', {
      u16: 0,
    })
  }, 'Trying to set too small value on u16')

  throws(async () => {
    db.create('user', {
      i16: 30,
    })
  }, 'Trying to set too large value on i16')

  throws(async () => {
    db.create('user', {
      i16: 0,
    })
  }, 'Trying to set too small value on i16')

  throws(async () => {
    db.create('user', {
      number: 30,
    })
  }, 'Trying to set too large value on number')

  throws(async () => {
    db.create('user', {
      number: 0,
    })
  }, 'Trying to set too small value on number')

  throws(async () => {
    db.create('user', {
      numberMax: 30,
    })
  }, 'Trying to set too large value on numberMax')

  throws(async () => {
    db.create('user', {
      numberMax: 0,
    })
  }, 'Trying to set too small value on numberMax')

  throws(async () => {
    db.create('user', {
      date: 30,
    })
  }, 'Trying to set too large value on date')

  throws(async () => {
    db.create('user', {
      date: 0,
    })
  }, 'Trying to set too small value on date')
})
