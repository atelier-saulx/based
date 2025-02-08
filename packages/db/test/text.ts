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

  console.log(await db.query('dialog').include('id', 'fun').get())

  console.log(await db.query('dialog').include('id').get())

  console.log(await db.query('dialog').i18n('it').include('id', 'fun').get())

  await db
    .query('dialog')
    .i18n('it')
    .filter('fun', 'has', 'derpol')
    .include('id', 'fun')
    .get()
    .inspect()
})
