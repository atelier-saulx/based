import { testDb } from './shared/index.js'
import test from './shared/test.js'

await test('too large payload should throw, correct size should not', async (t) => {
  const client = await testDb(t, {
    types: {
      user: {
        props: {
          name: 'string',
        },
      },
    },
  })

  let error: Error | null = null
  try {
    client.create('user', {
      name: 'cool string but too long for the max size unfortunately wow what the hell'.repeat(
        4,
      ),
    })
  } catch (e) {
    error = e
  }

  if (error) {
    console.info('expected error: ', error.toString())
  } else {
    throw new Error('Too large payload should throw!')
  }

  let i = 10
  while (i--) {
    client.create('user', {
      name: 'user' + i,
    })
  }

  await client.drain()
})
