import { deepEqual } from './shared/assert.js'
import test from './shared/test.js'
import { start } from './shared/multi.js'

await test('client server basic', async (t) => {
  const {
    clients: [client1, client2],
  } = await start(t)

  await client1.setSchema({
    types: {
      user: {
        name: 'string',
      },
    },
  })

  const youzi = await client1.create('user', {
    name: 'youzi',
  })

  const jamez = await client1.create('user', {
    name: 'jamez',
  })

  deepEqual(await client1.query('user').get(), [
    { id: 1, name: 'youzi' },
    { id: 2, name: 'jamez' },
  ])

  await client1.setSchema({
    types: {
      user: {
        age: 'number',
      },
    },
  })

  deepEqual(await client1.query('user').get(), [
    { id: 1, age: 0 },
    { id: 2, age: 0 },
  ])

  await client1.setSchema({
    types: {
      user: {
        name: 'string',
        age: 'number',
        others: {
          items: {
            ref: 'user',
            prop: 'others',
          },
        },
        favoriteUser: {
          ref: 'user',
          prop: 'favoriteUser',
        },
      },
    },
  })

  const fred = client1.create('user', {
    name: 'fred',
  })

  await client1.isModified()

  const marie = await client2.create('user', {
    name: 'marie',
  })

  const res = await client1.update('user', youzi, {
    name: 'youzi',
    others: [fred, marie],
    favoriteUser: marie,
  })

  deepEqual(
    await client1.query('user', res).include('*', '**').get(),
    {
      id: 1,
      age: 0,
      name: 'youzi',
      others: [
        { id: 3, age: 0, name: 'fred' },
        { id: 4, age: 0, name: 'marie' },
      ],
      favoriteUser: { id: 4, age: 0, name: 'marie' },
    },
    'correct favouritUser and other for youzi',
  )
})
