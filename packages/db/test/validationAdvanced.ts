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

  throws(async () => {
    db.create('user', {
      u32: 30,
    })
  })

  throws(async () => {
    db.create('user', {
      u32: 0,
    })
  })

  throws(async () => {
    db.create('user', {
      u8: 30,
    })
  })

  throws(async () => {
    db.create('user', {
      u8: 0,
    })
  })

  throws(async () => {
    db.create('user', {
      i8: 30,
    })
  })

  throws(async () => {
    db.create('user', {
      i8: 0,
    })
  })

  throws(async () => {
    db.create('user', {
      i32: 30,
    })
  })

  throws(async () => {
    db.create('user', {
      i32: 0,
    })
  })

  throws(async () => {
    db.create('user', {
      u16: 30,
    })
  })

  throws(async () => {
    db.create('user', {
      u16: 0,
    })
  })

  throws(async () => {
    db.create('user', {
      i16: 30,
    })
  })

  throws(async () => {
    db.create('user', {
      i16: 0,
    })
  })

  throws(async () => {
    db.create('user', {
      number: 30,
    })
  })

  throws(async () => {
    db.create('user', {
      number: 0,
    })
  })

  throws(async () => {
    db.create('user', {
      timestamp: 30,
    })
  })

  throws(async () => {
    db.create('user', {
      timestamp: 0,
    })
  })

  await db.create('user', { u32: 10 })
  await db.create('user', { u32: 20 })

  throws(async () => {
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

  throws(async () => {
    db.create('user', {
      u32Step: 12,
    })
  })

  throws(async () => {
    db.create('user', {
      u8Step: 7,
    })
  })

  throws(async () => {
    db.create('user', {
      i8Step: 99,
    })
  })

  throws(async () => {
    db.create('user', {
      i32Step: 3,
    })
  })

  throws(async () => {
    db.create('user', {
      u16Step: 51,
    })
  })

  throws(async () => {
    db.create('user', {
      i16Step: 22,
    })
  })

  throws(async () => {
    db.create('user', {
      numberStep: 88,
    })
  })

  throws(async () => {
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

  t.after(() => db.destroy())

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

  throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $u32: 30 }],
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $u32: 30 }] },
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $u32: 30 }] },
    })
  })

  throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $u32: 0 }],
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $u32: 0 }] },
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $u32: 0 }] },
    })
  })

  throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $u8: 30 }],
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $u8: 30 }] },
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $u8: 30 }] },
    })
  })

  throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $u8: 0 }],
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $u8: 0 }] },
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $u8: 0 }] },
    })
  })

  throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $i8: 30 }],
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $i8: 30 }] },
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $i8: 30 }] },
    })
  })

  throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $i8: 0 }],
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $i8: 0 }] },
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $i8: 0 }] },
    })
  })

  throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $i32: 30 }],
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $i32: 30 }] },
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $i32: 30 }] },
    })
  })

  throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $i32: 0 }],
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $i32: 0 }] },
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $i32: 0 }] },
    })
  })

  throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $u16: 30 }],
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $u16: 30 }] },
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $u16: 30 }] },
    })
  })

  throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $u16: 0 }],
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $u16: 0 }] },
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $u16: 0 }] },
    })
  })

  throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $i16: 30 }],
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $i16: 30 }] },
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $i16: 30 }] },
    })
  })

  throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $i16: 0 }],
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $i16: 0 }] },
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $i16: 0 }] },
    })
  })

  throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $number: 30 }],
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $number: 30 }] },
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $number: 30 }] },
    })
  })

  throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $number: 0 }],
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $number: 0 }] },
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $number: 0 }] },
    })
  })

  throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $timestamp: 30 }],
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $timestamp: 30 }] },
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $timestamp: 30 }] },
    })
  })

  throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $timestamp: 0 }],
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $timestamp: 0 }] },
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $timestamp: 0 }] },
    })
  })

  await db.create('edgeUser', { things: [{ id: thing1, $u32: 10 }] })
  await db.create('edgeUser', { things: [{ id: thing1, $u32: 20 }] })

  throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $u32: 15 }],
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $u32: 15 }] },
    })
  })
  throws(async () => {
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

  t.after(() => db.destroy())

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

  throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $u32Step: 12 }],
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $u32Step: 12 }] },
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $u32Step: 12 }] },
    })
  })

  throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $u8Step: 7 }],
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $u8Step: 7 }] },
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $u8Step: 7 }] },
    })
  })

  throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $i8Step: 99 }],
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $i8Step: 99 }] },
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $i8Step: 99 }] },
    })
  })

  throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $i32Step: 3 }],
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $i32Step: 3 }] },
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $i32Step: 3 }] },
    })
  })

  throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $u16Step: 51 }],
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $u16Step: 51 }] },
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $u16Step: 51 }] },
    })
  })

  throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $i16Step: 22 }],
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $i16Step: 22 }] },
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $i16Step: 22 }] },
    })
  })

  throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $numberStep: 88 }],
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $numberStep: 88 }] },
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $numberStep: 88 }] },
    })
  })

  throws(async () => {
    db.create('edgeUser', {
      things: [{ id: thing1, $timestampStep: 1 }],
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { add: [{ id: thing1, $timestampStep: 1 }] },
    })
  })
  throws(async () => {
    db.update('edgeUser', user1, {
      things: { update: [{ id: thing1, $timestampStep: 1 }] },
    })
  })
})
