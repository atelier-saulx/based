import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'
import { italy } from './shared/examples.js'

await test('text', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  db.putSchema({
    locales: {
      en: {},
      it: { fallback: ['en'] },
      fi: { fallback: ['en'] },
    },
    types: {
      dialog: {
        props: {
          fun: {
            type: 'text',
          },
        },
      },
    },
  })

  db.create('dialog', {
    fun: { en: '1', it: italy, fi: '3' },
  })

  await db.drain()

  await db.query('dialog').include('id', 'fun').get().inspect()

  await db.query('dialog').include('id').get().inspect()

  await db.query('dialog').i18n('it').include('id', 'fun').get().inspect()

  // derp derp
  console.log('-------------------------')
  await db
    .query('dialog')
    .i18n('it')
    .include('id', 'fun')
    .filter('fun', 'has', 'fliperdieflaperdiefloep', { normalized: true })
    .get()
    .inspect()

  console.log('-------------------------')

  await db
    .query('dialog')
    .include('id', 'fun')
    // i18n will have to be passed here better...
    .filter('fun', 'has', 'italy', { normalized: true })
    .get()
    .inspect()

  await db
    .query('dialog')
    .i18n('it')
    .include('id', 'fun')
    // i18n will have to be passed here better...
    .filter('fun', 'has', 'italy', { normalized: true })
    .get()
    .inspect()

  console.log('-------------------------')

  await db
    .query('dialog')
    .include('id', 'fun')
    // i18n will have to be passed here better...
    .filter('fun.en', 'has', 'italy', { normalized: true })
    .get()
    .inspect()

  console.log('-------------------------')

  await db
    .query('dialog')
    .include('id', 'fun')
    // i18n will have to be passed here better...
    .filter('fun.it', 'has', 'italy', { normalized: true })
    .get()
    .inspect()

  console.log('-------------------------')

  await db
    .query('dialog')
    .i18n('en')
    .include('id', 'fun')
    // i18n will have to be passed here better...
    .filter('fun.it', 'has', 'italy', { normalized: true })
    .get()
    .inspect()

  const mrSnurfInFinlind = await db.create(
    'dialog',
    {
      fun: 'mr snurf in finland',
    },
    { i18n: 'fi' },
  )

  await db.query('dialog').include('id', 'fun').i18n('fi').get().inspect()

  await db.update(
    'dialog',
    mrSnurfInFinlind,
    {
      fun: 'mr snurf in finland!',
    },
    { i18n: 'fi' },
  )

  await db.query('dialog').include('id', 'fun').i18n('fi').get().inspect()

  const derpderp = await db.create('dialog', {})

  console.log(await db.query('dialog', mrSnurfInFinlind).get())

  console.log('-------------------------')

  console.log(await db.query('dialog', derpderp).get())

  // TODO: if text we prob need to create a empty object in js
})
