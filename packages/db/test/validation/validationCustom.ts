import { BasedDb } from '../../src/index.ts'
import { throws } from '../shared/assert.ts'
import test from '../shared/test.ts'

await test('custom', async (t) => {
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
          snurp: {
            ref: 'user',
            prop: 'snurp',
            $flap: {
              type: 'enum',
              enum: ['a', 'b', 'c'],
              validation: (val) => {
                return val != 'b'
              },
            },
          },
          u32: {
            type: 'uint32',
            validation: (v) => {
              return v > 10
            },
          },
        },
      },
    },
  })

  const user = db.create('user', {
    u32: 100,
  })

  await throws(async () => {
    db.create('user', {
      u32: 1,
    })
  })

  await throws(async () => {
    db.create('user', {
      snurp: {
        id: user,
        $flap: 'b',
      },
    })
  })
})
