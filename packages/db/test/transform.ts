import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

import { createRequire } from 'module'
global.require = createRequire(import.meta.url)

await test('transform', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    locales: {
      en: true,
      nl: true,
    },
    types: {
      user: {
        props: {
          x: {
            type: 'uint8',
            transform: (type, value) => {
              if (type === 'read') {
                return value
              }
              if (value === 66) {
                return 99
              }
            },
          },
          bla: {
            type: 'string',
            transform: () => {
              return 'bla'
            },
          },
          text: {
            type: 'text',
            // pass ctx else hard to see which lang we are dealing with
            transform: (type, value) => {
              if (type === 'read' || typeof value !== 'string') {
                return value
              }
              if (value === '1') {
                return '1!'
              }
            },
          },
          password: {
            type: 'binary',
            format: 'password',
            validation: (val: string | Uint8Array) => {
              return true
            },
            // So you need to read the transform type to determine the TS value for this
            transform: (type, value: string | Uint8Array | Buffer) => {
              if (type === 'read' || typeof value !== 'string') {
                return value
              }
              return require('crypto').createHmac('sha256', value).digest()
            },
          },
        },
      },
    },
  })

  const user = await db.create('user', {
    password: 'mygreatpassword',
    bla: '?',
    x: 66,
    text: {
      en: '1',
      nl: '1',
    },
  })

  await db.update('user', user, {
    password: 'mygreatpassword!',
  })

  deepEqual(await db.query('user').get(), [
    {
      id: 1,
      bla: 'bla',
      x: 99,
      text: {
        en: '1!',
        nl: '1!',
      },
      password: new Uint8Array([
        253, 18, 16, 127, 90, 5, 15, 250, 95, 190, 48, 60, 71, 196, 119, 28,
        161, 183, 21, 155, 193, 162, 130, 132, 43, 40, 160, 239, 38, 80, 122,
        149,
      ]),
    },
  ])

  deepEqual(
    await db.query('user', user).include('id').filter('x', '=', 66).get(),
    { id: 1 },
  )

  deepEqual(
    await db
      .query('user', user)
      .include('id')
      .filter('password', '=', 'mygreatpassword!')
      .get(),
    { id: 1 },
  )

  deepEqual(
    await db
      .query('user')
      .filter('password', '=', 'mygreatpassword!')
      .include('id')
      // .test() // 'every' , '>', '<', 10, 'none'
      .get(),
    [{ id: 1 }],
  )
})
