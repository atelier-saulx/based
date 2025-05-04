import { deepEqual } from './shared/assert.js'
import test from './shared/test.js'
import { start } from './shared/multi.js'

await test('upsert', async (t) => {
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
})
