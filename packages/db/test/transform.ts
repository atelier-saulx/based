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

  // something like this has to happen on schema stuff in the server auto by builder
  global.createHmac = crypto.createHmac

  await db.setSchema({
    types: {
      user: {
        props: {
          password: {
            type: 'binary',
            format: 'password',
            validation: (val: string | Uint8Array) => {
              console.log('derp ->', val)
              return true
            },
            // So you need to read the transform type to determine the TS value for this
            transform: (type, value: string | Uint8Array | Buffer) => {
              console.log(' ', type, value)
              if (type === 'read' || typeof value !== 'string') {
                return value
              }
              return global.createHmac('sha256', value).digest()
            },
          },
        },
      },
    },
  })

  // if buffer convert it

  const user = await db.create('user', {
    password: 'mygreatpassword',
  })

  await db.update('user', user, {
    password: 'mygreatpassword!',
  })

  await db.query('user').get().inspect()
})
