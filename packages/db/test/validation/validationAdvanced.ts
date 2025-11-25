import { convertToTimestamp } from '../../src/utils/index.js'
import { BasedDb } from '../../src/db.js'
import { throws } from '../shared/assert.js'
import test from '../shared/test.js'

await test('simple min / max validation', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => t.backup(db))

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
          timestamp: { type: 'timestamp', max: 20, min: 10, step: 10 },
        },
      },
    },
  })

  await throws(async () => {
    db.create('user', {
      u32: 30,
    })
  })

  await throws(async () => {
    db.create('user', {
      u32: 0,
    })
  })

  await throws(async () => {
    db.create('user', {
      u8: 30,
    })
  })

  await throws(async () => {
    db.create('user', {
      u8: 0,
    })
  })

  await throws(async () => {
    db.create('user', {
      i8: 30,
    })
  })

  await throws(async () => {
    db.create('user', {
      i8: 0,
    })
  })

  await throws(async () => {
    db.create('user', {
      i32: 30,
    })
  })

  await throws(async () => {
    db.create('user', {
      i32: 0,
    })
  })

  await throws(async () => {
    db.create('user', {
      u16: 30,
    })
  })

  await throws(async () => {
    db.create('user', {
      u16: 0,
    })
  })

  await throws(async () => {
    db.create('user', {
      i16: 30,
    })
  })

  await throws(async () => {
    db.create('user', {
      i16: 0,
    })
  })

  await throws(async () => {
    db.create('user', {
      number: 30,
    })
  })

  await throws(async () => {
    db.create('user', {
      number: 0,
    })
  })

  await throws(async () => {
    db.create('user', {
      timestamp: 30,
    })
  })

  await throws(async () => {
    db.create('user', {
      timestamp: 0,
    })
  })

  await db.create('user', { u32: 10 })
  await db.create('user', { u32: 20 })

  await throws(async () => {
    db.create('user', {
      u32: 15,
    })
  })
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

  await db.create('user', { u32Step: 15 })
  await db.create('user', { u8Step: 10 })
  await db.create('user', { i8Step: 5 })
  await db.create('user', { i32Step: 95 })
  await db.create('user', { u16Step: 100 })
  await db.create('user', { i16Step: 0 })
  await db.create('user', { numberStep: 50 })
  await db.create('user', { timestampStep: 25 })

  await throws(async () => {
    db.create('user', {
      u32Step: 12,
    })
  })

  await throws(async () => {
    db.create('user', {
      u8Step: 7,
    })
  })

  await throws(async () => {
    db.create('user', {
      i8Step: 99,
    })
  })

  await throws(async () => {
    db.create('user', {
      i32Step: 3,
    })
  })

  await throws(async () => {
    db.create('user', {
      u16Step: 51,
    })
  })

  await throws(async () => {
    db.create('user', {
      i16Step: 22,
    })
  })

  await throws(async () => {
    db.create('user', {
      numberStep: 88,
    })
  })

  await throws(async () => {
    db.create('user', {
      timestampStep: 1,
    })
  })
})

await test('min / max validation on reference edges', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      thing: {},
      edgeUser: {
        props: {
          things: {
            items: {
              ref: 'thing',
              prop: 'users',
              $u32: { type: 'uint32', max: 20, min: 10, step: 10 },
              $u8: { type: 'uint8', max: 20, min: 10, step: 10 },
              $i8: { type: 'int8', max: 20, min: 10, step: 10 },
              $i32: { type: 'int32', max: 20, min: 10, step: 10 },
              $u16: { type: 'uint16', max: 20, min: 10, step: 10 },
              $i16: { type: 'int16', max: 20, min: 10, step: 10 },
              $number: { type: 'number', max: 20, min: 10, step: 10 },
              $timestamp: { type: 'timestamp', max: 20, min: 10, step: 10 },
            },
          },
        },
      },
    },
  })

  const thing1 = await db.create('thing', {})
  const user1 = await db.create('edgeUser', {})

  await throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $u32: 30 }],
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $u32: 30 }] },
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $u32: 30 }] },
    })
  })

  await throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $u32: 0 }],
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $u32: 0 }] },
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $u32: 0 }] },
    })
  })

  await throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $u8: 30 }],
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $u8: 30 }] },
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $u8: 30 }] },
    })
  })

  await throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $u8: 0 }],
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $u8: 0 }] },
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $u8: 0 }] },
    })
  })

  await throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $i8: 30 }],
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $i8: 30 }] },
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $i8: 30 }] },
    })
  })

  await throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $i8: 0 }],
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $i8: 0 }] },
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $i8: 0 }] },
    })
  })

  await throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $i32: 30 }],
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $i32: 30 }] },
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $i32: 30 }] },
    })
  })

  await throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $i32: 0 }],
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $i32: 0 }] },
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $i32: 0 }] },
    })
  })

  await throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $u16: 30 }],
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $u16: 30 }] },
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $u16: 30 }] },
    })
  })

  await throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $u16: 0 }],
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $u16: 0 }] },
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $u16: 0 }] },
    })
  })

  await throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $i16: 30 }],
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $i16: 30 }] },
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $i16: 30 }] },
    })
  })

  await throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $i16: 0 }],
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $i16: 0 }] },
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $i16: 0 }] },
    })
  })

  await throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $number: 30 }],
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $number: 30 }] },
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $number: 30 }] },
    })
  })

  await throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $number: 0 }],
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $number: 0 }] },
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $number: 0 }] },
    })
  })

  await throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $timestamp: 30 }],
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $timestamp: 30 }] },
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $timestamp: 30 }] },
    })
  })

  await throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $timestamp: 0 }],
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $timestamp: 0 }] },
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $timestamp: 0 }] },
    })
  })

  await db.create('edgeUser', { things: [{ id: thing1, $u32: 10 }] })
  await db.create('edgeUser', { things: [{ id: thing1, $u32: 20 }] })

  await throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $u32: 15 }],
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $u32: 15 }] },
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $u32: 15 }] },
    })
  })
})

await test('step validation on reference edges', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      thing: {},
      edgeUser: {
        props: {
          things: {
            items: {
              ref: 'thing',
              prop: 'users',
              $u32Step: { type: 'uint32', max: 100, min: 0, step: 5 },
              $u8Step: { type: 'uint8', max: 100, min: 0, step: 5 },
              $i8Step: { type: 'int8', max: 100, min: 0, step: 5 },
              $i32Step: { type: 'int32', max: 100, min: 0, step: 5 },
              $u16Step: { type: 'uint16', max: 100, min: 0, step: 5 },
              $i16Step: { type: 'int16', max: 100, min: 0, step: 5 },
              $numberStep: { type: 'number', max: 100, min: 0, step: 5 },
              $timestampStep: { type: 'timestamp', max: 100, min: 0, step: 5 },
            },
          },
        },
      },
    },
  })

  const thing1 = await db.create('thing', {})
  const user1 = await db.create('edgeUser', {})

  await db.create('edgeUser', { things: [{ id: thing1, $u32Step: 15 }] })
  await db.create('edgeUser', { things: [{ id: thing1, $u8Step: 10 }] })
  await db.create('edgeUser', { things: [{ id: thing1, $i8Step: 5 }] })
  await db.create('edgeUser', { things: [{ id: thing1, $i32Step: 95 }] })
  await db.create('edgeUser', { things: [{ id: thing1, $u16Step: 100 }] })
  await db.create('edgeUser', { things: [{ id: thing1, $i16Step: 0 }] })
  await db.create('edgeUser', { things: [{ id: thing1, $numberStep: 50 }] })
  await db.create('edgeUser', { things: [{ id: thing1, $timestampStep: 25 }] })

  await throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $u32Step: 12 }],
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $u32Step: 12 }] },
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $u32Step: 12 }] },
    })
  })

  await throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $u8Step: 7 }],
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $u8Step: 7 }] },
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $u8Step: 7 }] },
    })
  })

  await throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $i8Step: 99 }],
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $i8Step: 99 }] },
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $i8Step: 99 }] },
    })
  })

  await throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $i32Step: 3 }],
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $i32Step: 3 }] },
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $i32Step: 3 }] },
    })
  })

  await throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $u16Step: 51 }],
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $u16Step: 51 }] },
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $u16Step: 51 }] },
    })
  })

  await throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $i16Step: 22 }],
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $i16Step: 22 }] },
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $i16Step: 22 }] },
    })
  })

  await throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $numberStep: 88 }],
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $numberStep: 88 }] },
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $numberStep: 88 }] },
    })
  })

  await throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $timestampStep: 1 }],
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $timestampStep: 1 }] },
    })
  })
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $timestampStep: 1 }] },
    })
  })
})

await test('min / max / step validation on reference edges timestamp + string format', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => db.destroy())

  const minDateStr = '01/01/2000'
  const minTs = convertToTimestamp(minDateStr)
  const maxOffsetSeconds = 10
  const stepMs = 1 // 1 second

  await db.setSchema({
    types: {
      thing: {},
      edgeUser: {
        props: {
          ts: { type: 'timestamp', step: '1s' },
          things: {
            items: {
              ref: 'thing',
              prop: 'users', // Assuming 'users' exists on 'thing' or handle appropriately
              $timestamp: {
                type: 'timestamp',
                max: `now + ${maxOffsetSeconds}s`,
                min: minDateStr,
                step: stepMs,
              },
            },
          },
        },
      },
    },
  })

  const thing1 = await db.create('thing', {})
  const user1 = await db.create('edgeUser', {})
  const validFutureTs = Math.floor(Date.now() / stepMs) * stepMs + stepMs * 2

  await db.create('edgeUser', {
    ts: '01/02/2000',
  })

  await throws(async () => {
    db.create('edgeUser', {
      ts: 'now + 1',
    })
  }, 'Wrong step')

  await db.create('edgeUser', {
    things: [{ id: thing1, $timestamp: minTs }],
  })
  await db.update('edgeUser', user1, {
    things: { add: [{ id: thing1, $timestamp: minTs + stepMs * 5 }] },
  })
  await db.update('edgeUser', user1, {
    things: { update: [{ id: thing1, $timestamp: validFutureTs }] },
  })

  await db.update('edgeUser', user1, {
    things: { update: [{ id: thing1, $timestamp: 'now + 5s' }] }, // String format
  })

  await throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $timestamp: minTs - stepMs }],
    })
  }, 'Value is lower than min value')
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $timestamp: '31/12/1999' }] },
    })
  }, 'Value is lower than min value')
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $timestamp: minTs - stepMs }] },
    })
  }, 'Value is lower than min value')

  // Above max
  const aboveMaxTs = Date.now() + (maxOffsetSeconds + 5) * 1000
  await throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $timestamp: aboveMaxTs }],
    })
  }, 'Value is higher than max value')
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: {
        add: [{ id: thing1, $timestamp: `now + ${maxOffsetSeconds + 5}s` }],
      },
    })
  }, 'Value is higher than max value')
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $timestamp: aboveMaxTs }] },
    })
  }, 'Value is higher than max value')

  // Incorrect step
  const invalidStepTs = minTs + stepMs / 2
  await throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $timestamp: invalidStepTs }],
    })
  }, 'Value is not divisable by step')
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $timestamp: invalidStepTs }] },
    })
  }, 'Value is not divisable by step')
  await throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $timestamp: invalidStepTs }] },
    })
  }, 'Value is not divisable by step')
})
