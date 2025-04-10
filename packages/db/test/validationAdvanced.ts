import { BasedDb } from '../src/index.js'
import { throws } from './shared/assert.js'
import test from './shared/test.js'

await test('min / max validation', async (t) => {
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
          // min: 10, max: 20, step: 10 => only valid value is 10 or 20
          u32: { type: 'uint32', max: 20, min: 10, step: 10 },
          u8: { type: 'uint8', max: 20, min: 10, step: 10 },
          i8: { type: 'int8', max: 20, min: 10, step: 10 },
          i32: { type: 'int32', max: 20, min: 10, step: 10 },
          u16: { type: 'uint16', max: 20, min: 10, step: 10 },
          i16: { type: 'int16', max: 20, min: 10, step: 10 },
          number: { type: 'number', max: 20, min: 10, step: 10 },
          timestamp: { type: 'timestamp', max: 20, min: 10, step: 10 },
        },
      },
    },
  })

  // --- Min/Max Tests ---
  // These test values that are multiples of step=10, so failures are due to min/max

  throws(async () => {
    db.create('user', {
      u32: 30, // > max 20
    })
  }, 'Trying to set too large value on u32')

  throws(async () => {
    db.create('user', {
      u32: 0, // < min 10
    })
  }, 'Trying to set too small value on u32')

  throws(async () => {
    db.create('user', {
      u8: 30, // > max 20
    })
  }, 'Trying to set too large value on u8')

  throws(async () => {
    db.create('user', {
      u8: 0, // < min 10
    })
  }, 'Trying to set too small value on u8')

  throws(async () => {
    db.create('user', {
      i8: 30, // > max 20
    })
  }, 'Trying to set too large value on i8')

  throws(async () => {
    db.create('user', {
      i8: 0, // < min 10
    })
  }, 'Trying to set too small value on i8')

  throws(async () => {
    db.create('user', {
      i32: 30, // > max 20
    })
  }, 'Trying to set too large value on i32')

  throws(async () => {
    db.create('user', {
      i32: 0, // < min 10
    })
  }, 'Trying to set too small value on i32')

  throws(async () => {
    db.create('user', {
      u16: 30, // > max 20
    })
  }, 'Trying to set too large value on u16')

  throws(async () => {
    db.create('user', {
      u16: 0, // < min 10
    })
  }, 'Trying to set too small value on u16')

  throws(async () => {
    db.create('user', {
      i16: 30, // > max 20
    })
  }, 'Trying to set too large value on i16')

  throws(async () => {
    db.create('user', {
      i16: 0, // < min 10
    })
  }, 'Trying to set too small value on i16')

  throws(async () => {
    db.create('user', {
      number: 30, // > max 20
    })
  }, 'Trying to set too large value on number')

  throws(async () => {
    db.create('user', {
      number: 0, // < min 10
    })
  }, 'Trying to set too small value on number')

  throws(async () => {
    db.create('user', {
      timestamp: 30, // > max 20
    })
  }, 'Trying to set too large value on date') // Note: message uses 'date', might be a typo in original test

  throws(async () => {
    db.create('user', {
      timestamp: 0, // < min 10
    })
  }, 'Trying to set too small value on date') // Note: message uses 'date'

  // --- Test interaction of min/max/step ---
  await db.create('user', { u32: 10 }) // min and multiple of step
  await db.create('user', { u32: 20 }) // max and multiple of step

  throws(async () => {
    db.create('user', {
      u32: 15, // Within min/max but not multiple of step 10
    })
  }, 'Value 15 is not a multiple of step 10 for u32')
})

await test('step validation', async (t) => {
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
          // min: 0, max: 100, step: 5 => valid values are 0, 5, 10, ..., 100
          u32Step: { type: 'uint32', max: 100, min: 0, step: 5 },
          u8Step: { type: 'uint8', max: 100, min: 0, step: 5 },
          i8Step: { type: 'int8', max: 100, min: 0, step: 5 },
          i32Step: { type: 'int32', max: 100, min: 0, step: 5 },
          u16Step: { type: 'uint16', max: 100, min: 0, step: 5 },
          i16Step: { type: 'int16', max: 100, min: 0, step: 5 },
          numberStep: { type: 'number', max: 100, min: 0, step: 5 },
          timestampStep: { type: 'timestamp', max: 100, min: 0, step: 5 },
        },
      },
    },
  })

  // --- Step Tests ---
  // These test values within min/max but not multiples of step=5

  // Valid step values (should not throw for step)
  await db.create('user', { u32Step: 15 })
  await db.create('user', { u8Step: 10 })
  await db.create('user', { i8Step: 5 })
  await db.create('user', { i32Step: 95 })
  await db.create('user', { u16Step: 100 })
  await db.create('user', { i16Step: 0 })
  await db.create('user', { numberStep: 50 })
  await db.create('user', { timestampStep: 25 })

  // Invalid step values (should throw)
  throws(async () => {
    db.create('user', {
      u32Step: 12, // Not a multiple of 5
    })
  }, 'Value 12 is not a multiple of step 5 for u32Step')

  throws(async () => {
    db.create('user', {
      u8Step: 7, // Not a multiple of 5
    })
  }, 'Value 7 is not a multiple of step 5 for u8Step')

  throws(async () => {
    db.create('user', {
      i8Step: 99, // Not a multiple of 5
    })
  }, 'Value 99 is not a multiple of step 5 for i8Step')

  throws(async () => {
    db.create('user', {
      i32Step: 3, // Not a multiple of 5
    })
  }, 'Value 3 is not a multiple of step 5 for i32Step')

  throws(async () => {
    db.create('user', {
      u16Step: 51, // Not a multiple of 5
    })
  }, 'Value 51 is not a multiple of step 5 for u16Step')

  throws(async () => {
    db.create('user', {
      i16Step: 22, // Not a multiple of 5
    })
  }, 'Value 22 is not a multiple of step 5 for i16Step')

  throws(async () => {
    db.create('user', {
      numberStep: 88, // Not a multiple of 5
    })
  }, 'Value 88 is not a multiple of step 5 for numberStep')

  throws(async () => {
    db.create('user', {
      timestampStep: 1, // Not a multiple of 5
    })
  }, 'Value 1 is not a multiple of step 5 for timestampStep')
})
