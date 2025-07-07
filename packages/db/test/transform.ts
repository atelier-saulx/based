import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'
import crypto from 'crypto'

await test('transform', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  global.createHmac = crypto.createHmac

  await db.setSchema({
    types: {
      user: {
        props: {
          password: {
            type: 'string',
            format: 'password',
            transform: (type, value) => {
              if (type === 'read') {
                return value
              }
              // binary is nice so you can check
              // might need a skip transform option for things like migrate
              return global.createHmac('sha256', value).digest().toString()
            },
          },
        },
      },
    },
  })

  // if buffer convert it

  await db.create('user', {
    password: 'mygreatpassword',
  })

  await db.query('user').get().inspect()
})
