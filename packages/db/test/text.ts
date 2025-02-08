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
    .filter('fun', 'hasLoose', 'fliperdieflaperdiefloep')
    .get()
    .inspect()

  console.log('-------------------------')

  await db
    .query('dialog')
    .include('id', 'fun')
    // i18n will have to be passed here better...
    .filter('fun', 'hasLoose', 'italy')
    .get()
    .inspect()

  await db
    .query('dialog')
    .i18n('it')
    .include('id', 'fun')
    // i18n will have to be passed here better...
    .filter('fun', 'hasLoose', 'italy')
    .get()
    .inspect()

  console.log('-------------------------')

  await db
    .query('dialog')
    .include('id', 'fun')
    // i18n will have to be passed here better...
    .filter('fun.en', 'hasLoose', 'italy')
    .get()
    .inspect()

  console.log('-------------------------')

  await db
    .query('dialog')
    .include('id', 'fun')
    // i18n will have to be passed here better...
    .filter('fun.it', 'hasLoose', 'italy')
    .get()
    .inspect()

  // TODO: if text we prob need to create a empty object in js
})
