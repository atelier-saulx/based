import test from '../shared/test.js'
import { testDb } from '../shared/index.js'
import { isSorted } from '../shared/assert.js'
import wait from '../../src/utils/wait.js'

// This is skipped because there is currently no way to automatically
// assert the existence of inidices
await test.skip('decay', async (t) => {
  const db = await testDb(t, {
    types: {
      example: {
        props: {
          u32: 'uint32',
        },
      },
    },
  })

  const len = 10
  for (let i = 0; i < len; i++) {
    await db.create('example', {
      u32: i,
    })
  }

  await db.update('example', 1, {
    u32: { increment: 100 },
  })

  isSorted(await db.query('example').sort('u32').include('u32').get(), 'u32')

  await db.update('example', 5, {
    u32: { increment: 100 },
  })

  isSorted(await db.query('example').sort('u32').include('u32').get(), 'u32')

  await wait(15e3)
  console.log('queries')
  for (let i = 0; i < 1000; i++) {
    isSorted(await db.query('example').sort('u32').include('u32').get(), 'u32')
  }
  await wait(15e3)
  console.log('queries')
  for (let i = 0; i < 1000; i++) {
    isSorted(await db.query('example').sort('u32').include('u32').get(), 'u32')
  }
  await wait(1 * 60e3)
  console.log('done waiting')
})
