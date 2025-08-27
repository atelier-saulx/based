import { equal } from 'assert'
import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { italy } from './shared/examples.js'

await test('slice string / text', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  // t.after(() => t.backup(db))
  t.after(() => db.stop())

  await db.setSchema({
    locales: {
      en: {},
      it: {},
    },
    types: {
      item: {
        props: {
          x: 'uint32',
          name: 'string',
          body: 'text',
          a: 'string',
          b: 'string',
          c: 'string',
          d: 'string',
          e: 'string',
          f: 'string',
          g: 'string',
          h: 'string',
          flags: 'string',
          bigBoyString: 'string',
        },
      },
    },
  })

  let bigBoyString = '🤪🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸'
  for (let i = 0; i < 200; i++) {
    bigBoyString += 'a'
  }

  const id1 = await db.create('item', {
    // first uncompressed then compressed!
    // use something long e.g. italy
    name: 'abcdefg',
    // b: italy,
    c: '🤪💩👌⚡️🤪💩👌⚡️',
    d: 'üaßßa',
    e: '你a好AAAA',
    f: '€Abc',
    g: 'éAAAA',
    h: '🚀🚀🚀🚀🚀🚀🚀',
    flags: '🇺🇸🇿🇼🇺🇸',
    bigBoyString,
  })

  // const q = await db.query('item', 1).get()
  // equal(q.id, 1)

  const x = await db
    .query('item', id1)
    // .include('name', {
    //   end: 1,
    // })
    // .include('d', {
    //   end: 4,
    // })
    // .include('flags', {
    //   end: 2,
    // })
    // .include('e', {
    //   end: 1,
    // })
    // .include('f', {
    //   end: 1,
    // })
    // // .include('b', {
    // //   end: 200,
    // // })
    // .include('c', {
    //   end: 1,
    // })
    // .include('g', {
    //   end: 1,
    // })
    // .include('e', {
    //   end: 3,
    // })
    .include('bigBoyString', { end: 5 })
    .get()
    .inspect()

  console.log(new TextEncoder().encode(x.toObject().c))

  // for (let i = 0; i < 100e3; i++) {
  //   db.create('item', {
  //     x: i,
  //     name: `Name ${i}`,
  //     a: 'a',
  //     b: 'b',
  //     c: 'c',
  //     d: 'd',
  //     e: 'e',
  //     body: { it: `It ${i}`, en: `En ${i}` },
  //   })
  // }

  // console.log(await db.drain())
  // await db
  //   .query('item')
  //   // .include('name', { start: 0, end: 5 })
  //   .range(0, 1e6)
  //   .get()
  //   .inspect()
})
